"use strict";

const path = require("node:path");

const MAX_MAP_FILE_BYTES = 100 * 1024 * 1024;
const mapImageFormats = {
  gif: { extensions: [".gif"], mimeType: "image/gif" },
  jpeg: { extensions: [".jpg", ".jpeg"], mimeType: "image/jpeg" },
  png: { extensions: [".png"], mimeType: "image/png" },
  webp: { extensions: [".webp"], mimeType: "image/webp" }
};

function hasBytes(content, offset, expected) {
  return expected.every((value, index) => content[offset + index] === value);
}

function detectMapImageType(content) {
  if (
    content.length >= 20 &&
    hasBytes(content, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    hasBytes(content, content.length - 12, [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44])
  ) {
    return "png";
  }

  if (
    content.length >= 4 &&
    hasBytes(content, 0, [0xff, 0xd8, 0xff]) &&
    hasBytes(content, content.length - 2, [0xff, 0xd9])
  ) {
    return "jpeg";
  }

  if (
    content.length >= 7 &&
    ["GIF87a", "GIF89a"].includes(content.subarray(0, 6).toString("ascii")) &&
    content[content.length - 1] === 0x3b
  ) {
    return "gif";
  }

  if (
    content.length >= 12 &&
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP" &&
    content.readUInt32LE(4) + 8 === content.length
  ) {
    return "webp";
  }

  return null;
}

function createMapImageError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateMapImage(content, contentType, fileName) {
  if (content.length === 0) {
    throw createMapImageError(400, "Map file is empty.");
  }

  if (content.length > MAX_MAP_FILE_BYTES) {
    throw createMapImageError(413, "Map file exceeds the 100 MB limit.");
  }

  const imageType = detectMapImageType(content);

  if (!imageType) {
    throw createMapImageError(400, "A supported map image is required (PNG, JPEG, GIF, or WebP).");
  }

  const format = mapImageFormats[imageType];
  const extension = path.extname(fileName).toLowerCase();
  const normalizedContentType = String(contentType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (!format.extensions.includes(extension) || normalizedContentType !== format.mimeType) {
    throw createMapImageError(400, "Map file extension and content type must match its image data.");
  }
}

module.exports = {
  MAX_MAP_FILE_BYTES,
  detectMapImageType,
  validateMapImage
};
