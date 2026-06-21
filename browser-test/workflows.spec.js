"use strict";

const { PNG_BYTES } = require("../test-support/fixtures");
const { expect, test } = require("./fixtures");

const pngFile = (name) => ({
  buffer: PNG_BYTES,
  mimeType: "image/png",
  name
});

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
  await openGm(page, app.baseURL);
  await player.goto(`${app.baseURL}/player`);
  await expect(player.getByRole("heading", { level: 1, name: "Player Display" })).toBeVisible();
  await expect(player.getByText("Live", { exact: true })).toBeVisible();
  await expect(player.getByText("Waiting for GM.", { exact: true })).toBeVisible();

  await createCampaign(page);
  await addMap(page, "forest.png");
  await addMap(page, "cave.png");

  await page.getByRole("button", { name: "Show to players" }).first().click();
  await expect(page.getByRole("img", { name: "forest" })).toBeVisible();
  await expect(player.getByRole("img", { name: "forest" })).toBeVisible();
  await expect
    .poll(() => player.getByRole("img", { name: "forest" }).evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Show to players" }).click();
  await expect(player.getByRole("img", { name: "cave" })).toBeVisible();
  await expect(player.locator("button, input, select, textarea, [contenteditable=true]")).toHaveCount(0);

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
});

test("player reports connection loss and restores active state", async ({ app, page, context }) => {
  const gm = await context.newPage();
  await openGm(gm, app.baseURL);
  await createCampaign(gm);
  await addMap(gm, "forest.png");
  await gm.getByRole("button", { name: "Show to players" }).click();

  await page.goto(`${app.baseURL}/player`);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "forest" })).toBeVisible();

  await page.context().setOffline(true);
  await expect(page.getByText("Reconnecting...", { exact: true })).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "forest" })).toBeVisible();
  await expect
    .poll(() => page.getByRole("img", { name: "forest" }).evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
});

test("player reports an active-map image load failure", async ({ app, page, context }) => {
  const player = await context.newPage();
  await openGm(page, app.baseURL);
  await createCampaign(page);
  await addMap(page, "forest.png");

  await player.route("**/api/player/active-map/asset", (route) => route.fulfill({ status: 500 }));
  await player.goto(`${app.baseURL}/player`);
  await page.getByRole("button", { name: "Show to players" }).click();

  await expect(player.getByText("Map image could not be loaded.", { exact: true })).toBeVisible();
  await expect(player.getByRole("img", { name: "forest" })).toBeHidden();
});
