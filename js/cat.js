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
    this.dragSwing = 0;
    this.dragging = false;
    this.pawStampX = this.x;
    this.pawSide = 1;
    this.accessoryEls = {};

    this._buildDom();
    this._wireInput();
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
    });
    this.el.addEventListener("pointermove", (e) => {
      if (downX == null) return;
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (!movedFar && Math.hypot(dx, dy) > 6) {
        movedFar = true;
        this._startDrag();
      }
      if (movedFar) {
        const prevX = this.x;
        this.x = e.clientX - pointerOffsetX;
        this.footY = e.clientY - pointerOffsetY;
        this.dragSwing = Math.max(-1, Math.min(1, (this.x - prevX) / 8));
        if (Math.abs(e.movementX || 0) > 0.5) this.facing = (e.movementX || 0) >= 0 ? 1 : -1;
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
    };
    this.el.addEventListener("pointerup", finish);
    this.el.addEventListener("pointercancel", finish);
  }

  _startDrag() {
    this.dragging = true;
    this.state = "dragged";
    this.queue = [];
    this.currentStep = null;
    this.el.classList.add("dragging");
  }

  _endDrag() {
    this.dragging = false;
    this.el.classList.remove("dragging");
    this.footY = this._surfaceBelow(this.x, this.footY);
    const { w } = SPRITEART.sitSize();
    this.x = Math.max(w / 2, Math.min(window.innerWidth - w / 2, this.x));
    this.state = "idle";
    this.stepStart = performance.now();
    this.currentStep = { type: "idle", ms: 400 };
  }

  _surfaceBelow(centerX, footY) {
    const rects = this.world.getWindowRects();
    for (const r of rects) {
      if (centerX > r.left + 6 && centerX < r.left + r.width - 6) {
        if (footY > r.top - 40 && footY < r.top + r.height) return r.top + 6;
      }
    }
    return this.groundFootY();
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
      this.queue.push({ type: "sit", ms: 2600 + Math.random() * 2600 });
      this.queue.push({ type: "walk", x: edgeX, footY: groundY });
      this.queue.push({ type: "idle", ms: 600 + Math.random() * 900 });
    } else if (roll < 0.85) {
      const targetX = 50 + Math.random() * Math.max(10, window.innerWidth - 120);
      this.queue.push({ type: "walk", x: targetX, footY: groundY });
      this.queue.push({ type: "idle", ms: 900 + Math.random() * 2200 });
    } else {
      this.queue.push({ type: "sit", ms: 2000 + Math.random() * 2000 });
      this.queue.push({ type: "idle", ms: 400 });
    }
  }

  _updateCursorGlance() {
    // When idle/sitting still, turn to face the cursor if it comes close —
    // a lightweight stand-in for live eye/ear tracking.
    if (this.state !== "idle" && this.state !== "sit") return;
    const headX = this.x, headY = this.footY - 60;
    const dist = Math.hypot(CatMouse.x - headX, CatMouse.y - headY);
    if (dist < 190 && Math.abs(CatMouse.x - headX) > 18) {
      this.facing = CatMouse.x > headX ? 1 : -1;
    }
  }

  update(now, dt) {
    const settings = this.world.getSettings();
    if (settings.hidden) { this.el.classList.add("hidden-cat"); return; }
    this.el.classList.remove("hidden-cat");

    if (this.dragging) {
      this.dragSwing *= 0.9;
      this._render(now);
      return;
    }

    if (this.state === "patted") {
      if (now >= this.patUntil) this.state = "idle";
      this._render(now);
      return;
    }

    if (settings.paused) { this._render(now); return; }

    this._updateCursorGlance();

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
        const dir = Math.abs(dxw) > 1 ? Math.sign(dxw) : this.facing;
        const turning = dir !== this.facing;
        if (turning) {
          if (!step.turnStart) step.turnStart = now;
          this.facing = dir;
        }
        if (turning && now - step.turnStart < 180) {
          this.state = "idle"; // paused, now facing the new direction
        } else {
          this.state = "walk";
          const speed = 52; // px/sec
          const move = Math.min(dist, speed * (dt / 1000));
          this.x += (dxw / dist) * move;
          this.footY += (dyw / dist) * move;
          if (Math.abs(dxw) >= Math.abs(dyw)) this._maybeStampPaw(settings);
        }
      }
    } else if (step.type === "sit") {
      this.state = "sit";
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
    print.style.transform = `scaleX(${this.facing})`;
    print.innerHTML = `<svg viewBox="0 0 24 24"><path fill="#3a2a1f" d="M12 14c-3 0-5.5 2.1-5.5 4.6 0 1.7 1.6 2.9 3.4 2.9 1 0 1.8-.4 2.1-.4.3 0 1.1.4 2.1.4 1.8 0 3.4-1.2 3.4-2.9C17.5 16.1 15 14 12 14z"/><circle cx="7.2" cy="10.5" r="1.7"/><circle cx="10.6" cy="7.8" r="1.7"/><circle cx="13.4" cy="7.8" r="1.7"/><circle cx="16.8" cy="10.5" r="1.7"/></svg>`;
    document.getElementById("trails-layer").appendChild(print);
    requestAnimationFrame(() => { print.style.opacity = "0"; });
    setTimeout(() => print.remove(), 3000);
  }

  _currentFrame(now) {
    const palette = this.def.palette;
    if (this.state === "patted") {
      return { name: SPRITEART.FRAME_NAMES.sitFront, anchorKey: "sit_front", ...SPRITEART.sitSize() };
    }
    if (this.dragging) {
      const frames = this.facing === 1 ? SPRITEART.FRAME_NAMES.walkR : SPRITEART.FRAME_NAMES.walkL;
      const anchorKey = this.facing === 1 ? "walk_r" : "walk_l";
      return { name: frames[3], anchorKey, ...SPRITEART.walkSize() };
    }
    if (this.state === "walk") {
      const frames = this.facing === 1 ? SPRITEART.FRAME_NAMES.walkR : SPRITEART.FRAME_NAMES.walkL;
      const anchorKey = this.facing === 1 ? "walk_r" : "walk_l";
      const idx = Math.floor(now / 110) % frames.length;
      return { name: frames[idx], anchorKey, ...SPRITEART.walkSize() };
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
      const tilt = (this.dragSwing || 0) * 12;
      const skew = (this.dragSwing || 0) * -6;
      this.img.style.transform = `rotate(${tilt}deg) skewX(${skew}deg) scaleY(1.14)`;
      this.img.style.transformOrigin = "50% 15%";
    } else {
      this.img.style.transform = "";
    }

    this._renderAccessories(frame);
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
    this.el.remove();
  }
}
