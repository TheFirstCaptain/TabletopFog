export function createGmController({ api, socket, state, view }) {
  function renderCurrentCampaign() {
    view.renderCampaign(
      state.getCurrentCampaign(),
      state.getSelectedEncounterId(),
      state.getScreen(),
      state.getSelectedEncounterGridState()
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

  async function deleteCampaign(campaignId) {
    const campaign = state.getLibrary().campaigns.find((candidate) => candidate.id === campaignId);

    if (!campaign || !view.confirmDeleteCampaign(campaign.name)) {
      return;
    }

    try {
      state.setLibrary(await api.deleteCampaign(campaignId));
      if (state.getCurrentCampaign()?.id === campaignId) {
        state.closeCampaign();
        view.hideCampaign();
      }
      view.renderLibrary(state.getLibrary());
    } catch (error) {
      view.setCampaignCardMessage(campaignId, error.message);
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

  async function deleteMap(mapId) {
    const campaign = state.getCurrentCampaign();
    const map = campaign?.maps.find((candidate) => candidate.id === mapId);

    if (!campaign || !map || !view.confirmDeleteEncounter(map.name)) {
      return;
    }

    try {
      const payload = await api.deleteMap(campaign.id, mapId);
      state.setCurrentCampaign(payload.campaign);
      await loadCampaigns();
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

  async function copyPlayerUrl() {
    const url = view.getPlayerUrl();

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable.");
      }
      await navigator.clipboard.writeText(url);
      view.setPlayerUrlMessage("Player URL copied.");
    } catch (_error) {
      view.selectPlayerUrl();
      view.setPlayerUrlMessage(view.copySelectedPlayerUrl() ? "Player URL copied." : "Select and copy the Player URL.");
    }
  }

  function toggleShownEncounter(mapId) {
    const activeMapId = state.getCurrentCampaign()?.activeMapId || null;
    setShownEncounter(mapId === activeMapId ? null : mapId);
  }

  function moveWorkspaceGrid(deltaX, deltaY) {
    const current = state.getSelectedEncounterGridState();
    if (!current.visible) {
      view.setWorkspaceGridState(current);
      return;
    }
    if (current.locked) return;

    view.setWorkspaceGridState(
      state.updateSelectedEncounterGridState({
        offsetX: current.offsetX + deltaX,
        offsetY: current.offsetY + deltaY
      })
    );
  }

  function toggleWorkspaceGrid() {
    const current = state.getSelectedEncounterGridState();
    view.setWorkspaceGridState(
      state.updateSelectedEncounterGridState({
        visible: !current.visible
      })
    );
  }

  function toggleWorkspaceGridLock() {
    const current = state.getSelectedEncounterGridState();
    if (!current.visible) return;
    const lockPatch = current.locked
      ? {
          locked: false,
          offsetX: view.getWorkspaceGridLockSnapshot().lockOffsetX,
          offsetY: view.getWorkspaceGridLockSnapshot().lockOffsetY
        }
      : {
          ...view.getWorkspaceGridLockSnapshot(),
          locked: true
        };
    view.setWorkspaceGridState(state.updateSelectedEncounterGridState(lockPatch));
  }

  async function commitWorkspaceFogRectangle(startClient, endClient) {
    const campaign = state.getCurrentCampaign();
    const selectedEncounterId = state.getSelectedEncounterId();
    const fogMode = view.getWorkspaceFogMode();
    const draft = view.getWorkspaceFogRectangle(startClient, endClient);
    view.cancelWorkspaceFogRectangle();

    if (
      !campaign ||
      !selectedEncounterId ||
      !fogMode ||
      !draft ||
      !draft.startInsideMap ||
      draft.screenRect.width < 6 ||
      draft.screenRect.height < 6
    ) {
      return;
    }

    try {
      const payload = await api.appendFogOperation(campaign.id, selectedEncounterId, {
        type: fogMode,
        rect: draft.rect
      });
      state.setCurrentCampaign(payload.campaign);
      renderCurrentCampaign();
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function commitWorkspaceFogBrush(clientPoints) {
    const campaign = state.getCurrentCampaign();
    const selectedEncounterId = state.getSelectedEncounterId();
    const fogMode = view.getWorkspaceFogMode();
    const drafts = clientPoints.map((clientPoint) => view.getWorkspaceFogCircle(clientPoint)).filter(Boolean);
    view.cancelWorkspaceFogShape();

    const operations = drafts
      .filter((draft) => draft.startInsideMap)
      .map((draft) => ({
        type: fogMode,
        circle: draft.circle
      }));

    if (!campaign || !selectedEncounterId || !fogMode || operations.length === 0) {
      return;
    }

    let latestCampaign = null;
    try {
      for (const operation of operations) {
        const payload = await api.appendFogOperation(campaign.id, selectedEncounterId, operation);
        latestCampaign = payload.campaign;
      }
      state.setCurrentCampaign(latestCampaign);
      renderCurrentCampaign();
    } catch (error) {
      if (latestCampaign) {
        state.setCurrentCampaign(latestCampaign);
        renderCurrentCampaign();
      }
      view.setCampaignMessage(error.message);
    }
  }

  async function clearWorkspaceFog() {
    const campaign = state.getCurrentCampaign();
    const selectedEncounterId = state.getSelectedEncounterId();
    const selectedEncounter = campaign?.maps.find((map) => map.id === selectedEncounterId);

    if (
      !campaign ||
      !selectedEncounter ||
      !selectedEncounter.fogOperations?.length ||
      !view.confirmClearFog(selectedEncounter.name, selectedEncounter.id === campaign.activeMapId)
    ) {
      return;
    }

    view.setWorkspaceFogMode(null);
    view.cancelWorkspaceFogShape();

    try {
      const payload = await api.clearFogOperations(campaign.id, selectedEncounter.id);
      state.setCurrentCampaign(payload.campaign);
      renderCurrentCampaign();
    } catch (error) {
      view.setCampaignMessage(error.message);
    }
  }

  async function undoWorkspaceFog() {
    const campaign = state.getCurrentCampaign();
    const selectedEncounterId = state.getSelectedEncounterId();

    if (!campaign || !selectedEncounterId) {
      return;
    }

    view.setWorkspaceFogMode(null);
    view.cancelWorkspaceFogShape();

    try {
      const payload = await api.undoFogOperation(campaign.id, selectedEncounterId);
      state.setCurrentCampaign(payload.campaign);
      renderCurrentCampaign();
      view.setCampaignMessage("Fog undone.");
    } catch (_error) {
      view.setCampaignMessage("Could not undo fog. Nothing changed.");
    }
  }

  function cancelWorkspaceFogRectangle() {
    view.cancelWorkspaceFogRectangle();
  }

  function cancelWorkspaceFogShape() {
    view.cancelWorkspaceFogShape();
  }

  function previewWorkspaceFogRectangle(startClient, endClient) {
    view.previewWorkspaceFogRectangle(startClient, endClient);
  }

  function previewWorkspaceFogBrush(clientPoint) {
    view.previewWorkspaceFogCircle(clientPoint);
  }

  function setWorkspaceCircleDiameter(value) {
    view.setWorkspaceCircleDiameter(value);
  }

  function setWorkspaceFogShape(shape) {
    view.setWorkspaceFogShape(shape);
  }

  function toggleWorkspaceFogAction(action) {
    const currentMode = view.getWorkspaceFogMode();
    const currentShape = view.getWorkspaceFogShape();
    const nextMode = currentMode?.startsWith(`${action}-`) ? null : `${action}-${currentShape}`;
    view.setWorkspaceFogMode(nextMode);
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
      copyPlayerUrl,
      createCampaign,
      cancelWorkspaceFogShape,
      cancelWorkspaceFogRectangle,
      clearWorkspaceFog,
      commitWorkspaceFogBrush,
      commitWorkspaceFogRectangle,
      deleteCampaign,
      deleteMap,
      getWorkspaceFogShape: view.getWorkspaceFogShape,
      fitWorkspaceMap: view.workspaceFitMap,
      moveWorkspaceGrid,
      moveMap,
      openCampaign,
      panWorkspaceMap: view.workspacePanMap,
      previewWorkspaceFogBrush,
      previewWorkspaceFogRectangle,
      renameMap,
      selectEncounter,
      setWorkspaceCircleDiameter,
      setWorkspaceFogShape,
      toggleShownEncounter,
      toggleWorkspaceGrid,
      toggleWorkspaceGridLock,
      toggleWorkspaceFogAction,
      showWorkspaceEncounter,
      undoWorkspaceFog,
      updateCampaignMetadata,
      uploadMap,
      zoomWorkspaceMapIn: view.workspaceZoomIn,
      zoomWorkspaceMapOut: view.workspaceZoomOut
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
