"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { qualityStages, runQuality } = require("../scripts/run-quality");

const expectedScripts = ["lint", "format:check", "modules:check", "harness:check", "test:coverage", "audit:high"];

test("quality runner executes every read-only stage in order", () => {
  const calls = [];
  const messages = [];
  const status = runQuality({
    log: (message) => messages.push(message),
    run: (script) => {
      calls.push(script);
      return 0;
    }
  });

  assert.equal(status, 0);
  assert.deepEqual(
    qualityStages.map((stage) => stage.script),
    expectedScripts
  );
  assert.deepEqual(calls, expectedScripts);
  assert.match(messages.at(-1), /Quality checks passed/);
});

test("quality runner stops at every possible first failure and identifies the rerun command", () => {
  expectedScripts.forEach((failedScript, failedIndex) => {
    const calls = [];
    const messages = [];
    const status = runQuality({
      log: (message) => messages.push(message),
      run: (script) => {
        calls.push(script);
        return script === failedScript ? 7 : 0;
      }
    });

    assert.equal(status, 7);
    assert.deepEqual(calls, expectedScripts.slice(0, failedIndex + 1));
    assert.ok(messages.some((message) => message.includes(`Re-run: npm run ${failedScript}`)));
  });
});
