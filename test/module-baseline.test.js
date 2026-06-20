"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { validateModuleBaseline } = require("../scripts/check-module-baseline");

function createFixture(t, files) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletopfog-module-baseline-"));
  t.after(() => fs.rmSync(rootDir, { force: true, recursive: true }));

  Object.entries(files).forEach(([filePath, content]) => {
    const absolutePath = path.join(rootDir, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  });

  return rootDir;
}

function baseline(modules) {
  return {
    version: 1,
    roots: ["server", "public", "scripts"],
    modules
  };
}

test("module baseline accepts an exact recorded inventory", (t) => {
  const rootDir = createFixture(t, {
    "server/index.js": "one\ntwo\n",
    "public/gm.js": "one\n",
    "scripts/start.js": "one\ntwo\nthree\n"
  });
  const result = validateModuleBaseline(
    rootDir,
    baseline({
      "public/gm.js": { baselineLines: 1, responsibility: "Render the GM workflow." },
      "scripts/start.js": { baselineLines: 3, responsibility: "Start the local app." },
      "server/index.js": { baselineLines: 2, responsibility: "Compose server transports." }
    })
  );

  assert.deepEqual(result.errors, []);
});

test("module baseline rejects growth and requires recording shrinkage", (t) => {
  const rootDir = createFixture(t, {
    "server/grown.js": "one\ntwo\nthree\n",
    "server/shrunk.js": "one\n"
  });
  const result = validateModuleBaseline(
    rootDir,
    baseline({
      "server/grown.js": { baselineLines: 2, responsibility: "A grown module." },
      "server/shrunk.js": { baselineLines: 2, responsibility: "A reduced module." }
    })
  );

  assert.ok(result.errors.some((error) => error.includes("server/grown.js grew from 2 to 3 lines")));
  assert.ok(result.errors.some((error) => error.includes("server/shrunk.js decreased from 2 to 1 lines")));
});

test("module baseline rejects incomplete inventory and responsibilities", (t) => {
  const rootDir = createFixture(t, {
    "server/known.js": "one\n",
    "server/unrecorded.js": "one\n"
  });
  const result = validateModuleBaseline(
    rootDir,
    baseline({
      "server/known.js": {
        baselineLines: -1,
        responsibility: "",
        temporaryException: { engineeringId: "", reason: "" }
      },
      "server/missing.js": { baselineLines: 1, responsibility: "Missing fixture." }
    })
  );

  assert.ok(result.errors.some((error) => error.includes("server/known.js has no responsibility")));
  assert.ok(result.errors.some((error) => error.includes("server/known.js has an invalid baseline line count")));
  assert.ok(result.errors.some((error) => error.includes("server/known.js has an invalid temporary exception")));
  assert.ok(result.errors.some((error) => error.includes("Unrecorded module: server/unrecorded.js")));
  assert.ok(result.errors.some((error) => error.includes("Missing module: server/missing.js")));
});

test("module baseline cannot omit required roots from discovery", (t) => {
  const rootDir = createFixture(t, {
    "public/gm.js": "one\n",
    "scripts/start.js": "one\n",
    "server/index.js": "one\n"
  });
  const incompleteBaseline = baseline({
    "server/index.js": { baselineLines: 1, responsibility: "Compose the server." }
  });
  incompleteBaseline.roots = ["server"];

  const result = validateModuleBaseline(rootDir, incompleteBaseline);

  assert.ok(result.errors.some((error) => error.includes("roots must be exactly: server, public, scripts")));
  assert.ok(result.errors.some((error) => error.includes("Unrecorded module: public/gm.js")));
  assert.ok(result.errors.some((error) => error.includes("Unrecorded module: scripts/start.js")));
});
