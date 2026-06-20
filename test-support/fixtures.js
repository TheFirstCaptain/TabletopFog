"use strict";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
const GIF_BYTES = Buffer.from("GIF89a;", "ascii");
const WEBP_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

const VALID_MAP_IMAGES = [
  { bytes: PNG_BYTES, contentType: "image/png", fileName: "map.png", type: "PNG" },
  { bytes: JPEG_BYTES, contentType: "image/jpeg", fileName: "map.jpeg", type: "JPEG" },
  { bytes: GIF_BYTES, contentType: "image/gif", fileName: "map.gif", type: "GIF" },
  { bytes: WEBP_BYTES, contentType: "image/webp", fileName: "map.webp", type: "WebP" }
];

function createOversizedMapBytes(maxBytes) {
  return Buffer.alloc(maxBytes + 1);
}

module.exports = {
  createOversizedMapBytes,
  GIF_BYTES,
  JPEG_BYTES,
  PNG_BYTES,
  VALID_MAP_IMAGES,
  WEBP_BYTES
};
