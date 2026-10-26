// The round: the rules engine (js/rules.js, pure and deterministic) over the
// shipped content (js/content.js), the selection, the status line and the
// progress counters. Screens (screens.ts) read this state each frame and call
// the actions; nothing here draws.
import { announce } from "starhermit:ui";
import { loadClassic } from "starhermit:script";
import { T } from "./i18n.js";
import { events as fxEvents } from "./backdrop.js";
import { persist, progress, Progress } from "./save.js";
import { sfx, startAmbience } from "./sfx.js";
import { signedIn, submitScore } from "./online.js";

loadClassic("js/rng.js");
loadClassic("js/content.js");
loadClassic("js/rules.js");

export interface Loc { r: number; c: number }
export interface Item { c: string; t: number }
export interface Task { label: string; reqs: { chain: string; tier: number; count: number }[]; got: number[]; done: boolean }
export interface RulesEvent { type: string; [key: string]: unknown }
export interface GameState {
  cfg: { name?: string; intro?: string; board: { rows: number; cols: number } };
  board: (Item | null)[][];
  tasks: Task[];
  moves: number;
  score: { total: number };
  terminal: { won: boolean; reason: string } | null;
}
interface Chain { label: string; icon: string; color: number; tiers: string[] }
interface ContentApi {
  CHAINS: Record<string, Chain>;
  CHAIN_ORDER: string[];
  JOURNEY: ({ name: string; intro?: string } & Record<string, unknown>)[];
  ACHIEVEMENTS: { key: string; name: string }[];
  itemLabel(chain: string, tier: number): string;
}
type Hint = { type: string; at?: Loc; from: Loc; to: Loc; item: Item } | null;
interface RulesApi {
  createGame(cfg: unknown): GameState;
  applyCommand(state: GameState, cmd: unknown): { ok: boolean; reason?: string; state: GameState; events: RulesEvent[] };
  hint(state: GameState): Hint;
}
const G = globalThis as unknown as { HSContent: ContentApi; HSRules: RulesApi };
export const Content = G.HSContent;
const Rules = G.HSRules;

export let state: GameState | null = null;
export let selected: Loc | null = null;
/** The status line, kept as a function so it re-renders in the current language. */
let statusFn: () => string = () => "";
let startedAt = 0;
/** The end card's leaderboard line (signed in), or null. */
let lbFn: (() => string) | null = null;
/** Counts rounds started, so a late leaderboard answer for an old round is dropped. */
let round = 0;

export function status(): string { return statusFn(); }
export function leaderboardLine(): string | null { return lbFn ? lbFn() : null; }
function setStatus(fn: () => string): void {
  statusFn = fn;
  const text = fn();
  if (text) announce(text);
}

export function itemLabel(chain: string, tier: number): string { return T(Content.itemLabel(chain, tier)); }
export function itemName(item: Item | null | undefined): string { return item ? itemLabel(item.c, item.t) : T("Open water"); }
export function chainColor(chain: string): number { return Content.CHAINS[chain]?.color ?? 0xffb84d; }
function same(a: Loc | null, b: Loc | null): boolean { return !!a && !!b && a.r === b.r && a.c === b.c; }
export function isSelected(r: number, c: number): boolean { return same(selected, { r, c }); }

export function startGame(): void {
  lbFn = null;
  round++;
  startAmbience();
  sfx("ui-start");
  const cfg = Content.JOURNEY[0]!;
  state = Rules.createGame(cfg);
  selected = null;
  startedAt = performance.now();
  setStatus(() => (cfg.intro ? T(cfg.intro) : T("Select a tool, then an open or matching adjacent cell.")));
}

/** Back to the title screen (the round is dropped, as the browser build's reload did). */
export function quitToTitle(): void { state = null; selected = null; }

function invalidText(reason: string | undefined): string {
  switch (reason) {
    case "empty-source": return T("That cell is empty — pick a tool first.");
    case "empty-target": return T("There is nothing there to merge with.");
    case "occupied-target": return T("That cell is already taken.");
    case "same-cell": return T("Pick a different destination.");
    case "not-adjacent": return T("Tools only merge on touching cells.");
    case "merge-mismatch": return T("Only two identical tools merge.");
    case "max-tier": return T("That tool is already a masterwork.");
    case "not-needed": return T("No task wants that tool right now.");
    case "game-ended": return T("This round is over — play again to continue.");
    default: return reason ? String(reason).replace(/-/g, " ") : T("That action is not available.");
  }
}

function loseText(reason: unknown): string {
  switch (reason) {
    case "harbor-locked": return T("harbor locked");
    case "move-limit": return T("move limit");
    case "time-up": return T("time up");
    case "resigned": return T("resigned");
    default: return reason ? String(reason).replace(/-/g, " ") : T("round over");
  }
}

function eventText(e: RulesEvent): string {
  const item = (): string => itemLabel(String(e.chain), Number(e.tier));
  switch (e.type) {
    case "move": return T("Tool moved.");
    case "merge": return Number(e.streak) > 1
      ? T("Merged into {item}. +{points} (streak {streak})", { item: item(), points: Number(e.points), streak: Number(e.streak) })
      : T("Merged into {item}. +{points}", { item: item(), points: Number(e.points) });
    case "deliver": return T("Delivered {item} to {task}. +{points}", { item: item(), task: T(String(e.label)), points: Number(e.points) });
    case "task-complete": return T("{task} complete!", { task: T(String(e.label)) });
    case "round": return T("Round {n} begins.", { n: Number(e.round) });
    case "win": return T("Every task is done — the harbor is restored!");
    case "lose": return loseText(e.reason);
    default: return "";
  }
}

function statusFromEvents(list: RulesEvent[]): string {
  const parts: string[] = [];
  let spawned = 0;
  for (const e of list) {
    if (e.type === "spawn") { spawned++; continue; }
    const text = eventText(e);
    if (text) parts.push(text);
  }
  if (spawned) parts.push(spawned === 1 ? T("The tide brought 1 new supply.") : T("The tide brought {n} new supplies.", { n: spawned }));
  return parts.join(" ") || T("Move complete.");
}

function apply(command: Record<string, unknown>): boolean {
  if (!state) return false;
  command.atMs = performance.now() - startedAt;
  const result = Rules.applyCommand(state, command);
  if (!result.ok) {
    setStatus(() => invalidText(result.reason));
    sfx("invalid");
    return false;
  }
  state = result.state;
  const doc = progress();
  let changed = false;
  const unlocked: { name: string }[] = [];
  for (const e of result.events) {
    sfx(e.type);
    const r = Progress.track(doc, e, Content.ACHIEVEMENTS, Date.now());
    changed = changed || r.changed;
    unlocked.push(...r.fresh);
  }
  fxEvents(result.events);
  const list = result.events;
  setStatus(() => {
    let text = statusFromEvents(list);
    if (unlocked.length) {
      text += (text ? " " : "") + T("Achievement unlocked: {names}.", { names: unlocked.map((a) => T(a.name)).join(", ") });
    }
    return text;
  });
  selected = null;
  if (state.terminal) {
    if (Progress.recordBest(doc, state.score.total)) changed = true;
    postToLeaderboard(state.score.total);
  }
  if (changed) persist();
  return true;
}

/** Signed in only: post the finished run's score, and show the rank on the end card. */
function postToLeaderboard(total: number): void {
  if (!signedIn()) { lbFn = null; return; }
  const mine = round;
  lbFn = () => T("Posting score to the leaderboard…");
  submitScore(total).then((r) => {
    if (round !== mine) return;
    lbFn = () => (!r.posted ? T("Score not posted to the leaderboard.")
      : r.rank ? T("Leaderboard rank: #{rank}", { rank: r.rank }) : T("Score posted to the leaderboard."));
  }, () => { /* never rejects */ });
}

export function chooseCell(r: number, c: number): void {
  if (!state || state.terminal) return;
  const target = { r, c };
  const item = state.board[r]![c];
  if (!selected) {
    if (!item) { setStatus(() => T("Choose a tool first.")); return; }
    selected = target;
    sfx("select");
    setStatus(() => T("{item} selected. Choose its destination or Deliver.", { item: itemName(item) }));
    return;
  }
  if (same(selected, target)) {
    selected = null;
    setStatus(() => T("Selection cleared."));
    return;
  }
  apply({ type: item ? "merge" : "move", from: selected, to: target });
}

export function deliver(): void {
  if (!state || state.terminal) return;
  if (!selected) { setStatus(() => T("Select a requested tool before delivering.")); return; }
  apply({ type: "deliver", at: selected });
}

export function showHint(): void {
  if (!state || state.terminal) return;
  const h = Rules.hint(state);
  sfx("hint");
  setStatus(() => {
    if (!h) return T("No legal action is available.");
    if (h.type === "deliver") return T("Hint: deliver {item}.", { item: itemName(h.item) });
    const where = { r1: h.from.r + 1, c1: h.from.c + 1, r2: h.to.r + 1, c2: h.to.c + 1 };
    return h.type === "merge" ? T("Hint: merge from row {r1}, column {c1} to row {r2}, column {c2}.", where)
      : T("Hint: move from row {r1}, column {c1} to row {r2}, column {c2}.", where);
  });
}

export function clearSelection(): void {
  if (!state || state.terminal || !selected) return;
  selected = null;
  setStatus(() => T("Selection cleared."));
}

/** The status after the Sound toggle. */
export function soundStatus(muted: boolean): void {
  setStatus(() => (muted ? T("Sound off.") : T("Sound on.")));
}

export function bestScore(): number { return progress().best; }
