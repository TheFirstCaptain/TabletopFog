"use strict";

function createCampaignSessionService({ campaignStorage, onStateChange, stateStore }) {
  function withAssetUrls(campaign) {
    return campaignStorage.addAssetUrls(campaign);
  }

  function getCampaignLibrary() {
    const library = campaignStorage.getCampaignLibrary
      ? campaignStorage.getCampaignLibrary()
      : { campaigns: campaignStorage.listCampaigns(), diagnostics: [] };

    return {
      ...library,
      dataRoot: campaignStorage.dataRoot
    };
  }

  function setCampaign(campaign, options = {}) {
    const state = stateStore.setCampaign(withAssetUrls(campaign), options);
    onStateChange(state);
    return state.campaign;
  }

  function preserveUndoCampaign(campaign) {
    return setCampaign(campaign, { preserveFogUndo: true });
  }

  function getCurrentMapState(campaignId, mapId) {
    const campaign = stateStore.getState().campaign;

    if (!campaign || campaign.id !== campaignId) {
      throw new Error("Invalid fog operation target.");
    }

    const map = campaign.maps.find((candidate) => candidate.id === mapId);

    if (!map) {
      throw new Error("Invalid fog operation target.");
    }

    return map;
  }

  return {
    addHandout(campaignId, handoutInput) {
      const handout = campaignStorage.addHandout(campaignId, handoutInput);
      const campaign = preserveUndoCampaign(campaignStorage.getCampaign(campaignId));

      return {
        campaign,
        handout: campaign.handouts.find((candidate) => candidate.id === handout.id)
      };
    },
    addMap(campaignId, mapInput) {
      const map = campaignStorage.addMap(campaignId, mapInput);
      const campaign = preserveUndoCampaign(campaignStorage.getCampaign(campaignId));

      return {
        campaign,
        map: campaign.maps.find((candidate) => candidate.id === map.id)
      };
    },
    appendFogOperation(campaignId, mapId, operation) {
      const target = getCurrentMapState(campaignId, mapId);
      const campaign = campaignStorage.setMapFog(campaignId, mapId, [...(target.fogOperations || []), operation]);

      stateStore.appendFogOperation(campaignId, mapId, operation);
      return preserveUndoCampaign(campaign);
    },
    appendFogOperations(campaignId, mapId, operations) {
      const target = getCurrentMapState(campaignId, mapId);
      const campaign = campaignStorage.setMapFog(campaignId, mapId, [...(target.fogOperations || []), ...operations]);

      stateStore.appendFogOperations(campaignId, mapId, operations);
      return preserveUndoCampaign(campaign);
    },
    clearFogOperations(campaignId, mapId) {
      getCurrentMapState(campaignId, mapId);
      const campaign = campaignStorage.setMapFog(campaignId, mapId, []);

      stateStore.clearFogOperations(campaignId, mapId);
      return preserveUndoCampaign(campaign);
    },
    createCampaign(name) {
      return setCampaign(campaignStorage.createCampaign(name));
    },
    deleteCampaign(campaignId) {
      campaignStorage.deleteCampaign(campaignId);

      if (stateStore.getState().campaign?.id === campaignId) {
        const state = stateStore.setCampaign(null);
        onStateChange(state);
      }

      return getCampaignLibrary();
    },
    deleteHandout(campaignId, handoutId) {
      return preserveUndoCampaign(campaignStorage.deleteHandout(campaignId, handoutId));
    },
    deleteMap(campaignId, mapId) {
      return preserveUndoCampaign(campaignStorage.deleteMap(campaignId, mapId));
    },
    getCampaign(campaignId) {
      return setCampaign(campaignStorage.getCampaign(campaignId));
    },
    getCampaignLibrary,
    updateCampaignMetadata(campaignId, metadata) {
      const campaign = campaignStorage.updateCampaignMetadata(campaignId, metadata);

      if (stateStore.getState().campaign?.id === campaignId) {
        return preserveUndoCampaign(campaign);
      }

      return withAssetUrls(campaign);
    },
    renameHandout(campaignId, handoutId, name) {
      const handout = campaignStorage.renameHandout(campaignId, handoutId, name);
      const campaign = preserveUndoCampaign(campaignStorage.getCampaign(campaignId));

      return {
        campaign,
        handout: campaign.handouts.find((candidate) => candidate.id === handout.id)
      };
    },
    renameMap(campaignId, mapId, name) {
      const map = campaignStorage.renameMap(campaignId, mapId, name);
      const campaign = preserveUndoCampaign(campaignStorage.getCampaign(campaignId));

      return {
        campaign,
        map: campaign.maps.find((candidate) => candidate.id === map.id)
      };
    },
    reorderMaps(campaignId, mapIds) {
      return preserveUndoCampaign(campaignStorage.reorderMaps(campaignId, mapIds));
    },
    rotateShownHandout(campaignId, direction) {
      return preserveUndoCampaign(campaignStorage.rotateShownHandout(campaignId, direction));
    },
    setLegacyActiveMap(campaignId, mapId) {
      const target = mapId === null ? null : { id: mapId, type: "encounter" };
      return preserveUndoCampaign(campaignStorage.setShownTarget(campaignId, target));
    },
    setShownTarget(campaignId, target) {
      return preserveUndoCampaign(campaignStorage.setShownTarget(campaignId, target));
    },
    undoFogOperation(campaignId, mapId) {
      const previousOperations = stateStore.getNextFogUndoOperations(campaignId, mapId);
      const campaign = campaignStorage.setMapFog(campaignId, mapId, previousOperations);

      stateStore.consumeFogUndo(campaignId, mapId);
      return preserveUndoCampaign(campaign);
    }
  };
}

module.exports = {
  createCampaignSessionService
};
