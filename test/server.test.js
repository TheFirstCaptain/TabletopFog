"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const test = require("node:test");

const { io: createClient } = require("socket.io-client");
const { createTabletopFogServer, getRoleFromReferer } = require("../server");
const { createTestCertificate } = require("../test-support/certificate");
const { PNG_BYTES } = require("../test-support/fixtures");
const { createTemporaryDirectory } = require("../test-support/temp-directory");

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
          rawBody,
          statusCode: response.statusCode
        });
      });
    });

    request.on("error", reject);
  });
}

function requestHttps(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        headers: options.headers,
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

    request.on("error", reject);

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

    assert.equal(gmResponse.statusCode, 200);
    assert.equal(playerResponse.statusCode, 200);
    assert.equal(gmScript.statusCode, 200);
    assert.equal(gmState.statusCode, 200);
    assert.equal(gmView.statusCode, 200);
    assert.match(gmResponse.body, /<h1>Campaign Library<\/h1>/);
    assert.match(gmResponse.body, /id="library-diagnostics"/);
    assert.match(gmResponse.body, /<script type="module" src="\/gm\.js"><\/script>/);
    assert.match(gmScript.body, /createGmController/);
    assert.match(gmState.body, /payload\.diagnostics \|\| \[\]/);
    assert.match(gmView.body, /Skipped campaign/);
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
    const gmAsset = await getHttps(`${url}${first.json.map.assetUrl}`, {
      headers: gmHeaders(port)
    });
    const inactivePlayerAsset = await getHttps(`${url}${second.json.map.assetUrl}`, {
      headers: playerHeaders(port)
    });
    const playerAsset = await getHttps(`${url}/api/player/active-map/asset`, {
      headers: playerHeaders(port)
    });
    const playerState = await active;

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
    assert.equal(playerState.activeMap.id, first.json.map.id);
    assert.equal(playerState.campaign, undefined);
    assert.equal(playerState.activeMap.assetUrl, "/api/player/active-map/asset");
    assert.equal(gmAsset.statusCode, 200);
    assert.deepEqual(gmAsset.rawBody, PNG_BYTES);
    assert.equal(inactivePlayerAsset.statusCode, 403);
    assert.equal(playerAsset.statusCode, 200);
    assert.deepEqual(playerAsset.rawBody, PNG_BYTES);
    assert.equal(stateStore.getState().campaign.activeMapId, first.json.map.id);
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
    assert.doesNotMatch(playerResponse.body, /<button/i);
    assert.doesNotMatch(playerResponse.body, /<input/i);
    assert.doesNotMatch(playerResponse.body, /<select/i);
    assert.doesNotMatch(playerResponse.body, /<textarea/i);
  } finally {
    await close(server, io);
  }
});
