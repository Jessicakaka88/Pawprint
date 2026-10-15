/*
 * Hand-drawn pixel-art cat sprites (assets/cats/<palette>/*.png), derived
 * from a single reference sheet and recolored per cat. Frame dimensions are
 * fixed per pose group (see assets/cats/manifest.json) so animation frames
 * never jitter — every frame in a group is pre-padded to the same canvas
 * and anchored to the same bottom edge (the cat's feet).
 */

const SPRITEART = (() => {
  const PALETTE_KEYS = ["shadow", "mochi", "snowy", "celestial"];
  const DISPLAY_SCALE = 0.52;

  // Pixel dimensions of each pose group's shared frame canvas (see assets/cats/manifest.json).
  const DIMS = {
    sit: { w: 202, h: 157 },
    sitFront: { w: 177, h: 189 }, // front-facing "patted" pose — its own older canvas, untouched by the sit_l/sit_r art swap
    walk: { w: 223, h: 159 }, // walk_l and walk_r share this padded size
    dangle: { w: 158, h: 290 }, // lifted by the scruff; all swing frames share this canvas
    lie: { w: 218, h: 135 }, // lying down, resting on the floor
  };

  const FRAME_NAMES = {
    sitFront: "sit_front",
    sitR: "sit_r",
    sitL: "sit_l",
    lieR: "lie_r",
    lieL: "lie_l",
    walkR: Array.from({ length: 6 }, (_, i) => `walk_r_${i + 1}`),
    walkL: Array.from({ length: 6 }, (_, i) => `walk_l_${i + 1}`),
    // Lifted by the scruff, limbs dangling. Ordered from limbs swung far
    // left to far right; index 2 hangs straight down.
    dangle: ["dangle_l2", "dangle_l1", "dangle", "dangle_r1", "dangle_r2"],
  };

  // Where the scruff (the spot the cursor holds) sits in a dangle frame,
  // as a ratio of the frame from top-left.
  const DANGLE_SCRUFF = { x: 0.5, y: 0.07 };

  // Approximate accessory anchor points (ratio of frame width/height, from
  // top-left) for each facing/pose, hand-picked by eyeballing the art.
  const ANCHORS = {
    walk_r: { head: { x: 0.76, y: 0.0 }, neck: { x: 0.64, y: 0.56 }, feet: { x: 0.58, y: 0.97 } },
    walk_l: { head: { x: 0.24, y: 0.0 }, neck: { x: 0.36, y: 0.56 }, feet: { x: 0.42, y: 0.97 } },
    sit_r: { head: { x: 0.79, y: 0.0 }, neck: { x: 0.68, y: 0.32 }, feet: { x: 0.65, y: 0.88 } },
    sit_l: { head: { x: 0.21, y: 0.0 }, neck: { x: 0.32, y: 0.32 }, feet: { x: 0.35, y: 0.88 } },
    sit_front: { head: { x: 0.5, y: 0.0 }, neck: { x: 0.5, y: 0.6 }, feet: { x: 0.5, y: 0.97 } },
    dangle: { head: { x: 0.5, y: 0.0 }, neck: { x: 0.5, y: 0.3 }, feet: { x: 0.5, y: 0.82 } },
    lie_r: { head: { x: 0.82, y: 0.0 }, neck: { x: 0.6, y: 0.32 }, feet: { x: 0.72, y: 0.85 } },
    lie_l: { head: { x: 0.18, y: 0.0 }, neck: { x: 0.4, y: 0.32 }, feet: { x: 0.28, y: 0.85 } },
  };

  const cache = {}; // palette -> { frameName: HTMLImageElement }

  function preload() {
    PALETTE_KEYS.forEach((palette) => {
      cache[palette] = {};
      const names = [
        FRAME_NAMES.sitFront, FRAME_NAMES.sitR, FRAME_NAMES.sitL,
        FRAME_NAMES.lieR, FRAME_NAMES.lieL,
        ...FRAME_NAMES.walkR, ...FRAME_NAMES.walkL, ...FRAME_NAMES.dangle,
      ];
      names.forEach((name) => {
        const img = new Image();
        img.src = `assets/cats/${palette}/${name}.png`;
        cache[palette][name] = img;
      });
    });
  }

  function img(palette, frameName) {
    const p = cache[palette] || cache.shadow;
    return p[frameName] || p[FRAME_NAMES.sitFront];
  }

  function sitSize() { return { w: DIMS.sit.w * DISPLAY_SCALE, h: DIMS.sit.h * DISPLAY_SCALE }; }
  function sitFrontSize() { return { w: DIMS.sitFront.w * DISPLAY_SCALE, h: DIMS.sitFront.h * DISPLAY_SCALE }; }
  function walkSize() { return { w: DIMS.walk.w * DISPLAY_SCALE, h: DIMS.walk.h * DISPLAY_SCALE }; }
  function dangleSize() { return { w: DIMS.dangle.w * DISPLAY_SCALE, h: DIMS.dangle.h * DISPLAY_SCALE }; }
  function lieSize() { return { w: DIMS.lie.w * DISPLAY_SCALE, h: DIMS.lie.h * DISPLAY_SCALE }; }

  preload();

  return { PALETTE_KEYS, DISPLAY_SCALE, DIMS, FRAME_NAMES, ANCHORS, DANGLE_SCRUFF, img, sitSize, sitFrontSize, walkSize, dangleSize, lieSize };
})();
