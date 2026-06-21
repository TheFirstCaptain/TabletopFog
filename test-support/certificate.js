"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { createTemporaryDirectoryResource } = require("./temp-directory");

function createTestCertificate(testContext, options = {}) {
  if (!testContext || typeof testContext.after !== "function") {
    throw new TypeError("A Node test context is required for certificate cleanup.");
  }

  const resource = createTestCertificateResource(options);
  testContext.after(resource.cleanup);
  return resource;
}

function createTestCertificateResource(options = {}) {
  const { cleanup, directory } = createTemporaryDirectoryResource("tabletopfog-test-cert-");
  const keyPath = path.join(directory, "key.pem");
  const certPath = path.join(directory, "cert.pem");
  const configPath = path.join(directory, "openssl.cnf");
  const ips = options.ips || ["127.0.0.1"];
  const ipLines = ips.map((ip, index) => `IP.${index + 1} = ${ip}`);

  try {
    fs.writeFileSync(
      configPath,
      [
        "[req]",
        "prompt = no",
        "distinguished_name = dn",
        "x509_extensions = v3_req",
        "",
        "[dn]",
        "CN = TabletopFog Test",
        "",
        "[v3_req]",
        "subjectAltName = @alt_names",
        "",
        "[alt_names]",
        "DNS.1 = localhost",
        ...ipLines,
        ""
      ].join("\n")
    );

    const result = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-sha256",
        "-days",
        "2",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-config",
        configPath
      ],
      { encoding: "utf8" }
    );

    if (result.status !== 0) {
      throw new Error(`OpenSSL failed: ${result.stderr}`);
    }

    return {
      cert: fs.readFileSync(certPath),
      certPath,
      cleanup,
      key: fs.readFileSync(keyPath),
      keyPath
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

module.exports = {
  createTestCertificate,
  createTestCertificateResource
};
