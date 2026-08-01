"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { createCampaignFiles, getDefaultDataRoot } = require("./campaign-files");
const {
  MAX_CAMPAIGN_DESCRIPTION_LENGTH,
  createUserError,
  displayNameFromFileName,
  normalizeCampaign,
  normalizeCampaignWithOptions,
  normalizeCampaignDescription,
  normalizeFogOperations,
  normalizeCampaignIcon,
  normalizeCampaignName,
  normalizeFileName,
  normalizePathSegment,
  serializeCampaign,
  splitFileName,
  validateCampaignMetadataPatch
} = require("./campaign-schema");
const { validateCampaignImage, validateHandoutImage, validateMapImage } = require("./map-image");

function createCampaignStorage(options = {}) {
  const campaignFiles = createCampaignFiles(options);
  const { dataRoot } = campaignFiles;
  const rotationDelta = {
    left: -90,
    right: 90
  };

  function readCampaign(campaignId) {
    campaignFiles.assertCampaignExists(campaignId);
    const raw = JSON.parse(fs.readFileSync(campaignFiles.campaignJsonPath(campaignId), "utf8"));
    return recoverCampaignAssets(campaignId, normalizeCampaignWithOptions(campaignId, raw, { recover: true }));
  }

  function saveCampaign(campaign) {
    campaign.handouts = (campaign.handouts || []).map((handout, index) => ({
      ...handout,
      order: index + 1
    }));
    campaign.maps = campaign.maps.map((map, index) => ({
      ...map,
      order: index + 1,
      fog: normalizeFogOperations(map.fog || [])
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
      campaignImage: campaign.campaignImage
        ? {
            ...campaign.campaignImage,
            assetUrl: `/api/campaigns/${encodeURIComponent(campaign.id)}/campaign-image/asset`
          }
        : null,
      handouts: (campaign.handouts || []).map((handout) => ({
        ...handout,
        assetUrl: `/api/campaigns/${encodeURIComponent(campaign.id)}/handouts/${encodeURIComponent(handout.id)}/asset`
      })),
      maps: campaign.maps.map((map) => ({
        ...map,
        assetUrl: `/api/campaigns/${encodeURIComponent(campaign.id)}/maps/${encodeURIComponent(map.id)}/asset`
      }))
    };
  }

  function recoverCampaignAssets(campaignId, campaign) {
    const recoveryDiagnostics = [...(campaign.recoveryDiagnostics || [])];
    let campaignImageAvailable = null;
    const availabilityByHandoutId = new Map();
    const availabilityByMapId = new Map();

    if (campaign.campaignImage) {
      try {
        campaignFiles.getContainedCampaignImageAssetPath(campaignId, campaign.campaignImage);
        campaignImageAvailable = true;
      } catch (_error) {
        campaignImageAvailable = false;
        recoveryDiagnostics.push({
          code: "missing-campaign-image-asset",
          message: "This Campaign Image could not be found.",
          severity: "warning"
        });
      }
    }

    (campaign.handouts || []).forEach((handout) => {
      try {
        campaignFiles.getContainedHandoutAssetPath(campaignId, handout);
        availabilityByHandoutId.set(handout.id, true);
      } catch (_error) {
        availabilityByHandoutId.set(handout.id, false);
        recoveryDiagnostics.push({
          code: "missing-handout-asset",
          handoutId: handout.id,
          message: "This handout image could not be found.",
          severity: "warning"
        });
      }
    });

    campaign.maps.forEach((map) => {
      try {
        campaignFiles.getContainedMapAssetPath(campaignId, map);
        availabilityByMapId.set(map.id, true);
      } catch (_error) {
        availabilityByMapId.set(map.id, false);
        recoveryDiagnostics.push({
          code: "missing-map-asset",
          mapId: map.id,
          message: "This encounter's map image could not be found.",
          severity: "warning"
        });
      }
    });

    const recovered = {
      ...campaign,
      campaignImage: campaign.campaignImage
        ? {
            ...campaign.campaignImage,
            assetAvailable: campaignImageAvailable !== false
          }
        : null,
      handouts: (campaign.handouts || []).map((handout) => ({
        ...handout,
        assetAvailable: availabilityByHandoutId.get(handout.id) !== false
      })),
      maps: campaign.maps.map((map) => ({
        ...map,
        assetAvailable: availabilityByMapId.get(map.id) !== false
      })),
      recoveryDiagnostics
    };

    if (recovered.shownTarget?.type === "encounter" && availabilityByMapId.get(recovered.shownTarget.id) === false) {
      recovered.recoveryDiagnostics.push({
        code: "shown-encounter-not-restored",
        mapId: recovered.shownTarget.id,
        message:
          "The saved Shown to Players encounter could not be restored. The Player Display is waiting for the GM.",
        severity: "warning"
      });
      recovered.shownTarget = null;
      recovered.activeMapId = null;
    }

    if (recovered.shownTarget?.type === "handout" && availabilityByHandoutId.get(recovered.shownTarget.id) === false) {
      recovered.recoveryDiagnostics.push({
        code: "shown-handout-not-restored",
        handoutId: recovered.shownTarget.id,
        message: "The saved Shown to Players handout could not be restored. The Player Display is waiting for the GM.",
        severity: "warning"
      });
      recovered.shownTarget = null;
    }

    return recovered;
  }

  function assertMapAssetAvailable(campaignId, map) {
    try {
      campaignFiles.getContainedMapAssetPath(campaignId, map);
    } catch (_error) {
      throw createUserError(409, "This encounter's map image could not be found.");
    }
  }

  function assertHandoutAssetAvailable(campaignId, handout) {
    try {
      campaignFiles.getContainedHandoutAssetPath(campaignId, handout);
    } catch (_error) {
      throw createUserError(409, "This handout image could not be found.");
    }
  }

  function getCampaignImageAssetPath(campaignId, campaignImage) {
    return campaignFiles.getContainedCampaignImageAssetPath(campaignId, campaignImage);
  }

  function findMap(campaign, mapId) {
    const map = campaign.maps.find((candidate) => candidate.id === mapId);

    if (!map) {
      throw createUserError(404, "Map not found.");
    }

    return map;
  }

  function findHandout(campaign, handoutId) {
    const handout = (campaign.handouts || []).find((candidate) => candidate.id === handoutId);

    if (!handout) {
      throw createUserError(404, "Handout not found.");
    }

    return handout;
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
          const shownEncounter =
            campaign.shownTarget?.type === "encounter"
              ? campaign.maps.find((map) => map.id === campaign.shownTarget.id)
              : null;

          campaigns.push({
            id: campaign.id,
            name: campaign.name,
            ...(campaign.description ? { description: campaign.description } : {}),
            ...(campaign.icon ? { icon: campaign.icon } : {}),
            activeMapName: shownEncounter ? shownEncounter.name : null,
            ...(campaign.campaignImage
              ? {
                  campaignImage: {
                    assetAvailable: campaign.campaignImage.assetAvailable !== false,
                    assetUrl: `/api/campaigns/${encodeURIComponent(campaign.id)}/campaign-image/asset`,
                    name: campaign.campaignImage.name,
                    originalFileName: campaign.campaignImage.originalFileName
                  },
                  hasCampaignImage: true
                }
              : {}),
            handoutCount: campaign.handouts?.length || 0,
            mapCount: campaign.maps.length,
            ...(campaign.shownTarget
              ? {
                  shownTarget: campaign.shownTarget,
                  shownTargetName:
                    campaign.shownTarget.type === "encounter"
                      ? shownEncounter?.name || null
                      : campaign.handouts.find((handout) => handout.id === campaign.shownTarget.id)?.name || null
                }
              : {})
          });
          (campaign.recoveryDiagnostics || []).forEach((diagnostic) => {
            diagnostics.push({
              campaignId: entry.name,
              message: diagnostic.message,
              type: "recovered"
            });
          });
        } catch (_error) {
          diagnostics.push({
            campaignId: entry.name,
            message: "Campaign metadata could not be read. Fix or restore campaign.json, then reload the library.",
            type: "skipped"
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
    addHandout(campaignId, handoutInput) {
      const campaign = readCampaign(campaignId);
      const originalFileName = String(handoutInput.originalFileName || "").trim();
      const safeFileName = normalizeFileName(originalFileName);

      if (!safeFileName) {
        throw createUserError(400, "A valid handout file name is required.");
      }

      const content = Buffer.isBuffer(handoutInput.content)
        ? handoutInput.content
        : Buffer.from(handoutInput.content || "");

      validateHandoutImage(content, handoutInput.contentType, safeFileName);

      fs.mkdirSync(campaignFiles.handoutsDir(campaignId), { recursive: true });
      const storedFileName = uniqueName(
        safeFileName,
        campaignFiles.existingNames(campaignFiles.handoutsDir(campaignId))
      );
      const storedPath = path.join(campaignFiles.handoutsDir(campaignId), storedFileName);
      const handoutId = uniqueName(
        splitFileName(storedFileName).name,
        new Set((campaign.handouts || []).map((handout) => handout.id.toLowerCase()))
      );
      const handout = {
        id: handoutId,
        name: displayNameFromFileName(originalFileName),
        originalFileName,
        file: path.posix.join("handouts", storedFileName),
        order: (campaign.handouts || []).length + 1
      };

      fs.writeFileSync(storedPath, content);
      campaign.handouts = [...(campaign.handouts || []), handout];

      try {
        saveCampaign(campaign);
      } catch (error) {
        fs.rmSync(storedPath, { force: true });
        throw error;
      }

      return handout;
    },
    setCampaignImage(campaignId, imageInput) {
      const campaign = readCampaign(campaignId);
      const originalFileName = String(imageInput.originalFileName || "").trim();
      const safeFileName = normalizeFileName(originalFileName);

      if (!safeFileName) {
        throw createUserError(400, "A valid Campaign Image file name is required.");
      }

      const content = Buffer.isBuffer(imageInput.content) ? imageInput.content : Buffer.from(imageInput.content || "");

      validateCampaignImage(content, imageInput.contentType, safeFileName);

      fs.mkdirSync(campaignFiles.campaignImagesDir(campaignId), { recursive: true });
      const storedFileName = uniqueName(
        safeFileName,
        campaignFiles.existingNames(campaignFiles.campaignImagesDir(campaignId))
      );
      const storedPath = path.join(campaignFiles.campaignImagesDir(campaignId), storedFileName);
      const previousImage = campaign.campaignImage;
      let previousPath = null;
      let deletePath = null;
      const campaignImage = {
        name: displayNameFromFileName(originalFileName),
        originalFileName,
        file: path.posix.join("campaign-images", storedFileName)
      };

      if (previousImage && previousImage.assetAvailable !== false) {
        previousPath = getCampaignImageAssetPath(campaignId, previousImage);
        deletePath = `${previousPath}.delete-${process.pid}-${Date.now()}`;
      }

      try {
        fs.writeFileSync(storedPath, content);
        if (previousPath && previousPath !== storedPath) {
          fs.renameSync(previousPath, deletePath);
        }
        campaign.campaignImage = campaignImage;
        saveCampaign(campaign);
      } catch (error) {
        fs.rmSync(storedPath, { force: true });
        if (deletePath && previousPath && fs.existsSync(deletePath)) {
          fs.renameSync(deletePath, previousPath);
        }
        throw error;
      }

      if (deletePath) {
        try {
          fs.rmSync(deletePath, { force: true });
        } catch (_error) {
          // Metadata is the commit point; stale staged files are harmless.
        }
      }

      return readCampaign(campaignId).campaignImage;
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
        fs.mkdirSync(path.join(dir, "campaign-images"), { recursive: true });
        fs.mkdirSync(path.join(dir, "handouts"), { recursive: true });
        fs.mkdirSync(path.join(dir, "maps"), { recursive: true });
        const campaign = {
          version: 1,
          id: safeName,
          name: String(name).trim(),
          campaignImage: null,
          handouts: [],
          maps: [],
          shownTarget: null
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

      if (campaign.maps.length > 0 || (campaign.handouts || []).length > 0) {
        throw createUserError(409, "Delete this campaign's encounters and handouts before deleting the campaign.");
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
    getHandoutAsset(campaignId, handoutId) {
      const campaign = readCampaign(campaignId);
      const handout = findHandout(campaign, handoutId);

      return {
        filePath: campaignFiles.getContainedHandoutAssetPath(campaignId, handout),
        handout
      };
    },
    getCampaignImageAsset(campaignId) {
      const campaign = readCampaign(campaignId);

      if (!campaign.campaignImage) {
        throw createUserError(404, "Campaign Image not found.");
      }

      return {
        filePath: getCampaignImageAssetPath(campaignId, campaign.campaignImage),
        campaignImage: campaign.campaignImage
      };
    },
    listCampaigns() {
      return getCampaignLibrary().campaigns;
    },
    deleteMap(campaignId, mapId) {
      const campaign = readCampaign(campaignId);
      const map = findMap(campaign, mapId);

      if (campaign.shownTarget?.type === "encounter" && map.id === campaign.shownTarget.id) {
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
    deleteHandout(campaignId, handoutId) {
      const campaign = readCampaign(campaignId);
      const handout = findHandout(campaign, handoutId);

      if (campaign.shownTarget?.type === "handout" && handout.id === campaign.shownTarget.id) {
        throw createUserError(409, "Clear this handout from the Player Display before deleting it.");
      }

      const assetPath = campaignFiles.getContainedHandoutAssetPath(campaignId, handout);
      const deletePath = `${assetPath}.delete-${process.pid}-${Date.now()}`;
      fs.renameSync(assetPath, deletePath);

      let savedCampaign;
      try {
        campaign.handouts = (campaign.handouts || []).filter((candidate) => candidate.id !== handout.id);
        savedCampaign = saveCampaign(campaign);
      } catch (error) {
        fs.renameSync(deletePath, assetPath);
        throw error;
      }

      try {
        fs.rmSync(deletePath, { force: true });
      } catch (_error) {
        // Metadata is the commit point; the original asset path is already gone.
      }
      return savedCampaign;
    },
    removeCampaignImage(campaignId) {
      const campaign = readCampaign(campaignId);

      if (!campaign.campaignImage) {
        return campaign;
      }

      let assetPath = null;
      let deletePath = null;

      if (campaign.campaignImage.assetAvailable !== false) {
        assetPath = getCampaignImageAssetPath(campaignId, campaign.campaignImage);
        deletePath = `${assetPath}.delete-${process.pid}-${Date.now()}`;
        fs.renameSync(assetPath, deletePath);
      }

      let savedCampaign;
      try {
        campaign.campaignImage = null;
        savedCampaign = saveCampaign(campaign);
      } catch (error) {
        if (deletePath && assetPath && fs.existsSync(deletePath)) {
          fs.renameSync(deletePath, assetPath);
        }
        throw error;
      }

      if (deletePath) {
        try {
          fs.rmSync(deletePath, { force: true });
        } catch (_error) {
          // Metadata is the commit point; the original asset path is already gone.
        }
      }
      return savedCampaign;
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
    renameHandout(campaignId, handoutId, name) {
      const campaign = readCampaign(campaignId);
      const handout = findHandout(campaign, handoutId);
      const displayName = String(name || "").trim();

      if (!displayName) {
        throw createUserError(400, "A handout name is required.");
      }

      if (campaign.shownTarget?.type === "handout" && handout.id === campaign.shownTarget.id) {
        throw createUserError(409, "Clear this handout from the Player Display before renaming it.");
      }

      handout.name = displayName;
      return findHandout(saveCampaign(campaign), handoutId);
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
      return this.setShownTarget(campaignId, mapId === null ? null : { id: mapId, type: "encounter" });
    },
    setShownTarget(campaignId, target) {
      const campaign = readCampaign(campaignId);

      if (target === null) {
        campaign.shownTarget = null;
        campaign.activeMapId = null;
        return saveCampaign(campaign);
      }

      if (!target || typeof target !== "object" || Array.isArray(target)) {
        throw createUserError(400, "Shown target must be an object or null.");
      }

      if (target.type === "encounter") {
        const map = findMap(campaign, target.id);
        assertMapAssetAvailable(campaignId, map);
        campaign.shownTarget = { id: map.id, type: "encounter" };
        campaign.activeMapId = map.id;
        return saveCampaign(campaign);
      }

      if (target.type === "handout") {
        const handout = findHandout(campaign, target.id);
        assertHandoutAssetAvailable(campaignId, handout);
        campaign.shownTarget = { id: handout.id, rotation: 0, type: "handout" };
        campaign.activeMapId = null;
        return saveCampaign(campaign);
      }

      throw createUserError(400, "Shown target type must be encounter or handout.");
    },
    rotateShownHandout(campaignId, direction) {
      if (!Object.hasOwn(rotationDelta, direction)) {
        throw createUserError(400, "Shown handout rotation direction must be left or right.");
      }

      const campaign = readCampaign(campaignId);

      if (campaign.shownTarget?.type !== "handout") {
        throw createUserError(409, "Rotate a shown handout before changing handout rotation.");
      }

      const currentRotation = campaign.shownTarget.rotation || 0;
      campaign.shownTarget = {
        ...campaign.shownTarget,
        rotation: (currentRotation + rotationDelta[direction] + 360) % 360
      };
      campaign.activeMapId = null;
      return saveCampaign(campaign);
    },
    setMapFog(campaignId, mapId, operations) {
      const campaign = readCampaign(campaignId);
      const map = findMap(campaign, mapId);

      map.fog = normalizeFogOperations(operations);
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
