import { createMapCanvasRenderer } from "./map-canvas.js";
import { createGmNavigation } from "./gm-navigation.js";

const DEFAULT_CAMPAIGN_ICON = "🗺️";

function createButton(document, { action, className, disabled, index, mapId, text }) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.dataset.action = action;

  if (className) button.className = className;
  if (disabled) button.disabled = true;
  if (index !== undefined) button.dataset.index = String(index);
  if (mapId) button.dataset.mapId = mapId;

  return button;
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
    breadcrumb: document.querySelector("#breadcrumb"),
    encounterGallery: document.querySelector("#encounter-gallery"),
    encounterWorkspace: document.querySelector("#encounter-workspace"),
    libraryPanel: document.querySelector("#library-panel"),
    libraryDiagnostics: document.querySelector("#library-diagnostics"),
    libraryMessage: document.querySelector("#library-message"),
    mapFile: document.querySelector("#map-file"),
    mapForm: document.querySelector("#map-form"),
    mapList: document.querySelector("#map-list"),
    manageEncounters: document.querySelector("#manage-encounters"),
    selectedEncounterHeading: document.querySelector("#selected-encounter-heading"),
    selectedEncounterStatus: document.querySelector("#selected-encounter-status"),
    pageTitle: document.querySelector("#page-title"),
    status: document.querySelector("#connection-status"),
    workspaceEmpty: document.querySelector("#workspace-empty"),
    workspaceGrid: document.querySelector(".workspace-grid"),
    workspaceShowToPlayers: document.querySelector("#workspace-show-to-players")
  };
  const navigation = createGmNavigation(elements);

  const activeMapRenderer = createMapCanvasRenderer({
    canvas: elements.activeMapCanvas,
    onStatus({ map, state }) {
      elements.activeMapMessage.dataset.state = state;
      elements.activeMapMessage.setAttribute("role", state === "error" ? "alert" : "status");
      if (state === "empty") elements.activeMapMessage.textContent = "No encounter selected.";
      if (state === "loading") elements.activeMapMessage.textContent = "Loading map...";
      if (state === "ready") elements.activeMapMessage.textContent = map.name;
      if (state === "error") elements.activeMapMessage.textContent = "Map image could not be loaded.";
    }
  });

  function renderSelectedEncounter(campaign, selectedEncounterId, workspaceOpen) {
    const selectedEncounter = campaign.maps.find((map) => map.id === selectedEncounterId);

    if (!workspaceOpen || !selectedEncounter) {
      elements.selectedEncounterHeading.textContent = "Open an encounter";
      elements.selectedEncounterStatus.textContent = "Choose an encounter card to prep it here.";
      elements.workspaceShowToPlayers.disabled = true;
      activeMapRenderer.setMap(null);
      return;
    }

    const shownToPlayers = selectedEncounter.id === campaign.activeMapId;
    const shownEncounter = campaign.maps.find((map) => map.id === campaign.activeMapId);
    navigation.showWorkspace(campaign, selectedEncounter);
    elements.selectedEncounterHeading.textContent = selectedEncounter.name;
    elements.selectedEncounterStatus.textContent = shownToPlayers
      ? `Selected for Prep: ${selectedEncounter.name}. Shown to Players.`
      : `Selected for Prep: ${selectedEncounter.name}. Shown to Players: ${shownEncounter?.name || "None"}.`;
    elements.workspaceShowToPlayers.disabled = false;
    elements.workspaceShowToPlayers.dataset.mapId = selectedEncounter.id;
    elements.workspaceShowToPlayers.textContent = shownToPlayers ? "Shown to Players" : "Show to Players";
    elements.workspaceShowToPlayers.setAttribute(
      "aria-label",
      shownToPlayers ? "Shown to Players - clear from Player Display" : "Show to Players from workspace"
    );
    activeMapRenderer.setMap({ ...selectedEncounter, campaignId: campaign.id });
  }

  function renderMaps(campaign, selectedEncounterId, manageMode) {
    elements.mapList.replaceChildren();
    elements.encounterGallery.dataset.manageMode = String(manageMode);
    elements.manageEncounters.textContent = manageMode ? "Done Managing" : "Manage Encounters";

    if (campaign.maps.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted encounter-empty";
      empty.textContent = manageMode
        ? "Add an encounter map to start this campaign."
        : "No encounters yet. Use Manage Encounters to add one.";
      elements.mapList.append(empty);
    }

    campaign.maps.forEach((map, index) => {
      const item = document.createElement("article");
      item.className = "encounter-card";
      item.dataset.mapId = map.id;
      if (map.id === campaign.activeMapId) item.dataset.shown = "true";
      if (map.id === selectedEncounterId) item.dataset.selected = "true";

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

      const status = document.createElement("div");
      status.className = "encounter-status";
      if (map.id === campaign.activeMapId) {
        const shown = document.createElement("span");
        shown.className = "status-pill";
        shown.textContent = "Shown to Players";
        status.append(shown);
      }
      if (map.id === selectedEncounterId) {
        const selected = document.createElement("span");
        selected.className = "status-pill secondary-pill";
        selected.textContent = "Selected for Prep";
        status.append(selected);
      }

      const summary = document.createElement("div");
      summary.className = "encounter-summary";
      summary.append(title, status);

      const running = document.createElement("div");
      running.className = "encounter-running";
      running.append(
        createButton(document, {
          action: "set-active-map",
          mapId: map.id,
          text: map.id === campaign.activeMapId ? "Shown to Players" : "Show to Players"
        })
      );
      const runningButton = running.querySelector("button");
      if (map.id === campaign.activeMapId) {
        runningButton.setAttribute("aria-label", `Shown to Players - clear ${map.name} from Player Display`);
      }

      const name = document.createElement("input");
      name.type = "text";
      name.value = map.name;
      name.setAttribute("aria-label", `Encounter name for ${map.name}`);

      const controls = document.createElement("div");
      controls.className = "encounter-controls";
      const deleteBlockedReason =
        map.id === campaign.activeMapId ? "Shown to Players. Clear it from the Player Display before deleting." : "";
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
      controls.append(
        createButton(document, {
          action: "rename-map",
          className: "secondary",
          mapId: map.id,
          text: "Rename"
        }),
        createButton(document, {
          action: "move-map-up",
          className: "secondary icon-button",
          disabled: index === 0,
          index,
          text: "Up"
        }),
        createButton(document, {
          action: "move-map-down",
          className: "secondary icon-button",
          disabled: index === campaign.maps.length - 1,
          index,
          text: "Down"
        }),
        deleteButton
      );

      const admin = document.createElement("div");
      admin.className = "encounter-admin";
      admin.hidden = !manageMode;
      admin.append(name, controls);
      if (deleteBlockedReason) {
        const reason = document.createElement("p");
        reason.className = "encounter-delete-reason";
        reason.id = deleteReasonId;
        reason.textContent = deleteBlockedReason;
        admin.append(reason);
      }

      item.append(openForPrep, summary, running, admin);
      elements.mapList.append(item);
    });
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
        `Delete encounter?\n\nThis permanently deletes "${name}" and its map file. This can't be undone.`
      );
    },
    confirmDeleteCampaign(name) {
      return document.defaultView.confirm(
        `Delete campaign?\n\nThis permanently deletes "${name}". This can't be undone.`
      );
    },
    clearMapFile() {
      elements.mapFile.value = "";
    },
    hideCampaign() {
      navigation.showLibrary();
    },
    renderCampaign(campaign, selectedEncounterId = null, workspaceOpen = false, manageMode = false) {
      if (!campaign) {
        navigation.showLibrary();
        return;
      }

      navigation.showCampaign(campaign);
      elements.campaignHeading.textContent = campaign.name;
      elements.campaignMessage.textContent = campaign.maps.length === 0 ? "Add a map to begin." : "";
      elements.mapForm.hidden = workspaceOpen || !manageMode;
      renderMaps(campaign, selectedEncounterId, manageMode);
      renderSelectedEncounter(campaign, selectedEncounterId, workspaceOpen);
    },
    renderLibrary({ campaigns, diagnostics }) {
      elements.campaignList.replaceChildren();
      elements.libraryDiagnostics.replaceChildren();

      diagnostics.forEach((diagnostic) => {
        const item = document.createElement("p");
        item.className = "library-diagnostic";
        item.textContent = `Skipped campaign "${diagnostic.campaignId}": ${diagnostic.message}`;
        elements.libraryDiagnostics.append(item);
      });

      if (campaigns.length === 0) {
        elements.libraryMessage.textContent =
          diagnostics.length === 0 ? "No campaigns yet." : "No valid campaigns available.";
        return;
      }

      elements.libraryMessage.textContent = "";
      campaigns.forEach((campaign, index) => {
        const item = document.createElement("article");
        item.className = "campaign-card";
        item.dataset.campaignId = campaign.id;
        item.dataset.editing = "false";

        const icon = document.createElement("div");
        icon.className = "campaign-card-icon";
        icon.textContent = campaign.icon || DEFAULT_CAMPAIGN_ICON;
        icon.setAttribute("aria-hidden", "true");

        const body = document.createElement("div");
        body.className = "campaign-card-body";

        const title = document.createElement("h3");
        title.textContent = campaign.name;

        const description = document.createElement("p");
        description.className = "campaign-description";
        description.textContent = campaign.description || "No description yet.";

        const meta = document.createElement("div");
        meta.className = "campaign-card-meta muted";

        const mapCount = document.createElement("span");
        mapCount.className = "campaign-card-map-count";
        mapCount.textContent = `${campaign.mapCount} map${campaign.mapCount === 1 ? "" : "s"}`;
        meta.append(mapCount);

        if (campaign.activeMapName) {
          const shown = document.createElement("span");
          shown.className = "campaign-card-shown";
          shown.textContent = `Shown to Players: ${campaign.activeMapName}`;
          meta.append(shown);
        }

        body.append(title, description, meta);

        const actions = document.createElement("div");
        actions.className = "campaign-card-actions";

        const open = createButton(document, {
          action: "open-campaign",
          text: "Open"
        });
        open.dataset.campaignId = campaign.id;

        const edit = createButton(document, {
          action: "edit-campaign",
          className: "secondary",
          text: "Edit"
        });
        edit.setAttribute("aria-label", "Edit campaign details");

        const deleteBlockedReason =
          campaign.mapCount > 0 ? "Delete this campaign's encounters before deleting the campaign." : "";
        const deleteReasonId = `delete-campaign-reason-${index}`;
        const deleteButton = createButton(document, {
          action: "delete-campaign",
          className: "secondary danger-secondary",
          disabled: Boolean(deleteBlockedReason),
          text: "Delete..."
        });
        deleteButton.dataset.campaignId = campaign.id;
        deleteButton.setAttribute("aria-label", `Delete ${campaign.name}`);
        if (deleteBlockedReason) {
          deleteButton.setAttribute("aria-describedby", deleteReasonId);
        }

        actions.append(open, edit, deleteButton);

        const form = document.createElement("form");
        form.className = "campaign-card-editor";
        form.dataset.action = "save-campaign-metadata";
        form.dataset.campaignId = campaign.id;

        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Campaign name";
        const nameInput = document.createElement("input");
        nameInput.name = "campaign-name";
        nameInput.type = "text";
        nameInput.autocomplete = "off";
        nameInput.required = true;
        nameInput.value = campaign.name;
        nameLabel.append(nameInput);

        const iconLabel = document.createElement("label");
        iconLabel.textContent = "Campaign icon";
        const iconInput = document.createElement("input");
        iconInput.name = "campaign-icon";
        iconInput.type = "text";
        iconInput.maxLength = 8;
        iconInput.value = campaign.icon || "";
        iconLabel.append(iconInput);

        const descriptionLabel = document.createElement("label");
        descriptionLabel.textContent = "Campaign description";
        const descriptionInput = document.createElement("textarea");
        descriptionInput.name = "campaign-description";
        descriptionInput.maxLength = 160;
        descriptionInput.rows = 3;
        descriptionInput.value = campaign.description || "";
        descriptionLabel.append(descriptionInput);

        const editorActions = document.createElement("div");
        editorActions.className = "campaign-card-actions";
        const save = createButton(document, {
          action: "save-campaign-metadata",
          text: "Save"
        });
        save.type = "submit";
        save.setAttribute("aria-label", "Save campaign details");
        const cancel = createButton(document, {
          action: "cancel-campaign-edit",
          className: "secondary",
          text: "Cancel"
        });
        editorActions.append(save, cancel);

        const message = document.createElement("p");
        message.className = "campaign-card-message muted";
        message.setAttribute("aria-live", "polite");

        const deleteReason = document.createElement("p");
        deleteReason.className = "campaign-delete-reason";
        deleteReason.id = deleteReasonId;
        deleteReason.textContent = deleteBlockedReason;
        deleteReason.hidden = !deleteBlockedReason;

        form.append(nameLabel, iconLabel, descriptionLabel, editorActions);
        if (deleteBlockedReason) {
          actions.append(deleteReason);
        }
        item.append(icon, body, actions, form, message);
        elements.campaignList.append(item);
      });
    },
    setCampaignCardMessage(campaignId, message) {
      const card = elements.campaignList.querySelector(`[data-campaign-id="${CSS.escape(campaignId)}"]`);
      if (!card) {
        elements.libraryMessage.textContent = message;
        return;
      }

      const cardMessage = card.querySelector(".campaign-card-message");
      cardMessage.textContent = message;
      cardMessage.classList.toggle("error-text", Boolean(message));
    },
    setCampaignMessage(message) {
      elements.campaignMessage.textContent = message;
    },
    setLibraryMessage(message) {
      elements.libraryMessage.textContent = message;
    },
    setStatus(message, state) {
      elements.status.textContent = message;
      elements.status.dataset.state = state;
    }
  };
}
