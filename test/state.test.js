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
