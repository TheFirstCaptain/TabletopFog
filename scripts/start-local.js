"use strict";

const { createTabletopFogServer } = require("../server");
const { certPath, ensureCertificate, getLanIps, unique } = require("./create-dev-cert");

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

function getPort(env = process.env) {
  return Number(env.PORT || 3000);
}

function getHost(env = process.env) {
  return env.HOST || "0.0.0.0";
}

function getUsableLanIps(lanIps) {
  return unique(lanIps).filter((ip) => ip && ip !== "127.0.0.1");
}

function buildStartupDetails(options = {}) {
  const port = options.port || getPort(options.env);
  const host = options.host || getHost(options.env);
  const lanIps = getUsableLanIps(options.lanIps || []);
  const playerUrls = lanIps.map((ip) => `https://${ip}:${port}/player`);

  return {
    certPath: options.certPath || certPath,
    certStatus: options.certStatus || "unknown",
    gmUrl: `https://localhost:${port}/gm`,
    host,
    lanIps,
    listenUrl: `https://${host}:${port}`,
    playerUrls,
    port
  };
}

function formatStartupOutput(details) {
  const lines = [
    "TabletopFog local startup",
    `Listening on: ${details.listenUrl}`,
    `GM view: ${details.gmUrl}`
  ];

  if (details.playerUrls.length) {
    lines.push("Player view:");

    for (const url of details.playerUrls) {
      lines.push(`  ${url}`);
    }
  } else {
    lines.push("Player view: no LAN IP detected; find the GM device Wi-Fi IP and use https://<LAN-IP>:3000/player.");
  }

  lines.push(`Certificate to install/trust on iPhone or iPad: ${details.certPath}`);
  lines.push(`Certificate status: ${details.certStatus}`);
  lines.push("Chromebook: enable ChromeOS Linux port forwarding for TCP port 3000 if the iPad cannot connect.");
  lines.push("Chromebook-local URLs may need https://localhost:3000/gm or https://penguin.linux.test:3000/gm.");

  return lines.join("\n");
}

function prepareLocalCertificate(options = {}) {
  const lanIps = getUsableLanIps([...(options.ips || []), ...getLanIps()]);
  const certificate = ensureCertificate(lanIps, {
    stdio: "pipe"
  });

  return {
    certPath: certificate.certPath,
    certStatus: certificate.status,
    lanIps
  };
}

function startLocal(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const args = parseArgs(options.argv || []);
  const prepareCertificate =
    options.prepareCertificate ||
    (() =>
      prepareLocalCertificate({
        ips: args.ips
      }));
  const prepared = options.lanIps
    ? {
        certPath: options.certPath,
        certStatus: options.certStatus,
        lanIps: options.lanIps
      }
    : prepareCertificate();
  const details = buildStartupDetails({
    certPath: prepared.certPath || options.certPath,
    certStatus: prepared.certStatus || options.certStatus,
    env,
    host: options.host,
    lanIps: prepared.lanIps,
    port: options.port
  });
  const { server } = (options.createServer || createTabletopFogServer)();

  server.listen(details.port, details.host, () => {
    logger.log(formatStartupOutput(details));
  });

  return {
    details,
    server
  };
}

function main() {
  startLocal({
    argv: process.argv.slice(2)
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  buildStartupDetails,
  formatStartupOutput,
  getHost,
  getPort,
  getUsableLanIps,
  main,
  parseArgs,
  prepareLocalCertificate,
  startLocal
};
