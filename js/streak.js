/*
 * StreakManager — owns all persisted progress: study points, the study
 * log, the in-progress study/break session (if any), unlocked
 * cats/accessories/toys/food/decor, equipped accessories, placed decor,
 * and user settings.
 *
 * Points come from logged study/break time rather than daily interaction:
 * every full 30 minutes of a "study" session is worth 1 point, and every
 * full 5 minutes of a "break" session is worth 0.5 points. A session can
 * count up (an open-ended stopwatch, stopped manually) or count down (a
 * chosen duration, finishing on its own).
 */

const StreakManager = (() => {
  const STORAGE_KEY = "pawprint_state_v2";

  let state;

  function defaultState() {
    return {
      points: 0,
      studyLog: [],            // [{id, kind:'study'|'break', mode, minutes, points, endedAt}], newest first
      activeSession: null,     // {kind, mode, durationMinutes, startedAt} or null
      unlockedCats: ["mochi"],
      activeCats: ["mochi"],
      unlockedAccessories: [],
      unlockedToys: [],
      unlockedFoods: ["drumstick"],
      unlockedDecor: [],
      placedDecor: [],         // unlocked decor ids currently shown on the desktop
      decorPositions: {},      // decorId -> {left,top} once dragged to a custom spot (else DECOR[id].pos)
      equipped: {},             // catId -> [accessoryId,...]
      settings: {
        hidden: false, paused: false, trails: true, playful: false,
        walkSpeed: 1,            // multiplier on the base walk/pounce speed
        catSize: 1,              // multiplier on the rendered sprite size
      },
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

  function get() { return state; }

  // Starts a new study or break session. Refuses if one is already running
  // (stop it first) — returns the new session, or null if refused.
  function startSession(kind, mode, durationMinutes) {
    if (state.activeSession) return null;
    state.activeSession = {
      kind,                                   // "study" | "break"
      mode,                                   // "countup" | "countdown"
      durationMinutes: mode === "countdown" ? durationMinutes : null,
      startedAt: Date.now(),
    };
    save();
    return state.activeSession;
  }

  // Turns the elapsed time of the active session into points (1 per full
  // 30 minutes studied, 0.5 per full 5 minutes on break), logs it, clears
  // the session, and applies any milestones that just got crossed.
  function _finalizeSession() {
    const s = state.activeSession;
    if (!s) return null;
    const elapsedMs = Date.now() - s.startedAt;
    const minutes = Math.max(0, Math.floor(elapsedMs / 60000));
    const unitMinutes = s.kind === "study" ? 30 : 5;
    const pointsPerUnit = s.kind === "study" ? 1 : 0.5;
    const pointsEarned = Math.floor(minutes / unitMinutes) * pointsPerUnit;
    state.points += pointsEarned;
    const entry = {
      id: "s" + Math.random().toString(36).slice(2, 9),
      kind: s.kind, mode: s.mode, minutes, points: pointsEarned,
      endedAt: Date.now(),
    };
    state.studyLog.unshift(entry);
    state.studyLog = state.studyLog.slice(0, 50); // keep recent history only
    state.activeSession = null;
    const milestonesHit = applyMilestones();
    save();
    return { entry, milestonesHit, totalPoints: state.points };
  }

  // Ends the active session right now (manual stop) — same accounting as
  // letting a count-down session run out.
  function endSession() {
    return _finalizeSession();
  }

  // Call periodically (see main.js) so a count-down session finishes itself
  // once its time is up. Returns the finalize result if it just completed,
  // null otherwise (nothing to do yet, or no session running).
  function tickSession() {
    const s = state.activeSession;
    if (!s || s.mode !== "countdown") return null;
    const elapsedMs = Date.now() - s.startedAt;
    if (elapsedMs >= s.durationMinutes * 60000) return _finalizeSession();
    return null;
  }

  function applyMilestones() {
    const hits = [];
    MILESTONES.forEach((m) => {
      const key = `${m.kind}:${m.refId}`;
      if (state.points >= m.points && !state.seenMilestones.includes(key)) {
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
        if (m.kind === "decor" && !state.unlockedDecor.includes(m.refId)) {
          state.unlockedDecor.push(m.refId);
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

  function togglePlacedDecor(decorId) {
    if (!state.unlockedDecor.includes(decorId)) return;
    const idx = state.placedDecor.indexOf(decorId);
    if (idx === -1) state.placedDecor.push(decorId); else state.placedDecor.splice(idx, 1);
    save();
  }

  // Remembers a custom desktop spot a placed decor piece was dragged to,
  // overriding its default catalog position from then on.
  function setDecorPosition(decorId, pos) {
    state.decorPositions[decorId] = pos;
    save();
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    save();
  }

  // ---- Debug/demo helpers --------------------------------------------------
  function debugAddPoints(amount) {
    state.points += amount;
    const milestonesHit = applyMilestones();
    save();
    return { milestonesHit, totalPoints: state.points };
  }

  function debugReset() {
    state = defaultState();
    save();
  }

  load();

  return {
    get, startSession, endSession, tickSession,
    setActiveCat, toggleEquip, togglePlacedDecor, setDecorPosition, setSetting,
    debugAddPoints, debugReset,
  };
})();
