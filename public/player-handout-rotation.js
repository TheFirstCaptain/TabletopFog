const ROTATIONS = [0, 90, 180, 270];

function normalizeRotation(value) {
  return ROTATIONS.includes(value) ? value : 0;
}

function targetKey(target) {
  if (!target?.id || !target.type) return null;
  return `${target.type}:${target.campaignId || "campaign"}:${target.id}`;
}

export function createPlayerHandoutRotation({ render }) {
  let currentTarget = null;
  let currentTargetKey = null;
  let localRotation = 0;

  function renderCurrentTarget() {
    render(
      currentTarget
        ? {
            ...currentTarget,
            fogOperations: currentTarget.fogOperations || [],
            rotation:
              currentTarget.type === "handout"
                ? normalizeRotation(normalizeRotation(currentTarget.rotation) + localRotation)
                : normalizeRotation(currentTarget.rotation)
          }
        : null
    );
  }

  return {
    isHandoutShown() {
      return currentTarget?.type === "handout";
    },
    rotate(direction) {
      if (currentTarget?.type !== "handout") return;
      localRotation = normalizeRotation(localRotation + (direction === "left" ? 270 : 90));
      renderCurrentTarget();
    },
    setTarget(target) {
      const nextTarget = target ? { ...target } : null;
      const nextKey = targetKey(nextTarget);
      if (nextKey !== currentTargetKey) localRotation = 0;
      currentTarget = nextTarget;
      currentTargetKey = nextKey;
      renderCurrentTarget();
    }
  };
}
