"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildStartupDetails,
  formatStartupOutput,
  getUsableLanIps,
  parseArgs,
  startLocal
} = require("../scripts/start-local");

test("local startup details include GM and LAN player URLs", () => {
  const details = buildStartupDetails({
    certPath: "/tmp/dev-cert.pem",
    certStatus: "reused",
    env: {},
    lanIps: ["192.168.7.57", "127.0.0.1", "192.168.7.57"],
    port: 3000
  });

  assert.equal(details.gmUrl, "https://localhost:3000/gm");
  assert.deepEqual(details.playerUrls, ["https://192.168.7.57:3000/player"]);
  assert.equal(details.certPath, "/tmp/dev-cert.pem");
  assert.equal(details.certStatus, "reused");
});

test("local startup output prints URLs, certificate path, and Chromebook notes", () => {
  const output = formatStartupOutput(
    buildStartupDetails({
      certPath: "/tmp/dev-cert.pem",
      env: {},
      lanIps: ["192.168.7.57"],
      port: 3000
    })
  );

  assert.match(output, /GM view: https:\/\/localhost:3000\/gm/);
  assert.match(output, /https:\/\/192\.168\.7\.57:3000\/player/);
  assert.match(output, /Certificate to install\/trust on iPhone or iPad: \/tmp\/dev-cert\.pem/);
  assert.match(output, /Certificate status: unknown/);
  assert.match(output, /ChromeOS Linux port forwarding for TCP port 3000/);
  assert.match(output, /penguin\.linux\.test/);
});

test("local startup output gives a manual player URL step when no LAN IP is detected", () => {
  const output = formatStartupOutput(
    buildStartupDetails({
      env: {},
      lanIps: [],
      port: 3000
    })
  );

  assert.match(output, /no LAN IP detected/);
  assert.match(output, /https:\/\/<LAN-IP>:3000\/player/);
});

test("usable LAN IPs exclude loopback and duplicates", () => {
  assert.deepEqual(getUsableLanIps(["127.0.0.1", "192.168.1.20", "192.168.1.20"]), ["192.168.1.20"]);
});

test("local startup parses explicit IP overrides", () => {
  assert.deepEqual(parseArgs(["--ip=192.168.1.20", "--ignored", "--ip=10.0.0.25"]), {
    ips: ["192.168.1.20", "10.0.0.25"]
  });
});

test("startLocal prepares the certificate before listening", () => {
  const events = [];
  const fakeServer = {
    listen(port, host, callback) {
      events.push(["listen", port, host]);
      callback();
    }
  };
  const logs = [];

  const result = startLocal({
    createServer: () => {
      events.push(["createServer"]);
      return { server: fakeServer };
    },
    env: {},
    logger: {
      log(message) {
        logs.push(message);
      }
    },
    prepareCertificate: () => {
      events.push(["prepareCertificate"]);
      return {
        certPath: "/tmp/dev-cert.pem",
        certStatus: "reused",
        lanIps: ["192.168.1.20"]
      };
    },
    port: 3000
  });

  assert.equal(result.server, fakeServer);
  assert.deepEqual(events, [["prepareCertificate"], ["createServer"], ["listen", 3000, "0.0.0.0"]]);
  assert.match(logs.join("\n"), /https:\/\/192\.168\.1\.20:3000\/player/);
});
