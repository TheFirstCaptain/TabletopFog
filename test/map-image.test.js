"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { validateMapImage } = require("../server/map-image");
const { PNG_BYTES } = require("../test-support/fixtures");

test("accepts supported map image signatures with matching metadata", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
  const gif = Buffer.from("GIF89a;");
  const webp = Buffer.alloc(12);
  webp.write("RIFF", 0, "ascii");
  webp.writeUInt32LE(4, 4);
  webp.write("WEBP", 8, "ascii");

  assert.doesNotThrow(() => validateMapImage(PNG_BYTES, "image/png", "map.png"));
  assert.doesNotThrow(() => validateMapImage(jpeg, "image/jpeg", "map.jpeg"));
  assert.doesNotThrow(() => validateMapImage(gif, "image/gif", "map.gif"));
  assert.doesNotThrow(() => validateMapImage(webp, "image/webp", "map.webp"));
});
