"use strict";

const { test: base, expect } = require("@playwright/test");

const { createTabletopFogServer } = require("../server");
const { createTestCertificateResource } = require("../test-support/certificate");
const { createTemporaryDirectoryResource } = require("../test-support/temp-directory");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server, io) {
  return new Promise((resolve) => {
    io.close(() => {
      if (server.listening) {
        server.close(resolve);
        return;
      }
      resolve();
    });
  });
}

async function runWithIsolatedApp(use, options = {}) {
  const dependencies = {
    closeServer: close,
    createCampaignData: () => createTemporaryDirectoryResource("tabletopfog-browser-data-"),
    createCertificate: createTestCertificateResource,
    createServer: createTabletopFogServer,
    listenServer: listen,
    ...options
  };
  let campaignData;
  let certificate;
  let serverBundle;
  let failure;

  try {
    campaignData = dependencies.createCampaignData();
    certificate = dependencies.createCertificate();
    serverBundle = dependencies.createServer({
      credentials: certificate,
      dataRoot: campaignData.directory
    });
    const port = await dependencies.listenServer(serverBundle.server);
    await use({
      baseURL: `https://127.0.0.1:${port}`,
      dataRoot: campaignData.directory,
      seedFogOperations(campaignId, mapId, operations) {
        serverBundle.stateStore.setFogOperations(campaignId, mapId, operations);
        serverBundle.syncState();
      }
    });
  } catch (error) {
    failure = error;
  } finally {
    if (serverBundle) {
      try {
        await dependencies.closeServer(serverBundle.server, serverBundle.io);
      } catch (error) {
        failure ||= error;
      }
    }

    try {
      certificate?.cleanup();
    } catch (error) {
      failure ||= error;
    }

    try {
      campaignData?.cleanup();
    } catch (error) {
      failure ||= error;
    }
  }

  if (failure) {
    throw failure;
  }
}

const test = base.extend({
  // Playwright requires fixture dependencies to use an object pattern.
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, use) => runWithIsolatedApp(use)
});

module.exports = { expect, runWithIsolatedApp, test };
