"use strict";

(function () {
  var visitState = window.__mindbebopWelcomeVisit;
  if (!visitState) {
    visitState = {
      hasSeenWelcome: false
    };
    window.__mindbebopWelcomeVisit = visitState;
  }

  function dismissWelcome(dialog) {
    visitState.hasSeenWelcome = true;
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    }
  }

  function initWelcome() {
    var dialog = document.getElementById("mbWelcomeDialog");
    var startBtn = document.getElementById("mbWelcomeStartBtn");
    var dismissBtn = document.getElementById("mbWelcomeDismissBtn");
    if (!dialog || !startBtn || !dismissBtn) {
      return;
    }

    if (visitState.hasSeenWelcome) {
      dialog.hidden = true;
      return;
    }

    startBtn.addEventListener("click", function () {
      dismissWelcome(dialog);
    });
    dismissBtn.addEventListener("click", function () {
      dismissWelcome(dialog);
    });

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "open");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWelcome);
  } else {
    initWelcome();
  }
})();
