/* Progressive enhancement for the CV page.
   Everything here is optional: with JavaScript off the page still reads,
   prints, and shows every role. Guard every lookup — a page without these
   elements must not throw. */
(function () {
  "use strict";

  var CARD = "[data-period]";
  var FILTER = "[data-filter]";

  function announce(node, message) {
    if (!node) return;
    node.textContent = message;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(function () {
      node.textContent = "";
    }, 2400);
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(
        function () { return true; },
        function () { return legacyCopy(value); }
      );
    }
    return Promise.resolve(legacyCopy(value));
  }

  function legacyCopy(value) {
    var field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.className = "copy-field";
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(field);
    return ok;
  }

  function initCopy() {
    var button = document.querySelector("[data-copy]");
    var live = document.querySelector(".live");
    if (!button) return;

    button.hidden = false;
    button.addEventListener("click", function () {
      var value = button.getAttribute("data-copy") || "";
      if (!value) return;
      copyText(value).then(function (ok) {
        announce(live, ok ? "Email address copied." : "Could not copy — use the email link.");
      });
    });
  }

  function initPrint() {
    var button = document.querySelector("[data-print]");
    if (!button) return;
    button.hidden = false;
    button.addEventListener("click", function () {
      window.print();
    });
  }

  function initFilters() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(FILTER));
    var cards = Array.prototype.slice.call(document.querySelectorAll(CARD));
    var count = document.querySelector("[data-count]");
    var empty = document.querySelector("[data-empty]");
    if (!buttons.length || !cards.length) return;

    function apply(name) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = name === "all" || card.getAttribute("data-period") === name;
        card.hidden = !match;
        if (match) shown += 1;
      });
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-filter") === name));
      });
      if (count) {
        count.textContent = shown + " of " + cards.length;
      }
      if (empty) {
        empty.hidden = shown !== 0;
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        apply(button.getAttribute("data-filter") || "all");
      });
    });

    apply("all");
  }

  initCopy();
  initPrint();
  initFilters();
})();
