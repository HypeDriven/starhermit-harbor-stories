// The tool glyphs. The browser build showed emoji (🔨 🪢 🏮 🖌 🎣 🧱). The
// engine's built-in StarHermit Emoji draws the colour ones as text (EMOJI);
// 🖌 is a text-presentation emoji (monochrome in the engine), so the brush
// is still painted here, on a canvas atlas with the lantern's glow, and drawn
// with starhermit:draw.
import { OffscreenCanvas, type OffscreenCanvasRenderingContext2D } from "starhermit:canvas";

export const ICON = 128;
/** Chains drawn as colour emoji text, as the browser build showed them. */
export const EMOJI: Record<string, string> = { hammer: "🔨", rope: "🪢", lantern: "🏮", net: "🎣", brick: "🧱" };
const ORDER = ["brush", "glow"];
let atlas: OffscreenCanvas | null = null;

type Ctx = OffscreenCanvasRenderingContext2D;

function brush(x: Ctx): void {
  x.save();
  x.translate(64, 64);
  x.rotate(Math.PI / 4);
  // handle
  const wood = x.createLinearGradient(-7, 0, 7, 0);
  wood.addColorStop(0, "#9c3a2a"); wood.addColorStop(0.5, "#d4614a"); wood.addColorStop(1, "#7a2a1c");
  x.fillStyle = wood;
  x.beginPath(); x.roundRect(-6, -6, 12, 60, 6); x.fill();
  // ferrule
  const metal = x.createLinearGradient(-10, 0, 10, 0);
  metal.addColorStop(0, "#8f97a3"); metal.addColorStop(0.5, "#e3e7ec"); metal.addColorStop(1, "#6b7380");
  x.fillStyle = metal;
  x.beginPath(); x.roundRect(-10, -26, 20, 22, 3); x.fill();
  // bristles with paint
  x.fillStyle = "#3d2a1a";
  x.beginPath(); x.moveTo(-10, -26); x.quadraticCurveTo(-12, -46, 0, -58); x.quadraticCurveTo(12, -46, 10, -26); x.closePath(); x.fill();
  x.fillStyle = "#4f86d9";
  x.beginPath(); x.moveTo(-9, -40); x.quadraticCurveTo(-6, -52, 0, -58); x.quadraticCurveTo(6, -52, 9, -40); x.closePath(); x.fill();
  x.restore();
}

/** The lantern's glow with Glow on (drawn tinted behind the glyph). */
function glow(x: Ctx): void {
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.7)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
}

const PAINT: Record<string, (x: Ctx) => void> = { brush, glow };

/** The atlas (built on first use) and the source rectangle of a chain's glyph. */
export function icon(chain: string): { image: OffscreenCanvas; source: { x: number; y: number; width: number; height: number } } | null {
  const i = ORDER.indexOf(chain);
  if (i < 0) return null;
  if (!atlas) {
    atlas = new OffscreenCanvas(ICON * ORDER.length, ICON);
    const x = atlas.getContext("2d");
    ORDER.forEach((name, k) => {
      x.save();
      x.translate(k * ICON, 0);
      x.beginPath(); x.rect(0, 0, ICON, ICON); x.clip();
      PAINT[name]!(x);
      x.restore();
    });
  }
  return { image: atlas, source: { x: i * ICON, y: 0, width: ICON, height: ICON } };
}
