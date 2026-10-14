/* Control panel: cat roster, closet, streak tab, settings, toasts. */

const UI = (() => {
  let onRosterChange = () => {};

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

  function openPanel() {
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

  // Opens the panel straight to the Closet tab with a specific cat preselected —
  // used by each cat's hover menu ("change closet items").
  function openClosetFor(catId) {
    closetSelectedCat = catId;
    renderCloset();
    selectTab("closet");
    openPanel();
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
          <div class="cat-card-sub">${unlocked ? cat.blurb : `Reach a ${cat.unlockDays}-day streak to unlock`}</div>
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

  let closetSelectedCat = "mochi";
  function renderCloset() {
    const state = StreakManager.get();
    const picker = document.getElementById("closet-cat-picker");
    picker.innerHTML = "";
    CAT_CATALOG.filter((c) => state.unlockedCats.includes(c.id)).forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "closet-cat-chip" + (c.id === closetSelectedCat ? " active" : "");
      chip.textContent = c.name;
      chip.addEventListener("click", () => { closetSelectedCat = c.id; renderCloset(); });
      picker.appendChild(chip);
    });

    const grid = document.getElementById("closet-grid");
    grid.innerHTML = "";
    const equippedList = state.equipped[closetSelectedCat] || [];
    Object.entries(ACCESSORIES).forEach(([id, acc]) => {
      const unlocked = state.unlockedAccessories.includes(id);
      const equipped = equippedList.includes(id);
      const milestone = ACCESSORY_MILESTONES.find((m) => m.id === id);
      const item = document.createElement("div");
      item.className = "closet-item" + (unlocked ? "" : " locked") + (equipped ? " equipped" : "");
      item.innerHTML = `
        <div class="closet-item-glyph">${acc.glyph}</div>
        <div class="closet-item-name">${acc.name}</div>
        <div class="closet-item-req">${unlocked ? (equipped ? "Equipped ✓" : "Tap to equip") : `${milestone.unlockDays}-day streak`}</div>
      `;
      if (unlocked) {
        item.addEventListener("click", () => {
          StreakManager.toggleEquip(closetSelectedCat, id);
          renderCloset();
          onRosterChange();
        });
      }
      grid.appendChild(item);
    });
  }

  function renderStreak() {
    const state = StreakManager.get();
    document.getElementById("streak-count").textContent = state.streak;
    const statusEl = document.getElementById("streak-status");
    const today = StreakManager.todayDayNumber();
    if (state.lastPatDay === today) {
      statusEl.textContent = "Patted today — your streak is safe. ✅";
    } else if (state.streak > 0) {
      statusEl.textContent = "Pat a cat before the day ends to keep your streak alive.";
    } else {
      statusEl.textContent = "Pat a cat today to start a new streak.";
    }
    document.getElementById("streak-flame").style.opacity = state.streak > 0 ? "1" : "0.35";

    const list = document.getElementById("milestone-list");
    list.innerHTML = "";
    MILESTONES.forEach((m) => {
      const done = state.streak >= m.days;
      const row = document.createElement("div");
      row.className = "milestone-row" + (done ? " done" : "");
      row.innerHTML = `
        <div class="milestone-days">${m.days}d</div>
        <div class="milestone-reward">${m.label}</div>
        <div class="milestone-check">${done ? "✅" : "🔒"}</div>
      `;
      list.appendChild(row);
    });
  }

  function renderSettings() {
    const s = StreakManager.get().settings;
    document.getElementById("toggle-hide").checked = !s.hidden; // checkbox = "show cats", inverse of the stored "hidden" flag
    document.getElementById("toggle-pause").checked = !!s.paused;
    document.getElementById("toggle-sound").checked = !!s.sound;
    document.getElementById("toggle-trails").checked = !!s.trails;
  }

  function renderAll() {
    renderRoster();
    renderCloset();
    renderStreak();
    renderSettings();
  }

  function wireSettings() {
    document.getElementById("toggle-hide").addEventListener("change", (e) => {
      StreakManager.setSetting("hidden", !e.target.checked); // checkbox = "show cats"
    });
    document.getElementById("toggle-pause").addEventListener("change", (e) => {
      StreakManager.setSetting("paused", e.target.checked);
    });
    document.getElementById("toggle-sound").addEventListener("change", (e) => {
      StreakManager.setSetting("sound", e.target.checked);
    });
    document.getElementById("toggle-trails").addEventListener("change", (e) => {
      StreakManager.setSetting("trails", e.target.checked);
    });
  }

  function wireDebug() {
    document.getElementById("debug-next-day").addEventListener("click", () => {
      StreakManager.debugAdvanceDay();
      renderStreak();
      toast("Simulated the next day beginning.", { icon: "⏭" });
    });
    document.getElementById("debug-miss-day").addEventListener("click", () => {
      const hadStreak = StreakManager.get().streak > 0;
      StreakManager.debugMissDay();
      renderStreak();
      toast(hadStreak ? "A day was missed — streak reset to 0." : "Simulated a missed day.", { icon: "💤" });
    });
    document.getElementById("debug-reset").addEventListener("click", () => {
      if (!confirm("Reset all Pawprint progress? This clears your streak, unlocks, and settings.")) return;
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
    wireDebug();
    document.getElementById("panel-close").addEventListener("click", closePanel);
    document.getElementById("dock-pawprint").addEventListener("click", () => {
      if (document.getElementById("panel").classList.contains("open")) closePanel();
      else openPanel();
    });
    renderAll();
  }

  function onPatResult(result) {
    renderStreak();
    renderRoster();
    if (result.isNewToday) {
      toast(`Streak +1! 🔥 ${result.streak} day${result.streak === 1 ? "" : "s"}`, { icon: "🔥" });
    }
    (result.milestonesHit || []).forEach((m) => {
      toast(`New unlock: ${m.label}!`, { milestone: true, icon: "🎉" });
    });
    if (result.milestonesHit && result.milestonesHit.length) {
      renderCloset();
    }
  }

  return {
    init, toast, renderAll, renderRoster, renderCloset, renderStreak, onPatResult,
    openPanel, closePanel, openClosetFor,
  };
})();
