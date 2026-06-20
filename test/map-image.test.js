"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { MAX_MAP_FILE_BYTES, detectMapImageType, validateMapImage } = require("../server/map-image");
const { createOversizedMapBytes, PNG_BYTES, VALID_MAP_IMAGES } = require("../test-support/fixtures");

test("accepts supported map image signatures with matching metadata", () => {
  const expectedTypes = ["png", "jpeg", "gif", "webp"];

  VALID_MAP_IMAGES.forEach((fixture, index) => {
    assert.equal(detectMapImageType(fixture.bytes), expectedTypes[index], fixture.type);
    assert.doesNotThrow(
      () => validateMapImage(fixture.bytes, `${fixture.contentType}; charset=binary`, fixture.fileName),
      fixture.type
    );
  });
});

test("rejects empty, arbitrary, and oversized map data with client errors", () => {
  const cases = [
    { bytes: Buffer.alloc(0), message: /empty/, statusCode: 400 },
    { bytes: Buffer.from("not-an-image"), message: /supported map image/, statusCode: 400 },
    { bytes: createOversizedMapBytes(MAX_MAP_FILE_BYTES), message: /100 MB limit/, statusCode: 413 }
  ];

  cases.forEach(({ bytes, message, statusCode }) => {
    assert.throws(
      () => validateMapImage(bytes, "image/png", "map.png"),
      (error) => error.statusCode === statusCode && message.test(error.message)
    );
  });
});

test("rejects extension and content-type mismatches for every supported image signature", () => {
  VALID_MAP_IMAGES.forEach((fixture) => {
    const wrongFileName = fixture.fileName.endsWith(".png") ? "map.jpg" : "map.png";
    const wrongContentType = fixture.contentType === "image/png" ? "image/jpeg" : "image/png";

    assert.throws(
      () => validateMapImage(fixture.bytes, fixture.contentType, wrongFileName),
      /must match its image data/,
      `${fixture.type} extension mismatch`
    );
    assert.throws(
      () => validateMapImage(fixture.bytes, wrongContentType, fixture.fileName),
      /must match its image data/,
      `${fixture.type} content-type mismatch`
    );
  });

  assert.doesNotThrow(() => validateMapImage(PNG_BYTES, "image/png", "map.png"));
});
