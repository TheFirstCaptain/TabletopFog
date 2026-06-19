(function () {
  const socket = io();
  const status = document.querySelector("#connection-status");
  const message = document.querySelector("#player-message");
  const mapImage = document.querySelector("#player-map");

  function setStatus(text, state) {
    status.textContent = text;
    status.dataset.state = state;
  }

  function renderState(state) {
    const activeMap = state.activeMap;

    if (!activeMap) {
      message.textContent = "Waiting for GM.";
      mapImage.hidden = true;
      mapImage.removeAttribute("src");
      mapImage.alt = "";
      return;
    }

    message.textContent = activeMap.name;
    mapImage.src = activeMap.assetUrl;
    mapImage.alt = activeMap.name;
    mapImage.hidden = false;
  }

  mapImage.addEventListener("error", () => {
    message.textContent = "Map image could not be loaded.";
    mapImage.hidden = true;
  });

  socket.on("connect", () => {
    setStatus("Live", "live");
  });

  socket.on("disconnect", () => {
    setStatus("Reconnecting...", "offline");
  });

  socket.on("state:sync", renderState);
})();
