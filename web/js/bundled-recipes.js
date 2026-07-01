"use strict";

/**
 * In-memory bundled starter recipes (English), aligned with BundledStarterRecipes.swift.
 */
window.MindEntryBundledRecipes = (function () {
  function partnerStep(intent) {
    var apps = {
      flip: "MindFlipOut",
      shout: "MindShoutOut",
      zone: "MindZoneOut",
      back: "MindBackOut",
      backyard: "MindBackyard",
      ease: "MindEaseOut"
    };
    var app = apps[intent];
    if (!app) return null;
    return {
      type: "external",
      intent: intent,
      app: app,
      title: window.MindEntryRealtimeRouter.recipeStepLabel(intent),
      instruction: window.MindEntryRealtimeRouter.recipeStepDescription(intent)
    };
  }

  function actionStep(instruction, title) {
    return {
      type: "action",
      app: "MindEntry",
      title: title || "Action",
      instruction: instruction
    };
  }

  function askStoreStep(prompt, variableName) {
    return {
      type: "askstore",
      app: "MindEntry",
      title: "Ask Store",
      runtimePrompt: prompt,
      variableName: variableName,
      displayAnswer: false
    };
  }

  var RECIPES = [
    {
      id: "d004-first-move",
      name: "The First Move",
      kind: "cognihack",
      source: "bundled",
      situation: "When you know what to do but can't start.",
      supportedMindEvents: ["feeling_stuck", "deep_work_interrupted"],
      steps: [
        actionStep("Put both feet firmly on the floor.", "Tiny Start"),
        actionStep("Touch the nearest physical object.", "Tiny Start"),
        askStoreStep("What are you avoiding right now?", "targetTask"),
        actionStep("For the next few moments,\nonly this matters:\n\n{{targetTask}}"),
        actionStep("Move one step closer to:\n\n{{targetTask}}\n\nDo not start the whole task yet.\n\nSimply make the task easier to begin."),
        askStoreStep("What is the smallest visible action you can take right now?", "firstMove"),
        actionStep("Do only this:\n\n{{firstMove}}"),
        actionStep("Once it is done, stop.\nYou have already begun.")
      ]
    },
    {
      id: "d001-stop-a-loop",
      name: "Stop a Loop",
      kind: "recipe",
      source: "bundled",
      situation: "A thought keeps repeating.",
      steps: [partnerStep("flip"), partnerStep("zone")]
    },
    {
      id: "d002-clear-a-task",
      name: "Clear a Task",
      kind: "recipe",
      source: "bundled",
      situation: "You keep thinking about something unfinished.",
      steps: [partnerStep("shout"), partnerStep("flip")]
    },
    {
      id: "d003-reset-attention",
      name: "Reset Attention",
      kind: "recipe",
      source: "bundled",
      situation: "Your mind feels overloaded.",
      steps: [partnerStep("zone")]
    },
    {
      id: "d005-post-meeting-reset",
      name: "Post Meeting Reset",
      kind: "recipe",
      source: "bundled",
      situation: "After a meeting or presentation ends and you need to clear the residue.",
      supportedMindEvents: ["meeting_finished", "presentation_finished"],
      steps: [partnerStep("flip"), partnerStep("zone")]
    },
    {
      id: "d006-waiting-for-reply",
      name: "Waiting for a Reply",
      kind: "recipe",
      source: "bundled",
      situation: "You're waiting on a reply and keep checking for it.",
      supportedMindEvents: ["waiting_for_reply"],
      steps: [
        partnerStep("zone"),
        actionStep("Physically place your phone in another room.")
      ]
    }
  ];

  function all() {
    return RECIPES.slice();
  }

  function byId(id) {
    return RECIPES.find(function (r) { return r.id === id; }) || null;
  }

  function intentsSignature(recipe) {
    return recipe.steps.map(function (step) {
      if (step.intent) return step.intent;
      if (step.type === "action") return "action";
      if (step.type === "askstore") return "askstore";
      if (step.type === "capture") return "capture";
      if (step.type === "updatethought") return "updatethought";
      return step.type;
    });
  }

  function matchBundledByDetectedRecipe(detectedRecipe) {
    if (!detectedRecipe || detectedRecipe.length < 1) return [];
    return RECIPES.filter(function (recipe) {
      if (recipe.kind !== "recipe") return false;
      var sig = intentsSignature(recipe).slice(0, detectedRecipe.length);
      return sig.join("|") === detectedRecipe.join("|");
    });
  }

  function recommendForEntryText(text) {
    var trimmed = (text || "").trim();
    if (!trimmed) return [];

    var detected = window.MindEntryRealtimeRouter.detectRecipe(trimmed);
    if (detected && detected.length) {
      var exact = matchBundledByDetectedRecipe(detected);
      if (exact.length) return exact;

      var scored = RECIPES
        .filter(function (recipe) { return recipe.kind === "recipe"; })
        .map(function (recipe) {
          var sig = intentsSignature(recipe);
          var overlap = detected.filter(function (intent) { return sig.indexOf(intent) >= 0; }).length;
          return { recipe: recipe, overlap: overlap };
        })
        .filter(function (item) { return item.overlap > 0; })
        .sort(function (a, b) { return b.overlap - a.overlap; });

      if (scored.length) {
        return scored.slice(0, 2).map(function (item) { return item.recipe; });
      }
    }

    var lower = trimmed.toLowerCase();
    return RECIPES.filter(function (recipe) {
      return recipe.situation && lower.indexOf(recipe.situation.toLowerCase().slice(0, 12)) >= 0;
    }).slice(0, 2);
  }

  return {
    all: all,
    byId: byId,
    recommendForEntryText: recommendForEntryText,
    intentsSignature: intentsSignature
  };
})();
