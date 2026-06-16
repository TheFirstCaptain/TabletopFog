"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { certificateNeedsRegeneration, unique } = require("../scripts/create-dev-cert");

test("certificate regeneration is required when cert or key files are missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletopfog-cert-test-"));

  assert.equal(
    certificateNeedsRegeneration({
      certPath: path.join(dir, "missing-cert.pem"),
      keyPath: path.join(dir, "missing-key.pem"),
      ips: ["192.168.1.20"]
    }),
    true
  );
});

test("unique removes duplicate and empty values", () => {
  assert.deepEqual(unique(["192.168.1.20", "", "192.168.1.20", undefined, "10.0.0.2"]), [
    "192.168.1.20",
    "10.0.0.2"
  ]);
});
