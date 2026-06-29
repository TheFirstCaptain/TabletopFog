"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { PNG_BYTES } = require("../test-support/fixtures");
const { expect, test } = require("./fixtures");

const palette = {
  accent: "#6b3e24",
  accentStrong: "#4a2918",
  border: "#9b7b4f",
  danger: "#8c1d2c",
  dangerSurface: "#f5d8d2",
  focus: "#1f5e73",
  muted: "#685843",
  page: "#e8d8b5",
  panel: "#f7ebcf",
  stage: "#14110f",
  stageText: "#c9b17f",
  strongSurface: "#e3d0a8",
  text: "#2b2118"
};

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => channel(Number.parseInt(value, 16)));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("loads the local fantasy theme with accessible desktop and narrow layouts", async ({ app, page }) => {
  const stylesheet = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");
  expect(stylesheet).not.toMatch(/@keyframes|\b(?:animation|transition)(?:-[\w-]+)?\s*:/);

  fs.mkdirSync(path.join(app.dataRoot, "Broken Campaign"));
  fs.writeFileSync(path.join(app.dataRoot, "Broken Campaign", "campaign.json"), "{not-json");
  const fontResponses = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".woff2")) fontResponses.push(response);
  });

  await page.goto(`${app.baseURL}/gm`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1, name: "Campaign Library" })).toBeVisible();
  await expect(page.getByText(/Skipped campaign "Broken Campaign"/)).toBeVisible();

  expect(fontResponses).toHaveLength(1);
  expect(fontResponses[0].url()).toBe(`${app.baseURL}/assets/fonts/EBGaramond-Variable-Latin.woff2`);
  expect(fontResponses[0].status()).toBe(200);
  expect(await page.evaluate(() => document.fonts.check('600 16px "EB Garamond"'))).toBe(true);

  const styles = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const heading = getComputedStyle(document.querySelector("h1"));
    const body = getComputedStyle(document.body);
    const button = getComputedStyle(document.querySelector("button"));
    const diagnostic = getComputedStyle(document.querySelector(".library-diagnostic"));
    return {
      bodyFont: body.fontFamily,
      buttonFont: button.fontFamily,
      diagnosticBackground: diagnostic.backgroundColor,
      diagnosticColor: diagnostic.color,
      headingFont: heading.fontFamily,
      tokens: {
        accent: root.getPropertyValue("--accent").trim(),
        accentStrong: root.getPropertyValue("--accent-strong").trim(),
        border: root.getPropertyValue("--border").trim(),
        danger: root.getPropertyValue("--danger").trim(),
        dangerSurface: root.getPropertyValue("--danger-surface").trim(),
        focus: root.getPropertyValue("--focus").trim(),
        muted: root.getPropertyValue("--muted").trim(),
        page: root.getPropertyValue("--background").trim(),
        panel: root.getPropertyValue("--surface").trim(),
        stage: root.getPropertyValue("--stage").trim(),
        stageText: root.getPropertyValue("--stage-text").trim(),
        strongSurface: root.getPropertyValue("--surface-strong").trim(),
        text: root.getPropertyValue("--text").trim()
      }
    };
  });

  expect(styles.tokens).toEqual(palette);
  expect(styles.headingFont).toMatch(/^"EB Garamond"/);
  expect(styles.bodyFont).not.toMatch(/^"EB Garamond"/);
  expect(styles.buttonFont).not.toMatch(/^"EB Garamond"/);
  expect(styles.diagnosticBackground).toBe("rgb(245, 216, 210)");
  expect(styles.diagnosticColor).toBe("rgb(140, 29, 44)");

  expect(contrast(palette.text, palette.page)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.muted, palette.page)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.danger, palette.dangerSurface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast("#ffffff", palette.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.accentStrong, palette.panel)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.border, palette.panel)).toBeGreaterThanOrEqual(3);
  expect(contrast(palette.focus, palette.panel)).toBeGreaterThanOrEqual(3);
  expect(contrast(palette.stageText, palette.stage)).toBeGreaterThanOrEqual(4.5);

  await page.keyboard.press("Tab");
  const focus = await page.getByLabel("New campaign").evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      color: computed.outlineColor,
      style: computed.outlineStyle,
      width: computed.outlineWidth
    };
  });
  expect(focus.style).not.toBe("none");
  expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
  expect(focus.color).toBe("rgb(31, 94, 115)");

  await page.getByLabel("New campaign").fill("The Long Walk");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Manage Encounters" }).click();
  await page.getByLabel("Add map").setInputFiles({
    buffer: PNG_BYTES,
    mimeType: "image/png",
    name: "forest.png"
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  const shownCardStyles = await page.locator(".encounter-card[data-shown='true']").evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    statusColor: getComputedStyle(element.querySelector(".status-pill")).color
  }));
  expect(shownCardStyles).toEqual({
    background: "rgb(227, 208, 168)",
    statusColor: "rgb(255, 255, 255)"
  });
  expect(contrast(palette.muted, palette.strongSurface)).toBeGreaterThanOrEqual(4.5);

  const libraryButton = page.getByRole("button", { name: "Back to Campaign Library" });
  await libraryButton.hover();
  const secondaryHover = await libraryButton.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      color: computed.color
    };
  });
  expect(secondaryHover).toEqual({
    background: "rgb(74, 41, 24)",
    color: "rgb(255, 255, 255)"
  });
  expect(contrast("#ffffff", palette.accentStrong)).toBeGreaterThanOrEqual(4.5);

  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto(`${app.baseURL}/player`);
  const playerStyles = await page.evaluate(() => {
    const bar = getComputedStyle(document.querySelector(".player-status-bar"));
    const stage = getComputedStyle(document.querySelector(".map-stage"));
    const controls = getComputedStyle(document.querySelector(".viewport-controls"));
    const zoomButton = getComputedStyle(document.querySelector("#zoom-in"));
    const statusBar = document.querySelector(".player-status-bar").getBoundingClientRect();
    const mapStage = document.querySelector(".map-stage").getBoundingClientRect();
    return {
      barBackground: bar.backgroundColor,
      barColor: bar.color,
      barHeight: statusBar.height,
      barWrap: bar.flexWrap,
      controlsGap: controls.gap,
      mapStageHeight: mapStage.height,
      stageBackground: stage.backgroundColor,
      zoomButtonMinHeight: zoomButton.minHeight,
      zoomButtonMinWidth: zoomButton.minWidth
    };
  });
  expect(playerStyles.barBackground).toBe("rgb(247, 235, 207)");
  expect(playerStyles.barColor).toBe("rgb(43, 33, 24)");
  expect(playerStyles.barWrap).toBe("wrap");
  expect(playerStyles.controlsGap).toBe("6px");
  expect(playerStyles.stageBackground).toBe("rgb(20, 17, 15)");
  expect(playerStyles.zoomButtonMinHeight).toBe("36px");
  expect(playerStyles.zoomButtonMinWidth).toBe("36px");
  expect(playerStyles.barHeight).toBeLessThan(96);
  expect(playerStyles.mapStageHeight).toBeGreaterThan(844 * 0.72);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keeps the GM workflow usable when the local font fails", async ({ app, page }) => {
  let fontRequestCount = 0;
  await page.route("**/*.woff2", (route) => {
    fontRequestCount += 1;
    return route.abort();
  });

  await page.goto(`${app.baseURL}/gm`);
  await expect(page.getByRole("heading", { level: 1, name: "Campaign Library" })).toBeVisible();
  await expect(page.getByLabel("New campaign")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  expect(fontRequestCount).toBe(1);
  expect(
    await page.getByRole("heading", { level: 1 }).evaluate((element) => getComputedStyle(element).fontFamily)
  ).toBe('"EB Garamond", Georgia, "Times New Roman", serif');

  await page.getByLabel("New campaign").fill("Fallback Campaign");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Fallback Campaign" })).toBeVisible();
});
