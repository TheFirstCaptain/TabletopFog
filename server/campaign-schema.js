"use strict";

const CAMPAIGN_EXTRA_FIELDS = Symbol("campaignExtraFields");
const MAP_EXTRA_FIELDS = Symbol("mapExtraFields");
const MAX_CAMPAIGN_DESCRIPTION_LENGTH = 160;
const MAX_CAMPAIGN_ICON_LENGTH = 4;
const FOG_OPERATION_TYPES = new Set(["hide-rectangle", "reveal-rectangle"]);
const campaignFields = new Set(["version", "name", "description", "icon", "activeMapId", "maps"]);
const mapFields = new Set(["id", "name", "originalFileName", "file", "order", "fog"]);
const metadataFields = new Set(["description", "icon", "name"]);

function normalizePathSegment(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9 _-]+/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[ ._-]+|[ ._-]+$/g, "");
}

function normalizeExtension(extension) {
  const safe = String(extension || "").replace(/[^A-Za-z0-9.]/g, "");

  if (!/^\.[A-Za-z0-9]+$/.test(safe)) {
    return "";
  }

  return safe;
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

function normalizeFogOperations(operations) {
  if (!Array.isArray(operations)) {
    throw new Error("Invalid fog operation list.");
  }

  return operations.map((operation) => {
    const rect = operation?.rect || {};
    const normalized = {
      ...operation,
      type: operation?.type,
      rect: {
        ...rect,
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y
      }
    };

    if (!FOG_OPERATION_TYPES.has(normalized.type) || !isValidRect(normalized.rect)) {
      throw new Error("Invalid fog operation.");
    }

    return normalized;
  });
}

function normalizeFogOperation(operation) {
  return normalizeFogOperations([operation])[0];
}

function isValidRect(rect) {
  const values = [rect.x, rect.y, rect.width, rect.height];
  return (
    values.every(Number.isFinite) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= 1 &&
    rect.y + rect.height <= 1
  );
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
      fog: Array.isArray(map.fog) ? normalizeFogOperations(map.fog) : []
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
    description: typeof rawCampaign.description === "string" ? rawCampaign.description : "",
    icon: typeof rawCampaign.icon === "string" ? rawCampaign.icon : "",
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
    ...(campaign.description ? { description: campaign.description } : {}),
    ...(campaign.icon ? { icon: campaign.icon } : {}),
    activeMapId: campaign.activeMapId || null,
    maps: campaign.maps.map((map) => ({
      ...(map[MAP_EXTRA_FIELDS] || {}),
      id: map.id,
      name: map.name,
      ...(map.originalFileName ? { originalFileName: map.originalFileName } : {}),
      file: map.file,
      order: map.order,
      fog: normalizeFogOperations(map.fog || [])
    }))
  };
}

function normalizeCampaignName(value) {
  if (typeof value !== "string") {
    throw createUserError(400, "Campaign name must be text.");
  }

  const name = value.trim();

  if (!normalizePathSegment(name)) {
    throw createUserError(400, "A valid campaign name is required.");
  }

  return name;
}

function normalizeCampaignDescription(value) {
  if (typeof value !== "string") {
    throw createUserError(400, "Campaign description must be text.");
  }

  const description = value.trim();

  if (description.length > MAX_CAMPAIGN_DESCRIPTION_LENGTH) {
    throw createUserError(400, `Campaign description must be ${MAX_CAMPAIGN_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  return description;
}

function normalizeCampaignIcon(value) {
  if (typeof value !== "string") {
    throw createUserError(400, "Campaign icon must be text.");
  }

  const icon = value.trim();

  if (Array.from(icon).length > MAX_CAMPAIGN_ICON_LENGTH) {
    throw createUserError(400, "Campaign icon must be one emoji or short symbol.");
  }

  return icon;
}

function validateCampaignMetadataPatch(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw createUserError(400, "Campaign metadata must be an object.");
  }

  if (!Object.hasOwn(metadata, "description") && !Object.hasOwn(metadata, "icon") && !Object.hasOwn(metadata, "name")) {
    throw createUserError(400, "Campaign metadata must include name, description, or icon.");
  }

  Object.keys(metadata).forEach((key) => {
    if (!metadataFields.has(key)) {
      throw createUserError(400, "Campaign metadata must include only name, description, or icon.");
    }
  });
}

function createUserError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  MAX_CAMPAIGN_DESCRIPTION_LENGTH,
  createUserError,
  displayNameFromFileName,
  normalizeCampaign,
  normalizeCampaignDescription,
  normalizeFogOperation,
  normalizeFogOperations,
  normalizeCampaignIcon,
  normalizeCampaignName,
  normalizeFileName,
  normalizePathSegment,
  serializeCampaign,
  splitFileName,
  validateCampaignMetadataPatch
};
