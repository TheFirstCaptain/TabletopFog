"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { legacyFeatureIds, validateFeature, validateLegacyBaseline } = require("../scripts/harness-compliance");
const { parseFeatureDocument } = require("../scripts/harness-markdown");
const { validateRepository } = require("../scripts/harness-repository");

const completed = "2026-06-20";
const now = new Date("2026-06-20T12:00:00Z");

const reviewers = {
  "Architecture Review": "/root/architecture",
  Clarification: "human:user",
  "Code Review": "/root/code_review",
  "Coding and TDD": "/root",
  "Docs and Tracker Review": "/root/docs_review",
  "Final Validation": "/root",
  "Final-Diff Review": "/root/final_diff",
  "Implementation Design": "/root/architecture",
  "Test and Validation Design": "/root/tests",
  "UX and Workflow Review": "/root/ux"
};

function stage(name, overrides = {}) {
  return [
    `### ${name}`,
    "",
    `- Reviewer: ${overrides.reviewer || reviewers[name]}`,
    `- Completed: ${overrides.completed || completed}`,
    `- Result: ${overrides.result || "Pass"}`,
    `- Evidence: ${overrides.evidence || `Completed ${name.toLowerCase()} with concrete repository evidence.`}`
  ].join("\n");
}

function checklist() {
  return [
    "## Review Scope Checklist",
    "",
    "| Area | Applicability | Evidence |",
    "| --- | --- | --- |",
    "| Persistence/data integrity | Not Applicable | No storage behavior changes. |",
    "| External inputs | Reviewed | Exact repository input formats are validated. |",
    "| Security/trust boundaries | Reviewed | Review identity and approval boundaries are validated. |",
    "| Error handling/observability | Reviewed | All violations are reported with remediation. |",
    "| Module boundaries | Reviewed | Parsing, policy, and repository I/O are separated. |",
    "| Dependencies | Not Applicable | No dependency change. |",
    "| Browser behavior | Not Applicable | No browser behavior change. |",
    "| Test realism | Reviewed | Synthetic and repository fixtures are validated. |",
    "| Resource cleanup | Reviewed | Temporary fixtures use teardown. |"
  ].join("\n");
}

function featureDocument(phase, options = {}) {
  const stages = [
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
  ].map((name) => stage(name, options.stageOverrides && options.stageOverrides[name]));

  if (options.replaceStage) {
    const index = stages.findIndex((value) => value.startsWith(`### ${options.replaceStage.name}\n`));
    stages[index] = options.replaceStage.content;
  }

  return [
    "# F-100: Fixture Feature",
    "",
    "## Clarification Notes",
    "",
    "- Fixture clarification is complete.",
    "",
    "## Harness Compliance",
    "",
    "Harness Version: 1",
    "",
    checklist(),
    "",
    "## SDLC Evidence",
    "",
    ...stages.flatMap((value) => [value, ""]),
    "## Material Findings",
    "",
    options.findings || "No material findings.",
    "",
    "## Status",
    "",
    `${phase}.`
  ].join("\n");
}

function validate(markdown, phase) {
  const feature = parseFeatureDocument(markdown, "docs/features/F-100.md");
  return validateFeature(
    feature,
    { id: "F-100", phase, status: phase === "Done" ? "Complete" : "Active", title: "Fixture Feature" },
    { now }
  );
}

test("phase-aware contract accepts complete evidence and rejects future-stage placeholders only when required", () => {
  const clarifying = featureDocument("Clarifying", {
    replaceStage: { name: "Architecture Review", content: "### Architecture Review\n\n- Pending." }
  });
  assert.deepEqual(validate(clarifying, "Clarifying").errors, []);

  const planned = validate(clarifying.replace("Clarifying.", "Planned."), "Planned");
  assert.ok(planned.errors.some((error) => error.includes("Architecture Review")));

  assert.deepEqual(validate(featureDocument("Done"), "Done").errors, []);
});

test("contract rejects headings hidden in fenced examples and non-independent reviewers", () => {
  const fenced = featureDocument("Reviewing", {
    replaceStage: {
      name: "Final-Diff Review",
      content:
        "```md\n### Final-Diff Review\n- Reviewer: /root/final_diff\n- Completed: 2026-06-20\n- Result: Pass\n- Evidence: Example only.\n```"
    },
    stageOverrides: {
      "Code Review": { reviewer: "/root" }
    }
  });
  const result = validate(fenced, "Reviewing");

  assert.ok(result.errors.some((error) => error.includes("Final-Diff Review")));
  assert.ok(result.errors.some((error) => error.includes("Code Review") && error.includes("independent")));
});

test("material findings enforce severity, approval, follow-up, expiry, and residual risk", () => {
  const findings = [
    "| ID | Stage | Reviewer | Severity | Finding | Recommendation | Disposition | Evidence | Approved By | Follow-up | Review By | Residual Risk |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| F-100-R001 | Code Review | /root/code_review | High | Blocking defect. | Fix before completion. | Accepted | Not fixed. | human:user | E-006 | 2026-09-20 | Defect remains. |",
    "| F-100-R002 | Code Review | /root/code_review | Medium | Deferred issue. | Schedule remediation. | Deferred | Tracked for later. | /root | E-006 | 2026-06-19 | Risk remains. |"
  ].join("\n");
  const result = validate(featureDocument("Done", { findings }), "Done");

  assert.ok(result.errors.some((error) => error.includes("F-100-R001") && error.includes("must be Fixed")));
  assert.ok(result.errors.some((error) => error.includes("F-100-R002") && error.includes("human:user")));
  assert.ok(result.errors.some((error) => error.includes("F-100-R002") && error.includes("expired")));
});

test("legacy baseline is closed to additions and requires every approved legacy feature", () => {
  const features = Object.fromEntries(
    legacyFeatureIds.map((id) => [id, { document: `docs/features/${id}.md`, reason: "Predates Harness Version 1." }])
  );
  assert.deepEqual(validateLegacyBaseline({ version: 1, features }).errors, []);

  features["F-999"] = { document: "docs/features/F-999.md", reason: "Silent expansion." };
  const expanded = validateLegacyBaseline({ version: 1, features });
  assert.ok(expanded.errors.some((error) => error.includes("Legacy feature set must be exactly")));
});

test("current repository conforms to the harness contract", () => {
  const rootDir = path.resolve(__dirname, "..");
  assert.deepEqual(validateRepository(rootDir).errors, []);
});
