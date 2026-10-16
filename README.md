# Pawprint — Desk Pet Cats (clickable prototype)

A browser-based clickable prototype for a macOS desk-pet **study companion**:
pixel-art cats that live on your screen, wander around, perch on windows,
react to your cursor, and reward *logged study time* — not just petting —
with study points that unlock new cats, accessories, toys, food, and home
decor to collect.

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
  to sit (always for 3+ seconds) or lie down for a longer stretch (10–30
  seconds, with little pixel-art "Z"s drifting up above its back ear — three
  at a time, then a pause — while it dozes) — always facing the same way it
  was just walking,
  never the opposite direction, and never sitting right after another sit
  (it'll walk or lie down instead). Drag the window it's sitting on — the
  cat rides along, rigidly tracking the window's position, and hops off onto
  the floor if that window closes out from under it. Move your mouse near a
  cat that's just standing still (idle) and it glances to face the cursor;
  once it's settled into a sit or a lie-down it holds that facing steady
  instead of flicking back and forth as the cursor passes by.
- **Pat it.** Click/tap the cat for a quick pat: it squints happily and a
  pixel-art heart floats up. Purely a fun, cosmetic interaction — it hides
  its hover-menu buttons the same way a click/drag does (they only come
  back the next time you actually hover over the cat again), but doesn't
  earn anything by itself; see **Start a study session** below for how
  points actually work.
- **"Mochi notices you."** Roughly once in 20 of its idle decisions, a cat
  interrupts its usual wandering to crouch (a 👀 pops up above its head),
  lunge a short distance toward whichever side of the screen your cursor is
  on, and bat at the air (🐾 swipes), staying put and batting as long as
  your cursor keeps doing *something* — moving it around resets the clock
  indefinitely. Click the cat while it's mid-lunge or mid-bat and it
  "catches" your cursor instead of taking an ordinary pat — a distinct toast
  and the same heart-spawning feedback as a pat. Leave the cursor dead still
  for a full 10 seconds, though, and it loses interest and walks off in the
  opposite direction instead of waiting around forever.
- **Drag it.** Press and drag the cat (hovering alone never starts a drag) —
  it hangs by the scruff with its limbs swinging like a pendulum opposite
  your cursor's motion, and snaps onto whichever window is nearest when you
  let go (no need for a precise drop), or the floor if nothing's close by.
- **Paw prints.** While walking, the cat leaves a trail of paw prints,
  rotated to point the way it's heading, that fade out after a few seconds.
- **Window-perching.** While settled on top of a window, a cat occasionally
  reaches a paw down over the edge at whatever's on screen (the same 🐾
  swipe as the pounce-bat), every few seconds.
- **Check your study session at a glance.** While a study or break session
  is running (see below), hover over any cat to see a small live timer
  float above it — time elapsed for a count-up session, or time left for a
  count-down one. It's a status readout, not a per-cat thing: every cat
  shows the same session.
- **Hover over a cat** — five buttons "zoom out" above its head in two
  curved rows (closet/toybox/food along a shallow arc on the bottom —
  toybox lifted higher in the middle — pause/clipboard centered on a row
  well above them). Hovering, and clicking any of these buttons, just
  freezes the cat exactly as it is — mid-stride, sitting, lying down,
  whatever it was doing — so the buttons aren't a moving target, without
  snapping it into a sit first.
  - **⏸/▶** pauses or resumes just that cat's movement (still pettable and
    draggable while paused) — this one does sit it upright and hold still,
    not just freeze mid-stride, since pausing is a deliberate "stop" rather
    than a passing hover.
  - **📋** opens that cat's clipboard: drag a file (or dragged text) from your
    OS onto the cat to save it there, then drag items back out to your
    desktop/another app, or copy them straight to your system clipboard.
    Session-only, not persisted across a reload.
  - **🧥** opens a small closet board floating above the cat, with Hat /
    Clothes / Shoes / Accessories tabs — tap an unlocked item to equip it.
  - **🧸** opens that cat's toy box. Tap an unlocked toy to send the cat over
    to play with it (it sits and wiggles the toy in place); tap 🧸 again to
    call the cat back — the toy stays behind on the desk, left out.
  - **🍗** opens that cat's food board. Drumstick is available from day one;
    Fish, Canned Food, and Milk unlock with study points. Tap an unlocked
    food to feed it — it sits and eats for a few seconds, then leaves a poop
    behind roughly a minute later, every time (regardless of Playful/Serious
    mode) — one poop per meal, never more, never fewer, and never one
    without a feeding. Where it lands depends on the mode: see below. Like
    patting, feeding is a cosmetic interaction — it doesn't earn points.
  - Clicking (to pat) or starting to drag the cat immediately clears all of
    these out of the way instead of leaving them floating mid-interaction —
    a pat keeps them hidden until you hover again, while dropping a drag
    brings the menu right back since the cursor's still on the cat.
- **Open the full control panel** — now a normal floating, draggable app
  window (traffic-light title bar, centered on first open, remembers where
  you last dragged it) via the dock's paw icon:
  - **Cats** — show/hide unlocked cats on the desktop; locked ones show how
    many study points unlock them.
  - **Study** — this is the actual point of the app. Start a study or break
    session (see **Start a study session** below), see your total study
    points, the full unlock timeline, your recent session log, and
    **prototype demo tools** to add points directly so you can preview the
    reward loop without actually sitting through real study time.
  - **Decor** — home decor pieces you've unlocked with study points; tap one
    to place it on (or take it off) the desktop. Unlike closet items, decor
    isn't per-cat — it's a shared piece of the desktop itself.
  - **Settings** — hide all cats, pause movement & interactions globally,
    toggle paw prints, and switch **Playful mode** on: every
    so often while a cat is out walking, it grabs one of its unlocked toys
    and carries it around in its mouth, playing with it for 10–20 seconds,
    then leaves it behind wherever it ends up — never just teleported to a
    random spot — and a fed cat's poop can land anywhere on the desktop.
    **Serious mode** (the default) keeps cats just walking around without
    picking up toys on their own; feeding still works the same, but its
    poop always lands in the same out-of-the-way spot in the bottom-left
    corner instead of scattering around.
- **Drag the fake windows** by their title bars — cats treat them as real
  surfaces to perch on, and always render above them, like a real desk-pet
  overlay would.

## Start a study session

The Study tab is where you actually earn points:

1. Pick a kind — **📖 Study** or **☕ Break** — and a mode — **⏱ Count up**
   (an open-ended stopwatch you stop yourself) or **⏳ Count down** (pick a
   duration — 10/25/50/90 min for study, 5/10/15 min for break — and it
   finishes on its own).
2. Tap **Start**. The timer runs live in the panel, and hovering any cat on
   the desktop shows the same timer floating above its head.
3. Tap **End session** (or let a count-down session run out) to log it.

## How studying earns points

- **1 point per full 10 minutes** of a logged study session.
- **1 point per full 5 minutes** of a logged break session.
- Only whole units count — a 24-minute study session logs 2 points, not
  2.4; ending a session under one full unit (e.g. an 8-minute study
  session) still gets logged, just for 0 points.
- Only one session can run at a time; ending it (manually, or automatically
  for a count-down session) is what turns it into points and a study-log
  entry — nothing is awarded while a session is still in progress.
- Points unlock permanently, and never expire or get spent:
  - 5 / 20 / 30 / 40 / 65 / 85 / 130 points → closet accessories (hat, clothes, shoes, misc.)
  - 10 / 35 / 55 points → toys
  - 15 / 45 / 75 points → food (Fish, Canned Food, Milk) — Drumstick is free from day one
  - 12 / 25 / 45 / 70 / 100 points → home decor (plant, framed photo, cat bed, lamp, trophy shelf)
  - 15 / 50 / 120 points → new cats (Shadow, Snowy, Celestial)
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
  particles, the per-cat
  hover menu (pause/clipboard/closet/toybox/food, arranged in two curved
  rows via a `--dx`/`--dy` CSS custom property per button), the HTML5
  drag-and-drop
  "clipboard" (native `dragover`/`drop` to save a file or dragged text,
  `DownloadURL`/Clipboard API to take it back out), the toy box ("playing"
  freezes the cat next to an animated toy sprite until called back), feeding
  (sits and "eats" for a few seconds, then queues a poop roughly a minute
  later — a list of pending poop timestamps rather than a single one, so
  repeated feedings each get their own poop instead of one overwriting
  another's — scattered anywhere on the desktop in Playful mode or always
  the same bottom-left spot in Serious mode), and playful-mode toy-carrying:
  a walking cat occasionally grabs an unlocked
  toy, follows it along near its
  mouth for 10-20s, then leaves it behind as a normal pick-up-able item right
  where the cat ends up. While perched, a
  cat tracks its window's element directly (`offsetLeft`/`offsetTop`) every
  frame so dragging the window carries the cat with it, and periodically
  reaches a paw down over the edge (shared `_spawnPawSwipe()` helper, also
  used by the pounce-bat below). Cursor reaction is
  approximated by having a standing-still (idle) cat turn to face the
  cursor when it comes close; once settled into a sit or a lie-down, that
  facing is locked in place instead of being re-evaluated against the
  cursor every frame, which is what used to make a stationary cat flicker
  left/right as the mouse passed near it. The rare (1-in-20) "notices you"
  sequence — queued from the same per-decision roll as its next walk/sit/lie
  choice — crouches facing the cursor's side, lunges a short distance that
  way at a sped-up walk, then holds an open-ended "touch" step: it keeps
  batting at the air while a module-level `lastCursorActivityAt` timestamp
  (updated on every `pointermove`) keeps getting refreshed, and gives up —
  clearing the hunt and queuing a walk away from the cursor's side instead —
  once 10 seconds pass with that timestamp unchanged. Clicking the cat while
  a `pouncing` flag is set (true for the whole lunge/touch span) intercepts
  the normal pat handler into a distinct "catch" reaction instead. No
  literal eye/pupil tracking or crouch/pounce sprite art exists, so this is
  a flat-sprite approximation built from the existing sit pose, speed
  override, and particle effects rather than new animation frames. The live
  session hover tooltip (`_renderSessionTooltip`) reads the shared
  `StreakManager` session directly against the wall clock (`Date.now()`) on
  every render, so it stays live even while hovering freezes the cat's own
  pose — no separate ticking needed for it.
- `js/streak.js` (object name `StreakManager`, kept from before this
  feature's point-based rewrite) — owns study points, the session engine
  (`startSession`/`endSession`/`tickSession`, one session at a time, global
  rather than per-cat), the study log, unlocks for cats/accessories/toys/
  food/decor, and settings persistence (`localStorage`, key
  `pawprint_state_v2` — a new key, since the old day-streak schema doesn't
  convert into this one). `tickSession()` is polled once a second from
  `main.js` so a count-down session finishes itself even if the Study tab
  isn't open; `debugAddPoints()` backs the Study tab's demo tools.
- `js/windows.js` — minimal draggable fake app windows cats can perch on.
- `js/ui.js` — control panel rendering: the cat roster, the Study tab
  (session controls, live timer, points, milestone list, session log), the
  Decor tab (place/un-place unlocked decor), and Settings.
- `js/main.js` — app bootstrap; also renders whichever decor pieces are
  "placed" onto `#decor-layer` at their fixed desktop spots (`DECOR` in
  `js/catdata.js`), refreshed whenever an unlock or a placement toggle
  could have changed what should be showing.

Not implemented (out of scope for a prototype): a real macOS menu-bar
background app, multi-monitor awareness, native window transparency,
dragging decor to a custom spot (each piece has one fixed position), and
actual purchase/earning mechanics beyond the study-point-based unlocks.
