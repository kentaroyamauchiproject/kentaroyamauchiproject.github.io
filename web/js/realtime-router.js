"use strict";

/**
 * Browser port of MindEntry/RealtimeRouter.swift (phrase-first scoring).
 */
window.MindEntryRealtimeRouter = (function () {
  var keywords = window.MindEntryKeywordStore;

  var PHRASE_SCORE = 5;
  var KEYWORD_SCORE = 1;
  var BOOST_SCORE = 2;
  var CONFIDENCE_THRESHOLD = 3;
  var RECIPE_INTENT_THRESHOLD = 2;
  var MIN_SIDE_LENGTH = 3;

  var EMOTION_BOOST = ["embarrassed", "regret", "awkward", "cringe", "stupid", "shouldn't have", "恥ずかしい", "後悔"];
  var TASK_VERB_BOOST = ["call", "email", "send", "reply", "schedule", "buy", "book", "renew", "submit", "pay"];
  var TIME_REF_BOOST = ["yesterday", "last night", "earlier", "tomorrow", "next week", "next month", "next year", "later"];
  var OVERLOAD_BOOST = ["too much", "overwhelmed", "can't focus", "brain is full", "mind is noisy", "obsessively", "heart racing", "頭がいっぱい", "集中できない"];
  var ROLE_PRESSURE_BOOST = ["work", "boss", "client", "meeting", "deadline", "kids", "family", "responsibility", "pressure", "everyone needs me"];
  var BACKYARD_RESTLESS_BOOST = ["scroll", "scrolling", "restless", "wander", "wandering", "fidget", "procrastinat", "doomscroll", "antsy", "bored"];
  var EASE_RELEASE_BOOST = [
    "let go", "release", "move on", "put this down", "leave this behind", "detach", "need closure", "need relief",
    "clean break", "mental release", "emotional release", "done holding", "free mental space", "clear this from my head",
    "need to move on", "want to release"
  ];

  var INTENT_TIE_BREAK_PRIORITY = ["flip", "shout", "ease", "backyard", "back", "zone"];

  var SPLIT_CONJUNCTIONS = [
    " even though ", " although ", " though ", " but ", " and ", " because ",
    " でも ", " そして ", " なぜなら ", " 그리고 ", " aber ", " und ", " weil ", " mais ", " et ", " y "
  ];

  var APP_NAMES = {
    flip: "MindFlipOut",
    shout: "MindShoutOut",
    zone: "MindZoneOut",
    back: "MindBackOut",
    backyard: "MindBackyard",
    ease: "MindEaseOut",
    capture: "MindEntry"
  };

  function contains(text, needle) {
    return text.toLowerCase().indexOf(needle.toLowerCase()) >= 0;
  }

  function scoreApp(keywordList, text, boostKeywords) {
    var total = 0;
    keywordList.forEach(function (kw) {
      if (!contains(text, kw)) return;
      total += kw.indexOf(" ") >= 0 ? PHRASE_SCORE : KEYWORD_SCORE;
    });
    boostKeywords.forEach(function (bw) {
      if (contains(text, bw)) total += BOOST_SCORE;
    });
    return total;
  }

  function mentalInboxBoost(text) {
    var count = 0;
    if (text.indexOf("\n") >= 0) count += 1;
    if (/\d+[\.\)]\s/.test(text)) count += 2;
    if (/[•\-]\s/.test(text)) count += 2;
    var commas = (text.match(/,/g) || []).length;
    if (commas >= 2) count += 1;
    return Math.min(count, 3);
  }

  function scoreAllApps(lower) {
    return {
      flip: scoreApp(keywords.mfo, lower, EMOTION_BOOST),
      shout: scoreApp(keywords.mso, lower, TASK_VERB_BOOST) + mentalInboxBoost(lower),
      zone: scoreApp(keywords.mzo, lower, OVERLOAD_BOOST),
      back: scoreApp(keywords.mbo, lower, ROLE_PRESSURE_BOOST),
      ease: scoreApp(keywords.meo, lower, TIME_REF_BOOST.concat(EASE_RELEASE_BOOST)),
      backyard: scoreApp(keywords.backyard, lower, BACKYARD_RESTLESS_BOOST)
    };
  }

  function bestScoringIntent(scores, lower) {
    var values = Object.keys(scores).map(function (k) { return scores[k]; });
    var maxScore = Math.max.apply(null, values.concat([0]));
    if (maxScore <= 0) return null;

    var tied = Object.keys(scores).filter(function (k) { return scores[k] === maxScore; });
    if (tied.indexOf("flip") >= 0 && tied.indexOf("ease") >= 0 &&
        EASE_RELEASE_BOOST.some(function (b) { return contains(lower, b); })) {
      return { key: "ease", value: maxScore };
    }
    for (var i = 0; i < INTENT_TIE_BREAK_PRIORITY.length; i += 1) {
      var intent = INTENT_TIE_BREAK_PRIORITY[i];
      if (tied.indexOf(intent) >= 0) return { key: intent, value: maxScore };
    }
    return { key: tied[0], value: maxScore };
  }

  function detectSplitThought(text) {
    var lower = text.toLowerCase();
    for (var i = 0; i < SPLIT_CONJUNCTIONS.length; i += 1) {
      var conj = SPLIT_CONJUNCTIONS[i];
      var pos = lower.indexOf(conj);
      if (pos < 0) continue;
      var before = text.slice(0, pos).trim();
      var after = text.slice(pos + conj.length).trim();
      if (before.length >= MIN_SIDE_LENGTH && after.length >= MIN_SIDE_LENGTH) {
        return { heavy: before, light: after };
      }
    }
    return null;
  }

  function detectRecipeFromScores(scores) {
    var flip = scores.flip || 0;
    var shout = scores.shout || 0;
    var zone = scores.zone || 0;
    var back = scores.back || 0;
    var ease = scores.ease || 0;
    var backyard = scores.backyard || 0;
    function meets(v) { return v >= RECIPE_INTENT_THRESHOLD; }

    if (meets(flip) && meets(shout)) return shout >= flip ? ["shout", "flip"] : ["flip", "shout"];
    if (meets(flip) && meets(zone)) return zone >= flip ? ["zone", "flip"] : ["flip", "zone"];
    if (meets(shout) && meets(zone)) return zone >= shout ? ["zone", "shout"] : ["shout", "zone"];
    if (meets(backyard) && meets(zone)) return backyard >= zone ? ["backyard", "zone"] : ["zone", "backyard"];
    if (meets(back) && meets(zone)) return zone >= back ? ["zone", "back"] : ["back", "zone"];
    if (meets(flip) && meets(ease)) return ease >= flip ? ["ease", "flip"] : ["flip", "ease"];
    if (meets(flip) && meets(back)) return back >= flip ? ["back", "flip"] : ["flip", "back"];
    if (meets(shout) && meets(back)) return back >= shout ? ["back", "shout"] : ["shout", "back"];
    if (meets(shout) && meets(ease)) return ease >= shout ? ["ease", "shout"] : ["shout", "ease"];
    if (meets(ease) && meets(zone)) return zone >= ease ? ["zone", "ease"] : ["ease", "zone"];
    if (meets(back) && meets(ease)) return ease >= back ? ["ease", "back"] : ["back", "ease"];
    return null;
  }

  function radarLabel(intent) {
    switch (intent) {
      case "flip": return "Loop detected";
      case "shout": return "Open loop detected";
      case "zone": return "Mental overload detected";
      case "back": return "Role pressure detected";
      case "backyard": return "Restless attention detected";
      case "ease": return "Past event detected";
      default: return "Detected";
    }
  }

  function actionMessage(intent, recipe) {
    if (recipe && recipe.length >= 2) {
      var content = recipeCardContent(recipe);
      return content.headline + ". " + content.subtext + ".";
    }
    switch (intent) {
      case "flip": return "Loop detected. Try Flip.";
      case "shout": return "Open loop detected. Capture it and set a reminder.";
      case "zone": return "Mental overload detected. Give your mind some space.";
      case "back": return "Role pressure detected. Step into your backroom.";
      case "backyard": return "Restless attention detected. Wander somewhere low-stakes in MindBackyard.";
      case "ease": return "Past or future tension detected. Release what doesn't belong.";
      default: return "Tap to enter.";
    }
  }

  function actionMessageLong(intent) {
    switch (intent) {
      case "flip": return "Looping thought detected. Flip the thought and break the loop.";
      case "shout": return "Open loop detected. Capture it and set a reminder.";
      case "zone": return "Mental overload detected. Give your mind some space.";
      case "back": return "Role pressure detected. Step into your backroom.";
      case "backyard": return "Restless attention detected. Wander somewhere low-stakes in MindBackyard.";
      case "ease": return "Past or future tension detected. Release what doesn't belong in the present.";
      default: return "Tap to enter and give your mind some space.";
    }
  }

  function recipeStepLabel(intent) {
    if (intent.indexOf("action:") === 0) {
      return intent.slice("action:".length).trim();
    }
    switch (intent) {
      case "capture": return "MindEntry";
      case "updatethought": return "Update Current Thought";
      case "yourstep": return "Your Step";
      case "askstore": return "Ask Store";
      default: return APP_NAMES[intent] || intent;
    }
  }

  function recipeStepDescription(intent) {
    switch (intent) {
      case "capture": return "Capture or refine your thought in MindEntry";
      case "updatethought": return "Update your current thought";
      case "flip": return "Flip the looping thought";
      case "shout": return "Schedule tomorrow's task";
      case "zone": return "Clear your mind";
      case "back": return "Step into your backroom";
      case "backyard": return "Explore your backyard";
      case "ease": return "Release what's past";
      case "yourstep": return "Answer your step prompt";
      case "askstore": return "Answer the store question";
      default:
        return intent.indexOf("action:") === 0 ? recipeStepLabel(intent) : recipeStepLabel(intent);
    }
  }

  function recipeName(recipe) {
    var a = recipe[0] || "";
    var b = recipe[1] || "";
    var pair = [a, b].sort().join("|");
    var map = {
      "backyard|zone": "Wander and Reset",
      "flip|shout": "Clear Tomorrow",
      "flip|zone": "Break the Loop",
      "shout|zone": "Unload and Reset",
      "back|zone": "Step Back and Reset",
      "ease|flip": "Handle Regret",
      "back|flip": "Flip and Step Back",
      "back|shout": "Schedule and Reset",
      "ease|shout": "Bottle and Release",
      "ease|zone": "Release and Reset",
      "back|ease": "Step Back and Release"
    };
    if (map[pair]) return map[pair];
    return recipeStepLabel(a) + " then " + recipeStepLabel(b);
  }

  function recipeActionHint(recipe) {
    var pair = {};
    recipe.slice(0, 2).forEach(function (x) { pair[x] = true; });
    if (pair.flip && pair.shout) return "Splash cold water on your face. Make eye contact with yourself in the mirror. Then Flip → Schedule.";
    if (pair.flip && pair.zone) return "Stand up straight, roll your shoulders back. Zone first to calm, then Flip.";
    if (pair.shout && pair.zone) return "Place your phone in another room. Then Schedule → Zone.";
    if (pair.flip && pair.ease) return "Take a piece of sour candy first. Pause 5–10 seconds, then Flip → Ease.";
    if (pair.flip && pair.back) return "Step into your backroom first. Then Flip the loop.";
    if (pair.shout && pair.ease) return "Engage in a sensory activity (cooking, gardening, or a walk). Then Schedule → Ease.";
    if (pair.ease && pair.zone) return "Release what's past first. Then Zone to clear the slate.";
    if (pair.back && pair.zone) return "Step back into your backroom. Then Zone to reset.";
    if (pair.shout && pair.back) return "Schedule the task. Then step into your backroom.";
    if (pair.back && pair.ease) return "Step back first. Then release what's past.";
    return null;
  }

  function recipeCardContent(recipe) {
    var a = recipe[0] || "";
    var b = recipe[1] || "";
    var key = a + "|" + b;
    var alt = b + "|" + a;
    var table = {
      "flip|zone": { title: "Suggested reset", headline: "Flip the loop", subtext: "Then clear your mind" },
      "zone|flip": { title: "Suggested reset", headline: "Flip the loop", subtext: "Then clear your mind" },
      "shout|zone": { title: "Suggested Recipe", headline: "Capture the task", subtext: "Then clear your mind" },
      "zone|shout": { title: "Suggested Recipe", headline: "Capture the task", subtext: "Then clear your mind" },
      "back|zone": { title: "Suggested Recipe", headline: recipeStepLabel("back"), subtext: "Then reset" },
      "zone|back": { title: "Suggested Recipe", headline: recipeStepLabel("back"), subtext: "Then reset" },
      "flip|ease": { title: "Suggested Recipe", headline: "Flip the loop", subtext: "Then release what's past" },
      "ease|flip": { title: "Suggested Recipe", headline: "Flip the loop", subtext: "Then release what's past" },
      "flip|back": { title: "Suggested Recipe", headline: "Flip the loop", subtext: "Then step into your backroom" },
      "back|flip": { title: "Suggested Recipe", headline: "Flip the loop", subtext: "Then step into your backroom" },
      "shout|ease": { title: "Suggested Recipe", headline: "Bottle the worries", subtext: "Then release the guilt" },
      "ease|shout": { title: "Suggested Recipe", headline: "Bottle the worries", subtext: "Then release the guilt" },
      "ease|zone": { title: "Suggested Recipe", headline: "Release what's past", subtext: "Then clear your mind" },
      "zone|ease": { title: "Suggested Recipe", headline: "Release what's past", subtext: "Then clear your mind" },
      "back|ease": { title: "Suggested Recipe", headline: recipeStepLabel("back"), subtext: "Then release" },
      "ease|back": { title: "Suggested Recipe", headline: recipeStepLabel("back"), subtext: "Then release" }
    };
    return table[key] || table[alt] || {
      title: "Suggested Recipe",
      headline: recipeStepLabel(a),
      subtext: "then " + recipeStepLabel(b).toLowerCase()
    };
  }

  function route(text) {
    var trimmed = (text || "").trim();
    if (trimmed.length < 8) return null;

    var lower = trimmed.toLowerCase();
    var scores = scoreAllApps(lower);

    var recipe = detectRecipeFromScores(scores);
    if (recipe) {
      var content = recipeCardContent(recipe);
      return {
        primaryIntent: recipe[0],
        recipe: recipe,
        isFallback: false,
        isSplitThought: false,
        heavyText: null,
        lightText: null,
        actionMessage: content.headline + ". " + content.subtext + ".",
        score: scores[recipe[0]] || 0
      };
    }

    var split = detectSplitThought(trimmed);
    if (split) {
      return {
        primaryIntent: "flip",
        recipe: ["flip"],
        isFallback: false,
        isSplitThought: true,
        heavyText: split.heavy,
        lightText: split.light,
        actionMessage: "Split thought detected. Flip the heavy part first.",
        score: 10
      };
    }

    var best = bestScoringIntent(scores, lower);
    if (!best) {
      return {
        primaryIntent: null,
        recipe: [],
        isFallback: true,
        isSplitThought: false,
        heavyText: null,
        lightText: null,
        actionMessage: "Try Flip, Schedule, Zone, Back, or Backyard.",
        score: 0
      };
    }

    if (best.value < CONFIDENCE_THRESHOLD) {
      return {
        primaryIntent: null,
        recipe: [],
        isFallback: true,
        isSplitThought: false,
        heavyText: null,
        lightText: null,
        actionMessage: "Try Flip, Schedule, Zone, Back, or Backyard.",
        score: best.value
      };
    }

    var strong = Object.keys(scores)
      .filter(function (k) { return scores[k] >= CONFIDENCE_THRESHOLD; })
      .sort(function (a, b) { return scores[b] - scores[a]; });

    var recipeOut = strong.length >= 2 ? strong.slice(0, 2) : [best.key];

    return {
      primaryIntent: best.key,
      recipe: recipeOut,
      isFallback: false,
      isSplitThought: false,
      heavyText: null,
      lightText: null,
      actionMessage: actionMessage(best.key, recipeOut),
      score: best.value
    };
  }

  function radarDetections(text) {
    var trimmed = (text || "").trim();
    if (!trimmed || trimmed.length < 6) return null;

    var lower = trimmed.toLowerCase();
    var scores = scoreAllApps(lower);
    var above = Object.keys(scores)
      .filter(function (k) { return scores[k] >= CONFIDENCE_THRESHOLD; })
      .sort(function (a, b) { return scores[b] - scores[a]; });

    if (!above.length) {
      var best = bestScoringIntent(scores, lower);
      if (best && best.value > 0) return { detections: [], isFallback: true };
      return null;
    }

    return {
      detections: above.map(function (intent) {
        return { label: radarLabel(intent), intent: intent };
      }),
      isFallback: false
    };
  }

  function appName(intent) {
    return APP_NAMES[intent] || "";
  }

  return {
    route: route,
    radarDetections: radarDetections,
    actionMessage: actionMessage,
    actionMessageLong: actionMessageLong,
    recipeName: recipeName,
    recipeStepLabel: recipeStepLabel,
    recipeStepDescription: recipeStepDescription,
    recipeActionHint: recipeActionHint,
    recipeCardContent: recipeCardContent,
    appName: appName,
    detectRecipe: function (text) {
      var trimmed = (text || "").trim();
      if (trimmed.length < 12) return null;
      return detectRecipeFromScores(scoreAllApps(trimmed.toLowerCase()));
    }
  };
})();
