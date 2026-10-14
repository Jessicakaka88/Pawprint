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
    sit: { w: 182, h: 194 },
    walk: { w: 223, h: 159 }, // walk_l and walk_r share this padded size
    dangle: { w: 318, h: 264 }, // lifted by the scruff; all swing frames share this canvas
  };

  const FRAME_NAMES = {
    sitFront: "sit_front",
    sitR: "sit_r",
    sitL: "sit_l",
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
    walk_r: { head: { x: 0.76, y: 0.0 }, neck: { x: 0.64, y: 0.56 } },
    walk_l: { head: { x: 0.24, y: 0.0 }, neck: { x: 0.36, y: 0.56 } },
    sit_r: { head: { x: 0.66, y: -0.02 }, neck: { x: 0.55, y: 0.65 } },
    sit_l: { head: { x: 0.34, y: -0.02 }, neck: { x: 0.45, y: 0.65 } },
    sit_front: { head: { x: 0.5, y: 0.0 }, neck: { x: 0.5, y: 0.6 } },
    dangle: { head: { x: 0.5, y: 0.0 }, neck: { x: 0.5, y: 0.35 } },
  };

  const cache = {}; // palette -> { frameName: HTMLImageElement }

  function preload() {
    PALETTE_KEYS.forEach((palette) => {
      cache[palette] = {};
      const names = [
        FRAME_NAMES.sitFront, FRAME_NAMES.sitR, FRAME_NAMES.sitL,
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
  function walkSize() { return { w: DIMS.walk.w * DISPLAY_SCALE, h: DIMS.walk.h * DISPLAY_SCALE }; }
  function dangleSize() { return { w: DIMS.dangle.w * DISPLAY_SCALE, h: DIMS.dangle.h * DISPLAY_SCALE }; }

  preload();

  return { PALETTE_KEYS, DISPLAY_SCALE, DIMS, FRAME_NAMES, ANCHORS, DANGLE_SCRUFF, img, sitSize, walkSize, dangleSize };
})();
