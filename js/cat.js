/*
 * Cat — a single desk pet: its DOM element, wander/perch AI, drag & pat
 * interaction, paw-print trail, and particle effects. Visuals come from
 * the hand-drawn sprite sheet in js/spriteart.js.
 */

const CatMouse = { x: -9999, y: -9999 };
document.addEventListener("pointermove", (e) => { CatMouse.x = e.clientX; CatMouse.y = e.clientY; });

// Pink pixel-art heart shown above a cat's head when it's patted.
// Grid: X = heart, outline/shade/highlight are derived from neighbours.
const PIXEL_HEART_SVG = (() => {
  const g = [
    "..XXX...XXX..",
    ".XXXXX.XXXXX.",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    ".XXXXXXXXXXX.",
    "..XXXXXXXXX..",
    "...XXXXXXX...",
    "....XXXXX....",
    ".....XXX.....",
    "......X......",
  ];
  const on = (r, c) => r >= 0 && r < g.length && c >= 0 && c < 13 && g[r][c] === "X";
  const highlight = new Set(["1,2", "1,3", "2,1", "2,2", "3,1"]);
  let rects = "";
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < 13; c++) {
      if (!on(r, c)) continue;
      let col = "#ff6fa5"; // fill
      if (!on(r - 1, c) || !on(r + 1, c) || !on(r, c - 1) || !on(r, c + 1)) col = "#8a1c4a"; // outline
      else if (highlight.has(r + "," + c)) col = "#ffd1e3"; // shine
      else if (!on(r + 1, c + 1) || !on(r + 2, c) || (r >= 6 && c >= 7)) col = "#e64a87"; // shade
      rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="${col}"/>`;
    }
  }
  return `<svg viewBox="0 0 13 11" width="26" height="22" shape-rendering="crispEdges" style="display:block">${rects}</svg>`;
})();

let sharedAudioCtx = null;
function playPurr() {
  try {
    sharedAudioCtx = sharedAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfoGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 32;
    lfo.type = "sine";
    lfo.frequency.value = 22; // purr "rumble" rate
    lfoGain.gain.value = 0.5;
    gain.gain.value = 0.0001;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.15);
    gain.gain.linearRampToValueAtTime(0.0001, now + 1.0);
    osc.start(now); lfo.start(now);
    osc.stop(now + 1.05); lfo.stop(now + 1.05);
  } catch (e) { /* audio not available — silently skip */ }
}

class Cat {
  constructor(def, world) {
    this.def = def;           // {id, name, palette}
    this.world = world;       // callbacks: onPat(result), getSettings(), getEquipped(id), getWindowRects()
    this.facing = 1;          // 1 = right, -1 = left
    this.x = 140 + Math.random() * 300;      // center x
    this.footY = this.groundFootY();          // baseline (feet) y
    this.state = "idle";
    this.queue = [];
    this.currentStep = null;
    this.stepStart = 0;
    this.stepFromX = this.x; this.stepFromFootY = this.footY;
    this.patUntil = 0;
    this.dragSwing = 0;       // -1 = limbs swung far left, +1 = far right
    this.dragVX = 0;          // smoothed cursor velocity while lifted (px/move)
    this.dragVY = 0;
    this.dragging = false;
    this.pawStampX = this.x;
    this.pawSide = 1;
    this.accessoryEls = {};
    this.manuallyPaused = false;   // per-cat "pause movement" toggle from the hover menu
    this.hoverPaused = false;      // true while the cat or its hover menu is under the cursor
    this.clipboard = [];           // items dropped onto this cat, session-only
    this.clipboardPanelOpen = false;
    this.closetPanelOpen = false;
    this.closetActiveCategory = CLOSET_CATEGORIES[0].id;
    this.toyboxPanelOpen = false;
    this.playing = false;          // actively playing with a toy (frozen, animated)
    this.activeToyId = null;
    this.activeToyEl = null;       // the toy sprite on the desk — stays after play ends ("left out")
    this._hoverHideTimer = null;
    this._wasFrozen = false;       // edge-detects entering a paused/frozen state

    this._buildDom();
    this._wireInput();
    this._wireDropZone();
    this._buildHoverMenu();
    this._buildClipboardPanel();
    this._buildClosetPanel();
    this._buildToyboxPanel();
  }

  groundFootY() {
    return window.innerHeight - 92;
  }

  _buildDom() {
    const el = document.createElement("div");
    el.className = "cat";
    const img = document.createElement("img");
    img.className = "cat-sprite";
    img.draggable = false;
    el.appendChild(img);
    const tag = document.createElement("div");
    tag.className = "cat-name-tag";
    tag.textContent = this.def.name;
    el.appendChild(tag);
    document.getElementById("cats-layer").appendChild(el);
    this.el = el;
    this.img = img;
  }

  _wireInput() {
    let downX, downY, downT, movedFar, pointerOffsetX, pointerOffsetY;
    this.el.addEventListener("pointerdown", (e) => {
      if (this.world.getSettings().paused) return;
      downX = e.clientX; downY = e.clientY; downT = performance.now();
      movedFar = false;
      pointerOffsetX = e.clientX - this.x;
      pointerOffsetY = e.clientY - this.footY;
      this.el.setPointerCapture(e.pointerId);
      // Clear the hover buttons/boards out of the way the moment you click,
      // so they don't float around mid-drag.
      this._hideFloatingMenus();
    });
    this.el.addEventListener("pointermove", (e) => {
      if (downX == null) return;
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (!movedFar && Math.hypot(dx, dy) > 6) {
        movedFar = true;
        this._startDrag();
        // Hold the cat by the scruff: the cursor sits on the back of its head.
        const { w, h } = SPRITEART.dangleSize();
        pointerOffsetX = w * (SPRITEART.DANGLE_SCRUFF.x - 0.5);
        pointerOffsetY = h * SPRITEART.DANGLE_SCRUFF.y - h;
      }
      if (movedFar) {
        const prevX = this.x, prevY = this.footY;
        this.x = e.clientX - pointerOffsetX;
        this.footY = e.clientY - pointerOffsetY;
        this.dragVX = this.dragVX * 0.5 + (this.x - prevX) * 0.5;
        this.dragVY = this.dragVY * 0.5 + (this.footY - prevY) * 0.5;
      }
    });
    const finish = () => {
      if (downX == null) return;
      const elapsed = performance.now() - downT;
      if (!movedFar && elapsed < 350) {
        this.pat();
      } else if (movedFar) {
        this._endDrag();
      }
      downX = null;
      // The cursor is still over the cat (or just dropped it) — bring the
      // hover menu back.
      this._hoverShow();
    };
    this.el.addEventListener("pointerup", finish);
    this.el.addEventListener("pointercancel", finish);
  }

  // Lets the OS's native drag-and-drop drop a real file (or dragged text)
  // onto the cat, which "saves" it into that cat's clipboard.
  _wireDropZone() {
    this.el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      this.el.classList.add("drop-hover");
    });
    this.el.addEventListener("dragleave", () => {
      this.el.classList.remove("drop-hover");
    });
    this.el.addEventListener("drop", (e) => {
      e.preventDefault();
      this.el.classList.remove("drop-hover");
      this._handleDrop(e.dataTransfer);
    });
  }

  _handleDrop(dataTransfer) {
    const files = Array.from((dataTransfer && dataTransfer.files) || []);
    if (files.length) {
      files.forEach((file) => {
        this._addClipboardItem({
          name: file.name || "Untitled file",
          mime: file.type || "application/octet-stream",
          size: file.size,
          blobUrl: URL.createObjectURL(file),
          kind: (file.type || "").startsWith("image/") ? "image" : "file",
        });
      });
      return;
    }
    const text = dataTransfer && dataTransfer.getData && dataTransfer.getData("text/plain");
    if (text) {
      this._addClipboardItem({
        name: text.length > 36 ? text.slice(0, 36) + "…" : text,
        mime: "text/plain",
        text,
        kind: "text",
      });
    }
  }

  _addClipboardItem(item) {
    item.id = "c" + Math.random().toString(36).slice(2, 9);
    this.clipboard.push(item);
    this.world.toast(`Saved "${item.name}" to ${this.def.name}'s clipboard`, { icon: "📎" });
    if (this.clipboardPanelOpen) this._renderClipboardPanel();
  }

  _removeClipboardItem(id) {
    const item = this.clipboard.find((it) => it.id === id);
    if (item && item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    this.clipboard = this.clipboard.filter((it) => it.id !== id);
    this._renderClipboardPanel();
  }

  async _copyItemToClipboard(item) {
    try {
      if (item.kind === "text" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(item.text);
        this.world.toast("Copied to your clipboard — paste it anywhere.", { icon: "📋" });
        return;
      }
      if (item.blobUrl && navigator.clipboard && window.ClipboardItem) {
        const blob = await (await fetch(item.blobUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || item.mime]: blob })]);
        this.world.toast("Copied to your clipboard — paste it anywhere.", { icon: "📋" });
        return;
      }
      throw new Error("clipboard API unavailable");
    } catch (e) {
      // Fall back to a plain download so the item can still be "taken out".
      if (item.blobUrl) {
        const a = document.createElement("a");
        a.href = item.blobUrl;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.world.toast("Your browser blocked clipboard copy — downloaded it instead.", { icon: "⬇️" });
      }
    }
  }

  _buildHoverMenu() {
    const menu = document.createElement("div");
    menu.className = "cat-hover-menu";

    const pauseBtn = document.createElement("button");
    pauseBtn.className = "cat-hover-btn cat-hover-pause";
    pauseBtn.type = "button";
    pauseBtn.title = "Pause this cat's movement";
    pauseBtn.textContent = "⏸";

    const clipBtn = document.createElement("button");
    clipBtn.className = "cat-hover-btn cat-hover-clipboard";
    clipBtn.type = "button";
    clipBtn.title = "Open this cat's clipboard";
    clipBtn.textContent = "📋";

    const closetBtn = document.createElement("button");
    closetBtn.className = "cat-hover-btn cat-hover-closet";
    closetBtn.type = "button";
    closetBtn.title = "Change closet items";
    closetBtn.textContent = "🧥";

    const toyBtn = document.createElement("button");
    toyBtn.className = "cat-hover-btn cat-hover-toybox";
    toyBtn.type = "button";
    toyBtn.title = "Toy box";
    toyBtn.textContent = "🧸";

    [pauseBtn, clipBtn, closetBtn, toyBtn].forEach((btn) => menu.appendChild(btn));
    document.getElementById("cats-layer").appendChild(menu);

    // Half-circle arc above the cat; each button gets a fixed (--dx, --dy)
    // offset from the arc's center, animated to on hover ("zoom out" reveal).
    const radius = 62;
    [[160, pauseBtn], [113, clipBtn], [67, closetBtn], [20, toyBtn]].forEach(([angleDeg, btn]) => {
      const rad = (angleDeg * Math.PI) / 180;
      btn.style.setProperty("--dx", (radius * Math.cos(rad)).toFixed(1) + "px");
      btn.style.setProperty("--dy", (-radius * Math.sin(rad)).toFixed(1) + "px");
    });

    pauseBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    pauseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.manuallyPaused = !this.manuallyPaused;
      pauseBtn.textContent = this.manuallyPaused ? "▶" : "⏸";
      pauseBtn.title = this.manuallyPaused ? "Resume this cat's movement" : "Pause this cat's movement";
      pauseBtn.classList.toggle("active", this.manuallyPaused);
    });

    clipBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    clipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleClipboardPanel();
    });

    closetBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    closetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleClosetPanel();
    });

    toyBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    toyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.playing) this._endPlay();
      else this._toggleToyboxPanel();
    });

    // Hovering the cat (or its menu/clipboard panel) holds it still so the
    // buttons don't drift out from under the cursor while you're using them.
    const show = () => {
      clearTimeout(this._hoverHideTimer);
      menu.classList.add("show");
      this.hoverPaused = true;
    };
    const scheduleHide = () => {
      clearTimeout(this._hoverHideTimer);
      this._hoverHideTimer = setTimeout(() => {
        menu.classList.remove("show");
        this.hoverPaused = false;
      }, 260);
    };
    this.el.addEventListener("pointerenter", show);
    this.el.addEventListener("pointerleave", scheduleHide);
    menu.addEventListener("pointerenter", show);
    menu.addEventListener("pointerleave", scheduleHide);

    this.hoverMenuEl = menu;
    this.hoverPauseBtn = pauseBtn;
    this.hoverClipBtn = clipBtn;
    this.hoverClosetBtn = closetBtn;
    this.hoverToyBtn = toyBtn;
    this._hoverShow = show;
    this._hoverScheduleHide = scheduleHide;
  }

  // Clicking (or starting to drag) the cat clears every floating button/board
  // out of the way immediately, so they aren't hanging around while you're
  // petting or lifting it.
  _hideFloatingMenus() {
    clearTimeout(this._hoverHideTimer);
    this.hoverMenuEl.classList.remove("show");
    this.hoverPaused = false;
    this.clipboardPanelOpen = false;
    this.clipboardPanelEl.classList.remove("show");
    this.closetPanelOpen = false;
    this.closetPanelEl.classList.remove("show");
    this.toyboxPanelOpen = false;
    this.toyboxPanelEl.classList.remove("show");
    if (this.playing) this._endPlay();
  }

  _buildClipboardPanel() {
    const panel = document.createElement("div");
    panel.className = "cat-clipboard-panel";
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener("pointerenter", () => this._hoverShow());
    panel.addEventListener("pointerleave", () => this._hoverScheduleHide());
    document.getElementById("cats-layer").appendChild(panel);
    this.clipboardPanelEl = panel;

    document.addEventListener("pointerdown", (e) => {
      if (!this.clipboardPanelOpen) return;
      if (panel.contains(e.target) || this.hoverClipBtn.contains(e.target)) return;
      this.clipboardPanelOpen = false;
      panel.classList.remove("show");
    });
  }

  _toggleClipboardPanel() {
    this.clipboardPanelOpen = !this.clipboardPanelOpen;
    if (this.clipboardPanelOpen) {
      this.closetPanelOpen = false; this.closetPanelEl.classList.remove("show");
      this.toyboxPanelOpen = false; this.toyboxPanelEl.classList.remove("show");
    }
    this.clipboardPanelEl.classList.toggle("show", this.clipboardPanelOpen);
    if (this.clipboardPanelOpen) this._renderClipboardPanel();
  }

  _renderClipboardPanel() {
    const panel = this.clipboardPanelEl;
    panel.innerHTML = "";
    const header = document.createElement("div");
    header.className = "clipboard-panel-header";
    header.textContent = `${this.def.name}'s clipboard`;
    panel.appendChild(header);

    if (!this.clipboard.length) {
      const empty = document.createElement("div");
      empty.className = "clipboard-empty";
      empty.textContent = "Drag a file (or dragged text) onto the cat to save it here, then drag it back out later.";
      panel.appendChild(empty);
    }

    this.clipboard.forEach((item) => {
      const row = document.createElement("div");
      row.className = "clipboard-item";
      row.draggable = true;
      const icon = item.kind === "image" ? "🖼️" : item.kind === "text" ? "📝" : "📄";
      row.innerHTML = `
        <span class="clipboard-item-icon">${icon}</span>
        <span class="clipboard-item-name" title="${item.name}">${item.name}</span>
        <button type="button" class="clipboard-item-copy" title="Copy to system clipboard">📋</button>
        <button type="button" class="clipboard-item-remove" title="Remove">✕</button>
      `;
      row.addEventListener("dragstart", (e) => {
        if (item.blobUrl) {
          e.dataTransfer.setData("DownloadURL", `${item.mime}:${item.name}:${item.blobUrl}`);
        } else if (item.text) {
          e.dataTransfer.setData("text/plain", item.text);
        }
        e.dataTransfer.effectAllowed = "copy";
      });
      row.querySelector(".clipboard-item-copy").addEventListener("click", (e) => {
        e.stopPropagation();
        this._copyItemToClipboard(item);
      });
      row.querySelector(".clipboard-item-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        this._removeClipboardItem(item.id);
      });
      panel.appendChild(row);
    });
  }

  _buildClosetPanel() {
    const panel = document.createElement("div");
    panel.className = "cat-closet-panel";
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener("pointerenter", () => this._hoverShow());
    panel.addEventListener("pointerleave", () => this._hoverScheduleHide());
    document.getElementById("cats-layer").appendChild(panel);
    this.closetPanelEl = panel;

    document.addEventListener("pointerdown", (e) => {
      if (!this.closetPanelOpen) return;
      if (panel.contains(e.target) || this.hoverClosetBtn.contains(e.target)) return;
      this.closetPanelOpen = false;
      panel.classList.remove("show");
    });
  }

  _toggleClosetPanel() {
    this.closetPanelOpen = !this.closetPanelOpen;
    if (this.closetPanelOpen) {
      this.clipboardPanelOpen = false; this.clipboardPanelEl.classList.remove("show");
      this.toyboxPanelOpen = false; this.toyboxPanelEl.classList.remove("show");
    }
    this.closetPanelEl.classList.toggle("show", this.closetPanelOpen);
    if (this.closetPanelOpen) this._renderClosetPanel();
  }

  _renderClosetPanel() {
    const panel = this.closetPanelEl;
    panel.innerHTML = "";

    const header = document.createElement("div");
    header.className = "closet-panel-header";
    header.textContent = `${this.def.name}'s closet`;
    panel.appendChild(header);

    const tabs = document.createElement("div");
    tabs.className = "closet-panel-tabs";
    CLOSET_CATEGORIES.forEach((cat) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "closet-panel-tab" + (cat.id === this.closetActiveCategory ? " active" : "");
      tab.textContent = cat.label;
      tab.addEventListener("click", () => {
        this.closetActiveCategory = cat.id;
        this._renderClosetPanel();
      });
      tabs.appendChild(tab);
    });
    panel.appendChild(tabs);

    const grid = document.createElement("div");
    grid.className = "closet-panel-grid";
    const state = StreakManager.get();
    const equippedList = state.equipped[this.def.id] || [];
    const items = Object.entries(ACCESSORIES).filter(([, acc]) => acc.category === this.closetActiveCategory);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "closet-panel-empty";
      empty.textContent = "Nothing here yet — keep up the streak to unlock more.";
      grid.appendChild(empty);
    }

    items.forEach(([id, acc]) => {
      const unlocked = state.unlockedAccessories.includes(id);
      const equipped = equippedList.includes(id);
      const milestone = ACCESSORY_MILESTONES.find((m) => m.id === id);
      const item = document.createElement("div");
      item.className = "closet-panel-item" + (unlocked ? "" : " locked") + (equipped ? " equipped" : "");
      item.innerHTML = `
        <div class="closet-panel-item-glyph">${acc.glyph}</div>
        <div class="closet-panel-item-name">${acc.name}</div>
        <div class="closet-panel-item-req">${unlocked ? (equipped ? "Equipped ✓" : "Tap to equip") : `${milestone.unlockDays}-day streak`}</div>
      `;
      if (unlocked) {
        item.addEventListener("click", () => {
          this.world.toggleEquip(this.def.id, id);
          this._renderClosetPanel();
        });
      }
      grid.appendChild(item);
    });
    panel.appendChild(grid);
  }

  _buildToyboxPanel() {
    const panel = document.createElement("div");
    panel.className = "cat-closet-panel cat-toybox-panel";
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener("pointerenter", () => this._hoverShow());
    panel.addEventListener("pointerleave", () => this._hoverScheduleHide());
    document.getElementById("cats-layer").appendChild(panel);
    this.toyboxPanelEl = panel;

    document.addEventListener("pointerdown", (e) => {
      if (!this.toyboxPanelOpen) return;
      if (panel.contains(e.target) || this.hoverToyBtn.contains(e.target)) return;
      this.toyboxPanelOpen = false;
      panel.classList.remove("show");
    });
  }

  _toggleToyboxPanel() {
    this.toyboxPanelOpen = !this.toyboxPanelOpen;
    if (this.toyboxPanelOpen) {
      this.clipboardPanelOpen = false; this.clipboardPanelEl.classList.remove("show");
      this.closetPanelOpen = false; this.closetPanelEl.classList.remove("show");
    }
    this.toyboxPanelEl.classList.toggle("show", this.toyboxPanelOpen);
    if (this.toyboxPanelOpen) this._renderToyboxPanel();
  }

  _renderToyboxPanel() {
    const panel = this.toyboxPanelEl;
    panel.innerHTML = "";

    const header = document.createElement("div");
    header.className = "closet-panel-header";
    header.textContent = `${this.def.name}'s toy box`;
    panel.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "closet-panel-grid";
    const unlockedToys = this.world.getUnlockedToys();

    if (!unlockedToys.length) {
      const empty = document.createElement("div");
      empty.className = "closet-panel-empty";
      empty.textContent = "No toys yet — keep up the streak to unlock some.";
      grid.appendChild(empty);
    }

    Object.entries(TOYS).forEach(([id, toy]) => {
      const unlocked = unlockedToys.includes(id);
      const milestone = TOY_MILESTONES.find((m) => m.id === id);
      const item = document.createElement("div");
      item.className = "closet-panel-item" + (unlocked ? "" : " locked") + (this.activeToyId === id && this.playing ? " active-item" : "");
      item.innerHTML = `
        <div class="closet-panel-item-glyph">${toy.glyph}</div>
        <div class="closet-panel-item-name">${toy.name}</div>
        <div class="closet-panel-item-req">${unlocked ? "Tap to play" : `${milestone.unlockDays}-day streak`}</div>
      `;
      if (unlocked) {
        item.addEventListener("click", () => this._startPlay(id));
      }
      grid.appendChild(item);
    });
    panel.appendChild(grid);

    if (this.playing) {
      const hint = document.createElement("div");
      hint.className = "toybox-return-hint";
      hint.textContent = "Playing — tap 🧸 again to call your cat back.";
      panel.appendChild(hint);
    }
  }

  _startPlay(toyId) {
    if (this.dragging) return;
    this._removeActiveToy();
    this.playing = true;
    this.activeToyId = toyId;
    this.queue = [];
    this.currentStep = null;
    this.toyboxPanelOpen = false;
    this.toyboxPanelEl.classList.remove("show");

    const el = document.createElement("div");
    el.className = "active-toy playing";
    el.textContent = TOYS[toyId].glyph;
    document.getElementById("cats-layer").appendChild(el);
    this.activeToyEl = el;
    this.hoverToyBtn.classList.add("active");
    this.hoverToyBtn.title = "Call your cat back";
  }

  // Ends the play session — the toy stays behind on the desk ("left out")
  // until the cat happens to walk over it again, or you unequip by dropping
  // a new toy next time.
  _endPlay() {
    if (!this.playing) return;
    this.playing = false;
    this.activeToyId = null;
    this.hoverToyBtn.classList.remove("active");
    this.hoverToyBtn.title = "Toy box";
    if (this.activeToyEl) this.activeToyEl.classList.remove("playing");
    this.currentStep = { type: "idle", ms: 300 };
  }

  _removeActiveToy() {
    if (this.activeToyEl) { this.activeToyEl.remove(); this.activeToyEl = null; }
  }

  _startDrag() {
    this.dragging = true;
    this.state = "dragged";
    this.dragSwing = 0; this.dragVX = 0; this.dragVY = 0;
    this.queue = [];
    this.currentStep = null;
    this.el.classList.add("dragging");
  }

  _endDrag() {
    this.dragging = false;
    this.el.classList.remove("dragging");
    this._landOnNearestSurface();
    this.state = "idle";
    this.stepStart = performance.now();
    this.currentStep = { type: "idle", ms: 400 };
  }

  // On drop, snap onto whichever window is nearest (within reach) instead of
  // requiring a precise drop onto it — landing dead-center on its top edge —
  // and fall back to the floor only if nothing is close enough.
  _landOnNearestSurface() {
    const SNAP_RADIUS = 170;
    const rects = this.world.getWindowRects();
    let best = null, bestDist = Infinity;
    rects.forEach((r) => {
      const nearX = Math.max(r.left + 12, Math.min(r.left + r.width - 12, this.x));
      const dist = Math.hypot(this.x - nearX, this.footY - r.top);
      if (dist < bestDist) { bestDist = dist; best = { nearX, top: r.top }; }
    });

    if (best && bestDist < SNAP_RADIUS) {
      this.x = best.nearX;
      this.footY = best.top + 6;
    } else {
      this.footY = this.groundFootY();
    }

    const { w } = SPRITEART.sitSize();
    this.x = Math.max(w / 2, Math.min(window.innerWidth - w / 2, this.x));
  }

  pat() {
    if (this.dragging) return;
    this.state = "patted";
    this.patUntil = performance.now() + 1100;
    this.queue = [];
    this.currentStep = null;
    this._spawnHearts();
    if (this.world.getSettings().sound) playPurr();
    this.world.onPat(this.def.id);
  }

  _spawnHearts() {
    const { w, h } = SPRITEART.sitSize();
    const count = 3;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "heart-particle";
      el.innerHTML = PIXEL_HEART_SVG;
      el.style.left = (this.x + w * 0.22 + (Math.random() * 20 - 10)) + "px";
      el.style.top = (this.footY - h - 8) + "px";
      el.style.animationDelay = (i * 120) + "ms";
      document.getElementById("cats-layer").appendChild(el);
      setTimeout(() => el.remove(), 1400 + i * 120);
    }
    if (this.def.palette === "celestial") {
      for (let i = 0; i < 4; i++) {
        const s = document.createElement("div");
        s.className = "sparkle-particle";
        s.textContent = "✨";
        s.style.left = (this.x - w / 2 + Math.random() * w) + "px";
        s.style.top = (this.footY - h + Math.random() * h) + "px";
        s.style.animationDelay = (i * 90) + "ms";
        document.getElementById("cats-layer").appendChild(s);
        setTimeout(() => s.remove(), 1500 + i * 90);
      }
    }
  }

  _planNext() {
    const groundY = this.groundFootY();
    const rects = this.world.getWindowRects();
    const roll = Math.random();
    if (roll < 0.22 && rects.length) {
      const r = rects[Math.floor(Math.random() * rects.length)];
      const targetX = Math.max(30, Math.min(window.innerWidth - 30,
        r.left + 20 + Math.random() * Math.max(10, r.width - 40)));
      const perchY = r.top + 6;
      // Approach whichever side of the window is nearer, then climb the
      // corner diagonally onto the top — never jump straight up.
      const edgeX = (this.x < r.left + r.width / 2)
        ? Math.max(20, r.left + 14)
        : Math.min(window.innerWidth - 20, r.left + r.width - 14);
      this.queue.push({ type: "walk", x: edgeX, footY: groundY });
      this.queue.push({ type: "walk", x: targetX, footY: perchY });
      // While sitting, rigidly track the window's element so dragging the
      // window carries the cat along with it.
      this.queue.push({ type: "sit", ms: 5000 + Math.random() * 5000, anchorEl: r.el, anchorOffsetX: targetX - r.left });
      this.queue.push({ type: "walk", x: edgeX, footY: groundY });
      this.queue.push({ type: "idle", ms: 600 + Math.random() * 900 });
    } else if (roll < 0.85) {
      const targetX = 50 + Math.random() * Math.max(10, window.innerWidth - 120);
      this.queue.push({ type: "walk", x: targetX, footY: groundY });
      this.queue.push({ type: "idle", ms: 900 + Math.random() * 2200 });
    } else if (roll < 0.93) {
      this.queue.push({ type: "sit", ms: 2000 + Math.random() * 2000 });
      this.queue.push({ type: "idle", ms: 400 });
    } else {
      this.queue.push({ type: "lie", ms: 3000 + Math.random() * 3000 });
      this.queue.push({ type: "idle", ms: 400 });
    }
  }

  _updateCursorGlance() {
    // Only an idle (standing-still, not yet settled) cat glances toward the
    // cursor — a lightweight stand-in for live eye/ear tracking. A sitting
    // or lying cat keeps the facing it settled into, so it doesn't flicker
    // left/right while holding still.
    if (this.state !== "idle") return;
    const headX = this.x, headY = this.footY - 60;
    const dist = Math.hypot(CatMouse.x - headX, CatMouse.y - headY);
    if (dist < 190 && Math.abs(CatMouse.x - headX) > 18) {
      this.facing = CatMouse.x > headX ? 1 : -1;
    }
  }

  update(now, dt) {
    const settings = this.world.getSettings();
    if (settings.hidden) {
      this.el.classList.add("hidden-cat");
      this._hideFloatingMenus();
      return;
    }
    this.el.classList.remove("hidden-cat");

    if (this.dragging) {
      // Limbs trail behind the motion like a pendulum: cursor moving right
      // swings them left, moving left swings them right. Moving up or down
      // (or holding still) lets them settle back to hanging straight down.
      const vx = this.dragVX, vy = this.dragVY;
      const horizontal = Math.abs(vx) >= Math.abs(vy) * 0.6;
      const target = horizontal ? Math.max(-1, Math.min(1, -vx / 9)) : 0;
      this.dragSwing += (target - this.dragSwing) * 0.25;
      this.dragVX *= 0.82; // decays when the cursor stops moving
      this.dragVY *= 0.82;
      this._render(now);
      return;
    }

    if (this.state === "patted") {
      if (now >= this.patUntil) this.state = "idle";
      this._render(now);
      return;
    }

    const paused = settings.paused || this.manuallyPaused || this.hoverPaused
      || this.clipboardPanelOpen || this.closetPanelOpen || this.toyboxPanelOpen || this.playing;
    if (paused) {
      if (!this._wasFrozen) {
        // Just became paused/hovered — stop wherever we are and sit upright
        // instead of freezing mid-stride.
        this._wasFrozen = true;
        this.queue = [];
        this.currentStep = null;
        this.state = "sit";
      }
      this._render(now);
      return;
    }
    this._wasFrozen = false;

    this._updateCursorGlance();
    this._maybeDropMess(settings, now);

    if (!this.currentStep) {
      if (this.queue.length === 0) this._planNext();
      this.currentStep = this.queue.shift();
      this.stepStart = now;
      this.stepFromX = this.x; this.stepFromFootY = this.footY;
    }

    const step = this.currentStep;
    if (step.type === "walk") {
      // Walk toward {x, footY} at a constant speed (diagonal if footY
      // differs, e.g. climbing onto a window) — never an instant jump.
      // If the target is behind the cat, turn to face it first instead of
      // sliding backwards.
      const targetFootY = step.footY != null ? step.footY : this.footY;
      const dxw = step.x - this.x;
      const dyw = targetFootY - this.footY;
      const dist = Math.hypot(dxw, dyw);

      if (dist <= 1.5) {
        this.x = step.x; this.footY = targetFootY;
        this.currentStep = null;
      } else {
        // `step.turning` is sticky for the whole 180ms pause — recomputing
        // the direction check fresh every frame would see `this.facing`
        // already updated and immediately clear it after a single frame.
        if (!step.turning) {
          const dir = Math.abs(dxw) > 1 ? Math.sign(dxw) : this.facing;
          if (dir !== this.facing) {
            step.turning = true;
            step.turnStart = now;
            this.facing = dir;
          }
        }
        if (step.turning && now - step.turnStart < 180) {
          this.state = "idle"; // paused, now facing the new direction
        } else {
          step.turning = false;
          this.state = "walk";
          const speed = 52; // px/sec
          const move = Math.min(dist, speed * (dt / 1000));
          this.x += (dxw / dist) * move;
          this.footY += (dyw / dist) * move;
          if (Math.abs(dxw) >= Math.abs(dyw)) {
            this._maybeStampPaw(settings);
          }
        }
      }
    } else if (step.type === "sit") {
      this.state = "sit";
      if (step.anchorEl) {
        // Sitting on a window — ride along with it if it gets dragged, and
        // hop down early if it closes out from under us.
        if (step.anchorEl.offsetParent === null) {
          this.footY = this.groundFootY();
          this.currentStep = null;
        } else {
          this.x = step.anchorEl.offsetLeft + step.anchorOffsetX;
          this.footY = step.anchorEl.offsetTop + 6;
        }
      }
      if (now - this.stepStart >= step.ms) this.currentStep = null;
    } else if (step.type === "lie") {
      this.state = "lying";
      if (now - this.stepStart >= step.ms) this.currentStep = null;
    } else if (step.type === "idle") {
      this.state = "idle";
      if (now - this.stepStart >= step.ms) this.currentStep = null;
    }

    this._render(now);
  }

  _maybeStampPaw(settings) {
    if (!settings.trails) return;
    if (Math.abs(this.footY - this.groundFootY()) > 4) return; // only on the floor
    if (Math.abs(this.x - this.pawStampX) < 15) return;
    this.pawStampX = this.x;
    this.pawSide *= -1;
    const print = document.createElement("div");
    print.className = "paw-print";
    const footX = this.x + this.pawSide * 7 + (Math.random() * 4 - 2);
    const footY = this.footY - 4 + (Math.random() * 4 - 2);
    print.style.left = (footX - 11) + "px";
    print.style.top = (footY - 11) + "px";
    // The toes point "up" in the source art — rotate so they point toward
    // whichever way the cat is facing, like a real print leads the step.
    print.style.transform = `rotate(${this.facing === 1 ? 90 : -90}deg)`;
    print.innerHTML = `<svg viewBox="0 0 24 24"><path fill="#3a2a1f" d="M12 14c-3 0-5.5 2.1-5.5 4.6 0 1.7 1.6 2.9 3.4 2.9 1 0 1.8-.4 2.1-.4.3 0 1.1.4 2.1.4 1.8 0 3.4-1.2 3.4-2.9C17.5 16.1 15 14 12 14z"/><circle cx="7.2" cy="10.5" r="1.7"/><circle cx="10.6" cy="7.8" r="1.7"/><circle cx="13.4" cy="7.8" r="1.7"/><circle cx="16.8" cy="10.5" r="1.7"/></svg>`;
    document.getElementById("trails-layer").appendChild(print);
    requestAnimationFrame(() => { print.style.opacity = "0"; });
    setTimeout(() => print.remove(), 3000);
  }

  // Playful mode: every so often, leave a little mess somewhere on the
  // desktop — click it to pick it up. On a long, randomized cooldown (a
  // few minutes) so they don't pile up fast, and scattered anywhere on
  // screen rather than only underfoot where the cat happens to be walking.
  _maybeDropMess(settings, now) {
    if (!settings.playful) return;
    if (this._nextMessAt == null) this._nextMessAt = now + 120000 + Math.random() * 180000; // first one 2-5 min in
    if (now < this._nextMessAt) return;
    this._nextMessAt = now + 120000 + Math.random() * 180000; // every 2-5 min thereafter

    const glyphs = ["💩", "💩", "🧶", "🐭", "🪶"]; // poop shows up a bit more often than toys
    const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
    const mess = document.createElement("div");
    mess.className = "mess-item";
    mess.textContent = glyph;
    // Anywhere on the desktop, clear of the menu bar up top and the dock
    // down below, instead of always hugging the floor line.
    const margin = 20;
    const mx = margin + Math.random() * (window.innerWidth - margin * 2);
    const my = 50 + Math.random() * (window.innerHeight - 140);
    mess.style.left = (mx - 13) + "px";
    mess.style.top = (my - 13) + "px";
    mess.title = "Click to pick up";
    mess.addEventListener("click", () => {
      if (mess.classList.contains("picked-up")) return;
      mess.classList.add("picked-up");
      this.world.toast(glyph === "💩" ? "Cleaned up after your cat 🧹" : "Picked up a toy left behind 🧸", { icon: "✨" });
      setTimeout(() => mess.remove(), 350);
    });
    document.getElementById("mess-layer").appendChild(mess);
  }

  _currentFrame(now) {
    const palette = this.def.palette;
    if (this.state === "patted") {
      return { name: SPRITEART.FRAME_NAMES.sitFront, anchorKey: "sit_front", ...SPRITEART.sitFrontSize() };
    }
    if (this.dragging) {
      const frames = SPRITEART.FRAME_NAMES.dangle;
      const s = this.dragSwing;
      const idx = s < -0.6 ? 0 : s < -0.2 ? 1 : s <= 0.2 ? 2 : s <= 0.6 ? 3 : 4;
      return { name: frames[idx], anchorKey: "dangle", ...SPRITEART.dangleSize() };
    }
    if (this.state === "walk") {
      const frames = this.facing === 1 ? SPRITEART.FRAME_NAMES.walkR : SPRITEART.FRAME_NAMES.walkL;
      const anchorKey = this.facing === 1 ? "walk_r" : "walk_l";
      const idx = Math.floor(now / 110) % frames.length;
      return { name: frames[idx], anchorKey, ...SPRITEART.walkSize() };
    }
    if (this.state === "lying") {
      const anchorKey = this.facing === 1 ? "lie_r" : "lie_l";
      const name = this.facing === 1 ? SPRITEART.FRAME_NAMES.lieR : SPRITEART.FRAME_NAMES.lieL;
      return { name, anchorKey, ...SPRITEART.lieSize() };
    }
    // idle / sit
    const anchorKey = this.facing === 1 ? "sit_r" : "sit_l";
    const name = this.facing === 1 ? SPRITEART.FRAME_NAMES.sitR : SPRITEART.FRAME_NAMES.sitL;
    return { name, anchorKey, ...SPRITEART.sitSize() };
  }

  _render(now) {
    const palette = this.def.palette;
    const frame = this._currentFrame(now);
    const src = SPRITEART.img(palette, frame.name).src;
    if (this.img.src !== src) this.img.src = src;
    this.img.style.width = frame.w + "px";
    this.img.style.height = frame.h + "px";

    const left = this.x - frame.w / 2;
    const top = this.footY - frame.h;
    this.el.style.left = Math.round(left) + "px";
    this.el.style.top = Math.round(top) + "px";
    this.el.style.width = frame.w + "px";
    this.el.style.height = frame.h + "px";

    if (this.dragging) {
      // Yanked upward, the dangling body stretches down a little.
      const stretch = 1 + Math.min(0.08, Math.max(0, -this.dragVY) / 150);
      this.img.style.transform = `scaleY(${stretch.toFixed(3)})`;
      this.img.style.transformOrigin = "50% 0";
    } else {
      this.img.style.transform = "";
    }

    this._renderAccessories(frame);
    this._renderFloatingUI(frame);
  }

  _renderFloatingUI(frame) {
    // Anchor the hover menu at a stable point near the head, regardless of
    // which pose/frame is currently showing, so it doesn't jitter.
    const headY = this.footY - SPRITEART.sitSize().h * 0.78;
    this.hoverMenuEl.style.left = Math.round(this.x) + "px";
    this.hoverMenuEl.style.top = Math.round(headY) + "px";

    const clipCount = this.clipboard.length;
    this.hoverClipBtn.classList.toggle("has-items", clipCount > 0);
    if (clipCount > 0) this.hoverClipBtn.setAttribute("data-count", String(clipCount));
    else this.hoverClipBtn.removeAttribute("data-count");

    const panelWidth = 210;
    let panelLeft = this.x + frame.w / 2 + 14;
    if (panelLeft + panelWidth > window.innerWidth - 10) panelLeft = this.x - frame.w / 2 - 14 - panelWidth;
    const panelTop = Math.max(34, this.footY - SPRITEART.sitSize().h - 10);
    this.clipboardPanelEl.style.left = Math.round(panelLeft) + "px";
    this.clipboardPanelEl.style.top = Math.round(panelTop) + "px";

    // The closet board floats directly above the cat's head, like a little
    // signboard — centered, and lifted clear of the hover menu's arc.
    const closetWidth = 230;
    let closetLeft = this.x - closetWidth / 2;
    closetLeft = Math.max(10, Math.min(window.innerWidth - closetWidth - 10, closetLeft));
    const closetH = this.closetPanelEl.offsetHeight || 220;
    const closetTop = Math.max(34, headY - closetH - 78);
    this.closetPanelEl.style.left = Math.round(closetLeft) + "px";
    this.closetPanelEl.style.top = Math.round(closetTop) + "px";

    const toyboxWidth = 230;
    let toyboxLeft = this.x - toyboxWidth / 2;
    toyboxLeft = Math.max(10, Math.min(window.innerWidth - toyboxWidth - 10, toyboxLeft));
    const toyboxH = this.toyboxPanelEl.offsetHeight || 220;
    const toyboxTop = Math.max(34, headY - toyboxH - 78);
    this.toyboxPanelEl.style.left = Math.round(toyboxLeft) + "px";
    this.toyboxPanelEl.style.top = Math.round(toyboxTop) + "px";

    // The active toy sits on the ground right beside the cat while it plays.
    if (this.activeToyEl) {
      const toyX = this.x + (this.facing === 1 ? -frame.w * 0.45 : frame.w * 0.45);
      this.activeToyEl.style.left = Math.round(toyX - 11) + "px";
      this.activeToyEl.style.top = Math.round(this.footY - 24) + "px";
    }
  }

  _renderAccessories(frame) {
    const equipped = this.world.getEquipped(this.def.id) || [];
    const anchors = SPRITEART.ANCHORS[frame.anchorKey] || SPRITEART.ANCHORS.sit_front;

    Object.keys(this.accessoryEls).forEach((id) => {
      if (!equipped.includes(id)) {
        this.accessoryEls[id].remove();
        delete this.accessoryEls[id];
      }
    });

    equipped.forEach((id) => {
      const acc = ACCESSORIES[id];
      if (!acc) return;
      let el = this.accessoryEls[id];
      if (!el) {
        el = document.createElement("div");
        el.className = "accessory-badge";
        el.textContent = acc.glyph;
        this.el.appendChild(el);
        this.accessoryEls[id] = el;
      }
      const anchor = anchors[acc.slot] || anchors.neck;
      el.style.left = (frame.w * anchor.x) + "px";
      el.style.top = (frame.h * anchor.y) + "px";
    });
  }

  destroy() {
    Object.values(this.accessoryEls).forEach((el) => el.remove());
    this.clipboard.forEach((item) => { if (item.blobUrl) URL.revokeObjectURL(item.blobUrl); });
    clearTimeout(this._hoverHideTimer);
    this._removeActiveToy();
    this.hoverMenuEl.remove();
    this.clipboardPanelEl.remove();
    this.closetPanelEl.remove();
    this.toyboxPanelEl.remove();
    this.el.remove();
  }
}
