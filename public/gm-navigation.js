export function createGmNavigation(elements) {
  function showCampaignScreen() {
    elements.workspaceGrid.dataset.screen = "campaign";
    elements.campaignSectionHeading.hidden = false;
    elements.encounterWorkspace.hidden = true;
    elements.encounterGallery.hidden = false;
    elements.campaignMessage.hidden = false;
  }

  function showWorkspaceScreen() {
    elements.workspaceGrid.dataset.screen = "workspace";
    elements.campaignSectionHeading.hidden = true;
    elements.encounterWorkspace.hidden = false;
    elements.encounterGallery.hidden = true;
    elements.campaignMessage.hidden = true;
  }

  return {
    showCampaign(campaign) {
      elements.breadcrumb.textContent = `Campaign Library / ${campaign.name}`;
      elements.libraryPanel.hidden = true;
      elements.campaignPanel.hidden = false;
      elements.backToLibrary.hidden = false;
      showCampaignScreen();
    },
    showLibrary() {
      elements.breadcrumb.textContent = "Campaign Library";
      elements.libraryPanel.hidden = false;
      elements.campaignPanel.hidden = true;
      elements.backToLibrary.hidden = false;
      showCampaignScreen();
    },
    showWorkspace(campaign, encounter) {
      elements.breadcrumb.textContent = `Campaign Library / ${campaign.name} / ${encounter.name}`;
      elements.backToLibrary.hidden = true;
      showWorkspaceScreen();
    }
  };
}
