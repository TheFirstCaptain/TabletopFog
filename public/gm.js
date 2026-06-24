import { createGmApi } from "./gm-api.js";
import { createGmController } from "./gm-controller.js";
import { wireGmEvents } from "./gm-events.js";
import { createGmState } from "./gm-state.js";
import { createGmView } from "./gm-view.js";

const view = createGmView(document);
const controller = createGmController({
  api: createGmApi(fetch),
  socket: io(),
  state: createGmState(),
  view
});

wireGmEvents(view.elements, controller.actions);
controller.start();
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) view.destroy();
});
