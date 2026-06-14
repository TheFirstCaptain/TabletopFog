"use strict";

const https = require("node:https");
const path = require("node:path");

const express = require("express");
const { Server } = require("socket.io");

const { loadHttpsCredentials } = require("./certs");
const { createStateStore } = require("./state");

const publicDir = path.resolve(__dirname, "..", "public");

function createApp() {
  const app = express();

  app.get("/", (_request, response) => {
    response.redirect("/gm");
  });

  app.get("/gm", (_request, response) => {
    response.sendFile(path.join(publicDir, "gm.html"));
  });

  app.get("/player", (_request, response) => {
    response.sendFile(path.join(publicDir, "player.html"));
  });

  app.use(express.static(publicDir));

  return app;
}

function createTabletopFogServer(options = {}) {
  const app = createApp();
  const stateStore = options.stateStore || createStateStore();
  const credentials = options.credentials || loadHttpsCredentials(options.env);
  const server = https.createServer(credentials, app);
  const io = new Server(server);

  io.on("connection", (socket) => {
    const role = getRoleFromReferer(socket.handshake.headers.referer);
    socket.data.role = role;

    socket.emit("state:sync", stateStore.getState());

    socket.on("gm:increment", () => {
      if (socket.data.role !== "gm") {
        return;
      }

      io.emit("state:sync", stateStore.increment());
    });

  });

  return {
    app,
    io,
    server,
    stateStore
  };
}

function getRoleFromReferer(referer) {
  if (!referer) {
    return "player";
  }

  try {
    const url = new URL(referer);
    return url.pathname === "/gm" ? "gm" : "player";
  } catch (_error) {
    return "player";
  }
}

function start() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  const { server } = createTabletopFogServer();

  server.listen(port, host, () => {
    console.log(`TabletopFog listening at https://${host}:${port}`);
    console.log(`GM view: https://localhost:${port}/gm`);
    console.log(`Player view: https://<LAN-IP>:${port}/player`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  createApp,
  createTabletopFogServer,
  getRoleFromReferer,
  start
};
