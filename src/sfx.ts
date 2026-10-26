// Sound: the authored one-shots (sfx/<name>.opus, see sfx/manifest.json) and
// the looped harbor ambience bed, through the engine's mixer. Volumes, mute
// and the voice limit are the runtime's (Options › Audio); the game keeps
// its own "Sound: on/off" toggle, saved in the game's settings (with the
// account when signed in).
import { frame } from "starhermit:engine";
import { loadClip, play as playClip, type AudioClip, type Sound } from "starhermit:audio";
import { settings } from "starhermit:storage";

// Rules events (js/rules.js applyCommand) and UI cues -> clip.
const EVENTS: Record<string, string> = {
  "ui-start": "ui-start", move: "tool-move", merge: "tool-merge", deliver: "deliver",
  "task-complete": "task-complete", spawn: "tide-spawn", round: "round-advance", "tasks-new": "tasks-new",
  win: "win", lose: "lose", invalid: "invalid-move", resign: "resign", select: "tool-select", hint: "hint-gull",
};
const INTERFACE = new Set(["select", "invalid", "hint", "ui-start"]);
const AMBIENCE = { file: "harbor-ambience", gain: 0.32 };

const clips = new Map<string, AudioClip>();
const lastPlayed = new Map<string, number>();
let ambience: Sound | null = null;
let wantAmbience = false;

/** Loads every clip at the start (a browser hands them to its mixer at the
 * player's first press); a clip that fails to decode just stays silent. */
export async function loadSfx(): Promise<void> {
  const names = new Set([...Object.values(EVENTS), AMBIENCE.file]);
  await Promise.all([...names].map(async (file) => {
    try { clips.set(file, await loadClip(`sfx/${file}.opus`)); }
    catch (e) { console.warn(`sfx ${file}: ${String(e)}`); }
  }));
  if (wantAmbience) startAmbience();
}

function readMuted(): boolean {
  try { return settings.get("sfx.muted") === true; } catch { return false; }
}
let muted = readMuted();
settings.onChange((key, value) => {
  if (key !== "sfx.muted") return;
  muted = value === true;
  if (muted) stopAmbience(); else if (wantAmbience) startAmbience();
});

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean): void {
  muted = m;
  try { settings.set("sfx.muted", m); } catch { /* this session only */ }
  if (muted) stopAmbience(); else if (wantAmbience) startAmbience();
}
export function toggleMute(): boolean { setMuted(!muted); return muted; }

/** The ambience bed loops from the first Play on (as the browser build's
 * audio unlock did), unless the sound is off. */
export function startAmbience(): void {
  wantAmbience = true;
  if (muted || (ambience && ambience.playing)) return;
  const clip = clips.get(AMBIENCE.file);
  if (!clip) return;
  try { ambience = playClip(clip, { loop: true, gain: AMBIENCE.gain, bus: "effects" }); } catch { ambience = null; }
}
function stopAmbience(): void {
  ambience?.stop();
  ambience = null;
}

/** Plays an event's clip (once per event within 50 ms). */
export function sfx(event: string): void {
  const file = EVENTS[event];
  if (!file || muted) return;
  const now = frame().time;
  const last = lastPlayed.get(event);
  if (last !== undefined && now - last < 0.05) return;
  lastPlayed.set(event, now);
  const clip = clips.get(file);
  if (!clip) return;
  try {
    playClip(clip, { bus: INTERFACE.has(event) ? "interface" : "effects" });
  } catch {
    // A clip the mixer lost throws rather than staying silent: load it again.
    clips.delete(file);
    loadClip(`sfx/${file}.opus`).then((c) => { clips.set(file, c); }, () => { /* stays silent */ });
  }
}
