"use strict";

/**
 * Red boundary notices for iPhone-only features in MINDBEBOP browser experiences.
 */
window.MindBebopBoundary = (function () {
  var FALLBACK_SITE = "https://www.mindbebop.com/";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function storeURL(appName) {
    if (window.MindBebopContinuation && MindBebopContinuation.storeURL) {
      return MindBebopContinuation.storeURL(appName);
    }
    return FALLBACK_SITE;
  }

  /**
   * @param {object} options
   * @param {string} [options.title]
   * @param {string} [options.body]
   * @param {string} [options.appName] - standalone app for Download link
   * @param {string} [options.wrapperClass]
   */
  function noticeHTML(options) {
    var opts = options || {};
    var wrapperClass = opts.wrapperClass || "mb-boundary-notice";
    var title = opts.title || "Available on iPhone";
    var body = opts.body || "This step continues in the native iPhone app.";
    var appName = opts.appName || "";

    var actionHtml = "";
    if (appName === "MindEaseOut") {
      actionHtml =
        '<a class="mb-boundary-download" href="' + escapeHtml(FALLBACK_SITE) + '" target="_blank" rel="noopener noreferrer">Explore MINDBEBOP</a>';
    } else if (appName) {
      actionHtml =
        '<a class="mb-boundary-download" href="' + escapeHtml(storeURL(appName)) + '" target="_blank" rel="noopener noreferrer">Download ' + escapeHtml(appName) + "</a>";
    }

    return (
      '<div class="' + escapeHtml(wrapperClass) + '" role="note" aria-label="iPhone-only feature">' +
        '<p class="mb-boundary-title">' + escapeHtml(title) + "</p>" +
        '<p class="mb-boundary-body">' + escapeHtml(body) + "</p>" +
        actionHtml +
      "</div>"
    );
  }

  function partnerStepHTML(appName, instruction) {
    var body = instruction
      ? "Open " + appName + " on iPhone to continue this recipe step."
      : "This recipe step opens " + appName + " on iPhone.";
    return noticeHTML({
      appName: appName,
      body: body,
      wrapperClass: "mb-boundary-notice mb-boundary-notice-step"
    });
  }

  return {
    noticeHTML: noticeHTML,
    partnerStepHTML: partnerStepHTML
  };
})();
