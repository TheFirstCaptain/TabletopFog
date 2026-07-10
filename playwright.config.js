"use strict";

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "test-results",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  reporter: "line",
  retries: 0,
  testDir: "browser-test",
  timeout: 20_000,
  use: {
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  workers: 4
});
