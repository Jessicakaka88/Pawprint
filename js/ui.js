/* Control panel: cat roster, study tab (session controls, points, log),
   decor tab, settings, toasts. (Closet is now a floating board on each cat
   itself — see js/cat.js.) */

const UI = (() => {
  let onRosterChange = () => {};
  // Pending session choices, before a session actually starts.
  let pendingKind = "study";
  let pendingMode = "countup";

  function toast(message, { milestone = false, icon = "🐾" } = {}) {
    const stack = document.getElementById("toast-stack");
    const el = document.createElement("div");
    el.className = "toast" + (milestone ? " milestone" : "");
    el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 260);
    }, milestone ? 4200 : 2600);
  }

  // The panel behaves like a normal floating app window: centered the first
  // time it opens, then it stays wherever it was last dragged to.
  function centerPanelIfNeeded() {
    const panel = document.getElementById("panel");
    if (panel.dataset.positioned) return;
    const w = panel.offsetWidth || 340;
    const h = panel.offsetHeight || 520;
    panel.style.left = Math.max(20, Math.round((window.innerWidth - w) / 2)) + "px";
    panel.style.top = Math.max(40, Math.round((window.innerHeight - h) / 2 - 10)) + "px";
    panel.dataset.positioned = "true";
  }

  function wirePanelDrag() {
    const panel = document.getElementById("panel");
    const handle = document.getElementById("panel-titlebar");
    let startX, startY, origX, origY, dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      panel.classList.add("dragging");
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      origX = rect.left; origY = rect.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      panel.style.left = Math.round(origX + (e.clientX - startX)) + "px";
      panel.style.top = Math.max(4, Math.round(origY + (e.clientY - startY))) + "px";
    });
    const end = () => { dragging = false; panel.classList.remove("dragging"); };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  function openPanel() {
    centerPanelIfNeeded();
    document.getElementById("panel").classList.add("open");
    document.getElementById("panel").setAttribute("aria-hidden", "false");
  }
  function closePanel() {
    document.getElementById("panel").classList.remove("open");
    document.getElementById("panel").setAttribute("aria-hidden", "true");
  }

  function selectTab(tabName) {
    document.querySelectorAll(".panel-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel-page").forEach((p) => (p.hidden = true));
    document.querySelector(`.panel-tab[data-tab="${tabName}"]`).classList.add("active");
    document.querySelector(`.panel-page[data-page="${tabName}"]`).hidden = false;
  }

  function wireTabs() {
    document.querySelectorAll(".panel-tab").forEach((tab) => {
      tab.addEventListener("click", () => selectTab(tab.dataset.tab));
    });
  }

  function renderRoster() {
    const state = StreakManager.get();
    const root = document.getElementById("cat-roster");
    root.innerHTML = "";
    CAT_CATALOG.forEach((cat) => {
      const unlocked = state.unlockedCats.includes(cat.id);
      const active = state.activeCats.includes(cat.id);
      const card = document.createElement("div");
      card.className = "cat-card" + (unlocked ? "" : " locked");
      card.innerHTML = `
        <div class="cat-card-thumb">${unlocked ? `<img src="assets/cats/${cat.palette}/sit_front.png" alt="">` : "🔒"}</div>
        <div class="cat-card-info">
          <div class="cat-card-name">${cat.name}</div>
          <div class="cat-card-sub">${unlocked ? cat.blurb : `Reach ${cat.unlockPoints} study points to unlock`}</div>
        </div>
        <button class="cat-card-toggle ${active ? "active" : ""}" ${unlocked ? "" : "disabled"}>
          ${active ? "On desktop" : "Show"}
        </button>
      `;
      card.querySelector("button").addEventListener("click", () => {
        if (!unlocked) return;
        const nowActive = !StreakManager.get().activeCats.includes(cat.id);
        StreakManager.setActiveCat(cat.id, nowActive);
        renderRoster();
        onRosterChange();
      });
      root.appendChild(card);
    });
  }

  // ---- Study tab ------------------------------------------------------------

  function durationOptionsFor(kind) {
    return kind === "study" ? [10, 25, 50, 90] : [5, 10, 15];
  }

  function renderDurationOptions() {
    const select = document.getElementById("session-duration");
    const current = select.value;
    select.innerHTML = "";
    durationOptionsFor(pendingKind).forEach((mins) => {
      const opt = document.createElement("option");
      opt.value = String(mins);
      opt.textContent = `${mins} min`;
      select.appendChild(opt);
    });
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  }

  function renderSessionBox() {
    const state = StreakManager.get();
    const s = state.activeSession;
    const box = document.getElementById("session-box");
    const kindToggle = document.getElementById("session-kind-toggle");
    const modeToggle = document.getElementById("session-mode-toggle");
    const durationSelect = document.getElementById("session-duration");
    const timerEl = document.getElementById("session-timer");
    const labelEl = document.getElementById("session-timer-label");
    const mainBtn = document.getElementById("session-main-btn");

    box.classList.toggle("running", !!s);
    const effKind = s ? s.kind : pendingKind;
    const effMode = s ? s.mode : pendingMode;

    kindToggle.querySelectorAll("[data-kind]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.kind === effKind);
      btn.disabled = !!s;
    });
    modeToggle.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === effMode);
      btn.disabled = !!s;
    });
    durationSelect.disabled = !!s;
    durationSelect.style.display = effMode === "countdown" ? "" : "none";

    if (s) {
      const elapsedMs = Date.now() - s.startedAt;
      if (s.mode === "countdown") {
        const remainingMs = s.durationMinutes * 60000 - elapsedMs;
        timerEl.textContent = formatSessionClock(remainingMs);
        labelEl.textContent = `${s.kind === "study" ? "Studying" : "On break"} — time left`;
      } else {
        timerEl.textContent = formatSessionClock(elapsedMs);
        labelEl.textContent = `${s.kind === "study" ? "Studying" : "On break"} — time elapsed`;
      }
      mainBtn.textContent = "■ End session";
      mainBtn.classList.add("stop");
    } else {
      timerEl.textContent = "00:00";
      labelEl.textContent = "No session running";
      mainBtn.textContent = pendingKind === "study" ? "▶ Start studying" : "▶ Start break";
      mainBtn.classList.remove("stop");
    }
  }

  function renderMilestones() {
    const state = StreakManager.get();
    const list = document.getElementById("milestone-list");
    list.innerHTML = "";
    MILESTONES.forEach((m) => {
      const done = state.points >= m.points;
      const row = document.createElement("div");
      row.className = "milestone-row" + (done ? " done" : "");
      row.innerHTML = `
        <div class="milestone-days">${m.points}★</div>
        <div class="milestone-reward">${m.label}</div>
        <div class="milestone-check">${done ? "✅" : "🔒"}</div>
      `;
      list.appendChild(row);
    });
  }

  function renderStudyLog() {
    const state = StreakManager.get();
    const list = document.getElementById("study-log-list");
    list.innerHTML = "";
    if (!state.studyLog.length) {
      const empty = document.createElement("div");
      empty.className = "study-log-empty";
      empty.textContent = "No sessions logged yet — start one above.";
      list.appendChild(empty);
      return;
    }
    state.studyLog.slice(0, 12).forEach((entry) => {
      const row = document.createElement("div");
      row.className = "study-log-row";
      const when = new Date(entry.endedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      row.innerHTML = `
        <span class="study-log-icon">${entry.kind === "study" ? "📖" : "☕"}</span>
        <span class="study-log-info">
          <span class="study-log-title">${entry.kind === "study" ? "Study" : "Break"} — ${entry.minutes} min</span>
          <span class="study-log-when">${when}</span>
        </span>
        <span class="study-log-points">+${entry.points}★</span>
      `;
      list.appendChild(row);
    });
  }

  function renderStudy() {
    document.getElementById("points-count").textContent = StreakManager.get().points;
    renderDurationOptions();
    renderSessionBox();
    renderMilestones();
    renderStudyLog();
  }

  function wireStudyControls() {
    document.getElementById("session-kind-toggle").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-kind]");
      if (!btn || StreakManager.get().activeSession) return;
      pendingKind = btn.dataset.kind;
      renderStudy();
    });
    document.getElementById("session-mode-toggle").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mode]");
      if (!btn || StreakManager.get().activeSession) return;
      pendingMode = btn.dataset.mode;
      renderStudy();
    });
    document.getElementById("session-main-btn").addEventListener("click", () => {
      const state = StreakManager.get();
      if (state.activeSession) {
        const result = StreakManager.endSession();
        onSessionFinished(result);
      } else {
        const durationMinutes = Number(document.getElementById("session-duration").value) || 25;
        StreakManager.startSession(pendingKind, pendingMode, durationMinutes);
        renderStudy();
      }
    });
  }

  // Shared by a manual "End session" click and an automatic count-down
  // completion (see main.js's tick) — shows the points earned and any
  // milestones unlocked, then refreshes everything that could have changed.
  function onSessionFinished(result) {
    if (!result) return;
    const pts = result.entry.points;
    toast(
      pts > 0
        ? `Session logged: +${pts} point${pts === 1 ? "" : "s"} ⭐`
        : `Session logged (under ${result.entry.kind === "study" ? "10" : "5"} min — no points this time).`,
      { icon: result.entry.kind === "study" ? "📖" : "☕" }
    );
    (result.milestonesHit || []).forEach((m) => {
      toast(`New unlock: ${m.label}!`, { milestone: true, icon: "🎉" });
    });
    renderAll();
    onRosterChange();
  }

  // ---- Decor tab --------------------------------------------------------

  function renderDecor() {
    const state = StreakManager.get();
    const grid = document.getElementById("decor-grid");
    grid.innerHTML = "";
    Object.entries(DECOR).forEach(([id, item]) => {
      const unlocked = state.unlockedDecor.includes(id);
      const placed = state.placedDecor.includes(id);
      const milestone = DECOR_MILESTONES.find((m) => m.id === id);
      const card = document.createElement("div");
      card.className = "decor-item" + (unlocked ? "" : " locked") + (placed ? " placed" : "");
      card.innerHTML = `
        <div class="closet-panel-item-glyph">${item.glyph}</div>
        <div class="closet-panel-item-name">${item.name}</div>
        <div class="closet-panel-item-req">${unlocked ? (placed ? "Placed ✓" : "Tap to place") : `${milestone.unlockPoints} study points`}</div>
      `;
      if (unlocked) {
        card.addEventListener("click", () => {
          StreakManager.togglePlacedDecor(id);
          renderDecor();
          onRosterChange(); // reuse the same hook to refresh desktop decor
        });
      }
      grid.appendChild(card);
    });
  }

  function renderSettings() {
    const s = StreakManager.get().settings;
    document.getElementById("toggle-hide").checked = !s.hidden; // checkbox = "show cats", inverse of the stored "hidden" flag
    document.getElementById("toggle-pause").checked = !!s.paused;
    document.getElementById("toggle-trails").checked = !!s.trails;
    document.getElementById("toggle-playful").checked = !!s.playful;
    document.getElementById("mode-description").textContent = s.playful
      ? "Playful mode — cats leave toys and little messes behind as they wander. Click one to pick it up."
      : "Serious mode — cats just walk around. Switch on for cats that leave toys and little messes behind to pick up.";
  }

  function renderAll() {
    renderRoster();
    renderStudy();
    renderDecor();
    renderSettings();
  }

  function wireSettings() {
    document.getElementById("toggle-hide").addEventListener("change", (e) => {
      StreakManager.setSetting("hidden", !e.target.checked); // checkbox = "show cats"
    });
    document.getElementById("toggle-pause").addEventListener("change", (e) => {
      StreakManager.setSetting("paused", e.target.checked);
    });
    document.getElementById("toggle-trails").addEventListener("change", (e) => {
      StreakManager.setSetting("trails", e.target.checked);
    });
    document.getElementById("toggle-playful").addEventListener("change", (e) => {
      StreakManager.setSetting("playful", e.target.checked);
      renderSettings();
    });
  }

  function wireDebug() {
    document.getElementById("debug-add-10").addEventListener("click", () => {
      const result = StreakManager.debugAddPoints(10);
      renderAll();
      onRosterChange();
      toast("Added 10 study points.", { icon: "⭐" });
      (result.milestonesHit || []).forEach((m) => toast(`New unlock: ${m.label}!`, { milestone: true, icon: "🎉" }));
    });
    document.getElementById("debug-add-50").addEventListener("click", () => {
      const result = StreakManager.debugAddPoints(50);
      renderAll();
      onRosterChange();
      toast("Added 50 study points.", { icon: "⭐" });
      (result.milestonesHit || []).forEach((m) => toast(`New unlock: ${m.label}!`, { milestone: true, icon: "🎉" }));
    });
    document.getElementById("debug-reset").addEventListener("click", () => {
      if (!confirm("Reset all Pawprint progress? This clears your points, log, unlocks, and settings.")) return;
      StreakManager.debugReset();
      renderAll();
      onRosterChange();
      toast("Progress reset.", { icon: "↺" });
    });
  }

  function init({ onRosterChangeCb }) {
    onRosterChange = onRosterChangeCb || (() => {});
    wireTabs();
    wireSettings();
    wireStudyControls();
    wireDebug();
    wirePanelDrag();
    document.getElementById("panel-close").addEventListener("click", (e) => { e.stopPropagation(); closePanel(); });
    document.getElementById("dock-pawprint").addEventListener("click", () => {
      if (document.getElementById("panel").classList.contains("open")) closePanel();
      else openPanel();
    });
    renderAll();
  }

  return {
    init, toast, renderAll, renderRoster, renderStudy, renderDecor, onSessionFinished,
    openPanel, closePanel,
  };
})();
