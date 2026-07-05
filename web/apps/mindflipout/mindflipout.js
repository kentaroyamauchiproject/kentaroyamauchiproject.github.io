"use strict";

/**
 * MindFlipOut browser experience — ported from native SwiftUI (ContentView, EditEntrySheet,
 * RemixEntrySheet, MindFlipOutSubviews, DisclaimerView, MFOExampleCopy).
 * In-memory only; no persistence.
 */
(function () {
  var EXAMPLE_COPY = {
    example1Heavy: "I always mess things up.",
    example1Light: "I'm learning, even when things don't go perfectly.",
    example2Heavy: "This probably won't help.",
    example2Light: "I'll just try it and see."
  };

  var state = {
    message: "",
    polarity: "heavy",
    entries: [],
    searchText: "",
    showRemix: false,
    didPreloadExample: false,
    shoutedGroups: Object.create(null),
    edit: null,
    remix: null,
    pendingDeleteGroupID: null,
    pendingDeleteSnippet: "",
    pendingSwitchPartnerId: null
  };

  var ui = {};

  function newId() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function trimText(value) {
    return String(value || "").trim();
  }

  function allEntries() {
    return state.entries;
  }

  function findEntry(id) {
    return state.entries.find(function (e) {
      return e.id === id;
    }) || null;
  }

  function entriesInGroup(groupID) {
    return state.entries.filter(function (e) {
      return e.groupID === groupID;
    });
  }

  function deleteGroup(groupID) {
    state.entries = state.entries.filter(function (e) {
      return e.groupID !== groupID;
    });
    delete state.shoutedGroups[groupID];
  }

  function createEntry(text, isPositive, groupID, opts) {
    var now = new Date();
    var options = opts || {};
    return {
      id: newId(),
      text: text,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
      pinned: !!options.pinned,
      isPositive: isPositive,
      groupID: groupID,
      isCleared: false,
      isProvisional: !!options.isProvisional,
      remixParentID: options.remixParentID || null,
      remixCount: options.remixCount || 0
    };
  }

  function insertPair(text, provisional) {
    var now = new Date();
    var group = newId();
    var neg = createEntry(text, false, group, { isProvisional: provisional });
    var pos = createEntry(text, true, group, { isProvisional: provisional });
    neg.createdAt = now;
    neg.updatedAt = now;
    pos.createdAt = now;
    pos.updatedAt = now;
    state.entries.push(neg, pos);
    return { groupID: group, heavy: neg, light: pos };
  }

  function togglePin(groupID, newValue) {
    state.entries.forEach(function (e) {
      if (e.groupID === groupID) {
        e.pinned = newValue;
      }
    });
  }

  function partnerEntry(entry) {
    if (!entry) return null;
    var group = entriesInGroup(entry.groupID);
    var targetPositive = !entry.isPositive;
    var candidates = group.filter(function (e) {
      return e.isPositive === targetPositive;
    });
    return candidates.find(function (e) {
      return !e.remixParentID;
    }) || candidates[0] || null;
  }

  function searchableText(entry) {
    var parts = [entry.text];

    var df = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    parts.push(df.format(entry.createdAt));
    parts.push(df.format(entry.updatedAt));
    parts.push(
      "am", "pm",
      "repeat", "repeating",
      "daily", "hourly",
      "weekly", "minutely"
    );

    if (entry.updatedAt > entry.createdAt) {
      parts.push("edited", "edit", "modified", "updated", "was edited", "has been edited");
    }

    if (entry.remixParentID) {
      parts.push("remix", "remixed", "remix version", "remix entry", "version");
    }

    if (entry.remixCount > 0 && !entry.remixParentID) {
      var count = entry.remixCount;
      parts.push(
        "remix", "remixed", "versions", "remixed versions",
        "remixed " + count + " versions",
        count + " versions",
        "remixed - " + count + " versions",
        "remixed – " + count + " versions",
        "remixed • " + count + " versions",
        "•", "bullet", "has remix", "has remixes", "positive with remix"
      );
    }

    return parts.join(" ").toLowerCase();
  }

  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function sectionDateLabel(date) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "none"
    }).format(date);
  }

  function formatTimestamp(saved, display) {
    var df = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
    var baseDate = (display && display.updatedAt) || saved;
    var baseStr = df.format(baseDate);

    if (display && display.updatedAt > display.createdAt) {
      var editedStr = df.format(display.updatedAt);
      return baseStr + " · Edited " + editedStr;
    }
    if (!display) {
      return baseStr + " · Cleared";
    }
    return baseStr;
  }

  function groupedSections() {
    var buckets = Object.create(null);

    state.entries.forEach(function (e) {
      if (!buckets[e.groupID]) {
        buckets[e.groupID] = { negatives: [], positives: [] };
      }
      if (e.isPositive) {
        buckets[e.groupID].positives.push(e);
      } else {
        buckets[e.groupID].negatives.push(e);
      }
    });

    var query = trimText(state.searchText).toLowerCase();
    var rows = [];
    var isHeavy = state.polarity === "heavy";

    Object.keys(buckets).forEach(function (groupID) {
      var bucket = buckets[groupID];
      var negatives = bucket.negatives.slice().sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });
      var positives = bucket.positives.slice().sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });

      var originalPositive =
        positives.find(function (p) {
          return !p.isCleared && !p.remixParentID;
        }) || positives[0] || null;

      var remixEntries = positives.filter(function (p) {
        return p.remixParentID;
      });
      var remixCount = remixEntries.length;

      var anyNegative =
        negatives.find(function (n) {
          return !n.isCleared;
        }) || negatives[0] || null;

      var pinned =
        negatives.some(function (n) {
          return n.pinned;
        }) ||
        positives.some(function (p) {
          return p.pinned;
        });

      var keyDate;
      if (negatives[0]) {
        keyDate = negatives[0].createdAt;
      } else if (originalPositive) {
        keyDate = originalPositive.createdAt;
      } else {
        keyDate = new Date(0);
      }

      function pushRow(display, partner, isOriginalPositive, isRemix) {
        rows.push({
          id: newId(),
          groupID: groupID,
          display: display,
          partner: partner,
          keyDate: keyDate,
          pinned: pinned,
          remixCount: remixCount,
          isOriginalPositive: isOriginalPositive,
          isRemix: isRemix
        });
      }

      if (isHeavy) {
        var displayNeg = anyNegative;
        if (!displayNeg && !originalPositive && remixCount === 0) {
          return;
        }
        if (!query) {
          pushRow(displayNeg, originalPositive, false, false);
        } else if (displayNeg && searchableText(displayNeg).indexOf(query) >= 0) {
          pushRow(displayNeg, originalPositive, false, false);
        }
      } else if (state.showRemix) {
        var original = positives.find(function (p) {
          return !p.remixParentID;
        }) || null;
        var remixes = positives
          .filter(function (p) {
            return p.remixParentID;
          })
          .sort(function (a, b) {
            return b.createdAt - a.createdAt;
          });

        remixes.forEach(function (remix) {
          if (!query || searchableText(remix).indexOf(query) >= 0) {
            pushRow(remix, anyNegative, false, true);
          }
        });

        if (original && (!query || searchableText(original).indexOf(query) >= 0)) {
          pushRow(original, anyNegative, true, false);
        }
      } else {
        var displayPos = originalPositive;
        if (!displayPos && !anyNegative && remixCount === 0) {
          return;
        }
        if (!query) {
          pushRow(displayPos, anyNegative, true, false);
        } else if (displayPos && searchableText(displayPos).indexOf(query) >= 0) {
          pushRow(displayPos, anyNegative, true, false);
        }
      }
    });

    rows.sort(function (a, b) {
      if (a.pinned !== b.pinned) {
        return a.pinned && !b.pinned ? -1 : 1;
      }
      if (a.keyDate !== b.keyDate) {
        return b.keyDate - a.keyDate;
      }

      if (state.showRemix && state.polarity === "light") {
        if (a.groupID !== b.groupID) {
          return a.groupID > b.groupID ? 1 : -1;
        }
        if (a.isRemix !== b.isRemix) {
          return a.isRemix && !b.isRemix ? -1 : 1;
        }
        if (a.isRemix && b.isRemix) {
          var aDate = (a.display && a.display.createdAt) || a.keyDate;
          var bDate = (b.display && b.display.createdAt) || b.keyDate;
          if (aDate !== bDate) {
            return bDate - aDate;
          }
        }
        var aId = (a.display && a.display.id) || a.id;
        var bId = (b.display && b.display.id) || b.id;
        return aId > bId ? 1 : -1;
      }

      var aDisplayDate = (a.display && a.display.createdAt) || a.keyDate;
      var bDisplayDate = (b.display && b.display.createdAt) || b.keyDate;
      if (aDisplayDate !== bDisplayDate) {
        return bDisplayDate - aDisplayDate;
      }

      var aFinal = (a.display && a.display.id) || a.id;
      var bFinal = (b.display && b.display.id) || b.id;
      return aFinal > bFinal ? 1 : -1;
    });

    var sectionMap = Object.create(null);
    rows.forEach(function (row) {
      var day = startOfDay(row.keyDate).getTime();
      if (!sectionMap[day]) {
        sectionMap[day] = [];
      }
      sectionMap[day].push(row);
    });

    var sections = [];
    var today = startOfDay(new Date()).getTime();
    var yesterday = startOfDay(new Date(Date.now() - 86400000)).getTime();

    if (sectionMap[today]) {
      sections.push({ title: "TODAY", items: sectionMap[today] });
      delete sectionMap[today];
    }
    if (sectionMap[yesterday]) {
      sections.push({ title: "YESTERDAY", items: sectionMap[yesterday] });
      delete sectionMap[yesterday];
    }

    Object.keys(sectionMap)
      .map(Number)
      .sort(function (a, b) {
        return b - a;
      })
      .forEach(function (key) {
        sections.push({
          title: sectionDateLabel(new Date(key)),
          items: sectionMap[key]
        });
      });

    return sections;
  }

  function syncComposer() {
    ui.composerInput.value = state.message;
    var hasText = trimText(state.message).length > 0;
    ui.enterBtn.disabled = !hasText;
    ui.flipBtn.hidden = !hasText;
  }

  function syncPolarityTabs() {
    ui.tabHeavy.classList.toggle("is-active", state.polarity === "heavy");
    ui.tabLight.classList.toggle("is-active", state.polarity === "light");
    ui.showRemixRow.hidden = state.polarity !== "light";
  }

  function renderList() {
    var sections = groupedSections();
    ui.listEl.innerHTML = "";

    if (!sections.length) {
      ui.emptyEl.hidden = false;
      ui.listEl.hidden = true;
      ui.emptyIcon.textContent = trimText(state.searchText) ? "⌕" : "✎";
      ui.emptyText.textContent = trimText(state.searchText) ? "No results" : "No entries yet";
      return;
    }

    ui.emptyEl.hidden = true;
    ui.listEl.hidden = false;

    sections.forEach(function (section) {
      var sectionEl = document.createElement("li");
      sectionEl.className = "mfo-section";
      sectionEl.innerHTML =
        '<h2 class="mfo-section-title">' + escapeHtml(section.title) + "</h2>";

      var rowsEl = document.createElement("ul");
      rowsEl.className = "mfo-section-rows";

      section.items.forEach(function (row) {
        rowsEl.appendChild(renderRow(row));
      });

      sectionEl.appendChild(rowsEl);
      ui.listEl.appendChild(sectionEl);
    });
  }

  function rowActionButtons(row) {
    return "";
  }

  function swipePartnerIcon(src) {
    if (window.MindBebopSwipeActionIcons) {
      return MindBebopSwipeActionIcons.partner(src);
    }
    return '<img src="' + src + '" alt="">';
  }

  function swipePinIcon(pinned) {
    if (window.MindBebopSwipeActionIcons) {
      return MindBebopSwipeActionIcons.pin(pinned);
    }
    return "";
  }

  function swipeTrashIcon() {
    if (window.MindBebopSwipeActionIcons) {
      return MindBebopSwipeActionIcons.trash();
    }
    return "";
  }

  function buildMfoSwipeActions(row) {
    var iconBase = "../../assets/mindshoutout/";
    return {
      leading: [
        {
          ariaLabel: row.pinned ? "Unpin" : "Pin",
          iconHtml: swipePinIcon(row.pinned),
          tint: "black",
          onActivate: function () { handleRowAction(row, "pin"); }
        },
        {
          ariaLabel: "Manual Shout",
          iconHtml: swipePartnerIcon("../../assets/mindzoneout/row-mso.png"),
          tint: "black",
          onActivate: function () { handleRowAction(row, "shout"); }
        },
        {
          ariaLabel: "Manual Zone",
          iconHtml: swipePartnerIcon(iconBase + "row-mzo.png"),
          tint: "black",
          onActivate: function () { handleRowAction(row, "zone"); }
        },
        {
          ariaLabel: "Send to Recipe",
          iconHtml: swipePartnerIcon(iconBase + "row-me.png"),
          tint: "black",
          onActivate: function () { handleRowAction(row, "recipe"); }
        }
      ],
      trailing: [
        {
          ariaLabel: "Delete",
          iconHtml: swipeTrashIcon(),
          tint: "red",
          onActivate: function () { handleRowAction(row, "delete"); }
        },
        {
          ariaLabel: "MindEaseOut",
          iconHtml: swipePartnerIcon(iconBase + "row-meo.png"),
          tint: "gray",
          onActivate: function () { handleRowAction(row, "letgo"); }
        },
        {
          ariaLabel: "Manual MindBackyard",
          iconHtml: swipePartnerIcon(iconBase + "row-mby.png"),
          tint: "black",
          onActivate: function () { handleRowAction(row, "backyard"); }
        }
      ]
    };
  }

  function renderRow(row) {
    var li = document.createElement("li");
    li.className = "mfo-list-item";
    var entry = row.display;
    var dotClass = entry && entry.isPositive ? "light" : "heavy";
    var textClass = "";
    var textContent = " ";

    if (entry) {
      textContent = entry.text || " ";
      if (entry.isPositive) {
        textClass = row.isOriginalPositive ? "" : "mfo-item-text-remix";
      }
    }

    var remixCaption = "";
    if (
      !state.showRemix &&
      row.remixCount > 0 &&
      entry &&
      entry.isPositive &&
      row.isOriginalPositive
    ) {
      remixCaption =
        '<p class="mfo-remix-caption"><span>Remixed</span><span class="mfo-remix-dot">·</span><span>' +
        row.remixCount + " version" + (row.remixCount === 1 ? "" : "s") +
        "</span></p>";
    }

    li.innerHTML =
      '<button type="button" class="mfo-row-tap" data-entry-id="' + escapeHtml(entry ? entry.id : "") + '">' +
        '<div class="mfo-item-main">' +
          '<span class="mfo-item-dot ' + dotClass + '" aria-hidden="true"' + (entry ? "" : ' style="opacity:0.3"') + "></span>" +
          '<p class="mfo-item-text ' + textClass + '">' + escapeHtml(textContent) + "</p>" +
          (row.pinned ? '<span class="mfo-pin" aria-label="Pinned">📌</span>' : "") +
        "</div>" +
        remixCaption +
        '<p class="mfo-item-time">' + escapeHtml(formatTimestamp(row.keyDate, entry)) + "</p>" +
      "</button>" +
      rowActionButtons(row);

    li.querySelector(".mfo-row-tap").addEventListener("click", function () {
      if (entry) {
        openEditSheet(entry.id, false);
      }
    });

    if (window.MindBebopSwipeActions) {
      MindBebopSwipeActions.attach(li, buildMfoSwipeActions(row));
    }

    return li;
  }

  function showBoundary(appName, body) {
    var boundary = window.MindBebopBoundary;
    if (!boundary || !boundary.noticeHTML) {
      return;
    }
    ui.boundaryBody.innerHTML = boundary.noticeHTML({
      appName: appName,
      body: body || "This step continues in the native iPhone app.",
      wrapperClass: "mb-boundary-notice mb-boundary-notice-dialog"
    });
    if (typeof ui.boundaryDialog.showModal === "function") {
      ui.boundaryDialog.showModal();
    }
  }

  function handleRowAction(row, action) {
    var entry = row.display;
    if (!entry && action !== "delete") {
      return;
    }

    switch (action) {
      case "pin":
        togglePin(row.groupID, !row.pinned);
        renderList();
        break;
      case "delete":
        state.pendingDeleteGroupID = row.groupID;
        state.pendingDeleteSnippet = entry ? entry.text : "";
        ui.deleteSnippet.textContent = state.pendingDeleteSnippet.slice(0, 60);
        ui.deleteDialog.showModal();
        break;
      case "shout":
        state.shoutedGroups[row.groupID] = true;
        showBoundary("MindShoutOut", "Manual Shout schedules a reminder in MindShoutOut on iPhone.");
        break;
      case "zone":
        showBoundary("MindZoneOut", "Manual Zone sends this thought to MindZoneOut on iPhone.");
        break;
      case "recipe":
        showBoundary("MindEntry", "Send to Recipe opens MindEntry on iPhone with this entry.");
        break;
      case "letgo":
        showBoundary("MindEaseOut", "Let Go opens the MindEaseOut overlay on iPhone to release this thought.");
        break;
      case "backyard":
        showBoundary("MindBackyard", "MindBackyard fade thoughts continue on iPhone.");
        break;
      default:
        break;
    }
  }

  function submitTapped() {
    var text = trimText(state.message);
    if (!text) {
      return;
    }
    insertPair(text, false);
    state.message = "";
    syncComposer();
    renderList();
  }

  function submitAndFlipTapped() {
    var text = trimText(state.message);
    if (!text) {
      return;
    }
    var pair = insertPair(text, true);
    state.message = "";
    syncComposer();
    renderList();
    openEditSheet(pair.light.id, true);
  }

  function openEditSheet(entryId, cameFromFlip) {
    var entry = findEntry(entryId);
    if (!entry) {
      return;
    }
    state.edit = {
      entryId: entryId,
      cameFromFlip: !!cameFromFlip,
      didSave: false,
      isOpeningRemix: false
    };

    var partner = partnerEntry(entry);
    var headerLabel = entry.isPositive
      ? (entry.remixParentID ? "Remix" : "Light")
      : "Heavy";

    ui.editHeaderDot.className = "mfo-edit-dot " + (entry.isPositive ? "light" : "heavy");
    ui.editHeaderLabel.textContent = headerLabel;
    ui.editHeaderLabel.className = "mfo-edit-label " + (entry.isPositive ? "light" : "heavy");
    ui.editInput.value = entry.text;

    var showGuidance =
      entry.isPositive &&
      !entry.remixParentID &&
      entry.updatedAt.getTime() === entry.createdAt.getTime();
    ui.editFlipGuidance.hidden = !showGuidance;

    var showRemixBtn = entry.isPositive;
    ui.editRemixBtn.hidden = !showRemixBtn;

    if (partner) {
      ui.editSwitchBtn.hidden = false;
      ui.editSwitchBtn.textContent = entry.isPositive ? "→ Heavy" : "→ Light";
      ui.editSwitchBtn.className = "mfo-edit-switch " + (entry.isPositive ? "heavy" : "light");
    } else {
      ui.editSwitchBtn.hidden = true;
    }

    ui.editSaveBtn.disabled = !trimText(entry.text);
    ui.editDialog.showModal();
    requestAnimationFrame(function () {
      ui.editInput.focus();
      if (cameFromFlip) {
        var len = ui.editInput.value.length;
        if (len > 0) {
          ui.editInput.setSelectionRange(0, len);
        }
      }
    });
  }

  function performEditSave() {
    if (!state.edit) {
      return false;
    }
    var entry = findEntry(state.edit.entryId);
    if (!entry) {
      return false;
    }

    var trimmed = trimText(ui.editInput.value);
    if (!trimmed) {
      return false;
    }

    var didChangeText = trimmed !== entry.text;
    entry.text = trimmed;
    if (didChangeText) {
      entry.updatedAt = new Date();
    }

    if (entry.isProvisional) {
      entriesInGroup(entry.groupID).forEach(function (e) {
        e.isProvisional = false;
      });
    }

    state.edit.didSave = true;
    return true;
  }

  function closeEditSheet(discardProvisional) {
    if (!state.edit) {
      return;
    }

    if (
      discardProvisional &&
      !state.edit.didSave &&
      !state.edit.isOpeningRemix
    ) {
      var entry = findEntry(state.edit.entryId);
      if (entry && entry.isProvisional) {
        deleteGroup(entry.groupID);
      }
    }

    state.edit = null;
    ui.editDialog.close();
    renderList();
  }

  function saveEditSheet() {
    if (!performEditSave()) {
      return;
    }
    closeEditSheet(false);
  }

  function cancelEditSheet() {
    closeEditSheet(true);
  }

  function switchEditPartner() {
    if (!state.edit) {
      return;
    }
    var entry = findEntry(state.edit.entryId);
    if (!entry) {
      return;
    }
    var partner = partnerEntry(entry);
    if (!partner) {
      return;
    }

    var trimmed = trimText(ui.editInput.value);
    var hasUnsaved = trimmed !== entry.text;

    if (hasUnsaved) {
      state.pendingSwitchPartnerId = partner.id;
      ui.switchDialog.showModal();
      return;
    }

    state.edit.didSave = false;
    ui.editDialog.close();
    openEditSheet(partner.id, false);
  }

  function openRemixSheet() {
    if (!state.edit) {
      return;
    }
    var entry = findEntry(state.edit.entryId);
    if (!entry || !entry.isPositive) {
      return;
    }

    state.edit.isOpeningRemix = true;
    state.remix = {
      sourceEntryID: entry.id,
      groupID: entry.groupID,
      pinned: entry.pinned,
      parentRemixParentID: entry.remixParentID || entry.groupID,
      parentRemixCount: entry.remixCount,
      seedText: entry.text
    };

    ui.remixInput.value = state.remix.seedText;
    ui.remixSaveBtn.disabled = !trimText(state.remix.seedText);
    ui.editDialog.close();
    state.edit = null;
    ui.remixDialog.showModal();
    requestAnimationFrame(function () {
      ui.remixInput.focus();
    });
  }

  function saveRemixSheet() {
    if (!state.remix) {
      return;
    }
    var newText = trimText(ui.remixInput.value);
    if (!newText) {
      return;
    }

    var source = findEntry(state.remix.sourceEntryID);
    if (!source) {
      ui.remixDialog.close();
      state.remix = null;
      return;
    }

    var preserved = source.text;
    var now = new Date();
    var remix = createEntry(newText, true, state.remix.groupID, {
      pinned: state.remix.pinned,
      remixParentID: state.remix.parentRemixParentID,
      remixCount: state.remix.parentRemixCount + 1
    });
    remix.createdAt = now;
    remix.updatedAt = now;
    state.entries.push(remix);
    source.remixCount = (source.remixCount || 0) + 1;

    if (source.text !== preserved) {
      source.text = preserved;
    }

    ui.remixDialog.close();
    state.remix = null;
    renderList();
  }

  function preloadExamples() {
    if (state.didPreloadExample) {
      return;
    }
    var now = new Date();
    var pair1 = insertPair(EXAMPLE_COPY.example1Heavy, false);
    pair1.heavy.text = EXAMPLE_COPY.example1Heavy;
    pair1.light.text = EXAMPLE_COPY.example1Light;
    pair1.heavy.createdAt = now;
    pair1.heavy.updatedAt = now;
    pair1.light.createdAt = now;
    pair1.light.updatedAt = now;

    var pair2 = insertPair(EXAMPLE_COPY.example2Heavy, false);
    pair2.heavy.text = EXAMPLE_COPY.example2Heavy;
    pair2.light.text = EXAMPLE_COPY.example2Light;
    pair2.heavy.createdAt = now;
    pair2.heavy.updatedAt = now;
    pair2.light.createdAt = now;
    pair2.light.updatedAt = now;

    state.didPreloadExample = true;
  }

  function bindEvents() {
    ui.composerInput.addEventListener("input", function () {
      state.message = ui.composerInput.value;
      syncComposer();
    });

    ui.composerInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        return;
      }
    });

    ui.tabHeavy.addEventListener("click", function () {
      state.polarity = "heavy";
      syncPolarityTabs();
      renderList();
    });

    ui.tabLight.addEventListener("click", function () {
      state.polarity = "light";
      syncPolarityTabs();
      renderList();
    });

    ui.showRemixToggle.addEventListener("click", function () {
      state.showRemix = !state.showRemix;
      ui.showRemixToggle.setAttribute("aria-checked", state.showRemix ? "true" : "false");
      renderList();
    });

    ui.searchInput.addEventListener("input", function () {
      state.searchText = ui.searchInput.value;
      ui.searchClearBtn.hidden = !state.searchText;
      renderList();
    });

    ui.searchClearBtn.addEventListener("click", function () {
      state.searchText = "";
      ui.searchInput.value = "";
      ui.searchClearBtn.hidden = true;
      ui.searchInput.focus();
      renderList();
    });

    ui.editInput.addEventListener("input", function () {
      ui.editSaveBtn.disabled = !trimText(ui.editInput.value);
    });

    ui.remixInput.addEventListener("input", function () {
      ui.remixSaveBtn.disabled = !trimText(ui.remixInput.value);
    });

    ui.flipBtn.addEventListener("click", submitAndFlipTapped);
    ui.enterBtn.addEventListener("click", submitTapped);

    ui.editCancelBtn.addEventListener("click", cancelEditSheet);
    ui.editSaveBtn.addEventListener("click", saveEditSheet);
    ui.editSwitchBtn.addEventListener("click", switchEditPartner);
    ui.editRemixBtn.addEventListener("click", openRemixSheet);

    ui.editDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      cancelEditSheet();
    });

    ui.remixCancelBtn.addEventListener("click", function () {
      ui.remixDialog.close();
      state.remix = null;
      renderList();
    });
    ui.remixSaveBtn.addEventListener("click", saveRemixSheet);

    ui.deleteCancelBtn.addEventListener("click", function () {
      state.pendingDeleteGroupID = null;
      ui.deleteDialog.close();
    });
    ui.deleteConfirmBtn.addEventListener("click", function () {
      if (state.pendingDeleteGroupID) {
        deleteGroup(state.pendingDeleteGroupID);
      }
      state.pendingDeleteGroupID = null;
      ui.deleteDialog.close();
      renderList();
    });

    ui.switchSaveBtn.addEventListener("click", function () {
      if (!state.edit || !state.pendingSwitchPartnerId) {
        ui.switchDialog.close();
        return;
      }
      if (performEditSave()) {
        var partnerId = state.pendingSwitchPartnerId;
        state.pendingSwitchPartnerId = null;
        ui.switchDialog.close();
        ui.editDialog.close();
        openEditSheet(partnerId, false);
      }
    });

    ui.switchDiscardBtn.addEventListener("click", function () {
      if (!state.edit || !state.pendingSwitchPartnerId) {
        ui.switchDialog.close();
        return;
      }
      var partnerId = state.pendingSwitchPartnerId;
      state.pendingSwitchPartnerId = null;
      state.edit.didSave = true;
      ui.switchDialog.close();
      ui.editDialog.close();
      openEditSheet(partnerId, false);
    });

    ui.switchCancelBtn.addEventListener("click", function () {
      state.pendingSwitchPartnerId = null;
      ui.switchDialog.close();
    });

    ui.boundaryCloseBtn.addEventListener("click", function () {
      ui.boundaryDialog.close();
    });
  }

  function cacheDom() {
    ui.mainApp = document.getElementById("mfoMainApp");
    ui.tabHeavy = document.getElementById("tabHeavy");
    ui.tabLight = document.getElementById("tabLight");
    ui.composerInput = document.getElementById("composerInput");
    ui.flipBtn = document.getElementById("flipBtn");
    ui.enterBtn = document.getElementById("enterBtn");
    ui.searchInput = document.getElementById("mfoSearchInput");
    ui.searchClearBtn = document.getElementById("mfoSearchClear");
    ui.showRemixRow = document.getElementById("mfoShowRemixRow");
    ui.showRemixToggle = document.getElementById("mfoShowRemixToggle");
    ui.listEl = document.getElementById("mfoList");
    ui.emptyEl = document.getElementById("mfoEmptyState");
    ui.emptyIcon = document.getElementById("mfoEmptyIcon");
    ui.emptyText = document.getElementById("mfoEmptyText");

    ui.editDialog = document.getElementById("mfoEditDialog");
    ui.editHeaderDot = document.getElementById("mfoEditHeaderDot");
    ui.editHeaderLabel = document.getElementById("mfoEditHeaderLabel");
    ui.editFlipGuidance = document.getElementById("mfoEditFlipGuidance");
    ui.editInput = document.getElementById("mfoEditInput");
    ui.editSwitchBtn = document.getElementById("mfoEditSwitchBtn");
    ui.editRemixBtn = document.getElementById("mfoEditRemixBtn");
    ui.editCancelBtn = document.getElementById("mfoEditCancelBtn");
    ui.editSaveBtn = document.getElementById("mfoEditSaveBtn");

    ui.remixDialog = document.getElementById("mfoRemixDialog");
    ui.remixInput = document.getElementById("mfoRemixInput");
    ui.remixCancelBtn = document.getElementById("mfoRemixCancelBtn");
    ui.remixSaveBtn = document.getElementById("mfoRemixSaveBtn");

    ui.deleteDialog = document.getElementById("mfoDeleteDialog");
    ui.deleteSnippet = document.getElementById("mfoDeleteSnippet");
    ui.deleteCancelBtn = document.getElementById("mfoDeleteCancelBtn");
    ui.deleteConfirmBtn = document.getElementById("mfoDeleteConfirmBtn");

    ui.switchDialog = document.getElementById("mfoSwitchDialog");
    ui.switchSaveBtn = document.getElementById("mfoSwitchSaveBtn");
    ui.switchDiscardBtn = document.getElementById("mfoSwitchDiscardBtn");
    ui.switchCancelBtn = document.getElementById("mfoSwitchCancelBtn");

    ui.boundaryDialog = document.getElementById("mfoBoundaryDialog");
    ui.boundaryBody = document.getElementById("mfoBoundaryBody");
    ui.boundaryCloseBtn = document.getElementById("mfoBoundaryCloseBtn");
  }

  function init() {
    cacheDom();
    bindEvents();
    preloadExamples();
    syncPolarityTabs();
    syncComposer();
    renderList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
