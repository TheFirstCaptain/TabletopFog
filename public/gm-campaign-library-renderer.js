import { createButton, DEFAULT_CAMPAIGN_ICON } from "./gm-render-helpers.js";

export function createCampaignLibraryRenderer(document, elements) {
  function renderLibrary({ campaigns, diagnostics }) {
    elements.campaignList.replaceChildren();
    elements.libraryDiagnostics.replaceChildren();

    diagnostics.forEach((diagnostic) => {
      const item = document.createElement("p");
      item.className = "library-diagnostic";
      const prefix = diagnostic.type === "recovered" ? "Recovered campaign" : "Skipped campaign";
      item.textContent = `${prefix} "${diagnostic.campaignId}": ${diagnostic.message}`;
      elements.libraryDiagnostics.append(item);
    });

    if (campaigns.length === 0) {
      elements.libraryMessage.textContent =
        diagnostics.length === 0 ? "No campaigns yet." : "No valid campaigns available.";
      return;
    }

    elements.libraryMessage.textContent = "";
    campaigns.forEach((campaign, index) => {
      const item = document.createElement("article");
      item.className = "campaign-card";
      item.dataset.campaignId = campaign.id;
      item.dataset.editing = "false";

      const icon = document.createElement("div");
      icon.className = "campaign-card-icon";
      icon.textContent = campaign.icon || DEFAULT_CAMPAIGN_ICON;
      icon.setAttribute("aria-hidden", "true");

      const body = document.createElement("div");
      body.className = "campaign-card-body";

      const title = document.createElement("h3");
      title.textContent = campaign.name;

      const description = document.createElement("p");
      description.className = "campaign-description";
      description.textContent = campaign.description || "No description yet.";

      const meta = document.createElement("div");
      meta.className = "campaign-card-meta muted";

      const mapCount = document.createElement("span");
      mapCount.className = "campaign-card-map-count";
      mapCount.textContent = `${campaign.mapCount} map${campaign.mapCount === 1 ? "" : "s"}`;
      meta.append(mapCount);

      if (campaign.handoutCount) {
        const handoutCount = document.createElement("span");
        handoutCount.className = "campaign-card-handout-count";
        handoutCount.textContent = `${campaign.handoutCount} handout${campaign.handoutCount === 1 ? "" : "s"}`;
        meta.append(handoutCount);
      }

      if (campaign.shownTargetName) {
        const shown = document.createElement("span");
        shown.className = "campaign-card-shown";
        shown.textContent = `Shown to Players: ${
          campaign.shownTarget?.type === "handout" ? "Handout - " : ""
        }${campaign.shownTargetName}`;
        meta.append(shown);
      }

      body.append(title, description, meta);

      const actions = document.createElement("div");
      actions.className = "campaign-card-actions";

      const open = createButton(document, {
        action: "open-campaign",
        text: "Open"
      });
      open.dataset.campaignId = campaign.id;

      const edit = createButton(document, {
        action: "edit-campaign",
        className: "secondary",
        text: "Edit"
      });
      edit.setAttribute("aria-label", "Edit campaign details");

      const deleteBlockedReason =
        campaign.mapCount > 0 || campaign.handoutCount > 0
          ? "Delete this campaign's encounters and handouts before deleting the campaign."
          : "";
      const deleteReasonId = `delete-campaign-reason-${index}`;
      const deleteButton = createButton(document, {
        action: "delete-campaign",
        className: "secondary danger-secondary",
        disabled: Boolean(deleteBlockedReason),
        text: "Delete..."
      });
      deleteButton.dataset.campaignId = campaign.id;
      deleteButton.setAttribute("aria-label", `Delete ${campaign.name}`);
      if (deleteBlockedReason) {
        deleteButton.setAttribute("aria-describedby", deleteReasonId);
      }

      actions.append(open, edit, deleteButton);

      const form = document.createElement("form");
      form.className = "campaign-card-editor";
      form.dataset.action = "save-campaign-metadata";
      form.dataset.campaignId = campaign.id;

      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Campaign name";
      const nameInput = document.createElement("input");
      nameInput.name = "campaign-name";
      nameInput.type = "text";
      nameInput.autocomplete = "off";
      nameInput.required = true;
      nameInput.value = campaign.name;
      nameLabel.append(nameInput);

      const iconLabel = document.createElement("label");
      iconLabel.textContent = "Campaign icon";
      const iconInput = document.createElement("input");
      iconInput.name = "campaign-icon";
      iconInput.type = "text";
      iconInput.maxLength = 8;
      iconInput.value = campaign.icon || "";
      iconLabel.append(iconInput);

      const descriptionLabel = document.createElement("label");
      descriptionLabel.textContent = "Campaign description";
      const descriptionInput = document.createElement("textarea");
      descriptionInput.name = "campaign-description";
      descriptionInput.maxLength = 160;
      descriptionInput.rows = 3;
      descriptionInput.value = campaign.description || "";
      descriptionLabel.append(descriptionInput);

      const campaignImageSection = document.createElement("section");
      campaignImageSection.className = "campaign-image-editor";
      campaignImageSection.setAttribute("aria-label", "Campaign Image");

      const campaignImageLabel = document.createElement("p");
      campaignImageLabel.className = "campaign-image-label";
      campaignImageLabel.textContent = "Campaign Image";

      const campaignImageStatus = document.createElement("p");
      campaignImageStatus.className = "muted campaign-image-status";
      campaignImageStatus.textContent = campaign.campaignImage
        ? campaign.campaignImage.assetAvailable === false
          ? "Campaign Image file could not be found."
          : campaign.campaignImage.name || campaign.campaignImage.originalFileName || "Campaign Image set."
        : "No Campaign Image set.";

      const campaignImageFrame = document.createElement("div");
      campaignImageFrame.className = "campaign-image-preview-frame";
      campaignImageFrame.hidden = !campaign.campaignImage || campaign.campaignImage.assetAvailable === false;
      if (campaign.campaignImage && campaign.campaignImage.assetAvailable !== false) {
        const campaignImagePreview = document.createElement("img");
        campaignImagePreview.className = "campaign-image-preview";
        campaignImagePreview.src = campaign.campaignImage.assetUrl;
        campaignImagePreview.alt = `Campaign Image preview for ${campaign.name}`;
        campaignImageFrame.append(campaignImagePreview);
      }

      const campaignImageControls = document.createElement("div");
      campaignImageControls.className = "campaign-image-controls";
      const campaignImageInput = document.createElement("input");
      campaignImageInput.name = "campaign-image-file";
      campaignImageInput.type = "file";
      campaignImageInput.accept = "image/*";
      campaignImageInput.setAttribute("aria-label", "Campaign Image file");
      const uploadCampaignImage = createButton(document, {
        action: "upload-campaign-image",
        className: "secondary",
        text: campaign.campaignImage ? "Replace image" : "Upload image"
      });
      uploadCampaignImage.dataset.campaignId = campaign.id;
      const removeCampaignImage = createButton(document, {
        action: "remove-campaign-image",
        className: "secondary danger-secondary",
        disabled: !campaign.campaignImage,
        text: "Remove..."
      });
      removeCampaignImage.dataset.campaignId = campaign.id;
      removeCampaignImage.setAttribute("aria-label", `Remove Campaign Image from ${campaign.name}`);
      campaignImageControls.append(campaignImageInput, uploadCampaignImage, removeCampaignImage);
      campaignImageSection.append(campaignImageLabel, campaignImageFrame, campaignImageStatus, campaignImageControls);

      const editorActions = document.createElement("div");
      editorActions.className = "campaign-card-actions";
      const save = createButton(document, {
        action: "save-campaign-metadata",
        text: "Save"
      });
      save.type = "submit";
      save.setAttribute("aria-label", "Save campaign details");
      const cancel = createButton(document, {
        action: "cancel-campaign-edit",
        className: "secondary",
        text: "Cancel"
      });
      editorActions.append(save, cancel);

      const message = document.createElement("p");
      message.className = "campaign-card-message muted";
      message.setAttribute("aria-live", "polite");

      const deleteReason = document.createElement("p");
      deleteReason.className = "campaign-delete-reason";
      deleteReason.id = deleteReasonId;
      deleteReason.textContent = deleteBlockedReason;
      deleteReason.hidden = !deleteBlockedReason;

      form.append(nameLabel, iconLabel, descriptionLabel, campaignImageSection, editorActions);
      if (deleteBlockedReason) {
        actions.append(deleteReason);
      }
      item.append(icon, body, actions, form, message);
      elements.campaignList.append(item);
    });
  }

  function setCampaignCardMessage(campaignId, message, state = "error") {
    const card = elements.campaignList.querySelector(
      `[data-campaign-id="${document.defaultView.CSS.escape(campaignId)}"]`
    );
    if (!card) {
      elements.libraryMessage.textContent = message;
      return;
    }

    const cardMessage = card.querySelector(".campaign-card-message");
    cardMessage.textContent = message;
    cardMessage.classList.toggle("error-text", Boolean(message) && state === "error");
  }

  return { renderLibrary, setCampaignCardMessage };
}
