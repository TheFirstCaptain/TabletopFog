"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { validateMapImage } = require("./map-image");

const CAMPAIGN_EXTRA_FIELDS = Symbol("campaignExtraFields");
const MAP_EXTRA_FIELDS = Symbol("mapExtraFields");
const campaignFields = new Set(["version", "name", "activeMapId", "maps"]);
const mapFields = new Set(["id", "name", "originalFileName", "file", "order", "fog"]);

function getDefaultDataRoot(env = process.env) {
  return env.TABLETOPFOG_DATA_DIR || path.join(os.homedir(), "TabletopFog", "tabletopfog-data");
}

function normalizePathSegment(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9 _-]+/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[ ._-]+|[ ._-]+$/g, "");
}

function splitFileName(fileName) {
  const normalizedSeparators = String(fileName || "").replace(/[\\/]+/g, "-");
  const lastDot = normalizedSeparators.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === normalizedSeparators.length - 1) {
    return {
      extension: "",
      name: normalizedSeparators
    };
  }

  return {
    extension: normalizeExtension(normalizedSeparators.slice(lastDot)),
    name: normalizedSeparators.slice(0, lastDot)
  };
}

function normalizeExtension(extension) {
  const safe = String(extension || "").replace(/[^A-Za-z0-9.]/g, "");

  if (!/^\.[A-Za-z0-9]+$/.test(safe)) {
    return "";
  }

  return safe;
}

function normalizeFileName(fileName) {
  const { extension, name } = splitFileName(fileName);
  const safeName = normalizePathSegment(name);

  return safeName ? `${safeName}${extension}` : "";
}

function displayNameFromFileName(fileName) {
  const { name } = splitFileName(fileName);
  return String(name || "").replace(/^[ ._-]+|[ ._-]+$/g, "") || normalizePathSegment(fileName);
}

function collectExtraFields(value, knownFields) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !knownFields.has(key)));
}

function createCampaignStorage(options = {}) {
  const dataRoot = path.resolve(options.dataRoot || getDefaultDataRoot(options.env));

  function ensureDataRoot() {
    fs.mkdirSync(dataRoot, { recursive: true });
  }

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

  function normalizeCampaign(campaignId, rawCampaign) {
    const sourceMaps = Array.isArray(rawCampaign.maps) ? rawCampaign.maps : [];
    const decorated = sourceMaps.map((map, index) => ({
      map,
      index,
      order: Number.isInteger(map.order) && map.order > 0 ? map.order : index + 1
    }));

    decorated.sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.index - right.index;
    });

    const maps = decorated.map(({ map }, index) => {
      const normalizedMap = {
        id: String(map.id || normalizePathSegment(map.name || `map-${index + 1}`)),
        name: String(map.name || map.originalFileName || `Map ${index + 1}`),
        originalFileName: map.originalFileName ? String(map.originalFileName) : undefined,
        file: String(map.file || ""),
        order: index + 1,
        fog: Array.isArray(map.fog) ? map.fog : []
      };

      Object.defineProperty(normalizedMap, MAP_EXTRA_FIELDS, {
        enumerable: true,
        value: collectExtraFields(map, mapFields)
      });
      return normalizedMap;
    });

    const campaign = {
      version: Number.isInteger(rawCampaign.version) ? rawCampaign.version : 1,
      id: campaignId,
      name: String(rawCampaign.name || campaignId),
      activeMapId: rawCampaign.activeMapId || null,
      maps
    };

    Object.defineProperty(campaign, CAMPAIGN_EXTRA_FIELDS, {
      enumerable: true,
      value: collectExtraFields(rawCampaign, campaignFields)
    });

    if (campaign.activeMapId && !campaign.maps.some((map) => map.id === campaign.activeMapId)) {
      campaign.activeMapId = null;
    }

    return campaign;
  }

  function serializeCampaign(campaign) {
    return {
      ...(campaign[CAMPAIGN_EXTRA_FIELDS] || {}),
      version: campaign.version || 1,
      name: campaign.name,
      activeMapId: campaign.activeMapId || null,
      maps: campaign.maps.map((map) => ({
        ...(map[MAP_EXTRA_FIELDS] || {}),
        id: map.id,
        name: map.name,
        ...(map.originalFileName ? { originalFileName: map.originalFileName } : {}),
        file: map.file,
        order: map.order,
        fog: map.fog || []
      }))
    };
  }

  function readCampaign(campaignId) {
    assertCampaignExists(campaignId);
    const raw = JSON.parse(fs.readFileSync(campaignJsonPath(campaignId), "utf8"));
    return normalizeCampaign(campaignId, raw);
  }

  function saveCampaign(campaign) {
    campaign.maps = campaign.maps.map((map, index) => ({
      ...map,
      order: index + 1,
      fog: Array.isArray(map.fog) ? map.fog : []
    }));

    writeJsonAtomic(campaignJsonPath(campaign.id), serializeCampaign(campaign));
    return normalizeCampaign(campaign.id, serializeCampaign(campaign));
  }

  function existingNames(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return new Set();
    }

    return new Set(fs.readdirSync(dirPath).map((entry) => entry.toLowerCase()));
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

      fs.mkdirSync(mapsDir(campaignId), { recursive: true });
      const storedFileName = uniqueName(safeFileName, existingNames(mapsDir(campaignId)));
      const storedPath = path.join(mapsDir(campaignId), storedFileName);
      const mapId = uniqueName(splitFileName(storedFileName).name, new Set(campaign.maps.map((map) => map.id.toLowerCase())));
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
      ensureDataRoot();
      const safeName = normalizePathSegment(name);

      if (!safeName) {
        throw createUserError(400, "A valid campaign name is required.");
      }

      const taken = existingNames(dataRoot);

      if (taken.has(safeName.toLowerCase())) {
        throw createUserError(409, "Campaign already exists.");
      }

      const dir = campaignDir(safeName);

      try {
        fs.mkdirSync(path.join(dir, "maps"), { recursive: true });
        const campaign = {
          version: 1,
          id: safeName,
          name: String(name).trim(),
          activeMapId: null,
          maps: []
        };
        writeJsonAtomic(campaignJsonPath(safeName), serializeCampaign(campaign));
        return campaign;
      } catch (error) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw error;
      }
    },
    getCampaign(campaignId) {
      return readCampaign(campaignId);
    },
    getMapAsset(campaignId, mapId) {
      const campaign = readCampaign(campaignId);
      const map = findMap(campaign, mapId);
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

      return {
        filePath: realAssetPath,
        map
      };
    },
    listCampaigns() {
      ensureDataRoot();

      return fs
        .readdirSync(dataRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          try {
            const campaign = readCampaign(entry.name);
            const activeMap = campaign.maps.find((map) => map.id === campaign.activeMapId);

            return {
              id: campaign.id,
              name: campaign.name,
              activeMapName: activeMap ? activeMap.name : null,
              mapCount: campaign.maps.length
            };
          } catch (_error) {
            return null;
          }
        })
        .filter(Boolean)
        .sort((left, right) => left.name.localeCompare(right.name));
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
      findMap(campaign, mapId);
      campaign.activeMapId = mapId;
      return saveCampaign(campaign);
    }
  };
}

function createUserError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  createCampaignStorage,
  createUserError,
  getDefaultDataRoot,
  normalizeFileName,
  normalizePathSegment
};
