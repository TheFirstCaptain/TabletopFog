export function createGmController({ api, socket, state, view }) {
  function renderCurrentCampaign() {
    view.renderCampaign(
      state.getCurrentCampaign(),
      state.getSelectedEncounterId(),
      state.isWorkspaceOpen(),
      state.isManageMode()
    );
  }

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
      renderCurrentCampaign();
    } catch (error) {
      view.setLibraryMessage(error.message);
    }
  }

  async function openCampaign(campaignId) {
    try {
      const payload = await api.openCampaign(campaignId);
      state.setCurrentCampaign(payload.campaign);
      renderCurrentCampaign();
    } catch (error) {
      view.setLibraryMessage(error.message);
    }
  }

  async function updateCampaignMetadata(campaignId, metadata) {
    try {
      const payload = await api.updateCampaignMetadata(campaignId, metadata);
      if (state.getCurrentCampaign()?.id === payload.campaign.id) {
        state.setCurrentCampaign(payload.campaign);
        renderCurrentCampaign();
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
      renderCurrentCampaign();
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function renameMap(mapId, name) {
    try {
      const payload = await api.renameMap(state.getCurrentCampaign().id, mapId, name);
      state.setCurrentCampaign(payload.campaign);
      renderCurrentCampaign();
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
      renderCurrentCampaign();
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function setShownEncounter(mapId) {
    try {
      const payload = await api.setActiveMap(state.getCurrentCampaign().id, mapId);
      state.setCurrentCampaign(payload.campaign);
      renderCurrentCampaign();
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  function selectEncounter(mapId) {
    state.openEncounter(mapId);
    renderCurrentCampaign();
  }

  function backToEncounters() {
    state.closeWorkspace();
    renderCurrentCampaign();
  }

  function showWorkspaceEncounter() {
    const selectedEncounterId = state.getSelectedEncounterId();
    if (selectedEncounterId) {
      toggleShownEncounter(selectedEncounterId);
    }
  }

  function toggleShownEncounter(mapId) {
    const activeMapId = state.getCurrentCampaign()?.activeMapId || null;
    setShownEncounter(mapId === activeMapId ? null : mapId);
  }

  function toggleManageMode() {
    state.toggleManageMode();
    renderCurrentCampaign();
  }

  function backToLibrary() {
    state.closeCampaign();
    view.hideCampaign();
    loadCampaigns();
  }

  return {
    actions: {
      backToLibrary,
      backToEncounters,
      createCampaign,
      moveMap,
      openCampaign,
      renameMap,
      selectEncounter,
      toggleShownEncounter,
      showWorkspaceEncounter,
      toggleManageMode,
      updateCampaignMetadata,
      uploadMap
    },
    start() {
      socket.on("connect", () => view.setStatus("Live", "live"));
      socket.on("disconnect", () => view.setStatus("Reconnecting...", "offline"));
      socket.on("state:sync", (serverState) => {
        if (state.synchronize(serverState)) {
          renderCurrentCampaign();
        }
      });
      loadCampaigns();
    }
  };
}
