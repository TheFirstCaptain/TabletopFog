export const DEFAULT_CAMPAIGN_ICON = "🗺️";

export function createButton(document, { action, className, direction, disabled, handoutId, index, mapId, text }) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.dataset.action = action;

  if (className) button.className = className;
  if (direction) button.dataset.direction = direction;
  if (disabled) button.disabled = true;
  if (handoutId) button.dataset.handoutId = handoutId;
  if (index !== undefined) button.dataset.index = String(index);
  if (mapId) button.dataset.mapId = mapId;

  return button;
}

export function isShownTarget(campaign, type, id) {
  return campaign.shownTarget?.type === type && campaign.shownTarget.id === id;
}

export function shownHandoutRotation(campaign, handoutId) {
  if (!isShownTarget(campaign, "handout", handoutId)) return 0;
  return [0, 90, 180, 270].includes(campaign.shownTarget.rotation) ? campaign.shownTarget.rotation : 0;
}

export function setHandoutPreviewRotationScale(image) {
  const rotation = Number(image.dataset.rotation || 0);
  if (![90, 270].includes(rotation) || !image.naturalWidth || !image.naturalHeight) {
    image.style.setProperty("--handout-preview-rotation-scale", "1");
    return;
  }

  const frameAspectRatio = 16 / 10;
  const imageAspectRatio = image.naturalWidth / image.naturalHeight;
  const scale = imageAspectRatio <= 1 ? 1 : 1 / Math.min(imageAspectRatio, frameAspectRatio);
  image.style.setProperty("--handout-preview-rotation-scale", String(scale));
}

export function shownTargetLabel(campaign) {
  if (campaign.shownTarget?.type === "encounter") {
    const encounter = campaign.maps.find((map) => map.id === campaign.shownTarget.id);
    return encounter ? `Encounter - ${encounter.name}` : "None";
  }

  if (campaign.shownTarget?.type === "handout") {
    const handout = (campaign.handouts || []).find((candidate) => candidate.id === campaign.shownTarget.id);
    return handout ? `Handout - ${handout.name}` : "None";
  }

  return "None";
}

export function recoveryMessage(campaign) {
  const count = campaign.recoveryDiagnostics?.length || 0;
  if (count === 0) return "";

  const issueText = count === 1 ? "1 campaign issue" : `${count} campaign issues`;
  return `Recovered ${issueText}. Original campaign files were not changed.`;
}
