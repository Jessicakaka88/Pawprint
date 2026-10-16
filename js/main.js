/* App bootstrap: wires windows, cats, UI, and the animation loop together. */

(function () {
  const cats = {};

  const world = {
    getSettings: () => StreakManager.get().settings,
    getWindowRects: () => WindowManager.visibleRects(),
    getEquipped: (catId) => StreakManager.get().equipped[catId] || [],
    toast: (message, opts) => UI.toast(message, opts),
    toggleEquip: (catId, accessoryId) => StreakManager.toggleEquip(catId, accessoryId),
    getUnlockedToys: () => StreakManager.get().unlockedToys,
    getUnlockedFoods: () => StreakManager.get().unlockedFoods,
  };

  function syncActiveCats() {
    const state = StreakManager.get();
    state.activeCats.forEach((id) => {
      if (!cats[id] && CAT_CATALOG.find((c) => c.id === id)) {
        const def = CAT_CATALOG.find((c) => c.id === id);
        cats[id] = new Cat(def, world);
      }
    });
    Object.keys(cats).forEach((id) => {
      if (!state.activeCats.includes(id)) {
        cats[id].destroy();
        delete cats[id];
      }
    });
  }

  function tickClock() {
    const el = document.getElementById("menubar-clock");
    const d = new Date();
    el.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // Renders whichever unlocked decor pieces are currently "placed" onto the
  // desktop at their fixed spots (see DECOR in catdata.js).
  function renderDecorOnDesktop() {
    const layer = document.getElementById("decor-layer");
    layer.innerHTML = "";
    StreakManager.get().placedDecor.forEach((id) => {
      const item = DECOR[id];
      if (!item) return;
      const el = document.createElement("div");
      el.className = "decor-placed";
      el.textContent = item.glyph;
      Object.assign(el.style, item.pos);
      layer.appendChild(el);
    });
  }

  // Keeps a running count-down session honest even if the Study tab isn't
  // open, and refreshes the live timer text while it is.
  function tickStudySession() {
    const result = StreakManager.tickSession();
    if (result) {
      UI.onSessionFinished(result);
    } else {
      UI.renderStudy();
    }
  }

  function wireDock() {
    document.querySelectorAll(".dock-icon[data-app]").forEach((icon) => {
      icon.addEventListener("click", () => WindowManager.create(icon.dataset.app));
    });
  }

  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min(64, now - lastT);
    lastT = now;
    Object.values(cats).forEach((cat) => cat.update(now, dt));
    requestAnimationFrame(loop);
  }

  function init() {
    WindowManager.init();
    wireDock();
    UI.init({ onRosterChangeCb: () => { syncActiveCats(); renderDecorOnDesktop(); } });
    syncActiveCats();
    renderDecorOnDesktop();
    tickClock();
    setInterval(tickClock, 15000);
    setInterval(tickStudySession, 1000);
    requestAnimationFrame(loop);

    window.addEventListener("resize", () => {
      Object.values(cats).forEach((cat) => {
        cat.footY = Math.min(cat.footY, cat.groundFootY());
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
