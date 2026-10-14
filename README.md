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
- **Hover over a cat** — three quick-action buttons "zoom out" into a
  half-circle arc above its head: ⏸/▶ pauses or resumes just that cat's
  movement (it's still pettable and draggable while paused), 📋 opens that
  cat's clipboard (see below), and 🧥 jumps straight to the Closet tab with
  that cat preselected.
- **Drop a file on a cat to "save" it.** Drag a file from your OS (or
  dragged text) onto a cat and it's saved into that cat's own clipboard —
  a small badge shows how many items it's holding. Hover the cat and tap
  📋 to see the list; each item can be dragged back out onto your desktop
  or another app, or copied straight to your system clipboard with the 📋
  button next to it. Items are session-only (kept in memory, not
  persisted across a reload).
- **Open the full control panel** via the dock's paw icon for:
  - **Cats** — show/hide unlocked cats on the desktop; locked ones show what
    streak milestone unlocks them.
  - **Closet** — equip accessories (bandana, bowtie, hat, collar, scarf,
    flower crown) you've earned, per cat, reusable across every cat you own.
  - **Streak** — your current daily streak, the full milestone timeline, and
    **prototype demo tools** to simulate the next day or a missed day so you
    can preview the reward loop without waiting on real calendar days.
  - **Settings** — hide all cats, pause movement & interactions globally,
    and toggle purring sound / paw prints.
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

- `assets/cats/` — hand-drawn pixel-art cat sprites (walking loop, sitting,
  and front-facing poses), derived from a single reference sheet and
  recolored per cat into four palettes (`shadow`, `mochi`, `snowy`,
  `celestial`) by remapping its fur/eye colors with a small Python script.
- `js/spriteart.js` — preloads every sprite frame and exposes frame
  dimensions and rough accessory anchor points (head/neck) per pose.
- `js/cat.js` — a `Cat`'s behavior: wander/perch state machine, pointer
  handling (tap-to-pat vs. drag, with a movement/time threshold to tell
  them apart), frame selection (walk-cycle animation, sit, patted, a
  tilted/stretched walk frame standing in for "dragged"), paw-print
  stamping, heart/sparkle particles, a tiny synthesized purr via the Web
  Audio API, the per-cat hover menu (pause/clipboard/closet, arranged on a
  half-circle via a `--dx`/`--dy` CSS custom property per button), and the
  HTML5 drag-and-drop "clipboard" (native `dragover`/`drop` to save a file
  or dragged text, `DownloadURL`/Clipboard API to take it back out).
  Cursor reaction is approximated by having an idle/sitting cat turn to
  face the cursor when it comes close.
- `js/streak.js` — streak, unlock, and settings persistence (`localStorage`),
  including the day-advance debug helpers used by the Streak tab's demo
  tools.
- `js/windows.js` — minimal draggable fake app windows cats can perch on.
- `js/ui.js` / `js/main.js` — control panel rendering and app bootstrap.

Not implemented (out of scope for a prototype): a real macOS menu-bar
background app, multi-monitor awareness, native window transparency, and
actual purchase/earning mechanics beyond the streak-based unlocks.
