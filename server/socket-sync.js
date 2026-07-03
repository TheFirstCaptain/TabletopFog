"use strict";

const { projectStateForRole, getRoleFromReferer } = require("./role-projection");

function createSocketSync(io, stateStore) {
  io.on("connection", (socket) => {
    const role = getRoleFromReferer(socket.handshake.headers.referer);
    socket.data.role = role;

    socket.emit("state:sync", projectStateForRole(stateStore.getState(), socket.data.role));
  });

  return {
    syncState(state = stateStore.getState()) {
      emitState(io, state);
    }
  };
}

function emitState(io, state) {
  io.sockets.sockets.forEach((socket) => {
    socket.emit("state:sync", projectStateForRole(state, socket.data.role));
  });
}

module.exports = {
  createSocketSync,
  emitState
};
