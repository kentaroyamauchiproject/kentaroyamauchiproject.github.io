"use strict";

/**
 * Shared continuation cards and App Store links for MINDBEBOP browser experiences.
 * IDs align with MindEntry/MindBebopPartnerApp.swift where available.
 */
window.MindBebopContinuation = (function () {
  var FALLBACK_SITE = "https://www.mindbebop.com/";

  /** App Store product pages for standalone MINDBEBOP apps. */
  var APP_STORE = {
    MindFlipOut: "https://apps.apple.com/app/id6752633008",
    MindShoutOut: "https://apps.apple.com/app/id6752512145",
    MindZoneOut: "https://apps.apple.com/app/id6753839181",
    MindBackOut: "https://apps.apple.com/app/id6757397623",
    MindBackyard: "https://apps.apple.com/app/id6755857619",
    MindEntry: "https://apps.apple.com/app/id6760157253"
  };

  var MIND_EASE_OUT_CARD = {
    title: "MindEaseOut",
    body: [
      "MindEaseOut is available within the MINDBEBOP apps as a simple way to let thoughts go.",
      "It is not a separate app."
    ],
    exploreLabel: "Explore MINDBEBOP",
    exploreURL: FALLBACK_SITE
  };

  var CARDS = {
    MindFlipOut: {
      title: "Continue in MindFlipOut",
      features: [
        "Save your flips",
        "Search your thoughts",
        "Pin important entries",
        "Edit and remix later",
        "Open from other MINDBEBOP apps"
      ]
    },
    MindShoutOut: {
      title: "Continue in MindShoutOut",
      features: [
        "Schedule text and audio shouts",
        "Toss, repeat, and calendar options",
        "Notifications at the time you choose",
        "Choose where a shout opens when tapped",
        "Search, pin, and edit saved shouts"
      ]
    },
    MindZoneOut: {
      title: "Continue in MindZoneOut",
      features: [
        "Timed zone sessions",
        "Whispers and reflections",
        "MindTouch and whisper overlays during a zone",
        "Search and pin entries",
        "Send a thought to MindEntry or other apps"
      ]
    },
    MindBackOut: {
      title: "Continue in MindBackOut",
      features: [
        "Lock selected apps during Backroom time",
        "Standard, Commitment, and First Move modes",
        "Optional timer and countdown",
        "Optional note for why you're here"
      ]
    },
    MindBackyard: {
      title: "Continue in MindBackyard",
      features: [
        "Explore the hallway and chambers",
        "Multiple quiet spaces to enter",
        "Return to the hall between rooms"
      ]
    },
    MindEntry: {
      title: "Continue in MindEntry",
      features: [
        "Route thoughts to MINDBEBOP apps",
        "Run multi-step recipes across apps",
        "Save and organize recipes",
        "Import and share recipe codes",
        "Mind Detox Recipes catalog"
      ]
    }
  };

  var dialogEl = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function storeURL(appName) {
    var listing = APP_STORE[appName];
    return listing || FALLBACK_SITE;
  }

  function boundaryBlock(appName) {
    if (window.MindBebopBoundary && MindBebopBoundary.noticeHTML) {
      return MindBebopBoundary.noticeHTML({
        appName: appName,
        body: "Download the iPhone app to continue with full features.",
        wrapperClass: "mb-boundary-notice mb-boundary-notice-inline"
      });
    }
    return "";
  }

  function cardData(appName) {
    if (appName === "MindEaseOut") return MIND_EASE_OUT_CARD;
    return CARDS[appName] || null;
  }

  function mindEaseOutCardHTML(wrapperClass) {
    var bodyHtml = MIND_EASE_OUT_CARD.body.map(function (paragraph) {
      return '<p class="mb-continuation-intro">' + escapeHtml(paragraph) + "</p>";
    }).join("");

    return (
      '<div class="' + escapeHtml(wrapperClass) + '">' +
        boundaryBlock("MindEaseOut") +
        '<p class="mb-continuation-title">' + escapeHtml(MIND_EASE_OUT_CARD.title) + "</p>" +
        bodyHtml +
        '<a class="mb-continuation-download" href="' + escapeHtml(MIND_EASE_OUT_CARD.exploreURL) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(MIND_EASE_OUT_CARD.exploreLabel) + "</a>" +
      "</div>"
    );
  }

  function cardHTML(appName, options) {
    var opts = options || {};
    var wrapperClass = opts.wrapperClass || "mb-continuation-card";

    if (appName === "MindEaseOut") {
      return mindEaseOutCardHTML(wrapperClass);
    }

    var card = cardData(appName);
    if (!card) return "";

    var featuresHtml = card.features.map(function (feature) {
      return "<li>" + escapeHtml(feature) + "</li>";
    }).join("");

    var listingURL = APP_STORE[appName];
    var downloadHtml = '<a class="mb-continuation-download" href="' + escapeHtml(listingURL) + '" target="_blank" rel="noopener noreferrer">Download ' + escapeHtml(appName) + "</a>";

    return (
      '<div class="' + escapeHtml(wrapperClass) + '">' +
        boundaryBlock(appName) +
        '<p class="mb-continuation-title">' + escapeHtml(card.title) + "</p>" +
        '<p class="mb-continuation-lead">The iPhone app also includes:</p>' +
        '<ul class="mb-continuation-list">' + featuresHtml + "</ul>" +
        downloadHtml +
      "</div>"
    );
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;

    dialogEl = document.createElement("dialog");
    dialogEl.id = "mbContinuationDialog";
    dialogEl.className = "mb-continuation-dialog";
    dialogEl.innerHTML =
      '<form method="dialog" class="mb-continuation-dialog-card">' +
        '<div id="mbContinuationDialogBody"></div>' +
        "<menu><button type=\"submit\" class=\"mb-continuation-dismiss\">Close</button></menu>" +
      "</form>";
    document.body.appendChild(dialogEl);
    return dialogEl;
  }

  function showDialog(appName) {
    var card = cardData(appName);
    if (!card && appName !== "MindEaseOut") return;

    var dialog = ensureDialog();
    var body = dialog.querySelector("#mbContinuationDialogBody");
    if (!body) return;

    body.innerHTML = cardHTML(appName, { wrapperClass: "mb-continuation-card mb-continuation-card-dialog" });
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }

  return {
    APP_STORE: APP_STORE,
    CARDS: CARDS,
    MIND_EASE_OUT_CARD: MIND_EASE_OUT_CARD,
    storeURL: storeURL,
    cardHTML: cardHTML,
    showDialog: showDialog
  };
})();
