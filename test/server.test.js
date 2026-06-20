"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { io: createClient } = require("socket.io-client");
const { createTabletopFogServer, getRoleFromReferer } = require("../server");
const { PNG_BYTES } = require("../test-support/fixtures");

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

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tabletopfog-server-data-"));
}

function createTestCertificate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletopfog-test-cert-"));
  const keyPath = path.join(dir, "key.pem");
  const certPath = path.join(dir, "cert.pem");
  const configPath = path.join(dir, "openssl.cnf");

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
      "IP.1 = 127.0.0.1",
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
      "1",
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
    key: fs.readFileSync(keyPath)
  };
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

test("serves GM and player pages over HTTPS", async () => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(),
    dataRoot: createTempRoot()
  });
  const port = await listen(server);

  try {
    const gmResponse = await getHttps(`https://127.0.0.1:${port}/gm`);
    const playerResponse = await getHttps(`https://127.0.0.1:${port}/player`);

    assert.equal(gmResponse.statusCode, 200);
    assert.equal(playerResponse.statusCode, 200);
    assert.match(gmResponse.body, /<h1>Campaign Library<\/h1>/);
    assert.match(playerResponse.body, /<h1>Player Display<\/h1>/);
  } finally {
    await close(server, io);
  }
});

test("creates campaigns through GM API and lists them", async () => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(),
    dataRoot: createTempRoot()
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

test("manages maps and broadcasts active map state", async () => {
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(),
    dataRoot: createTempRoot()
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
    assert.deepEqual(reordered.json.campaign.maps.map((map) => [map.id, map.order]), [
      [second.json.map.id, 1],
      [first.json.map.id, 2]
    ]);
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

test("rejects invalid map uploads without persisting files or metadata", async () => {
  const dataRoot = createTempRoot();
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(),
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
    const rejected = await requestHttps(`${url}/api/campaigns/${encodeURIComponent("The Long Walk")}/maps`, {
      body: Buffer.from("not-an-image"),
      headers: gmHeaders(port, {
        "content-type": "image/png",
        "x-file-name": "forest.png"
      }),
      method: "POST"
    });
    const campaignPath = path.join(dataRoot, "The Long Walk", "campaign.json");
    const saved = JSON.parse(fs.readFileSync(campaignPath, "utf8"));

    assert.equal(rejected.statusCode, 400);
    assert.match(rejected.json.error, /supported map image/);
    assert.deepEqual(saved.maps, []);
    assert.deepEqual(fs.readdirSync(path.join(dataRoot, "The Long Walk", "maps")), []);
  } finally {
    await close(server, io);
  }
});

test("rejects player-originated API mutations", async () => {
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate(),
    dataRoot: createTempRoot()
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

test("player page exposes no mutating controls", async () => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate(),
    dataRoot: createTempRoot()
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
