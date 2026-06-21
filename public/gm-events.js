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

  elements.campaignList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='open-campaign']");
    if (button) actions.openCampaign(button.dataset.campaignId);
  });

  elements.mapList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

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
