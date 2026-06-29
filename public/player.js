import { createMapCanvasRenderer } from "./map-canvas.js";

const socket = io();
const status = document.querySelector("#connection-status");
const message = document.querySelector("#player-message");
const canvas = document.querySelector("#player-map");
const zoomOut = document.querySelector("#zoom-out");
const fitMap = document.querySelector("#fit-map");
const zoomLevel = document.querySelector("#zoom-level");
const zoomIn = document.querySelector("#zoom-in");
let rendererReady = false;

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
}

let renderer;
renderer = createMapCanvasRenderer({
  canvas,
  interactive: true,
  onStatus({ map, state }) {
    rendererReady = state === "ready";
    message.dataset.state = state;
    message.setAttribute("role", state === "error" ? "alert" : "status");

    if (state === "empty") message.textContent = "Waiting for GM.";
    if (state === "loading") message.textContent = "Loading map...";
    if (state === "ready") message.textContent = map.name;
    if (state === "error") message.textContent = "Map image could not be loaded.";

    setControls(renderer ? renderer.getViewport() : undefined);
  },
  onViewportChange(viewport) {
    setControls(viewport);
  }
});

zoomOut.addEventListener("click", () => renderer.zoomOut());
fitMap.addEventListener("click", () => renderer.resetViewport());
zoomIn.addEventListener("click", () => renderer.zoomIn());
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
  renderer.setMap(
    state.activeMap
      ? {
          ...state.activeMap
        }
      : null
  );
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) renderer.destroy();
});
