/*
 * Minimal draggable fake "app windows" — just enough chrome to give cats
 * something to walk behind/on top of, and to prove the pet overlays
 * desktop windows the way a real desk-pet app would.
 */

const WindowManager = (() => {
  const layer = () => document.getElementById("windows-layer");
  const registry = {};

  const CONTENT = {
    finder: {
      title: "Finder — Documents",
      body: `<h3>Documents</h3><p>This is a decorative stand-in window. Drag it by the title bar — your cats will happily walk and perch on top of it.</p>`,
      rect: { left: 90, top: 90, width: 260, height: 170 },
    },
    notes: {
      title: "Notes",
      body: `<h3>Today</h3><p>• Feed the cats (they're low-maintenance)<br>• Pat Mochi before midnight<br>• Ship the prototype 🚀</p>`,
      rect: { left: 420, top: 140, width: 230, height: 160 },
    },
    safari: {
      title: "Safari",
      body: `<h3>pawprint.app</h3><p>Imagine your actual desktop here. Cats roam freely above every window, exactly like they would on your real Mac desktop.</p>`,
      rect: { left: 700, top: 300, width: 260, height: 150 },
    },
  };

  function create(appId) {
    if (registry[appId]) {
      show(appId);
      return registry[appId];
    }
    const cfg = CONTENT[appId];
    if (!cfg) return null;
    const el = document.createElement("div");
    el.className = "app-window";
    el.style.left = cfg.rect.left + "px";
    el.style.top = cfg.rect.top + "px";
    el.style.width = cfg.rect.width + "px";
    el.style.height = cfg.rect.height + "px";
    el.innerHTML = `
      <div class="window-titlebar">
        <div class="traffic-lights">
          <div class="traffic-light red"></div>
          <div class="traffic-light yellow"></div>
          <div class="traffic-light green"></div>
        </div>
        <div class="window-title">${cfg.title}</div>
      </div>
      <div class="window-body">${cfg.body}</div>
    `;
    layer().appendChild(el);
    makeDraggable(el, el.querySelector(".window-titlebar"));
    el.querySelector(".traffic-light.red").addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.add("closed");
    });
    bringToFront(el);
    registry[appId] = el;
    return el;
  }

  function show(appId) {
    const el = registry[appId];
    if (el) { el.classList.remove("closed"); bringToFront(el); }
  }

  let topZ = 10;
  function bringToFront(el) { topZ += 1; el.style.zIndex = topZ; }

  function makeDraggable(el, handle) {
    let startX, startY, origX, origY, dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      el.classList.add("dragging");
      bringToFront(el);
      startX = e.clientX; startY = e.clientY;
      origX = el.offsetLeft; origY = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const nx = origX + (e.clientX - startX);
      const ny = Math.max(30, origY + (e.clientY - startY));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    });
    const end = () => { dragging = false; el.classList.remove("dragging"); };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /** Returns [{left, top, width, height, el}] for all currently-visible windows. */
  function visibleRects() {
    return Object.values(registry)
      .filter((el) => !el.classList.contains("closed"))
      .map((el) => ({
        left: el.offsetLeft, top: el.offsetTop,
        width: el.offsetWidth, height: el.offsetHeight, el,
      }));
  }

  function init() {
    // In the native Mac app the cats live on your real desktop, so there are
    // no fake windows — real ones arrive through syncNative() instead.
    if (window.PAWPRINT_NATIVE) return;
    create("finder");
    create("notes");
  }

  /*
   * Native desktop-pet mode (see js/native.js): the Mac app reports the real
   * on-screen windows, and each one gets an invisible stand-in element here
   * so the cats' existing perch logic (which reads offsetLeft/offsetTop and
   * drops off when the element disappears) works on real windows unchanged.
   * list: [{id, x, y, w, h}] in page coordinates.
   */
  function syncNative(list) {
    const seen = new Set();
    list.forEach((w) => {
      const key = "native-" + w.id;
      seen.add(key);
      let el = registry[key];
      if (!el) {
        el = document.createElement("div");
        el.className = "native-window-proxy";
        layer().appendChild(el);
        registry[key] = el;
      }
      el.style.left = Math.round(w.x) + "px";
      el.style.top = Math.round(w.y) + "px";
      el.style.width = Math.round(w.w) + "px";
      el.style.height = Math.round(w.h) + "px";
    });
    Object.keys(registry).forEach((key) => {
      if (key.startsWith("native-") && !seen.has(key)) {
        registry[key].remove();
        delete registry[key];
      }
    });
  }

  return { create, show, visibleRects, init, syncNative };
})();
