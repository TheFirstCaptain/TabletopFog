"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { PNG_BYTES } = require("../test-support/fixtures");
const { expect, test } = require("./fixtures");

const pngFile = (name) => ({
  buffer: PNG_BYTES,
  mimeType: "image/png",
  name
});

async function sizedPngFile(page, name, width, height, leftColor = "#d9b978", rightColor = "#704020") {
  const dataUrl = await page.evaluate(
    ({ firstColor, height: imageHeight, secondColor, width: imageWidth }) => {
      const canvas = document.createElement("canvas");
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = secondColor;
      context.fillRect(0, 0, imageWidth, imageHeight);
      context.fillStyle = firstColor;
      context.fillRect(0, 0, imageWidth / 2, imageHeight);
      return canvas.toDataURL("image/png");
    },
    { firstColor: leftColor, height, secondColor: rightColor, width }
  );

  return {
    buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
    mimeType: "image/png",
    name
  };
}

async function openGm(page, baseURL) {
  await page.goto(`${baseURL}/gm`);
  await expectGmHeader(page, "Campaign Library");
  await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(0);
}

async function createCampaign(page, name = "The Long Walk") {
  await page.getByLabel("New campaign").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expectGmHeader(page, `Campaign Library / ${name}`);
  await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

async function expectGmHeader(page, breadcrumbText, statusText = "Live") {
  await expect(page.getByRole("heading", { level: 1, name: "TABLETOPFOG" })).toBeVisible();
  await expect(page.getByLabel("Breadcrumb")).toHaveText(breadcrumbText);
  await expect(page.getByText(statusText, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const headerLayout = await page.evaluate(() => {
    const brand = document.querySelector(".app-brand").getBoundingClientRect();
    const breadcrumb = document.querySelector("#breadcrumb").getBoundingClientRect();
    const header = document.querySelector(".page-header").getBoundingClientRect();
    const status = document.querySelector("#connection-status").getBoundingClientRect();
    return {
      brandBeforeBreadcrumb: brand.right <= breadcrumb.left,
      headerCompact: header.height < 64,
      sameRow:
        Math.abs(brand.top - breadcrumb.top) < 8 &&
        Math.abs(brand.top - status.top) < 8 &&
        Math.abs(breadcrumb.top - status.top) < 8,
      statusRight: status.left > breadcrumb.left,
      statusWithinHeader: status.right <= header.right + 1
    };
  });
  expect(headerLayout).toEqual({
    brandBeforeBreadcrumb: true,
    headerCompact: true,
    sameRow: true,
    statusRight: true,
    statusWithinHeader: true
  });
}

async function uploadMapFile(page, file, expectedName = file.name.replace(/\.png$/, "")) {
  await expect(page.locator("#map-form")).toBeVisible();
  await page.getByLabel("Add map").setInputFiles(file);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("textbox", { name: `Encounter name for ${expectedName}` })).toBeVisible();
}

async function addMap(page, name) {
  await uploadMapFile(page, pngFile(name));
}

function writeCampaignRecord(dataRoot, folderName, campaign) {
  const campaignDirectory = path.join(dataRoot, folderName);
  fs.mkdirSync(campaignDirectory, { recursive: true });
  fs.writeFileSync(path.join(campaignDirectory, "campaign.json"), `${JSON.stringify(campaign, null, 2)}\n`);
}

function rgbFromHex(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgb(${channels.join(", ")})`;
}

async function sampleMapPixel(page, selector, point) {
  return page.locator(selector).evaluate((canvas, normalizedPoint) => {
    const drawX = Number(canvas.dataset.drawX);
    const drawY = Number(canvas.dataset.drawY);
    const drawWidth = Number(canvas.dataset.drawWidth);
    const drawHeight = Number(canvas.dataset.drawHeight);
    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;
    const x = Math.round((drawX + drawWidth * normalizedPoint.x) * scaleX);
    const y = Math.round((drawY + drawHeight * normalizedPoint.y) * scaleY);
    const [red, green, blue, alpha] = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
    return { alpha, blue, green, red, x, y };
  }, point);
}

async function mapClientPoint(page, selector, point) {
  return page.locator(selector).evaluate((canvas, normalizedPoint) => {
    const bounds = canvas.getBoundingClientRect();
    const drawX = Number(canvas.dataset.drawX);
    const drawY = Number(canvas.dataset.drawY);
    const drawWidth = Number(canvas.dataset.drawWidth);
    const drawHeight = Number(canvas.dataset.drawHeight);
    return {
      x: bounds.left + drawX + drawWidth * normalizedPoint.x,
      y: bounds.top + drawY + drawHeight * normalizedPoint.y
    };
  }, point);
}

async function dragMapRectangle(page, selector, start, end) {
  const startPoint = await mapClientPoint(page, selector, start);
  const endPoint = await mapClientPoint(page, selector, end);
  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 4 });
  await page.mouse.up();
}

async function clickMapPoint(page, selector, point) {
  const clientPoint = await mapClientPoint(page, selector, point);
  await page.mouse.click(clientPoint.x, clientPoint.y);
}

async function dragFromStagePoint(page, stageSelector, start, end) {
  const startPoint = await page.locator(stageSelector).evaluate((stage, point) => {
    const bounds = stage.getBoundingClientRect();
    return { x: bounds.left + point.x, y: bounds.top + point.y };
  }, start);
  const endPoint = await page.locator(stageSelector).evaluate((stage, point) => {
    const bounds = stage.getBoundingClientRect();
    return { x: bounds.left + point.x, y: bounds.top + point.y };
  }, end);
  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 4 });
  await page.mouse.up();
}

async function waitForCanvasFrame(page, selector) {
  await page.locator(selector).evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
}

async function canvasViewport(page, selector) {
  return page.locator(selector).evaluate((canvas) => ({
    drawHeight: Number(canvas.dataset.drawHeight),
    drawWidth: Number(canvas.dataset.drawWidth),
    drawX: Number(canvas.dataset.drawX),
    drawY: Number(canvas.dataset.drawY),
    fogMaskBuilds: Number(canvas.dataset.fogMaskBuilds),
    fogOperations: Number(canvas.dataset.fogOperations),
    panX: Number(canvas.dataset.panX),
    panY: Number(canvas.dataset.panY),
    zoom: Number(canvas.dataset.zoom)
  }));
}

async function markEncounterGalleryNodes(page) {
  await page.evaluate(() => {
    window.__tabletopFogMarkedEncounterCards = Array.from(document.querySelectorAll(".encounter-card"));
  });
}

async function expectEncounterGalleryNodesUnchanged(page) {
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(() => {
      const currentCards = Array.from(document.querySelectorAll(".encounter-card"));
      const markedCards = window.__tabletopFogMarkedEncounterCards || [];
      return (
        currentCards.length === markedCards.length && currentCards.every((card, index) => card === markedCards[index])
      );
    })
  ).toBe(true);
}

function colorDistance(left, right) {
  return Math.abs(left.red - right.red) + Math.abs(left.green - right.green) + Math.abs(left.blue - right.blue);
}

test("GM creates, reopens, uploads, renames, and reorders campaign maps", async ({ app, page }) => {
  await openGm(page, app.baseURL);
  await expect(page.getByText(app.dataRoot, { exact: true })).toHaveCount(0);
  await createCampaign(page);
  await expect(page.getByText("Add an encounter map to begin.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage Encounters" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done Managing" })).toHaveCount(0);

  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "The Long Walk" })).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByLabel("Breadcrumb")).toHaveText("Campaign Library / The Long Walk");
  await expect(page.getByRole("heading", { level: 2, name: "The Long Walk" })).toBeVisible();

  await page.getByLabel("Add map").setInputFiles({
    buffer: Buffer.from("not-an-image"),
    mimeType: "image/png",
    name: "invalid.png"
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/supported map image/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Encounter name for/ })).toHaveCount(0);

  await addMap(page, "forest.png");
  await addMap(page, "cave.png");

  const forestName = page.getByRole("textbox", { name: "Encounter name for forest" });
  await forestName.fill("Forest Ambush");
  await page.getByRole("button", { name: "Rename forest" }).click();
  await expect(page.getByRole("textbox", { name: "Encounter name for Forest Ambush" })).toHaveValue("Forest Ambush");

  await page.getByRole("button", { name: "Move cave up" }).click();
  await expect
    .poll(() =>
      page
        .getByRole("textbox", { name: /^Encounter name for/ })
        .evaluateAll((inputs) => inputs.map((input) => input.value))
    )
    .toEqual(["cave", "Forest Ambush"]);
  await expect(page.getByRole("button", { name: "Move cave up" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move Forest Ambush down" })).toBeDisabled();
});

test("GM can view and copy the Player Display URL", async ({ app, page, context }) => {
  await page.addInitScript(() => {
    window.__copiedPlayerUrls = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedPlayerUrls.push(text);
        }
      }
    });
  });

  await openGm(page, app.baseURL);
  const playerUrl = page.getByRole("textbox", { name: "Player Display URL" });
  await expect(playerUrl).toHaveValue(`${app.baseURL}/player`);
  await page.getByRole("button", { name: "Copy Player Display URL" }).click();
  await expect(page.getByText("Player URL copied.", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__copiedPlayerUrls)).toEqual([`${app.baseURL}/player`]);

  const player = await context.newPage();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(playerUrl).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("GM Player Display URL copy fallback keeps the URL selectable", async ({ app, page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined
    });
    document.execCommand = () => false;
  });

  await openGm(page, app.baseURL);
  const playerUrl = page.getByRole("textbox", { name: "Player Display URL" });
  await page.getByRole("button", { name: "Copy Player Display URL" }).click();
  await expect(page.getByText("Select and copy the Player URL.", { exact: true })).toBeVisible();
  await expect(playerUrl).toBeFocused();
  await expect(playerUrl).toHaveValue(`${app.baseURL}/player`);
});

test("GM edits campaign card details without changing player display", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await addMap(page, "forest.png");
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  const playerAssetRequestsBeforeMetadataEdit = playerAssetRequests;

  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  const card = page.locator(".campaign-card").filter({ hasText: "The Long Walk" });
  await expect(card.getByText("The Long Walk")).toBeVisible();
  await expect(card.getByText("1 map")).toBeVisible();
  await expect(card.getByText("🗺️")).toBeVisible();
  await card.getByRole("button", { name: "Edit campaign details" }).click();
  await card.getByRole("heading", { name: "The Long Walk" }).click();
  await expectGmHeader(page, "Campaign Library");
  await card.getByLabel("Campaign name").fill("The Longer Walk");
  await card.getByLabel("Campaign icon").fill("🛡️");
  await card.getByLabel("Campaign description").fill("Roads through a haunted borderland.");
  await card.getByRole("button", { name: "Save campaign details" }).click();
  const renamedCard = page.locator(".campaign-card").filter({ hasText: "The Longer Walk" });
  await expect(renamedCard.getByRole("heading", { name: "The Longer Walk" })).toBeVisible();
  await expect(renamedCard.getByText("Roads through a haunted borderland.")).toBeVisible();
  await expect(renamedCard.getByText("🛡️")).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeMetadataEdit);

  await renamedCard.getByRole("button", { name: "Edit campaign details" }).click();
  await renamedCard.getByLabel("Campaign name").fill("???");
  await renamedCard.getByRole("button", { name: "Save campaign details" }).click();
  await expect(renamedCard.getByText(/valid campaign name/i)).toBeVisible();
  await expect(renamedCard.getByRole("heading", { name: "The Longer Walk" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeMetadataEdit);

  await page.reload();
  await expectGmHeader(page, "Campaign Library");
  const reloadedCard = page.locator(".campaign-card").filter({ hasText: "The Longer Walk" });
  await expect(reloadedCard.getByText("Roads through a haunted borderland.")).toBeVisible();
  await expect(reloadedCard.getByText("🛡️")).toBeVisible();
  await reloadedCard.click();
  await expect(page.getByRole("heading", { level: 2, name: "The Longer Walk" })).toBeVisible();
  await expect(page.getByLabel("Breadcrumb")).toHaveText("Campaign Library / The Longer Walk");
  await page.evaluate(async () => {
    const response = await fetch(`/api/campaigns/${encodeURIComponent("The Long Walk")}/metadata`, {
      body: JSON.stringify({
        description: "Current campaign metadata stays fresh.",
        icon: "🔥"
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });

    if (!response.ok) throw new Error("Metadata update failed.");
  });
  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  const refreshedCard = page.locator(".campaign-card").filter({ hasText: "The Longer Walk" });
  await expect(refreshedCard.getByText("Current campaign metadata stays fresh.")).toBeVisible();
  await expect(refreshedCard.getByText("🔥")).toBeVisible();
});

test("GM deletes only empty campaigns after confirmation", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await openGm(page, app.baseURL);
  await createCampaign(page, "Empty Campaign");
  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  await createCampaign(page, "Campaign With Maps");
  await addMap(page, "forest.png");
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  const playerAssetRequestsBeforeDelete = playerAssetRequests;
  await page.getByRole("button", { name: "Back to Campaign Library" }).click();

  const emptyCard = page.locator(".campaign-card").filter({ hasText: "Empty Campaign" });
  const filledCard = page.locator(".campaign-card").filter({ hasText: "Campaign With Maps" });

  await expect(emptyCard.getByRole("button", { name: "Delete Empty Campaign" })).toBeEnabled();
  await expect(filledCard.getByRole("button", { name: "Delete Campaign With Maps" })).toBeDisabled();
  await expect(filledCard.getByText("Delete this campaign's encounters before deleting the campaign.")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain('This permanently deletes "Empty Campaign".');
    await dialog.dismiss();
  });
  await emptyCard.getByRole("button", { name: "Delete Empty Campaign" }).click();
  await expect(emptyCard).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("This can't be undone.");
    await dialog.accept();
  });
  await emptyCard.getByRole("button", { name: "Delete Empty Campaign" }).click();

  await expect(emptyCard).toHaveCount(0);
  await expect(filledCard).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeDelete);
  await page.reload();
  await expect(page.locator(".campaign-card").filter({ hasText: "Empty Campaign" })).toHaveCount(0);
  await expect(page.locator(".campaign-card").filter({ hasText: "Campaign With Maps" })).toBeVisible();
});

test("campaign landing cards keep diagnostics and deferred controls out of scope", async ({ app, page }) => {
  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page, "A Very Long Campaign Name Across The Western Borderlands");
  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  await page.locator(".campaign-card").getByRole("button", { name: "Edit campaign details" }).click();
  await page.getByLabel("Campaign icon").fill("too long");
  await page.getByRole("button", { name: "Save campaign details" }).click();
  await expect(page.getByText(/Campaign icon must be one emoji or short symbol/i)).toBeVisible();

  const brokenDirectory = path.join(app.dataRoot, "Broken Campaign");
  fs.mkdirSync(brokenDirectory);
  fs.writeFileSync(path.join(brokenDirectory, "campaign.json"), "{not-json");
  await page.reload();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await expect(page.getByText(/Skipped campaign "Broken Campaign"/)).toBeVisible();
  await expect(page.locator("input[type='search']")).toHaveCount(0);
  await expect(page.getByLabel(/campaign image/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /member|character|token|fog|note|cloud|dashboard/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /member|character|token|fog|note|cloud|dashboard/i })).toHaveCount(0);
  await expect(
    page.locator("input, textarea, select").filter({ hasText: /member|character|token|fog|note|cloud/i })
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("GM sees recovery diagnostics while Player Display receives safe restored state", async ({
  app,
  page,
  context
}) => {
  const recoveredDirectory = path.join(app.dataRoot, "Recovered Campaign");
  fs.mkdirSync(path.join(recoveredDirectory, "maps"), { recursive: true });
  fs.writeFileSync(path.join(recoveredDirectory, "maps", "forest.png"), PNG_BYTES);
  writeCampaignRecord(app.dataRoot, "Recovered Campaign", {
    version: 1,
    name: "Recovered Campaign",
    activeMapId: "forest",
    maps: [
      {
        id: "forest",
        name: "Forest",
        file: "maps/forest.png",
        order: 1,
        fog: [{ type: "hide-rectangle", rect: { x: 0.95, y: 0.1, width: 0.2, height: 0.2 } }]
      }
    ]
  });

  writeCampaignRecord(app.dataRoot, "Missing Asset Campaign", {
    version: 1,
    name: "Missing Asset Campaign",
    activeMapId: "forest",
    maps: [{ id: "forest", name: "Forest", file: "maps/forest.png", order: 1, fog: [] }]
  });

  const player = await context.newPage();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByText("Waiting for GM.")).toBeVisible();

  await openGm(page, app.baseURL);
  await expect(page.locator(".campaign-card").filter({ hasText: "Recovered Campaign" })).toBeVisible();
  await expect(page.locator(".campaign-card").filter({ hasText: "Missing Asset Campaign" })).toBeVisible();

  await page
    .locator(".campaign-card")
    .filter({ hasText: "Recovered Campaign" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.getByText("Recovered 1 campaign issue. Original campaign files were not changed.")).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: Forest" })).toBeVisible();
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("0");

  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  await page
    .locator(".campaign-card")
    .filter({ hasText: "Missing Asset Campaign" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.getByText("Recovered 2 campaign issues. Original campaign files were not changed.")).toBeVisible();
  await expect(player.getByText("Waiting for GM.")).toBeVisible();
  await expect(player.getByText(app.dataRoot)).toHaveCount(0);
});

test("campaign cards keep long text, metadata, hover, and focus presentation restrained", async ({ app, page }) => {
  const longDescription =
    "Ancient roads, ruined towers, borderland villages, rival patrols, secret shrines, and weathered maps pull this campaign across the western marches at dusk now!!";
  const longCampaignName = "The Western Borderlands Expedition With A Very Long Campaign Title";
  const shownEncounterName = "Moonlit Causeway Beneath The Old Watchtower";
  writeCampaignRecord(app.dataRoot, "Amber Keep", {
    activeMapId: null,
    maps: [],
    name: "Amber Keep",
    version: 1
  });
  writeCampaignRecord(app.dataRoot, "Black River", {
    description: "A tighter campaign description.",
    icon: "🔥",
    activeMapId: null,
    maps: [],
    name: "Black River",
    version: 1
  });
  writeCampaignRecord(app.dataRoot, longCampaignName, {
    description: longDescription,
    icon: "🛡️",
    activeMapId: "causeway",
    maps: [
      {
        file: "maps/causeway.png",
        fog: [],
        id: "causeway",
        name: shownEncounterName,
        order: 1,
        originalFileName: "causeway.png"
      }
    ],
    name: longCampaignName,
    version: 1
  });
  fs.mkdirSync(path.join(app.dataRoot, longCampaignName, "maps"), { recursive: true });
  fs.writeFileSync(path.join(app.dataRoot, longCampaignName, "maps", "causeway.png"), PNG_BYTES);
  fs.mkdirSync(path.join(app.dataRoot, "Broken Campaign"));
  fs.writeFileSync(path.join(app.dataRoot, "Broken Campaign", "campaign.json"), "{not-json");

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await expect(page.locator(".campaign-card")).toHaveCount(3);
  await expect(page.getByText(/Skipped campaign "Broken Campaign"/)).toBeVisible();

  const longCard = page.locator(".campaign-card").filter({ hasText: longCampaignName });
  await expect(longCard.getByRole("heading", { name: longCampaignName })).toBeVisible();
  await expect(longCard.getByText(longDescription)).toBeVisible();
  await expect(longCard.locator(".campaign-card-meta")).toContainText(`Shown to Players: ${shownEncounterName}`);

  const expectedCardStyles = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      accent: rootStyle.getPropertyValue("--accent").trim(),
      focus: rootStyle.getPropertyValue("--focus").trim(),
      muted: rootStyle.getPropertyValue("--muted").trim(),
      surface: rootStyle.getPropertyValue("--surface").trim(),
      surfaceStrong: rootStyle.getPropertyValue("--surface-strong").trim()
    };
  });
  const presentation = await longCard.evaluate((card) => {
    const cardBox = card.getBoundingClientRect();
    const titleBox = card.querySelector("h3").getBoundingClientRect();
    const description = card.querySelector(".campaign-description");
    const descriptionBox = description.getBoundingClientRect();
    const descriptionStyle = getComputedStyle(description);
    const meta = card.querySelector(".campaign-card-meta");
    const metaBox = meta.getBoundingClientRect();
    const metaStyle = getComputedStyle(meta);
    return {
      descriptionBottomWithinCard: descriptionBox.bottom <= cardBox.bottom,
      descriptionClamp: descriptionStyle.webkitLineClamp,
      descriptionOverflow: descriptionStyle.overflow,
      descriptionWithinCard: descriptionBox.left >= cardBox.left && descriptionBox.right <= cardBox.right,
      metaColor: metaStyle.color,
      metaWithinCard: metaBox.left >= cardBox.left && metaBox.right <= cardBox.right,
      titleWithinCard: titleBox.left >= cardBox.left && titleBox.right <= cardBox.right
    };
  });
  expect(presentation).toEqual({
    descriptionBottomWithinCard: true,
    descriptionClamp: "2",
    descriptionOverflow: "hidden",
    descriptionWithinCard: true,
    metaColor: rgbFromHex(expectedCardStyles.muted),
    metaWithinCard: true,
    titleWithinCard: true
  });

  const beforeHover = await longCard.evaluate((card) => getComputedStyle(card).backgroundColor);
  const longCardBox = await longCard.boundingBox();
  if (!longCardBox) {
    throw new Error("Expected long campaign card to have a bounding box.");
  }
  await page.mouse.move(longCardBox.x + longCardBox.width / 2, longCardBox.y + longCardBox.height / 2);
  await expect.poll(() => longCard.evaluate((card) => card.matches(":hover"))).toBe(true);
  expect(beforeHover).toBe(rgbFromHex(expectedCardStyles.surface));
  await expect
    .poll(() =>
      longCard.evaluate((card) => {
        const computed = getComputedStyle(card);
        return {
          background: computed.backgroundColor,
          border: computed.borderColor
        };
      })
    )
    .toEqual({
      background: rgbFromHex(expectedCardStyles.surfaceStrong),
      border: rgbFromHex(expectedCardStyles.accent)
    });

  await longCard.getByRole("button", { name: "Open" }).focus();
  const focus = await longCard.getByRole("button", { name: "Open" }).evaluate((button) => {
    const computed = getComputedStyle(button);
    return {
      color: computed.outlineColor,
      style: computed.outlineStyle,
      width: computed.outlineWidth
    };
  });
  expect(focus).toEqual({
    color: rgbFromHex(expectedCardStyles.focus),
    style: "solid",
    width: "3px"
  });

  const emptyDescriptionCard = page.locator(".campaign-card").filter({ hasText: "Amber Keep" });
  await expect(emptyDescriptionCard.getByText("No description yet.")).toBeVisible();
  await emptyDescriptionCard.getByRole("button", { name: "Edit campaign details" }).click();
  await expect(emptyDescriptionCard.getByLabel("Campaign description")).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(emptyDescriptionCard.getByLabel("Campaign icon")).toBeVisible();
  await expect(emptyDescriptionCard.getByRole("button", { name: "Save campaign details" })).toBeVisible();

  await longCard.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 2, name: longCampaignName })).toBeVisible();
});

test("player follows active-map changes and remains read-only", async ({ app, page, context }) => {
  const player = await context.newPage();
  const secondPlayer = await context.newPage();
  await openGm(page, app.baseURL);
  await player.goto(`${app.baseURL}/player`);
  await secondPlayer.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("heading", { level: 1, name: "Player Display" })).toBeVisible();
  await expect(player.getByText("Live", { exact: true })).toBeVisible();
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();

  await createCampaign(page);
  await addMap(page, "forest.png");
  await addMap(page, "cave.png");

  await page.getByRole("button", { name: "Show to Players", exact: true }).first().click();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(secondPlayer.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await page.getByRole("button", { name: "Open forest for prep" }).click();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();

  await player.getByRole("button", { name: "Zoom in" }).click();
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("150%", { exact: true })).toBeVisible();
  await expect(secondPlayer.getByText("100%", { exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole("img", { name: "Map: forest" }).getAttribute("data-zoom")).toBe("1");

  for (let step = 0; step < 6; step += 1) {
    await player.getByRole("button", { name: "Zoom in" }).click();
  }
  await expect(player.getByText("300%", { exact: true })).toBeVisible();
  await expect(player.getByRole("button", { name: "Zoom in" })).toBeDisabled();

  const playerCanvas = player.getByRole("img", { name: "Map: forest" });
  const bounds = await playerCanvas.boundingBox();
  await player.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await player.mouse.down();
  await player.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 80);
  await player.mouse.up();
  await expect.poll(() => playerCanvas.getAttribute("data-pan-y")).not.toBe("0");

  const pointerPan = await playerCanvas.getAttribute("data-pan-y");
  await playerCanvas.focus();
  await player.keyboard.press("ArrowUp");
  await expect.poll(() => playerCanvas.getAttribute("data-pan-y")).not.toBe(pointerPan);

  await player.getByRole("button", { name: "Fit map" }).click();
  await expect(player.getByText("100%", { exact: true })).toBeVisible();
  await expect.poll(() => playerCanvas.getAttribute("data-pan-y")).toBe("0");

  await playerCanvas.evaluate((element) => {
    element.setPointerCapture = () => {};
    const dispatch = (type, pointerId, clientX, clientY) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX,
          clientY,
          pointerId
        })
      );
    const bounds = element.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    dispatch("pointerdown", 1, centerX - 50, centerY);
    dispatch("pointerdown", 2, centerX + 50, centerY);
    dispatch("pointermove", 2, centerX + 100, centerY);
    dispatch("pointerup", 1, centerX - 50, centerY);
    dispatch("pointerup", 2, centerX + 100, centerY);
  });
  await expect.poll(async () => Number(await playerCanvas.getAttribute("data-zoom"))).toBeGreaterThan(1);

  await player.getByRole("button", { name: "Fit map" }).click();
  await player.getByRole("button", { name: "Zoom out" }).click();
  await player.getByRole("button", { name: "Zoom out" }).click();
  await expect(player.getByText("50%", { exact: true })).toBeVisible();
  await expect(player.getByRole("button", { name: "Zoom out" })).toBeDisabled();

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  await expect(player.getByRole("img", { name: "Map: cave" })).toBeVisible();
  await expect(player.getByText("100%", { exact: true })).toBeVisible();
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  const mutation = await player.evaluate(async () => {
    const response = await fetch("/api/campaigns", {
      body: JSON.stringify({ name: "Player Mutation" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return { body: await response.json(), status: response.status };
  });
  expect(mutation).toEqual({ body: { error: "GM view required." }, status: 403 });
  await expect(page.getByRole("heading", { level: 2, name: "The Long Walk" })).toBeVisible();

  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("125%", { exact: true })).toBeVisible();
  await player.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("150%", { exact: true })).toBeVisible();
  await player.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await player.getByRole("img", { name: "Map: cave" }).evaluate((element) => {
    element.setPointerCapture = () => {};
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  });
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("150%", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: cave" })).not.toHaveAttribute("data-panning", "true");
  await player.reload();
  await expect(player.getByRole("img", { name: "Map: cave" })).toBeVisible();
  await expect(player.getByText("100%", { exact: true })).toBeVisible();
});

test("encounter cards open a workspace without changing the player display", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 120, 80, "#254117", "#6b8e23"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 120, 80, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await expect(forestCard.getByRole("img", { name: "Thumbnail for forest" })).toBeVisible();
  await expect(caveCard.getByRole("img", { name: "Thumbnail for cave" })).toBeVisible();

  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(forestCard.locator(".status-pill").filter({ hasText: "Shown to Players" })).toBeVisible();
  const playerAssetRequestsBeforeWorkspaceOpen = playerAssetRequests;

  await caveCard.getByRole("button", { name: "Open cave for prep" }).focus();
  await page.keyboard.press("Enter");
  await expectGmHeader(page, "Campaign Library / The Long Walk / cave");
  await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 3, name: "cave" })).toBeVisible();
  await expect(page.locator("#selected-encounter-status")).toContainText("Selected for Prep: cave");
  await expect(page.locator("#selected-encounter-status")).toContainText("Shown to Players: forest");
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeWorkspaceOpen);

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await expect(caveCard.getByText("Selected for Prep", { exact: true })).toBeVisible();
  await caveCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await expect(player.getByRole("img", { name: "Map: cave" })).toBeVisible();
  await expect(caveCard.locator(".status-pill").filter({ hasText: "Shown to Players" })).toBeVisible();
});

test("selected prep encounter can be deleted when it is not shown to players", async ({ app, page }) => {
  await openGm(page, app.baseURL);
  await createCampaign(page, "Single Delete Campaign");
  await uploadMapFile(page, await sizedPngFile(page, "solo.png", 120, 80, "#254117", "#6b8e23"));

  const soloCard = page.locator(".encounter-card").filter({ hasText: "solo" });
  await soloCard.getByRole("button", { name: "Open solo for prep" }).click();
  await expectGmHeader(page, "Campaign Library / Single Delete Campaign / solo");
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await expect(soloCard.getByText("Selected for Prep", { exact: true })).toBeVisible();

  await expect(soloCard.getByRole("button", { name: "Delete solo" })).toBeEnabled();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain('This permanently deletes the "solo" encounter.');
    expect(dialog.message()).not.toContain("map file");
    await dialog.accept();
  });
  await soloCard.getByRole("button", { name: "Delete solo" }).click();

  await expect(page.locator(".encounter-card")).toHaveCount(0);
  await expect(page.getByText("Add an encounter map to begin.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".encounter-card")).toHaveCount(0);
});

test("encounter gallery presentation remains browsable and responsive", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page, "Gallery Campaign");
  await expect(page.locator(".encounter-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage Encounters" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done Managing" })).toHaveCount(0);
  await expect(
    page.getByText("No encounters yet. Add an encounter map to start this campaign.", { exact: true })
  ).toBeVisible();
  await expect(page.locator("#map-form")).toBeVisible();
  await expect(page.locator("#map-list > #map-form")).toHaveCount(0);

  await uploadMapFile(page, await sizedPngFile(page, "wide-crossing.png", 240, 100, "#284b63", "#d9b978"));
  await uploadMapFile(page, await sizedPngFile(page, "tall-tower.png", 90, 180, "#2c2430", "#b08968"));
  await uploadMapFile(page, await sizedPngFile(page, "square-keep.png", 140, 140, "#254117"));

  const longEncounterName = "Moonlit Causeway Beneath The Old Watchtower And Broken Gate";
  const longNameInput = page.getByRole("textbox", { name: "Encounter name for wide-crossing" });
  await longNameInput.fill(longEncounterName);
  await page.getByRole("button", { name: "Rename wide-crossing" }).click();
  await expect(page.getByRole("textbox", { name: `Encounter name for ${longEncounterName}` })).toHaveValue(
    longEncounterName
  );
  await page.getByLabel("Add map").setInputFiles({
    buffer: Buffer.from("not-an-image"),
    mimeType: "image/png",
    name: "broken.png"
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/supported map image/i)).toBeVisible();

  const longCard = page.locator(".encounter-card").filter({ hasText: longEncounterName });
  const tallCard = page.locator(".encounter-card").filter({ hasText: "tall-tower" });
  const squareCard = page.locator(".encounter-card").filter({ hasText: "square-keep" });
  await expect(page.locator(".encounter-card")).toHaveCount(3);
  await squareCard.locator(".encounter-admin").click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("button", { name: "Done Managing" })).toHaveCount(0);
  await expectGmHeader(page, "Campaign Library / Gallery Campaign");

  await longCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: `Map: ${longEncounterName}` })).toBeVisible();
  await expect(longCard.locator(".status-pill").filter({ hasText: "Shown to Players" })).toBeVisible();
  const longShownButton = longCard.locator(".encounter-running").getByRole("button", {
    name: /Shown to Players - clear/
  });
  await expect(longShownButton).toBeEnabled();
  await longShownButton.click();
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: `Map: ${longEncounterName}` })).toBeHidden();
  await expect(page.locator(".status-pill").filter({ hasText: "Shown to Players" })).toHaveCount(0);
  await expect(longCard.getByRole("button", { name: "Show to Players", exact: true })).toBeVisible();
  await longCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await expect(player.getByRole("img", { name: `Map: ${longEncounterName}` })).toBeVisible();
  await expect(longCard.locator(".status-pill").filter({ hasText: "Shown to Players" })).toBeVisible();
  const playerAssetRequestsBeforeManageActions = playerAssetRequests;

  const galleryLayout = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".encounter-card")];
    const addEncounter = document.querySelector("#map-form");
    const heading = document.querySelector(".encounter-gallery-heading").getBoundingClientRect();
    const firstCard = cards[0].getBoundingClientRect();
    const addBox = addEncounter.getBoundingClientRect();
    return {
      addEncounterArea: addEncounter.getBoundingClientRect().height,
      addEncounterCompact: addBox.height < 80,
      addEncounterInHeading: addBox.top >= heading.top && addBox.bottom <= heading.bottom + 1,
      addEncounterRightAligned: addBox.right > firstCard.right - 8,
      addEncounterAboveCards: addBox.bottom < firstCard.top,
      cards: cards.map((card) => {
        const cardBox = card.getBoundingClientRect();
        const thumbnailBox = card.querySelector(".encounter-thumbnail").getBoundingClientRect();
        const titleBox = card.querySelector(".encounter-name").getBoundingClientRect();
        const adminBox = card.querySelector(".encounter-admin").getBoundingClientRect();
        const controlsBox = card.querySelector(".encounter-controls").getBoundingClientRect();
        return {
          adminBelowTitle: adminBox.top > titleBox.bottom,
          adminWithinCard: adminBox.left >= cardBox.left && adminBox.right <= cardBox.right,
          controlsWithinCard: controlsBox.left >= cardBox.left && controlsBox.right <= cardBox.right,
          thumbnailProminent: thumbnailBox.height > controlsBox.height,
          thumbnailWithinCard: thumbnailBox.left >= cardBox.left && thumbnailBox.right <= cardBox.right,
          titleWithinCard: titleBox.left >= cardBox.left && titleBox.right <= cardBox.right
        };
      }),
      firstCardArea: cards[0].getBoundingClientRect().height
    };
  });
  expect(galleryLayout.addEncounterArea).toBeLessThan(galleryLayout.firstCardArea);
  expect(galleryLayout.addEncounterCompact).toBe(true);
  expect(galleryLayout.addEncounterInHeading).toBe(true);
  expect(galleryLayout.addEncounterRightAligned).toBe(true);
  expect(galleryLayout.addEncounterAboveCards).toBe(true);
  expect(galleryLayout.cards).toEqual([
    {
      adminBelowTitle: true,
      adminWithinCard: true,
      controlsWithinCard: true,
      thumbnailProminent: true,
      thumbnailWithinCard: true,
      titleWithinCard: true
    },
    {
      adminBelowTitle: true,
      adminWithinCard: true,
      controlsWithinCard: true,
      thumbnailProminent: true,
      thumbnailWithinCard: true,
      titleWithinCard: true
    },
    {
      adminBelowTitle: true,
      adminWithinCard: true,
      controlsWithinCard: true,
      thumbnailProminent: true,
      thumbnailWithinCard: true,
      titleWithinCard: true
    }
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(page.getByRole("button", { name: "Manage Encounters" })).toHaveCount(0);
  await expect(page.locator("#map-form")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Encounter name for/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Rename / })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Move .* up$/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Move .* down$/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(3);
  await expect(
    longCard.locator(".encounter-running").getByRole("button", { name: /Shown to Players - clear/ })
  ).toBeEnabled();

  const playerAssetRequestsBeforeOpen = playerAssetRequests;
  await tallCard.getByRole("button", { name: "Open tall-tower for prep" }).click();
  await expectGmHeader(page, "Campaign Library / Gallery Campaign / tall-tower");
  await expect(player.getByRole("img", { name: `Map: ${longEncounterName}` })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeOpen);

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await expect(tallCard.getByText("Selected for Prep", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage Encounters" })).toHaveCount(0);
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeManageActions);
  await squareCard.getByRole("button", { name: "Move square-keep up" }).click();
  await expect
    .poll(() =>
      page
        .getByRole("textbox", { name: /^Encounter name for/ })
        .evaluateAll((inputs) => inputs.map((input) => input.value))
    )
    .toEqual([longEncounterName, "square-keep", "tall-tower"]);
  await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(3);
  await expect(longCard.getByRole("button", { name: `Delete ${longEncounterName}` })).toBeDisabled();
  await expect(longCard.getByText("Shown to Players. Clear it from the Player Display before deleting.")).toBeVisible();
  await expect(tallCard.getByRole("button", { name: "Delete tall-tower" })).toBeEnabled();
  const shownActionStyles = await longCard
    .locator(".encounter-running")
    .getByRole("button", { name: /Shown to Players - clear/ })
    .evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        borderColor: computed.borderColor,
        borderRadius: computed.borderRadius,
        color: computed.color,
        enabled: !element.disabled,
        minHeight: computed.minHeight
      };
    });
  expect(shownActionStyles).toEqual({
    background: "rgb(247, 235, 207)",
    borderColor: "rgb(74, 41, 24)",
    borderRadius: "6px",
    color: "rgb(74, 41, 24)",
    enabled: true,
    minHeight: "44px"
  });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain('This permanently deletes the "square-keep" encounter.');
    expect(dialog.message()).not.toContain("map file");
    await dialog.dismiss();
  });
  await squareCard.getByRole("button", { name: "Delete square-keep" }).click();
  await expect(squareCard).toBeVisible();

  const playerAssetRequestsBeforeDelete = playerAssetRequests;
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("This can't be undone.");
    await dialog.accept();
  });
  await squareCard.getByRole("button", { name: "Delete square-keep" }).click();
  await expect(squareCard).toHaveCount(0);
  await expect(player.getByRole("img", { name: `Map: ${longEncounterName}` })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeDelete);
  await expect
    .poll(() =>
      page
        .getByRole("textbox", { name: /^Encounter name for/ })
        .evaluateAll((inputs) => inputs.map((input) => input.value))
    )
    .toEqual([longEncounterName, "tall-tower"]);

  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(longCard.getByRole("button", { name: `Rename ${longEncounterName}` })).toBeVisible();
  await expect(
    longCard.locator(".encounter-running").getByRole("button", { name: /Shown to Players - clear/ })
  ).toBeEnabled();
});

test("GM workspace shell previews selected encounter without changing the player display", async ({
  app,
  page,
  context
}) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 160, 100, "#254117", "#6b8e23"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 160, 100, "#2c2430", "#b08968"));
  const longWorkspaceEncounterName = "CaveOfTheVeryLongUnbrokenEncounterNameAcrossTheWesternBorderlandsAndUnderways";
  await page.getByRole("textbox", { name: "Encounter name for cave" }).fill(longWorkspaceEncounterName);
  await page.getByRole("button", { name: "Rename cave" }).click();
  await expect(page.getByRole("textbox", { name: `Encounter name for ${longWorkspaceEncounterName}` })).toHaveValue(
    longWorkspaceEncounterName
  );

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: longWorkspaceEncounterName });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show to Players from workspace" })).toBeHidden();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  const playerAssetRequestsBeforeWorkspaceOpen = playerAssetRequests;

  await caveCard.getByRole("button", { name: `Open ${longWorkspaceEncounterName} for prep` }).click();
  await expect(page.getByRole("heading", { level: 3, name: longWorkspaceEncounterName })).toBeVisible();
  await expect(page.getByRole("img", { name: `Map: ${longWorkspaceEncounterName}` })).toBeVisible();
  await expect(page.locator("#selected-encounter-status")).toContainText(
    `Selected for Prep: ${longWorkspaceEncounterName}`
  );
  await expect(page.locator("#selected-encounter-status")).toContainText("Shown to Players: forest");
  await expect(page.getByRole("button", { name: "Show to Players from workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show to Players from workspace" })).toBeEnabled();
  await expect(page.getByRole("group", { name: "Running actions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to Campaign" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Map Alignment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show grid" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brush" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear Fog" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear Fog" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /token/i })).toHaveCount(0);
  const zoomControlLayout = await page.evaluate(() => {
    const zoomOut = document.querySelector("#gm-zoom-out").getBoundingClientRect();
    const zoomIn = document.querySelector("#gm-zoom-in").getBoundingClientRect();
    const zoomLevel = document.querySelector("#gm-zoom-level").getBoundingClientRect();
    const fitMap = document.querySelector("#gm-fit-map").getBoundingClientRect();
    return {
      fitBelowLevel: fitMap.top >= zoomLevel.bottom,
      levelBelowButtons: zoomLevel.top >= Math.max(zoomOut.bottom, zoomIn.bottom),
      zoomButtonsSameRow: Math.abs(zoomOut.top - zoomIn.top) < 4
    };
  });
  expect(zoomControlLayout).toEqual({
    fitBelowLevel: true,
    levelBelowButtons: true,
    zoomButtonsSameRow: true
  });
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeWorkspaceOpen);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const desktopWorkspaceLayout = await page.evaluate(() => {
    const intersects = (first, second) =>
      first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const grid = document.querySelector(".workspace-grid").getBoundingClientRect();
    const pageHeader = document.querySelector(".page-header").getBoundingClientRect();
    const workspace = document.querySelector("#encounter-workspace").getBoundingClientRect();
    const header = document.querySelector(".workspace-header").getBoundingClientRect();
    const map = document.querySelector(".gm-map-stage").getBoundingClientRect();
    const dockElement = document.querySelector(".workspace-tools-panel");
    const dock = dockElement.getBoundingClientRect();
    const dockStyles = getComputedStyle(dockElement);
    const action = document.querySelector("#workspace-show-to-players").getBoundingClientRect();
    const navigation = document.querySelector("#back-to-encounters").getBoundingClientRect();
    const canvas = document.querySelector("#active-map-canvas");
    return {
      actionAreaSmallerThanMap: action.width * action.height < map.width * map.height * 0.2,
      actionMinimumTarget: action.height >= 44,
      dockBackground: dockStyles.backgroundColor,
      dockRightOfMap: dock.left > map.right,
      headerCompact: header.height < window.innerHeight * 0.18,
      mapBelowHeader: map.top >= header.bottom,
      mapDominatesHeader: map.width * map.height > header.width * header.height * 3,
      mapExtendsIntoViewport: map.bottom > window.innerHeight * 0.78,
      mapStartsHigherThanOldWorkspace: map.top < 260,
      mapAreaGreaterThanDock: map.width * map.height > dock.width * dock.height,
      noActionMapOverlap: !intersects(action, map),
      noDockMapOverlap: !intersects(dock, map),
      noHeaderMapOverlap: !intersects(header, map),
      pageHeaderUnchangedScope: pageHeader.height > 0,
      navigationMinimumTarget: navigation.height >= 44,
      renderedHeight: Number(canvas.dataset.drawHeight),
      renderedWidth: Number(canvas.dataset.drawWidth),
      workspaceSpansGrid: workspace.width > grid.width * 0.95
    };
  });
  expect(desktopWorkspaceLayout).toEqual({
    actionAreaSmallerThanMap: true,
    actionMinimumTarget: true,
    dockBackground: "rgba(0, 0, 0, 0)",
    dockRightOfMap: true,
    headerCompact: true,
    mapBelowHeader: true,
    mapDominatesHeader: true,
    mapExtendsIntoViewport: true,
    mapStartsHigherThanOldWorkspace: true,
    mapAreaGreaterThanDock: true,
    navigationMinimumTarget: true,
    noActionMapOverlap: true,
    noDockMapOverlap: true,
    noHeaderMapOverlap: true,
    pageHeaderUnchangedScope: true,
    renderedHeight: expect.any(Number),
    renderedWidth: expect.any(Number),
    workspaceSpansGrid: true
  });
  expect(desktopWorkspaceLayout.renderedHeight).toBeGreaterThan(0);
  expect(desktopWorkspaceLayout.renderedWidth).toBeGreaterThan(0);

  await page.setViewportSize({ height: 768, width: 1024 });
  await expectGmHeader(page, `Campaign Library / The Long Walk / ${longWorkspaceEncounterName}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const chromebookWorkspaceLayout = await page.evaluate(() => {
    const grid = document.querySelector(".workspace-grid").getBoundingClientRect();
    const workspace = document.querySelector("#encounter-workspace").getBoundingClientRect();
    const header = document.querySelector(".workspace-header").getBoundingClientRect();
    const map = document.querySelector(".gm-map-stage").getBoundingClientRect();
    const dock = document.querySelector(".workspace-tools-panel").getBoundingClientRect();
    return {
      dockRightOfMap: dock.left > map.right,
      headerCompact: header.height < window.innerHeight * 0.18,
      mapDominatesHeader: map.width * map.height > header.width * header.height * 3,
      mapStartsHigherThanOldWorkspace: map.top < 280,
      mapAreaGreaterThanDock: map.width * map.height > dock.width * dock.height,
      workspaceSpansGrid: workspace.width > grid.width * 0.95
    };
  });
  expect(chromebookWorkspaceLayout).toEqual({
    dockRightOfMap: true,
    headerCompact: true,
    mapDominatesHeader: true,
    mapStartsHigherThanOldWorkspace: true,
    mapAreaGreaterThanDock: true,
    workspaceSpansGrid: true
  });

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await expect(caveCard.getByText("Selected for Prep", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeWorkspaceOpen);

  await caveCard.getByRole("button", { name: `Open ${longWorkspaceEncounterName} for prep` }).click();
  await page.getByRole("button", { name: "Show to Players from workspace" }).click();
  await expect(player.getByRole("img", { name: `Map: ${longWorkspaceEncounterName}` })).toBeVisible();
  await expect(page.locator("#selected-encounter-status")).toContainText(
    `Selected for Prep: ${longWorkspaceEncounterName}`
  );
  await expect(page.locator("#selected-encounter-status")).toContainText("Shown to Players");
  await page.getByRole("button", { name: "Shown to Players - clear from Player Display" }).click();
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: `Map: ${longWorkspaceEncounterName}` })).toBeHidden();
  await expect(page.locator("#selected-encounter-status")).toContainText("Shown to Players: None");
  await expect(page.getByRole("button", { name: "Show to Players from workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Show to Players from workspace" }).click();
  await expect(player.getByRole("img", { name: `Map: ${longWorkspaceEncounterName}` })).toBeVisible();
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await expect(caveCard.locator(".status-pill").filter({ hasText: "Shown to Players" })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await caveCard.getByRole("button", { name: `Open ${longWorkspaceEncounterName} for prep` }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const narrowWorkspaceLayout = await page.evaluate(() => {
    const header = document.querySelector(".workspace-header").getBoundingClientRect();
    const map = document.querySelector(".gm-map-stage").getBoundingClientRect();
    const dock = document.querySelector(".workspace-tools-panel").getBoundingClientRect();
    return {
      dockBelowMap: dock.top > map.bottom,
      headerAboveMap: header.bottom <= map.top,
      mapAreaGreaterThanDock: map.width * map.height > dock.width * dock.height
    };
  });
  expect(narrowWorkspaceLayout).toEqual({
    dockBelowMap: true,
    headerAboveMap: true,
    mapAreaGreaterThanDock: true
  });
});

test("GM workspace map alignment controls stay local to the GM browser tab", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#254117", "#6b8e23"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));
  await page.getByRole("button", { name: "Show to Players", exact: true }).first().click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("125%", { exact: true })).toBeVisible();
  const playerAssetRequestsBeforeAlignment = playerAssetRequests;

  await page.getByRole("button", { name: "Open forest for prep" }).click();
  const gmCanvas = page.getByRole("img", { name: "Map: forest" });
  await expect(gmCanvas).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("150%", { exact: true })).toBeVisible();
  await expect.poll(() => gmCanvas.getAttribute("data-zoom")).toBe("1.5");
  await expect(player.getByText("125%", { exact: true })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeAlignment);

  await page.getByRole("button", { name: "Show grid" }).click();
  const grid = page.locator("#workspace-grid-overlay");
  await expect(grid).toBeVisible();
  await expect(player.locator("#workspace-grid-overlay")).toHaveCount(0);
  const beforeGridZoom = await page.evaluate(() => {
    const overlay = document.querySelector("#workspace-grid-overlay");
    const bounds = overlay.getBoundingClientRect();
    const canvas = document.querySelector("#active-map-canvas");
    return {
      cellSize: overlay.dataset.cellSize,
      height: bounds.height,
      offsetX: overlay.dataset.offsetX,
      offsetY: overlay.dataset.offsetY,
      renderedWidth: Number(canvas.dataset.drawWidth),
      width: bounds.width
    };
  });
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => gmCanvas.getAttribute("data-zoom")).toBe("1.75");
  await expect.poll(() => gmCanvas.getAttribute("data-draw-width")).not.toBe(String(beforeGridZoom.renderedWidth));
  const afterGridZoom = await page.evaluate(() => {
    const overlay = document.querySelector("#workspace-grid-overlay");
    const bounds = overlay.getBoundingClientRect();
    const canvas = document.querySelector("#active-map-canvas");
    return {
      cellSize: overlay.dataset.cellSize,
      height: bounds.height,
      offsetX: overlay.dataset.offsetX,
      offsetY: overlay.dataset.offsetY,
      renderedWidth: Number(canvas.dataset.drawWidth),
      width: bounds.width
    };
  });
  expect(afterGridZoom).toMatchObject({
    cellSize: beforeGridZoom.cellSize,
    height: beforeGridZoom.height,
    offsetX: beforeGridZoom.offsetX,
    offsetY: beforeGridZoom.offsetY,
    width: beforeGridZoom.width
  });
  expect(afterGridZoom.renderedWidth).toBeGreaterThan(beforeGridZoom.renderedWidth);

  await grid.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => grid.getAttribute("data-offset-x")).toBe("1");
  await page.getByRole("button", { name: "Lock grid" }).click();
  const lockedGridBeforeZoom = await page.evaluate(() => {
    const overlay = document.querySelector("#workspace-grid-overlay");
    const bounds = overlay.getBoundingClientRect();
    const canvas = document.querySelector("#active-map-canvas");
    return {
      cellSize: Number(overlay.dataset.cellSize),
      height: bounds.height,
      offsetX: overlay.dataset.offsetX,
      offsetY: overlay.dataset.offsetY,
      renderedWidth: Number(canvas.dataset.drawWidth),
      width: bounds.width
    };
  });
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => gmCanvas.getAttribute("data-zoom")).toBe("1.5");
  await expect
    .poll(() => gmCanvas.getAttribute("data-draw-width"))
    .not.toBe(String(lockedGridBeforeZoom.renderedWidth));
  await expect.poll(() => grid.getAttribute("data-cell-size")).not.toBe(String(lockedGridBeforeZoom.cellSize));
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
  const lockedGridAfterZoom = await page.evaluate(() => {
    const overlay = document.querySelector("#workspace-grid-overlay");
    const bounds = overlay.getBoundingClientRect();
    const canvas = document.querySelector("#active-map-canvas");
    return {
      cellSize: Number(overlay.dataset.cellSize),
      height: bounds.height,
      offsetX: overlay.dataset.offsetX,
      offsetY: overlay.dataset.offsetY,
      renderedWidth: Number(canvas.dataset.drawWidth),
      width: bounds.width
    };
  });
  expect(lockedGridAfterZoom).toMatchObject({
    height: lockedGridBeforeZoom.height,
    width: lockedGridBeforeZoom.width
  });
  expect(lockedGridAfterZoom.renderedWidth).toBeLessThan(lockedGridBeforeZoom.renderedWidth);
  expect(lockedGridAfterZoom.cellSize).toBeLessThan(lockedGridBeforeZoom.cellSize);
  const lockedOffsetXAfterZoom = await grid.getAttribute("data-offset-x");
  await grid.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => grid.getAttribute("data-offset-x")).toBe(lockedOffsetXAfterZoom);
  await page.getByRole("button", { name: "Unlock grid" }).click();
  await grid.focus();
  const unlockedOffsetY = Number(await grid.getAttribute("data-offset-y"));
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(async () => Number(await grid.getAttribute("data-offset-y"))).toBe(unlockedOffsetY + 10);
  const unlockedOffsetXAfterMove = await grid.getAttribute("data-offset-x");
  const unlockedOffsetYAfterMove = await grid.getAttribute("data-offset-y");

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await page.getByRole("button", { name: "Open cave for prep" }).click();
  await expect(page.getByRole("img", { name: "Map: cave" })).toBeVisible();
  await expect(grid).toBeHidden();
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await page.getByRole("button", { name: "Open forest for prep" }).click();
  await expect(grid).toBeVisible();
  await expect.poll(() => grid.getAttribute("data-offset-x")).toBe(unlockedOffsetXAfterMove);
  await expect.poll(() => grid.getAttribute("data-offset-y")).toBe(unlockedOffsetYAfterMove);
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeAlignment);

  await page.reload();
  await expectGmHeader(page, "Campaign Library");
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByRole("button", { name: "Open forest for prep" }).click();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(grid).toBeHidden();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
});

test("GM workspace panning stays local and arbitrates with fog and grid tools", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "wide-ruins.png", 900, 300, "#d9b978", "#704020"));
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: wide-ruins" })).toBeVisible();
  const playerRequestsBeforePan = playerAssetRequests;
  const playerViewportBeforePan = await canvasViewport(player, "#player-map");

  await page.getByRole("button", { name: "Open wide-ruins for prep" }).click();
  const gmCanvas = page.getByRole("img", { name: "Map: wide-ruins" });
  await expect(gmCanvas).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-zoom")).toBe("1.75");
  const gmViewportBeforePan = await canvasViewport(page, "#active-map-canvas");

  const canvasBox = await page.locator("#active-map-canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2 - 160, canvasBox.y + canvasBox.height / 2 - 30, {
    steps: 5
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await canvasViewport(page, "#active-map-canvas")).panX)
    .not.toBe(gmViewportBeforePan.panX);
  const gmViewportAfterPointerPan = await canvasViewport(page, "#active-map-canvas");
  expect(await canvasViewport(player, "#player-map")).toMatchObject(playerViewportBeforePan);
  expect(playerAssetRequests).toBe(playerRequestsBeforePan);

  await gmCanvas.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await canvasViewport(page, "#active-map-canvas")).panX)
    .not.toBe(gmViewportAfterPointerPan.panX);
  const gmViewportAfterKeyboardPan = await canvasViewport(page, "#active-map-canvas");
  expect(await canvasViewport(player, "#player-map")).toMatchObject(playerViewportBeforePan);

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.58, y: 0.24 }, { x: 0.72, y: 0.52 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  const gmViewportAfterFog = await canvasViewport(page, "#active-map-canvas");
  expect(gmViewportAfterFog.panX).toBe(gmViewportAfterKeyboardPan.panX);
  expect(gmViewportAfterFog.panY).toBe(gmViewportAfterKeyboardPan.panY);
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await page.getByRole("button", { name: "Show grid" }).click();
  const grid = page.locator("#workspace-grid-overlay");
  await expect(grid).toBeVisible();
  const gridBeforeDrag = await grid.evaluate((overlay) => ({
    offsetX: overlay.dataset.offsetX,
    offsetY: overlay.dataset.offsetY
  }));
  const panBeforeGridDrag = await canvasViewport(page, "#active-map-canvas");
  const gridBox = await grid.boundingBox();
  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gridBox.x + gridBox.width / 2 + 24, gridBox.y + gridBox.height / 2 + 18, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => grid.getAttribute("data-offset-x")).not.toBe(gridBeforeDrag.offsetX);
  const panAfterUnlockedGridDrag = await canvasViewport(page, "#active-map-canvas");
  expect(panAfterUnlockedGridDrag.panX).toBe(panBeforeGridDrag.panX);
  expect(panAfterUnlockedGridDrag.panY).toBe(panBeforeGridDrag.panY);

  await page.getByRole("button", { name: "Lock grid" }).click();
  const lockedGridBeforePan = await grid.evaluate((overlay) => ({
    drawX: Number(document.querySelector("#active-map-canvas").dataset.drawX),
    offsetX: Number(overlay.dataset.offsetX)
  }));
  const panBeforeLockedGridDrag = await canvasViewport(page, "#active-map-canvas");
  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gridBox.x + gridBox.width / 2 - 50, gridBox.y + gridBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await canvasViewport(page, "#active-map-canvas")).panX)
    .not.toBe(panBeforeLockedGridDrag.panX);
  const lockedGridAfterPan = await grid.evaluate((overlay) => ({
    drawX: Number(document.querySelector("#active-map-canvas").dataset.drawX),
    offsetX: Number(overlay.dataset.offsetX)
  }));
  expect(lockedGridAfterPan.offsetX).not.toBe(lockedGridBeforePan.offsetX);
  expect(lockedGridAfterPan.offsetX - lockedGridAfterPan.drawX).toBe(
    lockedGridBeforePan.offsetX - lockedGridBeforePan.drawX
  );

  const campaignJson = JSON.parse(fs.readFileSync(path.join(app.dataRoot, "The Long Walk", "campaign.json"), "utf8"));
  expect(campaignJson.maps[0].fog).toHaveLength(1);
  expect(campaignJson.activeMapId).toBe(await page.locator(".encounter-card").getAttribute("data-map-id"));

  await page.setViewportSize({ height: 700, width: 1024 });
  await page.getByRole("button", { name: "Fit map" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  const chromebookPanBefore = await canvasViewport(page, "#active-map-canvas");
  await gmCanvas.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await canvasViewport(page, "#active-map-canvas")).panX)
    .not.toBe(chromebookPanBefore.panX);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole("button", { name: "Fit map" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toBeVisible();
  const narrowPanBefore = await canvasViewport(page, "#active-map-canvas");
  await gmCanvas.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await canvasViewport(page, "#active-map-canvas")).panX).not.toBe(narrowPanBefore.panX);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("seeded fog renders by role before drawing controls are used", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#d9b978", "#704020"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await forestCard.getByRole("button", { name: "Open forest for prep" }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brush" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear Fog" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear Fog" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /token/i })).toHaveCount(0);
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  const forestMapId = await page.locator(".encounter-card").filter({ hasText: "forest" }).getAttribute("data-map-id");
  const caveMapId = await page.locator(".encounter-card").filter({ hasText: "cave" }).getAttribute("data-map-id");
  const operations = [
    { type: "hide-rectangle", rect: { x: 0.08, y: 0.12, width: 0.42, height: 0.5 } },
    { type: "reveal-rectangle", rect: { x: 0.2, y: 0.25, width: 0.12, height: 0.16 } },
    { type: "hide-rectangle", rect: { x: 0.24, y: 0.3, width: 0.04, height: 0.05 } }
  ];
  app.seedFogOperations("The Long Walk", forestMapId, operations);

  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("3");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("3");
  await expect.poll(async () => (await canvasViewport(page, "#active-map-canvas")).fogMaskBuilds).toBeGreaterThan(0);
  await expect.poll(async () => (await canvasViewport(player, "#player-map")).fogMaskBuilds).toBeGreaterThan(0);

  const gmVisible = await sampleMapPixel(page, "#active-map-canvas", { x: 0.05, y: 0.15 });
  const gmHidden = await sampleMapPixel(page, "#active-map-canvas", { x: 0.14, y: 0.18 });
  const gmRevealed = await sampleMapPixel(page, "#active-map-canvas", { x: 0.22, y: 0.28 });
  const gmRehidden = await sampleMapPixel(page, "#active-map-canvas", { x: 0.25, y: 0.32 });
  const playerVisible = await sampleMapPixel(player, "#player-map", { x: 0.05, y: 0.15 });
  const playerHidden = await sampleMapPixel(player, "#player-map", { x: 0.14, y: 0.18 });
  const playerRevealed = await sampleMapPixel(player, "#player-map", { x: 0.22, y: 0.28 });
  const playerRehidden = await sampleMapPixel(player, "#player-map", { x: 0.25, y: 0.32 });

  expect(colorDistance(gmVisible, gmRevealed)).toBeLessThan(16);
  expect(colorDistance(playerVisible, playerRevealed)).toBeLessThan(16);
  expect(colorDistance(gmVisible, gmHidden)).toBeGreaterThan(80);
  expect(colorDistance(gmHidden, playerHidden)).toBeGreaterThan(80);
  expect(playerHidden.red).toBeLessThan(gmHidden.red);
  expect(playerHidden.green).toBeLessThan(gmHidden.green);
  expect(colorDistance(playerHidden, playerRehidden)).toBeLessThan(8);
  expect(colorDistance(gmHidden, gmRehidden)).toBeLessThan(8);

  const hiddenBeforeZoom = await sampleMapPixel(page, "#active-map-canvas", { x: 0.4, y: 0.2 });
  const gmMaskBuildsBeforeZoom = (await canvasViewport(page, "#active-map-canvas")).fogMaskBuilds;
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-zoom")).toBe("1.5");
  await waitForCanvasFrame(page, "#active-map-canvas");
  expect((await canvasViewport(page, "#active-map-canvas")).fogMaskBuilds).toBe(gmMaskBuildsBeforeZoom);
  const hiddenAfterZoom = await sampleMapPixel(page, "#active-map-canvas", { x: 0.4, y: 0.2 });
  expect(colorDistance(hiddenBeforeZoom, hiddenAfterZoom)).toBeLessThan(8);

  const playerHiddenBeforeResize = await sampleMapPixel(player, "#player-map", { x: 0.4, y: 0.2 });
  const playerMaskBuildsBeforeZoom = (await canvasViewport(player, "#player-map")).fogMaskBuilds;
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => player.locator("#player-map").getAttribute("data-zoom")).toBe("1.25");
  await waitForCanvasFrame(player, "#player-map");
  expect((await canvasViewport(player, "#player-map")).fogMaskBuilds).toBe(playerMaskBuildsBeforeZoom);
  const playerHiddenAfterZoom = await sampleMapPixel(player, "#player-map", { x: 0.4, y: 0.2 });
  expect(colorDistance(playerHiddenBeforeResize, playerHiddenAfterZoom)).toBeLessThan(8);
  const playerMaskBuildsBeforeResize = (await canvasViewport(player, "#player-map")).fogMaskBuilds;
  await player.setViewportSize({ height: 844, width: 390 });
  await waitForCanvasFrame(player, "#player-map");
  expect((await canvasViewport(player, "#player-map")).fogMaskBuilds).toBe(playerMaskBuildsBeforeResize);
  const playerHiddenAfterResize = await sampleMapPixel(player, "#player-map", { x: 0.4, y: 0.2 });
  const playerRevealedAfterResize = await sampleMapPixel(player, "#player-map", { x: 0.22, y: 0.28 });
  const playerRehiddenAfterResize = await sampleMapPixel(player, "#player-map", { x: 0.25, y: 0.32 });
  expect(colorDistance(playerHiddenAfterResize, playerRevealedAfterResize)).toBeGreaterThan(200);

  const playerAssetRequestsBeforeUnshownFog = playerAssetRequests;
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await caveCard.getByRole("button", { name: "Open cave for prep" }).click();
  app.seedFogOperations("The Long Walk", caveMapId, [
    { type: "hide-rectangle", rect: { x: 0, y: 0, width: 1, height: 1 } }
  ]);
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("3");
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeUnshownFog);
  const playerStillRehidden = await sampleMapPixel(player, "#player-map", { x: 0.25, y: 0.32 });
  expect(colorDistance(playerRehiddenAfterResize, playerStillRehidden)).toBeLessThan(64);
});

test("GM campaign open restores saved shown encounter and fog to player display", async ({ app, page, context }) => {
  const player = await context.newPage();
  const campaignDirectory = path.join(app.dataRoot, "Saved Campaign");
  const mapsDirectory = path.join(campaignDirectory, "maps");
  const forestFog = [{ type: "hide-rectangle", rect: { x: 0.12, y: 0.12, width: 0.28, height: 0.28 } }];
  fs.mkdirSync(mapsDirectory, { recursive: true });
  fs.writeFileSync(path.join(mapsDirectory, "forest.png"), PNG_BYTES);
  fs.writeFileSync(path.join(mapsDirectory, "cave.png"), PNG_BYTES);
  writeCampaignRecord(app.dataRoot, "Saved Campaign", {
    version: 1,
    name: "Saved Campaign",
    activeMapId: "forest",
    maps: [
      {
        id: "forest",
        name: "forest",
        originalFileName: "forest.png",
        file: "maps/forest.png",
        order: 1,
        fog: forestFog
      },
      {
        id: "cave",
        name: "cave",
        originalFileName: "cave.png",
        file: "maps/cave.png",
        order: 2,
        fog: [{ type: "hide-rectangle", rect: { x: 0.6, y: 0.6, width: 0.1, height: 0.1 } }]
      }
    ]
  });

  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: /Map:/ })).toBeHidden();

  await openGm(page, app.baseURL);
  const savedCard = page.locator(".campaign-card").filter({ hasText: "Saved Campaign" });
  await expect(savedCard.locator(".campaign-card-meta")).toContainText("Shown to Players: forest");
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();
  await savedCard.getByRole("button", { name: "Open" }).click();

  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  expect(await canvasViewport(player, "#player-map")).toMatchObject({
    fogOperations: forestFog.length,
    zoom: 1
  });
  await expect(
    page.locator(".encounter-card").filter({ hasText: "forest" }).locator(".status-pill").filter({
      hasText: "Shown to Players"
    })
  ).toBeVisible();
  await expect(page.locator("#selected-encounter-status")).toContainText("Choose an encounter card to prep it here.");

  const playerBeforePrepOpen = await canvasViewport(player, "#player-map");
  await page.getByRole("button", { name: "Open cave for prep" }).click();
  await expect(page.getByRole("img", { name: "Map: cave" })).toBeVisible();
  await expect(page.locator("#selected-encounter-status")).toContainText("Selected for Prep: cave");
  await expect(page.locator("#selected-encounter-status")).toContainText("Shown to Players: forest");
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(await canvasViewport(player, "#player-map")).toMatchObject(playerBeforePrepOpen);
});

test("GM Clear Fog is confirmed and scoped to the selected encounter", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#d9b978", "#704020"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await forestCard.getByRole("button", { name: "Open forest for prep" }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();

  const clearFog = page.getByRole("button", { name: "Clear Fog" });
  await expect(clearFog).toBeVisible();
  await expect(clearFog).toBeDisabled();

  const forestMapId = await forestCard.getAttribute("data-map-id");
  const caveMapId = await caveCard.getAttribute("data-map-id");
  app.seedFogOperations("The Long Walk", forestMapId, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.35, height: 0.4 } },
    { type: "reveal-rectangle", rect: { x: 0.18, y: 0.18, width: 0.1, height: 0.12 } }
  ]);
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("2");
  await expect(clearFog).toBeEnabled();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain('This removes all fog from "forest".');
    expect(dialog.message()).toContain("The Player Display will update immediately.");
    expect(dialog.message()).toContain("You can use Undo until this campaign is reloaded.");
    await dialog.dismiss();
  });
  await clearFog.click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("2");
  await expect(clearFog).toBeEnabled();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await markEncounterGalleryNodes(page);
  await clearFog.click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("0");
  await expectEncounterGalleryNodesUnchanged(page);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(clearFog).toBeDisabled();

  app.seedFogOperations("The Long Walk", forestMapId, [
    { type: "hide-rectangle", rect: { x: 0.55, y: 0.2, width: 0.2, height: 0.3 } }
  ]);
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  const playerAssetRequestsBeforeUnshownClear = playerAssetRequests;

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await caveCard.getByRole("button", { name: "Open cave for prep" }).click();
  app.seedFogOperations("The Long Walk", caveMapId, [
    { type: "hide-rectangle", rect: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 } }
  ]);
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expect(clearFog).toBeEnabled();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain('This removes all fog from "cave".');
    expect(dialog.message()).not.toContain("The Player Display will update immediately.");
    expect(dialog.message()).toContain("You can use Undo until this campaign is reloaded.");
    await dialog.accept();
  });
  await markEncounterGalleryNodes(page);
  await clearFog.click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expectEncounterGalleryNodesUnchanged(page);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeUnshownClear);
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  const campaignJson = JSON.parse(fs.readFileSync(path.join(app.dataRoot, "The Long Walk", "campaign.json"), "utf8"));
  expect(campaignJson.activeMapId).toBe(forestMapId);
  expect(campaignJson.maps.map((map) => map.fog.length)).toEqual([1, 0]);
});

test("GM Undo fog action walks back shown and unshown fog changes", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#d9b978", "#704020"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await forestCard.getByRole("button", { name: "Open forest for prep" }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();

  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeVisible();
  await expect(undo).toBeDisabled();

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.5, y: 0.7 }, { x: 0.1, y: 0.2 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expect(undo).toBeEnabled();

  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.16, y: 0.26 }, { x: 0.3, y: 0.42 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("2");

  const rejectUndo = (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "Simulated undo failure." }),
      contentType: "application/json",
      status: 500
    });
  await page.route("**/fog-operations/undo", rejectUndo);
  await undo.click();
  await expect(page.locator("#campaign-message")).toHaveText("Could not undo fog. Nothing changed.");
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("2");
  await page.unroute("**/fog-operations/undo", rejectUndo);

  await markEncounterGalleryNodes(page);
  await undo.click();
  await expect(page.locator("#campaign-message")).toHaveText("Fog undone.");
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expectEncounterGalleryNodesUnchanged(page);
  await expect(undo).toBeEnabled();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain('This removes all fog from "forest".');
    expect(dialog.message()).toContain("You can use Undo until this campaign is reloaded.");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Clear Fog" }).click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("0");
  await expect(undo).toBeEnabled();

  await markEncounterGalleryNodes(page);
  await undo.click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expectEncounterGalleryNodesUnchanged(page);

  await markEncounterGalleryNodes(page);
  await undo.click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("0");
  await expectEncounterGalleryNodesUnchanged(page);
  await expect(undo).toBeDisabled();

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.25, y: 0.2 }, { x: 0.45, y: 0.45 });
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  const playerAssetRequestsBeforeUnshownUndo = playerAssetRequests;

  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await caveCard.getByRole("button", { name: "Open cave for prep" }).click();
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.4, y: 0.2 }, { x: 0.6, y: 0.6 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expect(undo).toBeEnabled();

  await markEncounterGalleryNodes(page);
  await undo.click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expectEncounterGalleryNodesUnchanged(page);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeUnshownUndo);
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  const campaignJson = JSON.parse(fs.readFileSync(path.join(app.dataRoot, "The Long Walk", "campaign.json"), "utf8"));
  expect(campaignJson.maps.map((map) => map.fog.length)).toEqual([1, 0]);
});

test("GM rectangle Hide tool draws shown fog and isolates unshown prep fog", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#d9b978", "#704020"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await forestCard.getByRole("button", { name: "Open forest for prep" }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toBeEnabled();
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toHaveAttribute("aria-pressed", "false");
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.4, y: 0.4 }, { x: 0.405, y: 0.405 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");

  const escapeStart = await mapClientPoint(page, "#active-map-canvas", { x: 0.12, y: 0.12 });
  const escapeEnd = await mapClientPoint(page, "#active-map-canvas", { x: 0.28, y: 0.32 });
  await page.mouse.move(escapeStart.x, escapeStart.y);
  await page.mouse.down();
  await page.mouse.move(escapeEnd.x, escapeEnd.y);
  await expect(page.locator("#workspace-fog-rectangle")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#workspace-fog-rectangle")).toBeHidden();
  await page.mouse.up();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");

  const letterboxDrag = await page.locator("#active-map-canvas").evaluate((canvas) => ({
    end: {
      x: Number(canvas.dataset.drawX) + Number(canvas.dataset.drawWidth) * 0.24,
      y: Number(canvas.dataset.drawY) + Number(canvas.dataset.drawHeight) * 0.3
    },
    start: {
      x: Number(canvas.dataset.drawX) + Number(canvas.dataset.drawWidth) * 0.24,
      y: Math.max(1, Number(canvas.dataset.drawY) / 2)
    }
  }));
  await dragFromStagePoint(page, "#active-map-stage", letterboxDrag.start, letterboxDrag.end);
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");

  const playerAssetRequestsBeforeFog = playerAssetRequests;
  const gmVisibleBefore = await sampleMapPixel(page, "#active-map-canvas", { x: 0.05, y: 0.15 });
  await markEncounterGalleryNodes(page);
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.5, y: 0.7 }, { x: 0.1, y: 0.2 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  await expectEncounterGalleryNodesUnchanged(page);
  const gmHidden = await sampleMapPixel(page, "#active-map-canvas", { x: 0.2, y: 0.3 });
  const playerHidden = await sampleMapPixel(player, "#player-map", { x: 0.2, y: 0.3 });
  expect(colorDistance(gmVisibleBefore, gmHidden)).toBeGreaterThan(80);
  expect(playerHidden.red).toBeLessThan(gmHidden.red);
  expect(playerHidden.green).toBeLessThan(gmHidden.green);
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeFog);

  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.16, y: 0.26 }, { x: 0.3, y: 0.42 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("2");
  const gmRevealed = await sampleMapPixel(page, "#active-map-canvas", { x: 0.22, y: 0.32 });
  const playerRevealed = await sampleMapPixel(player, "#player-map", { x: 0.22, y: 0.32 });
  expect(colorDistance(gmVisibleBefore, gmRevealed)).toBeLessThan(64);
  expect(colorDistance(gmRevealed, playerRevealed)).toBeLessThan(64);

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.2, y: 0.3 }, { x: 0.24, y: 0.36 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("3");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("3");
  const playerRehidden = await sampleMapPixel(player, "#player-map", { x: 0.22, y: 0.32 });
  expect(playerRehidden.red).toBeLessThan(playerRevealed.red - 40);

  await page.getByRole("button", { name: "Show grid" }).click();
  const gridBeforeHideDrag = await page.locator("#workspace-grid-overlay").evaluate((overlay) => ({
    offsetX: overlay.dataset.offsetX,
    offsetY: overlay.dataset.offsetY
  }));
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.62, y: 0.18 }, { x: 0.78, y: 0.38 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("4");
  const gridAfterHideDrag = await page.locator("#workspace-grid-overlay").evaluate((overlay) => ({
    offsetX: overlay.dataset.offsetX,
    offsetY: overlay.dataset.offsetY
  }));
  expect(gridAfterHideDrag).toEqual(gridBeforeHideDrag);

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toHaveAttribute("aria-pressed", "false");
  const gridOverlay = page.locator("#workspace-grid-overlay");
  const gridBox = await gridOverlay.boundingBox();
  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gridBox.x + gridBox.width / 2 + 20, gridBox.y + gridBox.height / 2 + 12);
  await page.mouse.up();
  await expect.poll(() => gridOverlay.getAttribute("data-offset-x")).not.toBe(gridBeforeHideDrag.offsetX);

  const playerAssetRequestsBeforeUnshownFog = playerAssetRequests;
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await caveCard.getByRole("button", { name: "Open cave for prep" }).click();
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-zoom")).toBe("1.5");
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await markEncounterGalleryNodes(page);
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.4, y: 0.2 }, { x: 0.6, y: 0.6 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expectEncounterGalleryNodesUnchanged(page);
  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await markEncounterGalleryNodes(page);
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.46, y: 0.28 }, { x: 0.54, y: 0.42 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("4");
  await expectEncounterGalleryNodesUnchanged(page);
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeUnshownFog);
  await page.getByRole("button", { name: "Fit map" }).click();
  const caveRevealedAfterFit = await sampleMapPixel(page, "#active-map-canvas", { x: 0.5, y: 0.35 });
  const caveStillHiddenAfterFit = await sampleMapPixel(page, "#active-map-canvas", { x: 0.42, y: 0.35 });
  expect(colorDistance(caveRevealedAfterFit, caveStillHiddenAfterFit)).toBeGreaterThan(60);
});

test("GM brush fog tool paints fixed-size hide and reveal operations", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  let brushBatchRequests = 0;
  let singleFogAppendRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "POST") return;
    if (url.pathname.endsWith("/fog-operations/batch")) {
      brushBatchRequests += 1;
    } else if (url.pathname.endsWith("/fog-operations")) {
      singleFogAppendRequests += 1;
    }
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#d9b978", "#704020"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await forestCard.getByRole("button", { name: "Open forest for prep" }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reveal", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Brush" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Circle" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Brush diameter as percent of the map's shorter side")).toBeHidden();
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  await page.getByRole("button", { name: "Brush" }).click();
  await expect(page.getByRole("button", { name: "Brush" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Brush diameter as percent of the map's shorter side")).toBeVisible();
  await page.getByLabel("Brush diameter as percent of the map's shorter side").fill("21");
  await expect(page.locator("#workspace-circle-size")).toHaveValue("21");
  await page.locator("#workspace-circle-size").fill("22");
  await expect(page.getByLabel("Brush diameter as percent of the map's shorter side")).toHaveValue("22");
  const brushSizeLayout = await page.evaluate(() => {
    const slider = document.querySelector("#workspace-circle-size").getBoundingClientRect();
    const tools = document.querySelector(".workspace-tools-panel").getBoundingClientRect();
    const value = document.querySelector("#workspace-circle-size-value").getBoundingClientRect();
    return {
      sliderRight: slider.right,
      sliderBottom: slider.bottom,
      toolsRight: tools.right,
      valueTop: value.top
    };
  });
  expect(brushSizeLayout.valueTop).toBeGreaterThan(brushSizeLayout.sliderBottom);
  expect(brushSizeLayout.sliderRight).toBeLessThanOrEqual(brushSizeLayout.toolsRight);

  const playerAssetRequestsBeforeBrush = playerAssetRequests;
  const gmVisible = await sampleMapPixel(page, "#active-map-canvas", { x: 0.2, y: 0.5 });
  const playerCenterVisible = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.5 });
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  const brushHoverPoint = await mapClientPoint(page, "#active-map-canvas", { x: 0.5, y: 0.5 });
  await page.mouse.move(brushHoverPoint.x, brushHoverPoint.y);
  await expect(page.locator("#workspace-fog-circle")).toBeVisible();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");
  const brushBatchRequestsBeforeHide = brushBatchRequests;
  const singleFogAppendRequestsBeforeHide = singleFogAppendRequests;
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 });
  await expect
    .poll(async () => Number(await page.locator("#active-map-canvas").getAttribute("data-fog-operations")))
    .toBeGreaterThan(1);
  expect(brushBatchRequests - brushBatchRequestsBeforeHide).toBe(1);
  expect(singleFogAppendRequests - singleFogAppendRequestsBeforeHide).toBe(0);
  const paintedHideCount = Number(await page.locator("#active-map-canvas").getAttribute("data-fog-operations"));
  await expect
    .poll(() => player.locator("#player-map").getAttribute("data-fog-operations"))
    .toBe(String(paintedHideCount));
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeBrush);
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toHaveAttribute("aria-pressed", "true");

  const gmBrushHidden = await sampleMapPixel(page, "#active-map-canvas", { x: 0.5, y: 0.5 });
  const playerBrushHidden = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.5 });
  const playerOutsideBrush = await sampleMapPixel(player, "#player-map", { x: 0.2, y: 0.5 });
  expect(colorDistance(gmVisible, gmBrushHidden)).toBeGreaterThan(80);
  expect(playerBrushHidden.red).toBeLessThan(gmBrushHidden.red);
  expect(colorDistance(playerOutsideBrush, playerBrushHidden)).toBeGreaterThan(80);

  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await page.getByLabel("Brush diameter as percent of the map's shorter side").fill("9");
  await clickMapPoint(page, "#active-map-canvas", { x: 0.5, y: 0.5 });
  await expect
    .poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations"))
    .toBe(String(paintedHideCount + 1));
  await expect
    .poll(() => player.locator("#player-map").getAttribute("data-fog-operations"))
    .toBe(String(paintedHideCount + 1));
  const playerBrushRevealed = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.5 });
  const playerBrushStillHidden = await sampleMapPixel(player, "#player-map", { x: 0.56, y: 0.5 });
  expect(colorDistance(playerCenterVisible, playerBrushRevealed)).toBeLessThan(64);
  expect(colorDistance(playerBrushRevealed, playerBrushStillHidden)).toBeGreaterThan(80);

  await page.getByRole("button", { name: "Rectangle" }).click();
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.48, y: 0.46 }, { x: 0.52, y: 0.54 });
  await expect
    .poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations"))
    .toBe(String(paintedHideCount + 2));
  const playerRehiddenByRectangle = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.5 });
  expect(playerRehiddenByRectangle.red).toBeLessThan(playerBrushRevealed.red - 40);

  const campaignJson = JSON.parse(fs.readFileSync(path.join(app.dataRoot, "The Long Walk", "campaign.json"), "utf8"));
  const forestFog = campaignJson.maps.find((map) => map.name === "forest").fog;
  expect(forestFog.slice(0, paintedHideCount)).toEqual(
    expect.arrayContaining([
      { type: "hide-circle", circle: { x: expect.any(Number), y: expect.any(Number), radius: 0.11 } }
    ])
  );
  expect(forestFog.at(-2)).toMatchObject({
    type: "reveal-circle",
    circle: { x: expect.any(Number), y: expect.any(Number), radius: 0.045 }
  });
  expect(forestFog.at(-1)).toMatchObject({ type: "hide-rectangle" });

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.getByRole("button", { name: "Brush" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Circle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const playerAssetRequestsBeforeUnshownBrush = playerAssetRequests;
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await caveCard.getByRole("button", { name: "Open cave for prep" }).click();
  await page.getByRole("button", { name: "Brush" }).click();
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await clickMapPoint(page, "#active-map-canvas", { x: 0.5, y: 0.5 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect
    .poll(() => player.locator("#player-map").getAttribute("data-fog-operations"))
    .toBe(String(paintedHideCount + 2));
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeUnshownBrush);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
});

test("GM circle fog tool drags one sized hide or reveal operation", async ({ app, page, context }) => {
  const player = await context.newPage();
  let playerAssetRequests = 0;
  await player.route("**/api/player/active-map/asset*", (route) => {
    playerAssetRequests += 1;
    return route.continue();
  });

  await page.setViewportSize({ height: 768, width: 1366 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 200, 100, "#d9b978", "#704020"));
  await uploadMapFile(page, await sizedPngFile(page, "cave.png", 200, 100, "#2c2430", "#b08968"));

  const forestCard = page.locator(".encounter-card").filter({ hasText: "forest" });
  const caveCard = page.locator(".encounter-card").filter({ hasText: "cave" });
  await forestCard.getByRole("button", { name: "Show to Players", exact: true }).click();
  await forestCard.getByRole("button", { name: "Open forest for prep" }).click();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  await page.getByRole("button", { name: "Circle" }).click();
  await expect(page.getByRole("button", { name: "Circle" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Brush diameter as percent of the map's shorter side")).toBeHidden();
  await page.getByRole("button", { name: "Hide", exact: true }).click();

  await dragMapRectangle(page, "#active-map-canvas", { x: 0.5, y: 0.5 }, { x: 0.505, y: 0.505 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("0");

  const playerAssetRequestsBeforeCircle = playerAssetRequests;
  const playerCenterVisible = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.5 });
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.72 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("1");
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeCircle);
  const playerCircleHidden = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.6 });
  const playerOutsideCircle = await sampleMapPixel(player, "#player-map", { x: 0.2, y: 0.5 });
  expect(playerCircleHidden.red).toBeLessThan(playerCenterVisible.red - 40);
  expect(colorDistance(playerOutsideCircle, playerCircleHidden)).toBeGreaterThan(80);

  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.58 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("2");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("2");
  const playerCircleRevealed = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.5 });
  const playerCircleStillHidden = await sampleMapPixel(player, "#player-map", { x: 0.5, y: 0.62 });
  expect(colorDistance(playerCenterVisible, playerCircleRevealed)).toBeLessThan(64);
  expect(colorDistance(playerCircleRevealed, playerCircleStillHidden)).toBeGreaterThan(80);

  await page.getByRole("button", { name: "Hide", exact: true }).click();
  const edgeCircleDrag = await page.locator("#active-map-canvas").evaluate((canvas) => {
    const bounds = canvas.getBoundingClientRect();
    const drawX = Number(canvas.dataset.drawX);
    const drawY = Number(canvas.dataset.drawY);
    const drawWidth = Number(canvas.dataset.drawWidth);
    const drawHeight = Number(canvas.dataset.drawHeight);
    return {
      end: {
        x: bounds.left + drawX + drawWidth + drawHeight,
        y: bounds.top + drawY + drawHeight * 0.5
      },
      start: {
        x: bounds.left + drawX + drawWidth * 0.95,
        y: bounds.top + drawY + drawHeight * 0.5
      }
    };
  });
  await page.mouse.move(edgeCircleDrag.start.x, edgeCircleDrag.start.y);
  await page.mouse.down();
  await page.mouse.move(edgeCircleDrag.end.x, edgeCircleDrag.end.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("3");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("3");

  const escapeStart = await mapClientPoint(page, "#active-map-canvas", { x: 0.32, y: 0.45 });
  const escapeEnd = await mapClientPoint(page, "#active-map-canvas", { x: 0.32, y: 0.62 });
  await page.mouse.move(escapeStart.x, escapeStart.y);
  await page.mouse.down();
  await page.mouse.move(escapeEnd.x, escapeEnd.y);
  await expect(page.locator("#workspace-fog-circle")).toBeVisible();
  const previewCircleBox = await page.locator("#workspace-fog-circle").boundingBox();
  expect(previewCircleBox).not.toBeNull();
  const previewRadius = Math.hypot(escapeEnd.x - escapeStart.x, escapeEnd.y - escapeStart.y);
  expect(previewCircleBox.x + previewCircleBox.width / 2).toBeCloseTo(escapeStart.x, 1);
  expect(previewCircleBox.y + previewCircleBox.height / 2).toBeCloseTo(escapeStart.y, 1);
  expect(previewCircleBox.width).toBeCloseTo(previewRadius * 2, 1);
  expect(previewCircleBox.height).toBeCloseTo(previewRadius * 2, 1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#workspace-fog-circle")).toBeHidden();
  await page.mouse.up();
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("3");

  const campaignJson = JSON.parse(fs.readFileSync(path.join(app.dataRoot, "The Long Walk", "campaign.json"), "utf8"));
  const forestFog = campaignJson.maps.find((map) => map.name === "forest").fog;
  expect(forestFog).toHaveLength(3);
  expect(forestFog[0].type).toBe("hide-circle");
  expect(forestFog[0].circle.x).toBeCloseTo(0.5, 2);
  expect(forestFog[0].circle.y).toBeCloseTo(0.5, 2);
  expect(forestFog[0].circle.radius).toBeCloseTo(0.22, 2);
  expect(forestFog[1].type).toBe("reveal-circle");
  expect(forestFog[1].circle.x).toBeCloseTo(0.5, 2);
  expect(forestFog[1].circle.y).toBeCloseTo(0.5, 2);
  expect(forestFog[1].circle.radius).toBeCloseTo(0.08, 2);
  expect(forestFog[2].type).toBe("hide-circle");
  expect(forestFog[2].circle.x).toBeCloseTo(0.95, 2);
  expect(forestFog[2].circle.y).toBeCloseTo(0.5, 2);
  expect(forestFog[2].circle.radius).toBeCloseTo(0.5, 2);

  const playerAssetRequestsBeforeUnshownCircle = playerAssetRequests;
  await page.getByRole("button", { name: "Back to Campaign" }).click();
  await caveCard.getByRole("button", { name: "Open cave for prep" }).click();
  await page.getByRole("button", { name: "Circle" }).click();
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await dragMapRectangle(page, "#active-map-canvas", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.65 });
  await expect.poll(() => page.locator("#active-map-canvas").getAttribute("data-fog-operations")).toBe("1");
  await expect.poll(() => player.locator("#player-map").getAttribute("data-fog-operations")).toBe("3");
  expect(playerAssetRequests).toBe(playerAssetRequestsBeforeUnshownCircle);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
});

test("active map uses centered contain geometry across table viewports", async ({ app, page, context }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "landscape.png", 800, 400));
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();

  const player = await context.newPage();
  await player.setViewportSize({ height: 768, width: 1024 });
  await player.goto(`${app.baseURL}/player`);
  const canvas = player.getByRole("img", { name: "Map: landscape" });
  await expect(canvas).toBeVisible();

  const metrics = await canvas.evaluate((element) => ({
    drawHeight: Number(element.dataset.drawHeight),
    drawWidth: Number(element.dataset.drawWidth),
    drawX: Number(element.dataset.drawX),
    drawY: Number(element.dataset.drawY),
    stageHeight: element.clientHeight,
    stageWidth: element.clientWidth
  }));
  expect(metrics.drawWidth / metrics.drawHeight).toBeCloseTo(2, 2);
  expect(metrics.drawWidth).toBeLessThanOrEqual(metrics.stageWidth);
  expect(metrics.drawHeight).toBeLessThanOrEqual(metrics.stageHeight);
  expect(Math.abs(metrics.drawX - (metrics.stageWidth - metrics.drawWidth) / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.drawY - (metrics.stageHeight - metrics.drawHeight) / 2)).toBeLessThanOrEqual(1);
  expect(await player.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await player.getByRole("button", { name: "Zoom in" }).click();
  await player.evaluate(() => Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 4 }));
  await player.setViewportSize({ height: 1080, width: 1920 });
  await expect
    .poll(() => canvas.evaluate((element) => Number(element.dataset.drawWidth)))
    .toBeGreaterThan(metrics.drawWidth);
  await expect(player.getByText("125%", { exact: true })).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.width / element.clientWidth)).toBe(2);
  expect(await player.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await uploadMapFile(page, await sizedPngFile(page, "portrait.png", 400, 800));
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  const portraitCanvas = player.getByRole("img", { name: "Map: portrait" });
  await expect(portraitCanvas).toBeVisible();
  await expect
    .poll(() =>
      portraitCanvas.evaluate((element) => Number(element.dataset.drawWidth) / Number(element.dataset.drawHeight))
    )
    .toBeCloseTo(0.5, 2);
  const portraitMetrics = await portraitCanvas.evaluate((element) => ({
    drawHeight: Number(element.dataset.drawHeight),
    drawWidth: Number(element.dataset.drawWidth),
    stageHeight: element.clientHeight,
    stageWidth: element.clientWidth
  }));
  expect(portraitMetrics.drawWidth).toBeLessThanOrEqual(portraitMetrics.stageWidth);
  expect(portraitMetrics.drawHeight).toBeLessThanOrEqual(portraitMetrics.stageHeight);
});

test("Player Display can enter and exit fullscreen locally", async ({ app, page, context }) => {
  const player = await context.newPage();
  await player.addInitScript(() => {
    window.__fullscreenRequests = [];
    let fullscreenElement = null;

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async function requestFullscreen() {
        fullscreenElement = this;
        window.__fullscreenRequests.push(this.className);
        document.dispatchEvent(new Event("fullscreenchange"));
      }
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: async () => {
        fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      }
    });
  });

  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "landscape.png", 800, 400));
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();

  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: landscape" })).toBeVisible();
  await expect(player.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  await player.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(player.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  await expect.poll(() => player.evaluate(() => window.__fullscreenRequests)).toEqual(["player-display"]);
  await expect
    .poll(() => player.evaluate(() => document.fullscreenElement?.classList.contains("player-display")))
    .toBe(true);
  await expect(player.getByRole("img", { name: "Map: landscape" })).toBeVisible();
  await expect(player.locator("input, select, textarea, [contenteditable=true], [data-action]")).toHaveCount(0);

  await player.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(player.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  await expect.poll(() => player.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test("Player Display fullscreen failure stays local and quiet", async ({ app, page, context }) => {
  const player = await context.newPage();
  await player.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {
        throw new Error("Denied.");
      }
    });
  });

  await openGm(page, app.baseURL);
  await createCampaign(page);
  await uploadMapFile(page, await sizedPngFile(page, "forest.png", 800, 400));
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();

  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await player.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(player.getByText("Fullscreen is unavailable in this browser.", { exact: true })).toBeVisible();
  await expect(player.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  await expect(page.getByLabel("Breadcrumb")).toHaveText("Campaign Library / The Long Walk");
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
});

test("same map ID in another campaign resets the player viewport", async ({ app, page, context }) => {
  await openGm(page, app.baseURL);
  await createCampaign(page, "First Campaign");
  await addMap(page, "forest.png");
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  await createCampaign(page, "Second Campaign");
  await addMap(page, "forest.png");
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();

  const player = await context.newPage();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("125%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Back to Campaign Library" }).click();
  await page
    .locator(".campaign-card")
    .filter({ hasText: "First Campaign" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(player.getByText("100%", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
});

test("player reports connection loss and restores active state", async ({ app, page, context }) => {
  test.setTimeout(30_000);
  const gm = await context.newPage();
  await openGm(gm, app.baseURL);
  await createCampaign(gm);
  await addMap(gm, "forest.png");
  await gm.getByRole("button", { name: "Show to Players", exact: true }).click();

  await page.goto(`${app.baseURL}/player`);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();

  await page.context().setOffline(true);
  await expect(page.getByText("Reconnecting...", { exact: true })).toBeVisible();
  await expectGmHeader(gm, "Campaign Library / The Long Walk", "Reconnecting...");

  await page.context().setOffline(false);
  await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expectGmHeader(gm, "Campaign Library / The Long Walk");
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
});

test("player reports an active-map image load failure", async ({ app, page, context }) => {
  const player = await context.newPage();
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await addMap(page, "forest.png");
  const forestMapId = await page.locator(".encounter-card").filter({ hasText: "forest" }).getAttribute("data-map-id");
  app.seedFogOperations("The Long Walk", forestMapId, [
    { type: "hide-rectangle", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }
  ]);

  await page.route("**/api/campaigns/*/maps/*/asset*", (route) => route.fulfill({ status: 500 }));
  await player.route("**/api/player/active-map/asset*", (route) => route.fulfill({ status: 500 }));
  await player.goto(`${app.baseURL}/player`);
  await page.getByRole("button", { name: "Open forest for prep" }).click();
  await page.getByRole("button", { name: "Show to Players from workspace" }).click();

  await expect(page.getByText("Map image could not be loaded.", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeHidden();
  await expect(player.getByText("Map image could not be loaded.", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeHidden();
  await expect(player.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Clear Fog" })).toBeEnabled();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Clear Fog" }).click();
  await expect(page.getByRole("button", { name: "Clear Fog" })).toBeDisabled();
});

test("stale image completion cannot replace a newer active map", async ({ app, page, context }) => {
  await openGm(page, app.baseURL);
  await createCampaign(page);
  const oldMap = await sizedPngFile(page, "forest.png", 80, 40, "#ff0000", "#ff0000");
  const newMap = await sizedPngFile(page, "cave.png", 80, 40, "#0000ff", "#0000ff");
  await uploadMapFile(page, oldMap);
  await uploadMapFile(page, newMap);

  const player = await context.newPage();
  let delayedRoute;
  let requestCount = 0;
  await player.route("**/api/player/active-map/asset*", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      delayedRoute = route;
      return;
    }
    await route.fulfill({ body: newMap.buffer, contentType: "image/png" });
  });
  await player.goto(`${app.baseURL}/player`);

  await page.getByRole("button", { name: "Show to Players", exact: true }).first().click();
  await expect.poll(() => Boolean(delayedRoute)).toBe(true);
  await expect(page.locator(".status-pill").filter({ hasText: "Shown to Players" })).toBeVisible();
  await page.getByRole("button", { name: "Show to Players", exact: true }).click();
  const canvas = player.getByRole("img", { name: "Map: cave" });
  await expect(canvas).toBeVisible();

  await delayedRoute.fulfill({ body: oldMap.buffer, contentType: "image/png" });
  await player.waitForTimeout(100);
  expect(
    await canvas.evaluate((element) => {
      const context = element.getContext("2d");
      return [...context.getImageData(element.width / 2, element.height / 2, 1, 1).data];
    })
  ).toEqual([0, 0, 255, 255]);
});
