import { createButton, isShownTarget } from "./gm-render-helpers.js";

export function createEncounterGalleryRenderer(document, elements) {
  function renderMaps(campaign, selectedEncounterId) {
    elements.mapList.replaceChildren();
    elements.mapForm.hidden = false;

    if (campaign.maps.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted encounter-empty";
      empty.textContent = "No encounters yet. Add an encounter map to start this campaign.";
      elements.mapList.append(empty);
    }

    campaign.maps.forEach((map, index) => {
      const item = document.createElement("article");
      item.className = "encounter-card";
      item.dataset.mapId = map.id;
      if (isShownTarget(campaign, "encounter", map.id)) item.dataset.shown = "true";
      if (map.id === selectedEncounterId) {
        item.dataset.selected = "true";
        item.setAttribute("aria-current", "true");
      }

      const openForPrep = document.createElement("button");
      openForPrep.type = "button";
      openForPrep.className = "encounter-open-button";
      openForPrep.dataset.action = "select-encounter";
      openForPrep.dataset.mapId = map.id;
      openForPrep.setAttribute("aria-label", `Open ${map.name} for prep`);

      const thumbnail = document.createElement("img");
      thumbnail.className = "encounter-thumbnail";
      thumbnail.src = map.assetUrl;
      thumbnail.alt = `Thumbnail for ${map.name}`;
      openForPrep.append(thumbnail);

      const title = document.createElement("h4");
      title.className = "encounter-name";
      title.textContent = map.name;

      const summary = document.createElement("div");
      summary.className = "encounter-summary";
      summary.append(title);

      const running = document.createElement("div");
      running.className = "encounter-running";
      running.append(
        createButton(document, {
          action: "set-active-map",
          mapId: map.id,
          text: isShownTarget(campaign, "encounter", map.id) ? "Shown to Players" : "Show to Players"
        })
      );
      const runningButton = running.querySelector("button");
      if (isShownTarget(campaign, "encounter", map.id)) {
        runningButton.dataset.state = "shown";
        runningButton.setAttribute("aria-label", `Shown to Players - clear ${map.name} from Player Display`);
      }

      const name = document.createElement("input");
      name.type = "text";
      name.value = map.name;
      name.setAttribute("aria-label", `Encounter name for ${map.name}`);

      const controls = document.createElement("div");
      controls.className = "encounter-controls";
      const deleteBlockedReason = isShownTarget(campaign, "encounter", map.id)
        ? "Shown to Players. Clear it from the Player Display before deleting."
        : "";
      const deleteReasonId = `delete-reason-${map.id}`;
      const deleteButton = createButton(document, {
        action: "delete-map",
        className: "secondary danger-secondary",
        disabled: Boolean(deleteBlockedReason),
        mapId: map.id,
        text: "Delete..."
      });
      deleteButton.setAttribute("aria-label", `Delete ${map.name}`);
      if (deleteBlockedReason) {
        deleteButton.setAttribute("aria-describedby", deleteReasonId);
      }
      const renameButton = createButton(document, {
        action: "rename-map",
        className: "secondary",
        mapId: map.id,
        text: "Rename"
      });
      renameButton.setAttribute("aria-label", `Rename ${map.name}`);

      const moveUpButton = createButton(document, {
        action: "move-map-up",
        className: "secondary icon-button",
        disabled: index === 0,
        index,
        text: "Up"
      });
      moveUpButton.setAttribute("aria-label", `Move ${map.name} up`);

      const moveDownButton = createButton(document, {
        action: "move-map-down",
        className: "secondary icon-button",
        disabled: index === campaign.maps.length - 1,
        index,
        text: "Down"
      });
      moveDownButton.setAttribute("aria-label", `Move ${map.name} down`);

      controls.append(renameButton, moveUpButton, moveDownButton, deleteButton);
      const admin = document.createElement("div");
      admin.className = "encounter-admin";
      admin.append(name, controls);
      const reason = document.createElement("p");
      reason.className = "encounter-delete-reason";
      reason.id = deleteReasonId;
      reason.textContent = deleteBlockedReason;
      if (!deleteBlockedReason) reason.setAttribute("aria-hidden", "true");
      admin.append(reason);

      item.append(openForPrep, summary, running, admin);
      elements.mapList.append(item);
    });
  }

  return { renderMaps };
}
