(function () {
  const socket = io();
  const status = document.querySelector("#connection-status");
  const dataRoot = document.querySelector("#data-root");
  const campaignForm = document.querySelector("#campaign-form");
  const campaignName = document.querySelector("#campaign-name");
  const libraryMessage = document.querySelector("#library-message");
  const libraryDiagnostics = document.querySelector("#library-diagnostics");
  const campaignList = document.querySelector("#campaign-list");
  const campaignPanel = document.querySelector("#campaign-panel");
  const campaignHeading = document.querySelector("#campaign-heading");
  const backToLibrary = document.querySelector("#back-to-library");
  const mapForm = document.querySelector("#map-form");
  const mapFile = document.querySelector("#map-file");
  const campaignMessage = document.querySelector("#campaign-message");
  const mapList = document.querySelector("#map-list");
  const activeMapMessage = document.querySelector("#active-map-message");
  const activeMapImage = document.querySelector("#active-map-image");

  let campaigns = [];
  let diagnostics = [];
  let currentCampaign = null;

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }

  async function api(path, options) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  async function loadCampaigns() {
    try {
      const payload = await api("/api/campaigns");
      campaigns = payload.campaigns;
      diagnostics = payload.diagnostics || [];
      dataRoot.textContent = payload.dataRoot;
      renderCampaigns();
    } catch (error) {
      libraryMessage.textContent = error.message;
    }
  }

  function renderCampaigns() {
    campaignList.replaceChildren();
    libraryDiagnostics.replaceChildren();

    diagnostics.forEach((diagnostic) => {
      const item = document.createElement("p");
      item.className = "library-diagnostic";
      item.textContent = `Skipped campaign "${diagnostic.campaignId}": ${diagnostic.message}`;
      libraryDiagnostics.append(item);
    });

    if (campaigns.length === 0) {
      libraryMessage.textContent = diagnostics.length === 0 ? "No campaigns yet." : "No valid campaigns available.";
      return;
    }

    libraryMessage.textContent = "";

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

      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Open";
      open.addEventListener("click", () => openCampaign(campaign.id));

      item.append(title, meta, open);
      campaignList.append(item);
    });
  }

  async function openCampaign(campaignId) {
    try {
      const payload = await api(`/api/campaigns/${encodeURIComponent(campaignId)}`);
      currentCampaign = payload.campaign;
      renderCampaign();
    } catch (error) {
      libraryMessage.textContent = error.message;
    }
  }

  function renderCampaign() {
    if (!currentCampaign) {
      campaignPanel.hidden = true;
      return;
    }

    campaignPanel.hidden = false;
    campaignHeading.textContent = currentCampaign.name;
    campaignMessage.textContent = currentCampaign.maps.length === 0 ? "Add a map to begin." : "";
    renderMaps();
    renderActiveMap();
  }

  function renderMaps() {
    mapList.replaceChildren();

    if (currentCampaign.maps.length === 0) {
      return;
    }

    currentCampaign.maps.forEach((map, index) => {
      const item = document.createElement("article");
      item.className = "map-item";
      if (map.id === currentCampaign.activeMapId) {
        item.dataset.active = "true";
      }

      const name = document.createElement("input");
      name.type = "text";
      name.value = map.name;
      name.setAttribute("aria-label", `Map name for ${map.name}`);

      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "secondary";
      rename.textContent = "Rename";
      rename.addEventListener("click", () => renameMap(map.id, name.value));

      const up = document.createElement("button");
      up.type = "button";
      up.className = "secondary icon-button";
      up.textContent = "Up";
      up.disabled = index === 0;
      up.addEventListener("click", () => moveMap(index, index - 1));

      const down = document.createElement("button");
      down.type = "button";
      down.className = "secondary icon-button";
      down.textContent = "Down";
      down.disabled = index === currentCampaign.maps.length - 1;
      down.addEventListener("click", () => moveMap(index, index + 1));

      const show = document.createElement("button");
      show.type = "button";
      show.textContent = map.id === currentCampaign.activeMapId ? "Active" : "Show to players";
      show.disabled = map.id === currentCampaign.activeMapId;
      show.addEventListener("click", () => setActiveMap(map.id));

      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = map.originalFileName || map.file;

      const controls = document.createElement("div");
      controls.className = "map-controls";
      controls.append(rename, up, down, show);

      item.append(name, meta, controls);
      mapList.append(item);
    });
  }

  function renderActiveMap() {
    const activeMap = currentCampaign.maps.find((map) => map.id === currentCampaign.activeMapId);

    if (!activeMap) {
      activeMapMessage.textContent = "No active map selected.";
      activeMapImage.hidden = true;
      activeMapImage.removeAttribute("src");
      activeMapImage.alt = "";
      return;
    }

    activeMapMessage.textContent = activeMap.name;
    activeMapImage.src = activeMap.assetUrl;
    activeMapImage.alt = activeMap.name;
    activeMapImage.hidden = false;
  }

  async function renameMap(mapId, name) {
    try {
      const payload = await api(
        `/api/campaigns/${encodeURIComponent(currentCampaign.id)}/maps/${encodeURIComponent(mapId)}`,
        {
          body: JSON.stringify({ name }),
          headers: { "content-type": "application/json" },
          method: "PATCH"
        }
      );
      currentCampaign = payload.campaign;
      renderCampaign();
    } catch (error) {
      campaignMessage.textContent = error.message;
    }
  }

  async function moveMap(fromIndex, toIndex) {
    const maps = currentCampaign.maps.slice();
    const [moved] = maps.splice(fromIndex, 1);
    maps.splice(toIndex, 0, moved);

    try {
      const payload = await api(`/api/campaigns/${encodeURIComponent(currentCampaign.id)}/maps/reorder`, {
        body: JSON.stringify({ mapIds: maps.map((map) => map.id) }),
        headers: { "content-type": "application/json" },
        method: "PUT"
      });
      currentCampaign = payload.campaign;
      renderCampaign();
    } catch (error) {
      campaignMessage.textContent = error.message;
    }
  }

  async function setActiveMap(mapId) {
    try {
      const payload = await api(`/api/campaigns/${encodeURIComponent(currentCampaign.id)}/active-map`, {
        body: JSON.stringify({ mapId }),
        headers: { "content-type": "application/json" },
        method: "PUT"
      });
      currentCampaign = payload.campaign;
      renderCampaign();
    } catch (error) {
      campaignMessage.textContent = error.message;
    }
  }

  campaignForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const payload = await api("/api/campaigns", {
        body: JSON.stringify({ name: campaignName.value }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      campaignName.value = "";
      currentCampaign = payload.campaign;
      await loadCampaigns();
      renderCampaign();
    } catch (error) {
      libraryMessage.textContent = error.message;
    }
  });

  mapForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = mapFile.files[0];

    if (!file || !currentCampaign) {
      return;
    }

    try {
      const payload = await api(`/api/campaigns/${encodeURIComponent(currentCampaign.id)}/maps`, {
        body: await file.arrayBuffer(),
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-file-name": file.name
        },
        method: "POST"
      });
      mapFile.value = "";
      currentCampaign = payload.campaign;
      await loadCampaigns();
      renderCampaign();
    } catch (error) {
      campaignMessage.textContent = error.message;
    }
  });

  backToLibrary.addEventListener("click", () => {
    currentCampaign = null;
    campaignPanel.hidden = true;
    loadCampaigns();
  });

  socket.on("connect", () => {
    setStatus("Live", "live");
  });

  socket.on("disconnect", () => {
    setStatus("Reconnecting...", "offline");
  });

  socket.on("state:sync", (state) => {
    if (currentCampaign && state.campaign && state.campaign.id === currentCampaign.id) {
      currentCampaign = state.campaign;
      renderCampaign();
    }
  });

  loadCampaigns();
})();
