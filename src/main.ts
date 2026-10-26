// Harbor Stories on the StarHermit engine: the entry module (starhermit.txt
// engine.entry), natively in the StarHermit client and in browsers on the
// engine's web runtime. Merge matching tools on the dock, deliver what the
// restoration tasks ask for, bring the harbor back to life.
import { onRender, onStart, onUpdate } from "starhermit:engine";
import { onAction } from "starhermit:input";
import * as ui from "starhermit:ui";
import { onPlayerChange, onSessionEnded } from "starhermit:platform";
import { drawBackdrop, setChainColors } from "./backdrop.js";
import * as game from "./game.js";
import { T } from "./i18n.js";
import { refresh } from "./online.js";
import { initSave } from "./save.js";
import { buildUi, toast } from "./screens.js";
import { loadSfx } from "./sfx.js";
import { initStyles } from "./style.js";

setChainColors(game.chainColor);

onStart(() => {
  initStyles();
  initSave();
  refresh();
  void loadSfx(); // the title needs no sound to show; clips load behind it
});

onPlayerChange(() => refresh());
onSessionEnded(() => toast(T("Signed out of StarHermit. Progress keeps saving on this device.")));

// The manifest's actions (players rebind them in the runtime's Options).
onAction((e) => {
  if (!e.pressed || !game.state || ui.capturingKeys()) return;
  if (e.action === "restart") { game.startGame(); return; }
  if (game.state.terminal) return;
  if (e.action === "deliver") game.deliver();
  else if (e.action === "hint") game.showHint();
  else if (e.action === "clear") game.clearSelection();
});

let dt = 0;
onUpdate((delta) => {
  dt = delta;
  buildUi(dt);
});
onRender(() => {
  drawBackdrop(dt);
});
