export function wireGmEvents(elements, actions) {
  let gridDragPoint = null;
  let fogPointer = null;
  const MIN_BRUSH_POINT_SPACING = 12;

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
  elements.playerUrlCopy.addEventListener("click", actions.copyPlayerUrl);
  elements.workspaceShowToPlayers.addEventListener("click", actions.showWorkspaceEncounter);
  elements.gmZoomOut.addEventListener("click", actions.zoomWorkspaceMapOut);
  elements.gmFitMap.addEventListener("click", actions.fitWorkspaceMap);
  elements.gmZoomIn.addEventListener("click", actions.zoomWorkspaceMapIn);
  elements.activeMapCanvas.addEventListener("keydown", (event) => {
    const pan = { ArrowDown: [0, -50], ArrowLeft: [50, 0], ArrowRight: [-50, 0], ArrowUp: [0, 50] }[event.key];
    if (!pan) return;
    event.preventDefault();
    actions.panWorkspaceMap(...pan);
  });
  elements.workspaceGridToggle.addEventListener("click", actions.toggleWorkspaceGrid);
  elements.workspaceGridLock.addEventListener("click", actions.toggleWorkspaceGridLock);
  elements.workspaceHideTool.addEventListener("click", () => actions.toggleWorkspaceFogAction("hide"));
  elements.workspaceRevealTool.addEventListener("click", () => actions.toggleWorkspaceFogAction("reveal"));
  elements.workspaceRectangleTool.addEventListener("click", () => actions.setWorkspaceFogShape("rectangle"));
  elements.workspaceBrushTool.addEventListener("click", () => actions.setWorkspaceFogShape("brush"));
  elements.workspaceCircleTool.addEventListener("click", () => actions.setWorkspaceFogShape("circle"));
  elements.workspaceCircleSize.addEventListener("input", () =>
    actions.setWorkspaceCircleDiameter(elements.workspaceCircleSize.value)
  );
  elements.workspaceCircleSizeValue.addEventListener("input", () =>
    actions.setWorkspaceCircleDiameter(elements.workspaceCircleSizeValue.value)
  );
  elements.workspaceClearFog.addEventListener("click", actions.clearWorkspaceFog);
  elements.workspaceUndoFog.addEventListener("click", actions.undoWorkspaceFog);

  elements.workspaceGridOverlay.addEventListener("pointerdown", (event) => {
    if (elements.workspaceFogOverlay.dataset.active === "true") return;
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
    const delta = { ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    actions.moveWorkspaceGrid(delta[0] * step, delta[1] * step);
  });

  elements.workspaceFogOverlay.addEventListener("pointerdown", (event) => {
    if (elements.workspaceFogOverlay.dataset.active !== "true") return;
    event.preventDefault();
    elements.workspaceFogOverlay.setPointerCapture?.(event.pointerId);
    fogPointer = {
      brushPoints: [],
      canceled: false,
      pointerId: event.pointerId,
      start: { clientX: event.clientX, clientY: event.clientY }
    };
    if (actions.getWorkspaceFogShape() === "brush") {
      fogPointer.brushPoints.push(fogPointer.start);
      actions.previewWorkspaceFogBrush(fogPointer.start);
    } else if (actions.getWorkspaceFogShape() === "circle") {
      actions.previewWorkspaceFogCircle(fogPointer.start, fogPointer.start);
    } else {
      actions.previewWorkspaceFogRectangle(fogPointer.start, fogPointer.start);
    }
  });

  elements.workspaceFogOverlay.addEventListener("pointermove", (event) => {
    event.preventDefault();
    const nextPoint = { clientX: event.clientX, clientY: event.clientY };
    if (!fogPointer) {
      if (actions.getWorkspaceFogShape() === "brush") {
        actions.previewWorkspaceFogBrush(nextPoint);
      }
      return;
    }
    if (fogPointer.pointerId !== event.pointerId) return;
    if (fogPointer.canceled) return;
    if (actions.getWorkspaceFogShape() === "brush") {
      const lastPoint = fogPointer.brushPoints[fogPointer.brushPoints.length - 1] || fogPointer.start;
      const distance = Math.hypot(nextPoint.clientX - lastPoint.clientX, nextPoint.clientY - lastPoint.clientY);
      if (distance >= MIN_BRUSH_POINT_SPACING) {
        fogPointer.brushPoints.push(nextPoint);
      }
      actions.previewWorkspaceFogBrush(nextPoint);
    } else if (actions.getWorkspaceFogShape() === "circle") {
      actions.previewWorkspaceFogCircle(fogPointer.start, nextPoint);
    } else {
      actions.previewWorkspaceFogRectangle(fogPointer.start, nextPoint);
    }
  });

  elements.workspaceFogOverlay.addEventListener("pointerleave", () => {
    if (!fogPointer && actions.getWorkspaceFogShape() === "brush") {
      actions.cancelWorkspaceFogShape();
    }
  });

  elements.workspaceFogOverlay.addEventListener("pointerup", (event) => {
    if (!fogPointer || fogPointer.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointer = fogPointer;
    fogPointer = null;
    if (pointer.canceled) {
      actions.cancelWorkspaceFogShape();
      return;
    }
    if (actions.getWorkspaceFogShape() === "brush") {
      const endPoint = { clientX: event.clientX, clientY: event.clientY };
      const lastPoint = pointer.brushPoints[pointer.brushPoints.length - 1] || pointer.start;
      const distance = Math.hypot(endPoint.clientX - lastPoint.clientX, endPoint.clientY - lastPoint.clientY);
      if (distance >= MIN_BRUSH_POINT_SPACING / 2) {
        pointer.brushPoints.push(endPoint);
      }
      actions.commitWorkspaceFogBrush(pointer.brushPoints);
    } else if (actions.getWorkspaceFogShape() === "circle") {
      actions.commitWorkspaceFogCircle(pointer.start, { clientX: event.clientX, clientY: event.clientY });
    } else {
      actions.commitWorkspaceFogRectangle(pointer.start, { clientX: event.clientX, clientY: event.clientY });
    }
  });

  elements.workspaceFogOverlay.addEventListener("pointercancel", (event) => {
    if (fogPointer?.pointerId !== event.pointerId) return;
    fogPointer = null;
    actions.cancelWorkspaceFogShape();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !fogPointer) return;
    event.preventDefault();
    fogPointer.canceled = true;
    actions.cancelWorkspaceFogShape();
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
