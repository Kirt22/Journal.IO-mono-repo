/* Journal.IO marketing site — motion and interaction.
   No dependencies. Everything degrades to a fully readable static page. */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Arm the reveal styles only now that JS is running. If this file fails to
     load, `.js` is never set and nothing is ever hidden. */
  if (!reduceMotion.matches) {
    document.documentElement.classList.add("js");
  }

  /* ---------------------------------------------------------------- nav --- */

  var nav = document.getElementById("nav");
  var burger = document.querySelector(".nav__burger");
  var sheet = document.getElementById("nav-sheet");

  if (nav) {
    var setStuck = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 24);
    };
    setStuck();
    window.addEventListener("scroll", setStuck, { passive: true });
  }

  if (burger && sheet) {
    sheet.hidden = false;

    var setMenu = function (open) {
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
    };

    burger.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });

    sheet.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });

    // a resize past the breakpoint should not leave the body scroll-locked
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) setMenu(false);
    });
  }

  /* ------------------------------------------------------------- reveal --- */

  var revealables = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));

  function revealAll() {
    revealables.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    revealAll();
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    revealables.forEach(function (el) {
      observer.observe(el);
    });

    /* Belt and braces. Hiding content behind an observer means any case the
       observer misses is a blank screen — landing on /#privacy from a legal
       page footer is the obvious one. So: sweep whatever is already on screen
       ourselves, re-sweep after a fragment jump, and give up and show
       everything if we are somehow still hiding things a few seconds in. */
    var sweep = function () {
      var viewport = window.innerHeight || document.documentElement.clientHeight;
      revealables.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        var rect = el.getBoundingClientRect();
        if (rect.top < viewport && rect.bottom > 0) {
          el.classList.add("is-in");
          observer.unobserve(el);
        }
      });
    };

    var sweepQueued = false;
    var queueSweep = function () {
      if (sweepQueued) return;
      sweepQueued = true;
      window.requestAnimationFrame(function () {
        sweepQueued = false;
        sweep();
      });
    };

    queueSweep();
    window.addEventListener("load", queueSweep);
    window.addEventListener("scroll", queueSweep, { passive: true });
    window.addEventListener("resize", queueSweep, { passive: true });
    window.addEventListener("hashchange", function () {
      window.setTimeout(sweep, 400);
    });
    // fonts changing metrics can move things into view after first paint
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(queueSweep);
    }
    window.setTimeout(revealAll, 3500);
  }

  /* ------------------------------------------------------ device motion --- */
  /* Everything scroll-linked on the phone frames shares one rAF-throttled pass:
     the hero device rising out of the horizon, and the drift + fade on the
     rest. All of it is an enhancement — CSS alone leaves every frame in a
     correct, fully visible resting state. */

  var parallaxed = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var heroDevice = document.querySelector(".hero__device .device");
  var ticking = false;

  /* px of scroll to take the hero phone from fully sunk below the line to
     fully risen. Driven off scrollY rather than the line's viewport position
     so the resting state at scroll 0 is the same on every viewport height. */
  var RISE_RANGE = 420;

  function applyRise() {
    if (!heroDevice) return;
    var p = Math.min(1, Math.max(0, window.scrollY / RISE_RANGE));
    heroDevice.style.setProperty("--rise-p", (1 - p).toFixed(3));
  }

  /* A slow drift on the device frames. Deliberately small — 40px total — so it
     reads as depth rather than as an effect. The fade alongside it is what
     makes a frame feel like it arrives and leaves rather than just sitting
     there; it is written to .device so the coral glow fades with the phone. */
  function applyDrift() {
    var viewport = window.innerHeight;

    parallaxed.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > viewport + 200) return;

      // -1 when the element is entering from the bottom, 1 when leaving the top
      var progress = (viewport / 2 - (rect.top + rect.height / 2)) / viewport;
      el.style.transform = "translate3d(0," + (progress * -40).toFixed(2) + "px,0)";

      // full opacity through the middle of the viewport, 0.4 at either edge
      var distance = Math.min(1, Math.abs(progress) / 0.42);
      el.style.opacity = (1 - distance * 0.6).toFixed(3);
    });
  }

  /* the drift is desktop-only, as it always has been; the rise runs everywhere,
     since the hero fills the screen on a phone and that is where it reads best */
  var drifting = parallaxed.length > 0 && window.innerWidth > 860;

  function applyDeviceMotion() {
    ticking = false;
    applyRise();
    if (drifting) applyDrift();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(applyDeviceMotion);
  }

  if (!reduceMotion.matches && (heroDevice || drifting)) {
    applyDeviceMotion();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(
      "resize",
      function () {
        // crossing the breakpoint should start or stop the drift, not strand it
        var wasDrifting = drifting;
        drifting = parallaxed.length > 0 && window.innerWidth > 860;
        if (wasDrifting && !drifting) {
          parallaxed.forEach(function (el) {
            el.style.transform = "";
            el.style.opacity = "";
          });
        }
        onScroll();
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------- themes --- */
  /* The palette swatches recolour the mock beside them using the app's real
     token values, which live on each button as data attributes. */

  var themeList = document.getElementById("themes-list");
  var preview = document.getElementById("theme-preview");

  if (themeList && preview) {
    var section = themeList.closest(".themes");

    var applyTheme = function (button) {
      var data = button.dataset;
      preview.style.setProperty("--prev-bg", data.bg);
      preview.style.setProperty("--prev-card", data.card);
      preview.style.setProperty("--prev-primary", data.primary);
      preview.style.setProperty("--prev-secondary", data.secondary);
      preview.style.setProperty("--prev-muted", data.muted);
      preview.style.setProperty("--prev-border", data.border);
      preview.classList.toggle("is-dark", data.dark === "true");
      if (section) section.style.setProperty("--swatch-accent", data.primary);

      themeList.querySelectorAll(".swatch").forEach(function (other) {
        other.removeAttribute("aria-current");
      });
      button.setAttribute("aria-current", "true");
    };

    themeList.addEventListener("click", function (event) {
      var button = event.target.closest(".swatch");
      if (button) applyTheme(button);
    });

    // hovering previews without committing selection state feels better on
    // desktop; touch devices only ever see the click path
    if (window.matchMedia("(hover: hover)").matches) {
      themeList.addEventListener("mouseover", function (event) {
        var button = event.target.closest(".swatch");
        if (button) applyTheme(button);
      });
    }

    var initial = themeList.querySelector('.swatch[aria-current="true"]');
    if (initial) applyTheme(initial);
  }
})();
