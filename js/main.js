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
  // desktop, each at its custom dragged spot if it has one, else its
  // default catalog position (see DECOR in catdata.js).
  function renderDecorOnDesktop() {
    endDecorMove(); // a rebuild mid-drag would otherwise leave stale state
    const layer = document.getElementById("decor-layer");
    layer.innerHTML = "";
    const state = StreakManager.get();
    state.placedDecor.forEach((id) => {
      const item = DECOR[id];
      if (!item) return;
      const el = document.createElement("div");
      el.className = "decor-placed";
      el.textContent = item.glyph;
      el.title = "Double-click to move";
      el.style.left = el.style.right = el.style.top = el.style.bottom = "";
      Object.assign(el.style, state.decorPositions[id] || item.pos);
      layer.appendChild(el);
      wireDecorItemDrag(el, id);
    });
  }

  // ---- Decor drag-to-reposition: double-click to enter "move" mode, drag
  // it around, then tap the confirm button to lock in the new spot. ------

  let movingDecorId = null;
  let decorConfirmBtn = null;

  function endDecorMove() {
    if (decorConfirmBtn) { decorConfirmBtn.remove(); decorConfirmBtn = null; }
    if (movingDecorId) {
      const el = document.querySelector(`.decor-placed[data-decor-id="${movingDecorId}"]`);
      if (el) el.classList.remove("moving");
    }
    movingDecorId = null;
  }

  function confirmDecorMove(id, el) {
    const rect = el.getBoundingClientRect();
    StreakManager.setDecorPosition(id, { left: Math.round(rect.left) + "px", top: Math.round(rect.top) + "px" });
    endDecorMove();
  }

  function startDecorMove(id, el) {
    if (movingDecorId && movingDecorId !== id) endDecorMove(); // only one piece moves at a time
    movingDecorId = id;
    el.classList.add("moving");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "decor-confirm-btn";
    btn.textContent = "✓ Place here";
    document.getElementById("decor-layer").appendChild(btn);
    decorConfirmBtn = btn;

    const positionBtn = () => {
      const rect = el.getBoundingClientRect();
      btn.style.left = Math.round(rect.left + rect.width / 2) + "px";
      btn.style.top = Math.round(rect.bottom + 10) + "px";
    };
    positionBtn();
    el._positionConfirmBtn = positionBtn;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDecorMove(id, el);
    });
  }

  function wireDecorItemDrag(el, id) {
    el.dataset.decorId = id;
    let dragging = false, offsetX = 0, offsetY = 0;

    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startDecorMove(id, el);
    });

    el.addEventListener("pointerdown", (e) => {
      if (movingDecorId !== id) return; // only draggable once in move mode
      dragging = true;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      el.style.left = Math.round(e.clientX - offsetX) + "px";
      el.style.top = Math.round(e.clientY - offsetY) + "px";
      el.style.right = el.style.bottom = "";
      if (el._positionConfirmBtn) el._positionConfirmBtn();
    });
    const endPointerDrag = () => { dragging = false; };
    el.addEventListener("pointerup", endPointerDrag);
    el.addEventListener("pointercancel", endPointerDrag);
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
