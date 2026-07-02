export function wireGmEvents(elements, actions) {
  let gridDragPoint = null;
  let fogDragPoint = null;

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
  elements.gmZoomOut.addEventListener("click", actions.zoomWorkspaceMapOut);
  elements.gmFitMap.addEventListener("click", actions.fitWorkspaceMap);
  elements.gmZoomIn.addEventListener("click", actions.zoomWorkspaceMapIn);
  elements.workspaceGridToggle.addEventListener("click", actions.toggleWorkspaceGrid);
  elements.workspaceGridLock.addEventListener("click", actions.toggleWorkspaceGridLock);
  elements.workspaceHideTool.addEventListener("click", () => actions.toggleWorkspaceFogMode("hide-rectangle"));
  elements.workspaceRevealTool.addEventListener("click", () => actions.toggleWorkspaceFogMode("reveal-rectangle"));
  elements.workspaceClearFog.addEventListener("click", actions.clearWorkspaceFog);

  elements.workspaceGridOverlay.addEventListener("pointerdown", (event) => {
    if (elements.workspaceFogOverlay.dataset.active === "true") return;
    if (elements.workspaceGridOverlay.dataset.locked === "true") return;
    elements.workspaceGridOverlay.setPointerCapture?.(event.pointerId);
    gridDragPoint = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    elements.workspaceGridOverlay.dataset.dragging = "true";
  });

  elements.workspaceGridOverlay.addEventListener("pointermove", (event) => {
    if (!gridDragPoint || gridDragPoint.pointerId !== event.pointerId) return;
    event.preventDefault();
    actions.moveWorkspaceGrid(event.clientX - gridDragPoint.x, event.clientY - gridDragPoint.y);
    gridDragPoint = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });

  function stopGridDrag(event) {
    if (gridDragPoint?.pointerId === event.pointerId) {
      gridDragPoint = null;
      delete elements.workspaceGridOverlay.dataset.dragging;
    }
  }

  elements.workspaceGridOverlay.addEventListener("pointerup", stopGridDrag);
  elements.workspaceGridOverlay.addEventListener("pointercancel", stopGridDrag);

  elements.workspaceGridOverlay.addEventListener("keydown", (event) => {
    if (elements.workspaceFogOverlay.dataset.active === "true") return;
    const delta = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1]
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    actions.moveWorkspaceGrid(delta[0] * step, delta[1] * step);
  });

  elements.workspaceFogOverlay.addEventListener("pointerdown", (event) => {
    if (elements.workspaceFogOverlay.dataset.active !== "true") return;
    event.preventDefault();
    elements.workspaceFogOverlay.setPointerCapture?.(event.pointerId);
    fogDragPoint = {
      pointerId: event.pointerId,
      start: { clientX: event.clientX, clientY: event.clientY }
    };
    actions.previewWorkspaceFogRectangle(fogDragPoint.start, fogDragPoint.start);
  });

  elements.workspaceFogOverlay.addEventListener("pointermove", (event) => {
    if (!fogDragPoint || fogDragPoint.pointerId !== event.pointerId) return;
    event.preventDefault();
    actions.previewWorkspaceFogRectangle(fogDragPoint.start, { clientX: event.clientX, clientY: event.clientY });
  });

  elements.workspaceFogOverlay.addEventListener("pointerup", (event) => {
    if (!fogDragPoint || fogDragPoint.pointerId !== event.pointerId) return;
    event.preventDefault();
    const start = fogDragPoint.start;
    fogDragPoint = null;
    actions.commitWorkspaceFogRectangle(start, { clientX: event.clientX, clientY: event.clientY });
  });

  elements.workspaceFogOverlay.addEventListener("pointercancel", (event) => {
    if (fogDragPoint?.pointerId !== event.pointerId) return;
    fogDragPoint = null;
    actions.cancelWorkspaceFogRectangle();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !fogDragPoint) return;
    event.preventDefault();
    fogDragPoint = null;
    actions.cancelWorkspaceFogRectangle();
  });

  elements.campaignList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) {
      const card = button.closest(".campaign-card");
      if (button.dataset.action === "open-campaign") {
        actions.openCampaign(button.dataset.campaignId);
      } else if (button.dataset.action === "delete-campaign") {
        event.preventDefault();
        actions.deleteCampaign(button.dataset.campaignId);
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
      icon: form.querySelector("[name='campaign-icon']").value,
      name: form.querySelector("[name='campaign-name']").value
    });
  });

  elements.mapList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      const card = event.target.closest(".encounter-card[data-map-id]");
      if (card && !event.target.closest("input, textarea, select, .encounter-admin")) {
        actions.selectEncounter(card.dataset.mapId);
      }
      return;
    }

    if (button.dataset.action === "select-encounter") {
      actions.selectEncounter(button.dataset.mapId);
      return;
    }

    if (button.dataset.action === "delete-map") {
      actions.deleteMap(button.dataset.mapId);
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
      actions.toggleShownEncounter(button.dataset.mapId);
    }
  });
}
