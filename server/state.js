"use strict";

function createInitialState() {
  return {
    counter: 0,
    version: 0,
    updatedAt: new Date(0).toISOString()
  };
}

function createStateStore() {
  let state = createInitialState();

  function snapshot() {
    return { ...state };
  }

  function updateCounter(counter) {
    state = {
      counter,
      version: state.version + 1,
      updatedAt: new Date().toISOString()
    };

    return snapshot();
  }

  return {
    getState: snapshot,
    increment() {
      return updateCounter(state.counter + 1);
    }
  };
}

module.exports = {
  createInitialState,
  createStateStore
};
