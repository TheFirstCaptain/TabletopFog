"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const test = require("node:test");

const { io: createClient } = require("socket.io-client");
const { createTabletopFogServer, getRoleFromReferer, projectStateForRole } = require("../server");
const { createTestCertificate } = require("../test-support/certificate");
const { PNG_BYTES } = require("../test-support/fixtures");
const { createTemporaryDirectory } = require("../test-support/temp-directory");

const EB_GARAMOND_LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

function getHttps(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: options.headers, rejectUnauthorized: false }, (response) => {
      const chunks = [];

      response.on("data", (chunk) => {
        chunks.push(chunk);
      });
      response.on("end", () => {
        const rawBody = Buffer.concat(chunks);

        resolve({
          body: rawBody.toString("utf8"),
          headers: response.headers,
          rawBody,
          statusCode: response.statusCode
        });
      });
    });

    request.on("error", (error) => {
      error.message = `${options.label || options.method || "GET"} ${url}: ${error.message}`;
      reject(error);
    });
  });
}

function requestHttps(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };

    if (options.body && !Object.hasOwn(headers, "content-length")) {
      headers["content-length"] = String(Buffer.byteLength(options.body));
    }

    const request = https.request(
      url,
      {
        headers,
        method: options.method || "GET",
        rejectUnauthorized: false
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");

          resolve({
            body,
            headers: response.headers,
            json: parseJsonBody(body, response.headers),
            statusCode: response.statusCode
          });
        });
      }
    );

    request.on("error", (error) => {
      error.message = `${options.label || options.method || "GET"} ${url}: ${error.message}`;
      reject(error);
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}

function parseJsonBody(body, headers) {
  if (!body || !String(headers["content-type"] || "").includes("application/json")) {
    return null;
  }

  return JSON.parse(body);
}

function createTempRoot(t) {
  return createTemporaryDirectory(t, "tabletopfog-server-data-");
}

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
    io.close();
    server.close(resolve);
  });
}

function waitForActiveMap(client, expectedMapId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for active map ${expectedMapId}`));
    }, 2000);

    client.on("state:sync", (state) => {
      if (
        (state.campaign && state.campaign.activeMapId === expectedMapId) ||
        (state.activeMap && state.activeMap.id === expectedMapId)
      ) {
        clearTimeout(timeout);
        resolve(state);
      }
    });
  });
}

function waitForActiveMapFogCount(client, expectedMapId, expectedCount) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for active map ${expectedMapId} with ${expectedCount} fog operations`));
    }, 2000);

    client.on("state:sync", (state) => {
      if (state.activeMap?.id === expectedMapId && state.activeMap.fogOperations?.length === expectedCount) {
        clearTimeout(timeout);
        resolve(state);
      }
    });
  });
}

function waitForNoActiveMap(client) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for no active map"));
    }, 2000);

    client.on("state:sync", (state) => {
      if (
        (state.campaign && state.campaign.activeMapId === null) ||
        (Object.hasOwn(state, "activeMap") && state.activeMap === null)
      ) {
        clearTimeout(timeout);
        resolve(state);
      }
    });
  });
}

function gmHeaders(port, extra = {}) {
  return {
    referer: `https://127.0.0.1:${port}/gm`,
    ...extra
  };
}

function playerHeaders(port, extra = {}) {
  return {
    referer: `https://127.0.0.1:${port}/player`,
    ...extra
  };
}

test("serves GM and player pages over HTTPS", async (t) => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot: createTempRoot(t)
  });
  const port = await listen(server);

  try {
    const gmResponse = await getHttps(`https://127.0.0.1:${port}/gm`);
    const playerResponse = await getHttps(`https://127.0.0.1:${port}/player`);
    const gmScript = await getHttps(`https://127.0.0.1:${port}/gm.js`);
    const gmState = await getHttps(`https://127.0.0.1:${port}/gm-state.js`);
    const gmView = await getHttps(`https://127.0.0.1:${port}/gm-view.js`);
    const styles = await getHttps(`https://127.0.0.1:${port}/styles.css`);
    const font = await getHttps(`https://127.0.0.1:${port}/assets/fonts/EBGaramond-Variable-Latin.woff2`);
    const fontLicense = await getHttps(`https://127.0.0.1:${port}/assets/fonts/OFL.txt`);
    const fontSource = await getHttps(`https://127.0.0.1:${port}/assets/fonts/SOURCE.md`);
    const supersededFont = await getHttps(`https://127.0.0.1:${port}/assets/fonts/Middleearth-ao6m.ttf`);

    assert.equal(gmResponse.statusCode, 200);
    assert.equal(playerResponse.statusCode, 200);
    assert.equal(gmScript.statusCode, 200);
    assert.equal(gmState.statusCode, 200);
    assert.equal(gmView.statusCode, 200);
    assert.equal(styles.statusCode, 200);
    assert.equal(font.statusCode, 200);
    assert.match(font.headers["content-type"], /^font\/woff2/);
    assert.equal(
      crypto.createHash("sha256").update(font.rawBody).digest("hex"),
      "79d17b52365a2d5bd8995c8c54939d384e9888ed2038c7201fd8d4118d6f0a35"
    );
    assert.equal(fontLicense.statusCode, 200);
    assert.match(fontLicense.body, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.equal(
      crypto.createHash("sha256").update(fontLicense.rawBody).digest("hex"),
      "0985066662eb755ed3683ae5482a81a9195b49ce3f7e165cc2388b3dbece7dd7"
    );
    assert.equal(fontSource.statusCode, 200);
    assert.match(fontSource.body, /79d17b52365a2d5bd8995c8c54939d384e9888ed2038c7201fd8d4118d6f0a35/);
    assert.ok(fontSource.body.includes(`- Unicode range: \`${EB_GARAMOND_LATIN_RANGE}\``));
    assert.equal(supersededFont.statusCode, 404);
    assert.match(gmResponse.body, /<h1 class="app-brand">TABLETOPFOG<\/h1>/);
    assert.doesNotMatch(gmResponse.body, /id="page-title"/);
    assert.match(gmResponse.body, /id="breadcrumb"/);
    assert.match(gmResponse.body, /id="library-diagnostics"/);
    assert.match(gmResponse.body, /<script type="module" src="\/gm\.js"><\/script>/);
    assert.match(gmScript.body, /createGmController/);
    assert.match(gmState.body, /payload\.diagnostics \|\| \[\]/);
    assert.match(gmView.body, /Skipped campaign/);
    assert.match(styles.body, /@font-face/);
    assert.match(styles.body, /EBGaramond-Variable-Latin\.woff2/);
    assert.match(styles.body, /font-display: swap/);
    assert.doesNotMatch(styles.body, /https?:\/\//);
    assert.match(playerResponse.body, /<h1>Player Display<\/h1>/);
  } finally {
    await close(server, io);
  }
});

test("creates campaigns through GM API and lists them", async (t) => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot: createTempRoot(t)
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    const created = await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const list = await requestHttps(`${url}/api/campaigns`, {
      headers: gmHeaders(port)
    });

    assert.equal(created.statusCode, 201);
    assert.equal(created.json.campaign.name, "The Long Walk");
    assert.deepEqual(list.json.campaigns, [
      {
        id: "The Long Walk",
        name: "The Long Walk",
        activeMapName: null,
        mapCount: 0
      }
    ]);
  } finally {
    await close(server, io);
  }
});

test("deletes empty campaigns through GM API only", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "Empty Campaign" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "Filled Campaign" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    await requestHttps(`${url}/api/campaigns/${encodeURIComponent("Filled Campaign")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });

    const rejectedFilled = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("Filled Campaign")}`, {
      headers: gmHeaders(port),
      method: "DELETE"
    });
    const playerRejected = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("Empty Campaign")}`, {
      headers: playerHeaders(port),
      method: "DELETE"
    });
    const deleted = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("Empty Campaign")}`, {
      headers: gmHeaders(port),
      method: "DELETE"
    });

    assert.equal(rejectedFilled.statusCode, 409);
    assert.match(rejectedFilled.json.error, /encounters before deleting the campaign/);
    assert.equal(playerRejected.statusCode, 403);
    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(
      deleted.json.campaigns.map((campaign) => campaign.id),
      ["Filled Campaign"]
    );
    assert.equal(fs.existsSync(path.join(dataRoot, "Empty Campaign")), false);
    assert.equal(fs.existsSync(path.join(dataRoot, "Filled Campaign", "campaign.json")), true);
    assert.equal(stateStore.getState().campaign.id, "Filled Campaign");
  } finally {
    await close(server, io);
  }
});

test("deleting the open empty campaign clears shared campaign state", async (t) => {
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot: createTempRoot(t)
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "Empty Campaign" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const deleted = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("Empty Campaign")}`, {
      headers: gmHeaders(port),
      method: "DELETE"
    });

    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(deleted.json.campaigns, []);
    assert.equal(stateStore.getState().campaign, null);
  } finally {
    await close(server, io);
  }
});

test("updates campaign card metadata through GM API only", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const campaignPath = path.join(dataRoot, "The Long Walk", "campaign.json");
    const updated = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({
        description: "Roads through a haunted borderland.",
        icon: "🛡️",
        name: "The Longer Walk"
      }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const list = await requestHttps(`${url}/api/campaigns`, {
      headers: gmHeaders(port)
    });
    const playerRejected = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({ description: "Player edit", icon: "🔥" }),
      headers: playerHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const invalid = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({ description: "x".repeat(161), icon: "🗺️" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const invalidEmpty = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({}),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const partialIcon = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({ icon: "🔥" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const partialName = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({ name: "The Longest Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const invalidType = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({ description: ["bad"] }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });
    const unknownField = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({ unknown: "field" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PATCH"
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json.campaign.id, "The Long Walk");
    assert.equal(updated.json.campaign.name, "The Longer Walk");
    assert.equal(updated.json.campaign.description, "Roads through a haunted borderland.");
    assert.equal(updated.json.campaign.icon, "🛡️");
    assert.equal(list.json.campaigns[0].name, "The Longer Walk");
    assert.equal(list.json.campaigns[0].description, "Roads through a haunted borderland.");
    assert.equal(list.json.campaigns[0].icon, "🛡️");
    assert.equal(playerRejected.statusCode, 403);
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.json.error, /description/);
    assert.equal(invalidEmpty.statusCode, 400);
    assert.match(invalidEmpty.json.error, /Campaign metadata/);
    assert.equal(partialIcon.statusCode, 200);
    assert.equal(partialIcon.json.campaign.name, "The Longer Walk");
    assert.equal(partialIcon.json.campaign.description, "Roads through a haunted borderland.");
    assert.equal(partialIcon.json.campaign.icon, "🔥");
    assert.equal(partialName.statusCode, 200);
    assert.equal(partialName.json.campaign.name, "The Longest Walk");
    assert.equal(partialName.json.campaign.icon, "🔥");
    assert.equal(invalidType.statusCode, 400);
    assert.match(invalidType.json.error, /description/);
    assert.equal(unknownField.statusCode, 400);
    assert.match(unknownField.json.error, /name, description, or icon/);
    assert.equal(JSON.parse(fs.readFileSync(campaignPath, "utf8")).name, "The Longest Walk");
    assert.equal(fs.existsSync(path.join(dataRoot, "The Longest Walk", "campaign.json")), false);
    assert.equal(stateStore.getState().campaign.description, undefined);
  } finally {
    await close(server, io);
  }
});

test("campaign API reports invalid folders while preserving valid campaigns", async (t) => {
  const dataRoot = createTempRoot(t);
  const invalidDirectory = path.join(dataRoot, "Broken Campaign");
  const invalidMetadataPath = path.join(invalidDirectory, "campaign.json");
  const invalidMetadata = "{not-json";
  fs.mkdirSync(invalidDirectory);
  fs.writeFileSync(invalidMetadataPath, invalidMetadata);
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const response = await requestHttps(`${url}/api/campaigns`, {
      headers: gmHeaders(port)
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.json.campaigns.map((campaign) => campaign.id),
      ["The Long Walk"]
    );
    assert.deepEqual(response.json.diagnostics, [
      {
        campaignId: "Broken Campaign",
        message: "Campaign metadata could not be read. Fix or restore campaign.json, then reload the library."
      }
    ]);
    assert.equal(fs.readFileSync(invalidMetadataPath, "utf8"), invalidMetadata);
  } finally {
    await close(server, io);
  }
});

test("manages maps and broadcasts active map state", async (t) => {
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot: createTempRoot(t)
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;
  const clientOptions = {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"]
  };

  const player = createClient(url, {
    ...clientOptions,
    extraHeaders: {
      referer: `${url}/player`
    }
  });

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const first = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const second = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const renamed = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(first.json.map.id)}`,
      {
        body: JSON.stringify({ name: "Forest Ambush" }),
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "PATCH"
      }
    );
    const reordered = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/reorder`, {
      body: JSON.stringify({ mapIds: [second.json.map.id, first.json.map.id] }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    const active = waitForActiveMap(player, first.json.map.id);
    const selected = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: first.json.map.id }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    const missingMapId = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({}),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    const invalidMapId = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: 12 }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    const playerClear = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: null }),
      headers: playerHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    const playerAsset = await getHttps(`${url}/api/player/active-map/asset`, {
      headers: playerHeaders(port)
    });
    const playerState = await active;
    const activeDelete = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(first.json.map.id)}`,
      {
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "DELETE"
      }
    );
    const playerDelete = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(second.json.map.id)}`,
      {
        headers: playerHeaders(port, { "content-type": "application/json" }),
        method: "DELETE"
      }
    );
    const playerAfterDelete = new Promise((resolve) => {
      player.on("state:sync", (state) => {
        if (state.activeMap?.id === first.json.map.id) resolve(state);
      });
    });
    const deleted = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(second.json.map.id)}`,
      {
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "DELETE"
      }
    );
    const firstAssetUrl = `/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(
      first.json.map.id
    )}/asset`;
    const secondAssetUrl = `/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(
      second.json.map.id
    )}/asset`;
    const deletedAsset = await getHttps(`${url}${secondAssetUrl}`, {
      headers: gmHeaders(port),
      label: "deleted asset"
    });
    const activePlayerAssetAfterDelete = await getHttps(`${url}/api/player/active-map/asset`, {
      headers: playerHeaders(port),
      label: "active player asset after delete"
    });
    const playerDeleteState = await playerAfterDelete;
    const clearedState = waitForNoActiveMap(player);
    const cleared = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: null }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    const gmAsset = await getHttps(`${url}${firstAssetUrl}`, {
      headers: gmHeaders(port),
      label: "gm first asset"
    });
    const inactivePlayerAsset = await getHttps(`${url}${secondAssetUrl}`, {
      headers: playerHeaders(port),
      label: "inactive player asset"
    });
    const playerClearedState = await clearedState;
    const clearedPlayerAsset = await getHttps(`${url}/api/player/active-map/asset`, {
      headers: playerHeaders(port)
    });

    assert.equal(first.statusCode, 201);
    assert.equal(first.json.map.file, "maps/forest.png");
    assert.equal(second.json.map.file, "maps/forest-2.png");
    assert.equal(renamed.json.map.name, "Forest Ambush");
    assert.deepEqual(
      reordered.json.campaign.maps.map((map) => [map.id, map.order]),
      [
        [second.json.map.id, 1],
        [first.json.map.id, 2]
      ]
    );
    assert.equal(selected.json.campaign.activeMapId, first.json.map.id);
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.json.campaign.activeMapId, null);
    assert.equal(missingMapId.statusCode, 400);
    assert.equal(invalidMapId.statusCode, 400);
    assert.equal(playerClear.statusCode, 403);
    assert.equal(activeDelete.statusCode, 409);
    assert.equal(playerDelete.statusCode, 403);
    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(
      deleted.json.campaign.maps.map((map) => [map.id, map.order]),
      [[first.json.map.id, 1]]
    );
    assert.equal(deletedAsset.statusCode, 404);
    assert.equal(activePlayerAssetAfterDelete.statusCode, 200);
    assert.equal(playerState.activeMap.id, first.json.map.id);
    assert.equal(playerState.activeMap.campaignId, "The Long Walk");
    assert.equal(playerState.activeMap.version, `The Long Walk/${first.json.map.id}`);
    assert.equal(playerState.campaign, undefined);
    assert.equal(playerState.activeMap.assetUrl, "/api/player/active-map/asset");
    assert.equal(playerDeleteState.activeMap.id, first.json.map.id);
    assert.equal(playerDeleteState.activeMap.version, playerState.activeMap.version);
    assert.equal(gmAsset.statusCode, 200);
    assert.deepEqual(gmAsset.rawBody, PNG_BYTES);
    assert.equal(inactivePlayerAsset.statusCode, 403);
    assert.equal(playerAsset.statusCode, 200);
    assert.deepEqual(playerAsset.rawBody, PNG_BYTES);
    assert.equal(playerClearedState.activeMap, null);
    assert.equal(clearedPlayerAsset.statusCode, 404);
    assert.equal(stateStore.getState().campaign.activeMapId, null);
  } finally {
    player.close();
    await close(server, io);
  }
});

test("projects in-memory fog only to the appropriate role and shown encounter", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const cave = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "cave.png"
      }),
      method: "POST"
    });
    await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: forest.json.map.id }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });

    const forestFog = [{ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } }];
    const caveFog = [{ type: "hide-rectangle", rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 } }];
    stateStore.setFogOperations("The Long Walk", forest.json.map.id, forestFog);
    const state = stateStore.setFogOperations("The Long Walk", cave.json.map.id, caveFog);

    const gmState = projectStateForRole(state, "gm");
    const playerState = projectStateForRole(state, "player");
    const campaignJson = JSON.parse(fs.readFileSync(path.join(dataRoot, "The Long Walk", "campaign.json"), "utf8"));

    assert.deepEqual(
      gmState.campaign.maps.map((map) => [map.id, map.fogOperations]),
      [
        [forest.json.map.id, forestFog],
        [cave.json.map.id, caveFog]
      ]
    );
    assert.equal(playerState.campaign, undefined);
    assert.equal(playerState.activeMap.id, forest.json.map.id);
    assert.deepEqual(playerState.activeMap.fogOperations, forestFog);
    assert.notEqual(playerState.activeMap.fogOperations, forestFog);
    assert.deepEqual(
      campaignJson.maps.map((map) => map.fog),
      [[], []]
    );
  } finally {
    await close(server, io);
  }
});

test("GM API appends fog operations without persisting or exposing unshown fog", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;
  const clientOptions = {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"]
  };
  const player = createClient(url, {
    ...clientOptions,
    extraHeaders: {
      referer: `${url}/player`
    }
  });

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const cave = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "cave.png"
      }),
      method: "POST"
    });
    const active = waitForActiveMap(player, forest.json.map.id);
    await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: forest.json.map.id }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    await active;

    const forestFog = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    const forestRevealSync = waitForActiveMapFogCount(player, forest.json.map.id, 2);
    const forestReveal = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }),
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    const caveFog = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(cave.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }),
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    const playerState = await forestRevealSync;
    const campaignJson = JSON.parse(fs.readFileSync(path.join(dataRoot, "The Long Walk", "campaign.json"), "utf8"));

    assert.equal(forestFog.statusCode, 201);
    assert.equal(forestReveal.statusCode, 201);
    assert.equal(caveFog.statusCode, 201);
    assert.deepEqual(forestReveal.json.campaign.maps.find((map) => map.id === forest.json.map.id).fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }
    ]);
    assert.deepEqual(playerState.activeMap.fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }
    ]);
    assert.deepEqual(
      stateStore.getState().campaign.maps.map((map) => [map.id, map.fogOperations.length]),
      [
        [forest.json.map.id, 2],
        [cave.json.map.id, 1]
      ]
    );
    assert.deepEqual(
      campaignJson.maps.map((map) => map.fog),
      [[], []]
    );
  } finally {
    player.close();
    await close(server, io);
  }
});

test("GM API clears fog without persisting or changing the shown encounter", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;
  const clientOptions = {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"]
  };
  const player = createClient(url, {
    ...clientOptions,
    extraHeaders: {
      referer: `${url}/player`
    }
  });

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const cave = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "cave.png"
      }),
      method: "POST"
    });
    const active = waitForActiveMap(player, forest.json.map.id);
    await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: forest.json.map.id }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    await active;

    const forestEndpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`;
    const caveEndpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(cave.json.map.id)}/fog-operations`;
    await requestHttps(forestEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const forestFogSync = waitForActiveMapFogCount(player, forest.json.map.id, 2);
    await requestHttps(forestEndpoint, {
      body: JSON.stringify({ type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    await forestFogSync;
    await requestHttps(caveEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    const clearCave = await requestHttps(caveEndpoint, {
      headers: gmHeaders(port),
      method: "DELETE"
    });
    const forestClearSync = waitForActiveMapFogCount(player, forest.json.map.id, 0);
    const clearForest = await requestHttps(forestEndpoint, {
      headers: gmHeaders(port),
      method: "DELETE"
    });
    const playerClearState = await forestClearSync;
    const missingTarget = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent("missing")}/fog-operations`,
      {
        headers: gmHeaders(port),
        method: "DELETE"
      }
    );
    const playerRequest = await requestHttps(forestEndpoint, {
      headers: playerHeaders(port),
      method: "DELETE"
    });
    const campaignJson = JSON.parse(fs.readFileSync(path.join(dataRoot, "The Long Walk", "campaign.json"), "utf8"));

    assert.equal(clearCave.statusCode, 200);
    assert.equal(clearForest.statusCode, 200);
    assert.equal(missingTarget.statusCode, 400);
    assert.equal(playerRequest.statusCode, 403);
    assert.equal(clearCave.json.campaign.activeMapId, forest.json.map.id);
    assert.equal(clearForest.json.campaign.activeMapId, forest.json.map.id);
    assert.deepEqual(
      stateStore.getState().campaign.maps.map((map) => [map.id, map.fogOperations]),
      [
        [forest.json.map.id, []],
        [cave.json.map.id, []]
      ]
    );
    assert.equal(playerClearState.activeMap.id, forest.json.map.id);
    assert.deepEqual(playerClearState.activeMap.fogOperations, []);
    assert.deepEqual(
      campaignJson.maps.map((map) => map.fog),
      [[], []]
    );
  } finally {
    player.close();
    await close(server, io);
  }
});

test("GM fog operation API rejects invalid requests without mutation", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(port, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const endpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`;
    const valid = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const invalidType = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "circle-reveal", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const invalidRect = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.9, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const missingTarget = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent("missing")}/fog-operations`,
      {
        body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    const playerRequest = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 } }),
      headers: playerHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    assert.equal(valid.statusCode, 201);
    assert.equal(invalidType.statusCode, 400);
    assert.equal(invalidRect.statusCode, 400);
    assert.equal(missingTarget.statusCode, 400);
    assert.equal(playerRequest.statusCode, 403);
    assert.deepEqual(stateStore.getState().campaign.maps[0].fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);
  } finally {
    await close(server, io);
  }
});

test("rejects invalid map uploads without persisting files or metadata", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const campaignPath = path.join(dataRoot, "The Long Walk", "campaign.json");
    const originalMetadata = fs.readFileSync(campaignPath, "utf8");
    const cases = [
      {
        body: Buffer.from("not-an-image"),
        contentType: "image/png",
        error: /supported map image/,
        fileName: "forest.png"
      },
      {
        body: PNG_BYTES,
        contentType: "image/jpeg",
        error: /must match its image data/,
        fileName: "forest.jpg"
      }
    ];

    for (const fixture of cases) {
      const rejected = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
        body: fixture.body,
        headers: gmHeaders(port, {
          "content-type": fixture.contentType,
          "x-file-name": fixture.fileName
        }),
        method: "POST"
      });

      assert.equal(rejected.statusCode, 400);
      assert.match(rejected.json.error, fixture.error);
      assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
      assert.deepEqual(fs.readdirSync(path.join(dataRoot, "The Long Walk", "maps")), []);
      assert.deepEqual(stateStore.getState().campaign.maps, []);
    }
  } finally {
    await close(server, io);
  }
});

test("rejects malformed campaign JSON without creating filesystem or in-memory state", async (t) => {
  const dataRoot = createTempRoot(t);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    const rejected = await requestHttps(`${url}/api/campaigns`, {
      body: "{",
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    assert.equal(rejected.statusCode, 400);
    assert.equal(stateStore.getState().campaign, null);
    assert.deepEqual(fs.readdirSync(dataRoot), []);
  } finally {
    await close(server, io);
  }
});

test("rejects player-originated API mutations", async (t) => {
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot: createTempRoot(t)
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;

  try {
    const rejected = await requestHttps(`${url}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: playerHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    assert.equal(rejected.statusCode, 403);
    assert.equal(stateStore.getState().campaign, null);
  } finally {
    await close(server, io);
  }
});

test("derives socket write role from route referer", () => {
  assert.equal(getRoleFromReferer("https://localhost:3000/gm"), "gm");
  assert.equal(getRoleFromReferer("https://localhost:3000/player"), "player");
  assert.equal(getRoleFromReferer("https://localhost:3000/"), "player");
  assert.equal(getRoleFromReferer(undefined), "player");
  assert.equal(getRoleFromReferer("not a url"), "player");
});

test("player page exposes no mutating controls", async (t) => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot: createTempRoot(t)
  });
  const port = await listen(server);

  try {
    const playerResponse = await getHttps(`https://127.0.0.1:${port}/player`);

    assert.equal(playerResponse.statusCode, 200);
    assert.match(playerResponse.body, />Zoom out</);
    assert.match(playerResponse.body, />Fit map</);
    assert.match(playerResponse.body, />Zoom in</);
    assert.doesNotMatch(playerResponse.body, /data-action=/i);
    assert.doesNotMatch(playerResponse.body, /<input/i);
    assert.doesNotMatch(playerResponse.body, /<select/i);
    assert.doesNotMatch(playerResponse.body, /<textarea/i);
  } finally {
    await close(server, io);
  }
});
