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

function getHttps(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false }, (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          body,
          statusCode: response.statusCode
        });
      });
    });

    request.on("error", reject);
  });
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

function waitForState(client, expectedCounter) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for counter ${expectedCounter}`));
    }, 2000);

    client.on("state:sync", (state) => {
      if (state.counter === expectedCounter) {
        clearTimeout(timeout);
        resolve(state);
      }
    });
  });
}

test("serves GM and player pages over HTTPS", async () => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate()
  });
  const port = await listen(server);

  try {
    const gmResponse = await getHttps(`https://127.0.0.1:${port}/gm`);
    const playerResponse = await getHttps(`https://127.0.0.1:${port}/player`);

    assert.equal(gmResponse.statusCode, 200);
    assert.equal(playerResponse.statusCode, 200);
    assert.match(gmResponse.body, /<h1>GM<\/h1>/);
    assert.match(playerResponse.body, /<h1>Player<\/h1>/);
  } finally {
    await close(server, io);
  }
});

test("broadcasts GM counter changes to player clients", async () => {
  const { server, io } = createTabletopFogServer({
    credentials: createTestCertificate()
  });
  const port = await listen(server);
  const url = `https://127.0.0.1:${port}`;
  const clientOptions = {
    forceNew: true,
    rejectUnauthorized: false,
    reconnection: false,
    transports: ["websocket"]
  };

  const gm = createClient(url, {
    ...clientOptions,
    extraHeaders: {
      referer: `${url}/gm`
    }
  });
  const player = createClient(url, {
    ...clientOptions,
    extraHeaders: {
      referer: `${url}/player`
    }
  });

  try {
    await Promise.all([waitForState(gm, 0), waitForState(player, 0)]);
    const updated = waitForState(player, 1);

    gm.emit("gm:increment");

    assert.equal((await updated).counter, 1);
  } finally {
    gm.close();
    player.close();
    await close(server, io);
  }
});

test("ignores mutation events from player clients", async () => {
  const { server, io, stateStore } = createTabletopFogServer({
    credentials: createTestCertificate()
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
    },
    query: { role: "gm" }
  });

  try {
    await waitForState(player, 0);
    player.emit("gm:increment");
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(stateStore.getState().counter, 0);
  } finally {
    player.close();
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
    credentials: createTestCertificate()
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
