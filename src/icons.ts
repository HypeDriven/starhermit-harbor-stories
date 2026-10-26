// The tool glyphs. The browser build showed emoji (🔨 🪢 🏮 🖌 🎣 🧱); the
// engine draws text with the system's fonts, which have no colour emoji (and
// often no emoji at all), so the six glyphs are painted once here in the same
// spirit, on a canvas atlas, and drawn with starhermit:draw.
import { OffscreenCanvas, type OffscreenCanvasRenderingContext2D } from "starhermit:canvas";

export const ICON = 128;
const ORDER = ["hammer", "rope", "lantern", "brush", "net", "brick", "glow"];
let atlas: OffscreenCanvas | null = null;

type Ctx = OffscreenCanvasRenderingContext2D;

function hammer(x: Ctx): void {
  x.save();
  x.translate(64, 66);
  x.rotate(-Math.PI / 4);
  // wooden handle
  const wood = x.createLinearGradient(-8, 0, 8, 0);
  wood.addColorStop(0, "#b7793f"); wood.addColorStop(0.5, "#d9a066"); wood.addColorStop(1, "#8a5424");
  x.fillStyle = wood;
  x.beginPath(); x.roundRect(-7, -18, 14, 70, 6); x.fill();
  // steel head
  const steel = x.createLinearGradient(0, -44, 0, -16);
  steel.addColorStop(0, "#d5dbe3"); steel.addColorStop(0.5, "#9aa4b1"); steel.addColorStop(1, "#5f6875");
  x.fillStyle = steel;
  x.beginPath(); x.roundRect(-34, -44, 60, 26, 5); x.fill();
  x.fillStyle = "#4a525e";
  x.beginPath(); x.roundRect(22, -48, 14, 34, 4); x.fill();
  x.fillStyle = "rgba(255,255,255,0.45)";
  x.fillRect(-30, -41, 50, 4);
  x.restore();
}

function rope(x: Ctx): void {
  x.save();
  x.translate(64, 64);
  x.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const r = 46 - i * 11;
    x.strokeStyle = i % 2 ? "#c99a52" : "#e2bd7a";
    x.lineWidth = 11;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke();
    // twist marks
    x.strokeStyle = "rgba(120,80,30,0.55)";
    x.lineWidth = 2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / (6 + i * -1 + 4)) {
      const c = Math.cos(a), s = Math.sin(a);
      x.beginPath();
      x.moveTo(c * (r - 5), s * (r - 5));
      x.lineTo(c * (r + 5) - s * 3, s * (r + 5) + c * 3);
      x.stroke();
    }
  }
  // the loose end
  x.strokeStyle = "#e2bd7a";
  x.lineWidth = 11;
  x.beginPath(); x.moveTo(40, 22); x.quadraticCurveTo(58, 40, 50, 58); x.stroke();
  x.restore();
}

function lantern(x: Ctx): void {
  x.save();
  x.translate(64, 66);
  // the paper body
  const body = x.createRadialGradient(-10, -12, 6, 0, 0, 48);
  body.addColorStop(0, "#ff8a5c"); body.addColorStop(0.6, "#e0392b"); body.addColorStop(1, "#9c1d18");
  x.fillStyle = body;
  x.beginPath(); x.ellipse(0, 0, 40, 36, 0, 0, Math.PI * 2); x.fill();
  // ribs
  x.strokeStyle = "rgba(90,10,10,0.5)";
  x.lineWidth = 2.5;
  for (const k of [-0.6, -0.2, 0.2, 0.6]) {
    x.beginPath(); x.ellipse(0, 0, 40 * Math.abs(k), 36, 0, k < 0 ? Math.PI / 2 : -Math.PI / 2, k < 0 ? Math.PI * 1.5 : Math.PI / 2); x.stroke();
  }
  // caps and the hanger
  x.fillStyle = "#2b1c12";
  x.beginPath(); x.roundRect(-22, -44, 44, 12, 3); x.fill();
  x.beginPath(); x.roundRect(-22, 32, 44, 12, 3); x.fill();
  x.fillStyle = "#e8b54a";
  x.fillRect(-22, -36, 44, 3);
  x.fillRect(-22, 33, 44, 3);
  x.strokeStyle = "#2b1c12"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, -44); x.lineTo(0, -58); x.stroke();
  x.fillStyle = "#e8b54a";
  x.fillRect(-3, 44, 6, 14);
  x.restore();
}

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

function net(x: Ctx): void {
  x.save();
  x.translate(56, 52);
  // handle
  x.strokeStyle = "#b07a3e"; x.lineWidth = 9; x.lineCap = "round";
  x.beginPath(); x.moveTo(26, 26); x.lineTo(58, 62); x.stroke();
  // the mesh inside the hoop
  x.save();
  x.beginPath(); x.arc(0, 0, 36, 0, Math.PI * 2); x.clip();
  x.fillStyle = "rgba(93,156,89,0.25)";
  x.fillRect(-40, -40, 80, 80);
  x.strokeStyle = "#cfe0c4"; x.lineWidth = 2;
  for (let d = -48; d <= 48; d += 10) {
    x.beginPath(); x.moveTo(d - 40, -40); x.lineTo(d + 40, 40); x.stroke();
    x.beginPath(); x.moveTo(d + 40, -40); x.lineTo(d - 40, 40); x.stroke();
  }
  x.restore();
  // hoop
  x.strokeStyle = "#5d9c59"; x.lineWidth = 7;
  x.beginPath(); x.arc(0, 0, 36, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 2;
  x.beginPath(); x.arc(0, 0, 36, Math.PI * 1.05, Math.PI * 1.55); x.stroke();
  x.restore();
}

function brick(x: Ctx): void {
  x.save();
  x.fillStyle = "#e8dccb"; // mortar
  x.beginPath(); x.roundRect(10, 22, 108, 84, 6); x.fill();
  const rows = [[14, 26, 48, 22], [66, 26, 48, 22], [14, 52, 22, 22], [40, 52, 48, 22], [92, 52, 22, 22], [14, 78, 48, 24], [66, 78, 48, 24]];
  for (const [bx, by, bw, bh] of rows) {
    const g = x.createLinearGradient(0, by!, 0, by! + bh!);
    g.addColorStop(0, "#d86b5a"); g.addColorStop(1, "#9e3b31");
    x.fillStyle = g;
    x.beginPath(); x.roundRect(bx!, by!, bw!, bh!, 3); x.fill();
    x.fillStyle = "rgba(255,255,255,0.18)";
    x.fillRect(bx! + 2, by! + 2, bw! - 4, 3);
  }
  x.restore();
}

/** The lantern's glow with Glow on (drawn tinted behind the glyph). */
function glow(x: Ctx): void {
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.7)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
}

const PAINT: Record<string, (x: Ctx) => void> = { hammer, rope, lantern, brush, net, brick, glow };

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
