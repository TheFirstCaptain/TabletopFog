export function createGmState() {
  let library = {
    campaigns: [],
    dataRoot: "",
    diagnostics: []
  };
  let currentCampaign = null;

  return {
    closeCampaign() {
      currentCampaign = null;
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
    setCurrentCampaign(campaign) {
      currentCampaign = campaign;
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
        return true;
      }

      return false;
    }
  };
}
