"use strict";

const { normalizeFogOperation, normalizeFogOperations } = require("./campaign-schema");

function createInitialState() {
  return {
    campaign: null,
    version: 0,
    updatedAt: new Date(0).toISOString()
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fogKey(campaignId, mapId) {
  return `${campaignId}:${mapId}`;
}

function createStateStore() {
  let state = createInitialState();
  const fogOperationsByEncounter = new Map();

  function snapshot() {
    return clone(state);
  }

  function getFogOperations(campaignId, mapId) {
    return clone(fogOperationsByEncounter.get(fogKey(campaignId, mapId)) || []);
  }

  function attachFogOperations(campaign) {
    if (!campaign) return null;

    return {
      ...campaign,
      maps: campaign.maps.map((map) => ({
        ...map,
        fogOperations: getFogOperations(campaign.id, map.id)
      }))
    };
  }

  function pruneFogOperations(campaign) {
    if (!campaign) {
      fogOperationsByEncounter.clear();
      return;
    }

    const validMapIds = new Set(campaign.maps.map((map) => map.id));
    const prefix = `${campaign.id}:`;
    for (const key of fogOperationsByEncounter.keys()) {
      if (key.startsWith(prefix) && !validMapIds.has(key.slice(prefix.length))) {
        fogOperationsByEncounter.delete(key);
      }
    }
  }

  function updateCampaign(campaign) {
    pruneFogOperations(campaign);
    state = {
      campaign: attachFogOperations(campaign),
      version: state.version + 1,
      updatedAt: new Date().toISOString()
    };

    return snapshot();
  }

  return {
    getState: snapshot,
    setCampaign(campaign) {
      if (campaign) {
        const nextFogOperations = new Map(fogOperationsByEncounter);
        campaign.maps.forEach((map) => {
          const normalized = normalizeFogOperations(map.fog || []);
          const key = fogKey(campaign.id, map.id);

          if (normalized.length > 0) {
            nextFogOperations.set(key, normalized);
          } else {
            nextFogOperations.delete(key);
          }
        });
        fogOperationsByEncounter.clear();
        nextFogOperations.forEach((operations, key) => {
          fogOperationsByEncounter.set(key, operations);
        });
      }

      return updateCampaign(campaign);
    },
    setFogOperations(campaignId, mapId, operations) {
      if (!state.campaign || state.campaign.id !== campaignId || !state.campaign.maps.some((map) => map.id === mapId)) {
        throw new Error("Invalid fog operation target.");
      }

      const normalized = normalizeFogOperations(operations);
      fogOperationsByEncounter.set(fogKey(campaignId, mapId), normalized);

      return updateCampaign(state.campaign);
    },
    appendFogOperation(campaignId, mapId, operation) {
      if (!state.campaign || state.campaign.id !== campaignId || !state.campaign.maps.some((map) => map.id === mapId)) {
        throw new Error("Invalid fog operation target.");
      }

      const normalized = normalizeFogOperation(operation);
      const key = fogKey(campaignId, mapId);
      fogOperationsByEncounter.set(key, [...getFogOperations(campaignId, mapId), normalized]);

      return updateCampaign(state.campaign);
    },
    clearFogOperations(campaignId, mapId) {
      if (!state.campaign || state.campaign.id !== campaignId || !state.campaign.maps.some((map) => map.id === mapId)) {
        throw new Error("Invalid fog operation target.");
      }

      fogOperationsByEncounter.delete(fogKey(campaignId, mapId));

      return updateCampaign(state.campaign);
    }
  };
}

module.exports = {
  createInitialState,
  createStateStore,
  normalizeFogOperation,
  normalizeFogOperations
};
