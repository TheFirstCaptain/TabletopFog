"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.resolve(__dirname, "../.github/workflows/quality.yml");

test("quality workflow runs the complete local policy for every supported Node version", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /^name: Quality$/m);
  assert.match(workflow, /^ {2}pull_request:$/m);
  assert.match(workflow, /^ {2}push:\n {4}branches:\n {6}- main$/m);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m);

  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  assert.match(
    workflow,
    /^concurrency:\n {2}group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n {2}cancel-in-progress: true$/m
  );
  assert.match(workflow, /^ {4}name: Quality \/ Node \$\{\{ matrix\.node-version \}\}$/m);
  assert.match(workflow, /^ {4}runs-on: ubuntu-24\.04$/m);
  assert.match(workflow, /^ {4}timeout-minutes: 30$/m);
  assert.match(workflow, /^ {6}fail-fast: false$/m);
  assert.match(workflow, /^ {8}node-version:\n {10}- "22\.8\.0"\n {10}- "24"$/m);

  const actionUses = [...workflow.matchAll(/^\s+uses: (\S+)/gm)].map((match) => match[1]);
  assert.deepEqual(actionUses, [
    "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
    "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e"
  ]);
  assert.match(workflow, /^ {10}persist-credentials: false$/m);
  assert.match(workflow, /^ {10}node-version: \$\{\{ matrix\.node-version \}\}$/m);
  assert.match(workflow, /^ {10}cache: npm$/m);
  assert.match(workflow, /^ {10}cache-dependency-path: package-lock\.json$/m);
  assert.match(workflow, /^ {8}run: npm ci$/m);

  const qualityRuns = workflow.match(/^\s+run: npm run quality$/gm) || [];
  assert.equal(qualityRuns.length, 1);
  assert.doesNotMatch(workflow, /continue-on-error|\|\| true|secrets\.|npm run (?:dev|local)|deploy/i);
});
