"use strict";

const path = require("node:path");

const { validateRepository } = require("./harness-repository");

function runHarnessCheck(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const log = options.log || console.log;

  try {
    const result = validateRepository(rootDir, { now: options.now || new Date() });
    if (result.errors.length === 0) {
      log(`[harness] Compliance passed for ${result.featureCount} tracked features.`);
      return 0;
    }

    log(`[harness] Compliance failed with ${result.errors.length} violation(s):`);
    const grouped = new Map();
    result.errors.forEach((error) => {
      const match = /^([^:]+):\s*(.+)$/.exec(error);
      const location = match ? match[1] : "Repository";
      const detail = match ? match[2] : error;
      if (!grouped.has(location)) grouped.set(location, []);
      grouped.get(location).push(detail);
    });
    grouped.forEach((details, location) => {
      log(`[harness] ${location}`);
      details.forEach((detail) => log(`  - ${detail}`));
    });
    log("[harness] Correct the listed feature evidence, tracker state, or governed baseline.");
    log("[harness] Re-run: npm run harness:check");
    return 1;
  } catch (error) {
    log(`[harness] Unable to validate the repository: ${error.message}`);
    log("[harness] Re-run: npm run harness:check");
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runHarnessCheck();
}

module.exports = { runHarnessCheck };
