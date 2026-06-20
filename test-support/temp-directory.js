"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function removeTemporaryDirectory(directory) {
  fs.rmSync(directory, { force: true, recursive: true });
}

function createTemporaryDirectory(testContext, prefix) {
  if (!testContext || typeof testContext.after !== "function") {
    throw new TypeError("A Node test context is required for temporary-directory cleanup.");
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  testContext.after(() => removeTemporaryDirectory(directory));
  return directory;
}

module.exports = {
  createTemporaryDirectory,
  removeTemporaryDirectory
};
