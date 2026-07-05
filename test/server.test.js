"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const test = require("node:test");

const { io: createClient } = require("socket.io-client");
const { createTabletopFogServer, getRoleFromReferer, projectStateForRole } = require("../server");
const { createCampaignStorage } = require("../server/campaign-storage");
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

function waitForPlayerState(client, predicate, description) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for player state: ${description}`));
    }, 2000);

    client.on("state:sync", (state) => {
      if (predicate(state)) {
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
        message: "Campaign metadata could not be read. Fix or restore campaign.json, then reload the library.",
        type: "skipped"
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

test("GM API appends fog operations with persistence without exposing unshown fog", async (t) => {
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
    const forestReveal = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }),
        headers: gmHeaders(port, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    const forestCircleSync = waitForActiveMapFogCount(player, forest.json.map.id, 3);
    const forestCircle = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "hide-circle", circle: { x: 0.44, y: 0.42, radius: 0.1 } }),
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
    const playerState = await forestCircleSync;
    const campaignJson = JSON.parse(fs.readFileSync(path.join(dataRoot, "The Long Walk", "campaign.json"), "utf8"));

    assert.equal(forestFog.statusCode, 201);
    assert.equal(forestReveal.statusCode, 201);
    assert.equal(forestCircle.statusCode, 201);
    assert.equal(caveFog.statusCode, 201);
    assert.deepEqual(forestReveal.json.campaign.maps.find((map) => map.id === forest.json.map.id).fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }
    ]);
    assert.deepEqual(playerState.activeMap.fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } },
      { type: "hide-circle", circle: { x: 0.44, y: 0.42, radius: 0.1 } }
    ]);
    assert.deepEqual(
      stateStore.getState().campaign.maps.map((map) => [map.id, map.fogOperations.length]),
      [
        [forest.json.map.id, 3],
        [cave.json.map.id, 1]
      ]
    );
    assert.deepEqual(
      campaignJson.maps.map((map) => map.fog),
      [
        [
          { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
          { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } },
          { type: "hide-circle", circle: { x: 0.44, y: 0.42, radius: 0.1 } }
        ],
        [{ type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }]
      ]
    );
  } finally {
    player.close();
    await close(server, io);
  }
});

test("GM API clears persisted fog without changing the shown encounter", async (t) => {
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

test("GM API undoes persisted fog actions with shown and unshown projection boundaries", async (t) => {
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
    const forestUndoEndpoint = `${forestEndpoint}/undo`;
    const caveEndpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(cave.json.map.id)}/fog-operations`;
    const caveUndoEndpoint = `${caveEndpoint}/undo`;

    await requestHttps(forestEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const forestRevealSync = waitForActiveMapFogCount(player, forest.json.map.id, 2);
    await requestHttps(forestEndpoint, {
      body: JSON.stringify({ type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    await forestRevealSync;
    await requestHttps(caveEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    const undoRevealSync = waitForActiveMapFogCount(player, forest.json.map.id, 1);
    const undoReveal = await requestHttps(forestUndoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });
    const undoRevealPlayerState = await undoRevealSync;

    assert.equal(undoReveal.statusCode, 200);
    assert.equal(undoReveal.json.campaign.activeMapId, forest.json.map.id);
    assert.equal(undoReveal.json.campaign.maps.find((map) => map.id === forest.json.map.id).canUndoFogOperation, true);
    assert.deepEqual(undoRevealPlayerState.activeMap.fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);

    const clearSync = waitForActiveMapFogCount(player, forest.json.map.id, 0);
    const clearForest = await requestHttps(forestEndpoint, {
      headers: gmHeaders(port),
      method: "DELETE"
    });
    await clearSync;
    assert.equal(clearForest.json.campaign.maps.find((map) => map.id === forest.json.map.id).canUndoFogOperation, true);

    const undoClearSync = waitForActiveMapFogCount(player, forest.json.map.id, 1);
    const undoClear = await requestHttps(forestUndoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });
    await undoClearSync;
    assert.deepEqual(undoClear.json.campaign.maps.find((map) => map.id === forest.json.map.id).fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);

    const caveUndo = await requestHttps(caveUndoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });
    assert.equal(caveUndo.statusCode, 200);
    assert.equal(caveUndo.json.campaign.activeMapId, forest.json.map.id);
    assert.deepEqual(caveUndo.json.campaign.maps.find((map) => map.id === cave.json.map.id).fogOperations, []);
    assert.deepEqual(projectStateForRole(stateStore.getState(), "player").activeMap.fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);

    const noHistory = await requestHttps(caveUndoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });
    const missingTarget = await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent("missing")}/fog-operations/undo`,
      {
        headers: gmHeaders(port),
        method: "POST"
      }
    );
    const playerRequest = await requestHttps(forestUndoEndpoint, {
      headers: playerHeaders(port),
      method: "POST"
    });
    const campaignJson = JSON.parse(fs.readFileSync(path.join(dataRoot, "The Long Walk", "campaign.json"), "utf8"));

    assert.equal(noHistory.statusCode, 409);
    assert.equal(missingTarget.statusCode, 400);
    assert.equal(playerRequest.statusCode, 403);
    assert.deepEqual(
      campaignJson.maps.map((map) => map.fog),
      [[{ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }], []]
    );
  } finally {
    player.close();
    await close(server, io);
  }
});

test("fog undo history is runtime only and does not survive campaign reload", async (t) => {
  const dataRoot = createTempRoot(t);
  const firstServer = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const firstPort = await listen(firstServer.server);
  const firstUrl = `https://127.0.0.1:${firstPort}`;

  try {
    await requestHttps(`${firstUrl}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(firstPort, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(firstPort, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const fog = await requestHttps(
      `${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
        headers: gmHeaders(firstPort, { "content-type": "application/json" }),
        method: "POST"
      }
    );

    assert.equal(fog.json.campaign.maps[0].canUndoFogOperation, true);
  } finally {
    await close(firstServer.server, firstServer.io);
  }

  const secondServer = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const secondPort = await listen(secondServer.server);
  const secondUrl = `https://127.0.0.1:${secondPort}`;

  try {
    const opened = await requestHttps(`${secondUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}`, {
      headers: gmHeaders(secondPort)
    });
    const undo = await requestHttps(
      `${secondUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(opened.json.campaign.maps[0].id)}/fog-operations/undo`,
      {
        headers: gmHeaders(secondPort),
        method: "POST"
      }
    );

    assert.deepEqual(opened.json.campaign.maps[0].fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);
    assert.equal(opened.json.campaign.maps[0].canUndoFogOperation, false);
    assert.equal(undo.statusCode, 409);
  } finally {
    await close(secondServer.server, secondServer.io);
  }
});

test("failed fog undo persistence leaves state storage projection and undo history unchanged", async (t) => {
  const dataRoot = createTempRoot(t);
  const realStorage = createCampaignStorage({ dataRoot });
  let failFogPersistence = false;
  const campaignStorage = {
    ...realStorage,
    setMapFog(campaignId, mapId, operations) {
      if (failFogPersistence) {
        throw new Error("Simulated fog persistence failure.");
      }
      return realStorage.setMapFog(campaignId, mapId, operations);
    }
  };
  const { server, io, stateStore } = createTabletopFogServer({
    campaignStorage,
    credentials: createTestCertificate(t)
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
    const active = waitForActiveMap(player, forest.json.map.id);
    await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: forest.json.map.id }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "PUT"
    });
    await active;

    const fogEndpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`;
    const undoEndpoint = `${fogEndpoint}/undo`;
    const fogSync = waitForActiveMapFogCount(player, forest.json.map.id, 1);
    await requestHttps(fogEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    await fogSync;

    const campaignPath = path.join(dataRoot, "The Long Walk", "campaign.json");
    const storageBefore = fs.readFileSync(campaignPath, "utf8");
    const stateBefore = stateStore.getState();
    const playerBefore = projectStateForRole(stateBefore, "player");
    failFogPersistence = true;

    const rejectedUndo = await requestHttps(undoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });

    assert.equal(rejectedUndo.statusCode, 500);
    assert.deepEqual(stateStore.getState(), stateBefore);
    assert.deepEqual(projectStateForRole(stateStore.getState(), "player"), playerBefore);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), storageBefore);
    assert.equal(stateStore.canUndoFogOperation("The Long Walk", forest.json.map.id), true);

    failFogPersistence = false;
    const undoSync = waitForActiveMapFogCount(player, forest.json.map.id, 0);
    const successfulUndo = await requestHttps(undoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });
    await undoSync;

    assert.equal(successfulUndo.statusCode, 200);
    assert.deepEqual(successfulUndo.json.campaign.maps[0].fogOperations, []);
    assert.equal(successfulUndo.json.campaign.maps[0].canUndoFogOperation, false);
  } finally {
    player.close();
    await close(server, io);
  }
});

test("fog undo rejects malformed and stale targets without changing state", async (t) => {
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

    const forestEndpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`;
    const forestUndoEndpoint = `${forestEndpoint}/undo`;
    const caveEndpoint = `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(cave.json.map.id)}/fog-operations`;
    const caveUndoEndpoint = `${caveEndpoint}/undo`;
    await requestHttps(forestEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    await requestHttps(caveEndpoint, {
      body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    const beforeMalformed = stateStore.getState();
    const malformed = await requestHttps(forestUndoEndpoint, {
      body: "{",
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });

    assert.equal(malformed.statusCode, 400);
    assert.deepEqual(stateStore.getState(), beforeMalformed);
    assert.equal(stateStore.canUndoFogOperation("The Long Walk", forest.json.map.id), true);

    await requestHttps(
      `${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(cave.json.map.id)}`,
      {
        headers: gmHeaders(port),
        method: "DELETE"
      }
    );
    const beforeStaleUndo = stateStore.getState();
    const staleUndo = await requestHttps(caveUndoEndpoint, {
      headers: gmHeaders(port),
      method: "POST"
    });

    assert.equal(staleUndo.statusCode, 400);
    assert.deepEqual(stateStore.getState(), beforeStaleUndo);
    assert.equal(stateStore.canUndoFogOperation("The Long Walk", cave.json.map.id), false);
    assert.equal(stateStore.canUndoFogOperation("The Long Walk", forest.json.map.id), true);
  } finally {
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
    const validCircle = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "reveal-circle", circle: { x: 0.3, y: 0.3, radius: 0.08 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const campaignPath = path.join(dataRoot, "The Long Walk", "campaign.json");
    const originalMetadata = fs.readFileSync(campaignPath, "utf8");
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
    const invalidCircle = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "hide-circle", circle: { x: 0.3, y: 0.3, radius: 0 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const oversizedCircle = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "hide-circle", circle: { x: 0.3, y: 0.3, radius: 0.51 } }),
      headers: gmHeaders(port, { "content-type": "application/json" }),
      method: "POST"
    });
    const missingCircle = await requestHttps(endpoint, {
      body: JSON.stringify({ type: "hide-circle", rect: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 } }),
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
    assert.equal(validCircle.statusCode, 201);
    assert.equal(invalidType.statusCode, 400);
    assert.equal(invalidRect.statusCode, 400);
    assert.equal(invalidCircle.statusCode, 400);
    assert.equal(oversizedCircle.statusCode, 400);
    assert.equal(missingCircle.statusCode, 400);
    assert.equal(missingTarget.statusCode, 400);
    assert.equal(playerRequest.statusCode, 403);
    assert.deepEqual(stateStore.getState().campaign.maps[0].fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
      { type: "reveal-circle", circle: { x: 0.3, y: 0.3, radius: 0.08 } }
    ]);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  } finally {
    await close(server, io);
  }
});

test("opening a campaign hydrates persisted fog operations", async (t) => {
  const dataRoot = createTempRoot(t);
  const firstServer = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const firstPort = await listen(firstServer.server);
  const firstUrl = `https://127.0.0.1:${firstPort}`;

  try {
    await requestHttps(`${firstUrl}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(firstPort, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(firstPort, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    await requestHttps(
      `${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forest.json.map.id)}/fog-operations`,
      {
        body: JSON.stringify({ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
        headers: gmHeaders(firstPort, { "content-type": "application/json" }),
        method: "POST"
      }
    );
  } finally {
    await close(firstServer.server, firstServer.io);
  }

  const secondServer = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const secondPort = await listen(secondServer.server);
  const secondUrl = `https://127.0.0.1:${secondPort}`;

  try {
    const opened = await requestHttps(`${secondUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}`, {
      headers: gmHeaders(secondPort)
    });

    assert.equal(opened.statusCode, 200);
    assert.deepEqual(opened.json.campaign.maps[0].fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);
    assert.deepEqual(secondServer.stateStore.getState().campaign.maps[0].fogOperations, [
      { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
    ]);
  } finally {
    await close(secondServer.server, secondServer.io);
  }
});

test("restores shown encounter and fog to players only after GM opens the campaign", async (t) => {
  const dataRoot = createTempRoot(t);
  const firstServer = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const firstPort = await listen(firstServer.server);
  const firstUrl = `https://127.0.0.1:${firstPort}`;

  let forestMapId;
  let caveMapId;
  const forestFog = [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }
  ];
  const caveFog = [{ type: "hide-rectangle", rect: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }];

  try {
    await requestHttps(`${firstUrl}/api/campaigns`, {
      body: JSON.stringify({ name: "The Long Walk" }),
      headers: gmHeaders(firstPort, { "content-type": "application/json" }),
      method: "POST"
    });
    const forest = await requestHttps(`${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(firstPort, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const cave = await requestHttps(`${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: PNG_BYTES,
      headers: gmHeaders(firstPort, {
        "content-length": String(PNG_BYTES.length),
        "content-type": "image/png",
        "x-file-name": "cave.png"
      }),
      method: "POST"
    });
    forestMapId = forest.json.map.id;
    caveMapId = cave.json.map.id;

    await requestHttps(`${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/active-map`, {
      body: JSON.stringify({ mapId: forestMapId }),
      headers: gmHeaders(firstPort, { "content-type": "application/json" }),
      method: "PUT"
    });
    await requestHttps(
      `${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forestMapId)}/fog-operations`,
      {
        body: JSON.stringify(forestFog[0]),
        headers: gmHeaders(firstPort, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    await requestHttps(
      `${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(forestMapId)}/fog-operations`,
      {
        body: JSON.stringify(forestFog[1]),
        headers: gmHeaders(firstPort, { "content-type": "application/json" }),
        method: "POST"
      }
    );
    await requestHttps(
      `${firstUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps/${encodeURIComponent(caveMapId)}/fog-operations`,
      {
        body: JSON.stringify(caveFog[0]),
        headers: gmHeaders(firstPort, { "content-type": "application/json" }),
        method: "POST"
      }
    );
  } finally {
    await close(firstServer.server, firstServer.io);
  }

  const secondServer = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const secondPort = await listen(secondServer.server);
  const secondUrl = `https://127.0.0.1:${secondPort}`;
  const player = createClient(secondUrl, {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: {
      referer: `${secondUrl}/player`
    }
  });

  try {
    const startupState = await waitForPlayerState(
      player,
      (state) => Object.hasOwn(state, "activeMap") && state.activeMap === null,
      "empty startup player projection"
    );

    assert.equal(secondServer.stateStore.getState().campaign, null);
    assert.equal(startupState.campaign, undefined);

    const library = await requestHttps(`${secondUrl}/api/campaigns`, {
      headers: gmHeaders(secondPort)
    });

    assert.equal(library.statusCode, 200);
    assert.equal(library.json.campaigns[0].id, "The Long Walk");
    assert.equal(library.json.campaigns[0].activeMapName, "forest");
    assert.equal(secondServer.stateStore.getState().campaign, null);

    const restoredPlayer = waitForPlayerState(
      player,
      (state) => state.activeMap?.id === forestMapId && state.activeMap.fogOperations?.length === forestFog.length,
      "restored shown encounter with persisted fog"
    );
    const opened = await requestHttps(`${secondUrl}/api/campaigns/${encodeURIComponent("The Long Walk")}`, {
      headers: gmHeaders(secondPort)
    });
    const restoredPlayerState = await restoredPlayer;

    assert.equal(opened.statusCode, 200);
    assert.equal(opened.json.campaign.activeMapId, forestMapId);
    assert.deepEqual(opened.json.campaign.maps.find((map) => map.id === forestMapId).fogOperations, forestFog);
    assert.deepEqual(opened.json.campaign.maps.find((map) => map.id === caveMapId).fogOperations, caveFog);
    assert.equal(restoredPlayerState.campaign, undefined);
    assert.equal(restoredPlayerState.activeMap.id, forestMapId);
    assert.equal(restoredPlayerState.activeMap.name, "forest");
    assert.equal(restoredPlayerState.activeMap.assetUrl, "/api/player/active-map/asset");
    assert.equal(restoredPlayerState.activeMap.version, `The Long Walk/${forestMapId}`);
    assert.deepEqual(restoredPlayerState.activeMap.fogOperations, forestFog);
    assert.equal(secondServer.stateStore.getState().campaign.activeMapId, forestMapId);
  } finally {
    player.close();
    await close(secondServer.server, secondServer.io);
  }
});

test("restores shown encounter with malformed fog as a GM-diagnosed empty fog state", async (t) => {
  const dataRoot = createTempRoot(t);
  const campaignDir = path.join(dataRoot, "The Long Walk");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    `${JSON.stringify(
      {
        version: 1,
        name: "The Long Walk",
        activeMapId: "forest",
        maps: [
          {
            id: "forest",
            name: "Forest",
            file: "maps/forest.png",
            order: 1,
            fog: [{ type: "hide-rectangle", rect: { x: 0.95, y: 0.1, width: 0.2, height: 0.2 } }]
          }
        ]
      },
      null,
      2
    )}\n`
  );
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;
  const player = createClient(url, {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: {
      referer: `${url}/player`
    }
  });

  try {
    await waitForPlayerState(
      player,
      (state) => Object.hasOwn(state, "activeMap") && state.activeMap === null,
      "empty startup player projection"
    );
    const restoredPlayer = waitForPlayerState(
      player,
      (state) => state.activeMap?.id === "forest" && state.activeMap.fogOperations?.length === 0,
      "recovered shown encounter without malformed fog"
    );
    const opened = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}`, {
      headers: gmHeaders(port)
    });
    const playerState = await restoredPlayer;

    assert.equal(opened.statusCode, 200);
    assert.equal(opened.json.campaign.activeMapId, "forest");
    assert.deepEqual(opened.json.campaign.maps[0].fogOperations, []);
    assert.deepEqual(opened.json.campaign.recoveryDiagnostics, [
      {
        code: "invalid-fog",
        mapId: "forest",
        message: "Fog for this encounter could not be restored. The map opened without fog.",
        severity: "warning"
      }
    ]);
    assert.equal(playerState.campaign, undefined);
    assert.equal(playerState.activeMap.id, "forest");
    assert.deepEqual(playerState.activeMap.fogOperations, []);
    assert.equal(stateStore.getState().campaign.activeMapId, "forest");
  } finally {
    player.close();
    await close(server, io);
  }
});

test("restores missing shown map asset as empty Player Display without path leakage", async (t) => {
  const dataRoot = createTempRoot(t);
  const campaignDir = path.join(dataRoot, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  const originalMetadata = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: "forest",
      maps: [{ id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: [] }]
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalMetadata);
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(t),
    dataRoot
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;
  const player = createClient(url, {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: {
      referer: `${url}/player`
    }
  });

  try {
    await waitForPlayerState(
      player,
      (state) => Object.hasOwn(state, "activeMap") && state.activeMap === null,
      "empty startup player projection"
    );
    const restoredPlayer = waitForPlayerState(
      player,
      (state) => Object.hasOwn(state, "activeMap") && state.activeMap === null,
      "missing shown asset remains empty"
    );
    const opened = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}`, {
      headers: gmHeaders(port)
    });
    const playerState = await restoredPlayer;

    assert.equal(opened.statusCode, 200);
    assert.equal(opened.json.campaign.activeMapId, null);
    assert.deepEqual(opened.json.campaign.recoveryDiagnostics, [
      {
        code: "missing-map-asset",
        mapId: "forest",
        message: "This encounter's map image could not be found.",
        severity: "warning"
      },
      {
        code: "shown-encounter-not-restored",
        mapId: "forest",
        message:
          "The saved Shown to Players encounter could not be restored. The Player Display is waiting for the GM.",
        severity: "warning"
      }
    ]);
    assert.equal(playerState.campaign, undefined);
    assert.equal(playerState.activeMap, null);
    assert.equal(JSON.stringify(playerState).includes(dataRoot), false);
    assert.equal(stateStore.getState().campaign.activeMapId, null);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  } finally {
    player.close();
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
