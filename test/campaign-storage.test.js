"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createCampaignStorage, normalizeFileName, normalizePathSegment } = require("../server/campaign-storage");
const { MAX_MAP_FILE_BYTES } = require("../server/map-image");
const { createOversizedMapBytes, PNG_BYTES, VALID_MAP_IMAGES } = require("../test-support/fixtures");
const { createTemporaryDirectory } = require("../test-support/temp-directory");

function createTempRoot(t) {
  return createTemporaryDirectory(t, "tabletopfog-campaigns-");
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

test("creates campaigns in safe local folders", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.createCampaign("The Long Walk");

  assert.equal(campaign.id, "The Long Walk");
  assert.equal(campaign.name, "The Long Walk");
  assert.equal(campaign.shownTarget, null);
  assert.deepEqual(campaign.maps, []);
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "campaign.json")));
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "maps")));
});

test("rejects empty and case-only duplicate campaign folders", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.createCampaign("???"), /valid campaign name/);

  storage.createCampaign("The Long Walk");

  assert.throws(() => storage.createCampaign("the long walk"), /already exists/);
});

test("deletes campaigns with no maps", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const campaignDir = path.join(root, campaign.id);

  storage.deleteCampaign(campaign.id);

  assert.equal(fs.existsSync(campaignDir), false);
  assert.deepEqual(storage.listCampaigns(), []);
});

test("rejects campaign deletes when maps remain", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(() => storage.deleteCampaign(campaign.id), /encounters and handouts before deleting the campaign/);
  assert.equal(fs.existsSync(path.join(root, campaign.id)), true);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.equal(fs.existsSync(path.join(root, campaign.id, map.file)), true);
});

test("rejects campaign deletes when handouts remain", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(() => storage.deleteCampaign(campaign.id), /encounters and handouts before deleting the campaign/);
  assert.equal(fs.existsSync(path.join(root, campaign.id)), true);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.equal(fs.existsSync(path.join(root, campaign.id, handout.file)), true);
});

test("lists only folders with valid campaign metadata", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });

  storage.createCampaign("The Long Walk");
  fs.mkdirSync(path.join(root, "not-a-campaign"));

  assert.deepEqual(storage.listCampaigns(), [
    {
      id: "The Long Walk",
      name: "The Long Walk",
      activeMapName: null,
      handoutCount: 0,
      mapCount: 0
    }
  ]);
});

test("campaign library reports invalid folders without modifying them", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  storage.createCampaign("The Long Walk");
  const invalidDirectory = path.join(root, "Broken Campaign");
  const invalidMetadataPath = path.join(invalidDirectory, "campaign.json");
  const invalidMetadata = "{not-json";
  fs.mkdirSync(invalidDirectory);
  fs.writeFileSync(invalidMetadataPath, invalidMetadata);

  assert.deepEqual(storage.getCampaignLibrary(), {
    campaigns: [
      {
        id: "The Long Walk",
        name: "The Long Walk",
        activeMapName: null,
        handoutCount: 0,
        mapCount: 0
      }
    ],
    diagnostics: [
      {
        campaignId: "Broken Campaign",
        message: "Campaign metadata could not be read. Fix or restore campaign.json, then reload the library.",
        type: "skipped"
      }
    ]
  });
  assert.equal(fs.readFileSync(invalidMetadataPath, "utf8"), invalidMetadata);
});

test("adds maps with original filenames, safe collisions, and default names", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "Goblin Cave #2.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
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

test("adds campaign handouts with original filenames, safe collisions, and default names", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  const first = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "NPC Portrait #2.png"
  });
  const second = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "NPC Portrait #2.png"
  });

  assert.equal(first.name, "NPC Portrait #2");
  assert.equal(first.originalFileName, "NPC Portrait #2.png");
  assert.equal(first.file, "handouts/NPC Portrait-2.png");
  assert.equal(first.order, 1);
  assert.equal(second.file, "handouts/NPC Portrait-2-2.png");
  assert.equal(second.order, 2);
  assert.deepEqual(
    storage.getCampaign(campaign.id).handouts.map((handout) => [handout.id, handout.name, handout.file, handout.order]),
    [
      [first.id, "NPC Portrait #2", "handouts/NPC Portrait-2.png", 1],
      [second.id, "NPC Portrait #2", "handouts/NPC Portrait-2-2.png", 2]
    ]
  );
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "handouts", "NPC Portrait-2.png")));
  assert.ok(fs.existsSync(path.join(root, "The Long Walk", "handouts", "NPC Portrait-2-2.png")));
});

test("adds campaign handouts for every supported image type", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  VALID_MAP_IMAGES.forEach((fixture) => {
    const handout = storage.addHandout(campaign.id, {
      content: fixture.bytes,
      contentType: `${fixture.contentType}; charset=binary`,
      originalFileName: fixture.fileName.replace("map", `handout-${fixture.type.toLowerCase()}`)
    });

    assert.match(handout.file, /^handouts\//);
    assert.ok(fs.existsSync(path.join(root, campaign.id, handout.file)), fixture.type);
  });

  assert.deepEqual(
    storage.getCampaign(campaign.id).handouts.map((handout) => handout.order),
    [1, 2, 3, 4]
  );
});

test("renames maps without changing stored file paths", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });

  const renamed = storage.renameMap(campaign.id, map.id, "Forest Ambush");

  assert.equal(renamed.name, "Forest Ambush");
  assert.equal(renamed.file, "maps/forest.png");
});

test("renames handouts without changing stored asset paths", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const assetPath = path.join(root, campaign.id, handout.file);
  const originalBytes = fs.readFileSync(assetPath);

  const renamed = storage.renameHandout(campaign.id, handout.id, "NPC Portrait");
  const reloaded = storage.getCampaign(campaign.id).handouts[0];

  assert.equal(renamed.name, "NPC Portrait");
  assert.equal(renamed.id, handout.id);
  assert.equal(renamed.originalFileName, "portrait.png");
  assert.equal(renamed.file, "handouts/portrait.png");
  assert.equal(renamed.order, 1);
  assert.deepEqual(fs.readFileSync(assetPath), originalBytes);
  assert.deepEqual(
    [reloaded.id, reloaded.name, reloaded.file, reloaded.order],
    [handout.id, "NPC Portrait", "handouts/portrait.png", 1]
  );
});

test("reorders maps with sequential authoritative order values", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "one.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "two.png"
  });

  const updated = storage.reorderMaps(campaign.id, [second.id, first.id]);

  assert.deepEqual(
    updated.maps.map((map) => [map.id, map.order]),
    [
      [second.id, 1],
      [first.id, 2]
    ]
  );
});

test("deletes unshown handouts with asset cleanup and sequential order values", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const second = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "clue.png"
  });
  const firstAsset = path.join(root, campaign.id, first.file);
  const secondAsset = path.join(root, campaign.id, second.file);

  const updated = storage.deleteHandout(campaign.id, first.id);

  assert.equal(fs.existsSync(firstAsset), false);
  assert.equal(fs.existsSync(secondAsset), true);
  assert.deepEqual(
    updated.handouts.map((handout) => [handout.id, handout.name, handout.file, handout.order]),
    [[second.id, "clue", "handouts/clue.png", 1]]
  );
});

test("rejected map mutations preserve campaign metadata byte for byte", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "one.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "two.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");
  const cases = [
    { action: () => storage.reorderMaps(campaign.id, [first.id]), message: /include every map/ },
    { action: () => storage.reorderMaps(campaign.id, [first.id, "unknown"]), message: /unknown map/ },
    { action: () => storage.reorderMaps(campaign.id, [first.id, first.id]), message: /duplicate maps/ },
    { action: () => storage.renameMap(campaign.id, first.id, ""), message: /map name/ },
    { action: () => storage.setActiveMap(campaign.id, "unknown"), message: /Map not found/ }
  ];

  cases.forEach(({ action, message }) => {
    assert.throws(action, message);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
    assert.deepEqual(
      storage.getCampaign(campaign.id).maps.map((map) => map.id),
      [first.id, second.id]
    );
  });
});

test("rejected handout mutations preserve campaign metadata and assets", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const second = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "clue.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const assetPaths = [first, second].map((handout) => path.join(root, campaign.id, handout.file));
  storage.setShownTarget(campaign.id, { id: first.id, type: "handout" });
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  const cases = [
    { action: () => storage.renameHandout(campaign.id, first.id, "Shown Portrait"), message: /Player Display/ },
    { action: () => storage.renameHandout(campaign.id, second.id, ""), message: /handout name/ },
    { action: () => storage.renameHandout(campaign.id, "missing", "Missing"), message: /Handout not found/ },
    { action: () => storage.deleteHandout(campaign.id, first.id), message: /Player Display/ },
    { action: () => storage.deleteHandout(campaign.id, "missing"), message: /Handout not found/ }
  ];

  cases.forEach(({ action, message }) => {
    assert.throws(action, message);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
    assetPaths.forEach((assetPath) => assert.equal(fs.existsSync(assetPath), true));
    assert.deepEqual(
      storage.getCampaign(campaign.id).handouts.map((handout) => [handout.id, handout.name, handout.file]),
      [
        [first.id, "portrait", "handouts/portrait.png"],
        [second.id, "clue", "handouts/clue.png"]
      ]
    );
  });
});

test("loads campaigns sorted by order and repairs order on save", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  const campaignPath = path.join(campaignDir, "campaign.json");
  const originalJson = JSON.stringify({
    name: "The Long Walk",
    activeMapId: "b",
    maps: [
      { id: "a", name: "A", file: "maps/a.png", order: 2, fog: [] },
      { id: "b", name: "B", file: "maps/b.png", fog: [] },
      { id: "c", name: "C", file: "maps/c.png", order: 2, fog: [] }
    ]
  });
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const loaded = storage.getCampaign("The Long Walk");

  assert.deepEqual(
    loaded.maps.map((map) => [map.id, map.order]),
    [
      ["a", 1],
      ["b", 2],
      ["c", 3]
    ]
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);

  storage.reorderMaps("The Long Walk", ["a", "b", "c"]);

  assert.deepEqual(
    JSON.parse(fs.readFileSync(campaignPath, "utf8")).maps.map((map) => [map.id, map.order]),
    [
      ["a", 1],
      ["b", 2],
      ["c", 3]
    ]
  );
});

test("campaign reads do not write and later mutations preserve unknown metadata", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: null,
      externalMetadata: { source: "future-version" },
      maps: [
        {
          id: "forest",
          name: "Forest",
          file: "maps/forest.png",
          order: 1,
          fog: [],
          viewport: { scale: 1.5 }
        }
      ]
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  const storage = createCampaignStorage({ dataRoot: root });

  storage.listCampaigns();
  storage.getCampaign("The Long Walk");

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);

  storage.renameMap("The Long Walk", "forest", "Forest Ambush");

  const saved = JSON.parse(fs.readFileSync(campaignPath, "utf8"));
  assert.deepEqual(saved.externalMetadata, { source: "future-version" });
  assert.deepEqual(saved.maps[0].viewport, { scale: 1.5 });
  assert.equal(saved.maps[0].name, "Forest Ambush");
});

test("updates campaign card metadata while preserving unknown fields", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(
    campaignPath,
    `${JSON.stringify(
      {
        version: 1,
        name: "The Long Walk",
        activeMapId: null,
        externalMetadata: { source: "future-version" },
        maps: []
      },
      null,
      2
    )}\n`
  );
  const storage = createCampaignStorage({ dataRoot: root });

  const updated = storage.updateCampaignMetadata("The Long Walk", {
    description: "Roads through a haunted borderland.",
    icon: "🛡️",
    name: "The Longer Walk"
  });
  const saved = JSON.parse(fs.readFileSync(campaignPath, "utf8"));

  assert.equal(updated.id, "The Long Walk");
  assert.equal(updated.name, "The Longer Walk");
  assert.equal(updated.description, "Roads through a haunted borderland.");
  assert.equal(updated.icon, "🛡️");
  assert.equal(saved.name, "The Longer Walk");
  assert.equal(saved.description, "Roads through a haunted borderland.");
  assert.equal(saved.icon, "🛡️");
  assert.deepEqual(saved.externalMetadata, { source: "future-version" });
  assert.equal(fs.existsSync(path.join(root, "The Long Walk", "campaign.json")), true);
  assert.equal(fs.existsSync(path.join(root, "The Longer Walk", "campaign.json")), false);
});

test("rejects invalid campaign card metadata without changing storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(
    () =>
      storage.updateCampaignMetadata(campaign.id, {
        description: "x".repeat(161),
        icon: "🗺️"
      }),
    /description/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(
    () =>
      storage.updateCampaignMetadata(campaign.id, {
        description: "Within bounds.",
        icon: "too long"
      }),
    /icon/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(
    () =>
      storage.updateCampaignMetadata(campaign.id, {
        name: "???"
      }),
    /name/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
});

test("campaign card metadata patches preserve omitted fields and reject unsupported shapes", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  storage.updateCampaignMetadata(campaign.id, {
    description: "Initial description.",
    icon: "🗺️"
  });

  const descriptionOnly = storage.updateCampaignMetadata(campaign.id, {
    description: "Updated description."
  });
  assert.equal(descriptionOnly.description, "Updated description.");
  assert.equal(descriptionOnly.icon, "🗺️");

  const iconOnly = storage.updateCampaignMetadata(campaign.id, {
    icon: "🔥"
  });
  assert.equal(iconOnly.description, "Updated description.");
  assert.equal(iconOnly.icon, "🔥");

  const nameOnly = storage.updateCampaignMetadata(campaign.id, {
    name: "The Longer Walk"
  });
  assert.equal(nameOnly.name, "The Longer Walk");
  assert.equal(nameOnly.description, "Updated description.");
  assert.equal(nameOnly.icon, "🔥");

  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(() => storage.updateCampaignMetadata(campaign.id, { description: ["bad"] }), /description/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(() => storage.updateCampaignMetadata(campaign.id, { icon: { bad: true } }), /icon/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(() => storage.updateCampaignMetadata(campaign.id, { name: ["bad"] }), /name/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(() => storage.updateCampaignMetadata(campaign.id, { unknown: "field" }), /name, description, or icon/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
});

test("rejects invalid map image data without changing campaign storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  assert.throws(
    () =>
      storage.addMap(campaign.id, {
        content: Buffer.from("not-an-image"),
        contentType: "image/png",
        originalFileName: "forest.png"
      }),
    /supported map image/
  );

  assert.deepEqual(storage.getCampaign(campaign.id).maps, []);
  assert.deepEqual(fs.readdirSync(path.join(root, campaign.id, "maps")), []);
});

test("rejects map image metadata that does not match the image data", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");

  assert.throws(
    () =>
      storage.addMap(campaign.id, {
        content: PNG_BYTES,
        contentType: "image/jpeg",
        originalFileName: "forest.jpg"
      }),
    /must match its image data/
  );

  assert.deepEqual(storage.getCampaign(campaign.id).maps, []);
});

test("rejects invalid handout image data without changing campaign storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(
    () =>
      storage.addHandout(campaign.id, {
        content: Buffer.from("not-an-image"),
        contentType: "image/png",
        originalFileName: "portrait.png"
      }),
    /supported handout image/
  );

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.deepEqual(storage.getCampaign(campaign.id).handouts, []);
  assert.deepEqual(fs.readdirSync(path.join(root, campaign.id, "handouts")), []);

  assert.throws(
    () =>
      storage.addHandout(campaign.id, {
        content: PNG_BYTES,
        contentType: "image/jpeg",
        originalFileName: "portrait.jpg"
      }),
    /must match its image data/
  );

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.deepEqual(storage.getCampaign(campaign.id).handouts, []);
  assert.deepEqual(fs.readdirSync(path.join(root, campaign.id, "handouts")), []);

  assert.throws(
    () =>
      storage.addHandout(campaign.id, {
        content: Buffer.alloc(0),
        contentType: "image/png",
        originalFileName: "empty.png"
      }),
    /empty/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(
    () =>
      storage.addHandout(campaign.id, {
        content: createOversizedMapBytes(MAX_MAP_FILE_BYTES),
        contentType: "image/png",
        originalFileName: "oversized.png"
      }),
    /100 MB limit/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(
    () =>
      storage.addHandout(campaign.id, {
        content: PNG_BYTES,
        contentType: "image/png",
        originalFileName: "???"
      }),
    /valid handout file name/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
});

test("failed handout metadata persistence removes the new asset and preserves existing storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const existing = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "existing.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");
  const originalRenameSync = fs.renameSync;
  t.after(() => {
    fs.renameSync = originalRenameSync;
  });
  fs.renameSync = (source, destination) => {
    if (destination === campaignPath) {
      throw new Error("Injected metadata write failure.");
    }
    return originalRenameSync(source, destination);
  };

  assert.throws(
    () =>
      storage.addHandout(campaign.id, {
        content: PNG_BYTES,
        contentType: "image/png",
        originalFileName: "new.png"
      }),
    /Injected metadata write failure/
  );

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.equal(fs.existsSync(path.join(root, campaign.id, existing.file)), true);
  assert.equal(fs.existsSync(path.join(root, campaign.id, "handouts", "new.png")), false);
  assert.deepEqual(
    storage.getCampaign(campaign.id).handouts.map((handout) => handout.file),
    [existing.file]
  );
});

test("failed handout rename persistence preserves existing storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const assetPath = path.join(root, campaign.id, handout.file);
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");
  const originalBytes = fs.readFileSync(assetPath);
  const originalRenameSync = fs.renameSync;
  t.after(() => {
    fs.renameSync = originalRenameSync;
  });
  fs.renameSync = (source, destination) => {
    if (destination === campaignPath) {
      throw new Error("Injected metadata write failure.");
    }
    return originalRenameSync(source, destination);
  };

  assert.throws(
    () => storage.renameHandout(campaign.id, handout.id, "NPC Portrait"),
    /Injected metadata write failure/
  );

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.deepEqual(fs.readFileSync(assetPath), originalBytes);
  assert.equal(storage.getCampaign(campaign.id).handouts[0].name, "portrait");
});

test("failed handout delete persistence restores the asset and preserves existing storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const assetPath = path.join(root, campaign.id, handout.file);
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");
  const originalBytes = fs.readFileSync(assetPath);
  const originalRenameSync = fs.renameSync;
  t.after(() => {
    fs.renameSync = originalRenameSync;
  });
  fs.renameSync = (source, destination) => {
    if (destination === campaignPath) {
      throw new Error("Injected metadata write failure.");
    }
    return originalRenameSync(source, destination);
  };

  assert.throws(() => storage.deleteHandout(campaign.id, handout.id), /Injected metadata write failure/);

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.deepEqual(fs.readFileSync(assetPath), originalBytes);
  assert.deepEqual(fs.readdirSync(path.join(root, campaign.id, "handouts")), ["portrait.png"]);
  assert.deepEqual(
    storage.getCampaign(campaign.id).handouts.map((candidate) => candidate.id),
    [handout.id]
  );
});

test("handout delete remains committed when post-save temp asset cleanup fails", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const assetPath = path.join(root, campaign.id, handout.file);
  const originalRmSync = fs.rmSync;
  t.after(() => {
    fs.rmSync = originalRmSync;
  });
  fs.rmSync = (target, options) => {
    if (String(target).includes(".delete-")) {
      throw new Error("Injected asset cleanup failure.");
    }
    return originalRmSync(target, options);
  };

  const updated = storage.deleteHandout(campaign.id, handout.id);

  assert.deepEqual(updated.handouts, []);
  assert.deepEqual(storage.getCampaign(campaign.id).handouts, []);
  assert.equal(fs.existsSync(assetPath), false);
  assert.equal(
    fs.readdirSync(path.join(root, campaign.id, "handouts")).filter((name) => name.includes(".delete-")).length,
    1
  );
});

test("persists shown encounter and reloads campaign state with canonical shown target", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });

  storage.setShownTarget(campaign.id, { id: map.id, type: "encounter" });

  const reloaded = createCampaignStorage({ dataRoot: root }).getCampaign(campaign.id);
  const persisted = JSON.parse(fs.readFileSync(path.join(root, campaign.id, "campaign.json"), "utf8"));

  assert.deepEqual(reloaded.shownTarget, { id: map.id, type: "encounter" });
  assert.equal(reloaded.activeMapId, map.id);
  assert.deepEqual(persisted.shownTarget, { id: map.id, type: "encounter" });
  assert.equal(Object.hasOwn(persisted, "activeMapId"), false);
  assert.equal(reloaded.maps[0].name, "forest");
  assert.equal(reloaded.maps[0].file, "maps/forest.png");
});

test("persists shown handout and clearing display without changing encounter or handout records", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "cave.png"
  });
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });

  const shownHandout = storage.setShownTarget(campaign.id, { id: handout.id, type: "handout" });
  const cleared = storage.setShownTarget(campaign.id, null);
  const reloaded = createCampaignStorage({ dataRoot: root }).getCampaign(campaign.id);
  const persisted = JSON.parse(fs.readFileSync(path.join(root, campaign.id, "campaign.json"), "utf8"));

  assert.deepEqual(shownHandout.shownTarget, { id: handout.id, rotation: 0, type: "handout" });
  assert.equal(shownHandout.activeMapId, null);
  assert.equal(cleared.shownTarget, null);
  assert.equal(cleared.activeMapId, null);
  assert.equal(reloaded.shownTarget, null);
  assert.equal(reloaded.activeMapId, null);
  assert.equal(persisted.shownTarget, null);
  assert.deepEqual(
    reloaded.maps.map((map) => [map.id, map.name, map.file, map.order]),
    [
      [first.id, "forest", "maps/forest.png", 1],
      [second.id, "cave", "maps/cave.png", 2]
    ]
  );
  assert.deepEqual(
    reloaded.handouts.map((item) => [item.id, item.name, item.file, item.order]),
    [[handout.id, "portrait", "handouts/portrait.png", 1]]
  );
});

test("migrates legacy active map id to shown target without rewriting on read", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: "forest",
      maps: [{ id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: [] }]
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");

  assert.deepEqual(campaign.shownTarget, { id: "forest", type: "encounter" });
  assert.equal(campaign.activeMapId, "forest");
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);

  storage.updateCampaignMetadata("The Long Walk", { description: "Migrated by an explicit save." });
  const persisted = JSON.parse(fs.readFileSync(campaignPath, "utf8"));

  assert.deepEqual(persisted.shownTarget, { id: "forest", type: "encounter" });
  assert.equal(Object.hasOwn(persisted, "activeMapId"), false);
});

test("canonical shown target takes precedence over stale legacy active map id", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: "forest",
      shownTarget: { type: "handout", id: "missing" },
      maps: [{ id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: [] }]
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");

  assert.equal(campaign.shownTarget, null);
  assert.equal(campaign.activeMapId, null);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("persists shown handout rotation with wraparound without changing handout metadata", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });

  storage.setShownTarget(campaign.id, { id: handout.id, type: "handout" });
  const right = storage.rotateShownHandout(campaign.id, "right");
  const left = storage.rotateShownHandout(campaign.id, "left");
  const leftWrap = storage.rotateShownHandout(campaign.id, "left");
  const reloaded = createCampaignStorage({ dataRoot: root }).getCampaign(campaign.id);
  const persisted = JSON.parse(fs.readFileSync(path.join(root, campaign.id, "campaign.json"), "utf8"));

  assert.deepEqual(right.shownTarget, { id: handout.id, rotation: 90, type: "handout" });
  assert.deepEqual(left.shownTarget, { id: handout.id, rotation: 0, type: "handout" });
  assert.deepEqual(leftWrap.shownTarget, { id: handout.id, rotation: 270, type: "handout" });
  assert.deepEqual(reloaded.shownTarget, { id: handout.id, rotation: 270, type: "handout" });
  assert.deepEqual(persisted.shownTarget, { id: handout.id, rotation: 270, type: "handout" });
  assert.equal(Object.hasOwn(persisted.handouts[0], "rotation"), false);
});

test("normalizes invalid persisted shown handout rotation to zero without rewriting on read", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "handouts"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "handouts", "portrait.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      shownTarget: { type: "handout", id: "portrait", rotation: 45 },
      handouts: [{ id: "portrait", name: "Portrait", file: "handouts/portrait.png", order: 1 }],
      maps: []
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");

  assert.deepEqual(campaign.shownTarget, { id: "portrait", rotation: 0, type: "handout" });
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("rejects invalid shown handout rotation without changing campaign storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  const handout = storage.addHandout(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "portrait.png"
  });
  const campaignPath = path.join(root, campaign.id, "campaign.json");

  [
    () => storage.rotateShownHandout(campaign.id, "right"),
    () => storage.rotateShownHandout(campaign.id, "up"),
    () => storage.rotateShownHandout(campaign.id, null)
  ].forEach((action) => {
    const originalMetadata = fs.readFileSync(campaignPath, "utf8");
    assert.throws(action);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  });

  storage.setShownTarget(campaign.id, { id: map.id, type: "encounter" });
  const shownEncounterMetadata = fs.readFileSync(campaignPath, "utf8");
  assert.throws(() => storage.rotateShownHandout(campaign.id, "right"), /shown handout/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), shownEncounterMetadata);

  storage.setShownTarget(campaign.id, { id: handout.id, type: "handout" });
  const shownHandoutMetadata = fs.readFileSync(campaignPath, "utf8");
  assert.throws(() => storage.rotateShownHandout(campaign.id, "up"), /left or right/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), shownHandoutMetadata);
});

test("rejects invalid shown targets without changing campaign storage", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  storage.setShownTarget(campaign.id, { id: map.id, type: "encounter" });
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  [
    () => storage.setShownTarget(campaign.id, {}),
    () => storage.setActiveMap(campaign.id, ""),
    () => storage.setShownTarget(campaign.id, { id: "missing", type: "encounter" }),
    () => storage.setShownTarget(campaign.id, { id: "missing", type: "handout" }),
    () => storage.setShownTarget(campaign.id, { id: map.id, type: "scene" })
  ].forEach((action) => assert.throws(action));

  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
});

test("persists and clears map fog while preserving campaign metadata", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "cave.png"
  });
  storage.updateCampaignMetadata(campaign.id, { description: "Roads through a haunted borderland." });
  const fog = [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "reveal-circle", circle: { x: 0.18, y: 0.18, radius: 0.04 } }
  ];

  const updated = storage.setMapFog(campaign.id, first.id, fog);
  const cleared = storage.setMapFog(campaign.id, first.id, []);
  const reloaded = createCampaignStorage({ dataRoot: root }).getCampaign(campaign.id);

  assert.deepEqual(updated.maps.find((map) => map.id === first.id).fog, fog);
  assert.deepEqual(updated.maps.find((map) => map.id === second.id).fog, []);
  assert.deepEqual(cleared.maps.find((map) => map.id === first.id).fog, []);
  assert.equal(reloaded.description, "Roads through a haunted borderland.");
  assert.deepEqual(
    reloaded.maps.map((map) => [map.id, map.name, map.file, map.order, map.fog]),
    [
      [first.id, "forest", "maps/forest.png", 1, []],
      [second.id, "cave", "maps/cave.png", 2, []]
    ]
  );
});

test("fog persistence preserves unknown fields on recognized operations", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  fs.writeFileSync(path.join(campaignDir, "maps", "cave.png"), PNG_BYTES);
  fs.writeFileSync(
    campaignPath,
    `${JSON.stringify(
      {
        version: 1,
        name: "The Long Walk",
        activeMapId: null,
        maps: [
          {
            id: "forest",
            name: "Forest",
            file: "maps/forest.png",
            order: 1,
            fog: [
              {
                type: "hide-circle",
                brush: "future",
                circle: { x: 0.1, y: 0.1, radius: 0.2, units: "short-side" }
              }
            ]
          },
          { id: "cave", name: "Cave", file: "maps/cave.png", order: 2, fog: [] }
        ]
      },
      null,
      2
    )}\n`
  );
  const storage = createCampaignStorage({ dataRoot: root });

  storage.setMapFog("The Long Walk", "cave", [
    { type: "hide-rectangle", rect: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 } }
  ]);

  const saved = JSON.parse(fs.readFileSync(campaignPath, "utf8"));
  assert.deepEqual(saved.maps[0].fog, [
    {
      type: "hide-circle",
      brush: "future",
      circle: { x: 0.1, y: 0.1, radius: 0.2, units: "short-side" }
    }
  ]);
});

test("rejected fog persistence preserves campaign metadata byte for byte", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const map = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  storage.setMapFog(campaign.id, map.id, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(
    () => storage.setMapFog(campaign.id, map.id, [{ type: "hide-circle", circle: { x: 1.1, y: 0.1, radius: 0.2 } }]),
    /Invalid fog operation/
  );
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);

  assert.throws(() => storage.setMapFog(campaign.id, "missing", []), /Map not found/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
});

test("recovers malformed persisted fog per encounter without rewriting metadata", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  fs.writeFileSync(path.join(campaignDir, "maps", "cave.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify(
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
          fog: [{ type: "hide-circle", circle: { x: 0.5, y: 0.5, radius: 0 } }]
        },
        {
          id: "cave",
          name: "Cave",
          file: "maps/cave.png",
          order: 2,
          fog: [{ type: "hide-rectangle", rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 } }],
          futureField: { keep: true }
        }
      ],
      futureCampaignField: "keep"
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");

  assert.equal(campaign.activeMapId, "forest");
  assert.deepEqual(
    campaign.maps.map((map) => [map.id, map.fog]),
    [
      ["forest", []],
      ["cave", [{ type: "hide-rectangle", rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 } }]]
    ]
  );
  assert.deepEqual(campaign.recoveryDiagnostics, [
    {
      code: "invalid-fog",
      mapId: "forest",
      message: "Fog for this encounter could not be restored. The map opened without fog.",
      severity: "warning"
    }
  ]);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);

  storage.renameMap("The Long Walk", "cave", "Cavern");
  const saved = JSON.parse(fs.readFileSync(campaignPath, "utf8"));
  assert.deepEqual(saved.futureCampaignField, "keep");
  assert.deepEqual(saved.maps.find((map) => map.id === "cave").futureField, { keep: true });
});

test("reports non-array persisted fog as recovered malformed fog", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "forest.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: "forest",
      maps: [{ id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: { bad: true } }]
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");

  assert.deepEqual(campaign.maps[0].fog, []);
  assert.deepEqual(campaign.recoveryDiagnostics, [
    {
      code: "invalid-fog",
      mapId: "forest",
      message: "Fog for this encounter could not be restored. The map opened without fog.",
      severity: "warning"
    }
  ]);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("reports missing map assets and clears missing shown encounter only in memory", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "cave.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: "forest",
      maps: [
        { id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: [] },
        { id: "cave", name: "Cave", file: "maps/cave.png", order: 2, fog: [] }
      ]
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");
  const library = storage.getCampaignLibrary();

  assert.equal(campaign.activeMapId, null);
  assert.deepEqual(campaign.recoveryDiagnostics, [
    {
      code: "missing-map-asset",
      mapId: "forest",
      message: "This encounter's map image could not be found.",
      severity: "warning"
    },
    {
      code: "shown-encounter-not-restored",
      mapId: "forest",
      message: "The saved Shown to Players encounter could not be restored. The Player Display is waiting for the GM.",
      severity: "warning"
    }
  ]);
  assert.deepEqual(library.campaigns, [
    {
      id: "The Long Walk",
      name: "The Long Walk",
      activeMapName: null,
      handoutCount: 0,
      mapCount: 2
    }
  ]);
  assert.deepEqual(library.diagnostics, [
    {
      campaignId: "The Long Walk",
      message: "This encounter's map image could not be found.",
      type: "recovered"
    },
    {
      campaignId: "The Long Walk",
      message: "The saved Shown to Players encounter could not be restored. The Player Display is waiting for the GM.",
      type: "recovered"
    }
  ]);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("reports missing handout assets without rewriting metadata", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "handouts"), { recursive: true });
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      activeMapId: null,
      handouts: [{ id: "portrait", name: "Portrait", file: "handouts/portrait.png", order: 1 }],
      maps: []
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");
  const library = storage.getCampaignLibrary();

  assert.equal(campaign.handouts[0].assetAvailable, false);
  assert.deepEqual(campaign.recoveryDiagnostics, [
    {
      code: "missing-handout-asset",
      handoutId: "portrait",
      message: "This handout image could not be found.",
      severity: "warning"
    }
  ]);
  assert.equal(library.campaigns[0].handoutCount, 1);
  assert.deepEqual(library.diagnostics, [
    {
      campaignId: "The Long Walk",
      message: "This handout image could not be found.",
      type: "recovered"
    }
  ]);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("reports missing shown handout assets and clears display only in memory", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "handouts"), { recursive: true });
  const originalJson = `${JSON.stringify(
    {
      version: 1,
      name: "The Long Walk",
      shownTarget: { type: "handout", id: "portrait" },
      handouts: [{ id: "portrait", name: "Portrait", file: "handouts/portrait.png", order: 1 }],
      maps: []
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  const campaign = storage.getCampaign("The Long Walk");

  assert.equal(campaign.shownTarget, null);
  assert.deepEqual(campaign.recoveryDiagnostics, [
    {
      code: "missing-handout-asset",
      handoutId: "portrait",
      message: "This handout image could not be found.",
      severity: "warning"
    },
    {
      code: "shown-handout-not-restored",
      handoutId: "portrait",
      message: "The saved Shown to Players handout could not be restored. The Player Display is waiting for the GM.",
      severity: "warning"
    }
  ]);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("rejects handout asset paths outside the handouts folder", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.mkdirSync(path.join(campaignDir, "handouts"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "portrait.png"), PNG_BYTES);
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    `${JSON.stringify({
      version: 1,
      name: "The Long Walk",
      activeMapId: null,
      handouts: [{ id: "portrait", name: "Portrait", file: "maps/portrait.png", order: 1 }],
      maps: []
    })}\n`
  );
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.getHandoutAsset("The Long Walk", "portrait"), /Invalid handout asset path/);
});

test("rejects deleting handout assets outside the handouts folder", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.mkdirSync(path.join(campaignDir, "handouts"), { recursive: true });
  fs.writeFileSync(path.join(campaignDir, "maps", "portrait.png"), PNG_BYTES);
  const originalJson = `${JSON.stringify({
    version: 1,
    name: "The Long Walk",
    activeMapId: null,
    handouts: [{ id: "portrait", name: "Portrait", file: "maps/portrait.png", order: 1 }],
    maps: []
  })}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.deleteHandout("The Long Walk", "portrait"), /Invalid handout asset path/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
  assert.equal(fs.existsSync(path.join(campaignDir, "maps", "portrait.png")), true);
});

test("rejects symlinked handout assets that escape the handouts folder", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  fs.mkdirSync(path.join(campaignDir, "handouts"), { recursive: true });
  const outsideAsset = path.join(root, "outside.png");
  fs.writeFileSync(outsideAsset, PNG_BYTES);
  fs.symlinkSync(outsideAsset, path.join(campaignDir, "handouts", "portrait.png"));
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    `${JSON.stringify({
      version: 1,
      name: "The Long Walk",
      activeMapId: null,
      handouts: [{ id: "portrait", name: "Portrait", file: "handouts/portrait.png", order: 1 }],
      maps: []
    })}\n`
  );
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.getHandoutAsset("The Long Walk", "portrait"), /Invalid handout asset path/);
  assert.equal(storage.getCampaign("The Long Walk").handouts[0].assetAvailable, false);
});

test("rejects showing encounters with missing map assets without rewriting metadata", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const campaignPath = path.join(campaignDir, "campaign.json");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  const originalJson = `${JSON.stringify({
    version: 1,
    name: "The Long Walk",
    activeMapId: null,
    maps: [{ id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: [] }]
  })}\n`;
  fs.writeFileSync(campaignPath, originalJson);
  const storage = createCampaignStorage({ dataRoot: root });

  assert.throws(() => storage.setActiveMap("The Long Walk", "forest"), /map image could not be found/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalJson);
});

test("deletes an unshown unselected map and repairs order", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "cave.png"
  });
  const third = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "tower.png"
  });
  const deletedPath = path.join(root, campaign.id, second.file);

  const updated = storage.deleteMap(campaign.id, second.id);
  const reloaded = createCampaignStorage({ dataRoot: root }).getCampaign(campaign.id);

  assert.deepEqual(
    updated.maps.map((map) => [map.id, map.order]),
    [
      [first.id, 1],
      [third.id, 2]
    ]
  );
  assert.deepEqual(
    reloaded.maps.map((map) => [map.id, map.file, map.order]),
    [
      [first.id, first.file, 1],
      [third.id, third.file, 2]
    ]
  );
  assert.equal(fs.existsSync(deletedPath), false);
  assert.equal(fs.existsSync(path.join(root, campaign.id, first.file)), true);
  assert.equal(fs.existsSync(path.join(root, campaign.id, third.file)), true);
});

test("rejected map deletes preserve campaign metadata and files", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const first = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "forest.png"
  });
  const second = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "cave.png"
  });
  storage.setActiveMap(campaign.id, first.id);
  const campaignPath = path.join(root, campaign.id, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");
  const cases = [
    { action: () => storage.deleteMap(campaign.id, first.id), message: /Player Display/ },
    { action: () => storage.deleteMap(campaign.id, "unknown"), message: /Map not found/ }
  ];

  cases.forEach(({ action, message }) => {
    assert.throws(action, message);
    assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
    assert.equal(fs.existsSync(path.join(root, campaign.id, first.file)), true);
    assert.equal(fs.existsSync(path.join(root, campaign.id, second.file)), true);
  });
});

test("deletes the selected prep map when it is not shown to players", (t) => {
  const root = createTempRoot(t);
  const storage = createCampaignStorage({ dataRoot: root });
  const campaign = storage.createCampaign("The Long Walk");
  const only = storage.addMap(campaign.id, {
    content: PNG_BYTES,
    contentType: "image/png",
    originalFileName: "solo.png"
  });
  const deletedPath = path.join(root, campaign.id, only.file);

  const updated = storage.deleteMap(campaign.id, only.id);

  assert.deepEqual(updated.maps, []);
  assert.equal(fs.existsSync(deletedPath), false);
});

test("rejects deleting map assets outside the maps folder", (t) => {
  const root = createTempRoot(t);
  const campaignDir = path.join(root, "The Long Walk");
  const outsidePath = path.join(root, "outside.png");
  fs.mkdirSync(path.join(campaignDir, "maps"), { recursive: true });
  fs.writeFileSync(outsidePath, PNG_BYTES);
  fs.writeFileSync(
    path.join(campaignDir, "campaign.json"),
    JSON.stringify(
      {
        name: "The Long Walk",
        activeMapId: null,
        maps: [{ id: "escape", name: "Escape", file: "../outside.png", order: 1, fog: [] }]
      },
      null,
      2
    )
  );
  const storage = createCampaignStorage({ dataRoot: root });
  const campaignPath = path.join(campaignDir, "campaign.json");
  const originalMetadata = fs.readFileSync(campaignPath, "utf8");

  assert.throws(() => storage.deleteMap("The Long Walk", "escape"), /Invalid map asset path/);
  assert.equal(fs.readFileSync(campaignPath, "utf8"), originalMetadata);
  assert.equal(fs.existsSync(outsidePath), true);
});

test("rejects map asset paths outside the maps folder", (t) => {
  const root = createTempRoot(t);
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

test("rejects symlinked map assets that escape the maps folder", { skip: process.platform === "win32" }, (t) => {
  const root = createTempRoot(t);
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
