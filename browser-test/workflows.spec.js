"use strict";

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
  await expect(page.getByRole("heading", { level: 1, name: "Campaign Library" })).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
}

async function createCampaign(page, name = "The Long Walk") {
  await page.getByLabel("New campaign").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

async function addMap(page, name) {
  await page.getByLabel("Add map").setInputFiles(pngFile(name));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("textbox", { name: `Map name for ${name.replace(/\.png$/, "")}` })).toBeVisible();
}

test("GM creates, reopens, uploads, renames, and reorders campaign maps", async ({ app, page }) => {
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await expect(page.getByText("Add a map to begin.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "The Long Walk" })).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "The Long Walk" })).toBeVisible();

  await page.getByLabel("Add map").setInputFiles({
    buffer: Buffer.from("not-an-image"),
    mimeType: "image/png",
    name: "invalid.png"
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/supported map image/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Map name for/ })).toHaveCount(0);

  await addMap(page, "forest.png");
  await addMap(page, "cave.png");

  const forestName = page.getByRole("textbox", { name: "Map name for forest" });
  await forestName.fill("Forest Ambush");
  await page.getByRole("button", { name: "Rename" }).first().click();
  await expect(page.getByRole("textbox", { name: "Map name for Forest Ambush" })).toHaveValue("Forest Ambush");

  await page.getByRole("button", { name: "Up" }).nth(1).click();
  await expect
    .poll(() =>
      page.getByRole("textbox", { name: /^Map name for/ }).evaluateAll((inputs) => inputs.map((input) => input.value))
    )
    .toEqual(["cave", "Forest Ambush"]);
  await expect(page.getByRole("button", { name: "Up" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Down" }).nth(1)).toBeDisabled();
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

  await page.getByRole("button", { name: "Show to players" }).first().click();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(secondPlayer.getByRole("img", { name: "Map: forest" })).toBeVisible();

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

  await page.getByRole("button", { name: "Show to players" }).click();
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

test("active map uses centered contain geometry across table viewports", async ({ app, page, context }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await page.getByLabel("Add map").setInputFiles(await sizedPngFile(page, "landscape.png", 800, 400));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Show to players" }).click();

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

  await page.getByLabel("Add map").setInputFiles(await sizedPngFile(page, "portrait.png", 400, 800));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Map name for portrait" })).toBeVisible();
  await page.getByRole("button", { name: "Show to players" }).click();
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

test("same map ID in another campaign resets the player viewport", async ({ app, page, context }) => {
  await openGm(page, app.baseURL);
  await createCampaign(page, "First Campaign");
  await addMap(page, "forest.png");
  await page.getByRole("button", { name: "Show to players" }).click();
  await page.getByRole("button", { name: "Library" }).click();
  await createCampaign(page, "Second Campaign");
  await addMap(page, "forest.png");
  await page.getByRole("button", { name: "Show to players" }).click();

  const player = await context.newPage();
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await player.getByRole("button", { name: "Zoom in" }).click();
  await expect(player.getByText("125%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Library" }).click();
  await page
    .locator(".campaign-item")
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
  await gm.getByRole("button", { name: "Show to players" }).click();

  await page.goto(`${app.baseURL}/player`);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();

  await page.context().setOffline(true);
  await expect(page.getByText("Reconnecting...", { exact: true })).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeVisible();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
});

test("player reports an active-map image load failure", async ({ app, page, context }) => {
  const player = await context.newPage();
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await addMap(page, "forest.png");

  await page.route("**/api/campaigns/*/maps/*/asset*", (route) => route.fulfill({ status: 500 }));
  await player.route("**/api/player/active-map/asset*", (route) => route.fulfill({ status: 500 }));
  await player.goto(`${app.baseURL}/player`);
  await page.getByRole("button", { name: "Show to players" }).click();

  await expect(page.getByText("Map image could not be loaded.", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Map: forest" })).toBeHidden();
  await expect(player.getByText("Map image could not be loaded.", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: "Map: forest" })).toBeHidden();
  await expect(player.getByRole("button", { name: "Zoom in" })).toBeDisabled();
});

test("stale image completion cannot replace a newer active map", async ({ app, page, context }) => {
  await openGm(page, app.baseURL);
  await createCampaign(page);
  const oldMap = await sizedPngFile(page, "forest.png", 80, 40, "#ff0000", "#ff0000");
  const newMap = await sizedPngFile(page, "cave.png", 80, 40, "#0000ff", "#0000ff");
  await page.getByLabel("Add map").setInputFiles(oldMap);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Map name for forest" })).toBeVisible();
  await page.getByLabel("Add map").setInputFiles(newMap);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Map name for cave" })).toBeVisible();

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

  await page.getByRole("button", { name: "Show to players" }).first().click();
  await expect.poll(() => Boolean(delayedRoute)).toBe(true);
  await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
  await page.getByRole("button", { name: "Show to players" }).click();
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
