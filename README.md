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

- **Watch a cat live on the desktop.** Mochi wanders the "desktop," occasionally
  climbs up and rests on top of one of the fake app windows (Finder/Notes),
  then hops back down. Move your mouse near it — its eyes and ears turn to
  follow the cursor.
- **Pat it.** Click/tap the cat for a quick pat: it purrs (synthesized sound,
  toggleable), squints happily, and a couple of hearts float up. This also
  records today's care streak.
- **Drag it.** Press and drag the cat — it lifts gently off the ground with
  its legs dangling and loosely tangled beneath it, and settles back onto
  whichever surface (floor or window top) is under it when you let go.
- **Paw prints.** While walking, the cat leaves a trail of paw prints that
  fade out after a few seconds.
- **Open the control panel** (the paw button, bottom-right, or the dock's paw
  icon) for:
  - **Cats** — show/hide unlocked cats on the desktop; locked ones show what
    streak milestone unlocks them.
  - **Closet** — equip accessories (bandana, bowtie, hat, collar, scarf,
    flower crown) you've earned, per cat, reusable across every cat you own.
  - **Streak** — your current daily streak, the full milestone timeline, and
    **prototype demo tools** to simulate the next day or a missed day so you
    can preview the reward loop without waiting on real calendar days.
  - **Settings** — hide all cats, pause movement & interactions, and toggle
    purring sound / paw prints.
- **Drag the fake windows** by their title bars — cats treat them as real
  surfaces to perch on, and always render above them, like a real desk-pet
  overlay would.

## How the streak & rewards loop works

- Patting a cat at least once records today as cared-for.
- Patting on consecutive calendar days increases the streak by one;
  patting again the same day is a no-op; missing a day resets the streak
  to zero on the next pat.
- Streak milestones unlock permanently:
  - 3 / 14 / 21 / 45 / 60 / 100 days → accessories
  - 7 / 30 / 100 days → new cats (Shadow, Snowy, Celestial)
- Everything persists in `localStorage`, so progress survives a reload.

## Implementation notes

Vanilla HTML/CSS/JS, no dependencies or build step:

- `js/pixelart.js` — procedural pixel-art cat renderer. Cats are drawn at a
  tiny internal resolution onto a `<canvas>` (image smoothing off) and
  scaled up via CSS for the chunky pixel look, with every pose (walk, sit,
  patted, dragged) driven by continuous parameters rather than hand-drawn
  sprite sheets, so poses blend and react to live input (cursor look,
  drag velocity).
- `js/cat.js` — a `Cat`'s behavior: wander/perch state machine, pointer
  handling (tap-to-pat vs. drag, with a movement/time threshold to tell
  them apart), paw-print stamping, heart/sparkle particles, and a tiny
  synthesized purr via the Web Audio API.
- `js/streak.js` — streak, unlock, and settings persistence (`localStorage`),
  including the day-advance debug helpers used by the Streak tab's demo
  tools.
- `js/windows.js` — minimal draggable fake app windows cats can perch on.
- `js/ui.js` / `js/main.js` — control panel rendering and app bootstrap.

Not implemented (out of scope for a prototype): a real macOS menu-bar
background app, multi-monitor awareness, native window transparency, and
actual purchase/earning mechanics beyond the streak-based unlocks.
