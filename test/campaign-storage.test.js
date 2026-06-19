"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createCampaignStorage,
  normalizeFileName,
  normalizePathSegment
} = require("../server/campaign-storage");

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tabletopfog-campaigns-"));
}

test("normalizes filesystem path segments", () => {
  assert.equal(normalizePathSegment("The Long Walk"), "The Long Walk");
  assert.equal(normalizePathSegment("Goblin Cave #2"), "Goblin Cave-2");
  assert.equal(normalizePathSegment("boss/finale"), "boss-finale");
  assert.equal(normalizePathSegment("..secret."), "secret");
  assert.equal(normalizePathSegment("???"), "");
});

test("normalizes map file names while preserving extensions", () => {
  assert.equal(normalizeFileName("Goblin Cave #2.png"), "Goblin Cave-2.png");
  assert.equal(normalizeFileName("boss/finale.png"), "boss-finale.png");
  assert.equal(normalizeFileName("..secret..png"), "secret.png");
});

test("creates campaigns in safe local folders", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.createCampaign("The Long Walk");

  assert.equal(campaign.id, "The Long Walk");
  assert.equal(campaign.name, "The Long Walk");
  assert.equal(campaign.activeMapId, null);
  assert.deepEqual(campaign.maps, []);
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "campaign.json")));
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "maps")));
});

test("rejects empty and case-only duplicate campaign folders", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.createCampaign("???"), /valid campaign name/);

  storage.createCampaign("The Long Walk");

  assert.throws(() => storage.createCampaign("the long walk"), /already exists/);
});

test("lists only folders with valid campaign metadata", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });

  storage.createCampaign("The Long Walk");
  fs.mkdirSync(path.join(root, "not-a-campaign"));

  assert.deepEqual(storage.listCampaigns(), [
    {
      id: "The Long Walk",
      name: "The Long Walk",
      activeMapName: null,
      mapCount: 0
    }
  ]);
});

test("adds maps with original filenames, safe collisions, and default names", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  const first = storage.addMap(campaign.id, {
    content: Buffer.from("first"),
    contentType: "image/png",
    originalFileName: "Goblin Cave #2.png"
  });
  const second = storage.addMap(campaign.id, {
    content: Buffer.from("second"),
    contentType: "image/png",
    originalFileName: "Goblin Cave #2.png"
  });

  assert.equal(first.name, "Goblin Cave #2");
  assert.equal(first.originalFileName, "Goblin Cave #2.png");
  assert.equal(first.file, "maps/Goblin Cave-2.png");
  assert.equal(first.order, 1);
  assert.deepEqual(first.fog, []);
  assert.equal(second.file, "maps/Goblin Cave-2-2.png");
  assert.equal(second.order, 2);
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "maps", "Goblin Cave-2.png")));
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "maps", "Goblin Cave-2-2.png")));
});

test("renames maps without changing stored file paths", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: Buffer.from("map"),
    originalFileName: "forest.png"
  });

  const renamed = storage.renameMap(campaign.id, map.id, "Forest Ambush");

  assert.equal(renamed.name, "Forest Ambush");
  assert.equal(renamed.file, "maps/forest.png");
});

test("reorders maps with sequential authoritative order values", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, { content: Buffer.from("1"), originalFileName: "one.png" });
  const second = storage.addMap(campaign.id, { content: Buffer.from("2"), originalFileName: "two.png" });

  const updated = storage.reorderMaps(campaign.id, [second.id, first.id]);

  assert.deepEqual(updated.maps.map((map) => [map.id, map.order]), [
    [second.id, 1],
    [first.id, 2]
  ]);
});

test("loads campaigns sorted by order and repairs order on save", () => {
  const root = createTempRoot();
  const campaignDir = path.join(root, "The Long Walk");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    JSON.stringify({
      name: "The Long Walk",
      activeMapId: "b",
      maps: [
        { id: "a", name: "A", file: "maps/a.png", order: 2, fog: [] },
        { id: "b", name: "B", file: "maps/b.png", fog: [] },
        { id: "c", name: "C", file: "maps/c.png", order: 2, fog: [] }
      ]
    })
  );
  const storage = createCampaignStorage({ dataRoot: root });

  const loaded = storage.getCampaign("The Long Walk");

  assert.deepEqual(loaded.maps.map((map) => [map.id, map.order]), [
    ["a", 1],
    ["b", 2],
    ["c", 3]
  ]);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(campaignDir, "campaign.json"), "utf8")).maps.map((map) => [
      map.id,
      map.order
    ]),
    [
      ["a", 1],
      ["b", 2],
      ["c", 3]
    ]
  );
});

test("persists active map and reloads campaign state", () => {
  const root = createTempRoot();
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, { content: Buffer.from("map"), originalFileName: "forest.png" });

  storage.setActiveMap(campaign.id, map.id);

  const reloaded = createCampaignStorage({ dataRoot: root }).getCampaign(campaign.id);

  assert.equal(reloaded.activeMapId, map.id);
  assert.equal(reloaded.maps[0].name, "forest");
  assert.equal(reloaded.maps[0].file, "maps/forest.png");
});

test("rejects map asset paths outside the maps folder", () => {
  const root = createTempRoot();
  const campaignDir = path.join(root, "The Long Walk");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    JSON.stringify({
      name: "The Long Walk",
      activeMapId: "bad",
      maps: [{ id: "bad", name: "Bad", file: "campaign.json", order: 1, fog: [] }]
    })
  );
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.getMapAsset("The Long Walk", "bad"), /Invalid map asset path/);
});

test("rejects symlinked map assets that escape the maps folder", { skip: process.platform === "win32" }, () => {
  const root = createTempRoot();
  const campaignDir = path.join(root, "The Long Walk");
  const outsidePath = path.join(root, "outside.png");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(outsidePath, "outside");
  fs.symlinkSync(outsidePath, path.join(campaignDir, "maps", "link.png"));
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    JSON.stringify({
      name: "The Long Walk",
      activeMapId: "link",
      maps: [{ id: "link", name: "Link", file: "maps/link.png", order: 1, fog: [] }]
    })
  );
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.getMapAsset("The Long Walk", "link"), /Invalid map asset path/);
});
