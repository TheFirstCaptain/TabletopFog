"use strict";

const phaseNames = [
  "Proposed",
  "Clarifying",
  "Planned",
  "Approved",
  "Building",
  "Validating",
  "Reviewing",
  "Done",
  "Blocked",
  "Deferred"
];

function stripFencedCode(markdown) {
  const output = [];
  let fence = null;

  markdown.split(/\r?\n/).forEach((line) => {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (opening) {
        fence = { character: opening[1][0], length: opening[1].length };
        output.push("");
      } else {
        output.push(line);
      }
      return;
    }

    const closing = new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`);
    if (closing.test(line)) fence = null;
    output.push("");
  });

  return output.join("\n");
}

function extractSection(markdown, heading) {
  const level = heading.match(/^#+/)[0].length;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}\\s*$`, "m").exec(markdown);

  if (!match) {
    return null;
  }

  const bodyStart = match.index + match[0].length;
  const remainder = markdown.slice(bodyStart);
  const nextHeading = new RegExp(`^#{1,${level}}\\s+`, "m").exec(remainder);
  return remainder.slice(0, nextHeading ? nextHeading.index : undefined).trim();
}

function parseFields(section) {
  const fields = {};

  String(section || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^- ([^:]+):\s*(.*)$/.exec(line.trim());
      if (match) {
        fields[match[1].trim()] = match[2].trim();
      }
    });

  return fields;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseMarkdownTable(section) {
  const lines = String(section || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"));

  if (lines.length < 2) {
    return { errors: [], headers: [], rows: [] };
  }

  const headers = splitTableRow(lines[0]);
  const separator = splitTableRow(lines[1]);
  const errors = [];
  if (separator.length !== headers.length || separator.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    errors.push("table separator must contain one Markdown delimiter for every column");
  }
  const rows = lines.slice(2).map((line, rowIndex) => {
    const cells = splitTableRow(line);
    if (cells.length !== headers.length) {
      errors.push(`table row ${rowIndex + 1} must contain exactly ${headers.length} cells`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });

  return { errors, headers, rows };
}

function normalizeDocumentStatus(section) {
  const value = String(section || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!value) {
    return null;
  }

  if (/^Complete(?:\s|\.|$)/i.test(value)) {
    return "Done";
  }

  return phaseNames.find((phase) => new RegExp(`^${phase}(?:\\s|\\.|$)`, "i").test(value)) || null;
}

function parseFeatureDocument(markdown, filePath) {
  const clean = stripFencedCode(markdown);
  const titleMatch = /^# (F-\d{3}[A-Z]?):\s*(.+)$/m.exec(clean);
  const compliance = extractSection(clean, "## Harness Compliance");
  const evidence = extractSection(clean, "## SDLC Evidence") || "";
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
  const stages = Object.fromEntries(
    stageNames.map((name) => [name, parseFields(extractSection(evidence, `### ${name}`))])
  );
  const versionMatch = /(?:^|\n)-?\s*Harness Version:\s*(\d+)\s*$/m.exec(compliance || "");

  return {
    blockerEvidence: extractSection(clean, "## Blockers"),
    checklist: parseMarkdownTable(extractSection(clean, "## Review Scope Checklist")),
    clarificationNotes: extractSection(clean, "## Clarification Notes"),
    deferralEvidence: extractSection(clean, "## Deferral Notes"),
    filePath,
    findingsSection: extractSection(clean, "## Material Findings"),
    harnessVersion: versionMatch ? Number(versionMatch[1]) : null,
    id: titleMatch ? titleMatch[1] : null,
    phase: normalizeDocumentStatus(extractSection(clean, "## Status")),
    stages,
    title: titleMatch ? titleMatch[2].trim() : null
  };
}

function parseFeatureTracker(markdown) {
  const entries = [];

  markdown.split(/\r?\n/).forEach((line) => {
    if (!/^\| F-\d{3}[A-Z]? \|/.test(line)) {
      return;
    }

    const cells = splitTableRow(line);
    const link = /\[[^\]]+\]\(([^)]+)\)/.exec(cells[4] || "");
    entries.push({
      document: link ? link[1] : null,
      id: cells[0],
      phase: cells[3],
      status: cells[2],
      title: cells[1]
    });
  });

  return entries;
}

module.exports = {
  extractSection,
  parseFeatureDocument,
  parseFeatureTracker,
  parseFields,
  parseMarkdownTable,
  phaseNames,
  stripFencedCode
};
