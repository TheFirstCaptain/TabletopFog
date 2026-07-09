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
    { type: "hide-circle", circle: { x: 0.22, y: 0.32, radius: 0.04 } }
  ];

  const state = store.setFogOperations("The Long Walk", "forest", operations);

  assert.deepEqual(state.campaign.maps[0].fogOperations, operations);
  assert.deepEqual(state.campaign.maps[1].fogOperations, []);

  operations[0].rect.x = 0.9;
  state.campaign.maps[0].fogOperations[1].rect.width = 0.9;
  state.campaign.maps[0].fogOperations[2].circle.radius = 0.9;

  assert.equal(store.getState().campaign.maps[0].fogOperations[0].rect.x, 0.1);
  assert.equal(store.getState().campaign.maps[0].fogOperations[1].rect.width, 0.1);
  assert.equal(store.getState().campaign.maps[0].fogOperations[2].circle.radius, 0.04);
});

test("state store hydrates persisted map fog when a campaign is opened", () => {
  const store = createStateStore();
  const persistedFog = [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
    { type: "reveal-circle", circle: { x: 0.2, y: 0.3, radius: 0.1 } }
  ];
  const state = store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [
      { id: "forest", name: "Forest", fog: persistedFog },
      { id: "cave", name: "Cave", fog: [] }
    ]
  });

  assert.deepEqual(state.campaign.maps[0].fogOperations, persistedFog);
  assert.deepEqual(state.campaign.maps[1].fogOperations, []);

  persistedFog[0].rect.x = 0.9;
  state.campaign.maps[0].fogOperations[1].circle.radius = 0.9;

  assert.equal(store.getState().campaign.maps[0].fogOperations[0].rect.x, 0.1);
  assert.equal(store.getState().campaign.maps[0].fogOperations[1].circle.radius, 0.1);
});

test("state store preserves current state when persisted fog hydration fails", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [
      {
        id: "forest",
        name: "Forest",
        fog: [{ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }]
      }
    ]
  });
  const before = store.getState();

  assert.throws(
    () =>
      store.setCampaign({
        id: "The Long Walk",
        activeMapId: "forest",
        maps: [
          {
            id: "forest",
            name: "Forest",
            fog: [{ type: "hide-rectangle", rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 } }]
          },
          {
            id: "cave",
            name: "Cave",
            fog: [{ type: "hide-rectangle", rect: { x: 0.95, y: 0.2, width: 0.2, height: 0.2 } }]
          }
        ]
      }),
    /Invalid fog operation/
  );
  assert.deepEqual(store.getState(), before);
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

  store.appendFogOperation("The Long Walk", "forest", {
    type: "reveal-rectangle",
    rect: { x: 0.2, y: 0.2, width: 0.08, height: 0.08 }
  });
  const state = store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-circle",
    circle: { x: 0.4, y: 0.4, radius: 0.1 }
  });

  assert.deepEqual(state.campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "reveal-rectangle", rect: { x: 0.2, y: 0.2, width: 0.08, height: 0.08 } },
    { type: "hide-circle", circle: { x: 0.4, y: 0.4, radius: 0.1 } }
  ]);
  assert.deepEqual(state.campaign.maps[1].fogOperations, []);
});

test("state store appends fog operation batches as one undoable action", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [
      { id: "forest", name: "Forest" },
      { id: "cave", name: "Cave" }
    ]
  });
  store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-rectangle",
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
  });

  const batched = store.appendFogOperations("The Long Walk", "forest", [
    { type: "hide-circle", circle: { x: 0.3, y: 0.3, radius: 0.05 } },
    { type: "hide-circle", circle: { x: 0.4, y: 0.4, radius: 0.05 } },
    { type: "reveal-circle", circle: { x: 0.35, y: 0.35, radius: 0.02 } }
  ]);

  assert.equal(batched.campaign.maps[0].canUndoFogOperation, true);
  assert.deepEqual(batched.campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "hide-circle", circle: { x: 0.3, y: 0.3, radius: 0.05 } },
    { type: "hide-circle", circle: { x: 0.4, y: 0.4, radius: 0.05 } },
    { type: "reveal-circle", circle: { x: 0.35, y: 0.35, radius: 0.02 } }
  ]);

  const undoneBatch = store.undoFogOperation("The Long Walk", "forest");
  assert.equal(undoneBatch.campaign.maps[0].canUndoFogOperation, true);
  assert.deepEqual(undoneBatch.campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  const undoneInitial = store.undoFogOperation("The Long Walk", "forest");
  assert.equal(undoneInitial.campaign.maps[0].canUndoFogOperation, false);
  assert.deepEqual(undoneInitial.campaign.maps[0].fogOperations, []);
});

test("state store rejects invalid fog operation batches without changing state", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [{ id: "forest", name: "Forest" }]
  });
  store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-rectangle",
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
  });
  const before = store.getState();

  assert.throws(
    () =>
      store.appendFogOperations("The Long Walk", "forest", [
        { type: "hide-circle", circle: { x: 0.3, y: 0.3, radius: 0.05 } },
        { type: "hide-circle", circle: { x: 1.3, y: 0.3, radius: 0.05 } }
      ]),
    /Invalid fog operation/
  );
  assert.deepEqual(store.getState(), before);

  const undoneInitial = store.undoFogOperation("The Long Walk", "forest");
  assert.deepEqual(undoneInitial.campaign.maps[0].fogOperations, []);
  assert.equal(undoneInitial.campaign.maps[0].canUndoFogOperation, false);
});

test("state store undoes appended fog operations per encounter", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    activeMapId: "forest",
    maps: [
      { id: "forest", name: "Forest" },
      { id: "cave", name: "Cave" }
    ]
  });

  store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-rectangle",
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
  });
  store.appendFogOperation("The Long Walk", "forest", {
    type: "reveal-circle",
    circle: { x: 0.18, y: 0.18, radius: 0.04 }
  });
  store.appendFogOperation("The Long Walk", "cave", {
    type: "hide-rectangle",
    rect: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
  });

  const undoReveal = store.undoFogOperation("The Long Walk", "forest");

  assert.equal(undoReveal.campaign.maps[0].canUndoFogOperation, true);
  assert.deepEqual(undoReveal.campaign.maps[0].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);
  assert.deepEqual(undoReveal.campaign.maps[1].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }
  ]);

  const undoHide = store.undoFogOperation("The Long Walk", "forest");

  assert.equal(undoHide.campaign.maps[0].canUndoFogOperation, false);
  assert.deepEqual(undoHide.campaign.maps[0].fogOperations, []);
  assert.deepEqual(undoHide.campaign.maps[1].fogOperations, [
    { type: "hide-rectangle", rect: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }
  ]);
  assert.equal(store.canUndoFogOperation("The Long Walk", "forest"), false);
  assert.equal(store.canUndoFogOperation("The Long Walk", "cave"), true);
});

test("state store undoes clear fog by restoring the prior ordered operation list", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest", name: "Forest" }] });
  const operations = [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }
  ];
  store.setFogOperations("The Long Walk", "forest", operations);

  const cleared = store.clearFogOperations("The Long Walk", "forest");

  assert.equal(cleared.campaign.maps[0].canUndoFogOperation, true);
  assert.deepEqual(cleared.campaign.maps[0].fogOperations, []);

  const restored = store.undoFogOperation("The Long Walk", "forest");

  assert.equal(restored.campaign.maps[0].canUndoFogOperation, false);
  assert.deepEqual(restored.campaign.maps[0].fogOperations, operations);
});

test("state store rejects undo without history or a valid target without changing state", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest", name: "Forest" }] });
  store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-rectangle",
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
  });
  const before = store.getState();

  assert.throws(() => store.undoFogOperation("The Long Walk", "missing"), /Invalid fog operation target/);
  assert.throws(() => store.undoFogOperation("Wrong Campaign", "forest"), /Invalid fog operation target/);

  assert.deepEqual(store.getState(), before);

  store.undoFogOperation("The Long Walk", "forest");
  const emptyHistory = store.getState();

  assert.throws(() => store.undoFogOperation("The Long Walk", "forest"), /No fog action to undo/);
  assert.deepEqual(store.getState(), emptyHistory);
});

test("state store clears runtime undo history on campaign reload", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest", name: "Forest" }] });
  store.appendFogOperation("The Long Walk", "forest", {
    type: "hide-rectangle",
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
  });

  assert.equal(store.canUndoFogOperation("The Long Walk", "forest"), true);

  const reloaded = store.setCampaign({
    id: "The Long Walk",
    maps: [
      {
        id: "forest",
        name: "Forest",
        fog: [{ type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }]
      }
    ]
  });

  assert.equal(reloaded.campaign.maps[0].canUndoFogOperation, false);
  assert.equal(store.canUndoFogOperation("The Long Walk", "forest"), false);
  assert.throws(() => store.undoFogOperation("The Long Walk", "forest"), /No fog action to undo/);
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
    [{ type: "hide-circle", circle: { x: -0.1, y: 0, radius: 0.1 } }],
    [{ type: "hide-circle", circle: { x: 0.1, y: 1.1, radius: 0.1 } }],
    [{ type: "hide-circle", circle: { x: 0.1, y: 0.1, radius: 0 } }],
    [{ type: "hide-circle", circle: { x: 0.1, y: 0.1, radius: 0.51 } }],
    [{ type: "reveal-circle", circle: { x: 0.1, y: 0.1, radius: Number.NaN } }],
    [{ type: "reveal-circle", rect: { x: 0, y: 0, width: 0.1, height: 0.1 } }],
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

test("state store replaces in-memory fog with persisted fog when campaign metadata is reloaded", () => {
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
    maps: [
      {
        id: "forest",
        name: "Renamed Forest",
        fog: [{ type: "reveal-rectangle", rect: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 } }]
      }
    ]
  });

  assert.equal(state.campaign.maps[0].name, "Renamed Forest");
  assert.deepEqual(state.campaign.maps[0].fogOperations, [
    { type: "reveal-rectangle", rect: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 } }
  ]);
});

test("state store clears in-memory fog for one encounter", () => {
  const store = createStateStore();
  store.setCampaign({
    id: "The Long Walk",
    maps: [
      { id: "forest", name: "Forest" },
      { id: "cave", name: "Cave" }
    ]
  });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
    { type: "reveal-rectangle", rect: { x: 0.14, y: 0.14, width: 0.08, height: 0.08 } }
  ]);
  store.setFogOperations("The Long Walk", "cave", [
    { type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }
  ]);

  const state = store.clearFogOperations("The Long Walk", "forest");

  assert.deepEqual(
    state.campaign.maps.map((map) => [map.id, map.fogOperations]),
    [
      ["forest", []],
      ["cave", [{ type: "hide-rectangle", rect: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } }]]
    ]
  );
});

test("state store rejects invalid fog clear targets without changing state", () => {
  const store = createStateStore();
  store.setCampaign({ id: "The Long Walk", maps: [{ id: "forest" }] });
  store.setFogOperations("The Long Walk", "forest", [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  assert.throws(() => store.clearFogOperations("Wrong Campaign", "forest"), /Invalid fog operation target/);
  assert.throws(() => store.clearFogOperations("The Long Walk", "missing"), /Invalid fog operation target/);

  assert.deepEqual(store.getState().campaign.maps[0].fogOperations, [
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
