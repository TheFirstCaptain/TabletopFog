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
    activeMapImage: document.querySelector("#active-map-image"),
    activeMapMessage: document.querySelector("#active-map-message"),
    backToLibrary: document.querySelector("#back-to-library"),
    campaignForm: document.querySelector("#campaign-form"),
    campaignHeading: document.querySelector("#campaign-heading"),
    campaignList: document.querySelector("#campaign-list"),
    campaignMessage: document.querySelector("#campaign-message"),
    campaignName: document.querySelector("#campaign-name"),
    campaignPanel: document.querySelector("#campaign-panel"),
    dataRoot: document.querySelector("#data-root"),
    libraryDiagnostics: document.querySelector("#library-diagnostics"),
    libraryMessage: document.querySelector("#library-message"),
    mapFile: document.querySelector("#map-file"),
    mapForm: document.querySelector("#map-form"),
    mapList: document.querySelector("#map-list"),
    status: document.querySelector("#connection-status")
  };

  function renderActiveMap(campaign) {
    const activeMap = campaign.maps.find((map) => map.id === campaign.activeMapId);

    if (!activeMap) {
      elements.activeMapMessage.textContent = "No active map selected.";
      elements.activeMapImage.hidden = true;
      elements.activeMapImage.removeAttribute("src");
      elements.activeMapImage.alt = "";
      return;
    }

    elements.activeMapMessage.textContent = activeMap.name;
    elements.activeMapImage.src = activeMap.assetUrl;
    elements.activeMapImage.alt = activeMap.name;
    elements.activeMapImage.hidden = false;
  }

  function renderMaps(campaign) {
    elements.mapList.replaceChildren();

    campaign.maps.forEach((map, index) => {
      const item = document.createElement("article");
      item.className = "map-item";
      if (map.id === campaign.activeMapId) item.dataset.active = "true";

      const name = document.createElement("input");
      name.type = "text";
      name.value = map.name;
      name.setAttribute("aria-label", `Map name for ${map.name}`);

      const controls = document.createElement("div");
      controls.className = "map-controls";
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
        createButton(document, {
          action: "set-active-map",
          disabled: map.id === campaign.activeMapId,
          mapId: map.id,
          text: map.id === campaign.activeMapId ? "Active" : "Show to players"
        })
      );

      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = map.originalFileName || map.file;

      item.append(name, meta, controls);
      elements.mapList.append(item);
    });
  }

  return {
    elements,
    clearCampaignName() {
      elements.campaignName.value = "";
    },
    clearMapFile() {
      elements.mapFile.value = "";
    },
    hideCampaign() {
      elements.campaignPanel.hidden = true;
    },
    renderCampaign(campaign) {
      if (!campaign) {
        elements.campaignPanel.hidden = true;
        return;
      }

      elements.campaignPanel.hidden = false;
      elements.campaignHeading.textContent = campaign.name;
      elements.campaignMessage.textContent = campaign.maps.length === 0 ? "Add a map to begin." : "";
      renderMaps(campaign);
      renderActiveMap(campaign);
    },
    renderLibrary({ campaigns, dataRoot, diagnostics }) {
      elements.campaignList.replaceChildren();
      elements.libraryDiagnostics.replaceChildren();
      elements.dataRoot.textContent = dataRoot;

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
      campaigns.forEach((campaign) => {
        const item = document.createElement("article");
        item.className = "campaign-item";

        const title = document.createElement("h3");
        title.textContent = campaign.name;

        const meta = document.createElement("p");
        meta.className = "muted";
        meta.textContent = `${campaign.mapCount} map${campaign.mapCount === 1 ? "" : "s"}${
          campaign.activeMapName ? `, active: ${campaign.activeMapName}` : ""
        }`;

        const open = createButton(document, {
          action: "open-campaign",
          text: "Open"
        });
        open.dataset.campaignId = campaign.id;

        item.append(title, meta, open);
        elements.campaignList.append(item);
      });
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
