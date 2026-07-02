"use strict";

(function () {
  var WORDMARK_SIZES = [32, 28, 24, 22, 20];
  var SPACER_MIN = 4;

  function magnifyingGlassSvg(className) {
    return (
      '<svg class="' + className + '" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8.625 14.125C11.6879 14.125 14.1875 11.6253 14.1875 8.5625C14.1875 5.49967 11.6879 3 8.625 3C5.56217 3 3.0625 5.49967 3.0625 8.5625C3.0625 11.6253 5.56217 14.125 8.625 14.125Z" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M12.6875 12.6875L17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      "</svg>"
    );
  }

  function applyWordmarkSize(wordmark, size) {
    wordmark.style.fontSize = size + "px";
    var bold = wordmark.querySelector(".me-wordmark-bold, .bold, [class*='wordmark-bold']");
    if (bold) {
      bold.style.letterSpacing = (size >= 28 ? 0.6 : 0.35) + "px";
    }
  }

  function trailingBlock(header, wordmark) {
    return (
      header.querySelector(".me-header-actions") ||
      header.querySelector(".mso-company-btn, .mzo-company-btn, .mfo-company-btn, .mbo-company-btn, .mby-company-btn")
    );
  }

  function wordmarkFits(header, wordmark) {
    var trailing = trailingBlock(header, wordmark);
    if (!trailing) {
      return wordmark.scrollWidth <= header.clientWidth;
    }
    var wmRect = wordmark.getBoundingClientRect();
    var trailingRect = trailing.getBoundingClientRect();
    return wmRect.right + SPACER_MIN <= trailingRect.left;
  }

  function fitWordmark(header, wordmark) {
    var chosen = WORDMARK_SIZES[WORDMARK_SIZES.length - 1];
    for (var i = 0; i < WORDMARK_SIZES.length; i += 1) {
      applyWordmarkSize(wordmark, WORDMARK_SIZES[i]);
      if (wordmarkFits(header, wordmark)) {
        chosen = WORDMARK_SIZES[i];
        break;
      }
      chosen = WORDMARK_SIZES[i];
    }
    applyWordmarkSize(wordmark, chosen);
  }

  function initWordmarkFits() {
    document.querySelectorAll("[data-mb-wordmark-fit]").forEach(function (wordmark) {
      var header = wordmark.closest("header");
      if (!header) {
        return;
      }
      function refit() {
        fitWordmark(header, wordmark);
      }
      refit();
      if (window.ResizeObserver) {
        new ResizeObserver(refit).observe(header);
      } else {
        window.addEventListener("resize", refit);
      }
    });
  }

  function upgradeSearchIcon(wrap) {
    var icon = wrap.querySelector(".mfo-search-icon, .mso-search-icon, .mzo-search-icon");
    if (!icon || icon.tagName.toLowerCase() !== "svg") {
      return;
    }
    var className = icon.getAttribute("class") || "mb-search-icon";
    icon.outerHTML = magnifyingGlassSvg(className);
  }

  function upgradeClearButton(clearBtn) {
    while (clearBtn.firstChild) {
      clearBtn.removeChild(clearBtn.firstChild);
    }

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mb-sf-clear-icon");
    svg.setAttribute("width", "17");
    svg.setAttribute("height", "17");
    svg.setAttribute("viewBox", "0 0 17 17");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");

    var circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "8.5");
    circle.setAttribute("cy", "8.5");
    circle.setAttribute("r", "8.5");
    circle.setAttribute("fill", "currentColor");
    svg.appendChild(circle);

    var path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M6.1 6.1L10.9 10.9M10.9 6.1L6.1 10.9");
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "1.35");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    clearBtn.appendChild(svg);
  }

  function initInlineSearchFields() {
    document.querySelectorAll(".mfo-search-pill, .mso-search, .mzo-search").forEach(function (wrap) {
      upgradeSearchIcon(wrap);

      var input = wrap.querySelector('input[type="search"], input[type="text"]');
      if (!input) {
        return;
      }

      var clearBtn = wrap.querySelector(".mfo-search-clear, .mb-search-clear");
      var skipWiring = clearBtn && clearBtn.id === "mfoSearchClear";

      if (!clearBtn) {
        clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "mb-search-clear";
        clearBtn.setAttribute("aria-label", "Clear search");
        clearBtn.hidden = true;
        wrap.appendChild(clearBtn);
      }

      upgradeClearButton(clearBtn);

      if (skipWiring || clearBtn.dataset.mbSearchWired === "1") {
        return;
      }
      clearBtn.dataset.mbSearchWired = "1";

      input.addEventListener("input", function () {
        clearBtn.hidden = !input.value;
      });

      clearBtn.addEventListener("click", function () {
        input.value = "";
        clearBtn.hidden = true;
        input.focus();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
  }

  function init() {
    initWordmarkFits();
    initInlineSearchFields();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MindBebopNativeParity = {
    init: init,
    fitWordmark: fitWordmark
  };
})();
