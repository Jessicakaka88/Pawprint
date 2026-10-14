/* App bootstrap: wires windows, cats, UI, and the animation loop together. */

(function () {
  const cats = {};

  const world = {
    getSettings: () => StreakManager.get().settings,
    getWindowRects: () => WindowManager.visibleRects(),
    getEquipped: (catId) => StreakManager.get().equipped[catId] || [],
    onPat: (catId) => {
      const result = StreakManager.recordPat();
      UI.onPatResult(result);
      return result;
    },
    toast: (message, opts) => UI.toast(message, opts),
    openClosetFor: (catId) => UI.openClosetFor(catId),
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
    UI.init({ onRosterChangeCb: syncActiveCats });
    syncActiveCats();
    tickClock();
    setInterval(tickClock, 15000);
    requestAnimationFrame(loop);

    window.addEventListener("resize", () => {
      Object.values(cats).forEach((cat) => {
        cat.footY = Math.min(cat.footY, cat.groundFootY());
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
