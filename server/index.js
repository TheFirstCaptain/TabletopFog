"use strict";

const https = require("node:https");
const path = require("node:path");

const express = require("express");
const { Server } = require("socket.io");

const { createCampaignStorage } = require("./campaign-storage");
const { loadHttpsCredentials } = require("./certs");
const { MAX_MAP_FILE_BYTES } = require("./map-image");
const { createStateStore } = require("./state");

const publicDir = path.resolve(__dirname, "..", "public");

function createApp(options = {}) {
  const app = express();
  const campaignStorage = options.campaignStorage || createCampaignStorage(options);
  const stateStore = options.stateStore || createStateStore();
  const onStateChange = options.onStateChange || (() => {});

  app.use(express.json());

  app.get("/", (_request, response) => {
    response.redirect("/gm");
  });

  app.get("/gm", (_request, response) => {
    response.sendFile(path.join(publicDir, "gm.html"));
  });

  app.get("/player", (_request, response) => {
    response.sendFile(path.join(publicDir, "player.html"));
  });

  app.get("/api/campaigns", requireGm, (_request, response, next) => {
    try {
      const library = campaignStorage.getCampaignLibrary
        ? campaignStorage.getCampaignLibrary()
        : { campaigns: campaignStorage.listCampaigns(), diagnostics: [] };
      response.json({
        ...library,
        dataRoot: campaignStorage.dataRoot
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/campaigns", requireGm, (request, response, next) => {
    try {
      const campaign = withAssetUrls(campaignStorage, campaignStorage.createCampaign(request.body.name));
      const state = stateStore.setCampaign(campaign);
      onStateChange(state);
      response.status(201).json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/campaigns/:campaignId", requireGm, (request, response, next) => {
    try {
      const campaign = withAssetUrls(campaignStorage, campaignStorage.getCampaign(request.params.campaignId));
      const state = stateStore.setCampaign(campaign);
      onStateChange(state);
      response.json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/campaigns/:campaignId/metadata", requireGm, (request, response, next) => {
    try {
      if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
        response.status(400).json({ error: "Campaign metadata must be a JSON object." });
        return;
      }

      const campaign = withAssetUrls(
        campaignStorage,
        campaignStorage.updateCampaignMetadata(request.params.campaignId, request.body)
      );
      response.json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/campaigns/:campaignId/maps",
    requireGm,
    express.raw({ limit: MAX_MAP_FILE_BYTES, type: "*/*" }),
    (request, response, next) => {
      try {
        const map = campaignStorage.addMap(request.params.campaignId, {
          content: request.body,
          contentType: request.get("content-type"),
          originalFileName: request.get("x-file-name")
        });
        const campaign = withAssetUrls(campaignStorage, campaignStorage.getCampaign(request.params.campaignId));
        const state = stateStore.setCampaign(campaign);
        onStateChange(state);
        response.status(201).json({
          campaign,
          map: campaign.maps.find((candidate) => candidate.id === map.id)
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.patch("/api/campaigns/:campaignId/maps/:mapId", requireGm, (request, response, next) => {
    try {
      const map = campaignStorage.renameMap(request.params.campaignId, request.params.mapId, request.body.name);
      const campaign = withAssetUrls(campaignStorage, campaignStorage.getCampaign(request.params.campaignId));
      const state = stateStore.setCampaign(campaign);
      onStateChange(state);
      response.json({
        campaign,
        map: campaign.maps.find((candidate) => candidate.id === map.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/campaigns/:campaignId/maps/:mapId", requireGm, (request, response, next) => {
    try {
      const campaign = withAssetUrls(
        campaignStorage,
        campaignStorage.deleteMap(request.params.campaignId, request.params.mapId)
      );
      const state = stateStore.setCampaign(campaign);
      onStateChange(state);
      response.json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/campaigns/:campaignId/maps/reorder", requireGm, (request, response, next) => {
    try {
      const campaign = withAssetUrls(
        campaignStorage,
        campaignStorage.reorderMaps(request.params.campaignId, request.body.mapIds)
      );
      const state = stateStore.setCampaign(campaign);
      onStateChange(state);
      response.json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/campaigns/:campaignId/active-map", requireGm, (request, response, next) => {
    try {
      if (!Object.hasOwn(request.body || {}, "mapId")) {
        response.status(400).json({ error: "Active map request must include mapId." });
        return;
      }

      if (request.body.mapId !== null && typeof request.body.mapId !== "string") {
        response.status(400).json({ error: "Active map id must be a string or null." });
        return;
      }

      const campaign = withAssetUrls(
        campaignStorage,
        campaignStorage.setActiveMap(request.params.campaignId, request.body.mapId)
      );
      const state = stateStore.setCampaign(campaign);
      onStateChange(state);
      response.json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/player/active-map/asset", (_request, response, next) => {
    try {
      const state = stateStore.getState();
      const campaign = state.campaign;
      const activeMap = campaign ? campaign.maps.find((map) => map.id === campaign.activeMapId) : null;

      if (!campaign || !activeMap) {
        response.status(404).json({ error: "No active map." });
        return;
      }

      const { filePath } = campaignStorage.getMapAsset(campaign.id, activeMap.id);
      response.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/campaigns/:campaignId/maps/:mapId/asset", requireGm, (request, response, next) => {
    try {
      const { filePath } = campaignStorage.getMapAsset(request.params.campaignId, request.params.mapId);
      response.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(publicDir));

  app.use((error, _request, response, _next) => {
    response.status(error.statusCode || 500).json({
      error: error.message || "Unexpected server error."
    });
  });

  return app;
}

function createTabletopFogServer(options = {}) {
  const stateStore = options.stateStore || createStateStore();
  let io;
  const app = createApp({
    ...options,
    stateStore,
    onStateChange(state) {
      if (io) {
        emitState(io, state);
      }
    }
  });
  const credentials = options.credentials || loadHttpsCredentials(options.env);
  const server = https.createServer(credentials, app);
  io = new Server(server);

  io.on("connection", (socket) => {
    const role = getRoleFromReferer(socket.handshake.headers.referer);
    socket.data.role = role;

    socket.emit("state:sync", projectStateForRole(stateStore.getState(), socket.data.role));
  });

  return {
    app,
    io,
    server,
    stateStore
  };
}

function emitState(io, state) {
  io.sockets.sockets.forEach((socket) => {
    socket.emit("state:sync", projectStateForRole(state, socket.data.role));
  });
}

function projectStateForRole(state, role) {
  if (role === "gm") {
    return state;
  }

  const campaign = state.campaign;
  const activeMap = campaign ? campaign.maps.find((map) => map.id === campaign.activeMapId) : null;

  return {
    activeMap: activeMap
      ? {
          campaignId: campaign.id,
          id: activeMap.id,
          name: activeMap.name,
          assetUrl: "/api/player/active-map/asset",
          version: `${campaign.id}/${activeMap.id}`
        }
      : null,
    updatedAt: state.updatedAt,
    version: state.version
  };
}

function requireGm(request, response, next) {
  if (getRoleFromReferer(request.get("referer")) !== "gm") {
    response.status(403).json({ error: "GM view required." });
    return;
  }

  next();
}

function withAssetUrls(campaignStorage, campaign) {
  return campaignStorage.addAssetUrls(campaign);
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
  projectStateForRole,
  start
};
