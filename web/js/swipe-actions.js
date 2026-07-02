"use strict";

/**
 * Native-style list row swipe actions (leading + trailing).
 * SwiftUI swipeActions specification for MINDBEBOP browser apps.
 */
window.MindBebopSwipeActions = (function () {
  var ACTION_WIDTH = 74;
  var OPEN_THRESHOLD = 36;
  var openRow = null;

  function closeOpenRow() {
    if (openRow) {
      openRow.setOffset(0, false);
      openRow = null;
    }
  }

  function actionButton(action) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mb-swipe-action mb-swipe-action-" + (action.tint || "black");
    btn.setAttribute("aria-label", action.ariaLabel || action.label || "Action");
    if (action.title) {
      btn.title = action.title;
    }
    if (action.iconHtml) {
      btn.innerHTML = action.iconHtml;
    } else if (action.label) {
      btn.textContent = action.label;
    }
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      if (typeof action.onActivate === "function") {
        action.onActivate();
      }
      closeOpenRow();
    });
    return btn;
  }

  function buildActionPanel(actions, edge) {
    var panel = document.createElement("div");
    panel.className = "mb-swipe-actions mb-swipe-actions-" + edge;
    panel.setAttribute("aria-hidden", "true");
    actions.forEach(function (action) {
      panel.appendChild(actionButton(action));
    });
    return panel;
  }

  function attach(rowEl, options) {
    var opts = options || {};
    var leading = opts.leading || [];
    var trailing = opts.trailing || [];
    if (!leading.length && !trailing.length) {
      return null;
    }

    rowEl.classList.add("mb-swipe-row");

    var track = document.createElement("div");
    track.className = "mb-swipe-track";

    var leadingPanel = buildActionPanel(leading, "leading");
    var trailingPanel = buildActionPanel(trailing, "trailing");

    var content = document.createElement("div");
    content.className = "mb-swipe-content";
    while (rowEl.firstChild) {
      content.appendChild(rowEl.firstChild);
    }

    track.appendChild(leadingPanel);
    track.appendChild(trailingPanel);
    track.appendChild(content);
    rowEl.appendChild(track);

    var leadingWidth = leading.length * ACTION_WIDTH;
    var trailingWidth = trailing.length * ACTION_WIDTH;
    var offset = 0;
    var dragging = false;
    var pending = false;
    var activePointerId = null;
    var startX = 0;
    var startOffset = 0;
    var moved = false;
    var suppressClick = false;
    var DRAG_START = 6;

    function clamp(value) {
      return Math.max(-trailingWidth, Math.min(leadingWidth, value));
    }

    function setOffset(value, animate) {
      offset = clamp(value);
      content.style.transition = animate ? "transform 0.22s ease" : "none";
      content.style.transform = "translateX(" + offset + "px)";
      content.style.pointerEvents = offset === 0 ? "" : "none";
      leadingPanel.style.pointerEvents = offset > 0 ? "" : "none";
      trailingPanel.style.pointerEvents = offset < 0 ? "" : "none";
      if (offset > 0) {
        leadingPanel.setAttribute("aria-hidden", "false");
        trailingPanel.setAttribute("aria-hidden", "true");
      } else if (offset < 0) {
        leadingPanel.setAttribute("aria-hidden", "true");
        trailingPanel.setAttribute("aria-hidden", "false");
      } else {
        leadingPanel.setAttribute("aria-hidden", "true");
        trailingPanel.setAttribute("aria-hidden", "true");
      }
    }

    function snapOffset() {
      if (offset >= OPEN_THRESHOLD) {
        setOffset(leadingWidth, true);
        openRow = api;
      } else if (offset <= -OPEN_THRESHOLD) {
        setOffset(-trailingWidth, true);
        openRow = api;
      } else {
        setOffset(0, true);
        if (openRow === api) {
          openRow = null;
        }
      }
    }

    function releaseCapture(pointerId) {
      if (activePointerId === null) {
        return;
      }
      try {
        content.releasePointerCapture(pointerId);
      } catch (_err) {
        /* ignore */
      }
      activePointerId = null;
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      if (openRow && openRow !== api) {
        closeOpenRow();
      }
      event.preventDefault();
      pending = true;
      dragging = false;
      moved = false;
      startX = event.clientX;
      startOffset = offset;
      activePointerId = event.pointerId;
    }

    function onPointerMove(event) {
      if (!pending && !dragging) {
        return;
      }
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }
      var delta = event.clientX - startX;
      if (!dragging && Math.abs(delta) >= DRAG_START) {
        dragging = true;
        pending = false;
        moved = true;
        content.setPointerCapture(event.pointerId);
      }
      if (!dragging) {
        return;
      }
      setOffset(startOffset + delta, false);
    }

    function onPointerUp(event) {
      if (!pending && !dragging) {
        return;
      }
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }
      var didDrag = dragging;
      pending = false;
      dragging = false;
      activePointerId = null;
      if (didDrag) {
        releaseCapture(event.pointerId);
        snapOffset();
        suppressClick = true;
      }
      moved = false;
    }

    content.addEventListener("pointerdown", onPointerDown, { passive: false });
    content.addEventListener("pointermove", onPointerMove);
    content.addEventListener("pointerup", onPointerUp);
    content.addEventListener("pointercancel", onPointerUp);

    content.addEventListener("click", function (event) {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    }, true);

    track.addEventListener("click", function (event) {
      if (offset === 0) {
        return;
      }
      if (event.target.closest(".mb-swipe-action")) {
        return;
      }
      api.close();
      event.preventDefault();
      event.stopPropagation();
    });

    var api = {
      rowEl: rowEl,
      setOffset: setOffset,
      close: function () {
        setOffset(0, true);
        if (openRow === api) {
          openRow = null;
        }
      }
    };

    return api;
  }

  document.addEventListener("pointerdown", function (event) {
    if (!openRow) {
      return;
    }
    if (event.target.closest(".mb-swipe-row") === openRow.rowEl) {
      return;
    }
    closeOpenRow();
  });

  return {
    attach: attach,
    closeAll: closeOpenRow,
    ACTION_WIDTH: ACTION_WIDTH
  };
})();
