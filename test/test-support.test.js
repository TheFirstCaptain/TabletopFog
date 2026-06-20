"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createTemporaryDirectory } = require("../test-support/temp-directory");

test("temporary-directory helper registers recursive idempotent cleanup", () => {
  const cleanups = [];
  const directory = createTemporaryDirectory(
    {
      after(cleanup) {
        cleanups.push(cleanup);
      }
    },
    "tabletopfog-helper-test-"
  );

  try {
    const nested = path.join(directory, "nested");
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, "artifact.txt"), "temporary");

    assert.equal(cleanups.length, 1);
    cleanups[0]();
    assert.equal(fs.existsSync(directory), false);
    assert.doesNotThrow(cleanups[0]);
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});
