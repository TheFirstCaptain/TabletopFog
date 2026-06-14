"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const defaultKeyPath = path.join(projectRoot, "certs", "dev-key.pem");
const defaultCertPath = path.join(projectRoot, "certs", "dev-cert.pem");

function resolveCertPaths(env = process.env) {
  return {
    keyPath: env.TABLETOPFOG_HTTPS_KEY || defaultKeyPath,
    certPath: env.TABLETOPFOG_HTTPS_CERT || defaultCertPath
  };
}

function loadHttpsCredentials(env = process.env) {
  const { keyPath, certPath } = resolveCertPaths(env);

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(
      [
        "Missing HTTPS development certificate files.",
        `Expected key: ${keyPath}`,
        `Expected cert: ${certPath}`,
        "Run: npm run cert -- --ip=<LAN-IP>"
      ].join("\n")
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

module.exports = {
  defaultCertPath,
  defaultKeyPath,
  loadHttpsCredentials,
  resolveCertPaths
};
