/*
 * Native desktop-pet mode — only active inside the Pawprint Mac app
 * (macos/), which sets window.PAWPRINT_NATIVE before the page loads. In a
 * normal browser this file does nothing and the prototype runs as before.
 *
 * In the Mac app the page fills a see-through, always-on-top overlay that
 * covers your real desktop. Clicks pass straight through it to whatever is
 * underneath, except over a cat (or its buttons, boards, toys, decor and
 * the control panel). This file is the page's half of that:
 *
 *  - hides the fake menu bar, dock, desktop icons and wallpaper;
 *  - tells the app where the clickable bits are, so it can decide, as the
 *    mouse moves, whether the overlay should catch the click or let it
 *    through;
 *  - takes the real mouse position from the app (the page can't see the
 *    mouse while clicks are passing through) and replays hover enter/leave
 *    from it, so cats still glance at the cursor and hover menus still open;
 *  - takes the real windows on screen from the app, so cats perch on them;
 *  - gives the menu bar icon a few commands (open panel, hide, pause).
 */

(function () {
  if (!window.PAWPRINT_NATIVE) return;

  document.documentElement.classList.add("native");

  const bridge = () => window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pawprint;
  function post(msg) {
    try { const b = bridge(); if (b) b.postMessage(msg); } catch (e) { /* ignore */ }
  }

  // The floor is the bottom of the overlay (just above the Dock), leaving
  // room for the study-session label that hangs below a cat's feet.
  Cat.prototype.groundFootY = function () {
    return window.innerHeight - 40;
  };

  // ---- Hover, driven by the app's mouse position ---------------------------

  // WebKit only sees the mouse while the overlay is catching clicks, and an
  // inactive app's web view doesn't reliably get hover events at all, so
  // real pointerenter/pointerleave are dropped and replayed from the app's
  // mouse position instead. (Capture-phase listeners on window see these
  // events even though they don't bubble.)
  ["pointerenter", "pointerleave", "mouseenter", "mouseleave"].forEach((type) => {
    window.addEventListener(type, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
  });

  let mouseX = -9999, mouseY = -9999;
  let hoverChain = [];

  function fire(el, type) {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: false, cancelable: false, clientX: mouseX, clientY: mouseY,
      pointerType: "mouse", isPrimary: true, pointerId: 1,
    }));
  }

  function updateHover() {
    const target = document.elementFromPoint(mouseX, mouseY);
    const chain = [];
    for (let n = target; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    hoverChain.filter((el) => !chain.includes(el)).forEach((el) => fire(el, "pointerleave"));
    chain.filter((el) => !hoverChain.includes(el)).reverse().forEach((el) => fire(el, "pointerenter"));
    hoverChain = chain;
  }

  // ---- Clickable areas, reported to the app --------------------------------

  const HIT_SELECTOR = "#cats-layer *, #mess-layer *, #decor-layer *, #panel";
  const HIT_PAD = 4;

  function collectHitRects() {
    const included = new Set();
    const rects = [];
    document.querySelectorAll(HIT_SELECTOR).forEach((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (included.has(p)) return;
      const style = getComputedStyle(el);
      if (style.pointerEvents === "none" || style.visibility !== "visible" || Number(style.opacity) < 0.05) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      included.add(el);
      rects.push([
        Math.floor(r.left - HIT_PAD), Math.floor(r.top - HIT_PAD),
        Math.ceil(r.width + HIT_PAD * 2), Math.ceil(r.height + HIT_PAD * 2),
      ]);
    });
    return rects;
  }

  let lastSent = "";
  function reportHitRects() {
    const json = JSON.stringify(collectHitRects());
    if (json === lastSent) return;
    lastSent = json;
    post({ type: "hitRects", rects: json });
  }

  // Cats walk under a still cursor too, so hover and the clickable areas are
  // refreshed on a steady beat, not only when the mouse moves.
  setInterval(() => { updateHover(); reportHitRects(); }, 40);

  // ---- Called by the app ----------------------------------------------------

  window.PawprintNative = {
    mouse(x, y) {
      mouseX = x; mouseY = y;
      CatMouse.x = x; CatMouse.y = y;
      lastCursorActivityAt = performance.now();
      updateHover();
    },
    windows(list) {
      WindowManager.syncNative(list || []);
    },
    openPanel() {
      UI.openPanel();
    },
    togglePanel() {
      const open = document.getElementById("panel").classList.contains("open");
      if (open) UI.closePanel(); else UI.openPanel();
    },
    toggleHidden() {
      StreakManager.setSetting("hidden", !StreakManager.get().settings.hidden);
      UI.renderAll();
      return this.status();
    },
    togglePaused() {
      StreakManager.setSetting("paused", !StreakManager.get().settings.paused);
      UI.renderAll();
      return this.status();
    },
    status() {
      const s = StreakManager.get().settings;
      return { hidden: !!s.hidden, paused: !!s.paused };
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    // main.js's own DOMContentLoaded handler runs first (it's registered
    // earlier), so the UI is ready by now.
    setTimeout(() => {
      UI.toast("Pawprint is running — click 🐾 in the menu bar to open the panel.", { icon: "🐾" });
      post({ type: "ready" });
    }, 600);
  });
})();
