export function createGmState() {
  let library = {
    campaigns: [],
    dataRoot: "",
    diagnostics: []
  };
  let currentCampaign = null;
  let selectedEncounterId = null;
  let screen = "library";
  const workspaceGridStates = new Map();

  function createDefaultGridState() {
    return {
      locked: false,
      lockDrawX: 0,
      lockDrawY: 0,
      lockOffsetX: 0,
      lockOffsetY: 0,
      lockZoom: 1,
      offsetX: 0,
      offsetY: 0,
      visible: false
    };
  }

  function getGridStateKey(mapId = selectedEncounterId) {
    if (!currentCampaign || !mapId) return null;
    return `${currentCampaign.id}:${mapId}`;
  }

  function getGridState(mapId = selectedEncounterId) {
    const key = getGridStateKey(mapId);
    if (!key) return createDefaultGridState();
    if (!workspaceGridStates.has(key)) workspaceGridStates.set(key, createDefaultGridState());
    return workspaceGridStates.get(key);
  }

  function ensureSelectedEncounterExists() {
    if (!currentCampaign || !currentCampaign.maps.some((map) => map.id === selectedEncounterId)) {
      selectedEncounterId = null;
      if (screen === "workspace") screen = "campaign";
    }
  }

  return {
    closeCampaign() {
      currentCampaign = null;
      selectedEncounterId = null;
      screen = "library";
    },
    closeWorkspace() {
      screen = "campaign";
    },
    getCurrentCampaign() {
      return currentCampaign;
    },
    getLibrary() {
      return library;
    },
    getReorderedMapIds(fromIndex, toIndex) {
      const maps = currentCampaign.maps.slice();
      const [moved] = maps.splice(fromIndex, 1);
      maps.splice(toIndex, 0, moved);
      return maps.map((map) => map.id);
    },
    getSelectedEncounterId() {
      return selectedEncounterId;
    },
    getSelectedEncounterGridState() {
      return { ...getGridState() };
    },
    getScreen() {
      return screen;
    },
    openEncounter(mapId) {
      selectedEncounterId = mapId;
      screen = "workspace";
    },
    selectEncounter(mapId) {
      selectedEncounterId = mapId;
    },
    setCurrentCampaign(campaign) {
      currentCampaign = campaign;
      if (screen === "library") screen = "campaign";
      ensureSelectedEncounterExists();
    },
    setLibrary(payload) {
      library = {
        campaigns: payload.campaigns,
        dataRoot: payload.dataRoot,
        diagnostics: payload.diagnostics || []
      };
    },
    synchronize(serverState) {
      if (currentCampaign && serverState.campaign && serverState.campaign.id === currentCampaign.id) {
        currentCampaign = serverState.campaign;
        ensureSelectedEncounterExists();
        return true;
      }

      return false;
    },
    updateSelectedEncounterGridState(patch) {
      const key = getGridStateKey();
      if (!key) return createDefaultGridState();
      const current = getGridState();
      const next = {
        ...current,
        ...patch
      };
      workspaceGridStates.set(key, next);
      return { ...next };
    }
  };
}
