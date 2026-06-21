"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { certificateNeedsRegeneration, unique } = require("../scripts/create-dev-cert");
const { createTestCertificate, createTestCertificateResource } = require("../test-support/certificate");
const { createTemporaryDirectory } = require("../test-support/temp-directory");

test("test certificate resource exposes explicit cleanup", () => {
  const resource = createTestCertificateResource();

  assert.ok(resource.cert.length > 0);
  assert.ok(resource.key.length > 0);
  assert.equal(fs.existsSync(resource.certPath), true);

  resource.cleanup();
  assert.equal(fs.existsSync(resource.certPath), false);
  assert.doesNotThrow(resource.cleanup);
});

test("certificate regeneration is required when cert or key files are missing", (t) => {
  const dir = createTemporaryDirectory(t, "tabletopfog-cert-test-");

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
  assert.deepEqual(unique(["192.168.1.20", "", "192.168.1.20", undefined, "10.0.0.2"]), ["192.168.1.20", "10.0.0.2"]);
});

test("certificate regeneration distinguishes valid, malformed, and missing-SAN certificates", (t) => {
  const valid = createTestCertificate(t, { ips: ["127.0.0.1"] });

  assert.equal(
    certificateNeedsRegeneration({
      certPath: valid.certPath,
      ips: ["127.0.0.1"],
      keyPath: valid.keyPath
    }),
    false
  );
  assert.equal(
    certificateNeedsRegeneration({
      certPath: valid.certPath,
      ips: ["192.168.1.20"],
      keyPath: valid.keyPath
    }),
    true
  );

  const malformedDirectory = createTemporaryDirectory(t, "tabletopfog-malformed-cert-");
  const malformedCertPath = path.join(malformedDirectory, "cert.pem");
  const malformedKeyPath = path.join(malformedDirectory, "key.pem");
  fs.writeFileSync(malformedCertPath, "not-a-certificate");
  fs.writeFileSync(malformedKeyPath, "not-a-key");

  assert.equal(
    certificateNeedsRegeneration({
      certPath: malformedCertPath,
      ips: ["127.0.0.1"],
      keyPath: malformedKeyPath
    }),
    true
  );
});
