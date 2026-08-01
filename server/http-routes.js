"use strict";

const path = require("node:path");

const express = require("express");

const { FOG_OPERATION_TYPES, normalizeFogOperation } = require("./campaign-schema");
const { createCampaignSessionService } = require("./campaign-session-service");
const { MAX_MAP_FILE_BYTES } = require("./map-image");
const { requireGm } = require("./role-projection");

function registerHttpRoutes({ app, campaignStorage, stateStore, onStateChange, publicDir }) {
  const campaignSession = createCampaignSessionService({ campaignStorage, onStateChange, stateStore });

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
      response.json(campaignSession.getCampaignLibrary());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/campaigns", requireGm, (request, response, next) => {
    try {
      response.status(201).json({ campaign: campaignSession.createCampaign(request.body.name) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/campaigns/:campaignId", requireGm, (request, response, next) => {
    try {
      response.json({ campaign: campaignSession.getCampaign(request.params.campaignId) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/campaigns/:campaignId", requireGm, (request, response, next) => {
    try {
      response.json(campaignSession.deleteCampaign(request.params.campaignId));
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

      const campaign = campaignSession.updateCampaignMetadata(request.params.campaignId, request.body);
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
        const result = campaignSession.addMap(request.params.campaignId, {
          content: request.body,
          contentType: request.get("content-type"),
          originalFileName: request.get("x-file-name")
        });
        response.status(201).json({
          campaign: result.campaign,
          map: result.map
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    "/api/campaigns/:campaignId/handouts",
    requireGm,
    express.raw({ limit: MAX_MAP_FILE_BYTES, type: "*/*" }),
    (request, response, next) => {
      try {
        const result = campaignSession.addHandout(request.params.campaignId, {
          content: request.body,
          contentType: request.get("content-type"),
          originalFileName: request.get("x-file-name")
        });
        response.status(201).json({
          campaign: result.campaign,
          handout: result.handout
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.patch("/api/campaigns/:campaignId/maps/:mapId", requireGm, (request, response, next) => {
    try {
      const result = campaignSession.renameMap(request.params.campaignId, request.params.mapId, request.body.name);
      response.json({
        campaign: result.campaign,
        map: result.map
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/campaigns/:campaignId/handouts/:handoutId", requireGm, (request, response, next) => {
    try {
      const result = campaignSession.renameHandout(
        request.params.campaignId,
        request.params.handoutId,
        request.body.name
      );
      response.json({
        campaign: result.campaign,
        handout: result.handout
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/campaigns/:campaignId/maps/:mapId", requireGm, (request, response, next) => {
    try {
      response.json({ campaign: campaignSession.deleteMap(request.params.campaignId, request.params.mapId) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/campaigns/:campaignId/handouts/:handoutId", requireGm, (request, response, next) => {
    try {
      response.json({
        campaign: campaignSession.deleteHandout(request.params.campaignId, request.params.handoutId)
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/campaigns/:campaignId/maps/reorder", requireGm, (request, response, next) => {
    try {
      response.json({ campaign: campaignSession.reorderMaps(request.params.campaignId, request.body.mapIds) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/campaigns/:campaignId/shown-target", requireGm, (request, response, next) => {
    try {
      if (!Object.hasOwn(request.body || {}, "target")) {
        response.status(400).json({ error: "Shown target request must include target." });
        return;
      }

      const target = request.body.target;
      if (target !== null && (!target || typeof target !== "object" || Array.isArray(target))) {
        response.status(400).json({ error: "Shown target must be an object or null." });
        return;
      }

      if (target !== null && (typeof target.id !== "string" || !["encounter", "handout"].includes(target.type))) {
        response.status(400).json({ error: "Shown target must include type and id." });
        return;
      }

      response.json({ campaign: campaignSession.setShownTarget(request.params.campaignId, target) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/campaigns/:campaignId/shown-target/rotation", requireGm, (request, response, next) => {
    try {
      const direction = request.body?.direction;
      response.json({ campaign: campaignSession.rotateShownHandout(request.params.campaignId, direction) });
    } catch (error) {
      if (/shown handout/.test(error.message)) {
        response.status(409).json({ error: error.message });
        return;
      }
      if (/left or right/.test(error.message)) {
        response.status(400).json({ error: error.message });
        return;
      }
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

      response.json({ campaign: campaignSession.setLegacyActiveMap(request.params.campaignId, request.body.mapId) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/campaigns/:campaignId/maps/:mapId/fog-operations", requireGm, (request, response, next) => {
    try {
      if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
        response.status(400).json({ error: "Fog operation must be a JSON object." });
        return;
      }

      if (!FOG_OPERATION_TYPES.has(request.body.type)) {
        response.status(400).json({ error: "Only hide and reveal fog shapes can be added by this tool." });
        return;
      }

      const operation = normalizeFogOperation(request.body);
      const campaign = campaignSession.appendFogOperation(request.params.campaignId, request.params.mapId, operation);
      response.status(201).json({ campaign });
    } catch (error) {
      if (/Invalid fog operation|Map not found/.test(error.message)) {
        response.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  app.post("/api/campaigns/:campaignId/maps/:mapId/fog-operations/batch", requireGm, (request, response, next) => {
    try {
      if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
        response.status(400).json({ error: "Fog operation batch must be a JSON object." });
        return;
      }

      if (!Array.isArray(request.body.operations) || request.body.operations.length === 0) {
        response.status(400).json({ error: "At least one fog operation is required." });
        return;
      }

      const operations = request.body.operations.map((operation) => {
        if (!FOG_OPERATION_TYPES.has(operation?.type)) {
          throw new Error("Only hide and reveal fog shapes can be added by this tool.");
        }
        return normalizeFogOperation(operation);
      });
      const campaign = campaignSession.appendFogOperations(request.params.campaignId, request.params.mapId, operations);
      response.status(201).json({ campaign });
    } catch (error) {
      if (/Invalid fog operation|Map not found|At least one fog operation|Only hide and reveal/.test(error.message)) {
        response.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  app.delete("/api/campaigns/:campaignId/maps/:mapId/fog-operations", requireGm, (request, response, next) => {
    try {
      response.json({ campaign: campaignSession.clearFogOperations(request.params.campaignId, request.params.mapId) });
    } catch (error) {
      if (/Invalid fog operation target|Map not found/.test(error.message)) {
        response.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  app.post("/api/campaigns/:campaignId/maps/:mapId/fog-operations/undo", requireGm, (request, response, next) => {
    try {
      response.json({ campaign: campaignSession.undoFogOperation(request.params.campaignId, request.params.mapId) });
    } catch (error) {
      if (/No fog action to undo/.test(error.message)) {
        response.status(409).json({ error: "No fog action to undo." });
        return;
      }
      if (/Invalid fog operation target|Map not found/.test(error.message)) {
        response.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  app.get("/api/player/shown-target/asset", (_request, response, next) => {
    try {
      const state = stateStore.getState();
      const campaign = state.campaign;
      const shownTarget = campaign?.shownTarget || null;

      if (!campaign || !shownTarget) {
        response.status(404).json({ error: "No shown target." });
        return;
      }

      const { filePath } =
        shownTarget.type === "encounter"
          ? campaignStorage.getMapAsset(campaign.id, shownTarget.id)
          : campaignStorage.getHandoutAsset(campaign.id, shownTarget.id);
      response.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/player/active-map/asset", (_request, response, next) => {
    try {
      const state = stateStore.getState();
      const campaign = state.campaign;
      const shownTarget = campaign?.shownTarget || null;

      if (!campaign || shownTarget?.type !== "encounter") {
        response.status(404).json({ error: "No active map." });
        return;
      }

      const { filePath } = campaignStorage.getMapAsset(campaign.id, shownTarget.id);
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

  app.get("/api/campaigns/:campaignId/handouts/:handoutId/asset", requireGm, (request, response, next) => {
    try {
      const { filePath } = campaignStorage.getHandoutAsset(request.params.campaignId, request.params.handoutId);
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
}

module.exports = {
  registerHttpRoutes
};
