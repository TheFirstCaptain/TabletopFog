export function wireGmEvents(elements, actions) {
  elements.campaignForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.createCampaign(elements.campaignName.value);
  });

  elements.mapForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.uploadMap(elements.mapFile.files[0]);
  });

  elements.backToLibrary.addEventListener("click", actions.backToLibrary);
  elements.backToEncounters.addEventListener("click", actions.backToEncounters);
  elements.workspaceShowToPlayers.addEventListener("click", actions.showWorkspaceEncounter);

  elements.campaignList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) {
      const card = button.closest(".campaign-card");
      if (button.dataset.action === "open-campaign") {
        actions.openCampaign(button.dataset.campaignId);
      } else if (button.dataset.action === "edit-campaign") {
        event.preventDefault();
        card.hidden = false;
        card.dataset.editing = "true";
      } else if (button.dataset.action === "cancel-campaign-edit") {
        event.preventDefault();
        card.dataset.editing = "false";
      }
      return;
    }

    const card = event.target.closest(".campaign-card[data-campaign-id]");
    if (card && card.dataset.editing !== "true" && !event.target.closest("input, textarea, form")) {
      actions.openCampaign(card.dataset.campaignId);
    }
  });

  elements.campaignList.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-action='save-campaign-metadata']");
    if (!form) return;

    event.preventDefault();
    actions.updateCampaignMetadata(form.dataset.campaignId, {
      description: form.querySelector("[name='campaign-description']").value,
      icon: form.querySelector("[name='campaign-icon']").value
    });
  });

  elements.mapList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      const card = event.target.closest(".encounter-card[data-map-id]");
      if (card && !event.target.closest("input, textarea, select")) {
        actions.selectEncounter(card.dataset.mapId);
      }
      return;
    }

    if (button.dataset.action === "select-encounter") {
      actions.selectEncounter(button.dataset.mapId);
      return;
    }

    if (button.dataset.action === "rename-map") {
      const name = button.closest("article").querySelector("input").value;
      actions.renameMap(button.dataset.mapId, name);
      return;
    }

    const index = Number(button.dataset.index);
    if (button.dataset.action === "move-map-up") {
      actions.moveMap(index, index - 1);
    } else if (button.dataset.action === "move-map-down") {
      actions.moveMap(index, index + 1);
    } else if (button.dataset.action === "set-active-map") {
      actions.setActiveMap(button.dataset.mapId);
    }
  });
}
