export function createGmApi(fetchRequest) {
  async function request(path, options) {
    const response = await fetchRequest(path, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  return {
    createCampaign(name) {
      return request("/api/campaigns", {
        body: JSON.stringify({ name }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
    },
    listCampaigns() {
      return request("/api/campaigns");
    },
    openCampaign(campaignId) {
      return request(`/api/campaigns/${encodeURIComponent(campaignId)}`);
    },
    updateCampaignMetadata(campaignId, metadata) {
      return request(`/api/campaigns/${encodeURIComponent(campaignId)}/metadata`, {
        body: JSON.stringify(metadata),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
    },
    renameMap(campaignId, mapId, name) {
      return request(`/api/campaigns/${encodeURIComponent(campaignId)}/maps/${encodeURIComponent(mapId)}`, {
        body: JSON.stringify({ name }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
    },
    reorderMaps(campaignId, mapIds) {
      return request(`/api/campaigns/${encodeURIComponent(campaignId)}/maps/reorder`, {
        body: JSON.stringify({ mapIds }),
        headers: { "content-type": "application/json" },
        method: "PUT"
      });
    },
    setActiveMap(campaignId, mapId) {
      return request(`/api/campaigns/${encodeURIComponent(campaignId)}/active-map`, {
        body: JSON.stringify({ mapId }),
        headers: { "content-type": "application/json" },
        method: "PUT"
      });
    },
    async uploadMap(campaignId, file) {
      return request(`/api/campaigns/${encodeURIComponent(campaignId)}/maps`, {
        body: await file.arrayBuffer(),
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-file-name": file.name
        },
        method: "POST"
      });
    }
  };
}
