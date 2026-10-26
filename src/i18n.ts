// Localization: the translation tables (js/strings.js, English source strings
// as keys) in the interface language the runtime reports (Options › Language,
// else the device's). The UI is immediate mode, so a language change shows on
// the next frame with the round, selection and status line kept.
import { onPreferencesChange, preferences } from "starhermit:engine";
import { loadClassic } from "starhermit:script";

loadClassic("js/strings.js");
const TABLES = (globalThis as unknown as { HS_STRINGS?: Record<string, Record<string, string>> }).HS_STRINGS ?? {};

export const LOCALES = ["en-US", "en-GB", "es-419", "es-ES", "de-DE", "fr-FR", "fr-CA", "pt-BR", "it-IT"];
const PARENT: Record<string, string> = { "en-GB": "en-US", "es-ES": "es-419", "fr-CA": "fr-FR" };
const PRIMARY: Record<string, string> = { en: "en-US", es: "es-419", de: "de-DE", fr: "fr-FR", pt: "pt-BR", it: "it-IT" };
// Regions that speak a regional variant: en-AU reads en-GB, es-MX es-419.
const REGION: Record<string, string> = { "en-AU": "en-GB", "en-NZ": "en-GB", "en-IE": "en-GB", "en-IN": "en-GB", "fr-BE": "fr-FR", "pt-PT": "pt-BR" };

/** The supported locale nearest a BCP 47 tag. */
export function pickLocale(tag: string): string {
  const exact = LOCALES.find((l) => l.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const region = Object.keys(REGION).find((r) => r.toLowerCase() === tag.toLowerCase());
  if (region) return REGION[region]!;
  return PRIMARY[tag.split("-")[0]!.toLowerCase()] ?? "en-US";
}

export let locale = pickLocale(preferences().language);
onPreferencesChange((p) => { locale = pickLocale(p.language); });

/** Translates an English source string; `{name}` placeholders come from `vars`. */
export function T(key: string, vars?: Record<string, string | number>): string {
  let s = key;
  for (let l: string | undefined = locale; l; l = PARENT[l]) {
    const t = TABLES[l];
    if (t && Object.prototype.hasOwnProperty.call(t, key)) { s = t[key]!; break; }
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}
