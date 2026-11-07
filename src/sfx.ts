// Sound: the authored one-shots (sfx/<name>.opus, see sfx/manifest.json), one
// engine sound bank an event, and the looped harbor ambience bed, through the
// engine's mixer. Volumes, mute and the voice limit are the runtime's
// (Options › Audio); the game keeps its own "Sound: on/off" toggle, saved in
// the game's settings (with the account when signed in) and applied with the
// engine's game mute.
import { loadClip, play as playClip, setMuted as muteGame, SoundBank, type AudioClip, type Sound } from "starhermit:audio";
import { settings } from "starhermit:storage";

// Rules events (js/rules.js applyCommand) and UI cues -> clip.
const EVENTS: Record<string, string> = {
  "ui-start": "ui-start", move: "tool-move", merge: "tool-merge", deliver: "deliver",
  "task-complete": "task-complete", spawn: "tide-spawn", round: "round-advance", "tasks-new": "tasks-new",
  win: "win", lose: "lose", invalid: "invalid-move", resign: "resign", select: "tool-select", hint: "hint-gull",
};
const INTERFACE = new Set(["select", "invalid", "hint", "ui-start"]);
const AMBIENCE = { file: "harbor-ambience", gain: 0.32 };

const banks = new Map<string, SoundBank>();
let ambienceClip: AudioClip | null = null;
let ambience: Sound | null = null;
let wantAmbience = false;

/** Loads every clip at the start (a browser hands them to its mixer at the
 * player's first press); a clip that fails to decode just stays silent. */
export async function loadSfx(): Promise<void> {
  await Promise.all([
    ...Object.entries(EVENTS).map(async ([event, file]) => {
      try {
        const clip = await loadClip(`sfx/${file}.opus`);
        // once per event within 50 ms
        banks.set(event, new SoundBank({ clips: [clip], minGap: 0.05, bus: INTERFACE.has(event) ? "interface" : "effects" }));
      } catch (e) { console.warn(`sfx ${file}: ${String(e)}`); }
    }),
    (async () => {
      try { ambienceClip = await loadClip(`sfx/${AMBIENCE.file}.opus`); }
      catch (e) { console.warn(`sfx ${AMBIENCE.file}: ${String(e)}`); }
    })(),
  ]);
  if (wantAmbience) startAmbience();
}

function readMuted(): boolean {
  try { return settings.get("sfx.muted") === true; } catch { return false; }
}
let muted = readMuted();
muteGame(muted);
settings.onChange((key, value) => {
  if (key !== "sfx.muted") return;
  muted = value === true;
  muteGame(muted);
});

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean): void {
  muted = m;
  muteGame(m);
  try { settings.set("sfx.muted", m); } catch { /* this session only */ }
}
export function toggleMute(): boolean { setMuted(!muted); return muted; }

/** The ambience bed loops from the first Play on (as the browser build's
 * audio unlock did). */
export function startAmbience(): void {
  wantAmbience = true;
  if ((ambience && ambience.playing) || !ambienceClip) return;
  try { ambience = playClip(ambienceClip, { loop: true, gain: AMBIENCE.gain, bus: "effects" }); } catch { ambience = null; }
}

/** Plays an event's clip. */
export function sfx(event: string): void {
  try { banks.get(event)?.play(); } catch { /* the mixer is full this frame: skip it */ }
}
