"use strict";

/**
 * Cross-app About wiring for simulator app headers.
 * - App logo: opens existing continuation dialog for that app.
 * - Company logo: opens shared About MINDBEBOP dialog.
 */
(function () {
  var APP_NAME_BY_BODY = {
    "me-body": "MindEntry",
    "mfo-body": "MindFlipOut",
    "mso-body": "MindShoutOut",
    "mzo-body": "MindZoneOut",
    "mbo-body": "MindBackOut",
    "mby-body": "MindBackyard"
  };

  var COMPANY_DIALOG_ID = "mbCompanyAboutDialog";

  function bodyClass() {
    return document.body ? document.body.className || "" : "";
  }

  function appNameForPage() {
    var classes = bodyClass().split(/\s+/).filter(Boolean);
    for (var i = 0; i < classes.length; i += 1) {
      if (APP_NAME_BY_BODY[classes[i]]) {
        return APP_NAME_BY_BODY[classes[i]];
      }
    }
    return "";
  }

  function ensureCompanyDialog() {
    var existing = document.getElementById(COMPANY_DIALOG_ID);
    if (existing) return existing;

    var dialog = document.createElement("dialog");
    dialog.id = COMPANY_DIALOG_ID;
    dialog.className = "mb-continuation-dialog";
    dialog.innerHTML =
      '<form method="dialog" class="mb-continuation-dialog-card">' +
        '<div class="mb-continuation-card mb-continuation-card-dialog">' +
          '<p class="mb-continuation-title">About MINDBEBOP</p>' +
          '<p class="mb-continuation-intro">Every browser experience reproduces the native app as closely as the web allows.</p>' +
          '<p class="mb-continuation-intro">Steps that require iPhone-only features are marked with a red boundary.</p>' +
          '<a class="mb-continuation-download" href="https://www.mindbebop.com/" target="_blank" rel="noopener noreferrer">Explore MINDBEBOP</a>' +
        "</div>" +
        "<menu><button type=\"submit\" class=\"mb-continuation-dismiss\">Close</button></menu>" +
      "</form>";
    document.body.appendChild(dialog);
    return dialog;
  }

  function openCompanyDialog() {
    var dialog = ensureCompanyDialog();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }

  function wireButtons() {
    var appName = appNameForPage();
    if (!appName) return;

    var logoBtn = document.querySelector('[class$="-logo-btn"]');
    var companyBtn = document.querySelector('[class$="-company-btn"]');

    if (logoBtn && window.MindBebopContinuation && typeof MindBebopContinuation.showDialog === "function") {
      logoBtn.addEventListener("click", function () {
        MindBebopContinuation.showDialog(appName);
      });
    }

    if (companyBtn) {
      companyBtn.addEventListener("click", openCompanyDialog);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButtons);
  } else {
    wireButtons();
  }
})();
