"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const certDir = path.join(projectRoot, "certs");
const keyPath = path.join(certDir, "dev-key.pem");
const certPath = path.join(certDir, "dev-cert.pem");

function parseArgs(argv) {
  const args = {
    ips: []
  };

  for (const arg of argv) {
    if (arg.startsWith("--ip=")) {
      args.ips.push(arg.slice("--ip=".length));
    }
  }

  return args;
}

function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        ips.push(entry.address);
      }
    }
  }

  return ips;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ensureOpenSsl() {
  const result = spawnSync("openssl", ["version"], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error("OpenSSL is required to generate the development certificate.");
  }
}

function writeOpenSslConfig(configPath, ips) {
  const altNames = [
    "DNS.1 = localhost",
    "IP.1 = 127.0.0.1",
    ...ips.map((ip, index) => `IP.${index + 2} = ${ip}`)
  ].join("\n");

  fs.writeFileSync(
    configPath,
    [
      "[req]",
      "default_bits = 2048",
      "prompt = no",
      "default_md = sha256",
      "distinguished_name = dn",
      "x509_extensions = v3_req",
      "",
      "[dn]",
      "CN = TabletopFog Development",
      "",
      "[v3_req]",
      "subjectAltName = @alt_names",
      "basicConstraints = critical,CA:TRUE",
      "keyUsage = critical,digitalSignature,keyEncipherment,keyCertSign",
      "extendedKeyUsage = serverAuth",
      "",
      "[alt_names]",
      altNames,
      ""
    ].join("\n")
  );
}

function createCert(ips) {
  fs.mkdirSync(certDir, { recursive: true });
  const configPath = path.join(certDir, "dev-openssl.cnf");
  writeOpenSslConfig(configPath, ips);

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
      "30",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-config",
      configPath
    ],
    {
      encoding: "utf8",
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error("OpenSSL failed to generate the development certificate.");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ips = unique([...args.ips, ...getLanIps()]).filter((ip) => ip !== "127.0.0.1");

  ensureOpenSsl();
  createCert(ips);

  console.log(`Created ${keyPath}`);
  console.log(`Created ${certPath}`);
  console.log("Included SANs: localhost, 127.0.0.1" + (ips.length ? `, ${ips.join(", ")}` : ""));
  console.log("Regenerate this certificate after switching Wi-Fi networks if the LAN IP changes.");
}

main();
