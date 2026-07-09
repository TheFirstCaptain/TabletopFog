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
  const fogUndoHistoryByEncounter = new Map();

  function snapshot() {
    return clone(state);
  }

  function getFogOperations(campaignId, mapId) {
    return clone(fogOperationsByEncounter.get(fogKey(campaignId, mapId)) || []);
  }

  function canUndoFogOperation(campaignId, mapId) {
    return (fogUndoHistoryByEncounter.get(fogKey(campaignId, mapId)) || []).length > 0;
  }

  function attachFogOperations(campaign) {
    if (!campaign) return null;

    return {
      ...campaign,
      maps: campaign.maps.map((map) => ({
        ...map,
        fogOperations: getFogOperations(campaign.id, map.id),
        canUndoFogOperation: canUndoFogOperation(campaign.id, map.id)
      }))
    };
  }

  function validateFogTarget(campaignId, mapId) {
    if (!state.campaign || state.campaign.id !== campaignId || !state.campaign.maps.some((map) => map.id === mapId)) {
      throw new Error("Invalid fog operation target.");
    }
  }

  function pruneFogOperations(campaign) {
    if (!campaign) {
      fogOperationsByEncounter.clear();
      fogUndoHistoryByEncounter.clear();
      return;
    }

    const validMapIds = new Set(campaign.maps.map((map) => map.id));
    const prefix = `${campaign.id}:`;
    for (const key of fogOperationsByEncounter.keys()) {
      if (key.startsWith(prefix) && !validMapIds.has(key.slice(prefix.length))) {
        fogOperationsByEncounter.delete(key);
      }
    }
    for (const key of fogUndoHistoryByEncounter.keys()) {
      if (key.startsWith(prefix) && !validMapIds.has(key.slice(prefix.length))) {
        fogUndoHistoryByEncounter.delete(key);
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
    canUndoFogOperation,
    consumeFogUndo(campaignId, mapId) {
      validateFogTarget(campaignId, mapId);

      const key = fogKey(campaignId, mapId);
      const history = fogUndoHistoryByEncounter.get(key) || [];
      if (history.length === 0) {
        throw new Error("No fog action to undo.");
      }

      const [previousOperations] = history.splice(history.length - 1, 1);
      if (history.length === 0) {
        fogUndoHistoryByEncounter.delete(key);
      } else {
        fogUndoHistoryByEncounter.set(key, history);
      }
      return clone(previousOperations);
    },
    getState: snapshot,
    getNextFogUndoOperations(campaignId, mapId) {
      validateFogTarget(campaignId, mapId);

      const history = fogUndoHistoryByEncounter.get(fogKey(campaignId, mapId)) || [];
      if (history.length === 0) {
        throw new Error("No fog action to undo.");
      }

      return clone(history[history.length - 1]);
    },
    setCampaign(campaign, options = {}) {
      if (!options.preserveFogUndo) {
        fogUndoHistoryByEncounter.clear();
      }

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
      validateFogTarget(campaignId, mapId);

      const normalized = normalizeFogOperations(operations);
      fogOperationsByEncounter.set(fogKey(campaignId, mapId), normalized);

      return updateCampaign(state.campaign);
    },
    appendFogOperation(campaignId, mapId, operation) {
      validateFogTarget(campaignId, mapId);

      const normalized = normalizeFogOperation(operation);
      const key = fogKey(campaignId, mapId);
      const previousOperations = getFogOperations(campaignId, mapId);
      fogUndoHistoryByEncounter.set(key, [...(fogUndoHistoryByEncounter.get(key) || []), previousOperations]);
      fogOperationsByEncounter.set(key, [...previousOperations, normalized]);

      return updateCampaign(state.campaign);
    },
    appendFogOperations(campaignId, mapId, operations) {
      validateFogTarget(campaignId, mapId);
      if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error("At least one fog operation is required.");
      }

      const normalized = operations.map(normalizeFogOperation);
      const key = fogKey(campaignId, mapId);
      const previousOperations = getFogOperations(campaignId, mapId);
      fogUndoHistoryByEncounter.set(key, [...(fogUndoHistoryByEncounter.get(key) || []), previousOperations]);
      fogOperationsByEncounter.set(key, [...previousOperations, ...normalized]);

      return updateCampaign(state.campaign);
    },
    clearFogOperations(campaignId, mapId) {
      validateFogTarget(campaignId, mapId);

      const key = fogKey(campaignId, mapId);
      const previousOperations = getFogOperations(campaignId, mapId);
      if (previousOperations.length > 0) {
        fogUndoHistoryByEncounter.set(key, [...(fogUndoHistoryByEncounter.get(key) || []), previousOperations]);
      }
      fogOperationsByEncounter.delete(key);

      return updateCampaign(state.campaign);
    },
    undoFogOperation(campaignId, mapId) {
      const operations = this.consumeFogUndo(campaignId, mapId);
      fogOperationsByEncounter.set(fogKey(campaignId, mapId), operations);

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
