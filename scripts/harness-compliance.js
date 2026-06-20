"use strict";

const { parseMarkdownTable } = require("./harness-markdown");

const legacyFeatureIds = ["F-001", "F-002", "F-003", "F-004", "F-009", "F-009A"];
const stageNames = [
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
];
const independentStages = new Set([
  "Architecture Review",
  "Test and Validation Design",
  "UX and Workflow Review",
  "Code Review",
  "Docs and Tracker Review",
  "Final-Diff Review"
]);
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
const findingHeaders = [
  "ID",
  "Stage",
  "Reviewer",
  "Severity",
  "Finding",
  "Recommendation",
  "Disposition",
  "Evidence",
  "Approved By",
  "Follow-up",
  "Review By",
  "Residual Risk"
];

function isMeaningful(value) {
  const normalized = String(value || "")
    .replace(/^[-*]\s*/, "")
    .trim()
    .toLowerCase();
  return (
    Boolean(normalized) && !["pending", "pending.", "tbd", "tbd.", "n/a", "n/a.", "none", "none."].includes(normalized)
  );
}

function isReviewer(value) {
  return /^(?:\/root(?:\/[a-z0-9_/-]+)?|human:[A-Za-z0-9_-]+)$/.test(String(value || ""));
}

function validDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function expectedTrackerStatus(phase) {
  if (phase === "Done") return "Complete";
  if (phase === "Proposed") return "Proposed";
  if (["Blocked", "Deferred"].includes(phase)) return phase;
  return "Active";
}

function requiredStages(phase) {
  const lastIndex = {
    Clarifying: 0,
    Planned: 4,
    Approved: 4,
    Building: 5,
    Validating: 5,
    Reviewing: 8,
    Done: 9
  }[phase];
  return Number.isInteger(lastIndex) ? stageNames.slice(0, lastIndex + 1) : [];
}

function validateStage(feature, stageName, now) {
  const errors = [];
  const fields = feature.stages[stageName] || {};

  if (!isReviewer(fields.Reviewer)) {
    errors.push(`${stageName}: add a valid Reviewer.`);
  } else if (independentStages.has(stageName) && fields.Reviewer === "/root") {
    errors.push(`${stageName}: reviewer must be independent of /root.`);
  }

  if (!validDate(fields.Completed) || Date.parse(`${fields.Completed}T00:00:00Z`) > now.getTime()) {
    errors.push(`${stageName}: add a valid non-future Completed date.`);
  }

  if (fields.Result !== "Pass") {
    errors.push(`${stageName}: Result must be Pass.`);
  }

  if (!isMeaningful(fields.Evidence)) {
    errors.push(`${stageName}: add concrete Evidence; placeholders do not count.`);
  }

  return errors;
}

function validateChecklist(feature) {
  const errors = [];
  const expectedHeaders = ["Area", "Applicability", "Evidence"];

  if (JSON.stringify(feature.checklist.headers) !== JSON.stringify(expectedHeaders)) {
    errors.push("Review Scope Checklist: use the exact Area, Applicability, Evidence columns.");
    return errors;
  }
  if (feature.checklist.errors.length > 0) {
    errors.push(...feature.checklist.errors.map((error) => `Review Scope Checklist: ${error}.`));
  }

  const rows = new Map(feature.checklist.rows.map((row) => [row.Area, row]));
  if (rows.size !== feature.checklist.rows.length) {
    errors.push("Review Scope Checklist: areas must be unique.");
  }
  checklistAreas.forEach((area) => {
    const row = rows.get(area);
    if (!row) {
      errors.push(`Review Scope Checklist: missing ${area}.`);
      return;
    }
    if (!["Reviewed", "Not Applicable"].includes(row.Applicability)) {
      errors.push(`Review Scope Checklist: ${area} applicability must be Reviewed or Not Applicable.`);
    }
    if (!isMeaningful(row.Evidence)) {
      errors.push(`Review Scope Checklist: ${area} requires evidence.`);
    }
  });

  feature.checklist.rows.forEach((row) => {
    if (!checklistAreas.includes(row.Area)) {
      errors.push(`Review Scope Checklist: unknown area ${row.Area || "<empty>"}.`);
    }
  });
  return errors;
}

function hasLinkedFollowUp(followUp) {
  return /^\[(?:B-\d{3}|E-\d{3}|decision-\d{3})\]\(\.\.\/(?:bugs\/B-\d{3}\.md|engineering\/E-\d{3}\.md|decisions\/decision-\d{3}-[a-z0-9-]+\.md)\)$/.test(
    String(followUp || "")
  );
}

function validateFindings(feature, options) {
  const errors = [];
  const section = String(feature.findingsSection || "").trim();
  if (section === "No material findings.") return errors;

  const table = parseMarkdownTable(section);
  if (JSON.stringify(table.headers) !== JSON.stringify(findingHeaders)) {
    return ["Material Findings: use the exact governed findings columns or 'No material findings.'."];
  }
  if (table.errors.length > 0) {
    errors.push(...table.errors.map((error) => `Material Findings: ${error}.`));
  }
  if (table.rows.length === 0) {
    return ["Material Findings: record at least one finding or use 'No material findings.'."];
  }

  const ids = new Set();
  table.rows.forEach((row) => {
    const label = row.ID || "<missing ID>";
    if (!new RegExp(`^${feature.id}-R\\d{3}$`).test(row.ID) || ids.has(row.ID)) {
      errors.push(`${label}: finding ID must be unique and feature-prefixed.`);
    }
    ids.add(row.ID);

    if (!stageNames.includes(row.Stage)) errors.push(`${label}: unknown Stage.`);
    if (!isReviewer(row.Reviewer)) errors.push(`${label}: invalid Reviewer.`);
    else if (independentStages.has(row.Stage) && row.Reviewer === "/root") {
      errors.push(`${label}: reviewer must be independent of /root for ${row.Stage}.`);
    }
    if (!["Critical", "High", "Medium", "Low"].includes(row.Severity)) errors.push(`${label}: invalid Severity.`);
    if (!isMeaningful(row.Finding)) errors.push(`${label}: Finding is required.`);
    if (!isMeaningful(row.Recommendation)) errors.push(`${label}: Recommendation is required.`);
    if (!isMeaningful(row.Evidence)) errors.push(`${label}: Evidence is required.`);
    if (!["Fixed", "Accepted", "Deferred", "Rejected"].includes(row.Disposition)) {
      errors.push(`${label}: invalid Disposition.`);
    }

    if (["Critical", "High"].includes(row.Severity) && row.Disposition !== "Fixed") {
      errors.push(`${label}: Critical and High findings must be Fixed.`);
    }
    if (row.Severity === "Medium" && !["Fixed", "Accepted", "Deferred"].includes(row.Disposition)) {
      errors.push(`${label}: Medium findings must be Fixed, Accepted, or Deferred.`);
    }

    if (["Accepted", "Deferred"].includes(row.Disposition)) {
      if (row["Approved By"] !== "human:user")
        errors.push(`${label}: accepted/deferred findings require human:user approval.`);
      const followUpValid = (options.followUpExists || hasLinkedFollowUp)(row["Follow-up"]);
      if (!followUpValid)
        errors.push(`${label}: accepted/deferred findings require an existing B-, E-, or decision follow-up.`);
      if (!validDate(row["Review By"])) {
        errors.push(`${label}: accepted/deferred findings require a valid Review By date.`);
      } else if (row["Review By"] < options.now.toISOString().slice(0, 10)) {
        errors.push(`${label}: Review By date is expired.`);
      }
      if (!isMeaningful(row["Residual Risk"]))
        errors.push(`${label}: accepted/deferred findings require residual risk.`);
    } else {
      const residualRisk = String(row["Residual Risk"] || "").trim();
      if (residualRisk !== "None" && !isMeaningful(residualRisk)) {
        errors.push(`${label}: Residual Risk is required; use None when no risk remains.`);
      }
    }
  });
  return errors;
}

function validateFeature(feature, trackerEntry, options = {}) {
  const now = options.now || new Date();
  const errors = [];
  const isLegacy = Boolean(options.isLegacy);

  if (!feature.id || feature.id !== trackerEntry.id) errors.push("Document ID does not match the tracker.");
  if (!feature.title) errors.push("Feature title is missing.");
  else if (feature.title !== trackerEntry.title) errors.push("Document title does not match the tracker.");
  if (!feature.phase || feature.phase !== trackerEntry.phase)
    errors.push("Document Status does not match tracker Phase.");
  if (trackerEntry.status !== expectedTrackerStatus(trackerEntry.phase))
    errors.push("Tracker Status is inconsistent with tracker Phase.");

  if (trackerEntry.phase === "Proposed") {
    if (feature.harnessVersion && feature.harnessVersion !== 1) errors.push("Harness Version must be 1.");
    return { errors };
  }
  if (isLegacy) return { errors };

  if (feature.harnessVersion !== 1) errors.push("Add Harness Version: 1 before leaving Proposed.");

  if (trackerEntry.phase === "Blocked") {
    requiredStages("Clarifying").forEach((name) => errors.push(...validateStage(feature, name, now)));
    if (!isMeaningful(feature.blockerEvidence))
      errors.push("Blocked features require meaningful ## Blockers evidence.");
    return { errors };
  }
  if (trackerEntry.phase === "Deferred") {
    requiredStages("Clarifying").forEach((name) => errors.push(...validateStage(feature, name, now)));
    if (!isMeaningful(feature.deferralEvidence))
      errors.push("Deferred features require meaningful ## Deferral Notes evidence.");
    return { errors };
  }

  requiredStages(trackerEntry.phase).forEach((name) => errors.push(...validateStage(feature, name, now)));
  if (["Planned", "Approved", "Building", "Validating", "Reviewing", "Done"].includes(trackerEntry.phase)) {
    errors.push(...validateChecklist(feature));
  }
  if (["Reviewing", "Done"].includes(trackerEntry.phase)) {
    if (!feature.findingsSection) errors.push("Add ## Material Findings before review completion.");
    else errors.push(...validateFindings(feature, { followUpExists: options.followUpExists, now }));
  }
  return { errors };
}

function validateLegacyBaseline(baseline) {
  const errors = [];
  const features = baseline && baseline.features && typeof baseline.features === "object" ? baseline.features : {};
  const ids = Object.keys(features).sort();
  if (!baseline || baseline.version !== 1) errors.push("Harness baseline version must be 1.");
  if (JSON.stringify(ids) !== JSON.stringify([...legacyFeatureIds].sort())) {
    errors.push(`Legacy feature set must be exactly: ${legacyFeatureIds.join(", ")}.`);
  }
  ids.forEach((id) => {
    if (!isMeaningful(features[id].document) || !isMeaningful(features[id].reason)) {
      errors.push(`${id}: legacy baseline requires document and reason.`);
    }
  });
  return { errors };
}

module.exports = {
  expectedTrackerStatus,
  findingHeaders,
  legacyFeatureIds,
  requiredStages,
  stageNames,
  validateFeature,
  validateFindings,
  validateLegacyBaseline
};
