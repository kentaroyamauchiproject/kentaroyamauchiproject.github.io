"use strict";

(function () {
  const MODES = {
    standard: "standard",
    commitment: "commitment",
    firstMove: "firstMove"
  };

  const state = {
    mode: MODES.standard,
    backroomMinutes: 0,
    selection: new Set(),
    whyImHere: "",
    sessionActive: false,
    activeMode: MODES.standard,
    accessEndsAt: null,
    waitingFirstMoveCompletion: false,
    showBackroomControls: false,
    now: new Date()
  };

  const selectionCatalog = [
    "Mail",
    "Messages",
    "Safari",
    "YouTube",
    "Instagram",
    "X",
    "Reddit",
    "Games",
    "Shopping"
  ];

  let ticker = null;

  const ui = {
    modeSegmentButtons: Array.from(document.querySelectorAll("[data-mode]")),
    durationButtons: Array.from(document.querySelectorAll("[data-minutes]")),
    whyInput: document.getElementById("whyInput"),
    durationBlock: document.getElementById("durationBlock"),
    firstMoveHint: document.getElementById("firstMoveHint"),
    selectionBtn: document.getElementById("selectionBtn"),
    selectionSummary: document.getElementById("selectionSummary"),
    activeCard: document.getElementById("activeCard"),
    activeTitle: document.getElementById("activeTitle"),
    activeReasonLabel: document.getElementById("activeReasonLabel"),
    activeReasonText: document.getElementById("activeReasonText"),
    activeHint: document.getElementById("activeHint"),
    resumeBtn: document.getElementById("resumeBtn"),
    unlockBtn: document.getElementById("unlockBtn"),
    enterBtn: document.getElementById("enterBtn"),
    backroomScreen: document.getElementById("backroomScreen"),
    backroomTop: document.getElementById("backroomTop"),
    modeActiveTitle: document.getElementById("modeActiveTitle"),
    unlockConditionChip: document.getElementById("unlockConditionChip"),
    countdownChip: document.getElementById("countdownChip"),
    firstMoveCompleteBtn: document.getElementById("firstMoveCompleteBtn"),
    exitBtn: document.getElementById("exitBtn"),
    selectionDialog: document.getElementById("selectionDialog"),
    selectionList: document.getElementById("selectionList"),
    selectionDoneBtn: document.getElementById("selectionDoneBtn"),
    commitmentDialog: document.getElementById("commitmentDialog"),
    commitmentStayBtn: document.getElementById("commitmentStayBtn"),
    commitmentEnterBtn: document.getElementById("commitmentEnterBtn"),
    standardExitDialog: document.getElementById("standardExitDialog"),
    standardExitTitle: document.getElementById("standardExitTitle"),
    standardExitMessage: document.getElementById("standardExitMessage"),
    standardExitStayBtn: document.getElementById("standardExitStayBtn"),
    standardExitLeaveBtn: document.getElementById("standardExitLeaveBtn")
  };

  function init() {
    buildSelectionDialog();
    bindEvents();
    render();
  }

  function bindEvents() {
    ui.modeSegmentButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextMode = button.dataset.mode || MODES.standard;
        state.mode = nextMode;
        if (state.mode === MODES.commitment && state.backroomMinutes <= 0) {
          state.backroomMinutes = 5;
        }
        render();
      });
    });

    ui.durationButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        state.backroomMinutes = Number(button.dataset.minutes || "0");
        render();
      });
    });

    ui.whyInput.addEventListener("input", function () {
      state.whyImHere = ui.whyInput.value;
    });

    ui.selectionBtn.addEventListener("click", function () {
      ui.selectionDialog.showModal();
    });

    ui.selectionDoneBtn.addEventListener("click", function () {
      ui.selectionDialog.close();
      renderSelectionSummary();
    });

    ui.enterBtn.addEventListener("click", function () {
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

    ui.resumeBtn.addEventListener("click", function () {
      openBackroomScene();
    });

    ui.unlockBtn.addEventListener("click", function () {
      if (state.activeMode !== MODES.standard) return;
      maybeConfirmStandardExit();
    });

    ui.backroomScreen.addEventListener("click", function (event) {
      if (event.target === ui.exitBtn || event.target === ui.firstMoveCompleteBtn) return;
      state.showBackroomControls = !state.showBackroomControls;
      renderBackroom();
    });

    ui.exitBtn.addEventListener("click", function () {
      maybeConfirmStandardExit();
    });

    ui.firstMoveCompleteBtn.addEventListener("click", function () {
      if (!state.waitingFirstMoveCompletion) return;
      endBackroomSession();
    });

    ui.standardExitStayBtn.addEventListener("click", function () {
      ui.standardExitDialog.close();
    });

    ui.standardExitLeaveBtn.addEventListener("click", function () {
      ui.standardExitDialog.close();
      endBackroomSession();
    });
  }

  function buildSelectionDialog() {
    ui.selectionList.innerHTML = selectionCatalog.map(function (label) {
      return (
        '<label class="mbo-check-row">' +
        '<input type="checkbox" data-selection="' + escapeHTML(label) + '">' +
        '<span>' + escapeHTML(label) + "</span>" +
        "</label>"
      );
    }).join("");

    Array.from(ui.selectionList.querySelectorAll("[data-selection]")).forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        const value = checkbox.dataset.selection || "";
        if (!value) return;
        if (checkbox.checked) state.selection.add(value);
        else state.selection.delete(value);
      });
    });
  }

  function beginBackroomSession() {
    state.sessionActive = true;
    state.activeMode = state.mode;
    state.waitingFirstMoveCompletion = state.activeMode === MODES.firstMove;
    state.accessEndsAt = null;

    if (state.activeMode !== MODES.firstMove && state.backroomMinutes > 0) {
      state.accessEndsAt = Date.now() + (state.backroomMinutes * 60000);
    }

    state.showBackroomControls = true;
    startTicker();
    openBackroomScene();
    render();
  }

  function openBackroomScene() {
    ui.backroomScreen.hidden = false;
    document.body.classList.add("mbo-backroom-open");
    renderBackroom();
  }

  function closeBackroomScene() {
    ui.backroomScreen.hidden = true;
    document.body.classList.remove("mbo-backroom-open");
  }

  function endBackroomSession() {
    state.sessionActive = false;
    state.waitingFirstMoveCompletion = false;
    state.accessEndsAt = null;
    state.showBackroomControls = false;
    closeBackroomScene();
    stopTicker();
    render();
  }

  function startTicker() {
    stopTicker();
    ticker = window.setInterval(function () {
      state.now = new Date();
      if (state.sessionActive && state.accessEndsAt && Date.now() >= state.accessEndsAt) {
        endBackroomSession();
        return;
      }
      if (!ui.backroomScreen.hidden) renderBackroom();
      if (state.sessionActive) renderActiveCard();
    }, 1000);
  }

  function stopTicker() {
    if (!ticker) return;
    window.clearInterval(ticker);
    ticker = null;
  }

  function maybeConfirmStandardExit() {
    if (!state.sessionActive || state.activeMode !== MODES.standard) return;
    const remainingMs = state.accessEndsAt ? Math.max(0, state.accessEndsAt - Date.now()) : null;
    const whyTrimmed = state.whyImHere.trim();
    if (whyTrimmed) {
      ui.standardExitTitle.textContent = "Tempted to leave Backroom?";
      ui.standardExitMessage.textContent = makeWhyMessage(whyTrimmed, remainingMs);
    } else {
      ui.standardExitTitle.textContent = "Leave Backroom now?";
      ui.standardExitMessage.textContent = "If you exit now, your Backroom session ends immediately.";
    }
    ui.standardExitDialog.showModal();
  }

  function makeWhyMessage(whyText, remainingMs) {
    if (!remainingMs || remainingMs <= 0) return "Remember why you're here: " + whyText;
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return "Remember why you're here: " + whyText + ". " + remainingMinutes + " minute(s) remain.";
  }

  function render() {
    renderModeButtons();
    renderDuration();
    renderSelectionSummary();
    renderActiveCard();
    renderBackroom();
  }

  function renderModeButtons() {
    ui.modeSegmentButtons.forEach(function (button) {
      const selected = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function renderDuration() {
    const firstMove = state.mode === MODES.firstMove;
    ui.durationBlock.classList.toggle("is-disabled", firstMove);
    ui.firstMoveHint.hidden = !firstMove;

    ui.durationButtons.forEach(function (button) {
      const minutes = Number(button.dataset.minutes || "0");
      const selected = minutes === state.backroomMinutes;
      const disallowed = (state.mode === MODES.commitment && minutes === 0) || firstMove;
      button.disabled = disallowed;
      button.classList.toggle("is-active", selected && !firstMove);
    });
  }

  function renderSelectionSummary() {
    const selected = Array.from(state.selection);
    if (!selected.length) {
      ui.selectionSummary.textContent = "No selection";
      return;
    }
    ui.selectionSummary.textContent = selected.slice(0, 4).join(", ") + (selected.length > 4 ? " +" + (selected.length - 4) : "");
    Array.from(ui.selectionList.querySelectorAll("[data-selection]")).forEach(function (checkbox) {
      const value = checkbox.dataset.selection || "";
      checkbox.checked = state.selection.has(value);
    });
  }

  function renderActiveCard() {
    ui.activeCard.hidden = !state.sessionActive;
    ui.enterBtn.hidden = state.sessionActive;
    if (!state.sessionActive) return;

    if (state.activeMode === MODES.standard) {
      ui.activeTitle.textContent = "Standard Backroom active";
      ui.activeHint.textContent = state.accessEndsAt ? "Unlock when timer ends or exit early." : "No timer is set. You can unlock any time.";
      ui.unlockBtn.hidden = false;
    } else if (state.activeMode === MODES.commitment) {
      ui.activeTitle.textContent = "Commitment Backroom active";
      ui.activeHint.textContent = "No early exit. Unlock happens only when timer ends.";
      ui.unlockBtn.hidden = true;
    } else {
      ui.activeTitle.textContent = "First Move Backroom active";
      ui.activeHint.textContent = "Unlock after the First Move is complete (on iOS this is MindEntry handoff).";
      ui.unlockBtn.hidden = true;
    }

    const whyTrimmed = state.whyImHere.trim();
    const showWhy = whyTrimmed.length > 0;
    ui.activeReasonLabel.hidden = !showWhy;
    ui.activeReasonText.hidden = !showWhy;
    if (showWhy) {
      ui.activeReasonText.textContent = whyTrimmed;
    }
  }

  function renderBackroom() {
    const controlsVisible = state.sessionActive && state.showBackroomControls && !ui.backroomScreen.hidden;
    ui.backroomTop.hidden = !controlsVisible;
    ui.exitBtn.hidden = !(controlsVisible && state.activeMode === MODES.standard);
    ui.firstMoveCompleteBtn.hidden = !(controlsVisible && state.activeMode === MODES.firstMove && state.waitingFirstMoveCompletion);

    if (!state.sessionActive) return;

    if (state.activeMode === MODES.standard) {
      ui.modeActiveTitle.textContent = "Standard Backroom";
      ui.unlockConditionChip.textContent = state.accessEndsAt ? "Unlock when timer ends (or exit early)" : "No timer set; exit is available";
    } else if (state.activeMode === MODES.commitment) {
      ui.modeActiveTitle.textContent = "Commitment Backroom";
      ui.unlockConditionChip.textContent = "Unlock only when timer ends";
    } else {
      ui.modeActiveTitle.textContent = "First Move Backroom";
      ui.unlockConditionChip.textContent = "Unlock after First Move completion";
    }

    if (state.accessEndsAt && state.activeMode !== MODES.firstMove) {
      const remainingMs = Math.max(0, state.accessEndsAt - Date.now());
      ui.countdownChip.hidden = false;
      ui.countdownChip.textContent = formatCountdown(remainingMs);
    } else {
      ui.countdownChip.hidden = true;
      ui.countdownChip.textContent = "";
    }
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return (
        hours + ":" +
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0")
      );
    }

    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  init();
})();
