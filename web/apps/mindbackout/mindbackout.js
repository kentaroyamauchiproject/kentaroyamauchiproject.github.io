"use strict";

(function () {
  var MODES = { standard: "standard", commitment: "commitment", firstMove: "firstMove" };
  var DEFAULT_MINUTES = 5;
  var SHORTEST_TIMED_MINUTES = 5;
  var selectionCatalog = [
    "Mail", "Messages", "Safari", "YouTube", "Instagram", "X", "Reddit", "Games", "Shopping"
  ];

  var state = {
    mode: MODES.standard,
    backroomMinutes: DEFAULT_MINUTES,
    selection: new Set(),
    whyImHereDraft: "",
    zoneCooldownEnabled: false,
    presets: [],
    activePresetId: null,
    sessionActive: false,
    activeMode: MODES.standard,
    activeWhy: null,
    waitingFirstMoveCompletion: false,
    accessEndsAt: null,
    showBackroomControls: false,
    passageOpen: false,
    pendingPreviewStart: false,
    now: new Date()
  };

  var ticker = null;
  var ui = {
    modeSegmentButtons: Array.from(document.querySelectorAll("[data-mode]")),
    durationButtons: Array.from(document.querySelectorAll("[data-minutes]")),
    whyInput: document.getElementById("whyInput"),
    durationBlock: document.getElementById("durationBlock"),
    firstMoveHint: document.getElementById("firstMoveHint"),
    selectionBtn: document.getElementById("selectionBtn"),
    selectionSummary: document.getElementById("selectionSummary"),
    zoneCooldownToggle: document.getElementById("zoneCooldownToggle"),
    presetRow: document.getElementById("presetRow"),
    activeCard: document.getElementById("activeCard"),
    activeTitle: document.getElementById("activeTitle"),
    activeReasonLabel: document.getElementById("activeReasonLabel"),
    activeReasonText: document.getElementById("activeReasonText"),
    activeHint: document.getElementById("activeHint"),
    resumeBtn: document.getElementById("resumeBtn"),
    unlockBtn: document.getElementById("unlockBtn"),
    enterBtn: document.getElementById("enterBtn"),
    selectionDialog: document.getElementById("selectionDialog"),
    selectionContinuation: document.getElementById("mboSelectionContinuation"),
    selectionList: document.getElementById("selectionList"),
    selectionDoneBtn: document.getElementById("selectionDoneBtn"),
    commitmentDialog: document.getElementById("commitmentDialog"),
    commitmentStayBtn: document.getElementById("commitmentStayBtn"),
    commitmentEnterBtn: document.getElementById("commitmentEnterBtn"),
    selectionGateDialog: document.getElementById("selectionGateDialog"),
    selectionGateCloseBtn: document.getElementById("selectionGateCloseBtn"),
    standardExitDialog: document.getElementById("standardExitDialog"),
    standardExitTitle: document.getElementById("standardExitTitle"),
    standardExitMessage: document.getElementById("standardExitMessage"),
    standardExitStayBtn: document.getElementById("standardExitStayBtn"),
    standardExitLeaveBtn: document.getElementById("standardExitLeaveBtn"),
    passageScreen: document.getElementById("passageScreen"),
    passageResidueInput: document.getElementById("passageResidueInput"),
    passageReleaseBtn: document.getElementById("passageReleaseBtn"),
    passageEnterBtn: document.getElementById("passageEnterBtn"),
    passageExitBtn: document.getElementById("passageExitBtn"),
    lockBoundaryDialog: document.getElementById("lockBoundaryDialog"),
    lockBoundaryBody: document.getElementById("lockBoundaryBody"),
    lockBoundaryCancelBtn: document.getElementById("lockBoundaryCancelBtn"),
    lockBoundaryContinueBtn: document.getElementById("lockBoundaryContinueBtn"),
    partnerBoundaryDialog: document.getElementById("partnerBoundaryDialog"),
    partnerBoundaryBody: document.getElementById("partnerBoundaryBody"),
    partnerBoundaryCloseBtn: document.getElementById("partnerBoundaryCloseBtn"),
    backroomScreen: document.getElementById("backroomScreen"),
    backroomTop: document.getElementById("backroomTop"),
    modeActiveTitle: document.getElementById("modeActiveTitle"),
    unlockConditionChip: document.getElementById("unlockConditionChip"),
    countdownChip: document.getElementById("countdownChip"),
    firstMoveCompleteBtn: document.getElementById("firstMoveCompleteBtn"),
    exitBtn: document.getElementById("exitBtn")
  };

  function init() {
    if (window.MindBebopContinuation && ui.selectionContinuation) {
      ui.selectionContinuation.innerHTML = MindBebopContinuation.cardHTML("MindBackOut");
    }
    buildSelectionDialog();
    bindEvents();
    render();
  }

  function bindEvents() {
    ui.modeSegmentButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        state.mode = button.dataset.mode || MODES.standard;
        if (state.mode === MODES.commitment && state.backroomMinutes <= 0) {
          state.backroomMinutes = SHORTEST_TIMED_MINUTES;
        }
        deactivatePreset();
        render();
      });
    });

    ui.durationButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        state.backroomMinutes = Number(button.dataset.minutes || "0");
        deactivatePreset();
        render();
      });
    });

    ui.whyInput.addEventListener("input", function () {
      state.whyImHereDraft = ui.whyInput.value;
    });

    ui.zoneCooldownToggle.addEventListener("change", function () {
      state.zoneCooldownEnabled = ui.zoneCooldownToggle.checked;
      deactivatePreset();
    });

    ui.selectionBtn.addEventListener("click", function () {
      syncSelectionDialogChecks();
      ui.selectionDialog.showModal();
    });
    ui.selectionDoneBtn.addEventListener("click", function () {
      ui.selectionDialog.close();
      renderSelectionSummary();
      deactivatePreset();
    });

    ui.enterBtn.addEventListener("click", function () {
      if (!state.selection.size) {
        ui.selectionGateDialog.showModal();
        return;
      }
      if (state.mode === MODES.commitment) {
        ui.commitmentDialog.showModal();
        return;
      }
      beginBackroomSession();
    });
    ui.commitmentStayBtn.addEventListener("click", function () {
      ui.commitmentDialog.close();
    });
    ui.commitmentEnterBtn.addEventListener("click", function () {
      ui.commitmentDialog.close();
      beginBackroomSession();
    });
    ui.selectionGateCloseBtn.addEventListener("click", function () {
      ui.selectionGateDialog.close();
    });

    ui.resumeBtn.addEventListener("click", function () {
      if (state.waitingFirstMoveCompletion) {
        showPartnerBoundary(
          "MindEntry",
          "First Move unlock requires MindEntry on iPhone. This browser can show the Backroom flow, but it cannot receive the native unlock callback.",
          "Continue with MindEntry"
        );
        return;
      }
      openBackroomScene();
    });

    ui.unlockBtn.addEventListener("click", function () {
      maybeConfirmStandardExit();
    });
    ui.standardExitStayBtn.addEventListener("click", function () {
      ui.standardExitDialog.close();
    });
    ui.standardExitLeaveBtn.addEventListener("click", function () {
      ui.standardExitDialog.close();
      endBackroomSession(true);
    });

    ui.passageResidueInput.addEventListener("input", function () {
      ui.passageReleaseBtn.disabled = !trimText(ui.passageResidueInput.value);
    });
    ui.passageReleaseBtn.addEventListener("click", function () {
      showPartnerBoundary(
        "MindEaseOut",
        "If a thought still feels active, release it in MindEaseOut on iPhone before stepping fully inside."
      );
    });
    ui.passageEnterBtn.addEventListener("click", function () {
      showLockBoundaryAndMaybeStartPreview();
    });
    ui.passageExitBtn.addEventListener("click", function () {
      closePassage();
    });

    ui.lockBoundaryCancelBtn.addEventListener("click", function () {
      state.pendingPreviewStart = false;
      ui.lockBoundaryDialog.close();
    });
    ui.lockBoundaryContinueBtn.addEventListener("click", function () {
      ui.lockBoundaryDialog.close();
      if (state.pendingPreviewStart) {
        state.pendingPreviewStart = false;
        openBackroomScene();
      }
    });

    ui.partnerBoundaryCloseBtn.addEventListener("click", function () {
      ui.partnerBoundaryDialog.close();
    });

    ui.backroomScreen.addEventListener("click", function (event) {
      if (
        event.target === ui.exitBtn ||
        event.target === ui.firstMoveCompleteBtn
      ) {
        return;
      }
      state.showBackroomControls = !state.showBackroomControls;
      renderBackroom();
    });
    ui.exitBtn.addEventListener("click", function () {
      maybeConfirmStandardExit();
    });
    ui.firstMoveCompleteBtn.addEventListener("click", function () {
      showPartnerBoundary(
        "MindEntry",
        "First Move unlock requires MindEntry on iPhone. This browser can show the Backroom flow, but it cannot receive the native unlock callback.",
        "Continue with MindEntry"
      );
    });
  }

  function beginBackroomSession() {
    state.sessionActive = true;
    state.activeMode = state.mode;
    state.activeWhy = normalizedWhy(state.whyImHereDraft);
    state.waitingFirstMoveCompletion = state.activeMode === MODES.firstMove;
    state.accessEndsAt = null;
    state.showBackroomControls = false;

    if (state.activeMode !== MODES.firstMove && state.backroomMinutes > 0) {
      state.accessEndsAt = Date.now() + state.backroomMinutes * 60000;
    }

    state.passageOpen = true;
    openPassage();
    startTicker();
    render();
  }

  function endBackroomSession(launchZoneCooldownPrompt) {
    state.sessionActive = false;
    state.activeMode = MODES.standard;
    state.activeWhy = null;
    state.waitingFirstMoveCompletion = false;
    state.accessEndsAt = null;
    state.showBackroomControls = false;
    closeBackroomScene();
    closePassage();
    stopTicker();
    if (launchZoneCooldownPrompt && state.zoneCooldownEnabled) {
      showPartnerBoundary(
        "MindZoneOut",
        "Zone Cooldown continues in MindZoneOut on iPhone (None mode)."
      );
    }
    render();
  }

  function maybeConfirmStandardExit() {
    if (!state.sessionActive || state.activeMode !== MODES.standard) {
      return;
    }
    var reason = normalizedWhy(state.activeWhy);
    if (reason) {
      ui.standardExitTitle.textContent = "";
      ui.standardExitMessage.textContent = temptationExitMessage(reason, state.accessEndsAt);
    } else {
      ui.standardExitTitle.textContent = "Leave Backroom?";
      ui.standardExitMessage.textContent = "Your selected apps will become available again.";
    }
    ui.standardExitDialog.showModal();
  }

  function temptationExitMessage(reason, accessEndsAt) {
    var lines = ["You created this boundary because:", reason];
    var remaining = remainingMinutesText(accessEndsAt);
    if (remaining) {
      lines.push(remaining);
    }
    return lines.join("\n\n");
  }

  function remainingMinutesText(accessEndsAt) {
    if (!accessEndsAt) return "";
    var ms = accessEndsAt - Date.now();
    if (ms <= 0) return "";
    var minutes = Math.max(1, Math.ceil(ms / 60000));
    return minutes + " minute(s) remaining";
  }

  function openPassage() {
    ui.passageScreen.hidden = false;
    document.body.classList.add("mbo-backroom-open");
    ui.passageResidueInput.value = "";
    ui.passageReleaseBtn.disabled = true;
  }

  function closePassage() {
    state.passageOpen = false;
    ui.passageScreen.hidden = true;
    if (ui.backroomScreen.hidden) {
      document.body.classList.remove("mbo-backroom-open");
    }
  }

  function showLockBoundaryAndMaybeStartPreview() {
    var boundary = window.MindBebopBoundary;
    if (!boundary || !boundary.noticeHTML) {
      openBackroomScene();
      return;
    }
    var body = state.activeMode === MODES.firstMove
      ? "Real app locking and First Move handoff to MindEntry begin here on iPhone. Browser preview can continue without enforcing locks."
      : "Real app locking begins here in the iPhone app. Browser preview can continue without enforcing locks.";
    ui.lockBoundaryBody.innerHTML = boundary.noticeHTML({
      appName: "MindBackOut",
      title: "Available on iPhone",
      body: body,
      wrapperClass: "mb-boundary-notice mb-boundary-notice-dialog"
    });
    state.pendingPreviewStart = true;
    ui.lockBoundaryDialog.showModal();
  }

  function showPartnerBoundary(appName, body, actionLabel) {
    var boundary = window.MindBebopBoundary;
    if (!boundary || !boundary.noticeHTML) return;
    ui.partnerBoundaryBody.innerHTML = boundary.noticeHTML({
      appName: appName,
      body: body,
      wrapperClass: "mb-boundary-notice mb-boundary-notice-dialog"
    });
    ui.partnerBoundaryCloseBtn.textContent = actionLabel || "Close";
    ui.partnerBoundaryDialog.showModal();
  }

  function openBackroomScene() {
    closePassage();
    ui.backroomScreen.hidden = false;
    document.body.classList.add("mbo-backroom-open");
    state.showBackroomControls = true;
    renderBackroom();
  }

  function closeBackroomScene() {
    ui.backroomScreen.hidden = true;
    document.body.classList.remove("mbo-backroom-open");
  }

  function startTicker() {
    stopTicker();
    ticker = window.setInterval(function () {
      state.now = new Date();
      if (state.sessionActive && state.accessEndsAt && Date.now() >= state.accessEndsAt) {
        endBackroomSession(true);
        return;
      }
      renderActiveCard();
      if (!ui.backroomScreen.hidden) {
        renderBackroom();
      }
    }, 1000);
  }

  function stopTicker() {
    if (!ticker) return;
    clearInterval(ticker);
    ticker = null;
  }

  function buildSelectionDialog() {
    ui.selectionList.innerHTML = selectionCatalog.map(function (name) {
      return (
        '<label class="mbo-check-row">' +
          '<input type="checkbox" data-selection="' + escapeHTML(name) + '">' +
          "<span>" + escapeHTML(name) + "</span>" +
        "</label>"
      );
    }).join("");
    Array.from(ui.selectionList.querySelectorAll("[data-selection]")).forEach(function (input) {
      input.addEventListener("change", function () {
        var value = input.dataset.selection || "";
        if (!value) return;
        if (input.checked) state.selection.add(value);
        else state.selection.delete(value);
        renderSelectionSummary();
      });
    });
  }

  function syncSelectionDialogChecks() {
    Array.from(ui.selectionList.querySelectorAll("[data-selection]")).forEach(function (input) {
      var value = input.dataset.selection || "";
      input.checked = state.selection.has(value);
    });
  }

  function render() {
    renderModeButtons();
    renderDuration();
    renderSelectionSummary();
    renderPresets();
    renderActiveCard();
    renderBackroom();
    ui.zoneCooldownToggle.checked = state.zoneCooldownEnabled;
  }

  function renderModeButtons() {
    ui.modeSegmentButtons.forEach(function (button) {
      var selected = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function renderDuration() {
    var firstMove = state.mode === MODES.firstMove;
    ui.durationBlock.classList.toggle("is-disabled", firstMove);
    ui.firstMoveHint.hidden = !firstMove;

    ui.durationButtons.forEach(function (button) {
      var minutes = Number(button.dataset.minutes || "0");
      var selected = minutes === state.backroomMinutes && !firstMove;
      var disallowed = firstMove || (state.mode === MODES.commitment && minutes === 0);
      button.disabled = disallowed;
      button.classList.toggle("is-active", selected);
    });
  }

  function renderSelectionSummary() {
    var selected = Array.from(state.selection);
    if (!selected.length) {
      ui.selectionSummary.textContent = "No selection";
      return;
    }
    ui.selectionSummary.textContent = selected.slice(0, 4).join(", ") +
      (selected.length > 4 ? " +" + (selected.length - 4) : "");
  }

  function canSavePreset() {
    return state.selection.size > 0 && state.backroomMinutes > 0;
  }

  function renderPresets() {
    if (!ui.presetRow) return;
    var html = state.presets.map(function (preset) {
      var selected = preset.id === state.activePresetId;
      return (
        '<button type="button" class="mbo-chip-btn mbo-preset-chip' + (selected ? " is-active" : "") + '" data-preset-id="' + escapeHTML(preset.id) + '">' +
          "<span>" + escapeHTML(preset.name) + "</span>" +
        "</button>" +
        '<button type="button" class="mbo-preset-delete" data-preset-delete="' + escapeHTML(preset.id) + '" aria-label="Delete preset">×</button>'
      );
    }).join("");
    html += '<button type="button" class="mbo-chip-btn mbo-preset-save" data-preset-save="1"' + (canSavePreset() ? "" : " disabled") + '>+ Save</button>';
    ui.presetRow.innerHTML = html;

    Array.from(ui.presetRow.querySelectorAll("[data-preset-id]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.dataset.presetId || "";
        togglePreset(id);
      });
    });
    Array.from(ui.presetRow.querySelectorAll("[data-preset-delete]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.dataset.presetDelete || "";
        deletePreset(id);
      });
    });
    var saveBtn = ui.presetRow.querySelector("[data-preset-save]");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (!canSavePreset()) return;
        var name = window.prompt("Preset name");
        if (!name) return;
        savePreset(name);
      });
    }
  }

  function togglePreset(id) {
    if (state.activePresetId === id) {
      deactivatePreset();
      return;
    }
    var preset = state.presets.find(function (item) { return item.id === id; });
    if (!preset) return;
    state.activePresetId = preset.id;
    state.mode = preset.mode;
    state.backroomMinutes = preset.minutes;
    state.zoneCooldownEnabled = !!preset.zoneCooldownEnabled;
    state.selection = new Set(preset.selection);
    syncSelectionDialogChecks();
    render();
  }

  function savePreset(name) {
    var trimmed = trimText(name);
    if (!trimmed) return;
    if (state.presets.some(function (item) { return item.name.toLowerCase() === trimmed.toLowerCase(); })) {
      return;
    }
    var preset = {
      id: newId(),
      name: trimmed,
      mode: state.mode,
      minutes: state.backroomMinutes,
      zoneCooldownEnabled: state.zoneCooldownEnabled,
      selection: Array.from(state.selection)
    };
    state.presets.push(preset);
    state.activePresetId = preset.id;
    render();
  }

  function deletePreset(id) {
    state.presets = state.presets.filter(function (item) { return item.id !== id; });
    if (state.activePresetId === id) {
      state.activePresetId = null;
    }
    render();
  }

  function deactivatePreset() {
    state.activePresetId = null;
  }

  function renderActiveCard() {
    ui.activeCard.hidden = !state.sessionActive;
    ui.enterBtn.hidden = state.sessionActive;
    if (!state.sessionActive) return;

    if (state.activeMode === MODES.standard) {
      ui.activeTitle.textContent = "Protection Active";
      ui.activeHint.textContent = state.accessEndsAt
        ? "Ends at the selected time"
        : "You can jump back in or unlock apps now.";
      ui.unlockBtn.hidden = false;
    } else if (state.activeMode === MODES.commitment) {
      ui.activeTitle.textContent = "Protection Active";
      ui.activeHint.textContent = "This Commitment Backroom unlocks when the selected duration ends.";
      ui.unlockBtn.hidden = true;
    } else {
      ui.activeTitle.textContent = "Protection Active";
      ui.activeHint.textContent = "Complete The First Move Recipe in MindEntry to unlock your apps.";
      ui.unlockBtn.hidden = true;
    }

    var showWhy = !!normalizedWhy(state.activeWhy);
    ui.activeReasonLabel.hidden = !showWhy;
    ui.activeReasonText.hidden = !showWhy;
    ui.activeReasonText.textContent = showWhy ? state.activeWhy : "";
  }

  function renderBackroom() {
    var controlsVisible = state.sessionActive && state.showBackroomControls && !ui.backroomScreen.hidden;
    ui.backroomTop.hidden = !controlsVisible;
    ui.exitBtn.hidden = !(controlsVisible && state.activeMode === MODES.standard);
    ui.firstMoveCompleteBtn.hidden = !(controlsVisible && state.activeMode === MODES.firstMove && state.waitingFirstMoveCompletion);

    if (!state.sessionActive) return;

    if (state.activeMode === MODES.standard) {
      ui.modeActiveTitle.textContent = "Standard Backroom";
      if (state.accessEndsAt) {
        ui.unlockConditionChip.textContent = "Ends at " + timeLabel(state.accessEndsAt);
      } else {
        ui.unlockConditionChip.textContent = "Ends at the selected time";
      }
    } else if (state.activeMode === MODES.commitment) {
      ui.modeActiveTitle.textContent = "Commitment Backroom";
      ui.unlockConditionChip.textContent = "Unlocks when the selected duration ends";
    } else {
      ui.modeActiveTitle.textContent = "First Move Backroom";
      ui.unlockConditionChip.textContent = "Unlocks when The First Move is completed";
    }

    if (state.accessEndsAt && state.activeMode !== MODES.firstMove) {
      ui.countdownChip.hidden = false;
      ui.countdownChip.textContent = formatCountdown(Math.max(0, state.accessEndsAt - Date.now()));
    } else {
      ui.countdownChip.hidden = true;
      ui.countdownChip.textContent = "";
    }
  }

  function timeLabel(epochMs) {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(epochMs));
  }

  function formatCountdown(ms) {
    var total = Math.ceil(ms / 1000);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    if (hours > 0) {
      return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + " left";
    }
    return minutes + ":" + String(seconds).padStart(2, "0") + " left";
  }

  function normalizedWhy(text) {
    var trimmed = trimText(text);
    return trimmed || null;
  }

  function trimText(value) {
    return String(value || "").trim();
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();
