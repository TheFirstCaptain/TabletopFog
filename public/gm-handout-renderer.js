import {
  createButton,
  isShownTarget,
  setHandoutPreviewRotationScale,
  shownHandoutRotation
} from "./gm-render-helpers.js";

export function createHandoutLibraryRenderer(document, elements) {
  function renderHandouts(campaign) {
    const handouts = campaign.handouts || [];
    elements.handoutList.replaceChildren();
    elements.handoutForm.hidden = false;

    if (handouts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted handout-empty";
      empty.textContent = "No handouts yet. Add an image handout when this campaign needs one.";
      elements.handoutList.append(empty);
      return;
    }

    handouts.forEach((handout) => {
      const item = document.createElement("article");
      item.className = "handout-card";
      item.dataset.handoutId = handout.id;
      if (isShownTarget(campaign, "handout", handout.id)) item.dataset.shown = "true";
      const shownToPlayers = isShownTarget(campaign, "handout", handout.id);
      const rotation = shownHandoutRotation(campaign, handout.id);

      const thumbnail = document.createElement("img");
      thumbnail.className = "handout-thumbnail";
      thumbnail.src = handout.assetUrl;
      thumbnail.alt = `Handout thumbnail for ${handout.name}`;
      thumbnail.dataset.rotation = String(rotation);
      thumbnail.addEventListener("load", () => setHandoutPreviewRotationScale(thumbnail));
      if (thumbnail.complete) setHandoutPreviewRotationScale(thumbnail);

      const thumbnailFrame = document.createElement("div");
      thumbnailFrame.className = "handout-thumbnail-frame";
      thumbnailFrame.dataset.rotation = String(rotation);
      thumbnailFrame.append(thumbnail);

      const title = document.createElement("h4");
      title.className = "handout-name";
      title.textContent = handout.name;

      const running = document.createElement("div");
      running.className = "encounter-running";
      running.append(
        createButton(document, {
          action: "set-shown-handout",
          handoutId: handout.id,
          text: shownToPlayers ? "Shown to Players" : "Show to Players"
        })
      );
      const runningButton = running.querySelector("button");
      if (shownToPlayers) {
        runningButton.dataset.state = "shown";
        runningButton.setAttribute("aria-label", `Shown to Players - clear ${handout.name} from Player Display`);
        const rotationControls = document.createElement("div");
        rotationControls.className = "handout-rotation-controls";
        rotationControls.append(
          createButton(document, {
            action: "rotate-shown-handout",
            className: "secondary handout-rotate-button",
            direction: "left",
            handoutId: handout.id,
            text: "↰"
          }),
          createButton(document, {
            action: "rotate-shown-handout",
            className: "secondary handout-rotate-button",
            direction: "right",
            handoutId: handout.id,
            text: "↱"
          })
        );
        const rotateLeft = rotationControls.querySelector("[data-direction='left']");
        const rotateRight = rotationControls.querySelector("[data-direction='right']");
        rotateLeft.setAttribute("aria-label", `Rotate ${handout.name} left on Player Display`);
        rotateRight.setAttribute("aria-label", `Rotate ${handout.name} right on Player Display`);
        rotateLeft.title = "Rotate left 90 degrees";
        rotateRight.title = "Rotate right 90 degrees";
        running.append(rotationControls);
      } else {
        runningButton.setAttribute("aria-label", `Show ${handout.name} to players`);
      }

      const name = document.createElement("input");
      name.type = "text";
      name.value = handout.name;
      name.disabled = shownToPlayers;
      name.setAttribute("aria-label", `Handout name for ${handout.name}`);

      const controls = document.createElement("div");
      controls.className = "handout-controls";
      const blockedReason = shownToPlayers
        ? "Shown to Players. Clear it from the Player Display before renaming or deleting."
        : "";
      const blockedReasonId = `handout-manage-reason-${handout.id}`;
      const renameButton = createButton(document, {
        action: "rename-handout",
        className: "secondary",
        disabled: Boolean(blockedReason),
        handoutId: handout.id,
        text: "Rename"
      });
      renameButton.setAttribute("aria-label", `Rename ${handout.name}`);
      const deleteButton = createButton(document, {
        action: "delete-handout",
        className: "secondary danger-secondary",
        disabled: Boolean(blockedReason),
        handoutId: handout.id,
        text: "Delete..."
      });
      deleteButton.setAttribute("aria-label", `Delete ${handout.name}`);
      if (blockedReason) {
        renameButton.setAttribute("aria-describedby", blockedReasonId);
        deleteButton.setAttribute("aria-describedby", blockedReasonId);
      }
      controls.append(renameButton, deleteButton);

      const admin = document.createElement("div");
      admin.className = "handout-admin";
      admin.append(name, controls);
      if (blockedReason) {
        const reason = document.createElement("p");
        reason.className = "handout-manage-reason";
        reason.id = blockedReasonId;
        reason.textContent = blockedReason;
        admin.append(reason);
      }

      item.append(thumbnailFrame, title, running, admin);
      elements.handoutList.append(item);
    });
  }

  return { renderHandouts };
}
