"use strict";

function createInitialState() {
  return {
    campaign: null,
    version: 0,
    updatedAt: new Date(0).toISOString()
  };
}

function createStateStore() {
  let state = createInitialState();

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function updateCampaign(campaign) {
    state = {
      campaign,
      version: state.version + 1,
      updatedAt: new Date().toISOString()
    };

    return snapshot();
  }

  return {
    getState: snapshot,
    setCampaign(campaign) {
      return updateCampaign(campaign);
    }
  };
}

module.exports = {
  createInitialState,
  createStateStore
};
