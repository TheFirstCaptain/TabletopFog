export function createGmController({ api, socket, state, view }) {
  async function loadCampaigns() {
    try {
      state.setLibrary(await api.listCampaigns());
      view.renderLibrary(state.getLibrary());
    } catch (error) {
      view.setLibraryMessage(error.message);
    }
  }

  async function createCampaign(name) {
    try {
      const payload = await api.createCampaign(name);
      view.clearCampaignName();
      state.setCurrentCampaign(payload.campaign);
      await loadCampaigns();
      view.renderCampaign(state.getCurrentCampaign());
    } catch (error) {
      view.setLibraryMessage(error.message);
    }
  }

  async function openCampaign(campaignId) {
    try {
      const payload = await api.openCampaign(campaignId);
      state.setCurrentCampaign(payload.campaign);
      view.renderCampaign(state.getCurrentCampaign());
    } catch (error) {
      view.setLibraryMessage(error.message);
    }
  }

  async function updateCampaignMetadata(campaignId, metadata) {
    try {
      const payload = await api.updateCampaignMetadata(campaignId, metadata);
      if (state.getCurrentCampaign()?.id === payload.campaign.id) {
        state.setCurrentCampaign(payload.campaign);
        view.renderCampaign(state.getCurrentCampaign());
      }
      await loadCampaigns();
    } catch (error) {
      view.setCampaignCardMessage(campaignId, error.message);
    }
  }

  async function uploadMap(file) {
    const campaign = state.getCurrentCampaign();
    if (!file || !campaign) return;

    try {
      const payload = await api.uploadMap(campaign.id, file);
      view.clearMapFile();
      state.setCurrentCampaign(payload.campaign);
      await loadCampaigns();
      view.renderCampaign(state.getCurrentCampaign());
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function renameMap(mapId, name) {
    try {
      const payload = await api.renameMap(state.getCurrentCampaign().id, mapId, name);
      state.setCurrentCampaign(payload.campaign);
      view.renderCampaign(state.getCurrentCampaign());
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function moveMap(fromIndex, toIndex) {
    try {
      const payload = await api.reorderMaps(
        state.getCurrentCampaign().id,
        state.getReorderedMapIds(fromIndex, toIndex)
      );
      state.setCurrentCampaign(payload.campaign);
      view.renderCampaign(state.getCurrentCampaign());
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function setActiveMap(mapId) {
    try {
      const payload = await api.setActiveMap(state.getCurrentCampaign().id, mapId);
      state.setCurrentCampaign(payload.campaign);
      view.renderCampaign(state.getCurrentCampaign());
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  function backToLibrary() {
    state.closeCampaign();
    view.hideCampaign();
    loadCampaigns();
  }

  return {
    actions: {
      backToLibrary,
      createCampaign,
      moveMap,
      openCampaign,
      renameMap,
      setActiveMap,
      updateCampaignMetadata,
      uploadMap
    },
    start() {
      socket.on("connect", () => view.setStatus("Live", "live"));
      socket.on("disconnect", () => view.setStatus("Reconnecting...", "offline"));
      socket.on("state:sync", (serverState) => {
        if (state.synchronize(serverState)) {
          view.renderCampaign(state.getCurrentCampaign());
        }
      });
      loadCampaigns();
    }
  };
}
