(function () {
  const socket = io();
  const status = document.querySelector("#connection-status");
  const counter = document.querySelector("#counter-value");
  const updatedAt = document.querySelector("#updated-at");
  const incrementButton = document.querySelector("#increment-button");

  function renderState(state) {
    counter.textContent = String(state.counter);
    updatedAt.textContent = `Version ${state.version} updated ${state.updatedAt}`;
  }

  socket.on("connect", () => {
    status.textContent = "Live";
    status.dataset.state = "live";
  });

  socket.on("disconnect", () => {
    status.textContent = "Reconnecting...";
    status.dataset.state = "offline";
  });

  socket.on("state:sync", renderState);

  incrementButton.addEventListener("click", () => {
    socket.emit("gm:increment");
  });
})();
