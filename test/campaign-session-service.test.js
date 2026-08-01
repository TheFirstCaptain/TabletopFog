"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createCampaignSessionService } = require("../server/campaign-session-service");
const { createStateStore } = require("../server/state");

function addAssetUrls(campaign) {
  return {
    ...campaign,
    handouts: (campaign.handouts || []).map((handout) => ({
      ...handout,
      assetUrl: `/handouts/${handout.id}`
    })),
    maps: campaign.maps.map((map) => ({
      ...map,
      assetUrl: `/maps/${map.id}`
    }))
  };
}

test("campaign session service applies shown-target mutations to storage state and broadcasts", () => {
  const stateStore = createStateStore();
  const broadcasts = [];
  const storedCampaign = {
    id: "The Long Walk",
    handouts: [],
    maps: [{ id: "forest", name: "Forest", fog: [] }],
    shownTarget: null
  };
  const campaignStorage = {
    addAssetUrls,
    setShownTarget(campaignId, target) {
      assert.equal(campaignId, "The Long Walk");
      return {
        ...storedCampaign,
        shownTarget: target
      };
    }
  };
  const service = createCampaignSessionService({
    campaignStorage,
    onStateChange(state) {
      broadcasts.push(state);
    },
    stateStore
  });

  const campaign = service.setShownTarget("The Long Walk", { id: "forest", type: "encounter" });

  assert.deepEqual(campaign.shownTarget, { id: "forest", type: "encounter" });
  assert.equal(campaign.maps[0].assetUrl, "/maps/forest");
  assert.equal(stateStore.getState().campaign.shownTarget.id, "forest");
  assert.equal(broadcasts.length, 1);
  assert.deepEqual(broadcasts[0].campaign, stateStore.getState().campaign);
});

test("campaign session service preserves runtime state when fog persistence fails", () => {
  const stateStore = createStateStore();
  const broadcasts = [];
  const storedCampaign = addAssetUrls({
    id: "The Long Walk",
    handouts: [],
    maps: [{ id: "forest", name: "Forest", fog: [] }],
    shownTarget: { id: "forest", type: "encounter" }
  });
  const campaignStorage = {
    addAssetUrls,
    setMapFog() {
      throw new Error("Persist failed.");
    }
  };
  stateStore.setCampaign(storedCampaign);
  const before = stateStore.getState();
  const service = createCampaignSessionService({
    campaignStorage,
    onStateChange(state) {
      broadcasts.push(state);
    },
    stateStore
  });

  assert.throws(
    () =>
      service.appendFogOperation("The Long Walk", "forest", {
        rect: { height: 0.2, width: 0.2, x: 0.1, y: 0.1 },
        type: "hide-rectangle"
      }),
    /Persist failed/
  );
  assert.deepEqual(stateStore.getState(), before);
  assert.deepEqual(broadcasts, []);
  assert.equal(stateStore.canUndoFogOperation("The Long Walk", "forest"), false);
});
