/*
 * Procedural pixel-art cat renderer.
 *
 * Cats are drawn at a tiny internal resolution onto a <canvas>, with image
 * smoothing disabled and the canvas scaled up by CSS — that's what gives
 * the chunky "pixel art" look while still letting every pose be driven by
 * continuous animation parameters (no hand-authored sprite sheets needed).
 */

const PIXELART = (() => {
  const W = 24, H = 20;     // internal drawing resolution
  const SCALE = 5;          // on-screen pixel multiplier
  const CANVAS_W = W * SCALE;
  const CANVAS_H = H * SCALE;

  // ---- Cat color palettes -------------------------------------------------
  const PALETTES = {
    mochi: {
      body: "#e89a52", shade: "#cf7f3a", belly: "#fff3e0",
      ear: "#ffc2ce", eye: "#2c2c2c", nose: "#ff8fa3", outline: "#8a4a1e",
      stripe: "#d1823f",
    },
    shadow: {
      body: "#32323c", shade: "#222229", belly: "#55555f",
      ear: "#ffc2ce", eye: "#cdf04d", nose: "#ff8fa3", outline: "#17171c",
      stripe: "#26262e",
    },
    snowy: {
      body: "#f7f2e7", shade: "#e2dac8", belly: "#ffffff",
      ear: "#ffc2ce", eye: "#6fa8dc", nose: "#ff8fa3", outline: "#b9ad93",
      stripe: "#ece2cc",
    },
    celestial: {
      body: "#f4c768", shade: "#dba53a", belly: "#fff3d2",
      ear: "#ffd1e6", eye: "#8a5cf5", nose: "#ff8fa3", outline: "#9a6a16",
      stripe: "#eab84f", sparkle: true,
    },
  };

  // ---- Accessory catalog (drawn as overlays) ------------------------------
  const ACCESSORIES = {
    bandana: { name: "Red Bandana", glyph: "🧣", color: "#e2443b" },
    bowtie: { name: "Blue Bowtie", glyph: "🎀", color: "#3b6ee2" },
    party_hat: { name: "Party Hat", glyph: "🎉", color: "#f2538f" },
    bell_collar: { name: "Bell Collar", glyph: "🔔", color: "#f2c230" },
    flower_crown: { name: "Flower Crown", glyph: "🌸", color: "#f58fc0" },
    scarf: { name: "Cozy Scarf", glyph: "🧶", color: "#8e5cf0" },
  };

  function rr(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function px(ctx, x, y, color) { rr(ctx, x, y, 1, 1, color); }

  // Draw a filled ellipse made of blocky pixel rows (keeps the pixel-art feel
  // instead of a smooth canvas arc).
  function blockEllipse(ctx, cx, cy, rx, ry, color) {
    const y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y - cy) / ry;
      const span = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
      rr(ctx, cx - span, y, span * 2, 1, color);
    }
  }

  function clearCanvas(ctx) {
    ctx.clearRect(0, 0, W, H);
  }

  // Stamps blocky squares along a segment to approximate a thick pixel-art line.
  function thickLine(ctx, x0, y0, x1, y1, w, color) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(dist * 1.4));
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps;
      const x = x0 + (x1 - x0) * tt;
      const y = y0 + (y1 - y0) * tt;
      rr(ctx, x - w / 2, y - w / 2, w, w, color);
    }
  }

  /**
   * params:
   *  facing: 1 (right) | -1 (left)
   *  palette: key into PALETTES
   *  pose: 'idle' | 'walk' | 'sit' | 'dragged' | 'patted'
   *  t: elapsed ms (for internal oscillation)
   *  walkSpeed: 0..1 how fast legs cycle
   *  lookX, lookY: -1..1 pupil look offset toward cursor
   *  dragSwing: -1..1 horizontal swing while dragged
   *  accessories: array of accessory ids
   */
  function draw(ctx, p) {
    const pal = PALETTES[p.palette] || PALETTES.mochi;
    clearCanvas(ctx);
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.scale(p.facing, 1);
    ctx.translate(-W / 2, 0);

    const t = p.t || 0;
    const bob = (p.pose === "dragged") ? 0 : Math.sin(t / 260) * (p.pose === "walk" ? 0.5 : 0.35);
    const bodyY = 12.3 + bob;

    // ---- Tail -------------------------------------------------------------
    drawTail(ctx, pal, p, t, bodyY);

    // ---- Body ---------------------------------------------------------------
    blockEllipse(ctx, 9.3, bodyY, 6.3, 4.6, pal.shade);
    blockEllipse(ctx, 9.6, bodyY - 0.4, 6.0, 4.1, pal.body);
    blockEllipse(ctx, 9.8, bodyY + 1.6, 4.1, 2.4, pal.belly);
    // a couple of tabby stripes for charm
    rr(ctx, 7.6, bodyY - 3.1, 1.0, 1.6, pal.stripe);
    rr(ctx, 10.6, bodyY - 3.4, 1.0, 1.8, pal.stripe);

    // ---- Legs (drawn before head so head overlaps shoulders nicely) -------
    drawLegs(ctx, pal, p, t, bodyY);

    // ---- Head ---------------------------------------------------------------
    const headCx = 16.6, headCy = 8.1 + bob;
    drawEars(ctx, pal, p, headCx, headCy);
    blockEllipse(ctx, headCx, headCy, 4.4, 4.0, pal.shade);
    blockEllipse(ctx, headCx + 0.2, headCy - 0.3, 4.1, 3.7, pal.body);

    // muzzle / chin light patch
    blockEllipse(ctx, headCx + 0.6, headCy + 1.6, 2.1, 1.4, pal.belly);

    drawFace(ctx, pal, p, headCx, headCy, t);

    // ---- Accessories --------------------------------------------------------
    drawAccessories(ctx, p, headCx, headCy, bodyY);

    // ---- Sparkle flair for the celestial cat --------------------------------
    if (pal.sparkle && Math.sin(t / 400) > 0.6) {
      px(ctx, headCx - 3 + Math.sin(t / 150) * 2, headCy - 3, "#ffffff");
    }

    ctx.restore();
  }

  function drawEars(ctx, pal, p, headCx, headCy) {
    const perk = p.pose === "patted" ? -0.15 : (p.pose === "dragged" ? 0.35 : 0);
    const look = (p.lookX || 0) * 0.25;
    [{ dx: -2.1, side: -1 }, { dx: 1.9, side: 1 }].forEach(({ dx, side }) => {
      const angle = perk * side + look;
      const baseX = headCx + dx, baseY = headCy - 2.6;
      const tipX = baseX + side * 1.3 + angle * 4;
      const tipY = baseY - 3.0 + Math.abs(angle) * 2;
      ctx.fillStyle = pal.shade;
      triangle(ctx, baseX - 1.1, baseY + 0.6, baseX + 1.1, baseY + 0.6, tipX, tipY);
      ctx.fillStyle = pal.ear;
      const ix = baseX + side * 0.2, iy = baseY - 0.4;
      triangle(ctx, ix - 0.5, iy + 0.3, ix + 0.5, iy + 0.3, (baseX + tipX) / 2, (baseY + tipY) / 2 - 0.3);
    });
  }

  function triangle(ctx, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x1), Math.round(y1));
    ctx.lineTo(Math.round(x2), Math.round(y2));
    ctx.lineTo(Math.round(x3), Math.round(y3));
    ctx.closePath();
    ctx.fill();
  }

  function drawFace(ctx, pal, p, cx, cy, t) {
    const blink = (!p.forceClosed) && (Math.sin(t / 900 + (p.blinkSeed || 0)) > 0.985);
    const closed = p.pose === "patted" || blink || p.pose === "sit" && p.sleepy;
    const wide = p.pose === "dragged";
    const lookX = (p.lookX || 0) * 0.6;
    const lookY = (p.lookY || 0) * 0.4;

    const eyeOffsets = [{ dx: -0.9, dy: -0.1 }, { dx: 1.1, dy: -0.3 }];
    eyeOffsets.forEach(({ dx, dy }) => {
      const ex = cx + dx + 1.0, ey = cy + dy;
      if (closed) {
        rr(ctx, ex - 0.7, ey, 1.4, 0.4, pal.outline);
      } else if (wide) {
        rr(ctx, ex - 1.0, ey - 1.2, 2.0, 2.3, "#ffffff");
        rr(ctx, ex - 0.5 + lookX * 0.7, ey - 0.6 + lookY * 0.6, 1.0, 1.1, pal.eye);
      } else {
        blockEllipse(ctx, ex, ey, 0.7, 0.85, pal.eye);
        px(ctx, ex + lookX * 0.5, ey - 0.3 + lookY * 0.3, "#ffffff");
      }
    });

    // nose
    const nx = cx + 1.6, ny = cy + 1.1;
    triangle(ctx, nx - 0.5, ny - 0.3, nx + 0.5, ny - 0.3, nx, ny + 0.4);
    ctx.fillStyle = pal.nose;
    ctx.fill();
    rr(ctx, nx - 0.5, ny - 0.3, 1.0, 0.7, pal.nose);

    // mouth: little purring "w" when patted, neutral line otherwise
    ctx.fillStyle = pal.outline;
    if (p.pose === "patted") {
      rr(ctx, nx - 1.1, ny + 1.0, 0.5, 0.5, pal.outline);
      rr(ctx, nx - 0.2, ny + 1.3, 0.5, 0.5, pal.outline);
      rr(ctx, nx + 0.7, ny + 1.0, 0.5, 0.5, pal.outline);
    } else {
      rr(ctx, nx - 0.3, ny + 1.0, 0.6, 0.4, pal.outline);
    }

    // whiskers
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    [0, 1, 2].forEach((i) => {
      rr(ctx, cx + 2.6, cy + 0.6 + i * 0.6 - 0.6, 2.4 - i * 0.3, 0.25, "rgba(255,255,255,0.5)");
    });
  }

  function drawTail(ctx, pal, p, t, bodyY) {
    const base = { x: 3.2, y: bodyY - 0.4 };
    let angle;
    if (p.pose === "dragged") {
      angle = -1.1 + (p.dragSwing || 0) * 0.3; // droops down
    } else if (p.pose === "patted") {
      angle = -0.5 + Math.sin(t / 90) * 0.9; // fast happy wag
    } else if (p.pose === "walk") {
      angle = -0.3 + Math.sin(t / 220) * 0.5;
    } else {
      angle = -0.35 + Math.sin(t / 700) * 0.22; // gentle idle sway
    }
    let x = base.x, y = base.y;
    for (let i = 0; i < 6; i++) {
      const segAngle = angle - i * 0.18;
      x -= Math.cos(segAngle) * 1.35;
      y -= Math.sin(segAngle) * 1.35 - 0.15;
      const size = Math.max(1.0, 1.6 - i * 0.12);
      ctx.fillStyle = i % 3 === 2 ? pal.stripe : pal.body;
      blockEllipse(ctx, x, y, size * 0.75, size * 0.6, ctx.fillStyle);
    }
  }

  function drawLegs(ctx, pal, p, t, bodyY) {
    const legBaseY = bodyY + 3.6;
    const pairs = [
      { x: 12.2, group: "front" },
      { x: 14.6, group: "front" },
      { x: 5.0, group: "back" },
      { x: 7.3, group: "back" },
    ];

    if (p.pose === "dragged") {
      // legs hang long and loosely tangled beneath the body, each bending
      // partway down so they visibly cross one another.
      const swing = (p.dragSwing || 0);
      const legs = [
        { baseX: 5.6, bend: 2.0, len1: 2.6, len2: 3.4, dir: 1 },
        { baseX: 8.2, bend: -1.6, len1: 3.0, len2: 3.0, dir: -1 },
        { baseX: 10.8, bend: 1.7, len1: 2.7, len2: 3.6, dir: 1 },
        { baseX: 13.2, bend: -2.1, len1: 3.2, len2: 2.9, dir: -1 },
      ];
      legs.forEach((leg) => {
        const x0 = leg.baseX + swing * leg.dir * 0.5;
        const y0 = legBaseY - 0.5;
        const x1 = x0 + leg.bend * 0.45 + swing * 0.5;
        const y1 = y0 + leg.len1;
        const x2 = x1 + leg.bend * 0.8 + swing * 0.7;
        const y2 = y1 + leg.len2;
        thickLine(ctx, x0, y0, x1, y1, 1.15, pal.shade);
        thickLine(ctx, x1, y1, x2, y2, 1.0, pal.shade);
        blockEllipse(ctx, x2, y2, 0.75, 0.65, pal.ear);
      });
      return;
    }

    pairs.forEach((leg, i) => {
      let swingOff = 0, lenOff = 0;
      if (p.pose === "walk") {
        const phase = (t / 160) + (i % 2 === 0 ? 0 : Math.PI);
        swingOff = Math.sin(phase) * 1.1;
        lenOff = Math.max(0, Math.cos(phase)) * -0.8;
      } else if (p.pose === "sit") {
        lenOff = -1.4;
      }
      const len = 3.2 + lenOff;
      ctx.fillStyle = pal.shade;
      rr(ctx, leg.x + swingOff * 0.4 - 0.7, legBaseY, 1.6, len, pal.shade);
      ctx.fillStyle = pal.ear;
      rr(ctx, leg.x + swingOff * 0.4 - 0.7, legBaseY + len - 1.0, 1.6, 1.0, pal.ear);
    });
  }

  function drawAccessories(ctx, p, headCx, headCy, bodyY) {
    const list = p.accessories || [];
    if (list.includes("bell_collar")) {
      rr(ctx, headCx - 2.6, headCy + 2.9, 5.6, 1.1, "#f2c230");
      blockEllipse(ctx, headCx, headCy + 4.1, 0.7, 0.7, "#f6da5c");
    }
    if (list.includes("bandana")) {
      ctx.fillStyle = "#e2443b";
      triangle(ctx, headCx - 3.0, headCy + 2.6, headCx + 3.0, headCy + 2.6, headCx, headCy + 5.3);
      rr(ctx, headCx - 3.0, headCy + 2.2, 6.0, 1.1, "#e2443b");
    }
    if (list.includes("bowtie")) {
      ctx.fillStyle = "#3b6ee2";
      triangle(ctx, headCx - 0.2, headCy + 3.0, headCx - 2.2, headCy + 2.0, headCx - 2.2, headCy + 4.0);
      triangle(ctx, headCx - 0.2, headCy + 3.0, headCx + 1.8, headCy + 2.0, headCx + 1.8, headCy + 4.0);
      rr(ctx, headCx - 0.8, headCy + 2.6, 1.2, 0.8, "#294fb0");
    }
    if (list.includes("party_hat")) {
      ctx.fillStyle = "#f2538f";
      triangle(ctx, headCx - 1.6, headCy - 3.6, headCx + 1.6, headCy - 3.6, headCx, headCy - 8.4);
      rr(ctx, headCx - 0.3, headCy - 8.6, 0.8, 0.8, "#ffe34d");
    }
    if (list.includes("flower_crown")) {
      ["#f58fc0", "#f6c447", "#8fd4f5"].forEach((c, i) => {
        ctx.fillStyle = c;
        blockEllipse(ctx, headCx - 2.4 + i * 2.4, headCy - 3.9, 0.7, 0.7, c);
      });
    }
    if (list.includes("scarf")) {
      rr(ctx, headCx - 3.0, headCy + 2.4, 6.2, 1.6, "#8e5cf0");
      rr(ctx, headCx - 2.4, headCy + 3.8, 1.4, 2.0, "#7a48d9");
    }
  }

  function makeCanvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.style.width = CANVAS_W + "px";
    c.style.height = CANVAS_H + "px";
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  }

  return {
    W, H, SCALE, CANVAS_W, CANVAS_H,
    PALETTES, ACCESSORIES,
    draw, makeCanvas,
  };
})();
