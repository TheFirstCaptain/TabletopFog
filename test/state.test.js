"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createStateStore } = require("../server/state");

test("state store tracks active campaign state", () => {
  const store = createStateStore();

  assert.equal(store.getState().campaign, null);

  const state = store.setCampaign({ id: "The Long Walk", maps: [] });

  assert.equal(state.campaign.id, "The Long Walk");
  assert.equal(state.version, 1);
  assert.match(state.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("state store returns snapshots", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest" }] });
  const state = store.getState();

  state.campaign.id = "Changed";
  state.campaign.maps[0].id = "changed-map";

  assert.equal(store.getState().campaign.id, "The Long Walk");
  assert.equal(store.getState().campaign.maps[0].id, "forest");
});

test("state store keeps normalized fog operations in memory per encounter", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [
      { id: "forest", name: "Forest" },
      { id: "cave", name: "Cave" }
    ]
  });

  const operations = [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
    { type: "reveal-rectangle", rect: { x: 0.2, y: 0.3, width: 0.1, height: 0.1 } },
    { type: "hide-rectangle", rect: { x: 0.22, y: 0.32, width: 0.04, height: 0.04 } }
  ];

  const state = store.setFogOperations("The Long Walk", "forest", operations);

  assert.deepEqual(state.campaign.maps[0].fogOperations, operations);
  assert.deepEqual(state.campaign.maps[1].fogOperations, []);

  operations[0].rect.x = 0.9;
  state.campaign.maps[0].fogOperations[1].rect.width = 0.9;

  assert.equal(store.getState().campaign.maps[0].fogOperations[0].rect.x, 0.1);
  assert.equal(store.getState().campaign.maps[0].fogOperations[1].rect.width, 0.1);
});

test("state store appends one fog operation atomically", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [
      { id: "forest", name: "Forest" },
      { id: "cave", name: "Cave" }
    ]
  });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  const state = store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-rectangle",
    rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 }
  });

  assert.deepEqual(state.campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }
  ]);
  assert.deepEqual(state.campaign.maps[1].fogOperations, []);
});

test("state store rejects invalid appended fog operations without changing state", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest" }] });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  assert.throws(
    () =>
      store.appendFogOperation("The Long Walk", "forest", {
        type: "hide-rectangle",
        rect: { x: 0.95, y: 0, width: 0.1, height: 0.1 }
      }),
    /Invalid fog operation/
  );
  assert.throws(
    () =>
      store.appendFogOperation("The Long Walk", "missing", {
        type: "hide-rectangle",
        rect: { x: 0, y: 0, width: 0.1, height: 0.1 }
      }),
    /Invalid fog operation target/
  );

  assert.deepEqual(store.getState().campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);
});

test("state store rejects invalid fog operations without changing state", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest" }] });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  const invalidCases = [
    [{ type: "circle", rect: { x: 0, y: 0, width: 0.1, height: 0.1 } }],
    [{ type: "hide-rectangle", rect: { x: -0.1, y: 0, width: 0.1, height: 0.1 } }],
    [{ type: "hide-rectangle", rect: { x: 0, y: 0, width: 0, height: 0.1 } }],
    [{ type: "hide-rectangle", rect: { x: 0.95, y: 0, width: 0.1, height: 0.1 } }],
    [{ type: "reveal-rectangle", rect: { x: 0, y: Number.NaN, width: 0.1, height: 0.1 } }]
  ];

  for (const operations of invalidCases) {
    assert.throws(() => store.setFogOperations("The Long Walk", "forest", operations), /Invalid fog operation/);
  }

  assert.deepEqual(store.getState().campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);
});

test("state store preserves in-memory fog when campaign metadata is reloaded", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [{ id: "forest", name: "Forest", fog: [] }]
  });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  const state = store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [{ id: "forest", name: "Renamed Forest", fog: [] }]
  });

  assert.equal(state.campaign.maps[0].name, "Renamed Forest");
  assert.deepEqual(state.campaign.maps[0].fog, []);
  assert.deepEqual(state.campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);
});

test("state store prunes fog for deleted encounter ids before they can be reused", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    maps: [
      { id: "forest", name: "Forest" },
      { id: "cave", name: "Cave" }
    ]
  });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  store.setCampaign({
    id: "The Long Walk",
    maps: [{ id: "cave", name: "Cave" }]
  });

  assert.throws(
    () =>
      store.setFogOperations("The Long Walk", "forest", [
        { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
      ]),
    /Invalid fog operation target/
  );

  const state = store.setCampaign({
    id: "The Long Walk",
    maps: [
      { id: "cave", name: "Cave" },
      { id: "forest", name: "New Forest" }
    ]
  });

  assert.deepEqual(
    state.campaign.maps.map((map) => [map.id, map.fogOperations]),
    [
      ["cave", []],
      ["forest", []]
    ]
  );
});
