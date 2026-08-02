import { createCampaignLibraryRenderer } from "./gm-campaign-library-renderer.js";
import { createEncounterGalleryRenderer } from "./gm-encounter-renderer.js";
import { createHandoutLibraryRenderer } from "./gm-handout-renderer.js";
import { createMapCanvasRenderer } from "./map-canvas.js";
import { createGmNavigation } from "./gm-navigation.js";
import { isShownTarget, recoveryMessage, shownTargetLabel } from "./gm-render-helpers.js";

const GRID_CELL_SIZE = 64;
const MIN_FOG_RECTANGLE_SIZE = 6;
const DEFAULT_CIRCLE_DIAMETER = 20;
const MIN_CIRCLE_DIAMETER = 2;
const MAX_CIRCLE_DIAMETER = 100;
const MIN_FOG_CIRCLE_RADIUS = 6;
const FOG_SHAPES = new Set(["rectangle", "brush", "circle"]);

function createDefaultGridState() {
  return {
    locked: false,
    offsetX: 0,
    offsetY: 0,
    visible: false
  };
}

export function createGmView(document) {
  const elements = {
    activeMapCanvas: document.querySelector("#active-map-canvas"),
    activeMapMessage: document.querySelector("#active-map-message"),
    backToEncounters: document.querySelector("#back-to-encounters"),
    backToLibrary: document.querySelector("#back-to-library"),
    campaignForm: document.querySelector("#campaign-form"),
    campaignHeading: document.querySelector("#campaign-heading"),
    campaignList: document.querySelector("#campaign-list"),
    campaignMessage: document.querySelector("#campaign-message"),
    campaignName: document.querySelector("#campaign-name"),
    campaignPanel: document.querySelector("#campaign-panel"),
    campaignContentSwitch: document.querySelector(".campaign-content-switch"),
    campaignSectionHeading: document.querySelector("#campaign-panel > .section-heading"),
    breadcrumb: document.querySelector("#breadcrumb"),
    encounterGallery: document.querySelector("#encounter-gallery"),
    encounterWorkspace: document.querySelector("#encounter-workspace"),
    gmFitMap: document.querySelector("#gm-fit-map"),
    gmZoomIn: document.querySelector("#gm-zoom-in"),
    gmZoomLevel: document.querySelector("#gm-zoom-level"),
    gmZoomOut: document.querySelector("#gm-zoom-out"),
    handoutFile: document.querySelector("#handout-file"),
    handoutForm: document.querySelector("#handout-form"),
    handoutLibrary: document.querySelector("#handout-library"),
    handoutList: document.querySelector("#handout-list"),
    libraryPanel: document.querySelector("#library-panel"),
    libraryDiagnostics: document.querySelector("#library-diagnostics"),
    libraryMessage: document.querySelector("#library-message"),
    mapFile: document.querySelector("#map-file"),
    mapForm: document.querySelector("#map-form"),
    mapList: document.querySelector("#map-list"),
    playerUrl: document.querySelector("#player-url"),
    playerUrlCopy: document.querySelector("#copy-player-url"),
    playerUrlMessage: document.querySelector("#player-url-message"),
    selectedEncounterHeading: document.querySelector("#selected-encounter-heading"),
    selectedEncounterStatus: document.querySelector("#selected-encounter-status"),
    showEncounters: document.querySelector("#show-encounters"),
    showHandouts: document.querySelector("#show-handouts"),
    shownTargetStatus: document.querySelector("#shown-target-status"),
    status: document.querySelector("#connection-status"),
    workspaceFogOverlay: document.querySelector("#workspace-fog-overlay"),
    workspaceCircleSize: document.querySelector("#workspace-circle-size"),
    workspaceCircleSizeControl: document.querySelector("#workspace-circle-size-control"),
    workspaceCircleSizeValue: document.querySelector("#workspace-circle-size-value"),
    workspaceGridLock: document.querySelector("#workspace-grid-lock"),
    workspaceGridOverlay: document.querySelector("#workspace-grid-overlay"),
    workspaceGridToggle: document.querySelector("#workspace-grid-toggle"),
    workspaceGrid: document.querySelector(".workspace-grid"),
    workspaceFogRectangle: document.querySelector("#workspace-fog-rectangle"),
    workspaceFogCircle: document.querySelector("#workspace-fog-circle"),
    workspaceBrushTool: document.querySelector("#workspace-brush-tool"),
    workspaceClearFog: document.querySelector("#workspace-clear-fog"),
    workspaceCircleTool: document.querySelector("#workspace-circle-tool"),
    workspaceHideTool: document.querySelector("#workspace-hide-tool"),
    workspaceRectangleTool: document.querySelector("#workspace-rectangle-tool"),
    workspaceRevealTool: document.querySelector("#workspace-reveal-tool"),
    workspaceUndoFog: document.querySelector("#workspace-undo-fog"),
    workspaceShowToPlayers: document.querySelector("#workspace-show-to-players")
  };
  const navigation = createGmNavigation(elements);
  const campaignLibraryRenderer = createCampaignLibraryRenderer(document, elements);
  const encounterGalleryRenderer = createEncounterGalleryRenderer(document, elements);
  const handoutLibraryRenderer = createHandoutLibraryRenderer(document, elements);
  let activeMapReady = false;
  let workspaceFogAction = null;
  let workspaceFogShape = "rectangle";
  let workspaceCircleDiameter = DEFAULT_CIRCLE_DIAMETER;
  let workspaceCanUndoFog = false;
  let workspaceFogOperationCount = 0;
  let workspaceGridState = createDefaultGridState();
  let campaignContentView = "encounters";
  elements.playerUrl.value = new URL("/player", document.defaultView.location.origin).href;

  let activeMapRenderer;
  activeMapRenderer = createMapCanvasRenderer({
    canvas: elements.activeMapCanvas,
    fogOpacity: 0.45,
    interactive: true,
    onStatus({ map, state }) {
      activeMapReady = state === "ready";
      elements.activeMapMessage.dataset.state = state;
      elements.activeMapMessage.setAttribute("role", state === "error" ? "alert" : "status");
      if (state === "empty") elements.activeMapMessage.textContent = "No encounter selected.";
      if (state === "loading") elements.activeMapMessage.textContent = "Loading map...";
      if (state === "ready") elements.activeMapMessage.textContent = map.name;
      if (state === "error") elements.activeMapMessage.textContent = "Map image could not be loaded.";
      renderWorkspaceZoomControls(activeMapRenderer.getViewport());
      renderWorkspaceFogTools();
      renderWorkspaceGridState();
    },
    onViewportChange(viewport) {
      renderWorkspaceZoomControls(viewport);
      requestAnimationFrame(() => renderWorkspaceGridState());
    }
  });

  function renderWorkspaceZoomControls(viewport = activeMapRenderer.getViewport()) {
    const disabled = !activeMapReady;
    elements.gmZoomLevel.value = `${Math.round(viewport.zoom * 100)}%`;
    elements.gmZoomLevel.textContent = elements.gmZoomLevel.value;
    elements.gmZoomOut.disabled = disabled || viewport.zoom <= viewport.minZoom;
    elements.gmZoomIn.disabled = disabled || viewport.zoom >= viewport.maxZoom;
    elements.gmFitMap.disabled = disabled || (viewport.zoom === 1 && viewport.panX === 0 && viewport.panY === 0);
  }

  function renderWorkspaceFogTools() {
    if (!activeMapReady) workspaceFogAction = null;

    [
      [elements.workspaceHideTool, "hide"],
      [elements.workspaceRevealTool, "reveal"]
    ].forEach(([button, action]) => {
      const active = workspaceFogAction === action;
      button.disabled = !activeMapReady;
      button.dataset.active = String(active);
      button.setAttribute("aria-pressed", String(active));
    });
    [
      [elements.workspaceRectangleTool, "rectangle"],
      [elements.workspaceBrushTool, "brush"],
      [elements.workspaceCircleTool, "circle"]
    ].forEach(([button, shape]) => {
      const active = workspaceFogShape === shape;
      button.disabled = !activeMapReady;
      button.dataset.active = String(active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.workspaceCircleSizeControl.hidden = workspaceFogShape !== "brush";
    elements.workspaceCircleSize.disabled = !activeMapReady || workspaceFogShape !== "brush";
    elements.workspaceCircleSizeValue.disabled = !activeMapReady || workspaceFogShape !== "brush";
    elements.workspaceCircleSize.value = String(workspaceCircleDiameter);
    elements.workspaceCircleSizeValue.value = String(workspaceCircleDiameter);
    elements.workspaceClearFog.disabled = workspaceFogOperationCount === 0;
    elements.workspaceUndoFog.disabled = !activeMapReady || !workspaceCanUndoFog;
    elements.workspaceUndoFog.textContent = "Undo";
    elements.workspaceFogOverlay.hidden = !workspaceFogAction;
    elements.workspaceFogOverlay.dataset.active = String(Boolean(workspaceFogAction));
    elements.workspaceFogOverlay.dataset.action = workspaceFogAction || "";
    elements.workspaceFogOverlay.dataset.shape = workspaceFogShape;
    elements.activeMapCanvas.closest(".gm-map-stage").dataset.fogMode = workspaceFogAction
      ? `${workspaceFogAction}-${workspaceFogShape}`
      : "";
    if (!workspaceFogAction) clearWorkspaceFogDraft();
  }

  function clearWorkspaceFogDraft() {
    elements.workspaceFogRectangle.hidden = true;
    delete elements.workspaceFogRectangle.dataset.mode;
    delete elements.workspaceFogRectangle.dataset.tooSmall;
    Object.assign(elements.workspaceFogRectangle.style, {
      height: "",
      left: "",
      top: "",
      width: ""
    });
    elements.workspaceFogCircle.hidden = true;
    delete elements.workspaceFogCircle.dataset.mode;
    delete elements.workspaceFogCircle.dataset.tooSmall;
    Object.assign(elements.workspaceFogCircle.style, {
      height: "",
      left: "",
      top: "",
      width: ""
    });
  }

  function renderWorkspaceFogDraft(screenRect) {
    elements.workspaceFogCircle.hidden = true;
    elements.workspaceFogRectangle.hidden = false;
    elements.workspaceFogRectangle.dataset.mode = `${workspaceFogAction}-rectangle`;
    elements.workspaceFogRectangle.dataset.tooSmall = String(
      screenRect.width < MIN_FOG_RECTANGLE_SIZE || screenRect.height < MIN_FOG_RECTANGLE_SIZE
    );
    Object.assign(elements.workspaceFogRectangle.style, {
      height: `${screenRect.height}px`,
      left: `${screenRect.x}px`,
      top: `${screenRect.y}px`,
      width: `${screenRect.width}px`
    });
  }

  function renderWorkspaceFogCircleDraft(screenCircle, { tooSmall = false } = {}) {
    elements.workspaceFogRectangle.hidden = true;
    elements.workspaceFogCircle.hidden = false;
    elements.workspaceFogCircle.dataset.mode = `${workspaceFogAction}-circle`;
    elements.workspaceFogCircle.dataset.tooSmall = String(tooSmall);
    const diameter = screenCircle.radius * 2;
    Object.assign(elements.workspaceFogCircle.style, {
      height: `${diameter}px`,
      left: `${screenCircle.x - screenCircle.radius}px`,
      top: `${screenCircle.y - screenCircle.radius}px`,
      width: `${diameter}px`
    });
  }

  function renderWorkspaceGridState(gridState = workspaceGridState, viewport = activeMapRenderer.getViewport()) {
    workspaceGridState = { ...createDefaultGridState(), ...gridState };
    const shouldShowGrid = activeMapReady && workspaceGridState.visible;
    const lockedZoomRatio =
      workspaceGridState.locked && workspaceGridState.lockZoom > 0 ? viewport.zoom / workspaceGridState.lockZoom : 1;
    const drawX = Number(elements.activeMapCanvas.dataset.drawX);
    const drawY = Number(elements.activeMapCanvas.dataset.drawY);
    const lockedOffsetX = drawX + (workspaceGridState.lockOffsetX - workspaceGridState.lockDrawX) * lockedZoomRatio;
    const lockedOffsetY = drawY + (workspaceGridState.lockOffsetY - workspaceGridState.lockDrawY) * lockedZoomRatio;
    const offsetX = workspaceGridState.locked ? lockedOffsetX : workspaceGridState.offsetX;
    const offsetY = workspaceGridState.locked ? lockedOffsetY : workspaceGridState.offsetY;
    const cellSize = GRID_CELL_SIZE * lockedZoomRatio;

    elements.workspaceGridOverlay.hidden = !shouldShowGrid;
    elements.workspaceGridOverlay.dataset.locked = String(workspaceGridState.locked);
    elements.workspaceGridOverlay.dataset.offsetX = String(Math.round(offsetX));
    elements.workspaceGridOverlay.dataset.offsetY = String(Math.round(offsetY));
    elements.workspaceGridOverlay.dataset.cellSize = String(Math.round(cellSize));
    elements.workspaceGridOverlay.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    elements.workspaceGridOverlay.style.backgroundSize = `${cellSize}px ${cellSize}px`;

    elements.workspaceGridToggle.disabled = !activeMapReady;
    elements.workspaceGridToggle.textContent = workspaceGridState.visible ? "Hide grid" : "Show grid";
    elements.workspaceGridToggle.setAttribute("aria-pressed", String(workspaceGridState.visible));

    elements.workspaceGridLock.disabled = !activeMapReady || !workspaceGridState.visible;
    elements.workspaceGridLock.textContent = workspaceGridState.locked ? "Unlock grid" : "Lock grid";
    elements.workspaceGridLock.setAttribute("aria-pressed", String(workspaceGridState.locked));
  }

  function renderSelectedEncounter(campaign, selectedEncounterId, screen, gridState) {
    const selectedEncounter = campaign.maps.find((map) => map.id === selectedEncounterId);
    if (screen !== "workspace" || !selectedEncounter) {
      elements.selectedEncounterHeading.textContent = "Open an encounter";
      elements.selectedEncounterStatus.textContent = "Choose an encounter card to prep it here.";
      elements.workspaceShowToPlayers.disabled = true;
      activeMapReady = false;
      workspaceFogAction = null;
      workspaceCanUndoFog = false;
      workspaceFogOperationCount = 0;
      activeMapRenderer.setMap(null);
      renderWorkspaceZoomControls();
      renderWorkspaceFogTools();
      renderWorkspaceGridState(createDefaultGridState());
      return;
    }
    const shownToPlayers = isShownTarget(campaign, "encounter", selectedEncounter.id);
    elements.selectedEncounterHeading.textContent = selectedEncounter.name;
    elements.selectedEncounterStatus.textContent = shownToPlayers
      ? `Selected for Prep: ${selectedEncounter.name}. Shown to Players.`
      : `Selected for Prep: ${selectedEncounter.name}. Shown to Players: ${shownTargetLabel(campaign)}.`;
    elements.workspaceShowToPlayers.disabled = false;
    elements.workspaceShowToPlayers.dataset.mapId = selectedEncounter.id;
    elements.workspaceShowToPlayers.dataset.state = shownToPlayers ? "shown" : "ready";
    elements.workspaceShowToPlayers.textContent = shownToPlayers ? "Shown to Players" : "Show to Players";
    elements.workspaceShowToPlayers.setAttribute(
      "aria-label",
      shownToPlayers ? "Shown to Players - clear from Player Display" : "Show to Players from workspace"
    );
    workspaceCanUndoFog = Boolean(selectedEncounter.canUndoFogOperation);
    workspaceFogOperationCount = selectedEncounter.fogOperations?.length || 0;
    renderWorkspaceGridState(gridState);
    activeMapRenderer.setMap({ ...selectedEncounter, campaignId: campaign.id });
  }

  function renderCampaignContentView(screen = "campaign") {
    const showHandouts = screen === "campaign" && campaignContentView === "handouts";
    const showEncounters = screen === "campaign" && campaignContentView === "encounters";
    elements.encounterGallery.hidden = !showEncounters;
    elements.handoutLibrary.hidden = !showHandouts;
    elements.showEncounters.dataset.active = String(showEncounters);
    elements.showHandouts.dataset.active = String(showHandouts);
    elements.showEncounters.setAttribute("aria-pressed", String(showEncounters));
    elements.showHandouts.setAttribute("aria-pressed", String(showHandouts));
  }

  function renderShownTargetStatus(campaign) {
    elements.shownTargetStatus.textContent = `Shown to Players: ${shownTargetLabel(campaign)}`;
  }

  return {
    elements,
    destroy() {
      activeMapRenderer.destroy();
    },
    clearCampaignName() {
      elements.campaignName.value = "";
    },
    confirmDeleteEncounter(name) {
      return document.defaultView.confirm(
        `Delete encounter?\n\nThis permanently deletes the "${name}" encounter.\nThis can't be undone.`
      );
    },
    confirmDeleteCampaign(name) {
      return document.defaultView.confirm(
        `Delete campaign?\n\nThis permanently deletes "${name}". This can't be undone.`
      );
    },
    confirmDeleteHandout(name) {
      return document.defaultView.confirm(
        `Delete handout?\n\nThis permanently deletes "${name}" from this campaign.\nThis can't be undone.`
      );
    },
    confirmRemoveCampaignImage(name) {
      return document.defaultView.confirm(
        `Remove Campaign Image?\n\nThis removes the Campaign Image from "${name}". This can't be undone.`
      );
    },
    confirmClearFog(name, shownToPlayers) {
      const playerImpact = shownToPlayers ? "\nThe Player Display will update immediately." : "";
      return document.defaultView.confirm(
        `Clear fog?\n\nThis removes all fog from "${name}".${playerImpact}\nYou can use Undo until this campaign is reloaded.`
      );
    },
    clearMapFile() {
      elements.mapFile.value = "";
    },
    clearHandoutFile() {
      elements.handoutFile.value = "";
    },
    hideCampaign() {
      navigation.showLibrary();
    },
    copySelectedPlayerUrl() {
      try {
        return document.execCommand?.("copy") === true;
      } catch (_error) {
        return false;
      }
    },
    getPlayerUrl() {
      return elements.playerUrl.value;
    },
    renderCampaign(campaign, selectedEncounterId = null, screen = "campaign", gridState = createDefaultGridState()) {
      if (!campaign) return navigation.showLibrary();

      const preserveScroll =
        screen === "campaign" && !elements.campaignPanel.hidden && elements.workspaceGrid.dataset.screen === "campaign";
      const scrollLeft = preserveScroll ? document.defaultView?.scrollX || 0 : 0;
      const scrollTop = preserveScroll ? document.defaultView?.scrollY || 0 : 0;
      const selectedEncounter = campaign.maps.find((map) => map.id === selectedEncounterId);
      if (screen === "workspace" && selectedEncounter) {
        navigation.showWorkspace(campaign, selectedEncounter);
      } else {
        navigation.showCampaign(campaign);
      }
      elements.campaignHeading.textContent = campaign.name;
      elements.campaignMessage.textContent =
        recoveryMessage(campaign) || (campaign.maps.length === 0 ? "Add an encounter map to begin." : "");
      renderShownTargetStatus(campaign);
      encounterGalleryRenderer.renderMaps(campaign, selectedEncounterId);
      handoutLibraryRenderer.renderHandouts(campaign);
      renderSelectedEncounter(campaign, selectedEncounterId, screen, gridState);
      renderCampaignContentView(screen);
      if (preserveScroll) document.defaultView?.scrollTo(scrollLeft, scrollTop);
    },
    renderSelectedWorkspace(campaign, selectedEncounterId, screen = "workspace", gridState = createDefaultGridState()) {
      if (!campaign) return navigation.showLibrary();

      elements.campaignHeading.textContent = campaign.name;
      elements.campaignMessage.textContent =
        recoveryMessage(campaign) || (campaign.maps.length === 0 ? "Add an encounter map to begin." : "");
      renderShownTargetStatus(campaign);
      renderSelectedEncounter(campaign, selectedEncounterId, screen, gridState);
    },
    renderLibrary(library) {
      campaignLibraryRenderer.renderLibrary(library);
    },
    setCampaignCardMessage(campaignId, message, state = "error") {
      campaignLibraryRenderer.setCampaignCardMessage(campaignId, message, state);
    },
    setCampaignMessage(message) {
      elements.campaignMessage.textContent = message;
    },
    setLibraryMessage(message) {
      elements.libraryMessage.textContent = message;
    },
    selectPlayerUrl() {
      elements.playerUrl.focus();
      elements.playerUrl.select();
    },
    setPlayerUrlMessage(message) {
      elements.playerUrlMessage.textContent = message;
    },
    setCampaignContentView(view) {
      campaignContentView = view === "handouts" ? "handouts" : "encounters";
      renderCampaignContentView();
    },
    setStatus(message, state) {
      elements.status.textContent = message;
      elements.status.dataset.state = state;
    },
    setWorkspaceGridState(gridState) {
      renderWorkspaceGridState(gridState);
    },
    cancelWorkspaceFogRectangle() {
      clearWorkspaceFogDraft();
    },
    cancelWorkspaceFogShape() {
      clearWorkspaceFogDraft();
    },
    getWorkspaceCircleDiameter() {
      return workspaceCircleDiameter;
    },
    getWorkspaceFogCircle(clientPoint) {
      return activeMapRenderer.getNormalizedCircleFromClientPoint(clientPoint, workspaceCircleDiameter);
    },
    getWorkspaceFogDragCircle(startClient, endClient) {
      return activeMapRenderer.getNormalizedCircleFromClientPoints(startClient, endClient);
    },
    getWorkspaceFogRectangle(startClient, endClient) {
      return activeMapRenderer.getNormalizedRectFromClientPoints(startClient, endClient);
    },
    getWorkspaceGridLockSnapshot() {
      return {
        lockDrawX: Number(elements.activeMapCanvas.dataset.drawX) || 0,
        lockDrawY: Number(elements.activeMapCanvas.dataset.drawY) || 0,
        lockOffsetX: Number(elements.workspaceGridOverlay.dataset.offsetX) || 0,
        lockOffsetY: Number(elements.workspaceGridOverlay.dataset.offsetY) || 0,
        lockZoom: activeMapRenderer.getViewport().zoom
      };
    },
    workspaceFitMap() {
      return activeMapRenderer.resetViewport();
    },
    workspacePanMap: activeMapRenderer.panBy,
    getWorkspaceFogMode() {
      const operationShape = workspaceFogShape === "brush" ? "circle" : workspaceFogShape;
      return workspaceFogAction ? `${workspaceFogAction}-${operationShape}` : null;
    },
    getWorkspaceFogShape() {
      return workspaceFogShape;
    },
    previewWorkspaceFogCircle(clientPoint) {
      const draft = activeMapRenderer.getNormalizedCircleFromClientPoint(clientPoint, workspaceCircleDiameter);
      if (!draft || !draft.startInsideMap) {
        clearWorkspaceFogDraft();
        return null;
      }
      renderWorkspaceFogCircleDraft(draft.screenCircle);
      return draft;
    },
    previewWorkspaceFogDragCircle(startClient, endClient) {
      const draft = activeMapRenderer.getNormalizedCircleFromClientPoints(startClient, endClient);
      if (!draft || !draft.startInsideMap) {
        clearWorkspaceFogDraft();
        return null;
      }
      renderWorkspaceFogCircleDraft(draft.screenCircle, {
        tooSmall: draft.screenCircle.radius < MIN_FOG_CIRCLE_RADIUS
      });
      return draft;
    },
    previewWorkspaceFogRectangle(startClient, endClient) {
      const draft = activeMapRenderer.getNormalizedRectFromClientPoints(startClient, endClient);
      if (!draft || !draft.startInsideMap) {
        clearWorkspaceFogDraft();
        return null;
      }
      renderWorkspaceFogDraft(draft.screenRect);
      return draft;
    },
    setWorkspaceCircleDiameter(value) {
      const numeric = Math.round(Number(value));
      workspaceCircleDiameter = Math.min(
        MAX_CIRCLE_DIAMETER,
        Math.max(MIN_CIRCLE_DIAMETER, Number.isFinite(numeric) ? numeric : DEFAULT_CIRCLE_DIAMETER)
      );
      renderWorkspaceFogTools();
      return workspaceCircleDiameter;
    },
    setWorkspaceFogMode(mode) {
      if (!mode || !activeMapReady) {
        workspaceFogAction = null;
      } else {
        const [action, shape] = String(mode).split("-");
        workspaceFogAction = action === "hide" || action === "reveal" ? action : null;
        workspaceFogShape = FOG_SHAPES.has(shape) ? shape : workspaceFogShape;
      }
      renderWorkspaceFogTools();
      renderWorkspaceGridState();
      return workspaceFogAction ? `${workspaceFogAction}-${workspaceFogShape}` : null;
    },
    setWorkspaceFogShape(shape) {
      workspaceFogShape = FOG_SHAPES.has(shape) ? shape : workspaceFogShape;
      clearWorkspaceFogDraft();
      renderWorkspaceFogTools();
      renderWorkspaceGridState();
      return workspaceFogShape;
    },
    workspaceZoomIn() {
      return activeMapRenderer.zoomIn();
    },
    workspaceZoomOut() {
      return activeMapRenderer.zoomOut();
    }
  };
}
