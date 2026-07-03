"use strict";

const https = require("node:https");
const path = require("node:path");

const express = require("express");
const { Server } = require("socket.io");

const { createCampaignStorage } = require("./campaign-storage");
const { loadHttpsCredentials } = require("./certs");
const { registerHttpRoutes } = require("./http-routes");
const { getRoleFromReferer, projectStateForRole } = require("./role-projection");
const { createSocketSync } = require("./socket-sync");
const { createStateStore } = require("./state");

const publicDir = path.resolve(__dirname, "..", "public");

function createApp(options = {}) {
  const app = express();
  const campaignStorage = options.campaignStorage || createCampaignStorage(options);
  const stateStore = options.stateStore || createStateStore();
  const onStateChange = options.onStateChange || (() => {});

  registerHttpRoutes({
    app,
    campaignStorage,
    onStateChange,
    publicDir,
    stateStore
  });

  return app;
}

function createTabletopFogServer(options = {}) {
  const stateStore = options.stateStore || createStateStore();
  let socketSync;
  const app = createApp({
    ...options,
    stateStore,
    onStateChange(state) {
      if (socketSync) {
        socketSync.syncState(state);
      }
    }
  });
  const credentials = options.credentials || loadHttpsCredentials(options.env);
  const server = https.createServer(credentials, app);
  const io = new Server(server);
  socketSync = createSocketSync(io, stateStore);

  return {
    app,
    io,
    server,
    syncState() {
      socketSync.syncState();
    },
    stateStore
  };
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
  projectStateForRole,
  start
};
