"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { legacyFeatureIds, validateFeature, validateLegacyBaseline } = require("./harness-compliance");
const { parseFeatureDocument, parseFeatureTracker } = require("./harness-markdown");

function existingFollowUp(rootDir, value) {
  const match = /^\[(B-\d{3}|E-\d{3}|decision-\d{3})\]\((\.\.\/[^)]+)\)$/.exec(String(value || ""));
  if (!match) return false;

  const id = match[1];
  const target = match[2];
  const expected = id.startsWith("B-") ? `../bugs/${id}.md` : id.startsWith("E-") ? `../engineering/${id}.md` : null;
  if (expected ? target !== expected : !new RegExp(`^\\.\\.\\/decisions\\/${id}-[a-z0-9-]+\\.md$`).test(target)) {
    return false;
  }

  const resolved = path.resolve(rootDir, "docs", "features", target);
  const docsRoot = `${path.resolve(rootDir, "docs")}${path.sep}`;
  return resolved.startsWith(docsRoot) && fs.existsSync(resolved);
}

function validateRepository(rootDir, options = {}) {
  const errors = [];
  const featureDir = path.join(rootDir, "docs", "features");
  const trackerRelative = "docs/features/FEATURE_TRACKER.md";
  const trackerPath = path.join(rootDir, trackerRelative);
  const baselinePath = path.join(rootDir, "quality", "harness-baseline.json");
  const trackerEntries = parseFeatureTracker(fs.readFileSync(trackerPath, "utf8"));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const baselineFeatures =
    baseline && baseline.features && typeof baseline.features === "object" ? baseline.features : {};
  const baselineResult = validateLegacyBaseline(baseline);
  errors.push(...baselineResult.errors.map((error) => `quality/harness-baseline.json: ${error}`));

  const trackerIds = new Set();
  trackerEntries.forEach((entry) => {
    if (trackerIds.has(entry.id)) errors.push(`${trackerRelative}: duplicate tracker ID ${entry.id}.`);
    trackerIds.add(entry.id);

    const canonicalLink = `./${entry.id}.md`;
    if (entry.document !== canonicalLink) {
      errors.push(`${trackerRelative}: ${entry.id} document link must be ${canonicalLink}.`);
      return;
    }

    const relativePath = `docs/features/${entry.id}.md`;
    const documentPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(documentPath)) {
      errors.push(`${trackerRelative}: ${entry.id} document is missing.`);
      return;
    }

    const feature = parseFeatureDocument(fs.readFileSync(documentPath, "utf8"), relativePath);
    const result = validateFeature(feature, entry, {
      followUpExists: (value) => existingFollowUp(rootDir, value),
      isLegacy: legacyFeatureIds.includes(entry.id),
      now: options.now || new Date()
    });
    errors.push(...result.errors.map((error) => `${relativePath}: ${error}`));

    if (legacyFeatureIds.includes(entry.id) && baselineFeatures[entry.id]?.document !== relativePath) {
      errors.push(`quality/harness-baseline.json: ${entry.id} document path does not match the tracker.`);
    }
  });

  fs.readdirSync(featureDir)
    .filter((name) => /^F-\d{3}[A-Z]?\.md$/.test(name))
    .forEach((name) => {
      const id = name.slice(0, -3);
      if (!trackerIds.has(id)) errors.push(`docs/features/${name}: feature document is not tracked.`);
    });

  return { errors, featureCount: trackerEntries.length };
}

module.exports = { existingFollowUp, validateRepository };
