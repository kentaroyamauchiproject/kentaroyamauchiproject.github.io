"use strict";

(function () {
  var router = window.MindEntryRealtimeRouter;
  var bundled = window.MindEntryBundledRecipes;

  var state = {
    routeResult: null,
    run: null,
    recentRecipeIds: [],
    runtimeVariables: {},
    pickerMode: "recipe",
    launchContext: null
  };

  var ui = {
    homeStack: document.getElementById("meHomeStack"),
    composerInput: document.getElementById("meComposerInput"),
    composerActions: document.getElementById("meComposerActions"),
    runCognihackBtn: document.getElementById("meRunCognihackBtn"),
    radarCard: document.getElementById("meRadarCard"),
    suggestionSheet: document.getElementById("meSuggestionSheet"),
    suggestionCard: document.getElementById("meSuggestionCard"),
    runtimeCard: document.getElementById("meRuntimeCard"),
    runtimeTitle: document.getElementById("meRuntimeTitle"),
    runtimeStepMeta: document.getElementById("meRuntimeStepMeta"),
    runtimeBody: document.getElementById("meRuntimeBody"),
    recipesBtn: document.getElementById("meRecipesBtn"),
    pickerDialog: document.getElementById("mePickerDialog"),
    pickerTitle: document.getElementById("mePickerTitle"),
    pickerEntryPreview: document.getElementById("mePickerEntryPreview"),
    pickerSections: document.getElementById("mePickerSections"),
    libraryDialog: document.getElementById("meLibraryDialog"),
    libraryList: document.getElementById("meLibraryList")
  };

  function normalizeText(value) {
    return (value || "").trim();
  }

  function composerText() {
    return normalizeText(ui.composerInput.value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildLaunchContext() {
    return {
      sourceApp: "MindEntry",
      entryType: "imported",
      entryText: composerText()
    };
  }

  function renderPlaceholders(raw, launchContext, variables) {
    var vars = variables || state.runtimeVariables;
    var entry = launchContext ? launchContext.entryText : composerText();
    return String(raw || "")
      .replace(/\{\{targetTask\}\}/g, vars.targetTask || entry)
      .replace(/\{\{firstMove\}\}/g, vars.firstMove || "")
      .replace(/\{ENTRY\}/g, entry || "")
      .replace(/\{SOURCE_APP\}/g, (launchContext && launchContext.sourceApp) || "MindEntry")
      .replace(/\{ENTRY_TYPE\}/g, (launchContext && launchContext.entryType) || "");
  }

  function updateRoutingUI() {
    var text = composerText();
    if (state.run) {
      ui.radarCard.hidden = true;
      ui.suggestionSheet.hidden = true;
      ui.suggestionCard.innerHTML = "";
      if (ui.composerActions) ui.composerActions.hidden = true;
      return;
    }

    ui.suggestionSheet.hidden = false;
    if (ui.composerActions) {
      ui.composerActions.hidden = text.length < 8;
    }

    state.routeResult = text ? router.route(text) : null;
    renderRadar(text);
    renderSuggestionSheet(text);
  }

  function renderRadar(text) {
    if (!text || state.run) {
      ui.radarCard.hidden = true;
      ui.radarCard.innerHTML = "";
      return;
    }

    var radar = router.radarDetections(text);
    if (!radar) {
      ui.radarCard.hidden = true;
      ui.radarCard.innerHTML = "";
      return;
    }

    ui.radarCard.hidden = false;
    var html = '<p class="me-radar-heading">Thought Radar</p>';

    if (radar.isFallback) {
      html += '<p class="me-radar-fallback-note">Not sure yet.</p>';
      html += '<div class="me-radar-fallback-grid">';
      html += chipRow(["Flip it", "flip"], ["Schedule it", "shout"], ["Zone out", "zone"]);
      html += chipRow(["Ease out", "ease"], ["Step back", "back"], ["Wander", "backyard"]);
      html += "</div>";
    } else {
      radar.detections.forEach(function (d) {
        html +=
          '<button type="button" class="me-radar-row" data-intent="' + escapeHtml(d.intent) + '">' +
            '<span class="me-radar-label">' + escapeHtml(d.label) + '</span>' +
            '<span class="me-radar-app">→ ' + escapeHtml(router.appName(d.intent)) + "</span>" +
            '<span class="me-radar-chevron" aria-hidden="true">›</span>' +
          "</button>";
      });
    }

    ui.radarCard.innerHTML = html;

    ui.radarCard.querySelectorAll("[data-intent]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        routeIntent(btn.getAttribute("data-intent"));
      });
    });
  }

  function chipRow(a, b, c) {
    return (
      '<div class="me-chip-row">' +
        chipButton(a[0], a[1]) +
        chipButton(b[0], b[1]) +
        chipButton(c[0], c[1]) +
      "</div>"
    );
  }

  function chipButton(label, intent) {
    return '<button type="button" class="me-chip-btn" data-intent="' + escapeHtml(intent) + '">' + escapeHtml(label) + "</button>";
  }

  function renderSuggestionSheet(text) {
    if (state.run) {
      ui.suggestionCard.innerHTML = "";
      return;
    }

    if (!text) {
      ui.suggestionCard.innerHTML = '<p class="me-suggestion-empty">Share what\'s on your mind and MindEntry will suggest where to go.</p>';
      return;
    }

    var result = state.routeResult;
    if (!result) {
      ui.suggestionCard.innerHTML = '<p class="me-suggestion-empty">Keep typing — MindEntry needs a little more context.</p>';
      return;
    }

    if (result.isFallback) {
      ui.suggestionCard.innerHTML =
        '<div class="me-suggestion-fallback">' +
          '<p class="me-suggestion-message">' + escapeHtml(result.actionMessage) + "</p>" +
          '<div class="me-radar-fallback-grid">' +
            chipRow(["Flip it", "flip"], ["Schedule it", "shout"], ["Zone out", "zone"]) +
            chipRow(["Ease out", "ease"], ["Step back", "back"], ["Wander", "backyard"]) +
          "</div>" +
        "</div>";
      ui.suggestionCard.querySelectorAll("[data-intent]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          routeIntent(btn.getAttribute("data-intent"));
        });
      });
      return;
    }

    if (result.isSplitThought) {
      ui.suggestionCard.innerHTML =
        '<div class="me-split-card">' +
          '<p class="me-suggestion-message">' + escapeHtml(result.actionMessage) + "</p>" +
          '<div class="me-split-side"><strong>Heavy</strong><br>' + escapeHtml(result.heavyText) + "</div>" +
          '<div class="me-split-side"><strong>Light</strong><br>' + escapeHtml(result.lightText) + "</div>" +
          '<div class="me-suggestion-actions">' +
            '<button type="button" class="me-action-btn me-action-btn-primary" id="meSplitFlipBtn">Flip the heavy part</button>' +
          "</div>" +
        "</div>";
      document.getElementById("meSplitFlipBtn").addEventListener("click", function () {
        routeIntent("flip");
      });
      return;
    }

    if (result.recipe.length >= 2) {
      var recipeName = router.recipeName(result.recipe);
      var arrow = result.recipe.map(function (i) { return router.recipeStepLabel(i); }).join(" → ");
      var hint = router.recipeActionHint(result.recipe);
      var stepsHtml = result.recipe.map(function (intent, index) {
        return (
          '<div class="me-suggestion-step">' +
            "<span>Step " + (index + 1) + "</span>" +
            "<span>" + escapeHtml(router.recipeStepDescription(intent)) + "</span>" +
          "</div>"
        );
      }).join("");

      ui.suggestionCard.innerHTML =
        '<div>' +
          '<p class="me-suggestion-recipe-title">Recipe: ' + escapeHtml(recipeName) + "</p>" +
          '<p class="me-suggestion-recipe-arrow">' + escapeHtml(arrow) + "</p>" +
          (hint ? '<p class="me-suggestion-hint">' + escapeHtml(hint) + "</p>" : "") +
          '<div class="me-suggestion-steps">' + stepsHtml + "</div>" +
          '<div class="me-suggestion-actions">' +
            '<button type="button" class="me-action-btn me-action-btn-primary" id="meRunDetectedRecipeBtn">Run Recipe</button>' +
            '<button type="button" class="me-action-btn" id="meOpenFirstAppBtn">Open ' + escapeHtml(router.appName(result.primaryIntent)) + "</button>" +
          "</div>" +
        "</div>";

      document.getElementById("meRunDetectedRecipeBtn").addEventListener("click", function () {
        startDetectedRecipeRun(result.recipe);
      });
      document.getElementById("meOpenFirstAppBtn").addEventListener("click", function () {
        routeIntent(result.primaryIntent);
      });
      return;
    }

    var intent = result.primaryIntent;
    ui.suggestionCard.innerHTML =
      '<div>' +
        '<p class="me-suggestion-recipe-title">' + escapeHtml(router.appName(intent)) + "</p>" +
        '<p class="me-suggestion-message">' + escapeHtml(router.actionMessageLong(intent)) + "</p>" +
        '<div class="me-suggestion-actions">' +
          '<button type="button" class="me-action-btn me-action-btn-primary" id="meTakeMeThereBtn">Take Me There</button>' +
          '<button type="button" class="me-action-btn" id="meOpenPickerBtn">Send to Recipe</button>' +
        "</div>" +
      "</div>";

    document.getElementById("meTakeMeThereBtn").addEventListener("click", function () {
      routeIntent(intent);
    });
    document.getElementById("meOpenPickerBtn").addEventListener("click", function () {
      openPicker("recipe");
    });
  }

  function routeIntent(intent) {
    var appName = router.appName(intent);
    if (!appName) return;

    var boundary = window.MindBebopBoundary;
    if (boundary && boundary.noticeHTML) {
      ui.suggestionCard.innerHTML = boundary.noticeHTML({
        appName: appName,
        body: "Open " + appName + " on iPhone to continue from here."
      });
      return;
    }
    if (window.MindBebopContinuation) {
      ui.suggestionCard.innerHTML = MindBebopContinuation.cardHTML(appName);
    }
  }

  function ephemeralRecipeFromIntents(intents) {
    var matched = bundled.matchBundledByDetectedRecipe(intents);
    if (matched.length) return matched[0];

    return {
      id: "ephemeral-" + intents.join("-"),
      name: router.recipeName(intents),
      kind: "recipe",
      source: "detected",
      situation: composerText(),
      steps: intents.map(function (intent) {
        return {
          type: "external",
          intent: intent,
          app: router.appName(intent),
          title: router.recipeStepLabel(intent),
          instruction: router.recipeStepDescription(intent)
        };
      })
    };
  }

  function startDetectedRecipeRun(intents) {
    var recipe = ephemeralRecipeFromIntents(intents);
    startRun(recipe, buildLaunchContext());
  }

  function rememberRecent(recipeId) {
    state.recentRecipeIds = [recipeId].concat(
      state.recentRecipeIds.filter(function (id) { return id !== recipeId; })
    ).slice(0, 8);
  }

  function openPicker(mode) {
    var entryText = composerText();
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

  function partitionPickerRecipes() {
    var all = bundled.all().filter(function (recipe) {
      return state.pickerMode === "cognihack" ? recipe.kind === "cognihack" : recipe.kind === "recipe";
    });

    var recommended = bundled.recommendForEntryText(composerText()).filter(function (recipe) {
      return recipe.kind === state.pickerMode;
    });

    if (state.pickerMode === "cognihack" && !recommended.length) {
      recommended = all.filter(function (r) { return r.id === "d004-first-move"; });
    }

    var recommendedIds = {};
    recommended.forEach(function (r) { recommendedIds[r.id] = true; });

    var recent = state.recentRecipeIds
      .map(function (id) { return bundled.byId(id); })
      .filter(function (recipe) {
        return recipe && recipe.kind === state.pickerMode && !recommendedIds[recipe.id];
      });

    var recentIds = {};
    recent.forEach(function (r) { recentIds[r.id] = true; });

    var saved = all.filter(function (recipe) {
      return !recommendedIds[recipe.id] && !recentIds[recipe.id];
    });

    return { recommended: recommended, recent: recent, saved: saved };
  }

  function renderPickerSections() {
    var grouped = partitionPickerRecipes();
    var labels = { recommended: "Recommended", recent: "Recent", saved: "Saved" };
    ui.pickerSections.innerHTML = "";

    ["recommended", "recent", "saved"].forEach(function (sectionName) {
      var recipes = grouped[sectionName];
      if (!recipes.length) return;

      var section = document.createElement("section");
      section.className = "me-picker-section";

      var heading = document.createElement("h3");
      heading.className = "me-picker-heading";
      heading.textContent = labels[sectionName];
      section.appendChild(heading);

      var list = document.createElement("div");
      list.className = "me-picker-list";

      recipes.forEach(function (recipe) {
        var btn = document.createElement("button");
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

  function renderLibrary() {
    ui.libraryList.innerHTML = "";
    bundled.all().forEach(function (recipe) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "me-library-item";
      btn.innerHTML =
        escapeHtml(recipe.name) +
        '<span class="me-library-meta">' + escapeHtml(recipe.situation || "") + "</span>";
      btn.addEventListener("click", function () {
        ui.libraryDialog.close();
        if (composerText()) {
          startRun(recipe, buildLaunchContext());
        } else {
          ui.composerInput.value = recipe.situation || "";
          updateRoutingUI();
          startRun(recipe, buildLaunchContext());
        }
      });
      ui.libraryList.appendChild(btn);
    });
  }

  function startRun(recipe, launchContext) {
    state.runtimeVariables = {};
    state.run = {
      recipeId: recipe.id,
      title: recipe.name,
      type: recipe.kind,
      stepIndex: 0,
      steps: recipe.steps.map(function (step) {
        return {
          type: step.type,
          intent: step.intent || "",
          app: step.app || "MindEntry",
          title: step.title || "",
          instruction: renderPlaceholders(step.instruction, launchContext, {}),
          runtimePrompt: step.runtimePrompt || "",
          variableName: step.variableName || "",
          displayAnswer: step.displayAnswer !== false
        };
      }),
      launchThought: launchContext.entryText,
      currentThought: launchContext.entryText,
      launchContext: launchContext,
      completedAt: null
    };
    rememberRecent(recipe.id);
    ui.homeStack.hidden = true;
    renderRun();
    updateRoutingUI();
  }

  function currentStep() {
    if (!state.run) return null;
    return state.run.steps[state.run.stepIndex] || null;
  }

  function markComplete() {
    if (!state.run) return;
    state.run.stepIndex += 1;
    if (state.run.stepIndex >= state.run.steps.length) {
      state.run.completedAt = new Date().toLocaleString();
    }
    renderRun();
  }

  function cancelRun() {
    state.run = null;
    ui.homeStack.hidden = false;
    renderRun();
    updateRoutingUI();
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

    var step = currentStep();
    ui.runtimeStepMeta.textContent = "Step " + (state.run.stepIndex + 1) + " of " + state.run.steps.length;
    renderStepState(step);
  }

  function renderCompletedState() {
    var wrap = document.createElement("div");
    wrap.className = "me-runtime-stack";
    wrap.innerHTML =
      '<div class="me-runtime-thought">' +
        '<p class="me-runtime-k">Launch Thought</p><p>' + escapeHtml(state.run.launchThought) + "</p>" +
        '<p class="me-runtime-k">Current Thought</p><p>' + escapeHtml(state.run.currentThought) + "</p>" +
      "</div>" +
      '<p class="me-muted">Completed at ' + escapeHtml(state.run.completedAt) + ".</p>" +
      '<div class="me-runtime-actions"><button type="button" class="me-action-btn me-action-btn-primary" id="meCloseRunBtn">Close Run</button></div>';
    ui.runtimeBody.innerHTML = "";
    ui.runtimeBody.appendChild(wrap);
    document.getElementById("meCloseRunBtn").addEventListener("click", cancelRun);
  }

  function partnerBoundaryHTML(appName, instruction) {
    if (window.MindBebopBoundary && MindBebopBoundary.partnerStepHTML) {
      return MindBebopBoundary.partnerStepHTML(appName, instruction);
    }
    if (window.MindBebopContinuation) {
      return MindBebopContinuation.cardHTML(appName);
    }
    return "";
  }

  function renderStepState(step) {
    var wrap = document.createElement("div");
    wrap.className = "me-runtime-stack";

    var thoughtCard = document.createElement("div");
    thoughtCard.className = "me-runtime-thought";
    thoughtCard.innerHTML =
      '<p class="me-runtime-k">Launch Thought</p><p>' + escapeHtml(state.run.launchThought) + "</p>" +
      '<p class="me-runtime-k">Current Thought</p><p>' + escapeHtml(state.run.currentThought) + "</p>";
    wrap.appendChild(thoughtCard);

    var stepCard = document.createElement("div");
    stepCard.className = "me-step-card";
    stepCard.innerHTML =
      '<p class="me-runtime-k">' + escapeHtml(step.title || "Step") + "</p>" +
      "<p>" + escapeHtml(step.instruction || step.runtimePrompt || "") + "</p>";
    wrap.appendChild(stepCard);

    if (step.type === "capture" || step.type === "updatethought") {
      var captureBox = document.createElement("div");
      captureBox.className = "me-update-box";
      captureBox.innerHTML =
        '<textarea id="meStepInput" class="me-composer-input me-inline-input"></textarea>' +
        '<button type="button" class="me-action-btn" id="meUpdateThoughtBtn">' +
          (step.type === "capture" ? "Capture Thought" : "Update Current Thought") +
        "</button>";
      wrap.appendChild(captureBox);
    }

    if (step.type === "askstore" || step.type === "yourstep") {
      var askBox = document.createElement("div");
      askBox.className = "me-update-box";
      askBox.innerHTML =
        '<p class="me-muted">' + escapeHtml(step.runtimePrompt || "What is your step right now?") + "</p>" +
        '<textarea id="meStepInput" class="me-composer-input me-inline-input"></textarea>' +
        '<button type="button" class="me-action-btn" id="meStoreAnswerBtn">Continue</button>';
      wrap.appendChild(askBox);
    }

    if (step.type === "external") {
      var handoffWrap = document.createElement("div");
      handoffWrap.className = "me-handoff-card";
      handoffWrap.innerHTML = partnerBoundaryHTML(step.app, step.instruction);
      wrap.appendChild(handoffWrap);
    }

    var actions = document.createElement("div");
    actions.className = "me-runtime-actions";
    actions.innerHTML =
      '<button type="button" class="me-action-btn me-action-btn-primary" id="meMarkCompleteBtn">Mark Complete</button>' +
      '<button type="button" class="me-action-btn" id="meSkipBtn">Skip</button>' +
      '<button type="button" class="me-action-btn" id="meCancelRunBtn">Cancel</button>';
    wrap.appendChild(actions);

    ui.runtimeBody.innerHTML = "";
    ui.runtimeBody.appendChild(wrap);

    document.getElementById("meMarkCompleteBtn").addEventListener("click", markComplete);
    document.getElementById("meSkipBtn").addEventListener("click", markComplete);
    document.getElementById("meCancelRunBtn").addEventListener("click", cancelRun);

    var stepInput = document.getElementById("meStepInput");
    if (stepInput) {
      stepInput.value = state.run.currentThought;
    }

    var updateBtn = document.getElementById("meUpdateThoughtBtn");
    if (updateBtn && stepInput) {
      updateBtn.addEventListener("click", function () {
        var value = normalizeText(stepInput.value);
        if (!value) return;
        state.run.currentThought = value;
        markComplete();
      });
    }

    var storeBtn = document.getElementById("meStoreAnswerBtn");
    if (storeBtn && stepInput) {
      storeBtn.addEventListener("click", function () {
        var value = normalizeText(stepInput.value);
        if (!value) return;
        if (step.variableName) {
          state.runtimeVariables[step.variableName] = value;
        }
        state.run.currentThought = value;
        state.run.steps = state.run.steps.map(function (s, index) {
          if (index <= state.run.stepIndex) return s;
          return Object.assign({}, s, {
            instruction: renderPlaceholders(s.instruction, state.run.launchContext, state.runtimeVariables)
          });
        });
        markComplete();
      });
    }
  }

  ui.composerInput.addEventListener("input", updateRoutingUI);

  ui.runCognihackBtn.addEventListener("click", function () {
    openPicker("cognihack");
  });

  ui.recipesBtn.addEventListener("click", function () {
    renderLibrary();
    ui.libraryDialog.showModal();
  });

  updateRoutingUI();
})();
