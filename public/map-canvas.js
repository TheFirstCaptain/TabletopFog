const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const MAX_DEVICE_PIXEL_RATIO = 2;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getCenter(points) {
  const total = points.reduce((center, point) => ({ x: center.x + point.x, y: center.y + point.y }), { x: 0, y: 0 });

  return { x: total.x / points.length, y: total.y / points.length };
}

function addCacheKey(assetUrl, map) {
  const separator = assetUrl.includes("?") ? "&" : "?";
  const id = encodeURIComponent(`${map.campaignId || "campaign"}/${map.id}`);
  const version = encodeURIComponent(map.version ?? "current");
  return `${assetUrl}${separator}map=${id}&version=${version}`;
}

function createDefaultResizeObserver(callback) {
  return typeof ResizeObserver === "undefined" ? null : new ResizeObserver(callback);
}

export function createMapCanvasRenderer({
  canvas,
  fogOpacity = 0,
  interactive = false,
  onStatus = () => {},
  onViewportChange = () => {},
  imageFactory = () => new Image(),
  resizeObserverFactory = createDefaultResizeObserver,
  devicePixelRatio = () => window.devicePixelRatio || 1
}) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Map canvas requires a 2D rendering context.");

  const state = {
    destroyed: false,
    drawFrame: null,
    fogMaskBuilds: 0,
    fogMaskDirty: true,
    fogOperationsSignature: "[]",
    generation: 0,
    image: null,
    fogOperations: [],
    maskCanvas: canvas.ownerDocument.createElement("canvas"),
    maskContext: null,
    map: null,
    panX: 0,
    panY: 0,
    pendingImage: null,
    pointers: new Map(),
    pointerSnapshot: null,
    stageHeight: 0,
    stageWidth: 0,
    status: "empty",
    zoom: 1
  };
  state.maskContext = state.maskCanvas.getContext("2d");

  const originalTouchAction = canvas.style.touchAction;

  function reportStatus(status, details = {}) {
    state.status = status;
    onStatus({ state: status, map: state.map, ...details });
  }

  function getViewport() {
    return {
      maxZoom: MAX_ZOOM,
      minZoom: MIN_ZOOM,
      panX: state.panX,
      panY: state.panY,
      status: state.status,
      step: ZOOM_STEP,
      zoom: state.zoom
    };
  }

  function reportViewport() {
    onViewportChange(getViewport());
  }

  function getPixelRatio() {
    const value = typeof devicePixelRatio === "function" ? devicePixelRatio() : devicePixelRatio;
    return clamp(Number.isFinite(value) ? value : 1, 1, MAX_DEVICE_PIXEL_RATIO);
  }

  function normalizeFogOperations(operations) {
    return Array.isArray(operations)
      ? operations.filter((operation) => {
          const rect = operation?.rect || {};
          if (
            (operation.type === "hide-rectangle" || operation.type === "reveal-rectangle") &&
            [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
            rect.x >= 0 &&
            rect.y >= 0 &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.x + rect.width <= 1 &&
            rect.y + rect.height <= 1
          ) {
            return true;
          }

          const circle = operation?.circle || {};
          return (
            (operation.type === "hide-circle" || operation.type === "reveal-circle") &&
            [circle.x, circle.y, circle.radius].every(Number.isFinite) &&
            circle.x >= 0 &&
            circle.x <= 1 &&
            circle.y >= 0 &&
            circle.y <= 1 &&
            circle.radius > 0 &&
            circle.radius <= 1
          );
        })
      : [];
  }

  function markFogMaskDirty() {
    state.fogMaskDirty = true;
  }

  function getFogOperationsSignature(operations) {
    return JSON.stringify(operations);
  }

  function getDrawMetrics() {
    if (!state.image || !state.stageWidth || !state.stageHeight) return null;

    const imageWidth = state.image.naturalWidth || state.image.width;
    const imageHeight = state.image.naturalHeight || state.image.height;
    if (!imageWidth || !imageHeight) return null;

    const containScale = Math.min(state.stageWidth / imageWidth, state.stageHeight / imageHeight);
    const width = imageWidth * containScale * state.zoom;
    const height = imageHeight * containScale * state.zoom;
    const maxPanX = Math.max(0, (width - state.stageWidth) / 2);
    const maxPanY = Math.max(0, (height - state.stageHeight) / 2);

    state.panX = clamp(state.panX, -maxPanX, maxPanX);
    state.panY = clamp(state.panY, -maxPanY, maxPanY);

    const x = (state.stageWidth - width) / 2 + state.panX;
    const y = (state.stageHeight - height) / 2 + state.panY;
    canvas.dataset.drawHeight = String(Math.round(height));
    canvas.dataset.drawWidth = String(Math.round(width));
    canvas.dataset.drawX = String(Math.round(x));
    canvas.dataset.drawY = String(Math.round(y));
    canvas.dataset.fogOperations = String(state.fogOperations.length);
    canvas.dataset.panX = String(Math.round(state.panX));
    canvas.dataset.panY = String(Math.round(state.panY));
    return { height, width, x, y };
  }

  function draw() {
    state.drawFrame = null;
    if (state.destroyed) return;

    context.clearRect(0, 0, state.stageWidth, state.stageHeight);
    const metrics = getDrawMetrics();
    if (!metrics || state.status !== "ready") {
      delete canvas.dataset.drawWidth;
      delete canvas.dataset.drawHeight;
      delete canvas.dataset.drawX;
      delete canvas.dataset.drawY;
      delete canvas.dataset.fogOperations;
      delete canvas.dataset.fogMaskBuilds;
      delete canvas.dataset.panX;
      delete canvas.dataset.panY;
      return;
    }

    context.drawImage(state.image, metrics.x, metrics.y, metrics.width, metrics.height);
    drawFog(metrics);
  }

  function drawFog(metrics) {
    if (!state.fogOperations.length || fogOpacity <= 0 || !state.maskContext) return;
    if (!ensureFogMask()) return;

    context.save();
    context.globalAlpha = fogOpacity;
    context.drawImage(state.maskCanvas, metrics.x, metrics.y, metrics.width, metrics.height);
    context.restore();
  }

  function ensureFogMask() {
    const imageWidth = state.image?.naturalWidth || state.image?.width;
    const imageHeight = state.image?.naturalHeight || state.image?.height;
    if (!imageWidth || !imageHeight || !state.maskContext) return false;

    if (!state.fogMaskDirty && state.maskCanvas.width === imageWidth && state.maskCanvas.height === imageHeight) {
      return true;
    }

    state.maskCanvas.width = imageWidth;
    state.maskCanvas.height = imageHeight;
    const maskContext = state.maskContext;
    maskContext.globalCompositeOperation = "source-over";
    maskContext.clearRect(0, 0, imageWidth, imageHeight);

    maskContext.fillStyle = "black";
    state.fogOperations.forEach((operation) => {
      maskContext.globalCompositeOperation = operation.type.startsWith("reveal-") ? "destination-out" : "source-over";

      if (operation.type.endsWith("-circle")) {
        const circle = operation.circle;
        const x = imageWidth * circle.x;
        const y = imageHeight * circle.y;
        const radius = Math.min(imageWidth, imageHeight) * circle.radius;
        maskContext.beginPath();
        maskContext.arc(x, y, radius, 0, Math.PI * 2);
        maskContext.fill();
        return;
      }

      const rect = operation.rect;
      const x = imageWidth * rect.x;
      const y = imageHeight * rect.y;
      const width = imageWidth * rect.width;
      const height = imageHeight * rect.height;
      maskContext.fillRect(x, y, width, height);
    });

    state.fogMaskBuilds += 1;
    state.fogMaskDirty = false;
    maskContext.globalCompositeOperation = "source-over";
    canvas.dataset.fogMaskBuilds = String(state.fogMaskBuilds);
    return true;
  }

  function scheduleDraw() {
    if (state.drawFrame !== null || state.destroyed) return;
    state.drawFrame = -1;
    const frame = requestAnimationFrame(draw);
    if (state.drawFrame !== null) state.drawFrame = frame;
  }

  function resize() {
    if (state.destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(0, Math.round(bounds.width || canvas.clientWidth));
    const height = Math.max(0, Math.round(bounds.height || canvas.clientHeight));
    const pixelRatio = getPixelRatio();

    state.stageWidth = width;
    state.stageHeight = height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    scheduleDraw();
  }

  function updateZoom(nextZoom, focalPoint) {
    if (state.destroyed) return state.zoom;
    const previousZoom = state.zoom;
    const zoom = clamp(Number.isFinite(nextZoom) ? nextZoom : previousZoom, MIN_ZOOM, MAX_ZOOM);
    if (zoom === previousZoom) return zoom;

    if (focalPoint && state.image) {
      const centerX = state.stageWidth / 2;
      const centerY = state.stageHeight / 2;
      const ratio = zoom / previousZoom;
      state.panX = focalPoint.x - centerX - (focalPoint.x - centerX - state.panX) * ratio;
      state.panY = focalPoint.y - centerY - (focalPoint.y - centerY - state.panY) * ratio;
    }

    state.zoom = zoom;
    canvas.dataset.zoom = String(zoom);
    getDrawMetrics();
    reportViewport();
    scheduleDraw();
    return zoom;
  }

  function resetViewport() {
    if (state.destroyed) return state.zoom;
    state.panX = 0;
    state.panY = 0;
    state.zoom = 1;
    canvas.dataset.zoom = "1";
    reportViewport();
    scheduleDraw();
    return 1;
  }

  function setMap(map) {
    if (state.destroyed) return;
    const nextMap = map && map.id && map.assetUrl ? { ...map } : null;
    const nextFogOperations = normalizeFogOperations(nextMap?.fogOperations);
    const nextFogOperationsSignature = getFogOperationsSignature(nextFogOperations);
    const sameMap = Boolean(
      nextMap &&
      state.map &&
      nextMap.id === state.map.id &&
      (nextMap.campaignId || null) === (state.map.campaignId || null)
    );
    const nextSource = nextMap ? addCacheKey(nextMap.assetUrl, nextMap) : null;
    const currentSource = state.map ? addCacheKey(state.map.assetUrl, state.map) : null;
    const sourceChanged = nextSource !== currentSource;

    if (nextFogOperationsSignature !== state.fogOperationsSignature || sourceChanged || !sameMap) {
      markFogMaskDirty();
    }
    state.fogOperations = nextFogOperations;
    state.fogOperationsSignature = nextFogOperationsSignature;
    state.map = nextMap;
    if (!sameMap) resetViewport();

    if (!nextMap) {
      state.generation += 1;
      if (state.pendingImage) {
        state.pendingImage.onload = null;
        state.pendingImage.onerror = null;
        state.pendingImage = null;
      }
      state.image = null;
      markFogMaskDirty();
      canvas.hidden = true;
      canvas.removeAttribute("aria-label");
      reportStatus("empty");
      scheduleDraw();
      return;
    }

    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", nextMap.name ? `Map: ${nextMap.name}` : "Active map");

    if (sameMap && nextSource === currentSource && state.status !== "error") {
      reportStatus(state.status);
      scheduleDraw();
      return;
    }

    const generation = ++state.generation;
    if (state.pendingImage) {
      state.pendingImage.onload = null;
      state.pendingImage.onerror = null;
    }
    const image = imageFactory();
    state.pendingImage = image;
    state.image = null;
    markFogMaskDirty();
    canvas.hidden = true;
    reportStatus("loading");

    image.onload = () => {
      if (state.destroyed || generation !== state.generation) return;
      if (!(image.naturalWidth || image.width) || !(image.naturalHeight || image.height)) {
        image.onerror(new Error("Map image has invalid dimensions."));
        return;
      }

      state.pendingImage = null;
      state.image = image;
      markFogMaskDirty();
      canvas.hidden = false;
      reportStatus("ready");
      resize();
    };

    image.onerror = (error) => {
      if (state.destroyed || generation !== state.generation) return;
      state.pendingImage = null;
      state.image = null;
      markFogMaskDirty();
      canvas.hidden = true;
      reportStatus("error", { error });
      scheduleDraw();
    };

    image.src = nextSource;
  }

  function getPointerSnapshot() {
    const points = [...state.pointers.values()];
    return {
      center: getCenter(points),
      distance: points.length > 1 ? getDistance(points[0], points[1]) : null,
      size: points.length
    };
  }

  function onPointerDown(event) {
    if (!state.image || state.status !== "ready") return;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.dataset.panning = "true";
    state.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
    state.pointerSnapshot = getPointerSnapshot();
  }

  function onPointerMove(event) {
    if (!state.pointers.has(event.pointerId)) return;
    event.preventDefault();
    state.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });

    const previous = state.pointerSnapshot;
    const current = getPointerSnapshot();
    if (previous && previous.size === current.size) {
      if (current.distance && previous.distance) {
        const ratio = current.distance / previous.distance;
        updateZoom(state.zoom * ratio, previous.center);
      }

      state.panX += current.center.x - previous.center.x;
      state.panY += current.center.y - previous.center.y;
      getDrawMetrics();
      reportViewport();
      scheduleDraw();
    }
    state.pointerSnapshot = current;
  }

  function onPointerEnd(event) {
    state.pointers.delete(event.pointerId);
    state.pointerSnapshot = state.pointers.size ? getPointerSnapshot() : null;
    if (state.pointers.size === 0) delete canvas.dataset.panning;
  }

  function panBy(deltaX, deltaY) {
    if (!state.image || state.status !== "ready") return getViewport();
    state.panX += Number.isFinite(deltaX) ? deltaX : 0;
    state.panY += Number.isFinite(deltaY) ? deltaY : 0;
    getDrawMetrics();
    reportViewport();
    scheduleDraw();
    return getViewport();
  }

  function getNormalizedRectFromClientPoints(startClient, endClient) {
    const metrics = getDrawMetrics();
    if (!metrics || state.status !== "ready") return null;

    const bounds = canvas.getBoundingClientRect();
    const toStagePoint = (point) => {
      const x = point.clientX - bounds.left;
      const y = point.clientY - bounds.top;
      return {
        insideMap:
          x >= metrics.x && x <= metrics.x + metrics.width && y >= metrics.y && y <= metrics.y + metrics.height,
        x: clamp(x, metrics.x, metrics.x + metrics.width),
        y: clamp(y, metrics.y, metrics.y + metrics.height)
      };
    };
    const start = toStagePoint(startClient);
    const end = toStagePoint(endClient);
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    if (width <= 0 || height <= 0) return null;

    return {
      rect: {
        height: height / metrics.height,
        width: width / metrics.width,
        x: (left - metrics.x) / metrics.width,
        y: (top - metrics.y) / metrics.height
      },
      screenRect: {
        height,
        width,
        x: left,
        y: top
      },
      startInsideMap: start.insideMap
    };
  }

  function getNormalizedCircleFromClientPoint(clientPoint, diameterPercent) {
    const metrics = getDrawMetrics();
    if (!metrics || state.status !== "ready") return null;

    const bounds = canvas.getBoundingClientRect();
    const x = clientPoint.clientX - bounds.left;
    const y = clientPoint.clientY - bounds.top;
    const insideMap =
      x >= metrics.x && x <= metrics.x + metrics.width && y >= metrics.y && y <= metrics.y + metrics.height;
    const diameter = clamp(Number.isFinite(diameterPercent) ? diameterPercent : 1, 1, 200);
    const normalizedRadius = diameter / 200;
    const screenRadius = Math.min(metrics.width, metrics.height) * normalizedRadius;

    return {
      circle: {
        radius: normalizedRadius,
        x: (clamp(x, metrics.x, metrics.x + metrics.width) - metrics.x) / metrics.width,
        y: (clamp(y, metrics.y, metrics.y + metrics.height) - metrics.y) / metrics.height
      },
      screenCircle: {
        radius: screenRadius,
        x: clamp(x, metrics.x, metrics.x + metrics.width),
        y: clamp(y, metrics.y, metrics.y + metrics.height)
      },
      startInsideMap: insideMap
    };
  }

  function getNormalizedCircleFromClientPoints(startClient, endClient) {
    const metrics = getDrawMetrics();
    if (!metrics || state.status !== "ready") return null;

    const bounds = canvas.getBoundingClientRect();
    const toStagePoint = (point) => {
      const x = point.clientX - bounds.left;
      const y = point.clientY - bounds.top;
      return {
        insideMap:
          x >= metrics.x && x <= metrics.x + metrics.width && y >= metrics.y && y <= metrics.y + metrics.height,
        rawX: x,
        rawY: y,
        x: clamp(x, metrics.x, metrics.x + metrics.width),
        y: clamp(y, metrics.y, metrics.y + metrics.height)
      };
    };
    const start = toStagePoint(startClient);
    const end = toStagePoint(endClient);
    const maxScreenRadius = Math.min(metrics.width, metrics.height) * 0.5;
    const screenRadius = Math.min(Math.hypot(end.rawX - start.x, end.rawY - start.y), maxScreenRadius);

    if (screenRadius <= 0) return null;

    return {
      circle: {
        radius: screenRadius / Math.min(metrics.width, metrics.height),
        x: (start.x - metrics.x) / metrics.width,
        y: (start.y - metrics.y) / metrics.height
      },
      screenCircle: {
        radius: screenRadius,
        x: start.x,
        y: start.y
      },
      startInsideMap: start.insideMap
    };
  }

  if (interactive) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
  }

  const resizeObserver = resizeObserverFactory(resize);
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener("resize", resize);

  canvas.dataset.zoom = "1";
  resize();
  reportViewport();

  return {
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      state.generation += 1;
      if (state.pendingImage) {
        state.pendingImage.onload = null;
        state.pendingImage.onerror = null;
        state.pendingImage = null;
      }
      if (state.drawFrame !== null) cancelAnimationFrame(state.drawFrame);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      if (interactive) {
        canvas.style.touchAction = originalTouchAction;
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerEnd);
        canvas.removeEventListener("pointercancel", onPointerEnd);
      }
      state.pointers.clear();
      delete canvas.dataset.panning;
      state.image = null;
      markFogMaskDirty();
    },
    getViewport,
    getNormalizedCircleFromClientPoint,
    getNormalizedCircleFromClientPoints,
    getNormalizedRectFromClientPoints,
    panBy,
    resetViewport,
    resize,
    setMap,
    setFogOperations(operations) {
      state.fogOperations = normalizeFogOperations(operations);
      state.fogOperationsSignature = getFogOperationsSignature(state.fogOperations);
      markFogMaskDirty();
      scheduleDraw();
    },
    setZoom(zoom) {
      return updateZoom(zoom);
    },
    zoomIn() {
      return updateZoom(state.zoom + ZOOM_STEP);
    },
    zoomOut() {
      return updateZoom(state.zoom - ZOOM_STEP);
    }
  };
}
