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
| Rendering | Plain DOM: a CSS grid of `<button>` cells with emoji glyphs and text labels. No canvas, no WebGL. |
| Audio | WebAudio, one effects bus, 14 authored Opus one-shots plus a looped ambience bed, synth fallbacks |

`vendor/three.module.min.js` is present but no module imports it; the game is DOM-only.

### File map

| Path | Responsibility |
|---|---|
| `index.html` | 680-byte shell: `<div id="app">`, five deferred script tags, `<noscript>` notice. |
| `css/style.css` | Every style: title screen, HUD, task rail, board grid, cells, results card, mobile rules. |
| `js/rng.js` | UMD `HSRNG`. mulberry32 PRNG, FNV-1a `hashString`, three derived streams (rules/decor/av). |
| `js/content.js` | UMD `HSContent`. 6 tool chains, 5 themes, 40 journey stages, 40 story scenes, 6 challenges, 3 practice presets, endless ruleset, daily generator, 5 tutorial lessons, 10 achievements. |
| `js/rules.js` | UMD `HSRules`. Pure engine: create, legality, resolution, scoring, spawn, terminal, hints, hashing, serialization, command-shape validation. No DOM, no `Date.now()`. |
| `js/sfx.js` | `window.HSSfx`. Event→sample map, lazy fetch/decode/cache, ambience loop, per-event synth fallback, mute/volume persisted to `localStorage`. |
| `js/main.js` | The whole UI: title screen, game render, click/key handlers, status line, best-score store. |
| `server.js` | 72-line static file server (`PORT`, default 8080), traversal guard, MIME table incl. `.webp`/`.opus`. |
| `tests/rules.test.mjs` | `npm test` — 12 `node --test` cases over the rules contract. |
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
   milliseconds. Rules in: painterly key art, a plank texture under the board. Rules out: particles,
   camera shake, screen flashes, anything that moves while you are reading the task list.

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
Two screens only; there is no pause, settings or mode-select screen. `renderGame()` re-renders the whole
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

**Motion.** Almost none: a `filter: brightness(1.08)` button hover, and a 0.5 s fade-and-rise on the key art
and results illustration, wrapped in `@media (prefers-reduced-motion: no-preference)` so a reduced-motion user
gets the identical layout with no animation at all. There are no particles, transitions on board state or
camera moves — a merged tool simply *is* the next tier on the next render.

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
- **Reduced motion.** The only two animations are inside `prefers-reduced-motion: no-preference`; with the OS
  setting on, nothing moves and no information is lost.
- **Audio is never required.** Every cue has a text equivalent in the status line, and sound is off-able and
  remembered.
- **Target sizes.** Buttons are ~40 px tall with 8 px gaps; board cells on a 390 px phone are ~66 px square.

## 12. StarHermit integration

**Used:** the launch manifest only — `starhermit.txt` with `name`, `launch=index.html`, `owner`,
`server=server.js`, `version`, `contentVersion`, `cover=coverart.png`, which is what
https://wiki.starhermit.com/ requires for a browser title, plus `server.js` as the declared static host for
the distribution.

**Not used today:** identity/profile, presence, cloud saves, per-game settings, `GET /api/v1/time`,
leaderboards, achievement delivery and launch activity. The data those need is already modelled — 10 stable
lowercase achievement keys in `Content.ACHIEVEMENTS`, a date-pure daily seed, a deterministic replayable
engine with `hashState()` and `validateCommandShape()` for authoritative validation — but no client calls the
API; the best score lives in `localStorage`. Realtime rooms, matchmaking, chat and voice are deliberately out
of scope: the ruleset is solo and asynchronous.

## 13. Technical architecture

**Module boundaries.** `rng → content → rules → sfx → main`, loaded as five `defer` scripts sharing browser
globals; `rng`, `content` and `rules` are UMD so Node tests load the exact shipped code. Only `main.js` touches
the DOM; only `sfx.js` touches WebAudio; `rules.js` imports nothing but `rng.js` and contains no clock — time
enters solely as `cmd.atMs` from the caller.

**Determinism and replay.** `applyCommand` is `(state, cmd) → {ok, state, events}` with the input state
untouched. `serialize`/`deserialize` round-trip through JSON and reject any `v !== STATE_VERSION`.
`stableStringify` + `hashString` give a canonical state hash, and `validateCommandShape` (type allow-list,
512-byte cap, 64-char id cap) is the guard a server script would run before applying a submitted command.

**Persistence.** Two `localStorage` keys, both wrapped in try/catch so private-mode browsers degrade silently:
`hs-best` (integer best score) and `hs-sfx` (`{volume, muted}`). No session state is persisted; closing the
tab abandons the round.

**Performance.** No animation frame loop and no canvas — the page is idle between inputs. A full
`innerHTML` re-render of a 7×7 board is ~49 buttons and stays well under one frame; audio decode is lazy and
cached per clip; the four WebP assets total 138 KB and the whole client is under 1 MB including sound.

**How the e2e drives the real UI.** `tests/e2e.mjs` serves the repo on an ephemeral port, launches
`/usr/bin/google-chrome` through playwright-core, and mirrors the game in Node with the same `rules.js`. It
uses `Rules.hint()` only to *decide* which cell to click; every action is a real `page.click` on
`button.hs-cell[data-r][data-c]`, `#btn-deliver` or `#btn-hint`, and after each one it waits for the visible
Moves counter to match the mirror. Any `pageerror` or console `error` fails the run.

## 14. Testing and acceptance criteria

`npm test` (`tests/rules.test.mjs`, 12 cases) verifies: seeded creation is reproducible and seed-sensitive;
all 40 journey stages, 6 challenges, 3 practice presets, the endless ruleset, a daily config and all 5 tutorial
lessons create a board with at least one legal action; all ten documented rejection reasons, with proof the
state hash is unchanged; the worked scoring example above; streak reset and 100 ms time quantization; the four
losing terminal reasons; tide spawn cadence and empty-board restock; the endless task-wave roll; hint priority
order and that following hints from stage 1 always terminates; serialize/deserialize round-trip and version
rejection; command-shape validation; and that `dailyConfig` is a pure function of the date.

`npm run test:e2e` runs the playthrough twice — desktop 1280×800 and mobile 390×844 with touch — asserting the
title screen, 25 cells and 2 tasks at start, Moves 0, a hint that changes the status line, a full win via board
clicks, the "Harbor restored!" card with a score at least the mirror's, and a clean fresh board after Play
again, with zero page errors in either pass.

**QA bar (agents/qa.md) as checkable statements** — all currently true:
- A first-time player is taught by the stage intro, the named task list and per-action status text; Hint always
  offers a concrete legal move. ✔
- Every implemented feature (play, deliver, hint, restart, mute, replay) is reachable by mouse, keyboard and
  touch in the browser. ✔
- No console errors or warnings in either e2e pass. ✔
- Text and UI are not cut off at 1280×800 or 390×844; the results card scrolls if the viewport is short. ✔
- Features that could use StarHermit do not yet — the honest gap in §12/§17. ✘

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
2. No localization — English string literals only, against a nine-locale requirement.
3. No StarHermit API usage beyond the launch manifest: no identity, cloud save, leaderboard or achievement
   delivery, so progress is device-local and losable with site data.
4. `Content.ACHIEVEMENTS` is declared but nothing ever unlocks one.
5. `cfg.mechanics.undo` is set on most content and tutorial lesson 5 teaches undo, but the engine has no undo
   command and the UI has no U key.
6. The five theme palettes and the per-chain `colorHC` high-contrast values are unused by the DOM renderer.
7. `resign` is fully implemented in the rules and has a clip, but no button or key triggers it.
8. Story `SCENES` (40 authored scenes with two choices each) are never displayed.
9. `vendor/three.module.min.js` ships without being loaded — dead weight in the distribution.
10. Every action re-renders `#app` wholesale; focus is restored by selector, but text selection and scroll
    position inside the task rail are not.
11. There is no volume slider — only a mute toggle — despite `HSSfx.setVolume` existing.
12. No pause, settings or help screen; the rules live entirely in the stage intro and the status line.

## 17. Design intent not yet implemented

- **Mode select.** A title-screen route into Journey (chapter/stage map with stars), Daily, Practice,
  Challenge, Score Chase and Learn, driving the `content.js` configs that already exist and are unit-tested.
- **Story scenes.** Show `SCENES[stage]` on stage completion with its two choices, flavour-only by design.
- **Localization** of all `main.js` and `content.js` strings into the nine required locales, chosen from the
  host locale with an in-game override.
- **StarHermit wiring:** launch-token scope, `GET /api/v1/time` for the daily UTC boundary, cloud-saved
  progression, idempotent achievement unlocks for the ten declared keys, and a daily leaderboard validated
  server-side by replaying the command log against `rules.js` (`hashState` is already the checksum).
- **Undo** as a real command (`mechanics.undo`), with the U key and lesson 5's goal event.
- **Theming:** drive the board's plank tint and cell colours from the active `THEMES` palette and offer the
  `colorHC` high-contrast set as an accessibility option.
- **Volume slider** in a settings panel alongside the existing mute toggle.
