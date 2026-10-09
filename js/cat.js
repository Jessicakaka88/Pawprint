/*
 * Cat — a single desk pet: its DOM element, wander/perch AI, drag & pat
 * interaction, paw-print trail, and particle effects.
 */

const CatMouse = { x: -9999, y: -9999 };
document.addEventListener("pointermove", (e) => { CatMouse.x = e.clientX; CatMouse.y = e.clientY; });

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
    this.world = world;       // callbacks: onPat(result), getSettings(), getEquipped(id)
    this.facing = 1;
    this.x = 120 + Math.random() * 300;
    this.y = this.floorY();
    this.state = "idle";
    this.queue = [];
    this.currentStep = null;
    this.stepStart = 0;
    this.stepFromX = this.x; this.stepFromY = this.y;
    this.patUntil = 0;
    this.lookX = 0; this.lookY = 0;
    this.dragSwing = 0;
    this.dragging = false;
    this.pawStampX = this.x;
    this.blinkSeed = Math.random() * 10;
    this.sleepy = false;

    this._buildDom();
    this._wireInput();
  }

  floorY() {
    return window.innerHeight - 96 - PIXELART.CANVAS_H;
  }

  _buildDom() {
    const el = document.createElement("div");
    el.className = "cat";
    el.style.width = PIXELART.CANVAS_W + "px";
    el.style.height = PIXELART.CANVAS_H + "px";
    const { canvas, ctx } = PIXELART.makeCanvas();
    el.appendChild(canvas);
    const tag = document.createElement("div");
    tag.className = "cat-name-tag";
    tag.textContent = this.def.name;
    el.appendChild(tag);
    document.getElementById("cats-layer").appendChild(el);
    this.el = el;
    this.canvas = canvas;
    this.ctx = ctx;
  }

  _wireInput() {
    let downX, downY, downT, movedFar, pointerOffsetX, pointerOffsetY;
    this.el.addEventListener("pointerdown", (e) => {
      if (this.world.getSettings().paused) return;
      downX = e.clientX; downY = e.clientY; downT = performance.now();
      movedFar = false;
      pointerOffsetX = e.clientX - this.x;
      pointerOffsetY = e.clientY - this.y;
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
        this.y = e.clientY - pointerOffsetY;
        this.dragSwing = Math.max(-1, Math.min(1, (this.x - prevX) / 8));
        this.facing = (e.movementX || 0) >= 0 ? 1 : -1;
      }
    });
    const finish = (e) => {
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
    // Land on whichever surface (a window top, or the floor) is under the cat now.
    const landing = this._surfaceBelow(this.x + PIXELART.CANVAS_W / 2, this.y + PIXELART.CANVAS_H);
    this.y = landing;
    this.x = Math.max(4, Math.min(window.innerWidth - PIXELART.CANVAS_W - 4, this.x));
    this.state = "idle";
    this.stepStart = performance.now();
    this.currentStep = { type: "idle", ms: 400 };
  }

  _surfaceBelow(centerX, feetY) {
    const rects = this.world.getWindowRects();
    for (const r of rects) {
      if (centerX > r.left + 6 && centerX < r.left + r.width - 6) {
        const topY = r.top - PIXELART.CANVAS_H + 18;
        if (feetY > r.top - 40 && feetY < r.top + r.height) return topY;
      }
    }
    return this.floorY();
  }

  pat() {
    if (this.dragging) return;
    this.state = "patted";
    this.patUntil = performance.now() + 1100;
    this.queue = [];
    this.currentStep = null;
    this._spawnHearts();
    if (this.world.getSettings().sound) playPurr();
    const result = this.world.onPat(this.def.id);
    if (result && result.milestonesHit && result.milestonesHit.length) {
      // handled by UI via onPat callback
    }
  }

  _spawnHearts() {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const h = document.createElement("div");
      h.className = "heart-particle";
      h.textContent = Math.random() > 0.5 ? "💗" : "💕";
      h.style.left = (this.x + PIXELART.CANVAS_W * 0.55 + (Math.random() * 20 - 10)) + "px";
      h.style.top = (this.y + 4) + "px";
      h.style.animationDelay = (i * 120) + "ms";
      document.getElementById("cats-layer").appendChild(h);
      setTimeout(() => h.remove(), 1400 + i * 120);
    }
    if (this.def.palette === "celestial") {
      for (let i = 0; i < 4; i++) {
        const s = document.createElement("div");
        s.className = "sparkle-particle";
        s.textContent = "✨";
        s.style.left = (this.x + Math.random() * PIXELART.CANVAS_W) + "px";
        s.style.top = (this.y + Math.random() * PIXELART.CANVAS_H) + "px";
        s.style.animationDelay = (i * 90) + "ms";
        document.getElementById("cats-layer").appendChild(s);
        setTimeout(() => s.remove(), 1500 + i * 90);
      }
    }
  }

  _planNext() {
    const floorY = this.floorY();
    const rects = this.world.getWindowRects();
    const roll = Math.random();
    if (roll < 0.22 && rects.length) {
      const r = rects[Math.floor(Math.random() * rects.length)];
      const targetX = Math.max(10, Math.min(window.innerWidth - PIXELART.CANVAS_W - 10,
        r.left + 16 + Math.random() * Math.max(10, r.width - 32)));
      const perchY = r.top - PIXELART.CANVAS_H + 18;
      this.queue.push({ type: "walk", x: targetX, y: floorY });
      this.queue.push({ type: "hop", x: targetX, y: perchY, ms: 360 });
      this.queue.push({ type: "sit", ms: 2600 + Math.random() * 2600 });
      this.queue.push({ type: "hop", x: targetX, y: floorY, ms: 360 });
      this.queue.push({ type: "idle", ms: 600 + Math.random() * 900 });
    } else if (roll < 0.85) {
      const targetX = 30 + Math.random() * Math.max(10, window.innerWidth - 220);
      this.queue.push({ type: "walk", x: targetX, y: floorY });
      this.queue.push({ type: "idle", ms: 900 + Math.random() * 2200 });
    } else {
      this.sleepy = true;
      this.queue.push({ type: "sit", ms: 2000 + Math.random() * 2000 });
      this.queue.push({ type: "idle", ms: 400 });
    }
  }

  update(now, dt) {
    const settings = this.world.getSettings();
    if (settings.hidden) { this.el.classList.add("hidden-cat"); return; }
    this.el.classList.remove("hidden-cat");

    // cursor reaction (always active, independent of pause, like a passive sense)
    const cx = this.x + PIXELART.CANVAS_W * 0.68, cy = this.y + PIXELART.CANVAS_H * 0.4;
    const dx = CatMouse.x - cx, dy = CatMouse.y - cy;
    const dist = Math.hypot(dx, dy);
    const radius = 170;
    if (dist < radius) {
      this.lookX += ((dx / radius) - this.lookX) * 0.12;
      this.lookY += ((dy / radius) - this.lookY) * 0.12;
    } else {
      this.lookX += (0 - this.lookX) * 0.06;
      this.lookY += (0 - this.lookY) * 0.06;
    }

    if (this.dragging) {
      this.dragSwing *= 0.9;
      this._render(now);
      return;
    }

    if (this.state === "patted") {
      if (now >= this.patUntil) { this.state = "idle"; this.sleepy = false; }
      this._render(now);
      return;
    }

    if (settings.paused) { this._render(now); return; }

    if (!this.currentStep) {
      if (this.queue.length === 0) this._planNext();
      this.currentStep = this.queue.shift();
      this.stepStart = now;
      this.stepFromX = this.x; this.stepFromY = this.y;
      this.sleepy = this.currentStep.type === "sit" && Math.random() < 0.4;
    }

    const step = this.currentStep;
    if (step.type === "walk") {
      this.state = "walk";
      const speed = 52; // px/sec
      const dxw = step.x - this.x;
      if (Math.abs(dxw) > 1) {
        this.facing = dxw > 0 ? 1 : -1;
        const move = speed * (dt / 1000);
        this.x += Math.sign(dxw) * Math.min(Math.abs(dxw), move);
        this._maybeStampPaw(now, settings);
      } else {
        this.currentStep = null;
      }
    } else if (step.type === "hop") {
      this.state = "walk";
      const elapsed = now - this.stepStart;
      const p = Math.min(1, elapsed / step.ms);
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      this.x = this.stepFromX + (step.x - this.stepFromX) * ease;
      const bump = Math.sin(p * Math.PI) * -10;
      this.y = this.stepFromY + (step.y - this.stepFromY) * ease + bump;
      if (p >= 1) { this.x = step.x; this.y = step.y; this.currentStep = null; }
    } else if (step.type === "sit") {
      this.state = "sit";
      if (now - this.stepStart >= step.ms) this.currentStep = null;
    } else if (step.type === "idle") {
      this.state = "idle";
      if (now - this.stepStart >= step.ms) this.currentStep = null;
    }

    this._render(now);
  }

  _maybeStampPaw(now, settings) {
    if (!settings.trails) return;
    if (Math.abs(this.x - this.pawStampX) < 16) return;
    this.pawStampX = this.x;
    const print = document.createElement("div");
    print.className = "paw-print";
    const footX = this.x + PIXELART.CANVAS_W * 0.32 + (Math.random() * 6 - 3);
    const footY = this.y + PIXELART.CANVAS_H - 6 + (Math.random() * 4 - 2);
    print.style.left = (footX - 11) + "px";
    print.style.top = (footY - 11) + "px";
    print.style.transform = `scaleX(${this.facing})`;
    print.innerHTML = `<svg viewBox="0 0 24 24"><path fill="#3a2a1f" d="M12 14c-3 0-5.5 2.1-5.5 4.6 0 1.7 1.6 2.9 3.4 2.9 1 0 1.8-.4 2.1-.4.3 0 1.1.4 2.1.4 1.8 0 3.4-1.2 3.4-2.9C17.5 16.1 15 14 12 14z"/><circle cx="7.2" cy="10.5" r="1.7"/><circle cx="10.6" cy="7.8" r="1.7"/><circle cx="13.4" cy="7.8" r="1.7"/><circle cx="16.8" cy="10.5" r="1.7"/></svg>`;
    document.getElementById("trails-layer").appendChild(print);
    requestAnimationFrame(() => { print.style.opacity = "0"; });
    setTimeout(() => print.remove(), 3000);
  }

  _render(now) {
    this.el.style.left = Math.round(this.x) + "px";
    this.el.style.top = Math.round(this.y) + "px";
    PIXELART.draw(this.ctx, {
      palette: this.def.palette,
      facing: this.facing,
      pose: this.state,
      t: now,
      lookX: this.lookX,
      lookY: this.lookY,
      dragSwing: this.dragSwing,
      sleepy: this.sleepy,
      blinkSeed: this.blinkSeed,
      accessories: this.world.getEquipped(this.def.id),
    });
  }

  destroy() {
    this.el.remove();
  }
}
