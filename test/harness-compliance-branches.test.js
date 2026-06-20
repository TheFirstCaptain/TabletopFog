"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { runHarnessCheck } = require("../scripts/check-harness-compliance");
const {
  expectedTrackerStatus,
  findingHeaders,
  legacyFeatureIds,
  requiredStages,
  validateFeature,
  validateLegacyBaseline
} = require("../scripts/harness-compliance");
const { validateRepository } = require("../scripts/harness-repository");
const {
  extractSection,
  parseFeatureDocument,
  parseFeatureTracker,
  parseFields,
  parseMarkdownTable,
  stripFencedCode
} = require("../scripts/harness-markdown");
const { createTemporaryDirectory } = require("../test-support/temp-directory");

const now = new Date("2026-06-20T12:00:00Z");
const stageReviewers = {
  Clarification: "human:user",
  "Architecture Review": "/root/architecture",
  "Implementation Design": "/root/architecture",
  "Test and Validation Design": "/root/tests",
  "UX and Workflow Review": "/root/ux",
  "Coding and TDD": "/root",
  "Code Review": "/root/code_review",
  "Docs and Tracker Review": "/root/docs_review",
  "Final-Diff Review": "/root/final_diff",
  "Final Validation": "/root"
};
const checklistAreas = [
  "Persistence/data integrity",
  "External inputs",
  "Security/trust boundaries",
  "Error handling/observability",
  "Module boundaries",
  "Dependencies",
  "Browser behavior",
  "Test realism",
  "Resource cleanup"
];

function stage(name, fields = {}) {
  return [
    `### ${name}`,
    `- Reviewer: ${fields.Reviewer ?? stageReviewers[name]}`,
    `- Completed: ${fields.Completed ?? "2026-06-20"}`,
    `- Result: ${fields.Result ?? "Pass"}`,
    `- Evidence: ${fields.Evidence ?? `Concrete evidence for ${name}.`}`
  ].join("\n");
}

function checklist(rows = checklistAreas.map((area) => [area, "Reviewed", `Evidence for ${area}.`]), headers) {
  return [
    "## Review Scope Checklist",
    `| ${(headers || ["Area", "Applicability", "Evidence"]).join(" | ")} |`,
    `| ${(headers || ["Area", "Applicability", "Evidence"]).map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function governedDocument(phase, options = {}) {
  const evidence = [
    "Clarification",
    "Architecture Review",
    "Implementation Design",
    "Test and Validation Design",
    "UX and Workflow Review",
    "Coding and TDD",
    "Code Review",
    "Docs and Tracker Review",
    "Final-Diff Review",
    "Final Validation"
  ]
    .map((name) => stage(name, (options.stages || {})[name]))
    .join("\n\n");
  return [
    options.title === undefined ? "# F-100: Governed Fixture" : options.title,
    "## Clarification Notes",
    "Concrete clarification.",
    "## Harness Compliance",
    options.version === undefined ? "Harness Version: 1" : options.version,
    options.checklist === undefined ? checklist() : options.checklist,
    "## SDLC Evidence",
    evidence,
    "## Material Findings",
    options.findings === undefined ? "No material findings." : options.findings,
    options.extra || "",
    "## Status",
    `${phase}.`
  ].join("\n\n");
}

function validateDocument(markdown, phase, options = {}) {
  const feature = parseFeatureDocument(markdown, "docs/features/F-100.md");
  return validateFeature(
    feature,
    {
      id: options.id || "F-100",
      phase,
      status: options.status || expectedTrackerStatus(phase),
      title: options.trackerTitle || "Governed Fixture"
    },
    { followUpExists: options.followUpExists, isLegacy: options.isLegacy, now }
  ).errors;
}

function finding(values = {}) {
  const defaults = {
    ID: "F-100-R001",
    Stage: "Code Review",
    Reviewer: "/root/code_review",
    Severity: "Low",
    Finding: "A concrete finding.",
    Recommendation: "Apply a concrete correction.",
    Disposition: "Fixed",
    Evidence: "Correction verified.",
    "Approved By": "N/A",
    "Follow-up": "N/A",
    "Review By": "N/A",
    "Residual Risk": "None"
  };
  const row = { ...defaults, ...values };
  return findingHeaders.map((header) => row[header]);
}

function findingsTable(rows, headers = findingHeaders) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function makeRepository(t, options = {}) {
  const root = createTemporaryDirectory(t, "tabletopfog-harness-");
  fs.mkdirSync(path.join(root, "docs", "features"), { recursive: true });
  fs.mkdirSync(path.join(root, "quality"), { recursive: true });

  const phases = {
    "F-001": "Done",
    "F-002": "Done",
    "F-003": "Done",
    "F-004": "Validating",
    "F-009": "Clarifying",
    "F-009A": "Done"
  };
  const rows = [];
  legacyFeatureIds.forEach((id) => {
    const phase = phases[id];
    const document = `# ${id}: Legacy Fixture\n\n## Status\n\n${phase}.\n`;
    fs.writeFileSync(path.join(root, "docs", "features", `${id}.md`), document);
    rows.push(
      `| ${id} | Legacy Fixture | ${expectedTrackerStatus(phase)} | ${phase} | [${id}.md](./${id}.md) | 2026-06-20 | Fixture. |`
    );
  });
  (options.extraRows || []).forEach((row) => rows.push(row));
  fs.writeFileSync(
    path.join(root, "docs", "features", "FEATURE_TRACKER.md"),
    [
      "| ID | Title | Status | Phase | Feature Doc | Last Updated | Notes |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...rows
    ].join("\n")
  );
  const features = Object.fromEntries(
    legacyFeatureIds.map((id) => [id, { document: `docs/features/${id}.md`, reason: "Predates version 1." }])
  );
  fs.writeFileSync(
    path.join(root, "quality", "harness-baseline.json"),
    JSON.stringify(options.baseline === undefined ? { version: 1, features } : options.baseline)
  );
  return root;
}

test("markdown helpers strip fenced examples and extract only the requested section", () => {
  const markdown = [
    "## First",
    "kept",
    "### Child",
    "also kept",
    "## Second",
    "removed",
    "```md",
    "## First",
    "example",
    "```"
  ].join("\n");
  const clean = stripFencedCode(markdown);
  assert.doesNotMatch(clean, /example/);
  assert.doesNotMatch(stripFencedCode("~~~md\n## Hidden Tilde\n~~~"), /Hidden Tilde/);
  assert.doesNotMatch(stripFencedCode("````md\n## Hidden Long Fence\n````"), /Hidden Long Fence/);
  assert.equal(extractSection(clean, "## First"), "kept\n### Child\nalso kept");
  assert.equal(extractSection(clean, "## Missing"), null);
});

test("markdown helpers parse fields, sparse tables, statuses, and tracker links", () => {
  assert.deepEqual(parseFields("- Reviewer: /root/tests\nignored\n- Evidence: concrete: detail"), {
    Reviewer: "/root/tests",
    Evidence: "concrete: detail"
  });
  assert.deepEqual(parseMarkdownTable("not a table"), { errors: [], headers: [], rows: [] });
  assert.deepEqual(parseMarkdownTable("| A | B |\n| --- | --- |\n| one |"), {
    errors: ["table row 1 must contain exactly 2 cells"],
    headers: ["A", "B"],
    rows: [{ A: "one", B: "" }]
  });
  const complete = parseFeatureDocument("# F-123A: Child\n## Status\nComplete as of today.", "child.md");
  assert.equal(complete.phase, "Done");
  assert.equal(complete.id, "F-123A");
  assert.equal(parseFeatureDocument("# Invalid\n## Status\nUnknown.", "bad.md").phase, null);
  assert.equal(parseFeatureDocument("# F-100: Empty\n## Status\n", "empty.md").phase, null);
  const tracker = parseFeatureTracker(
    "| F-100 | Title | Active | Building | [F-100.md](./F-100.md) | date | note |\n" +
      "| F-101 | Title | Active | Building | missing | date | note |"
  );
  assert.deepEqual(
    tracker.map((entry) => entry.document),
    ["./F-100.md", null]
  );
});

test("phase and tracker policy maps every lifecycle phase", () => {
  assert.equal(expectedTrackerStatus("Done"), "Complete");
  assert.equal(expectedTrackerStatus("Proposed"), "Proposed");
  assert.equal(expectedTrackerStatus("Blocked"), "Blocked");
  assert.equal(expectedTrackerStatus("Deferred"), "Deferred");
  assert.equal(expectedTrackerStatus("Building"), "Active");
  assert.deepEqual(requiredStages("Proposed"), []);
  assert.equal(requiredStages("Planned").at(-1), "UX and Workflow Review");
  assert.equal(requiredStages("Reviewing").at(-1), "Final-Diff Review");
  assert.equal(requiredStages("Done").at(-1), "Final Validation");
});

test("feature identity, phase, tracker status, version, and legacy rules report independently", () => {
  const proposedWrongVersion = governedDocument("Proposed", { title: "# F-101: Wrong", version: "Harness Version: 2" });
  const proposed = validateDocument(proposedWrongVersion, "Proposed", { id: "F-100", status: "Active" });
  assert.ok(proposed.some((error) => error.includes("Document ID")));
  assert.ok(proposed.some((error) => error.includes("Tracker Status")));
  assert.ok(proposed.some((error) => error.includes("Harness Version")));

  const missing = parseFeatureDocument("## Status\nProposed.", "missing.md");
  const missingErrors = validateFeature(missing, { id: "F-100", phase: "Done", status: "Complete" }, { now }).errors;
  assert.ok(missingErrors.includes("Feature title is missing."));
  assert.ok(missingErrors.includes("Document Status does not match tracker Phase."));
  assert.ok(missingErrors.some((error) => error.includes("Add Harness Version")));

  const legacyErrors = validateDocument("# F-100: Legacy\n## Status\nDone.", "Done", {
    isLegacy: true,
    trackerTitle: "Legacy"
  });
  assert.deepEqual(legacyErrors, []);
});

test("stage evidence rejects invalid reviewers, dates, results, and placeholders", () => {
  const markdown = governedDocument("Planned", {
    stages: {
      Clarification: { Reviewer: "invalid", Completed: "2026-13-01", Result: "Fail", Evidence: "TBD" },
      "Architecture Review": { Reviewer: "/root", Completed: "2026-06-21" }
    }
  });
  const errors = validateDocument(markdown, "Planned");
  assert.ok(errors.some((error) => error.includes("Clarification: add a valid Reviewer")));
  assert.ok(errors.some((error) => error.includes("Clarification: add a valid non-future Completed")));
  assert.ok(errors.some((error) => error.includes("Clarification: Result must be Pass")));
  assert.ok(errors.some((error) => error.includes("Clarification: add concrete Evidence")));
  assert.ok(errors.some((error) => error.includes("Architecture Review") && error.includes("independent")));
  assert.ok(errors.some((error) => error.includes("Architecture Review") && error.includes("non-future")));
});

test("blocked and deferred features require clarification plus meaningful reason evidence", () => {
  const blocked = governedDocument("Blocked", { extra: "## Blockers\n\nPending." });
  const deferred = governedDocument("Deferred", { extra: "## Deferral Notes\n\nConcrete scheduling reason." });
  assert.ok(validateDocument(blocked, "Blocked").some((error) => error.includes("## Blockers")));
  assert.deepEqual(validateDocument(deferred, "Deferred"), []);
});

test("review checklist rejects schema, missing rows, invalid values, placeholders, and extras", () => {
  const badHeaders = validateDocument(
    governedDocument("Planned", { checklist: checklist([], ["Area", "Evidence"]) }),
    "Planned"
  );
  assert.ok(badHeaders.some((error) => error.includes("exact Area")));

  const rows = checklistAreas.slice(1).map((area) => [area, "Reviewed", `Evidence for ${area}.`]);
  rows[0] = [rows[0][0], "Maybe", "None"];
  rows.push(["Unknown", "Reviewed", "Evidence."]);
  const errors = validateDocument(governedDocument("Planned", { checklist: checklist(rows) }), "Planned");
  assert.ok(errors.some((error) => error.includes("missing Persistence/data integrity")));
  assert.ok(errors.some((error) => error.includes("applicability must be")));
  assert.ok(errors.some((error) => error.includes("requires evidence")));
  assert.ok(errors.some((error) => error.includes("unknown area Unknown")));

  const malformedRows = checklistAreas.map((area) => [area, "Reviewed", "Evidence."]);
  malformedRows[1][0] = malformedRows[0][0];
  malformedRows[2].push("extra cell");
  const malformedErrors = validateDocument(
    governedDocument("Planned", { checklist: checklist(malformedRows) }),
    "Planned"
  );
  assert.ok(malformedErrors.some((error) => error.includes("table row")));
  assert.ok(malformedErrors.some((error) => error.includes("areas must be unique")));
});

test("findings require the exact table shape and at least one row", () => {
  const wrongHeaders = findingsTable([finding().slice(0, -1)], findingHeaders.slice(0, -1));
  assert.ok(
    validateDocument(governedDocument("Reviewing", { findings: wrongHeaders }), "Reviewing").some((error) =>
      error.includes("exact governed")
    )
  );
  const empty = findingsTable([]);
  assert.ok(
    validateDocument(governedDocument("Reviewing", { findings: empty }), "Reviewing").some((error) =>
      error.includes("at least one finding")
    )
  );
  const absent = governedDocument("Reviewing", { findings: "" }).replace("## Material Findings\n\n\n\n", "");
  assert.ok(validateDocument(absent, "Reviewing").some((error) => error.includes("Add ## Material Findings")));
});

test("findings cannot hide a blocking row in the Markdown separator position", () => {
  const hiddenHigh = finding({ ID: "F-100-R001", Severity: "High", Disposition: "Accepted" });
  const visibleLow = finding({ ID: "F-100-R002" });
  const malformed = [
    `| ${findingHeaders.join(" | ")} |`,
    `| ${hiddenHigh.join(" | ")} |`,
    `| ${visibleLow.join(" | ")} |`
  ].join("\n");
  const errors = validateDocument(governedDocument("Done", { findings: malformed }), "Done");
  assert.notDeepEqual(errors, []);
});

test("finding rows reject malformed identity, review metadata, content, and dispositions", () => {
  const rows = [
    finding({
      ID: "bad",
      Stage: "Unknown",
      Reviewer: "invalid",
      Severity: "Info",
      Finding: "TBD",
      Recommendation: "None",
      Disposition: "Unknown",
      Evidence: "Pending",
      "Residual Risk": ""
    }),
    finding({ ID: "bad", Stage: "Code Review", Reviewer: "/root", Severity: "High", Disposition: "Accepted" }),
    finding({ ID: "F-100-R003", Severity: "Medium", Disposition: "Rejected" }),
    finding({ ID: "F-100-R004", "Residual Risk": "Pending." })
  ];
  const errors = validateDocument(governedDocument("Done", { findings: findingsTable(rows) }), "Done");
  [
    "feature-prefixed",
    "unknown Stage",
    "invalid Reviewer",
    "invalid Severity",
    "Finding is required",
    "Recommendation is required",
    "Evidence is required",
    "invalid Disposition",
    "independent",
    "must be Fixed",
    "Medium findings must be"
  ].forEach((text) => {
    assert.ok(
      errors.some((error) => error.includes(text)),
      `missing ${text}`
    );
  });
  assert.ok(errors.filter((error) => error.includes("finding ID must be unique")).length >= 2);
  assert.ok(errors.some((error) => error.includes("Residual Risk is required")));
});

test("accepted and deferred findings validate approval, existing follow-up, dates, and residual risk", () => {
  for (const followUp of [
    "[B-001](../bugs/B-001.md)",
    "[E-001](../engineering/E-001.md)",
    "[decision-001](../decisions/decision-001-test.md)"
  ]) {
    const row = finding({
      Severity: "Medium",
      Disposition: "Accepted",
      "Approved By": "human:user",
      "Follow-up": followUp,
      "Review By": "2026-06-20",
      "Residual Risk": "Known residual risk."
    });
    assert.deepEqual(
      validateDocument(governedDocument("Done", { findings: findingsTable([row]) }), "Done", {
        followUpExists: () => true
      }),
      []
    );
  }

  const invalid = finding({
    Severity: "Medium",
    Disposition: "Deferred",
    "Approved By": "/root",
    "Follow-up": "E-999",
    "Review By": "2026-06-19",
    "Residual Risk": "None"
  });
  const errors = validateDocument(governedDocument("Done", { findings: findingsTable([invalid]) }), "Done", {
    followUpExists: () => false
  });
  assert.ok(errors.some((error) => error.includes("human:user approval")));
  assert.ok(errors.some((error) => error.includes("existing B-, E-, or decision")));
  assert.ok(errors.some((error) => error.includes("expired")));
  assert.ok(errors.some((error) => error.includes("residual risk")));

  const badDate = finding({
    Severity: "Low",
    Disposition: "Accepted",
    "Approved By": "human:user",
    "Follow-up": "B-001",
    "Review By": "not-a-date",
    "Residual Risk": "Risk."
  });
  assert.ok(
    validateDocument(governedDocument("Done", { findings: findingsTable([badDate]) }), "Done", {
      followUpExists: () => true
    }).some((error) => error.includes("valid Review By"))
  );
});

test("legacy baseline rejects malformed versions, sets, and metadata", () => {
  assert.ok(validateLegacyBaseline(null).errors.some((error) => error.includes("version")));
  const features = Object.fromEntries(
    legacyFeatureIds.map((id) => [id, { document: `${id}.md`, reason: "Predates." }])
  );
  features["F-001"] = { document: "None", reason: "TBD" };
  const errors = validateLegacyBaseline({ version: 2, features }).errors;
  assert.ok(errors.some((error) => error.includes("version")));
  assert.ok(errors.some((error) => error.includes("F-001") && error.includes("document and reason")));
});

test("repository validation reports duplicate, missing, mismatched, and untracked feature records", (t) => {
  const root = makeRepository(t);
  const trackerPath = path.join(root, "docs", "features", "FEATURE_TRACKER.md");
  fs.appendFileSync(trackerPath, "\n| F-001 | Duplicate | Complete | Done | [F-001.md](./F-001.md) | date | note |\n");
  fs.appendFileSync(trackerPath, "| F-100 | No Link | Proposed | Proposed | missing | date | note |\n");
  fs.appendFileSync(trackerPath, "| F-101 | Missing | Proposed | Proposed | [F-101.md](./F-101.md) | date | note |\n");
  fs.writeFileSync(path.join(root, "docs", "features", "F-102.md"), "# F-102: Untracked\n## Status\nProposed.");
  const baselinePath = path.join(root, "quality", "harness-baseline.json");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  baseline.features["F-002"].document = "docs/features/wrong.md";
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));

  const errors = validateRepository(root, { now }).errors;
  assert.ok(errors.some((error) => error.includes("duplicate tracker ID F-001")));
  assert.ok(errors.some((error) => error.includes("F-100 document link must be ./F-100.md")));
  assert.ok(errors.some((error) => error.includes("F-101 document is missing")));
  assert.ok(errors.some((error) => error.includes("F-102.md") && error.includes("not tracked")));
  assert.ok(errors.some((error) => error.includes("F-002 document path does not match")));
});

test("repository validation requires each tracker link to use its canonical feature document", (t) => {
  const root = makeRepository(t, {
    extraRows: ["| F-100 | Redirected | Proposed | Proposed | [redirected.md](../redirected.md) | date | note |"]
  });
  fs.writeFileSync(path.join(root, "docs", "redirected.md"), "# F-100: Redirected\n\n## Status\n\nProposed.\n");
  const errors = validateRepository(root, { now }).errors;
  assert.notDeepEqual(errors, []);
});

test("repository validation resolves canonical bug, engineering, and decision follow-up links", (t) => {
  const root = makeRepository(t, {
    extraRows: ["| F-100 | Governed Fixture | Complete | Done | [F-100.md](./F-100.md) | 2026-06-20 | Fixture. |"]
  });
  fs.mkdirSync(path.join(root, "docs", "bugs"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "engineering"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "bugs", "B-001.md"), "bug");
  fs.writeFileSync(path.join(root, "docs", "engineering", "E-001.md"), "maintenance");
  fs.writeFileSync(path.join(root, "docs", "decisions", "decision-001-test.md"), "decision");

  const links = [
    "[B-001](../bugs/B-001.md)",
    "[E-001](../engineering/E-001.md)",
    "[decision-001](../decisions/decision-001-test.md)"
  ];
  const rows = links.map((link, index) =>
    finding({
      ID: `F-100-R00${index + 1}`,
      Severity: "Medium",
      Disposition: "Accepted",
      "Approved By": "human:user",
      "Follow-up": link,
      "Review By": "2026-06-20",
      "Residual Risk": "Known residual risk."
    })
  );
  fs.writeFileSync(
    path.join(root, "docs", "features", "F-100.md"),
    governedDocument("Done", { findings: findingsTable(rows) })
  );

  assert.deepEqual(validateRepository(root, { now }).errors, []);

  rows[0] = finding({
    Severity: "Medium",
    Disposition: "Accepted",
    "Approved By": "human:user",
    "Follow-up": "[B-001](../engineering/E-001.md)",
    "Review By": "2026-06-20",
    "Residual Risk": "Known residual risk."
  });
  fs.writeFileSync(
    path.join(root, "docs", "features", "F-100.md"),
    governedDocument("Done", { findings: findingsTable(rows) })
  );
  assert.ok(validateRepository(root, { now }).errors.some((error) => error.includes("existing B-, E-, or decision")));
});

test("CLI reports success, policy violations, and unexpected read failures", (t) => {
  const goodRoot = makeRepository(t);
  const goodMessages = [];
  assert.equal(runHarnessCheck({ rootDir: goodRoot, now, log: (message) => goodMessages.push(message) }), 0);
  assert.match(goodMessages.at(-1), /Compliance passed for 6 tracked features/);

  const badRoot = makeRepository(t);
  fs.writeFileSync(path.join(badRoot, "docs", "features", "F-100.md"), "# F-100: Extra\n## Status\nProposed.");
  const badMessages = [];
  assert.equal(runHarnessCheck({ rootDir: badRoot, now, log: (message) => badMessages.push(message) }), 1);
  assert.ok(badMessages.some((message) => message.includes("Compliance failed")));
  assert.ok(badMessages.some((message) => message.includes("Correct the listed")));
  assert.match(badMessages.at(-1), /npm run harness:check/);

  const missingRoot = createTemporaryDirectory(t, "tabletopfog-harness-missing-");
  const missingMessages = [];
  assert.equal(runHarnessCheck({ rootDir: missingRoot, now, log: (message) => missingMessages.push(message) }), 1);
  assert.ok(missingMessages.some((message) => message.includes("Unable to validate the repository")));
  assert.match(missingMessages.at(-1), /npm run harness:check/);
});

test("CLI entry point validates the current repository and exits successfully", () => {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/check-harness-compliance.js")], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Compliance passed for \d+ tracked features/);
});
