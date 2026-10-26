// The player's progress (js/progress.js: best score, lifetime counters, local
// achievements) as the game's save: starhermit:storage `saves` keeps it on
// the device and, signed in, in the account's cloud slot, with conflicts
// merged (best and counters by max, achievements by union). Players of the
// browser build keep their progress: its cloud slot game:<slug> held the same
// document as a zipped save.json, which the engine shows as a foreign save;
// it is merged in and replaces the slot once (`replaceForeign`).
import type { JsonValue } from "starhermit:engine";
import { saves, settings } from "starhermit:storage";
import { loadClassic } from "starhermit:script";
import { setMuted } from "./sfx.js";

loadClassic("js/progress.js");

export interface ProgressDoc {
  v: 1;
  best: number;
  achievements: Record<string, number>;
  stats: Record<string, number>;
}
interface ProgressApi {
  empty(): ProgressDoc;
  normalize(d: unknown): ProgressDoc | null;
  parse(text: string): ProgressDoc | null;
  merge(a: unknown, b: unknown): ProgressDoc;
  track(doc: ProgressDoc, event: unknown, achievements: unknown, now: number): { changed: boolean; fresh: { key: string; name: string }[] };
  recordBest(doc: ProgressDoc, score: number): boolean;
}
export const Progress = (globalThis as unknown as { HSProgress: ProgressApi }).HSProgress;

const SCHEMA = 1;
let doc: ProgressDoc = load();

function load(): ProgressDoc {
  try { return Progress.normalize(saves.load()?.data) ?? Progress.empty(); } catch { return Progress.empty(); }
}

export function progress(): ProgressDoc { return doc; }

/** Saves the document (device at once; the account debounced). */
export function persist(): void {
  try { saves.save(doc as unknown as JsonValue, { schema: SCHEMA }); } catch (e) { console.warn(`save: ${String(e)}`); }
}

/** The account's copy replaced the device's (another device saved last). */
function reload(): void {
  const now = Progress.normalize(saves.load()?.data);
  if (now) doc = Progress.merge(doc, now);
}

/** A browser-build save in the slot: merge it in and replace it, once. */
function migrateForeign(): void {
  const old = saves.foreign();
  if (!old) return;
  const imported = old.text != null ? Progress.parse(old.text) : null;
  doc = Progress.merge(doc, imported);
  try { saves.save(doc as unknown as JsonValue, { schema: SCHEMA, replaceForeign: true }); }
  catch (e) { console.warn(`save migration: ${String(e)}`); }
}

/** Starts listening; call once at start. */
export function initSave(): void {
  saves.onConflict((local, remote) => ({ merged: Progress.merge(local?.data, remote.data) as unknown as JsonValue }));
  saves.onStatus((_, state) => {
    if (state === "foreign") migrateForeign();
    else reload();
  });
  if (saves.state() === "foreign") migrateForeign();
  // The browser build's settings: { sfx: { volume, muted }, gfx: {…} }. The
  // volume and graphics now live in the runtime's Options; the mute becomes
  // the game's Sound toggle (sfx.ts) unless it was set since.
  settings.onLegacy(importLegacySettings);
  importLegacySettings();
}

function importLegacySettings(): void {
  const keys = settings.legacyKeys();
  if (!keys) return;
  for (const key of keys) {
    if (key === "sfx") {
      const old = settings.legacy("sfx") as { muted?: unknown } | undefined;
      if (old && typeof old.muted === "boolean" && settings.get("sfx.muted") === undefined) setMuted(old.muted);
    }
    if (key === "sfx" || key === "gfx") settings.removeLegacy(key);
  }
}

/** For the player chip: the save's sync state in the browser build's words. */
export function syncStatus(): "loading" | "saving" | "synced" | "error" | "offline" {
  switch (saves.state()) {
    case "loading": case "foreign": return "loading";
    case "uploading": return "saving";
    case "ready": return saves.status() === "pending" ? "saving" : "synced";
    case "signed-out": return "offline";
    default: return "error";
  }
}
