"use strict";

const fs = require("node:fs");
const path = require("node:path");

const requiredRoots = ["server", "public", "scripts"];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function countPhysicalLines(content) {
  if (content.length === 0) {
    return 0;
  }

  const lines = content.split(/\r?\n/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function findJavaScriptFiles(rootDir, roots) {
  const files = [];

  function visit(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(toPosix(path.relative(rootDir, entryPath)));
      }
    });
  }

  roots.forEach((root) => {
    const directory = path.join(rootDir, root);

    if (fs.existsSync(directory)) {
      visit(directory);
    }
  });

  return files.sort();
}

function validateModuleBaseline(rootDir, baseline) {
  const errors = [];
  const roots = Array.isArray(baseline.roots) ? baseline.roots : [];
  const modules = baseline.modules && typeof baseline.modules === "object" ? baseline.modules : {};
  const actualFiles = findJavaScriptFiles(rootDir, requiredRoots);
  const actualSet = new Set(actualFiles);

  if (baseline.version !== 1) {
    errors.push("Module baseline version must be 1.");
  }

  if (JSON.stringify(roots) !== JSON.stringify(requiredRoots)) {
    errors.push(`Module baseline roots must be exactly: ${requiredRoots.join(", ")}.`);
  }

  actualFiles.forEach((filePath) => {
    const entry = modules[filePath];

    if (!entry) {
      errors.push(`Unrecorded module: ${filePath}`);
      return;
    }

    if (!String(entry.responsibility || "").trim()) {
      errors.push(`${filePath} has no responsibility.`);
    }

    if (
      entry.temporaryException &&
      (!/^E-\d{3}$/.test(String(entry.temporaryException.engineeringId || "")) ||
        !String(entry.temporaryException.reason || "").trim())
    ) {
      errors.push(`${filePath} has an invalid temporary exception.`);
    }

    if (!Number.isInteger(entry.baselineLines) || entry.baselineLines < 0) {
      errors.push(`${filePath} has an invalid baseline line count.`);
      return;
    }

    const content = fs.readFileSync(path.join(rootDir, filePath), "utf8");
    const actualLines = countPhysicalLines(content);

    if (actualLines > entry.baselineLines) {
      errors.push(`${filePath} grew from ${entry.baselineLines} to ${actualLines} lines.`);
    } else if (actualLines < entry.baselineLines) {
      errors.push(
        `${filePath} decreased from ${entry.baselineLines} to ${actualLines} lines; lower the baseline to preserve the ratchet.`
      );
    }
  });

  Object.keys(modules)
    .sort()
    .forEach((filePath) => {
      if (!actualSet.has(filePath)) {
        errors.push(`Missing module: ${filePath}`);
      }
    });

  return {
    errors,
    moduleCount: actualFiles.length
  };
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const baselinePath = path.join(rootDir, "quality", "module-baseline.json");

  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    const result = validateModuleBaseline(rootDir, baseline);

    if (result.errors.length > 0) {
      console.error("Module baseline check failed:");
      result.errors.forEach((error) => console.error(`- ${error}`));
      return 1;
    }

    console.log(`Module baseline passed (${result.moduleCount} modules).`);
    return 0;
  } catch (error) {
    console.error(`Module baseline check failed: ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  countPhysicalLines,
  findJavaScriptFiles,
  requiredRoots,
  validateModuleBaseline
};
