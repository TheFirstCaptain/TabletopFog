"use strict";

const js = require("@eslint/js");
const globals = require("globals");

const unusedVariables = [
  "error",
  {
    argsIgnorePattern: "^_",
    caughtErrorsIgnorePattern: "^_"
  }
];

module.exports = [
  {
    ignores: ["certs/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: [
      "eslint.config.js",
      "playwright.config.js",
      "browser-test/**/*.js",
      "quality/**/*.js",
      "scripts/**/*.js",
      "server/**/*.js",
      "test-support/**/*.js",
      "test/**/*.js"
    ],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "commonjs"
    },
    rules: {
      "no-unused-vars": unusedVariables
    }
  },
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        io: "readonly"
      },
      sourceType: "script"
    },
    rules: {
      "no-unused-vars": unusedVariables
    }
  },
  {
    files: ["browser-test/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  {
    files: ["public/gm*.js"],
    languageOptions: {
      sourceType: "module"
    }
  }
];
