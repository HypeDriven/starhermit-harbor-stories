# Harbor Stories — running game specification

**Status:** running spec. Present tense describes what the build does today; anything the design
calls for but the code does not yet do is collected in §17.
**Repo version:** `starhermit.txt` `version=1.0.0`, `contentVersion=1`, `js/content.js` `CONTENT_VERSION = 1`,
`js/rules.js` `STATE_VERSION = 1`.

## 1. Overview

**Pitch.** Merge matching hand tools on a dock, build them up through four tiers, and hand them to the
restoration jobs that bring a fog-bound harbor town back to life.

| | |
|---|---|
| Genre | Single-screen merge puzzler with an authored task list |
| Players | 1, local, offline after first load |
| Session | 60–150 s per stage (the shipped stage wins in 8 hint-optimal moves; human play 15–25) |
| Platforms | Desktop and mobile browsers, portrait and landscape |
| Rendering | DOM board (a CSS grid of `<button>` cells with emoji glyphs and text labels) over an optional 2D-canvas harbor backdrop and particle layer, switched by graphics quality presets. No WebGL rendering. |
| Audio | WebAudio, one effects bus, 14 authored Opus one-shots plus a looped ambience bed, synth fallbacks |

`vendor/three.module.min.js` is present but no module imports it; the game is DOM-only.

### File map

| Path | Responsibility |
|---|---|
| `index.html` | Shell: `<div id="app">`, ten deferred script tags, `<noscript>` notice. |
| `css/style.css` | Every style: title screen, HUD, task rail, board grid, cells, results card, mobile rules. |
| `starhermit-sdk.js` | Shared StarHermit client (`window.StarHermit`), copied unchanged from `tools/`. |
| `js/platform.js` | `window.HSPlatform`: StarHermit adapter over the SDK (§12). |
| `js/rng.js` | UMD `HSRNG`. mulberry32 PRNG, FNV-1a `hashString`, three derived streams (rules/decor/av). |
| `js/content.js` | UMD `HSContent`. 6 tool chains, 5 themes, 40 journey stages, 40 story scenes, 6 challenges, 3 practice presets, endless ruleset, daily generator, 5 tutorial lessons, 10 achievements. |
| `js/rules.js` | UMD `HSRules`. Pure engine: create, legality, resolution, scoring, spawn, terminal, hints, hashing, serialization, command-shape validation. No DOM, no `Date.now()`. |
| `js/sfx.js` | `window.HSSfx`. Event→sample map, lazy fetch/decode/cache, ambience loop, per-event synth fallback, mute/volume persisted to `localStorage`. |
| `js/gfx.js` | UMD `HSGfxModel`. Pure graphics quality model: presets, categories, `detectPreset`, `resolve`, `presetTier`, `choosePreset`, `setOverride`, `describe`. |
| `js/graphics.js` | `window.HSGfx`. GPU detection, backdrop canvas `#hs-gfx-bg`, particle canvas `#hs-gfx-fx`, `body[data-gfx-*]` attributes, frame loop, adaptive resolution, FPS readout, `localStorage['hs-gfx']`. |
| `js/settings.js` | `window.HSSettings`. The Settings dialog (Graphics section) and its strings in nine locales. |
| `js/main.js` | The whole UI: title screen, game render, click/key handlers, status line, best-score store. |
| `server.js` | 72-line static file server (`PORT`, default 8080), traversal guard, MIME table incl. `.webp`/`.opus`. |
| `tests/rules.test.mjs` | `npm test` — 12 `node --test` cases over the rules contract. |
| `tests/gfx.test.mjs` | `npm test` — 6 `node --test` cases over the graphics quality model. |
| `tests/platform.test.mjs` | `npm test` — 3 cases: launch token, profile, cloud save `game:<slug>`, settings KV, bindings, invite link; standalone makes no fetch. |
| `tests/e2e.mjs` | `npm run test:e2e` — playwright-core playthrough of the real UI, desktop + mobile. |
| `sfx/` | 15 Opus clips, `manifest.txt` (canonical), `manifest.json` (generator input), `manifest.md`. |
| `assets/` | `key-art.webp`, `harbor-restored.webp`, `harbor-jammed.webp`, `dock-planks.webp`. |
| `coverart.png`, `icon.png`, `favicon.svg` | Store/launcher art (1200×675, 256×256, inline SVG lighthouse). |

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
break: this is a solo score, and the local best in `localStorage['hs-best']` is a strict `>` comparison.

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

`js/content.js` ships the full content set; `js/main.js` currently launches exactly one of it.

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

| Input | Desktop | Mobile |
|---|---|---|
| Select a tool | Click a cell, or Tab to it and press Enter/Space | Tap the cell |
| Move / merge | Click the destination cell (empty = move, occupied matching = merge) | Tap the destination |
| Clear selection | Click the selected cell again, or **Esc** | Tap it again |
| Deliver | **D**, or the "Deliver selected" button | Tap "Deliver selected" |
| Hint | **H**, or the Hint button | Tap Hint |
| Restart | **R**, or the Restart button | Tap Restart |
| Mute | The "Sound: on/off" toggle (`aria-pressed`) | Same |
| Settings | The **Settings** button (title screen and game header); Tab/Shift+Tab cycle inside the dialog, Esc or Close shuts it | Tap Settings; tap outside the dialog or Close |
| Play again | The button in the results card (auto-focused) | Same |

There is no drag, no multi-touch and no gesture requirement: every action is one or two discrete taps, which
is also why the e2e bot can drive it. Modifier-key presses (Alt/Ctrl/Meta) are ignored so browser shortcuts
survive. Input is never locked — resolution is synchronous, so there is no window in which a tap is dropped;
after the game is terminal, only R and Play again do anything.

**Feedback for every input.** Selection: accent border plus a 2 px glow and `aria-pressed="true"`, a
tool-pickup sound, and a status line naming the tool. Legal action: status line with the result and the points
scored, plus a per-event sound. Illegal action: the specific reason in plain English ("Only two identical
tools merge.") and the soft `invalid` thunk — never a silent refusal.

## 7. Screens and UI flow

```
showTitle ──Play/btn-start──▶ renderGame ──terminal state──▶ results card (overlay on the board)
    ▲                            │  ▲                                   │
    └───────── R / Restart ──────┘  └────────── Play again ─────────────┘
```
Two screens plus a Settings dialog (opened from either; it lives outside `#app`, so board re-renders never touch
it, and game shortcuts are inert while it is open). There is no pause or mode-select screen. `renderGame()` re-renders the whole
`#app` after each action and restores keyboard focus by selector (`focusKey`/`restoreFocus`), so focus never
falls back to `<body>` mid-game.

- **Desktop (≥701 px).** Header (title, stage name, Moves · Score pill) over a two-column grid:
  `minmax(230px, .7fr)` task rail and `minmax(0, 2fr)` board panel. Page max-width 1280 px, centered.
- **Mobile (≤700 px).** The header stacks, the grid collapses to one column and the task rail is moved
  *below* the board with `order: 2`, so the board and status line sit in the top two-thirds and the action
  buttons stay in thumb reach. Cell name labels are visually hidden (still in the accessible name), leaving
  the glyph — the board stays square at 390 px wide.
- **Both.** `viewport-fit=cover` in `index.html` and `min-height: 100dvh` on the game keep the layout clear of
  browser chrome; the results card is `min(92vw, 520px)` with `overflow: auto` on its backdrop, so on a short
  landscape phone the headline, score and Play again button are always reachable.

Nothing is allowed to be cut off: cell labels use `overflow-wrap: anywhere` and a `clamp()` font, the score
pill un-sets `white-space: nowrap` under 700 px, and the board is `minmax(0, 1fr)` per column so it shrinks
rather than overflowing.

## 8. Art direction

**Palette** (`css/style.css` `:root`): background `#10141c`, panel `#1a2130`, soft panel `#232b3d`, text
`#f5efe6`, muted `#9aa7bd`, accent `#ffb84d`, danger `#e05a4e`. Board cells `rgba(17,26,41,.92)` with
`#39465f` borders, occupied `#253248`, secondary buttons `#dae5f8`. `js/content.js` carries five theme
palettes for the harbor scene (Golden Hour, Dawn Mist, High Noon, Stormwatch, Night Market) — the data is
shipped; the DOM board does not yet tint from it (§17).

**Shape language.** Everything is a rounded rectangle: 999 px pill buttons, 16–18 px panels, 12 px cells
(8 px on mobile). The plank texture under the board is the only diagonal-free "material" in the layout, and it
reads as a dock deck the tools sit on.

**Typography.** System UI stack ("Segoe UI", system-ui, -apple-system, Roboto). Title 56 px / `clamp(38px,
12vw, 56px)` on mobile in accent amber; body 15–18 px; cell labels `clamp(9px, 1.2vw, 13px)`; `<kbd>` hints
inside buttons at 0.82 em, hidden under 700 px where there is no keyboard.

**The hero** is the board panel: warm plank texture, cool cells, one amber-lit selection. The key art is hero
only on the title screen, and the results illustration is the hero of the end card.

**Motion.** Slow and ambient: a `filter: brightness(1.08)` button hover; a 0.5 s fade-and-rise on the key art
and results illustration; with detailed tiles, a 2 px lift on hover and a gentle 1.6 s bob on the selected
tool; with an animated backdrop, drifting waves, fog and a sweeping lighthouse beam; with particles, a ~0.8 s
spark burst on merge/deliver. There are no camera moves or transitions on board state — a merged tool simply
*is* the next tier on the next render. All of it is off under `prefers-reduced-motion: reduce` (the backdrop
is drawn still, particles are skipped), with the identical layout.

**Graphics.** Lighting and depth come from layered 2D effects, each switchable. The **harbor backdrop**
(`#hs-gfx-bg`, off/still/animated) paints a dusk sky with stars, a low sun on the horizon, a headland town with
lit windows, a lighthouse whose beam sweeps and narrows as it turns, a sea with perspective wave lines and a
shimmering sun-glitter path, two bobbing moored boats, drifting fog and (with particles) rising embers; the
static parts are cached in an offscreen layer and the moving parts redraw at ~30 fps. **Tile detail**
(flat/detailed) turns empty cells into dark water with a caustic highlight, occupied tiles into bevelled slate
with a halo and rim in the chain's colour (gold rim on tier-4 masterworks), lights the plank deck from above,
and gives panels a translucent glass finish over the backdrop. **Shadows** (off/low/high) add tile, panel and
glyph drop shadows. **Glow (bloom)** (off/on) lights the selected tool, masterworks, lantern glyphs, the title,
primary buttons, the lighthouse lamp and the sun. **Colour grade & vignette** (off/on) warms the backdrop and
darkens its corners (behind the UI, never over text or pieces). **Particles** (off/low/high) add merge and
delivery sparks (a ring and a larger burst when a task completes) on `#hs-gfx-fx`. The Settings dialog's
**Graphics** section offers a quality preset (Auto, chosen from the WebGL unmasked renderer string where
software renderers get Low, discrete GPUs and Apple M get High, others Balanced, and phones/tablets are capped at
Balanced; Low; Balanced; High; Ultra), a render scale (50–200 % of the preset's, applied to the canvases on top
of the device pixel ratio capped at 1/1.5/2/2 per preset), one override per effect ("From preset (…)" by
default; choosing a preset clears overrides), adaptive resolution (averages 90 frames; above 26 ms it steps the
canvas scale down by 0.1 to 60 %, below 14 ms back up by 0.05) and a frame-rate readout (bottom-left, never
over controls), plus a summary line "GPU · effects · W×H px". Low is the original flat look and runs no frame
loop at all; a loop runs only while the backdrop is animated, particles are live or the readout is shown.
Changes apply immediately, are saved in `localStorage['hs-gfx']`, and are mirrored as `body[data-gfx-preset]`,
`data-gfx-auto` and `data-gfx-<category>`. If a canvas cannot be created the game draws without the scene and
the panel says so; nothing is logged to the console.

**Visual assets the design calls for:** title key art (golden-hour harbor), a win illustration (lit pier), a
lock-up illustration (fogged, crated dock), a dock-plank board texture, and store cover art derived from the
key art. All five are shipped — see §15.

## 9. Audio direction

**Mix philosophy.** Quiet, wooden and close-miked. Every one-shot is a physical harbor object doing a
physical thing; the only "musical" cues are the two bell fanfares (`task-complete`, `win`). Clips are
loudness-normalised to −20 LUFS so nothing spikes over the ambience.

**Buses.** One effects `GainNode` → destination (`js/sfx.js`), gated by `muted`/`volume` and persisted in
`localStorage['hs-sfx']`. The ambience loop hangs off its own 0.32 gain node under that same bus, so mute
silences it too. The `AudioContext` is created only inside `unlock()`, called from the Play/Restart click —
no autoplay warning is ever logged. No music stems; the ambience bed is the music.

**Fallbacks.** Each event has a hand-written WebAudio synth (`tone()` + filtered noise `knock()`) that plays
while the sample is still decoding or if the fetch fails, so the game is never silent and a missing file never
breaks a cue. Repeat suppression: the same event cannot re-trigger within 50 ms.

### SFX event table (source of `sfx/manifest.txt`)

| event id | file | sound | fired by |
|---|---|---|---|
| `ui-start` | `ui-start.opus` | plank tap + brass bell chirp | Play / Restart / Play again (`startGame`) — also unlocks audio |
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
| `resign` | `resign.opus` | descending boatswain whistle, rope lowered | `HSSfx.resign()` — no UI control binds it yet |
| `ambience` | `harbor-ambience.opus` | 12 s loop: water on pilings, rope creak, two gulls | started by `unlock()`, loops for the session |

## 10. Localization

Every user-visible string is a hard-coded English literal in `js/main.js` (UI chrome, status lines, the
`INVALID_TEXT` table) and `js/content.js` (chain and tier names, stage names, task labels, intros, scenes,
achievements). `index.html` declares `lang="en"`. **The nine required locales (en-US, en-GB, es-419, es-ES,
de-DE, fr-FR, fr-CA, pt-BR, it-IT) do not ship** — this is the largest open gap against the product spec, and
is listed in §16 and §17 rather than described as working.

The one exception is the Settings dialog (`js/settings.js`): its labels, options, summary and notes ship in all
nine locales, chosen from `?lang=` or `navigator.languages` (e.g. `es-MX` → es-419, `fr-CA` → fr-CA, `en-AU` →
en-GB, anything unmatched → en-US).

The layout is expansion-ready: no fixed-width text containers, `clamp()` type, wrapping task lines and a
status line reserved at `min-height: 1.5em`, so a 30 % longer German string reflows instead of clipping.

## 11. Accessibility

- **Keyboard-only path.** Tab reaches every cell and button in DOM order; Enter/Space activates a cell exactly
  like a click; D, H, R and Esc are global; the results card auto-focuses Play again. Focus is restored by
  selector after each full re-render, so keyboard play never loses its place.
- **Focus visibility.** `:focus-visible` draws a 3 px white outline with 2 px offset on cells and buttons,
  against a dark panel — high contrast in every theme.
- **Semantics.** Cells are real `<button>`s with `aria-pressed` and an accessible name of the form
  "Row 2, column 3: Claw Hammer" / "…: Open water". The status line is `role="status"`, so every result,
  hint and rejection is announced without stealing focus. The results card is `role="dialog"`
  `aria-modal="true"` labelled by its headline. Decorative images are `alt=""` + `aria-hidden`.
- **Colour is never the only cue.** Chain identity is glyph + written tier name; selection is border, glow
  *and* `aria-pressed`; task progress is the numeral "1/2". Content also carries a `colorHC` high-contrast
  value per chain for future theming.
- **Reduced motion.** Every animation (fade-ins, tile lift/bob, animated backdrop, particles) is gated on
  `prefers-reduced-motion`; with the OS setting on, nothing moves, the Settings panel says so, and no
  information is lost. Graphics effects never lower the contrast of pieces, text or controls.
- **Audio is never required.** Every cue has a text equivalent in the status line, and sound is off-able and
  remembered.
- **Target sizes.** Buttons are ~40 px tall with 8 px gaps; board cells on a 390 px phone are ~66 px square.

## 12. StarHermit integration

**Manifest.** `starhermit.txt` declares `name`, `launch=index.html`, `owner`, `server=server.js` (the static
host), `version`, `contentVersion`, `cover`, and the four keyboard actions as `control.deliver=KeyD`,
`control.hint=KeyH`, `control.restart=KeyR`, `control.clear=Escape`.

**SDK.** `starhermit-sdk.js` (an unmodified copy of the shared `tools/starhermit-sdk.js`) loads first;
`js/platform.js` (`window.HSPlatform`) calls `StarHermit.init()` and wraps it for the UI. With a launch token
(`#game_token=` or the `#access_token=` sign-in return, stripped from the URL) the game:

- renews the token through the SDK; if renewal is refused the chip disappears, a toast says the player is
  signed out, and play continues locally;
- shows a player chip (avatar, nickname from `GET /api/v1/users/{sub}/profile` or `Player <id>`, sync state);
- loads the cloud-save slot `game:<slug>` remote-first on start and merges it into `hs-save` (remote wins,
  counters by max, achievements union), then mirrors every save-doc change with a 2 s debounce and a
  keepalive flush on `pagehide`/hidden; localStorage stays the offline cache;
- mirrors preferences to the per-game settings KV: `sfx` (`{volume, muted}`) on Sound toggle and `gfx`
  (the `hs-gfx` override object) on any Settings change; on start the platform values are applied over the
  local ones;
- resolves keyboard bindings with `StarHermit.loadBindings` and routes `keydown` by `event.code`; the
  `<kbd>` hints on Deliver/Hint/Restart show the effective key;
- shows an **Invite a friend** button on the title screen that copies `StarHermit.inviteLink()` and confirms
  with a toast;
- reads the first platform leaderboard (top 10, nicknames via the profile route) onto the title screen when
  one exists.

Served from `<id>.starhermit.com` without a token, the title shows **Sign in with StarHermit**
(`StarHermit.signIn()`). Account strings (sign-in, invite, toasts) are localized in the nine locales in
`js/settings.js` (`HSSettings.t`). Without a token nothing above runs and the game makes no network calls.

**Not used:** `server.js` is a static host, not a platform script, so there are no server sessions,
matchmaking, invites-to-session, chat, replays or server-written scores/achievements; the ten achievements
stay local in the cloud-saved doc. Realtime rooms and voice are out of scope for a solo puzzler.

## 13. Technical architecture

**Module boundaries.** `starhermit-sdk → rng → content → rules → sfx → platform → gfx → graphics → settings → main`, loaded as
`defer` scripts sharing browser globals; `rng`, `content`, `rules` and `gfx` are UMD so Node tests load the exact
shipped code. `main.js` owns `#app`; `graphics.js` owns only its two canvases, the FPS readout and the
`body[data-gfx-*]` attributes, and `settings.js` only its dialog; `main.js` hands rules events to
`HSGfx.events()` after each render for particles, and cosmetic randomness never touches the rules RNG; only `sfx.js` touches WebAudio; `rules.js` imports nothing but `rng.js` and contains no clock — time
enters solely as `cmd.atMs` from the caller.

**Determinism and replay.** `applyCommand` is `(state, cmd) → {ok, state, events}` with the input state
untouched. `serialize`/`deserialize` round-trip through JSON and reject any `v !== STATE_VERSION`.
`stableStringify` + `hashString` give a canonical state hash, and `validateCommandShape` (type allow-list,
512-byte cap, 64-char id cap) is the guard a server script would run before applying a submitted command.

**Persistence.** Four `localStorage` keys, all wrapped in try/catch so private-mode browsers degrade silently:
`hs-best` (integer best score), `hs-save` (save document: best mirror, cumulative stats, unlocked
achievements), `hs-sfx` (`{volume, muted}`) and `hs-gfx` (`{preset, render_scale, adaptive, show_fps,
<category>}`, overrides only). `hs-best`/`hs-save` are the offline cache; signed in, the
`hs-save` doc is mirrored to the StarHermit cloud-saves slot (remote wins conflicts, counters merge by max).
No session state is persisted; closing the tab abandons the round.

**Performance.** At Low there is no frame loop and no canvas is created — the page is idle between inputs;
higher presets run `requestAnimationFrame` only while something moves (see Graphics, §8). A full
`innerHTML` re-render of a 7×7 board is ~49 buttons and stays well under one frame; audio decode is lazy and
cached per clip; the four WebP assets total 138 KB and the whole client is under 1 MB including sound.

**How the e2e drives the real UI.** `tests/e2e.mjs` serves the repo on an ephemeral port, launches
`/usr/bin/google-chrome` through playwright-core, and mirrors the game in Node with the same `rules.js`. It
uses `Rules.hint()` only to *decide* which cell to click; every action is a real `page.click` on
`button.hs-cell[data-r][data-c]`, `#btn-deliver` or `#btn-hint`, and after each one it waits for the visible
Moves counter to match the mirror. Any `pageerror` or console `error`/`warning` fails the run.

## 14. Testing and acceptance criteria

`npm test` (`tests/rules.test.mjs`, 12 cases, plus `tests/gfx.test.mjs`, 6 cases) verifies: seeded creation is reproducible and seed-sensitive;
all 40 journey stages, 6 challenges, 3 practice presets, the endless ruleset, a daily config and all 5 tutorial
lessons create a board with at least one legal action; all ten documented rejection reasons, with proof the
state hash is unchanged; the worked scoring example above; streak reset and 100 ms time quantization; the four
losing terminal reasons; tide spawn cadence and empty-board restock; the endless task-wave roll; hint priority
order and that following hints from stage 1 always terminates; serialize/deserialize round-trip and version
rejection; command-shape validation; and that `dailyConfig` is a pure function of the date. The graphics tests
cover `detectPreset` on sample GPU strings and the mobile cap, `resolve` with auto/explicit presets, overrides
and render-scale clamping, preset changes clearing overrides, and the cost summary.

`npm run test:e2e` runs the playthrough twice — desktop 1280×800 and mobile 390×844 with touch — asserting the
title screen, 25 cells and 2 tasks at start, Moves 0, a hint that changes the status line, a full win via board
clicks, the "Harbor restored!" card with a score at least the mirror's, and a clean fresh board after Play
again. Each pass then opens Settings from the game header (Auto reads "detected: Low" under the software GPU,
and the dialog fits the viewport), switches Low → High (checked via `body[data-gfx-preset]` and the backdrop
canvas), overrides Shadows to Off (checked in the summary), confirms H is inert while the dialog is open and Esc
returns focus to Settings, reloads and checks the preset and override persisted, picks Ultra (override cleared),
turns on the frame-rate readout and plays four moves at Ultra, then checks StarHermit: standalone makes no
`/api/v1` request and shows no account buttons, and a `#game_token=` launch against a stubbed API shows the
nickname chip, strips the token, loads `game:<slug>` and clicking Invite a friend shows an on-screen toast — with zero page errors, console errors or
warnings in either pass.

**QA bar (agents/qa.md) as checkable statements** — all currently true:
- A first-time player is taught by the stage intro, the named task list and per-action status text; Hint always
  offers a concrete legal move. ✔
- Every implemented feature (play, deliver, hint, restart, mute, replay) is reachable by mouse, keyboard and
  touch in the browser. ✔
- No console errors or warnings in either e2e pass. ✔
- Text and UI are not cut off at 1280×800 or 390×844; the results card scrolls if the viewport is short. ✔
- StarHermit launch token, sign-in, nickname/avatar, cloud-saved progress, settings KV, key bindings, invite
  link and the read-only leaderboard are wired (§12); the server-validated daily leaderboard remains future
  work (§17). ✔

## 15. Asset inventory

| Path | Purpose | Source | Status |
|---|---|---|---|
| `assets/key-art.webp` | Title-screen hero, 1200×672, 48 KB | FLUX.2 klein, seed 2201, 30 steps | generated this pass, wired |
| `assets/harbor-restored.webp` | Win card illustration, 640×400, 29 KB | FLUX.2 klein, seed 2202 | generated this pass, wired |
| `assets/harbor-jammed.webp` | Loss card illustration, 640×400, 21 KB | FLUX.2 klein, seed 2203 | generated this pass, wired |
| `assets/dock-planks.webp` | Board background texture, 512×512, 36 KB | FLUX.2 klein, seed 2204 | generated this pass, wired via CSS |
| `coverart.png` | Store cover, 1200×675, 329 KB | key art rescaled, 256-colour PNG | replaced this pass (was a generic shapes placeholder) |
| `icon.png`, `favicon.svg` | Launcher icon / tab icon | authored SVG + raster | shipped |
| `sfx/tool-select.opus` | `select` cue | MOSS-SFX v2, 100 steps | generated this pass, wired |
| `sfx/hint-gull.opus` | `hint` cue | MOSS-SFX v2, 100 steps | generated this pass, wired |
| `sfx/harbor-ambience.opus` | 12 s ambience loop | MOSS-SFX v2, 100 steps | generated this pass, wired |
| `sfx/ui-start · tool-move · tool-merge · deliver · task-complete · tide-spawn · round-advance · tasks-new · win · lose · invalid-move · resign` (12 clips) | one-shot cues | MOSS-SFX v2 | shipped |
| `vendor/three.module.min.js` | — | upstream three.js | shipped, unused (the game is DOM-only) |

No 3D model and no character animation: nothing in this game renders geometry or a humanoid, so TRELLIS and
Kimodo would produce assets with nowhere to live.

## 16. Known limitations

1. Only journey stage 1 is reachable; the other 39 stages, all challenges, practice, daily, endless and the
   tutorial exist as tested data with no UI entry point.
2. No localization beyond the Settings dialog — game strings are English literals, against a nine-locale requirement.
3. StarHermit usage stops at the launch token, profile nickname, cloud save mirror, local achievements and
   the read-only leaderboard (§12): scores are never submitted, so leaderboard entries only appear if the
   platform seeds them, and `GET /api/v1/time` is unused.
4. `Content.ACHIEVEMENTS` unlocks locally into the save doc (announced in the status line) but is never
   delivered to a server-side catalog — browser titles have no entitlement for that.
5. `cfg.mechanics.undo` is set on most content and tutorial lesson 5 teaches undo, but the engine has no undo
   command and the UI has no U key.
6. The five theme palettes and the per-chain `colorHC` high-contrast values are unused by the DOM renderer.
7. `resign` is fully implemented in the rules and has a clip, but no button or key triggers it.
8. Story `SCENES` (40 authored scenes with two choices each) are never displayed.
9. `vendor/three.module.min.js` ships without being loaded — dead weight in the distribution.
10. Every action re-renders `#app` wholesale; focus is restored by selector, but text selection and scroll
    position inside the task rail are not.
11. There is no volume slider — only a mute toggle — despite `HSSfx.setVolume` existing.
12. No pause or help screen; Settings holds graphics only (no volume slider yet), and the rules live entirely in
    the stage intro and the status line.

## 17. Design intent not yet implemented

- **Mode select.** A title-screen route into Journey (chapter/stage map with stars), Daily, Practice,
  Challenge, Score Chase and Learn, driving the `content.js` configs that already exist and are unit-tested.
- **Story scenes.** Show `SCENES[stage]` on stage completion with its two choices, flavour-only by design.
- **Localization** of all `main.js` and `content.js` strings into the nine required locales, chosen from the
  host locale with an in-game override.
- **StarHermit wiring:** done — launch-token scope (fragment read, 45-min refresh), cloud-saved progression,
  idempotent local achievement unlocks for the ten declared keys (carried in the save doc). Still future:
  `GET /api/v1/time` for the daily UTC boundary and a daily leaderboard validated server-side by replaying
  the command log against `rules.js` (`hashState` is already the checksum); clients cannot submit scores, so
  that validation must live in a Jint game script, not this static host.
- **Undo** as a real command (`mechanics.undo`), with the U key and lesson 5's goal event.
- **Theming:** drive the board's plank tint and cell colours from the active `THEMES` palette and offer the
  `colorHC` high-contrast set as an accessibility option.
- **Volume slider** in a settings panel alongside the existing mute toggle.

## Browser interference

`browser-guard.js` (loaded from `index.html`) suppresses browser UI that gets in the way of play: the right-click context menu, the iOS long-press callout, copy / cut / paste, and page text selection. Text fields (inputs, textareas, selects, contenteditable) keep normal selection, context menu and clipboard behaviour.
