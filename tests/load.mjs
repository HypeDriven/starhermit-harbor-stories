// Loads the game's classic scripts (js/*.js, as starhermit:script loadClassic
// runs them) into one plain object standing in for the game's globalThis.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function loadClassic(...files) {
  const g = {};
  for (const f of files) new Function('self', readFileSync(path.join(ROOT, 'js', f), 'utf8')).call(g, g);
  return g;
}
