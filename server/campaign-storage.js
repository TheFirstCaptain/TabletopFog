"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { createCampaignFiles, getDefaultDataRoot } = require("./campaign-files");
const {
  MAX_CAMPAIGN_DESCRIPTION_LENGTH,
  createUserError,
  displayNameFromFileName,
  normalizeCampaign,
  normalizeCampaignDescription,
  normalizeCampaignIcon,
  normalizeCampaignName,
  normalizeFileName,
  normalizePathSegment,
  serializeCampaign,
  splitFileName,
  validateCampaignMetadataPatch
} = require("./campaign-schema");
const { validateMapImage } = require("./map-image");

function createCampaignStorage(options = {}) {
  const campaignFiles = createCampaignFiles(options);
  const { dataRoot } = campaignFiles;

  function readCampaign(campaignId) {
    campaignFiles.assertCampaignExists(campaignId);
    const raw = JSON.parse(fs.readFileSync(campaignFiles.campaignJsonPath(campaignId), "utf8"));
    return normalizeCampaign(campaignId, raw);
  }

  function saveCampaign(campaign) {
    campaign.maps = campaign.maps.map((map, index) => ({
      ...map,
      order: index + 1,
      fog: Array.isArray(map.fog) ? map.fog : []
    }));

    campaignFiles.writeJsonAtomic(campaignFiles.campaignJsonPath(campaign.id), serializeCampaign(campaign));
    return normalizeCampaign(campaign.id, serializeCampaign(campaign));
  }

  function uniqueName(baseName, taken) {
    const { extension, name } = splitFileName(baseName);
    let candidate = `${name}${extension}`;
    let suffix = 2;

    while (taken.has(candidate.toLowerCase())) {
      candidate = `${name}-${suffix}${extension}`;
      suffix += 1;
    }

    return candidate;
  }

  function addAssetUrls(campaign) {
    return {
      ...campaign,
      maps: campaign.maps.map((map) => ({
        ...map,
        assetUrl: `/api/campaigns/${encodeURIComponent(campaign.id)}/maps/${encodeURIComponent(map.id)}/asset`
      }))
    };
  }

  function findMap(campaign, mapId) {
    const map = campaign.maps.find((candidate) => candidate.id === mapId);

    if (!map) {
      throw createUserError(404, "Map not found.");
    }

    return map;
  }

  function getCampaignLibrary() {
    campaignFiles.ensureDataRoot();
    const campaigns = [];
    const diagnostics = [];

    fs.readdirSync(dataRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        try {
          const campaign = readCampaign(entry.name);
          const activeMap = campaign.maps.find((map) => map.id === campaign.activeMapId);

          campaigns.push({
            id: campaign.id,
            name: campaign.name,
            ...(campaign.description ? { description: campaign.description } : {}),
            ...(campaign.icon ? { icon: campaign.icon } : {}),
            activeMapName: activeMap ? activeMap.name : null,
            mapCount: campaign.maps.length
          });
        } catch (_error) {
          diagnostics.push({
            campaignId: entry.name,
            message: "Campaign metadata could not be read. Fix or restore campaign.json, then reload the library."
          });
        }
      });

    campaigns.sort((left, right) => left.name.localeCompare(right.name));
    diagnostics.sort((left, right) => left.campaignId.localeCompare(right.campaignId));

    return { campaigns, diagnostics };
  }

  return {
    dataRoot,
    addAssetUrls,
    addMap(campaignId, mapInput) {
      const campaign = readCampaign(campaignId);
      const originalFileName = String(mapInput.originalFileName || "").trim();
      const safeFileName = normalizeFileName(originalFileName);

      if (!safeFileName) {
        throw createUserError(400, "A valid map file name is required.");
      }

      const content = Buffer.isBuffer(mapInput.content) ? mapInput.content : Buffer.from(mapInput.content || "");

      validateMapImage(content, mapInput.contentType, safeFileName);

      fs.mkdirSync(campaignFiles.mapsDir(campaignId), { recursive: true });
      const storedFileName = uniqueName(safeFileName, campaignFiles.existingNames(campaignFiles.mapsDir(campaignId)));
      const storedPath = path.join(campaignFiles.mapsDir(campaignId), storedFileName);
      const mapId = uniqueName(
        splitFileName(storedFileName).name,
        new Set(campaign.maps.map((map) => map.id.toLowerCase()))
      );
      const map = {
        id: mapId,
        name: displayNameFromFileName(originalFileName),
        originalFileName,
        file: path.posix.join("maps", storedFileName),
        order: campaign.maps.length + 1,
        fog: []
      };

      fs.writeFileSync(storedPath, content);
      campaign.maps.push(map);

      try {
        saveCampaign(campaign);
      } catch (error) {
        fs.rmSync(storedPath, { force: true });
        throw error;
      }

      return map;
    },
    createCampaign(name) {
      campaignFiles.ensureDataRoot();
      const safeName = normalizePathSegment(name);

      if (!safeName) {
        throw createUserError(400, "A valid campaign name is required.");
      }

      const taken = campaignFiles.existingNames(dataRoot);

      if (taken.has(safeName.toLowerCase())) {
        throw createUserError(409, "Campaign already exists.");
      }

      const dir = campaignFiles.campaignDir(safeName);

      try {
        fs.mkdirSync(path.join(dir, "maps"), { recursive: true });
        const campaign = {
          version: 1,
          id: safeName,
          name: String(name).trim(),
          activeMapId: null,
          maps: []
        };
        campaignFiles.writeJsonAtomic(campaignFiles.campaignJsonPath(safeName), serializeCampaign(campaign));
        return campaign;
      } catch (error) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw error;
      }
    },
    deleteCampaign(campaignId) {
      const campaign = readCampaign(campaignId);

      if (campaign.maps.length > 0) {
        throw createUserError(409, "Delete this campaign's encounters before deleting the campaign.");
      }

      fs.rmSync(campaignFiles.campaignDir(campaignId), { recursive: true, force: true });
    },
    getCampaign(campaignId) {
      return readCampaign(campaignId);
    },
    getCampaignLibrary,
    getMapAsset(campaignId, mapId) {
      const campaign = readCampaign(campaignId);
      const map = findMap(campaign, mapId);

      return {
        filePath: campaignFiles.getContainedMapAssetPath(campaignId, map),
        map
      };
    },
    listCampaigns() {
      return getCampaignLibrary().campaigns;
    },
    deleteMap(campaignId, mapId) {
      const campaign = readCampaign(campaignId);
      const map = findMap(campaign, mapId);

      if (map.id === campaign.activeMapId) {
        throw createUserError(409, "Clear this encounter from the Player Display before deleting it.");
      }

      const assetPath = campaignFiles.getContainedMapAssetPath(campaignId, map);
      const deletePath = `${assetPath}.delete-${process.pid}-${Date.now()}`;
      fs.renameSync(assetPath, deletePath);

      try {
        campaign.maps = campaign.maps.filter((candidate) => candidate.id !== map.id);
        const savedCampaign = saveCampaign(campaign);
        fs.rmSync(deletePath, { force: true });
        return savedCampaign;
      } catch (error) {
        fs.renameSync(deletePath, assetPath);
        throw error;
      }
    },
    renameMap(campaignId, mapId, name) {
      const campaign = readCampaign(campaignId);
      const map = findMap(campaign, mapId);
      const displayName = String(name || "").trim();

      if (!displayName) {
        throw createUserError(400, "A map name is required.");
      }

      map.name = displayName;
      return findMap(saveCampaign(campaign), mapId);
    },
    reorderMaps(campaignId, mapIds) {
      const campaign = readCampaign(campaignId);

      if (!Array.isArray(mapIds) || mapIds.length !== campaign.maps.length) {
        throw createUserError(400, "Map order must include every map.");
      }

      const byId = new Map(campaign.maps.map((map) => [map.id, map]));
      const ordered = mapIds.map((id) => {
        const map = byId.get(id);

        if (!map) {
          throw createUserError(400, "Map order includes an unknown map.");
        }

        return map;
      });

      if (new Set(mapIds).size !== mapIds.length) {
        throw createUserError(400, "Map order includes duplicate maps.");
      }

      campaign.maps = ordered;
      return saveCampaign(campaign);
    },
    setActiveMap(campaignId, mapId) {
      const campaign = readCampaign(campaignId);

      if (mapId === null) {
        campaign.activeMapId = null;
        return saveCampaign(campaign);
      }

      findMap(campaign, mapId);
      campaign.activeMapId = mapId;
      return saveCampaign(campaign);
    },
    updateCampaignMetadata(campaignId, metadata) {
      validateCampaignMetadataPatch(metadata);
      const campaign = readCampaign(campaignId);

      if (Object.hasOwn(metadata, "name")) {
        campaign.name = normalizeCampaignName(metadata.name);
      }

      if (Object.hasOwn(metadata, "description")) {
        campaign.description = normalizeCampaignDescription(metadata.description);
      }

      if (Object.hasOwn(metadata, "icon")) {
        campaign.icon = normalizeCampaignIcon(metadata.icon);
      }

      return saveCampaign(campaign);
    }
  };
}

module.exports = {
  MAX_CAMPAIGN_DESCRIPTION_LENGTH,
  createCampaignStorage,
  createUserError,
  getDefaultDataRoot,
  normalizeFileName,
  normalizePathSegment
};
