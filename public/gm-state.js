export function createGmState() {
  let library = {
    campaigns: [],
    dataRoot: "",
    diagnostics: []
  };
  let currentCampaign = null;
  let selectedEncounterId = null;
  let screen = "library";

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
    }
  };
}
