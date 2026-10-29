# Harbor Stories — running game specification

**Status:** running spec. Present tense describes what the build does today; anything the design
calls for but the code does not yet do is collected in §17.
**Repo version:** `starhermit.txt` `version=1.0.0`, `contentVersion=1`, engine 1.23.0 (host API 1.21),
`js/content.js` `CONTENT_VERSION = 1`, `js/rules.js` `STATE_VERSION = 1`.

## 1. Overview

**Pitch.** Merge matching hand tools on a dock, build them up through four tiers, and hand them to the
restoration jobs that bring a fog-bound harbor town back to life.

| | |
|---|---|
| Genre | Single-screen merge puzzler with an authored task list |
| Players | 1, local, offline after first load |
| Session | 60–150 s per stage (the shipped stage wins in 8 hint-optimal moves; human play 15–25) |
| Platforms | StarHermit engine 1.23.0 script game: natively in the StarHermit client and in desktop and mobile browsers (the engine's web runtime), portrait and landscape |
| Rendering | `starhermit:ui` board (a grid of cell widgets with painted glyphs and text labels) over a painted harbor backdrop (`starhermit:canvas` + `starhermit:draw`) and spark layer, switched by the runtime's graphics tier. No 3D scene. |
| Audio | `starhermit:audio` clips on the runtime's effects and interface buses, 14 authored Opus one-shots plus a looped ambience bed |


### File map

See §13 (Technical architecture).

## 2. Design pillars

1. **The board is a workbench, not a grid of numbers.** Every cell shows a glyph *and* a written tool
   name ("Mallet", "Claw Hammer", "Sledge", "Forge Hammer"). Rules in: tier is legible without colour
   or size comparison. Rules out: bare numeric tiles, colour-only chains, unlabelled icons.
2. **Merging is only half the game; delivering is the other half.** Score comes from `deliver` and task
   completion as much as from `merge`, and delivery is the only way to free a jammed board. Rules in: a
   visible task list that changes what is worth building. Rules out: an open-ended merge sandbox with no demand.
3. **No hidden state, ever.** Board, task progress, moves, score components and the reason an action was
   rejected are all on screen or one keypress away. Rules in: `Rules.hint()` calling the same
   `legalActions()` play uses. Rules out: hidden multipliers, off-screen timers, unexplained refusals.
4. **Failure is a soft landing.** Losing is called "Round over", plays a foghorn rather than a buzzer, and
   is always one click from a fresh board. Rules in: gentle art and audio for the lock-up state. Rules out:
   score penalties, lives, streak punishment, run loss.
5. **Cozy dusk, never spectacle.** Golden-hour palette, one warm accent, motion measured in tens of
   milliseconds. Rules in: painterly key art, a plank texture under the board, a slow dusk harbor behind the
   panels, a brief spark burst on the cell you just merged or delivered. Rules out: camera shake, screen
   flashes, anything that moves over the task list while you are reading it.

## 3. Player experience

**Target player.** Someone who likes a merge loop but wants it to mean something — a puzzler with a
neighborhood attached, playable one-handed on a phone or with the keyboard at a desk.

**First 60 seconds** (the qa.md teaching bar):
1. Title screen: key art, the tagline "Merge tool chains, repair the coast, and reveal stories around
   Brinemist Quay", one **Play** button. Best score appears here once you have one.
2. Play starts journey stage 1, *First Light Repairs*, and the status line carries that stage's authored
   intro: "Merge two matching tools side by side to build better ones, then deliver what the repairs ask for."
   That single sentence is the whole ruleset.
3. The task rail on the left already reads "Coil the mooring lines — Rope Coil 0/1" and "Hang the pier lamp —
   Pier Lantern 0/1", naming the exact items wanted.
4. The first tap says "Mallet selected. Choose its destination or Deliver." Every subsequent action, legal or
   not, replaces the status line with plain English: "Merged into Claw Hammer. +20", "Tools only merge on
   touching cells."
5. **Hint (H)** is always available and names a concrete cell pair, so nobody can get stuck.

**Session shape.** Read the task list → find or build the two items it names → deliver → win. The tide adds a
supply every three actions, so the board never empties and never quite fills.

**The beat.** The moment a `deliver` empties a cell you have been fighting for, the task line ticks 0/1 → 1/1,
the harbor bell rings twice, and the board suddenly has room again. Relief and tidiness, not triumph.

## 4. Core loop and rules contract

All of this lives in `js/rules.js`; the UI is a thin renderer over it.

### Board and entities
A `cfg.board.rows × cfg.board.cols` grid (5×5 in the shipped stage). Each cell is `null` (open water) or an
item `{ c: chain, t: tier }`. Six chains (`CHAIN_ORDER` in `content.js`): hammer, rope, lantern, brush, net,
brick. Tiers 0–3 (`maxTier: 3`), each with its own name and emoji, e.g. rope = Twine → Rope Coil →
Mooring Line → Anchor Cable.

Tasks are `{ label, reqs: [{chain, tier, count}], got: [n], done }`. A stage wins when every task is `done`.

### Legal actions — `checkAction(state, cmd)`
| Command | Legal when | Rejection reasons |
|---|---|---|
| `{type:'move', from, to}` | `from` occupied, `to` empty, different cells, both in bounds. Any distance — moves are not restricted to adjacency. | `empty-source`, `occupied-target`, `same-cell`, `bad-location` |
| `{type:'merge', from, to}` | Both occupied, **8-way adjacent** (`adjacent()` allows diagonals), same chain and same tier, tier < `maxTier`. | `empty-target`, `not-adjacent`, `merge-mismatch`, `max-tier` |
| `{type:'deliver', at}` | `at` holds an item that `matchingReq()` finds an unfinished requirement for. | `empty-source`, `not-needed`, `bad-location` |
| `{type:'resign'}` | Game not terminal. | `game-ended` |
| anything else | — | `unknown-command`, `malformed-command`, `game-ended` |

`legalActions(state)` enumerates the same surface (every occupied→empty move, every adjacent matching pair
in both directions, every deliverable item) and is what hints are built from.

### Resolution order — `applyCommand(state, cmd)`
The state is deep-cloned; nothing mutates in place, and a rejected command returns the *original* state.
1. Validate; on failure return `{ok:false, reason}` with no tick.
2. `tick++`, `moves++`; if `cmd.atMs` is a finite non-negative number, `elapsedMs` is set to it **floored to
   100 ms** so replays are frame-rate independent.
3. Apply the action. `merge` clears `from`, writes tier+1 into `to`. `deliver` clears the cell and increments
   `task.got`, then marks the task `done` if every requirement is met.
4. `merge` and `deliver` are *productive*: `streak++`. A plain `move` sets `streak = 0`.
5. Terminal check in order: **all tasks complete** (win, or in endless a new task wave), then `moveLimit`,
   then `timeLimitSec`.
6. Tide: if not terminal and `tick % cfg.spawn.every === 0`, `spawnItems()` drops `cfg.spawn.per` tier-0
   items on random empty cells (from round 3 of endless, an 18% chance of tier 1).
7. Jam check: `hasEscape()` — no empty cell, no adjacent mergeable pair, and nothing any task wants → lose
   with `harbor-locked`.
8. Empty-board guard: if a delivery removed the last item, restock immediately so play cannot deadlock.
9. `finalizeScore()` recomputes `score.total` after **every** action, so the HUD number is always the sum of
   the components — not a value only settled at game end.

### Scoring
```
merge      MERGE_PT[newTier]      + STREAK_PT * (streak - 1)     MERGE_PT   = [0, 20, 50, 120]
deliver    DELIVER_PT[itemTier]   + STREAK_PT * (streak - 1)     DELIVER_PT = [10, 30, 80, 200]
task done  + TASK_PT (150)                                       STREAK_PT  = 5
win only   + 15 per move under cfg.par.moves
win only   + 4 per whole second under cfg.par.timeSec (needs elapsedMs > 0)
total      = mergePoints + deliverPoints + taskBonus + moveBonus + timeBonus
```
**Worked example** (the unit test `merge, deliver and task bonus score exactly as documented`): a 4×4 board,
one task wanting 1× Claw Hammer (hammer tier 1), `par.moves = 10`. Merge two adjacent Mallets → streak 1,
`20 + 5×0 = 20`. Deliver the Claw Hammer → streak 2, `30 + 5×1 = 35`; the task completes, `+150`; every task is
done so the win fires with `moveBonus = (10 − 2) × 15 = 120` and `timeBonus = 0` (no `atMs` was passed).
Total **325**.

### Terminal states
`tasks-complete` (won), `harbor-locked`, `move-limit`, `time-up`, `resigned`. `state.terminal` is
`{reason, won}`; the UI shows "Harbor restored!" when `won`, otherwise "Round over". There are no ties to
break: this is a solo score, and the best in the progress document is a strict `>` comparison.

### RNG and determinism
One `cfg.seed` per ruleset. `RNG.derive(seed, STREAM_RULES)` seeds board generation; the resulting 32-bit
`rngState` is carried in the state and re-created before each spawn, so a state + command list reproduces
byte-identically. `hashState()` stable-stringifies the state (minus `events`) through FNV-1a. Spawn chains
are weighted 3× toward chains an unfinished task still needs, so the tide is generous but never random noise.
Separate `STREAM_DECOR` / `STREAM_AV` streams exist so cosmetic randomness can never touch the rules.

### Assists
`hint(state)` returns the first of: a deliverable item → a merge that produces a tier a task wants → any merge
→ a move that sets up a merge → any legal action, each tagged with a `why`. The UI renders it as
"Hint: merge from row 2, column 3 to row 2, column 4." `cfg.mechanics.undo` exists in content data and
`Rules` has no undo command; see §17.

## 5. Modes and progression

`js/content.js` ships the full content set; `src/game.ts` currently launches exactly one of it.

| Mode | Data | Exposed in the UI today |
|---|---|---|
| Journey | 40 stages in 5 chapters (The Old Pier, Boathouse Row, Market Steps, Seawall & Chapel, Lighthouse Point), boards 5×5 → 7×7, 3 → 6 chains, move limits from j06, time limits from j15, tier-3 targets from j18, a MASTERY stage every 8th | **Stage 1 only** — Play always starts `JOURNEY[0]` |
| Challenge | 6 fixed rulesets (Tide Clock, Rope Burn, Cramped Jetty, Master's Order, Storm Surge, The Gauntlet) varying clock, move cap, board size and assists | No |
| Practice | Casual / Apprentice / Expert presets, no limits, assists on | No |
| Daily | `dailyConfig(dateStr)` — seed is `hashString('harborstories-daily-v1-' + date)`; board, chain count, start items, spawn rate, tasks and theme all rotate on `day % 7`; immutable for the UTC day | No |
| Score chase | `SCORE_CHASE`, `endless: true` — completing all tasks rolls `regenerateTasks()` for a harder wave instead of ending; play until the board jams | No |
| Learn | 5 authored lessons (move → merge → deliver → tide/win → undo), each with a forced board layout | No |

**Difficulty curve (journey).** Chapter 1 teaches one chain at a time on 5×5 with no limits; chapter 2 adds a
fifth chain and a wider board; chapter 3 introduces tier-3 targets (8 base supplies per item); chapter 4 adds
the sixth chain (brick) and 6×7 boards; chapter 5 combines a move limit, a clock and four simultaneous tasks
in the finale, *The Beacon Lit*. Themes unlock by stars in the data (`unlockStars` 0/10/25/45/70).

**Story.** `SCENES[i]` pairs each stage with a title, a scene line and two responses that change flavour text
only — never rules, never score. The cast is Old Tob, Wren, Sela and the keeper Maren.

## 6. Controls and interaction

The game reads the manifest's **actions**, never keys; players rebind them in the runtime's Options menu
(F1 › Controls, also opened by the **Settings** buttons).

| Input | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Select a tool | Click a cell, or Tab/arrows to it and Enter/Space | D-pad / left stick to it, **South** | Tap the cell |
| Move / merge | Click (or Enter on) the destination: empty = move, matching = merge | Same, **South** | Tap the destination |
| Clear selection | Click the selected cell again, or **Esc** (`clear`) | **East** | Tap it again |
| Deliver | **D** (`deliver`) or the Deliver selected button | **North** | Tap Deliver selected |
| Hint | **H** (`hint`) or the Hint button | **West** | Tap Hint |
| Restart | **R** (`restart`) or the Restart button | **Start** | Tap Restart |
| Mute | The "Sound: on/off" toggle | Focus it, **South** | Tap it |
| Settings | The **Settings** button (title and game header) or **F1**: the runtime's Options | The runtime's menu | Tap Settings |
| Play again | The results card's button (focused when the card opens) | **South** | Tap it |

Every cell is a focusable `ui.widget` (role toggle, announced pressed while selected) in a `ui.grid`, so the
arrows and the D-pad move from cell to cell and Tab reaches every button in reading order. There is no drag,
no multi-touch and no gesture requirement: every action is one or two discrete taps. Input is never locked —
resolution is synchronous; after the game is terminal only Restart and Play again do anything.

**Feedback for every input.** Selection: accent border plus a 2 px ring (and a glow on tiers with Glow), the
tool-pickup sound, and a status line naming the tool. Legal action: the status line with the result and the
points scored, a per-event sound and (with particles) a spark burst on the cell. Illegal action: the specific
reason in plain English ("Only two identical tools merge.") and the soft `invalid` thunk — never a silent
refusal. Every status line is also spoken to screen readers (`ui.announce`).

## 7. Screens and UI flow

```
title ──Play──▶ game ──terminal state──▶ results card (ui.dialog over the board)
               ▲  │                                     │
               └──┴── R / Restart ◀──── Play again ─────┘
```
Two screens plus the results card, built every frame with `starhermit:ui` (immediate mode, so a language,
graphics or interface-size change shows on the next frame with the round untouched). Each screen sits in a
`ui.scrollArea` the size of the window (less its safe area), so nothing is ever unreachable.

- **Title.** Key art (1200:672, cover-fitted, fades in), "Harbor Stories" in amber (56 px; on phones
  `clamp(38, 12vw, 56)`, measured so it never overflows), the tagline, "Best score N" once there is one, the
  player chip (signed in), the buttons **Play**, **Settings**, and **Invite a friend** (signed in) or **Sign
  in with StarHermit** (guest), then the high-score leaderboard's top 10 (signed in, when it has entries).
  The key art shrinks first (down to 30 % of the height) so Play stays above the fold on short windows; the
  page is centred vertically when it fits.
- **Game, wide (> 700 logical px).** Header (title, stage name, Moves · Score pill, Settings, player chip)
  over a row of the task rail (0.7 : 2 share, at least 230 px) and the board panel (status line, then the
  board, sized to `(window height − 210) × cols / rows`). Page max-width 1280 px, centred.
- **Game, narrow (≤ 700 px).** The header stacks, the board panel comes first at full width and the task rail
  below it; the tiles hide their names (still in the accessible name) and the glyph takes their room; the
  `<kbd>` hints are hidden.
- **Short landscape (≤ 500 px tall).** Compact paddings and type, a 0.6 : 2 rail (at least 200 px) and the
  board sized to `height − 120`, so board, tasks and actions stay co-visible.
- **Results card.** A modal `ui.dialog`: the win or lock-up illustration (at most 34 % of the height), the
  headline (also the dialog's accessible name), Score, Best, the leaderboard line (signed in) and a
  full-width **Play again**, focused when the card opens.
- **Toast.** Invite copied / sign-out notices at the bottom centre for 3.5 s, also announced.

The interface follows the player's interface size, text size, high contrast and reduced motion (F1 ›
Accessibility); hand-placed sizes are logical pixels and text is measured with `ui.measureText`.

## 8. Art direction

**Palette** (`tools/ui-style.css` `:root`, tokens in `assets/ui-style.json`): background `#10141c`, panel
`#1a2130`, soft panel `#232b3d`, text `#f5efe6`, muted `#9aa7bd`, accent `#ffb84d`, danger `#e05a4e`. Board
cells `rgba(17,26,41,.92)` with `#39465f` borders, occupied `#253248`, secondary buttons `#dae5f8`.
`js/content.js` carries five theme palettes for the harbor scene (Golden Hour, Dawn Mist, High Noon,
Stormwatch, Night Market) — the data is shipped; the board does not yet tint from it (§17).

**Shape language.** Everything is a rounded rectangle: 999 px pill buttons, 16–18 px panels, 12 px cells. The
plank texture under the board reads as a dock deck the tools sit on.

**Typography.** The system UI face (`system-ui`: Segoe UI on Windows). Title 56 px in accent amber; body
14–18 px; tile names `clamp(9, 1.2vw, 13)` (smaller, down to 9, when two lines would not fit the tile);
`<kbd>` chips in the action buttons show the runtime's binding label.

**Glyphs.** The six chains have painted glyphs (hammer, rope coil, red paper lantern, paintbrush, hand net,
bricks) on a canvas atlas (`src/icons.ts`), drawn at `clamp(20, 3.4vw, 38)` with the tier badge (1–4) on their
corner. (The browser build used emoji; the engine's text is the system's fonts, which have no colour emoji.)

**The hero** is the board panel: warm plank texture, cool cells, one amber-lit selection. The key art is hero
only on the title screen, and the results illustration is the hero of the end card.

**Motion.** Slow and ambient: buttons lighten under the pointer; the key art and results illustration fade
and rise in over 0.5 s; with detailed tiles, a 2 px lift on hover (0.12 s) and a gentle 1.6 s bob of the
selected tool; with an animated backdrop, drifting waves, fog, bobbing boats and a sweeping lighthouse beam;
with particles, a ~0.8 s spark burst on merge/deliver and a ring plus a larger burst when a task completes.
A merged tool simply *is* the next tier on the next frame. All of it stops with the player's reduced motion
(the backdrop is drawn at a fixed still moment, particles are skipped), with the identical layout.

**Graphics.** The runtime's Options › Graphics picks the level (Auto from the GPU and a benchmark, or one of
ten from quantum to infinite); its quality tier (`frame().quality`) selects one row of `js/gfx.js`:

| Effect | Low | Balanced | High | Ultra |
|---|---|---|---|---|
| Harbor backdrop | off (flat `#10141c`) | still | animated | animated |
| Tile detail (water cells, chain-tinted bevelled tiles, gold rim on masterworks, glass panels, lit planks, button sheen) | flat | detailed | detailed | detailed |
| Shadows (tiles, panels, glyphs, key art) | off | low | high | high |
| Glow (selection, masterworks, lantern glyph, titles, primary buttons, lighthouse lamp, sun) | off | on | on | on |
| Colour grade & vignette (baked into the backdrop) | off | on | on | on |
| Particles (sparks, embers) | off | low (half) | high | high |
| Frosted (backdrop-blur 6 px) panels over the backdrop | no | no | yes | yes |
| Backdrop pixel-ratio cap | 1 | 1.5 | 2 | 2 |
| Wave rows / glitter flecks | 12 / 20 | 18 / 30 | 26 / 44 | 34 / 60 |
| Embers / sparks per burst / live-spark cap | 8 / 10 / 80 | 16 / 16 / 140 | 36 / 26 / 260 | 60 / 34 / 400 |

Counts are tuned at each tier's slowest level and scale with the level's speed within the tier
(`levelSettings().teraflops`, at most 4×; embers ≤ 160, sparks ≤ 60). Gameplay is identical on every tier.

**The backdrop** (`src/backdrop.ts`) paints a dusk sky with stars, a low sun on the horizon, a headland town
with lit windows, a lighthouse whose beam sweeps and narrows as it turns, a sea with perspective wave lines
and a shimmering sun-glitter path, two bobbing moored boats, drifting fog and (with particles) rising embers.
The static parts (sky, stars, sun glow, sea, headlands, town, tower, grade, vignette) are painted once per
window size into a `starhermit:canvas` OffscreenCanvas (repainted when the size has held for 0.25 s) and drawn
as one image; the moving parts are `starhermit:draw` lines, rectangles, polygons and three pre-painted sprites
(fog, beam, halo) each frame — the engine rasterizes canvases on the CPU, where a full-window repaint costs
tens of milliseconds. The tiers' looks over the base style are classes `src/style.ts` registers again when
the tier or reduced motion changes (`.v-*`, and the tile classes `.t-<chain>[-m][-sel]` with the chain's colour
mixed in as the browser build's `color-mix()` did).

**Visual assets:** title key art (golden-hour harbor), a win illustration (lit pier), a lock-up illustration
(fogged, crated dock), a dock-plank board texture, and store cover art — see §15.

## 9. Audio direction

**Mix philosophy.** Quiet, wooden and close-miked. Every one-shot is a physical harbor object doing a
physical thing; the only "musical" cues are the two bell fanfares (`task-complete`, `win`). Clips are
loudness-normalised to −20 LUFS so nothing spikes over the ambience.

**Buses.** `src/sfx.ts` loads every clip at start (`starhermit:audio` `loadClip`) and plays them on the
runtime's volume buses: `select`, `invalid`, `hint` and `ui-start` on **interface**, the rest and the ambience
on **effects**. Volumes, mute and the voice limit are the runtime's Options › Audio. The game's own
**Sound: on/off** toggle silences its cues and the ambience; it is the game setting `sfx.muted` (kept with the
account when signed in; a browser-build player's old `sfx.muted` setting carries over once). The ambience loop
(gain 0.32) starts with the first Play; in browsers all audio starts at the player's first press. The same
event cannot re-trigger within 50 ms. No music stems; the ambience bed is the music.

### SFX event table (source of `sfx/manifest.txt`)

| event id | file | sound | fired by |
|---|---|---|---|
| `ui-start` | `ui-start.opus` | plank tap + brass bell chirp | Play / Restart / Play again (`startGame`) |
| `select` | `tool-select.opus` | tool lifted off a plank, wood scrape + glove grip | first tap on an occupied cell (`chooseCell`) |
| `move` | `tool-move.opus` | light wooden slide and knock | rules event `move` |
| `merge` | `tool-merge.opus` | two tools clack, then a pitched-up metallic sparkle | rules event `merge` |
| `deliver` | `deliver.opus` | rope thump onto a crate + bell ding | rules event `deliver` |
| `task-complete` | `task-complete.opus` | harbor bell twice, warm wooden creak | rules event `task-complete` |
| `spawn` | `tide-spawn.opus` | water splash, wooden plop | rules event `spawn` (tide and restock) |
| `round` | `round-advance.opus` | distant ship horn + one gull | rules event `round` (endless) |
| `tasks-new` | `tasks-new.opus` | paper flutter, pin into a notice board | rules event `tasks-new` (endless) |
| `hint` | `hint-gull.opus` | one gull chirp + a small glass chime | Hint button / H |
| `win` | `win.opus` | bells pealing, gulls, small brass fanfare | rules event `win` |
| `lose` | `lose.opus` | foghorn moan, hull creak, fading water | rules event `lose` (any losing terminal) |
| `invalid` | `invalid-move.opus` | dull muted wooden thunk | any rejected command |
| `resign` | `resign.opus` | descending boatswain whistle, rope lowered | loaded; no UI control fires it yet |
| `ambience` | `harbor-ambience.opus` | 12 s loop: water on pilings, rope creak, two gulls | first Play, loops for the session |

## 10. Localization

Nine locales ship: **en-US, en-GB, es-419, es-ES, de-DE, fr-FR, fr-CA, pt-BR, it-IT**. Every string the player
can see — title, player chip, leaderboard, header, task rail, buttons, status line (events, hints, rejected
moves, achievements), tile names and accessible names, results card, toasts, the account strings — is an
English key in `js/strings.js` with es-419, de-DE, fr-FR, pt-BR and it-IT translations; en-GB ("Harbour
restored!"), es-ES and fr-CA ("Pointage") carry only their differences. Content shown in play is translated by
key too: all 24 tool names, stage 1's name, intro and task labels, and the ten achievement names; content with
no UI entry point (stages 2–40, story scenes, challenges) stays English until it is reachable (§16). "Harbor
Stories", "StarHermit" and "Brinemist Quay" are names and are not translated.

- **Language:** the runtime's interface language (Options › Language, else the device's) as
  `preferences().language`, mapped by `src/i18n.ts` to the nearest shipped locale (`es-MX → es-419`, `en-AU →
  en-GB`, `pt-PT → pt-BR`, anything else → en-US). The runtime's own menus translate themselves.
- **Live switching:** a change shows on the next frame; the round, selection and moves are kept and the status
  line is rebuilt from its source event.

The layout is expansion-ready: wrapping paragraphs for task lines and the status line, button rows that wrap
at the rail's width, measured titles, so a 30 % longer German string reflows instead of clipping.

## 11. Accessibility

- **Keyboard and gamepad path.** Tab reaches every button and cell in reading order; arrows / D-pad move
  within the board; Enter/Space/South activates a cell exactly like a click; D, H, R and Esc (rebindable) act
  globally; the results card focuses Play again. Focus survives every frame (widgets keep their ids).
- **Focus visibility.** A 3 px white focus ring with 2 px offset on cells and buttons for keyboard, gamepad
  and screen-reader focus (`focusVisible`), against a dark panel.
- **Semantics.** Cells are toggle widgets announced pressed while selected, named "Row 2, column 3: Claw
  Hammer" / "…: Open water". Every status line is announced (`ui.announce`), as the old `role="status"` line
  was. The results card is a modal dialog named by its headline. Images are decorative.
- **Colour is never the only cue.** Chain identity is glyph + written tier name + tier badge; selection is
  border, ring *and* the pressed state; task progress is the numeral "1/2".
- **The player's settings** (F1 › Accessibility): interface size and text size scale the whole UI, high
  contrast forces the UI's colours (the tile drawing follows the forced text colour), reduced motion stops
  every animation (above).
- **Audio is never required.** Every cue has a text equivalent in the status line, and sound is off-able.
- **Target sizes.** Buttons are ~40 px tall with 8 px gaps; board cells on a 390 px phone are ~66 px square.

## 12. StarHermit integration

**Manifest.** `starhermit.txt`: `name`, `description`, `owner`, `server=score-script.js` (the leaderboard
script), `version`, `contentVersion`, `cover`, `launch=index.html` (the engine's loader), `engine.api=1`,
`engine.entry=src/main.ts`, `engine.version=1.23.0`, `engine.minor=15`,
`engine.capabilities=platform,storage,clipboard`, the four actions `control.deliver=KeyD`, `control.hint=KeyH`,
`control.restart=KeyR`, `control.clear=Escape` and their gamepad defaults (`North`, `West`, `Start`, `East`).

**The runtime provides** the player's sign-in (the StarHermit client's account natively; the page's launch
token in browsers, renewed by the engine), the Options menu (audio volumes, mute and voice limit, graphics
level and frame-rate limit, language, controls rebinding, accessibility, account, report a problem), and the
browser page's interference rules. The game draws no settings of its own.

**What the game uses** (`starhermit:platform` and `starhermit:storage`; a guest makes no platform calls):

- **Player chip** (signed in): the avatar (`avatar`, cut to a circle), `player().displayName`, and the save's
  sync state (Loading… / Saving… / Synced / Sync error) from `saves.state()`.
- **Progress** (`src/save.ts`, `js/progress.js`): the document `{ v: 1, best, achievements, stats }` is the
  game's save (`saves.save`, schema 1): on the device at once and, signed in, in the account's cloud slot.
  Conflicts merge (best and counters by max, achievements by union at the earliest unlock). **Browser-build
  players keep their progress:** the slot `game:<slug>` held the same document as the JS SDK's zipped
  `save.json`; the engine shows it as a foreign save, which is merged in and replaces the slot once
  (`replaceForeign`). The old settings keys `sfx` (its `muted` becomes the Sound toggle) and `gfx` (now the
  runtime's) are migrated and removed (`settings.legacy*`).
- **Sign in** (guest): **Sign in with StarHermit** opens the runtime's Account dialog (`requestSignIn`).
  A session that ends shows the toast "Signed out of StarHermit. Progress keeps saving on this device."
- **Invite a friend** (signed in): copies `inviteLink()` (`clipboard.writeText` in the press's frame) and
  confirms with a toast.
- **Leaderboard:** every finished run (won or not, signed in) is posted through `score-script.js`: a practice
  session (`sessions.practice`), `{type:'result', scores:{'high-score': n}}` on its game socket, the script
  range-checks it (integer 0–100,000) and posts it; the card shows "Leaderboard rank: #N" (or posted / not
  posted). The title shows the board's top 10 (nicknames from `profile`).
- **Achievements:** the ten `Content.ACHIEVEMENTS` unlock locally into the progress document (announced in the
  status line) and travel with the cloud save.

**Not used:** server sessions beyond the score post, matchmaking, rooms, chat, voice, replays and platform
achievements.

## 13. Technical architecture

**One package, two runtimes.** The TypeScript in `src/` runs natively in the engine's interpreter (the
StarHermit client) and in browsers in a worker of the engine's web runtime, which `index.html` (the loader
`starhermit package --web` writes, pinning engine 1.23.0 on wiki.starhermit.com by hash) starts. The pure game
logic stays classic scripts in `js/`, loaded with `loadClassic` and tested by Node as they ship.

| Path | Responsibility |
|---|---|
| `src/main.ts` | Entry: lifecycle, the actions, sign-in changes; builds the UI in `onUpdate`, the backdrop in `onRender`. |
| `src/game.ts` | The round over `js/rules.js`: selection, status line, chooseCell / deliver / hint / clear, progress counting, the score post. |
| `src/screens.ts` | The title, game screen, results card and toast (`starhermit:ui`), the board's cell widgets and their drawing. |
| `src/style.ts` | Registers `assets/ui-style.json` and the tier looks and tile classes. |
| `src/backdrop.ts` | The painted harbor, embers and sparks; the graphics tier (`js/gfx.js`). |
| `src/icons.ts` | The painted chain glyphs. |
| `src/save.ts` | The progress save, its migration and conflict merge, the sync state. |
| `src/online.ts` | Avatar, leaderboard, score submission, invite link. |
| `src/sfx.ts` | Clips, ambience, the Sound toggle. |
| `src/i18n.ts` | Locale and `T()` over `js/strings.js`. |
| `js/rng.js`, `js/content.js`, `js/rules.js` | Seeded PRNG, content, the pure rules engine (unchanged from the browser build). |
| `js/progress.js`, `js/gfx.js`, `js/strings.js` | The progress document, the graphics tier model, the translation tables. |
| `assets/ui-style.json` | The base styles, converted from `tools/ui-style.css` with `npm run css` (`starhermit css`). |
| `score-script.js` | StarHermit platform script (`server=`): range-checks a finished run's score and posts it to `high-score`. |
| `index.html`, `starhermit-files.json` | The web loader and the file index, written by `npm run package`; never edited. |

**Determinism and replay.** `applyCommand` is `(state, cmd) → {ok, state, events}` with the input state
untouched; the only clock is `cmd.atMs` from the caller. `serialize`/`deserialize` round-trip through JSON and
reject any `v !== STATE_VERSION`; `stableStringify` + `hashString` give a canonical state hash, and
`validateCommandShape` is the guard a server script would run. Cosmetic randomness never touches the rules RNG.

**Persistence.** The progress document is the only save (§12); the Sound toggle is a game setting. No session
state is persisted; quitting abandons the round.

**Performance.** Per frame: one backdrop image plus a few thousand overlay primitives at most (High: ~1,400
wave segments), the UI (~60 widgets), the sparks. The render check measures 2.4 ms of game thread at Low and
5 ms at Ultra natively.

## 14. Testing and acceptance criteria

`npm test` runs `npm run test:unit` and `npm run test:native` (point `STARHERMIT` at the runtime, the Linux
binary or `starhermit.exe` from WSL):

- `tests/rules.test.mjs` (12 cases): seeded creation is reproducible and seed-sensitive; all 40 journey stages, 6
  challenges, 3 practice presets, the endless ruleset, a daily config and all 5 tutorial lessons create a board
  with at least one legal action; all ten documented rejection reasons, with the state hash unchanged; the
  worked scoring example; streak reset and 100 ms time quantization; the four losing terminal reasons; tide
  spawn cadence and empty-board restock; the endless task-wave roll; hint priority and that following hints from
  stage 1 always terminates; serialize/deserialize; command-shape validation; `dailyConfig` purity.
- `tests/progress.test.mjs`: the browser build's `save.json` migrates as written; two devices merge by max and
  union; events count and unlock achievements once; the best only goes up.
- `tests/gfx.test.mjs`: each runtime tier maps to its row; budgets grow with the tier; level scaling ≤ 4× and
  within the caps.
- `tests/i18n.test.mjs`: every key `T("…")` in `src/*.ts` and every reachable content key is translated in every
  locale with its placeholders, and no table row is unused.
- `tests/native.mjs`: the committed web index matches the files; `starhermit check .` passes with no warning;
  and each `tests/native/*.play` script passes as a signed-out offscreen render check driving the real UI:
  `full-round.play` (a whole round of stage 1 to "Harbor restored!" by pointer and keyboard, then Play again),
  `actions.play` (hint, a refused delivery, Esc, a refused merge, the Sound toggle, Restart by button and R),
  `touch.play` (finger taps).
- `npm run test:browser` (`tests/browser.mjs`, after `npm run package`): the packaged loader in headless Chrome at
  1366×768 and 390×844 (touch, 3×): the engine starts, the title shows, Tab + Enter starts a round and H gives a
  hint, with no console errors or warnings and no error screen. `node ~/games/tools/engine-web-smoke.mjs
  harbor-stories` is the shared start-up check.

`npx tsc -p .` (TypeScript 5.9) type-checks `src/` against `.starhermit/starhermit.d.ts` (`starhermit types .`).

**QA bar as checkable statements:**
- A first-time player is taught by the stage intro, the named task list and per-action status text; Hint always
  offers a concrete legal move. ✔
- Every feature (play, deliver, hint, restart, mute, replay) is reachable by mouse, keyboard, gamepad and touch. ✔
- No console errors or warnings natively or in the browser check. ✔
- Text and UI are not cut off at 960×540, 1366×768 or 390×844; screens scroll when the window is short. ✔
- StarHermit sign-in, avatar, cloud-saved progress with the browser build's saves migrated, invite link and
  the high-score leaderboard are wired (§12). ✔

## 15. Asset inventory

| Path | Purpose | Source | Status |
|---|---|---|---|
| `assets/key-art.webp` | Title-screen hero, 1200×672, 48 KB | FLUX.2 klein, seed 2201, 30 steps | generated this pass, wired |
| `assets/harbor-restored.webp` | Win card illustration, 640×400, 29 KB | FLUX.2 klein, seed 2202 | generated this pass, wired |
| `assets/harbor-jammed.webp` | Loss card illustration, 640×400, 21 KB | FLUX.2 klein, seed 2203 | generated this pass, wired |
| `assets/dock-planks.webp` | Board background texture, 512×512, 36 KB | FLUX.2 klein, seed 2204 | generated this pass, wired via the `.hs-board` style |
| `assets/ui-style.json` | The UI's base styles | `starhermit css tools/ui-style.css` | generated, wired |
| `coverart.png` | Store cover, 1200×675, 329 KB | key art rescaled, 256-colour PNG | replaced this pass (was a generic shapes placeholder) |
| `icon.png`, `favicon.png`, `favicon.svg` | Launcher icon / tab icons | authored SVG + raster | shipped |
| `sfx/tool-select.opus` | `select` cue | MOSS-SFX v2, 100 steps | generated this pass, wired |
| `sfx/hint-gull.opus` | `hint` cue | MOSS-SFX v2, 100 steps | generated this pass, wired |
| `sfx/harbor-ambience.opus` | 12 s ambience loop | MOSS-SFX v2, 100 steps | generated this pass, wired |
| `sfx/ui-start · tool-move · tool-merge · deliver · task-complete · tide-spawn · round-advance · tasks-new · win · lose · invalid-move · resign` (12 clips) | one-shot cues | MOSS-SFX v2 | shipped |

No 3D model and no character animation: nothing in this game renders geometry or a humanoid, so TRELLIS and
Kimodo would produce assets with nowhere to live.

## 16. Known limitations

1. Only journey stage 1 is reachable; the other 39 stages, all challenges, practice, daily, endless and the
   tutorial exist as tested data with no UI entry point.
2. Content without a UI entry point (stages 2–40, story scenes, challenges, chapter names, achievement
   descriptions) has no translations yet; everything reachable in play is localized (§10).
3. `score-script.js` only range-checks the submitted score (no replay validation).
4. `Content.ACHIEVEMENTS` unlock locally into the progress document (announced in the status line) and are not
   platform achievements (the score script declares none).
5. `cfg.mechanics.undo` is set on most content and tutorial lesson 5 teaches undo, but the engine has no undo
   command and the UI has no U key.
6. The five theme palettes and the per-chain `colorHC` high-contrast values are unused.
7. `resign` is fully implemented in the rules and has a clip, but no button or key triggers it.
8. Story `SCENES` (40 authored scenes with two choices each) are never displayed.
9. A guest's progress from the browser build (its `localStorage` on the old page) does not carry over: the
   engine's storage is its own. Signed-in players' progress does (§12).
10. The overlay has no additive blending, so the beam, halos, embers and sparks blend normally where the
    browser build used `lighter`.
11. No pause or help screen; the rules live entirely in the stage intro and the status line.

## 17. Design intent not yet implemented

- **Mode select.** A title-screen route into Journey (chapter/stage map with stars), Daily, Practice,
  Challenge, Score Chase and Learn, driving the `content.js` configs that already exist and are unit-tested.
- **Story scenes.** Show `SCENES[stage]` on stage completion with its two choices, flavour-only by design.
- **Localization** of the unreachable content (stages 2–40, scenes, challenges) once it gets a UI entry point.
- **StarHermit wiring:** done — launch-token scope (fragment read, 45-min refresh), cloud-saved progression,
  idempotent local achievement unlocks for the ten declared keys (carried in the save doc). Still future:
  `GET /api/v1/time` for the daily UTC boundary and a daily leaderboard validated server-side by replaying
  the command log against `rules.js` (`hashState` is already the checksum); that validation must live in the Jint
  game script (`score-script.js` today only range-checks).
- **Undo** as a real command (`mechanics.undo`), with the U key and lesson 5's goal event.
- **Theming:** drive the board's plank tint and cell colours from the active `THEMES` palette and offer the
  `colorHC` high-contrast set as an accessibility option.
