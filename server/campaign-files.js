"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createUserError } = require("./campaign-schema");

function getDefaultDataRoot(env = process.env) {
  return env.TABLETOPFOG_DATA_DIR || path.join(os.homedir(), "TabletopFog", "tabletopfog-data");
}

function createCampaignFiles(options = {}) {
  const dataRoot = path.resolve(options.dataRoot || getDefaultDataRoot(options.env));

  function campaignDir(campaignId) {
    return path.join(dataRoot, campaignId);
  }

  function campaignJsonPath(campaignId) {
    return path.join(campaignDir(campaignId), "campaign.json");
  }

  function mapsDir(campaignId) {
    return path.join(campaignDir(campaignId), "maps");
  }

  function assertSafeId(id, label) {
    if (!id || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
      throw createUserError(400, `Invalid ${label}.`);
    }
  }

  function assertCampaignExists(campaignId) {
    assertSafeId(campaignId, "campaign");

    if (!fs.existsSync(campaignJsonPath(campaignId))) {
      throw createUserError(404, "Campaign not found.");
    }
  }

  function writeJsonAtomic(filePath, data) {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`);
    fs.renameSync(tempPath, filePath);
  }

  function existingNames(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return new Set();
    }

    return new Set(fs.readdirSync(dirPath).map((entry) => entry.toLowerCase()));
  }

  function getContainedMapAssetPath(campaignId, map) {
    const relativeFile = map.file.replace(/\\/g, "/");

    if (!relativeFile.startsWith("maps/")) {
      throw createUserError(400, "Invalid map asset path.");
    }

    const resolved = path.resolve(campaignDir(campaignId), map.file);
    const mapsRoot = fs.realpathSync(mapsDir(campaignId));
    let realAssetPath;

    try {
      realAssetPath = fs.realpathSync(resolved);
    } catch (_error) {
      throw createUserError(404, "Map asset not found.");
    }

    const relative = path.relative(mapsRoot, realAssetPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw createUserError(400, "Invalid map asset path.");
    }

    return realAssetPath;
  }

  return {
    dataRoot,
    assertCampaignExists,
    campaignDir,
    campaignJsonPath,
    ensureDataRoot() {
      fs.mkdirSync(dataRoot, { recursive: true });
    },
    existingNames,
    getContainedMapAssetPath,
    mapsDir,
    writeJsonAtomic
  };
}

module.exports = {
  createCampaignFiles,
  getDefaultDataRoot
};
