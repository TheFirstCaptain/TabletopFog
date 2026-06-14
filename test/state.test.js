"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createStateStore } = require("../server/state");

test("state store increments a neutral counter", () => {
  const store = createStateStore();

  assert.equal(store.getState().counter, 0);

  const state = store.increment();

  assert.equal(state.counter, 1);
  assert.equal(state.version, 1);
  assert.match(state.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("state store returns snapshots", () => {
  const store = createStateStore();
  const state = store.getState();

  state.counter = 99;

  assert.equal(store.getState().counter, 0);
});
