// StarHermit online features for a signed-in player (a guest makes no
// platform calls): the avatar for the player chip, the high-score
// leaderboard's top 10 for the title screen, posting a finished run's score
// through the game's score script (score-script.js: a practice session whose
// script range-checks the score and writes it to the board), and the invite
// link. Signing in and out is the runtime's (Account dialog / the client).
import { OffscreenCanvas } from "starhermit:canvas";
import { clipboard } from "starhermit:engine";
import {
  avatar, connectGame, inviteLink, leaderboards, player, profile, sessions,
  type Leaderboard,
} from "starhermit:platform";
import { T } from "./i18n.js";

export interface BoardRow { name: string; score: number; mine: boolean }

let rows: BoardRow[] | null = null;
let avatarImage: OffscreenCanvas | null = null;
let link: string | null = null;
let board: Leaderboard | null = null;

export function signedIn(): boolean { return player() !== null; }
export function leaderboardRows(): BoardRow[] | null { return rows; }
/** The player's avatar cut to a circle (64 px), or null. */
export function avatarCanvas(): OffscreenCanvas | null { return avatarImage; }

/** Fetches what the title screen shows for the player now signed in (or clears it). */
export function refresh(): void {
  rows = null; avatarImage = null; link = null; board = null;
  const me = player();
  if (!me) return;
  void refreshLeaderboard();
  avatar(me.userId).then((bmp) => {
    if (!bmp || player()?.userId !== me.userId) return;
    const c = new OffscreenCanvas(64, 64);
    const x = c.getContext("2d");
    x.beginPath();
    x.arc(32, 32, 32, 0, Math.PI * 2);
    x.clip();
    x.drawImage(bmp, 0, 0, 64, 64);
    bmp.close();
    avatarImage = c;
  }, () => { /* no avatar */ });
  inviteLink().then((l) => { link = l; }, () => { link = null; });
}

async function highScoreBoard(): Promise<Leaderboard | null> {
  if (board) return board;
  const list = await leaderboards.list();
  board = list.find((b) => b.key === "high-score") ?? null;
  return board;
}

export async function refreshLeaderboard(): Promise<void> {
  const me = player();
  if (!me) return;
  try {
    const b = await highScoreBoard();
    if (!b) return;
    const page = await leaderboards.entries(b.id, { pageSize: 10 });
    const list = await Promise.all(page.items.map(async (e) => {
      let name = e.username || T("Player");
      try { name = (await profile(e.userId)).displayName; } catch { /* the username */ }
      return { name, score: Math.floor(Number(e.score) || 0), mine: e.userId === me.userId };
    }));
    if (player()?.userId === me.userId) rows = list.length ? list : null;
  } catch { /* the board stays as it was */ }
}

/** Posts a finished run's score; resolves whether it was taken and the
 * player's rank on the board (null when not among the first 100). Never rejects. */
export async function submitScore(total: number): Promise<{ posted: boolean; rank: number | null }> {
  const me = player();
  if (!me) return { posted: false, rank: null };
  let accepted: string[] = [];
  try {
    const sessionId = await sessions.practice();
    accepted = await new Promise<string[]>((resolve) => {
      const socket = connectGame(sessionId);
      let done = false;
      const finish = (list: string[]): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        socket.close();
        resolve(list);
      };
      const timer = setTimeout(() => finish([]), 15000);
      socket.on("open", () => { socket.sendCommand({ type: "result", scores: { "high-score": total } }); });
      socket.on("game", (data) => {
        const d = data as { type?: string; accepted?: string[] } | null;
        if (d && d.type === "result-ack") finish(Array.isArray(d.accepted) ? d.accepted : []);
      });
      socket.on("error", () => finish([]));
      socket.on("stopped", () => finish([]));
      socket.on("abandoned", () => finish([]));
    });
  } catch { return { posted: false, rank: null }; }
  if (!accepted.includes("high-score")) return { posted: false, rank: null };
  void refreshLeaderboard();
  try {
    const b = await highScoreBoard();
    if (!b) return { posted: true, rank: null };
    const page = await leaderboards.entries(b.id, { pageSize: 100 });
    const mine = page.items.find((e) => e.userId === me.userId);
    return { posted: true, rank: mine ? mine.rank : null };
  } catch { return { posted: true, rank: null }; }
}

/** Copies the invite link (call while handling the button's press); the toast text. */
export function copyInvite(): string {
  if (!link) return T("Could not copy the invite link: {link}", { link: "" });
  try { clipboard.writeText(link); return T("Invite link copied to clipboard."); }
  catch { return T("Could not copy the invite link: {link}", { link }); }
}
