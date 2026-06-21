"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { runWithIsolatedApp } = require("../browser-test/fixtures");

function resource(cleanups, name) {
  return {
    cleanup() {
      cleanups.push(name);
    },
    directory: `/${name}`
  };
}

test("browser fixture cleans campaign data when certificate setup fails", async () => {
  const cleanups = [];

  await assert.rejects(
    runWithIsolatedApp(() => {}, {
      createCampaignData: () => resource(cleanups, "campaign"),
      createCertificate: () => {
        throw new Error("certificate setup failed");
      }
    }),
    /certificate setup failed/
  );

  assert.deepEqual(cleanups, ["campaign"]);
});

test("browser fixture cleans all temporary resources when server setup fails", async () => {
  const cleanups = [];

  await assert.rejects(
    runWithIsolatedApp(() => {}, {
      createCampaignData: () => resource(cleanups, "campaign"),
      createCertificate: () => resource(cleanups, "certificate"),
      createServer: () => {
        throw new Error("server setup failed");
      }
    }),
    /server setup failed/
  );

  assert.deepEqual(cleanups, ["certificate", "campaign"]);
});

test("browser fixture cleans temporary resources when server shutdown fails", async () => {
  const cleanups = [];

  await assert.rejects(
    runWithIsolatedApp(() => {}, {
      closeServer: async () => {
        throw new Error("server shutdown failed");
      },
      createCampaignData: () => resource(cleanups, "campaign"),
      createCertificate: () => resource(cleanups, "certificate"),
      createServer: () => ({ io: {}, server: {} }),
      listenServer: async () => 4321
    }),
    /server shutdown failed/
  );

  assert.deepEqual(cleanups, ["certificate", "campaign"]);
});
