# Pawprint — Desk Pet Cats (clickable prototype)

A browser-based clickable prototype for a macOS desk-pet app: pixel-art cats
that live on your screen, wander around, perch on windows, react to your
cursor, purr when patted, and reward daily care with a streak system that
unlocks new cats and accessories.

This is a prototype, not a native macOS app — it runs in any browser and
simulates the desktop (menu bar, dock, draggable windows) so the cat
interactions can be demonstrated end-to-end without packaging a real
background-utility app.

## Running it

No build step. Serve the folder and open it:

```
python3 -m http.server 8080
```

then open `http://localhost:8080/` in a browser (Chrome/Safari recommended).
Opening `index.html` directly via `file://` also works.

## What to try

- **Watch a cat live on the desktop.** It wanders the "desktop," occasionally
  climbs up and rests on top of one of the fake app windows (Finder/Notes)
  for a random 5–10 seconds, then climbs back down, or settles on the floor
  to sit or lie down for a stretch. Drag the window it's sitting on — the
  cat rides along, rigidly tracking the window's position, and hops off onto
  the floor if that window closes out from under it. Move your mouse near a
  cat that's just standing still (idle) and it glances to face the cursor;
  once it's settled into a sit or a lie-down it holds that facing steady
  instead of flicking back and forth as the cursor passes by.
- **Pat it.** Click/tap the cat for a quick pat: it purrs (synthesized sound,
  toggleable), squints happily, and a pixel-art heart floats up. This also
  records today's care streak.
- **Drag it.** Press and drag the cat (hovering alone never starts a drag) —
  it hangs by the scruff with its limbs swinging like a pendulum opposite
  your cursor's motion, and snaps onto whichever window is nearest when you
  let go (no need for a precise drop), or the floor if nothing's close by.
- **Paw prints.** While walking, the cat leaves a trail of paw prints,
  rotated to point the way it's heading, that fade out after a few seconds.
- **Hover over a cat** — four buttons "zoom out" into a half-circle arc above
  its head (and the cat holds still the whole time you're hovering or using
  one, so they're not a moving target):
  - **⏸/▶** pauses or resumes just that cat's movement (still pettable and
    draggable while paused) — it sits upright and holds still, not just
    freezes mid-stride.
  - **📋** opens that cat's clipboard: drag a file (or dragged text) from your
    OS onto the cat to save it there, then drag items back out to your
    desktop/another app, or copy them straight to your system clipboard.
    Session-only, not persisted across a reload.
  - **🧥** opens a small closet board floating above the cat, with Hat /
    Clothes / Shoes / Accessories tabs — tap an unlocked item to equip it.
  - **🧸** opens that cat's toy box. Tap an unlocked toy to send the cat over
    to play with it (it sits and wiggles the toy in place); tap 🧸 again to
    call the cat back — the toy stays behind on the desk, left out.
  - Clicking or starting to drag the cat immediately clears all of these
    out of the way instead of leaving them floating mid-interaction.
- **Open the full control panel** — now a normal floating, draggable app
  window (traffic-light title bar, centered on first open, remembers where
  you last dragged it) via the dock's paw icon:
  - **Cats** — show/hide unlocked cats on the desktop; locked ones show what
    streak milestone unlocks them.
  - **Streak** — your current daily streak, the full milestone timeline, and
    **prototype demo tools** to simulate the next day or a missed day so you
    can preview the reward loop without waiting on real calendar days.
  - **Settings** — hide all cats, pause movement & interactions globally,
    toggle purring sound / paw prints, and switch **Playful mode** on:
    every so often (every 2–5 minutes, so they never pile up fast) a little
    toy or mess appears somewhere on the desktop — click one to pick it up.
    **Serious mode** (the default) keeps cats just walking around, mess-free.
- **Drag the fake windows** by their title bars — cats treat them as real
  surfaces to perch on, and always render above them, like a real desk-pet
  overlay would.

## How the streak & rewards loop works

- Patting a cat at least once records today as cared-for.
- Patting on consecutive calendar days increases the streak by one;
  patting again the same day is a no-op; missing a day resets the streak
  to zero on the next pat.
- Streak milestones unlock permanently:
  - 3 / 10 / 14 / 21 / 45 / 60 / 100 days → closet accessories (hat, clothes, shoes, misc.)
  - 5 / 18 / 35 days → toys
  - 7 / 30 / 100 days → new cats (Shadow, Snowy, Celestial)
- Everything persists in `localStorage`, so progress survives a reload.

## Implementation notes

Vanilla HTML/CSS/JS, no dependencies or build step:

- `assets/cats/` — hand-drawn pixel-art cat sprites (walking loop, sitting,
  lying down, scruff-dangle, and front-facing poses), derived from reference
  sheets and recolored per cat into four palettes (`shadow`, `mochi`,
  `snowy`, `celestial`) by remapping their fur/eye colors with a small
  Python script.
- `js/spriteart.js` — preloads every sprite frame and exposes frame
  dimensions and rough accessory anchor points (head/neck) per pose.
- `js/cat.js` — a `Cat`'s behavior: wander/perch/rest state machine, pointer
  handling (tap-to-pat vs. drag, with a movement/time threshold to tell
  them apart), frame selection (walk-cycle animation, sit, lie down, patted,
  a pendulum-swinging scruff-dangle for "dragged"), paw-print stamping,
  particles, a tiny synthesized purr via the Web Audio API, the per-cat
  hover menu (pause/clipboard/closet/toybox, arranged on a half-circle via
  a `--dx`/`--dy` CSS custom property per button), the HTML5 drag-and-drop
  "clipboard" (native `dragover`/`drop` to save a file or dragged text,
  `DownloadURL`/Clipboard API to take it back out), the toy box ("playing"
  freezes the cat next to an animated toy sprite until called back), and
  playful-mode mess-dropping on a randomized multi-minute cooldown, scattered
  anywhere on the desktop rather than tied to wherever the cat is standing.
  While perched, a
  cat tracks its window's element directly (`offsetLeft`/`offsetTop`) every
  frame so dragging the window carries the cat with it. Cursor reaction is
  approximated by having a standing-still (idle) cat turn to face the
  cursor when it comes close; once settled into a sit or a lie-down, that
  facing is locked in place instead of being re-evaluated against the
  cursor every frame, which is what used to make a stationary cat flicker
  left/right as the mouse passed near it.
- `js/streak.js` — streak, unlock, and settings persistence (`localStorage`),
  including the day-advance debug helpers used by the Streak tab's demo
  tools.
- `js/windows.js` — minimal draggable fake app windows cats can perch on.
- `js/ui.js` / `js/main.js` — control panel rendering and app bootstrap.

Not implemented (out of scope for a prototype): a real macOS menu-bar
background app, multi-monitor awareness, native window transparency, and
actual purchase/earning mechanics beyond the streak-based unlocks.
