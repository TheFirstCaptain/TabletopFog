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
  const activeMap = campaign ? campaign.maps.find((map) => map.id === campaign.activeMapId) : null;

  return {
    activeMap: activeMap
      ? {
          campaignId: campaign.id,
          id: activeMap.id,
          name: activeMap.name,
          assetUrl: "/api/player/active-map/asset",
          fogOperations: activeMap.fogOperations || [],
          version: `${campaign.id}/${activeMap.id}`
        }
      : null,
    updatedAt: state.updatedAt,
    version: state.version
  };
}

function requireGm(request, response, next) {
  if (getRoleFromReferer(request.get("referer")) !== "gm") {
    response.status(403).json({ error: "GM view required." });
    return;
  }

  next();
}

module.exports = {
  getRoleFromReferer,
  projectStateForRole,
  requireGm
};
