"use strict";

const { spawnSync } = require("node:child_process");

const qualityStages = [
  { label: "Lint", script: "lint" },
  { fix: "npm run format", label: "Format check", script: "format:check" },
  { label: "Module baseline", script: "modules:check" },
  { label: "Harness compliance", script: "harness:check" },
  { label: "Tests and coverage", script: "test:coverage" },
  { label: "Chromium browser workflows", script: "test:browser" },
  { label: "High-severity dependency audit", script: "audit:high" }
];

function runNpmScript(script) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", script], {
    stdio: "inherit"
  });

  return result.status ?? 1;
}

function runQuality(options = {}) {
  const log = options.log || console.log;
  const run = options.run || runNpmScript;

  for (const stage of qualityStages) {
    log(`[quality] ${stage.label}`);
    const status = run(stage.script);

    if (status !== 0) {
      log(`[quality] ${stage.label} failed with exit ${status}. Re-run: npm run ${stage.script}`);
      if (stage.fix) {
        log(`[quality] Apply the formatter with: ${stage.fix}`);
      }
      return status;
    }
  }

  log("[quality] Quality checks passed.");
  return 0;
}

if (require.main === module) {
  process.exitCode = runQuality();
}

module.exports = {
  qualityStages,
  runQuality
};
