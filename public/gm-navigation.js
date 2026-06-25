export function createGmNavigation(elements) {
  function setWorkspaceOpen(open) {
    elements.encounterWorkspace.hidden = !open;
    elements.encounterGallery.hidden = open;
    elements.workspaceEmpty.hidden = open;
    elements.mapForm.hidden = open;
    elements.campaignMessage.hidden = open;
  }

  return {
    showCampaign(campaign) {
      elements.pageTitle.textContent = "Campaign";
      elements.breadcrumb.textContent = `Campaign Library / ${campaign.name}`;
      elements.libraryPanel.hidden = true;
      elements.campaignPanel.hidden = false;
      elements.backToLibrary.hidden = false;
      setWorkspaceOpen(false);
    },
    showLibrary() {
      elements.pageTitle.textContent = "Campaign Library";
      elements.breadcrumb.textContent = "Campaign Library";
      elements.libraryPanel.hidden = false;
      elements.campaignPanel.hidden = true;
      elements.backToLibrary.hidden = false;
      setWorkspaceOpen(false);
    },
    showWorkspace(campaign, encounter) {
      elements.pageTitle.textContent = "Encounter Workspace";
      elements.breadcrumb.textContent = `Campaign Library / ${campaign.name} / ${encounter.name}`;
      elements.backToLibrary.hidden = true;
      setWorkspaceOpen(true);
    }
  };
}
