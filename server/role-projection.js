"use strict";

function getRoleFromReferer(referer) {
  if (!referer) {
    return "player";
  }

  try {
    const url = new URL(referer);
    return url.pathname === "/gm" ? "gm" : "player";
  } catch (_error) {
    return "player";
  }
}

function projectStateForRole(state, role) {
  if (role === "gm") {
    return state;
  }

  const campaign = state.campaign;
  const shownTarget = campaign ? getShownTargetProjection(campaign) : null;

  return {
    activeMap: shownTarget?.type === "encounter" ? shownTarget : null,
    campaign: campaign ? getCampaignProjection(campaign, shownTarget, state.version) : null,
    shownTarget,
    updatedAt: state.updatedAt,
    version: state.version
  };
}

function getCampaignProjection(campaign, shownTarget, stateVersion) {
  const projection = {
    id: campaign.id,
    name: campaign.name
  };

  if (!shownTarget && campaign.campaignImage && campaign.campaignImage.assetAvailable !== false) {
    projection.waitingImage = {
      assetUrl: "/api/player/waiting-image/asset",
      version: `${campaign.id}/campaign-image/${stateVersion}`
    };
  }

  return projection;
}

function getShownTargetProjection(campaign) {
  if (campaign.shownTarget?.type === "encounter") {
    const encounter = campaign.maps.find((map) => map.id === campaign.shownTarget.id);
    if (!encounter) return null;
    return {
      campaignId: campaign.id,
      fogOperations: encounter.fogOperations || [],
      id: encounter.id,
      name: encounter.name,
      assetUrl: "/api/player/shown-target/asset",
      type: "encounter",
      version: `${campaign.id}/encounter/${encounter.id}`
    };
  }

  if (campaign.shownTarget?.type === "handout") {
    const handout = (campaign.handouts || []).find((candidate) => candidate.id === campaign.shownTarget.id);
    if (!handout) return null;
    return {
      campaignId: campaign.id,
      id: handout.id,
      name: handout.name,
      assetUrl: "/api/player/shown-target/asset",
      rotation: campaign.shownTarget.rotation || 0,
      type: "handout",
      version: `${campaign.id}/handout/${handout.id}`
    };
  }

  return null;
}

function requireGm(request, response, next) {
  if (getRoleFromReferer(request.get("referer")) !== "gm") {
    response.status(403).json({ error: "GM view required." });
    return;
  }

  next();
}

module.exports = {
  getCampaignProjection,
  getRoleFromReferer,
  getShownTargetProjection,
  projectStateForRole,
  requireGm
};
