// The look. The base (the browser build's flat style.css, the Low tier) is
// assets/ui-style.json, converted once from tools/ui-style.css with
// `starhermit css`. On top of it come the looks the browser build switched
// with body[data-gfx-*] attributes: detailed tiles and glass panels, drop
// shadows, glow, the per-chain tile tints (its CSS var(--chain) and
// color-mix()) and the hover lift. They are classes registered again here
// whenever the graphics tier, the backdrop or reduced motion changes, so the
// screens name the same classes on every tier.
import { files, type ColorLike } from "starhermit:engine";
import * as ui from "starhermit:ui";
import { quality, reduced } from "./backdrop.js";
import { Content } from "./game.js";

export const COLORS = {
  bg: "#10141c", panel: "#1a2130", panelSoft: "#232b3d", text: "#f5efe6",
  muted: "#9aa7bd", accent: "#ffb84d", danger: "#e05a4e",
};

/** Registers the base styles once. */
export function initStyles(): void {
  const css = files.readJson("assets/ui-style.json") as unknown as ui.CssStyles;
  ui.setTheme({
    fontSize: 16, smallSize: 14, headingSize: 22,
    text: COLORS.text, muted: COLORS.muted, panel: COLORS.panel, control: COLORS.panelSoft,
    hovered: "#2c3650", pressed: "#39465f", field: COLORS.panelSoft, accent: COLORS.accent,
    focus: "#ffffff", outline: "#39465f",
  });
  ui.setTokens(css.tokens);
  ui.setAnimations(css.animations);
  ui.setStyles(css.styles);
  // The results card is a ui.dialog: the browser build's .hs-terminal backdrop
  // and .hs-terminal-card panel, its buttons full width with centred text.
  const card = css.styles[".hs-terminal-card"] ?? {};
  const dim = css.styles[".hs-terminal"] ?? {};
  ui.setStyles({
    dialog: { ...card, parts: { backdrop: { ...(dim.background !== undefined ? { background: dim.background } : {}) } } },
    ".hs-wide": { width: "fill", text: { align: "center" } },
  });
  applyVariants();
}

function hex(n: number): string { return `#${n.toString(16).padStart(6, "0")}`; }
/** CSS color-mix(in srgb, a p, b) for opaque hex colors. */
function mix(a: number, b: number, p: number): string {
  const ch = (n: number, s: number): number => (n >> s) & 255;
  const m = (s: number): number => Math.round(ch(a, s) * p + ch(b, s) * (1 - p));
  return hex((m(16) << 16) | (m(8) << 8) | m(0));
}
function alpha(n: number, a: number): ColorLike {
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

let variantKey = "";
/** Re-registers the tier's classes when the tier, backdrop or motion changed. */
export function applyVariants(): void {
  const q = quality();
  const motion = !reduced();
  const key = `${q.preset}/${motion}`;
  if (key === variantKey) return;
  variantKey = key;
  const detailed = q.detail === "detailed";
  const scene = q.background !== "off";
  const bloom = q.bloom === "on";
  const shadows = q.shadows;
  const blur = q.budget.panelBlur && detailed && scene;
  const styles: Record<string, ui.Style> = {};

  // Panels: glass over the backdrop (frosted on High/Ultra), drop shadows.
  const panelShadow: ui.Shadow[] = shadows === "high"
    ? [{ y: 14, blur: 34, color: "#0000006b" }, { y: 2, blur: 6, color: "#0000004d" }]
    : shadows === "low" ? [{ y: 4, blur: 12, color: "#0000004d" }] : [];
  const glass: ui.Style = detailed ? {
    background: { type: "linear", angle: 180, stops: [[34 / 255, 42 / 255, 62 / 255, 0.93], [22 / 255, 28 / 255, 43 / 255, 0.93]] },
    border: { width: 1, color: "#ffffff0f" },
  } : {};
  styles[".v-panel"] = { ...glass, ...(panelShadow.length ? { shadow: panelShadow } : {}), ...(blur ? { backdropBlur: 6 } : {}) };
  styles[".v-chip"] = { ...glass };
  styles[".v-task"] = detailed ? {
    background: { type: "linear", angle: 180, stops: ["#2a3348", "#222a3c"] },
    shadow: { y: 1, color: "#ffffff0d", inset: true },
    border: { width: { start: 3 }, color: { start: "#ffb84d8c" } },
  } : {};
  styles[".v-task-done"] = detailed ? { border: { width: { start: 3 }, color: { start: "#6fcf7c" } } } : {};

  // The plank deck, lit from above.
  styles[".v-board"] = detailed ? {
    background: [
      { type: "radial", center: { x: 0.5, y: -0.1 }, stops: [{ color: "#ffc47847", at: 0 }, { color: "#ffc47800", at: 0.62 }] },
      { type: "linear", angle: 180, stops: [{ color: "#00000000", at: 0.55 }, { color: "#0000004d", at: 1 }] },
      { image: "assets/dock-planks.webp", size: [256, 256], repeat: true },
      "#2b2018",
    ],
    shadow: [{ spread: 1, color: "#00000066", inset: true }, { blur: 44, color: "#0000008c", inset: true }, { spread: 3, color: "#3c2818cc" }],
  } : {};

  // Buttons: a sheen on detailed, a glow on the primary ones.
  const sheen: ui.Fill = { type: "linear", angle: 180, stops: [{ color: "#ffffff38", at: 0 }, { color: "#ffffff00", at: 0.6 }] };
  const btnShadow: ui.Shadow[] = [
    ...(bloom ? [{ blur: 18, color: "#ffb84d59" }] : []),
    ...(detailed ? [{ y: -2, color: "#00000024", inset: true }] : []),
  ];
  styles[".v-btn"] = {
    ...(detailed ? { background: [sheen, COLORS.accent], hovered: { background: [sheen, "#ffc46b"] } } : {}),
    ...(btnShadow.length ? { shadow: btnShadow } : {}),
  };
  styles[".v-btn-secondary"] = detailed
    ? { background: [sheen, "#dae5f8"], shadow: { y: -2, color: "#00000024", inset: true }, hovered: { background: [sheen, "#ebf1fc"] } }
    : {};

  // Titles glow; text over the painted scene gets a shadow.
  styles[".v-title"] = bloom ? { text: { shadow: [{ blur: 22, color: "#ffb84d73" }, { y: 2, blur: 8, color: "#00000099" }] } } : {};
  styles[".v-on-scene"] = scene ? { text: { shadow: { y: 2, blur: 8, color: "#000000cc" } } } : {};
  styles[".v-title-screen"] = scene ? {
    background: { type: "radial", center: { x: 0.5, y: 0.62 }, stops: [{ color: "#0a0d16d1", at: 0 }, { color: "#0a0d168c", at: 0.45 }, { color: "#0a0d1600", at: 0.72 }] },
  } : {};
  styles[".v-key-art"] = shadows === "high" ? { shadow: [{ y: 24, blur: 60, color: "#00000099" }, { spread: 1, color: "#ffb84d38" }] } : {};
  styles[".v-tier"] = detailed ? {
    background: { type: "linear", angle: 180, stops: ["#ffd78f", "#f2a53c"] },
    shadow: [{ y: 1, blur: 2, color: "#00000080" }, { y: 1, color: "#ffffff80", inset: true }],
  } : {};

  // Tiles: one class per look (empty, or a chain, masterwork or not), selected or not.
  const lift = detailed && motion;
  const tile = (chain: string | null, master: boolean, selected: boolean): ui.Style => {
    const ring: ui.Shadow[] = selected ? [{ spread: 2, color: "#ffb84d40" }] : [];
    const glow: ui.Shadow[] = !bloom ? [] : selected ? [{ blur: 22, spread: 5, color: "#ffb84db3" }]
      : master ? [{ blur: 14, spread: 1, color: "#ffcf7a6b" }] : [];
    const drop: ui.Shadow[] = !chain ? [] : shadows === "high"
      ? [{ y: 8, blur: 12, spread: -4, color: "#000000a6" }, { y: 2, blur: 3, color: "#00000073" }]
      : shadows === "low" ? [{ y: 2, blur: 3, color: "#00000080" }] : [];
    const out: ui.Style = {};
    let inset: ui.Shadow[] = [];
    if (detailed && !chain) {
      out.background = [
        { type: "radial", center: { x: 0.28, y: 0.18 }, stops: [{ color: "#82b4d229", at: 0 }, { color: "#82b4d200", at: 0.55 }] },
        { type: "linear", angle: 165, stops: ["#16283d", "#0b1523"] },
      ];
      out.border = { color: selected ? COLORS.accent : "#2c3b55" };
      out.text = { color: "#8d9bb3" };
      inset = [{ y: 3, blur: 8, color: "#00000080", inset: true }];
    } else if (detailed && chain) {
      const c = Content.CHAINS[chain]?.color ?? 0xffb84d;
      out.background = [
        { type: "radial", shape: "circle", center: { x: 0.5, y: 0.36 }, stops: [{ color: alpha(c, 0.42), at: 0 }, { color: alpha(c, 0), at: 0.62 }] },
        { type: "linear", angle: 165, stops: [{ color: "#3a4866", at: 0 }, { color: "#27324a", at: 0.55 }, { color: "#1d2639", at: 1 }] },
      ];
      out.border = { color: selected ? COLORS.accent : master ? "#ffcf7a" : mix(c, 0x3c4a66, 0.7) };
      inset = [{ y: 1, color: "#ffffff29", inset: true }, { y: -3, color: "#00000047", inset: true }];
    }
    const shadow = [...ring, ...inset, ...drop, ...glow];
    if (shadow.length) out.shadow = shadow;
    if (lift && chain) {
      out.transition = { duration: 0.12, easing: "ease-out", properties: ["translate", "background"] };
      out.hovered = { translate: { y: -2 } };
    }
    return out;
  };
  styles[".t-empty"] = tile(null, false, false);
  styles[".t-empty-sel"] = tile(null, false, true);
  for (const chain of Object.keys(Content.CHAINS)) {
    for (const master of [false, true]) {
      for (const sel of [false, true]) styles[`.t-${chain}${master ? "-m" : ""}${sel ? "-sel" : ""}`] = tile(chain, master, sel);
    }
  }
  ui.setStyles(styles);
}

/** The tile class for a cell. */
export function tileClass(chain: string | null, tier: number, selected: boolean): string {
  if (!chain) return selected ? "t-empty-sel" : "t-empty";
  return `t-${chain}${tier >= 3 ? "-m" : ""}${selected ? "-sel" : ""}`;
}
