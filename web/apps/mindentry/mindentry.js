"use strict";

(function () {
  const RECIPES = [
    {
      id: "r-clear-task",
      name: "Clear a Task",
      kind: "recipe",
      section: "recommended",
      steps: [
        { title: "Step 1", type: "external", app: "MindShoutOut", instruction: "Capture {ENTRY} in {SOURCE_APP} as a {ENTRY_TYPE}." },
        { title: "Step 2", type: "updatethought", instruction: "Update Current Thought with what remains." },
        { title: "Step 3", type: "external", app: "MindFlipOut", instruction: "Open MindFlipOut with your current thought." }
      ]
    },
    {
      id: "r-reset-attention",
      name: "Reset Attention",
      kind: "recipe",
      section: "recent",
      steps: [
        { title: "Step 1", type: "external", app: "MindZoneOut", instruction: "Zone with {ENTRY} for a short reset." },
        { title: "Step 2", type: "action", instruction: "Mark one next action you will take after this reset." }
      ]
    },
    {
      id: "r-two-step",
      name: "Two Step Unstuck",
      kind: "recipe",
      section: "saved",
      steps: [
        { title: "Step 1", type: "capture", instruction: "Write the smallest physical first move for {ENTRY}." },
        { title: "Step 2", type: "external", app: "MindBackOut", instruction: "If needed, step into MindBackOut before continuing." }
      ]
    },
    {
      id: "c-first-move",
      name: "The First Move",
      kind: "cognihack",
      section: "recommended",
      steps: [
        { title: "Step 1", type: "action", instruction: "Feet flat. Shoulders down." },
        { title: "Step 2", type: "capture", instruction: "What is the smallest visible action for {ENTRY}?" },
        { title: "Step 3", type: "action", instruction: "Do only that action now." }
      ]
    },
    {
      id: "c-quick-start",
      name: "Quick Start",
      kind: "cognihack",
      section: "saved",
      steps: [
        { title: "Step 1", type: "action", instruction: "Name one blocker in one sentence." },
        { title: "Step 2", type: "updatethought", instruction: "Rewrite Current Thought as a single next move." }
      ]
    }
  ];

  const state = {
    pendingPrefill: "",
    pickerMode: "recipe",
    launchContext: null,
    run: null,
    routingSuggestions: []
  };

  const ui = {
    composerInput: document.getElementById("meComposerInput"),
    prefillHint: document.getElementById("mePrefillHint"),
    routingCard: document.getElementById("meRoutingCard"),
    routingList: document.getElementById("meRoutingList"),
    sendToRecipeBtn: document.getElementById("meSendToRecipeBtn"),
    runCogniHackBtn: document.getElementById("meRunCogniHackBtn"),
    saveForLaterBtn: document.getElementById("meSaveForLaterBtn"),
    runtimeCard: document.getElementById("meRuntimeCard"),
    runtimeTitle: document.getElementById("meRuntimeTitle"),
    runtimeStepMeta: document.getElementById("meRuntimeStepMeta"),
    runtimeBody: document.getElementById("meRuntimeBody"),
    pickerDialog: document.getElementById("mePickerDialog"),
    pickerTitle: document.getElementById("mePickerTitle"),
    pickerEntryPreview: document.getElementById("mePickerEntryPreview"),
    pickerSections: document.getElementById("mePickerSections")
  };

  const ROUTING_RULES = [
    {
      id: "route-mfo",
      title: "MindFlipOut route",
      subtitle: "Heavy loop or reframing signal detected.",
      action: "recipe",
      keywords: ["rumination", "ruminate", "reframe", "reframing", "heavy", "loop", "overthink", "stuck thought"]
    },
    {
      id: "route-mso",
      title: "MindShoutOut route",
      subtitle: "Reminder/schedule signal detected.",
      action: "recipe",
      keywords: ["reminder", "remind", "later", "schedule", "waiting", "don't forget", "follow up", "someday"]
    },
    {
      id: "route-mzo",
      title: "MindZoneOut route",
      subtitle: "Quiet/reset signal detected.",
      action: "recipe",
      keywords: ["quiet", "overload", "reset", "zone", "noisy", "overwhelmed", "too much", "brain full"]
    },
    {
      id: "route-mbo",
      title: "MindBackOut route",
      subtitle: "Distraction/app-lock signal detected.",
      action: "recipe",
      keywords: ["distraction", "distracted", "apps", "doomscroll", "doomscrolling", "lock", "can't stop scrolling", "scrolling"]
    },
    {
      id: "route-mby",
      title: "MindBackyard route",
      subtitle: "Low-stimulation wander signal detected.",
      action: "recipe",
      keywords: ["fidget", "wander", "wandering", "low stimulation", "restless", "antsy", "bored"]
    },
    {
      id: "route-recipe",
      title: "Send to Recipe",
      subtitle: "Task-start friction detected.",
      action: "recipe",
      keywords: ["can't start", "start task", "procrastinating", "stuck starting", "avoid starting", "first step", "initiate"]
    },
    {
      id: "route-cognihack",
      title: "Run a CogniHack",
      subtitle: "Task-start friction detected.",
      action: "cognihack",
      keywords: ["can't start", "start task", "procrastinating", "stuck starting", "avoid starting", "first step", "initiate"]
    }
  ];

  function nowStamp() {
    return new Date().toLocaleString();
  }

  function normalizeText(value) {
    return (value || "").trim();
  }

  function composerText() {
    return normalizeText(ui.composerInput.value);
  }

  function countKeywordHits(lowerText, keywords) {
    let hits = 0;
    keywords.forEach(function (keyword) {
      if (lowerText.indexOf(keyword) >= 0) hits += 1;
    });
    return hits;
  }

  function detectRoutingSuggestions(text) {
    const trimmed = normalizeText(text);
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();

    return ROUTING_RULES
      .map(function (rule) {
        return { rule: rule, score: countKeywordHits(lower, rule.keywords) };
      })
      .filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (item) { return item.rule; });
  }

  function applyRoutingSuggestion(rule) {
    if (rule.action === "cognihack") {
      openPicker("cognihack");
      return;
    }
    openPicker("recipe");
  }

  function renderRoutingSuggestions() {
    state.routingSuggestions = detectRoutingSuggestions(ui.composerInput.value);
    if (!state.routingSuggestions.length) {
      ui.routingCard.hidden = true;
      ui.routingList.innerHTML = "";
      return;
    }

    ui.routingCard.hidden = false;
    ui.routingList.innerHTML = "";
    state.routingSuggestions.forEach(function (rule) {
      const row = document.createElement("div");
      row.className = "me-routing-item";
      row.innerHTML =
        "<div class=\"me-routing-copy\">"
        + "<p class=\"me-routing-item-title\">" + escapeHtml(rule.title) + "</p>"
        + "<p class=\"me-routing-item-sub\">" + escapeHtml(rule.subtitle) + "</p>"
        + "</div>"
        + "<button type=\"button\" class=\"me-routing-btn\">" + (rule.action === "cognihack" ? "Run" : "Route") + "</button>";
      const routeBtn = row.querySelector(".me-routing-btn");
      routeBtn.addEventListener("click", function () {
        applyRoutingSuggestion(rule);
      });
      ui.routingList.appendChild(row);
    });
  }

  function buildLaunchContext() {
    const entryText = composerText();
    return {
      sourceApp: "MindEntry",
      entryType: "imported",
      entryText: entryText
    };
  }

  function renderPlaceholders(raw, launchContext) {
    return raw
      .replace(/\{ENTRY\}/g, launchContext.entryText || "")
      .replace(/\{SOURCE_APP\}/g, launchContext.sourceApp || "")
      .replace(/\{ENTRY_TYPE\}/g, launchContext.entryType || "");
  }

  function openPicker(mode) {
    const entryText = composerText();
    if (!entryText) {
      ui.composerInput.focus();
      return;
    }

    state.pickerMode = mode;
    state.launchContext = buildLaunchContext();
    ui.pickerTitle.textContent = mode === "cognihack" ? "Choose a CogniHack" : "Choose a Recipe";
    ui.pickerEntryPreview.textContent = entryText;
    renderPickerSections();
    ui.pickerDialog.showModal();
  }

  function recipesForMode(mode) {
    return RECIPES.filter(function (recipe) {
      return recipe.kind === mode;
    });
  }

  function renderPickerSections() {
    const grouped = {
      recommended: [],
      recent: [],
      saved: []
    };

    recipesForMode(state.pickerMode).forEach(function (recipe) {
      grouped[recipe.section].push(recipe);
    });

    const labels = {
      recommended: "Recommended",
      recent: "Recent",
      saved: "Saved"
    };

    ui.pickerSections.innerHTML = "";

    Object.keys(grouped).forEach(function (sectionName) {
      const recipes = grouped[sectionName];
      if (!recipes.length) return;

      const section = document.createElement("section");
      section.className = "me-picker-section";

      const heading = document.createElement("h3");
      heading.className = "me-picker-heading";
      heading.textContent = labels[sectionName];
      section.appendChild(heading);

      const list = document.createElement("div");
      list.className = "me-picker-list";

      recipes.forEach(function (recipe) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "me-picker-item";
        btn.textContent = recipe.name;
        btn.addEventListener("click", function () {
          ui.pickerDialog.close();
          startRun(recipe, state.launchContext);
        });
        list.appendChild(btn);
      });

      section.appendChild(list);
      ui.pickerSections.appendChild(section);
    });
  }

  function startRun(recipe, launchContext) {
    state.run = {
      recipeId: recipe.id,
      title: recipe.name,
      type: recipe.kind,
      stepIndex: 0,
      steps: recipe.steps.map(function (step) {
        return {
          title: step.title,
          type: step.type,
          app: step.app || "",
          instruction: renderPlaceholders(step.instruction, launchContext),
          launchedAt: null
        };
      }),
      launchThought: launchContext.entryText,
      currentThought: launchContext.entryText,
      launchContext: launchContext,
      completedAt: null
    };
    renderRun();
  }

  function currentStep() {
    if (!state.run) return null;
    return state.run.steps[state.run.stepIndex] || null;
  }

  function markComplete() {
    if (!state.run) return;
    state.run.stepIndex += 1;
    if (state.run.stepIndex >= state.run.steps.length) {
      state.run.completedAt = nowStamp();
    }
    renderRun();
  }

  function skipStep() {
    markComplete();
  }

  function cancelRun() {
    state.run = null;
    renderRun();
  }

  function openSimulatedHandoff() {
    const step = currentStep();
    if (!step || step.type !== "external") return;
    step.launchedAt = nowStamp();
    renderRun();
  }

  function updateCurrentThoughtFromInput(inputEl) {
    if (!state.run) return;
    const value = normalizeText(inputEl.value);
    if (!value) return;
    state.run.currentThought = value;
    renderRun();
  }

  function renderRun() {
    if (!state.run) {
      ui.runtimeCard.hidden = true;
      ui.runtimeBody.innerHTML = "";
      return;
    }

    ui.runtimeCard.hidden = false;
    ui.runtimeTitle.textContent = state.run.title;

    if (state.run.completedAt) {
      ui.runtimeStepMeta.textContent = "Run complete";
      renderCompletedState();
      return;
    }

    const step = currentStep();
    ui.runtimeStepMeta.textContent = "Step " + (state.run.stepIndex + 1) + " of " + state.run.steps.length;
    renderStepState(step);
  }

  function renderCompletedState() {
    const wrap = document.createElement("div");
    wrap.className = "me-runtime-stack";

    const thoughtCard = document.createElement("div");
    thoughtCard.className = "me-runtime-thought";
    thoughtCard.innerHTML = "<p class=\"me-runtime-k\">Launch Thought</p><p>" + escapeHtml(state.run.launchThought) + "</p>"
      + "<p class=\"me-runtime-k\">Current Thought</p><p>" + escapeHtml(state.run.currentThought) + "</p>";
    wrap.appendChild(thoughtCard);

    const meta = document.createElement("p");
    meta.className = "me-muted";
    meta.textContent = "Completed at " + state.run.completedAt + ".";
    wrap.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "me-runtime-actions";
    actions.innerHTML = "<button type=\"button\" class=\"me-action-btn me-action-btn-primary\" id=\"meCloseRunBtn\">Close Run</button>";
    wrap.appendChild(actions);

    ui.runtimeBody.innerHTML = "";
    ui.runtimeBody.appendChild(wrap);
    document.getElementById("meCloseRunBtn").addEventListener("click", cancelRun);
  }

  function renderStepState(step) {
    const wrap = document.createElement("div");
    wrap.className = "me-runtime-stack";

    const thoughtCard = document.createElement("div");
    thoughtCard.className = "me-runtime-thought";
    thoughtCard.innerHTML = "<p class=\"me-runtime-k\">Launch Thought</p><p>" + escapeHtml(state.run.launchThought) + "</p>"
      + "<p class=\"me-runtime-k\">Current Thought</p><p>" + escapeHtml(state.run.currentThought) + "</p>";
    wrap.appendChild(thoughtCard);

    const stepCard = document.createElement("div");
    stepCard.className = "me-step-card";
    stepCard.innerHTML = "<p class=\"me-runtime-k\">" + escapeHtml(step.title) + "</p><p>" + escapeHtml(step.instruction) + "</p>";
    wrap.appendChild(stepCard);

    if (step.type === "updatethought") {
      const updateBox = document.createElement("div");
      updateBox.className = "me-update-box";
      updateBox.innerHTML = "<textarea id=\"meCurrentThoughtInput\" class=\"me-composer-input me-inline-input\"></textarea>"
        + "<button type=\"button\" class=\"me-action-btn\" id=\"meUpdateThoughtBtn\">Update Current Thought</button>";
      wrap.appendChild(updateBox);
    }

    if (step.type === "external") {
      const handoffCard = document.createElement("div");
      handoffCard.className = "me-handoff-card";
      handoffCard.innerHTML = "<p class=\"me-runtime-k\">Simulated Partner Handoff</p>"
        + "<p>Open in " + escapeHtml(step.app) + " (simulated in browser).</p>"
        + "<p class=\"me-muted\">Native app uses URL-scheme handoff; this web version keeps state in-memory and does not launch iOS apps.</p>"
        + "<button type=\"button\" class=\"me-action-btn\" id=\"meHandoffBtn\">Open in " + escapeHtml(step.app) + "</button>";
      if (step.launchedAt) {
        const launchedMeta = document.createElement("p");
        launchedMeta.className = "me-muted";
        launchedMeta.textContent = "Handoff opened at " + step.launchedAt + ".";
        handoffCard.appendChild(launchedMeta);
      }
      wrap.appendChild(handoffCard);
    }

    const actions = document.createElement("div");
    actions.className = "me-runtime-actions";
    actions.innerHTML =
      "<button type=\"button\" class=\"me-action-btn me-action-btn-primary\" id=\"meMarkCompleteBtn\">Mark Complete</button>"
      + "<button type=\"button\" class=\"me-action-btn\" id=\"meSkipBtn\">Skip</button>"
      + "<button type=\"button\" class=\"me-action-btn\" id=\"meCancelRunBtn\">Cancel</button>";
    wrap.appendChild(actions);

    ui.runtimeBody.innerHTML = "";
    ui.runtimeBody.appendChild(wrap);

    const markBtn = document.getElementById("meMarkCompleteBtn");
    const skipBtn = document.getElementById("meSkipBtn");
    const cancelBtn = document.getElementById("meCancelRunBtn");
    const handoffBtn = document.getElementById("meHandoffBtn");
    const updateBtn = document.getElementById("meUpdateThoughtBtn");
    const thoughtInput = document.getElementById("meCurrentThoughtInput");

    if (thoughtInput) {
      thoughtInput.value = state.run.currentThought;
    }

    markBtn.addEventListener("click", markComplete);
    skipBtn.addEventListener("click", skipStep);
    cancelBtn.addEventListener("click", cancelRun);

    if (handoffBtn) {
      handoffBtn.addEventListener("click", openSimulatedHandoff);
    }

    if (updateBtn && thoughtInput) {
      updateBtn.addEventListener("click", function () {
        updateCurrentThoughtFromInput(thoughtInput);
      });
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function saveForLater() {
    const text = composerText();
    if (!text) {
      ui.composerInput.focus();
      return;
    }
    state.pendingPrefill = text;
    ui.composerInput.value = state.pendingPrefill;
    ui.prefillHint.hidden = false;
    ui.composerInput.focus();
  }

  ui.sendToRecipeBtn.addEventListener("click", function () {
    openPicker("recipe");
  });

  ui.runCogniHackBtn.addEventListener("click", function () {
    openPicker("cognihack");
  });

  ui.saveForLaterBtn.addEventListener("click", saveForLater);

  ui.composerInput.addEventListener("input", function () {
    if (normalizeText(ui.composerInput.value) !== state.pendingPrefill) {
      ui.prefillHint.hidden = true;
    }
    renderRoutingSuggestions();
  });

  renderRun();
  renderRoutingSuggestions();
})();
