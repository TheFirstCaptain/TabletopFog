export function createGmNavigation(elements) {
  function setWorkspaceOpen(open) {
    elements.workspaceGrid.dataset.workspaceOpen = String(open);
    elements.encounterWorkspace.hidden = !open;
    elements.encounterGallery.hidden = open;
    elements.workspaceEmpty.hidden = open;
    elements.mapForm.hidden = open;
    elements.campaignMessage.hidden = open;
  }

  return {
    showCampaign(campaign) {
      elements.breadcrumb.textContent = `Campaign Library / ${campaign.name}`;
      elements.libraryPanel.hidden = true;
      elements.campaignPanel.hidden = false;
      elements.backToLibrary.hidden = false;
      setWorkspaceOpen(false);
    },
    showLibrary() {
      elements.breadcrumb.textContent = "Campaign Library";
      elements.libraryPanel.hidden = false;
      elements.campaignPanel.hidden = true;
      elements.backToLibrary.hidden = false;
      setWorkspaceOpen(false);
    },
    showWorkspace(campaign, encounter) {
      elements.breadcrumb.textContent = `Campaign Library / ${campaign.name} / ${encounter.name}`;
      elements.backToLibrary.hidden = true;
      setWorkspaceOpen(true);
    }
  };
}
