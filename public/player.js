import { createMapCanvasRenderer } from "./map-canvas.js";
import { createPlayerHandoutRotation } from "./player-handout-rotation.js";

const socket = io();
const status = document.querySelector("#connection-status");
const message = document.querySelector("#player-message");
const canvas = document.querySelector("#player-map");
const zoomOut = document.querySelector("#zoom-out");
const fitMap = document.querySelector("#fit-map");
const zoomLevel = document.querySelector("#zoom-level");
const zoomIn = document.querySelector("#zoom-in");
const viewportControls = document.querySelector("#viewport-controls");
const rotateHandoutLeft = document.querySelector("#rotate-handout-left");
const rotateHandoutRight = document.querySelector("#rotate-handout-right");
const display = document.querySelector(".player-display");
const fullscreenToggle = document.querySelector("#fullscreen-toggle");
const fullscreenMessage = document.querySelector("#fullscreen-message");
const mapStage = document.querySelector(".map-stage");
const waitingImage = document.querySelector("#waiting-image");
let rendererReady = false;
let currentCampaignName = "";
let waitingImageGeneration = 0;

function setConnectionStatus(text, state) {
  status.textContent = text;
  status.dataset.state = state;
}

function setControls(viewport = { panX: 0, panY: 0, zoom: 1 }) {
  zoomLevel.value = `${Math.round(viewport.zoom * 100)}%`;
  zoomLevel.textContent = zoomLevel.value;
  zoomOut.disabled = !rendererReady || viewport.zoom <= 0.5;
  zoomIn.disabled = !rendererReady || viewport.zoom >= 3;
  fitMap.disabled = !rendererReady || (viewport.zoom === 1 && viewport.panX === 0 && viewport.panY === 0);

  const localRotationAvailable = rendererReady && handoutRotation.isHandoutShown();
  viewportControls.dataset.handoutControls = String(localRotationAvailable);
  rotateHandoutLeft.hidden = !localRotationAvailable;
  rotateHandoutRight.hidden = !localRotationAvailable;
  rotateHandoutLeft.disabled = !localRotationAvailable;
  rotateHandoutRight.disabled = !localRotationAvailable;
}

function isDisplayFullscreen() {
  return document.fullscreenElement === display;
}

function setFullscreenMessage(text) {
  fullscreenMessage.textContent = text;
}

function updateFullscreenControl() {
  const fullscreen = isDisplayFullscreen();
  fullscreenToggle.textContent = fullscreen ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenToggle.setAttribute("aria-pressed", fullscreen ? "true" : "false");
}

function getWaitingMessage() {
  return currentCampaignName ? `Waiting for GM - ${currentCampaignName}` : "Waiting for GM.";
}

function withCacheKey(assetUrl, version) {
  const separator = assetUrl.includes("?") ? "&" : "?";
  return `${assetUrl}${separator}version=${encodeURIComponent(version || "current")}`;
}

function clearWaitingImage() {
  waitingImageGeneration += 1;
  waitingImage.onload = null;
  waitingImage.onerror = null;
  waitingImage.removeAttribute("src");
  waitingImage.hidden = true;
  mapStage.dataset.waitingImage = "false";
}

function setWaitingImage(image) {
  if (!image?.assetUrl) {
    clearWaitingImage();
    return;
  }

  const generation = ++waitingImageGeneration;
  waitingImage.onload = () => {
    if (generation !== waitingImageGeneration) return;
    waitingImage.hidden = false;
    mapStage.dataset.waitingImage = "true";
  };
  waitingImage.onerror = () => {
    if (generation !== waitingImageGeneration) return;
    waitingImage.hidden = true;
    mapStage.dataset.waitingImage = "false";
  };
  waitingImage.hidden = true;
  mapStage.dataset.waitingImage = "loading";
  waitingImage.src = withCacheKey(image.assetUrl, image.version);
}

async function toggleFullscreen() {
  setFullscreenMessage("");

  try {
    if (isDisplayFullscreen()) {
      if (!document.exitFullscreen) throw new Error("Fullscreen exit unavailable.");
      await document.exitFullscreen();
    } else {
      if (!display.requestFullscreen) throw new Error("Fullscreen unavailable.");
      await display.requestFullscreen();
    }
  } catch (_error) {
    setFullscreenMessage("Fullscreen is unavailable in this browser.");
  }

  updateFullscreenControl();
}

let renderer;
const handoutRotation = createPlayerHandoutRotation({
  render(target) {
    renderer.setMap(target);
  }
});

renderer = createMapCanvasRenderer({
  canvas,
  fogOpacity: 0.92,
  interactive: true,
  onStatus({ map, state }) {
    rendererReady = state === "ready";
    message.dataset.state = state;
    message.setAttribute("role", state === "error" ? "alert" : "status");

    if (state === "empty") message.textContent = getWaitingMessage();
    if (state === "loading") message.textContent = "Loading image...";
    if (state === "ready") message.textContent = map.name;
    if (state === "error") message.textContent = "Image could not be loaded.";

    setControls(renderer ? renderer.getViewport() : undefined);
  },
  onViewportChange(viewport) {
    setControls(viewport);
  }
});

zoomOut.addEventListener("click", () => renderer.zoomOut());
fitMap.addEventListener("click", () => renderer.resetViewport());
zoomIn.addEventListener("click", () => renderer.zoomIn());
rotateHandoutLeft.addEventListener("click", () => handoutRotation.rotate("left"));
rotateHandoutRight.addEventListener("click", () => handoutRotation.rotate("right"));
fullscreenToggle.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenControl);
document.addEventListener("fullscreenerror", () => setFullscreenMessage("Fullscreen is unavailable in this browser."));
canvas.addEventListener("keydown", (event) => {
  const pan = {
    ArrowDown: [0, -50],
    ArrowLeft: [50, 0],
    ArrowRight: [-50, 0],
    ArrowUp: [0, 50]
  }[event.key];
  if (!pan) return;
  event.preventDefault();
  renderer.panBy(...pan);
});

socket.on("connect", () => {
  setConnectionStatus("Live", "live");
});

socket.on("disconnect", () => {
  setConnectionStatus("Reconnecting...", "offline");
});

socket.on("state:sync", (state) => {
  currentCampaignName = typeof state.campaign?.name === "string" ? state.campaign.name : "";
  if (state.shownTarget) {
    clearWaitingImage();
  } else {
    setWaitingImage(state.campaign?.waitingImage);
  }
  handoutRotation.setTarget(state.shownTarget);
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) renderer.destroy();
});
