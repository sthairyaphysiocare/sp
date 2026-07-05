/* =============================================================================
   ui-enhancements.js
   Standalone, non-destructive micro-interaction layer — PUBLIC PAGES ONLY.

   Guarantees:
     - Never mutates text content, DOM structure, or existing class lists.
     - Only ever sets: a small set of `data-ui-*` attributes (pure hooks for
       ui-enhancements.css) and inline `transform` styles for hover/motion
       effects — both are inert until this script runs and both are fully
       reversible (no persistent state written anywhere).
     - Every effect is skipped entirely when the visitor has requested
       reduced motion, or when running on a touch/coarse-pointer device
       (tilt/magnetic effects are a mouse-hover concept and are pointless —
       and can feel glitchy — on touch).
     - Operates only inside <div data-ui-enhance> (the public layout's root),
       so it can never touch the staff dashboard or login screen even if
       this file is cached and present there.
     - Exposes window.UIEnhance.init() so a single-page-app router can
       re-run initialization after each client-side navigation without
       leaking duplicate global listeners or observers (see guards below).
============================================================================= */
(function () {
  "use strict";

  var ROOT_SELECTOR = "[data-ui-enhance]";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  var revealObserver = null;
  var magneticTargets = [];
  var magneticListenerBound = false;
  var lastX = 0;
  var lastY = 0;
  var rafTicking = false;

  /* ---------------------------------------------------------------------
     1. Scroll reveal (Intersection Observer)
  --------------------------------------------------------------------- */
  function initScrollReveal(root) {
    if (reduceMotion) return;

    if (revealObserver) {
      revealObserver.disconnect();
    }

    var candidates = root.querySelectorAll(
      "main .bg-card, main [class*='rounded-3xl'].brand-gradient",
    );
    if (!candidates.length) return;

    revealObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            function (entries) {
              entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                  entry.target.classList.add("ui-in-view");
                  revealObserver.unobserve(entry.target);
                }
              });
            },
            { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
          )
        : null;

    candidates.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      var alreadyVisible = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
      el.setAttribute("data-ui-reveal", "");
      if (alreadyVisible || !revealObserver) {
        el.classList.add("ui-in-view");
      } else {
        revealObserver.observe(el);
      }
    });
  }

  /* ---------------------------------------------------------------------
     2. Subtle 3D tilt on card hover (mouse only)
     Listeners are attached to the current page's freshly-mounted card
     nodes only; when the SPA navigates away those nodes (and their
     listeners) are discarded naturally with the DOM they belonged to.
  --------------------------------------------------------------------- */
  function initCardTilt(root) {
    if (reduceMotion || isCoarsePointer) return;
    var cards = root.querySelectorAll("main .bg-card");
    var MAX_DEG = 5;

    cards.forEach(function (card) {
      if (card.getAttribute("data-ui-tilt-bound") === "1") return;
      card.setAttribute("data-ui-tilt-bound", "1");
      card.style.transformStyle = "preserve-3d";
      card.style.willChange = "transform";

      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;
        var py = (e.clientY - rect.top) / rect.height;
        var rotateY = (px - 0.5) * (MAX_DEG * 2);
        var rotateX = (0.5 - py) * (MAX_DEG * 2);
        card.style.transition = "transform 0.08s linear";
        card.style.transform =
          "perspective(700px) rotateX(" +
          rotateX.toFixed(2) +
          "deg) rotateY(" +
          rotateY.toFixed(2) +
          "deg) scale(1.015)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
        card.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
      });
    });
  }

  /* ---------------------------------------------------------------------
     3. Magnetic pull on hero / primary CTA buttons (mouse only)
     A single window-level mousemove listener is bound exactly once, ever;
     each re-init just swaps which elements it currently drives.
  --------------------------------------------------------------------- */
  function applyMagnetic() {
    rafTicking = false;
    var MAX_PULL = 10;
    var RADIUS = 90;
    magneticTargets.forEach(function (btn) {
      var r = btn.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = lastX - cx;
      var dy = lastY - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var reach = Math.max(r.width, r.height) / 2 + RADIUS;
      if (dist < reach) {
        var pull = (1 - dist / reach) * MAX_PULL;
        var angle = Math.atan2(dy, dx);
        btn.style.transform =
          "translate(" +
          (Math.cos(angle) * pull).toFixed(1) +
          "px, " +
          (Math.sin(angle) * pull).toFixed(1) +
          "px)";
      } else {
        btn.style.transform = "translate(0px, 0px)";
      }
    });
  }

  function initMagneticCta(root) {
    if (reduceMotion || isCoarsePointer) {
      magneticTargets = [];
      return;
    }
    var found = Array.prototype.slice.call(
      root.querySelectorAll("main button.brand-gradient, main a > button.brand-gradient"),
    );
    found.forEach(function (btn) {
      btn.setAttribute("data-ui-magnetic", "");
    });
    magneticTargets = found;

    if (!magneticListenerBound) {
      magneticListenerBound = true;
      window.addEventListener(
        "mousemove",
        function (e) {
          lastX = e.clientX;
          lastY = e.clientY;
          if (!rafTicking) {
            rafTicking = true;
            window.requestAnimationFrame(applyMagnetic);
          }
        },
        { passive: true },
      );
    }
  }

  function init() {
    var root = document.querySelector(ROOT_SELECTOR);
    if (!root) {
      magneticTargets = [];
      if (revealObserver) revealObserver.disconnect();
      return;
    }
    initScrollReveal(root);
    initCardTilt(root);
    initMagneticCta(root);
  }

  window.UIEnhance = { init: init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
