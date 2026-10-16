/*
 * StreakManager — owns all persisted progress: streak count, last-pat date,
 * unlocked cats/accessories, equipped accessories, and user settings.
 *
 * Dates are tracked as "day numbers" (days since epoch) rather than
 * timestamps so day-rollover logic is simple integer math. A small
 * `dayOffset` lets the prototype's debug tools simulate the passage of
 * days without waiting for a real midnight — everything else behaves the
 * exact same way a real day boundary would.
 */

const StreakManager = (() => {
  const STORAGE_KEY = "pawprint_state_v1";
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  let state;

  function defaultState() {
    return {
      streak: 0,
      longestStreak: 0,
      lastPatDay: null,       // day number of the last day the cat was patted
      dayOffset: 0,           // debug-only: simulated days added on top of real time
      unlockedCats: ["mochi"],
      activeCats: ["mochi"],
      unlockedAccessories: [],
      unlockedToys: [],
      unlockedFoods: ["drumstick"],
      equipped: {},           // catId -> [accessoryId,...]
      settings: { hidden: false, paused: false, sound: true, trails: true, playful: false },
      seenMilestones: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
      state.settings = Object.assign(defaultState().settings, state.settings || {});
    } catch (e) {
      state = defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function todayDayNumber() {
    return Math.floor(Date.now() / MS_PER_DAY) + (state.dayOffset || 0);
  }

  function get() { return state; }

  // Returns { streak, isNewToday, milestonesHit: [...] }
  function recordPat() {
    const today = todayDayNumber();
    if (state.lastPatDay === today) {
      return { streak: state.streak, isNewToday: false, milestonesHit: [] };
    }
    if (state.lastPatDay === today - 1) {
      state.streak += 1; // continued the streak
    } else {
      state.streak = 1; // first pat ever, or the streak had already lapsed
    }
    state.lastPatDay = today;
    state.longestStreak = Math.max(state.longestStreak, state.streak);
    const milestonesHit = applyMilestones();
    save();
    return { streak: state.streak, isNewToday: true, milestonesHit };
  }

  // Call on load to see if a day (or more) was missed since the last pat,
  // resetting the streak to 0 if so. Does not mutate lastPatDay.
  function checkForLapse() {
    if (state.lastPatDay == null) return false;
    const today = todayDayNumber();
    if (today - state.lastPatDay >= 2) {
      state.streak = 0;
      save();
      return true;
    }
    return false;
  }

  function applyMilestones() {
    const hits = [];
    MILESTONES.forEach((m) => {
      const key = `${m.kind}:${m.refId}`;
      if (state.streak >= m.days && !state.seenMilestones.includes(key)) {
        state.seenMilestones.push(key);
        if (m.kind === "cat" && !state.unlockedCats.includes(m.refId)) {
          state.unlockedCats.push(m.refId);
        }
        if (m.kind === "accessory" && !state.unlockedAccessories.includes(m.refId)) {
          state.unlockedAccessories.push(m.refId);
        }
        if (m.kind === "toy" && !state.unlockedToys.includes(m.refId)) {
          state.unlockedToys.push(m.refId);
        }
        if (m.kind === "food" && !state.unlockedFoods.includes(m.refId)) {
          state.unlockedFoods.push(m.refId);
        }
        hits.push(m);
      }
    });
    return hits;
  }

  function setActiveCat(catId, active) {
    const idx = state.activeCats.indexOf(catId);
    if (active && idx === -1) state.activeCats.push(catId);
    if (!active && idx !== -1) state.activeCats.splice(idx, 1);
    save();
  }

  function toggleEquip(catId, accessoryId) {
    const list = state.equipped[catId] || [];
    const idx = list.indexOf(accessoryId);
    if (idx === -1) list.push(accessoryId); else list.splice(idx, 1);
    state.equipped[catId] = list;
    save();
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    save();
  }

  // ---- Debug/demo helpers --------------------------------------------------
  function debugAdvanceDay() {
    state.dayOffset = (state.dayOffset || 0) + 1;
    checkForLapse();
    save();
  }

  function debugMissDay() {
    state.dayOffset = (state.dayOffset || 0) + 2; // skip a day entirely
    checkForLapse();
    save();
  }

  function debugReset() {
    state = defaultState();
    save();
  }

  load();
  checkForLapse();

  return {
    get, recordPat, setActiveCat, toggleEquip, setSetting,
    debugAdvanceDay, debugMissDay, debugReset, todayDayNumber,
  };
})();
