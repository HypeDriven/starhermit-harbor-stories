// Localization: the engine's string tables (assets/strings.json, English source
// strings as keys) in the interface language the runtime reports (Options ›
// Language, else the device's). The UI is immediate mode, so a language change
// shows on the next frame with the round, selection and status line kept.
import { strings } from "starhermit:engine";
import * as ui from "starhermit:ui";

strings.load("assets/strings.json");
strings.defaultLocale = "en-US";
ui.setLanguage(strings.locale);
strings.onChange((locale) => ui.setLanguage(locale));

/** Translates an English source string; `{name}` placeholders come from `vars`. Unknown strings pass through. */
export function T(key: string, vars?: Record<string, string | number>): string {
  return strings.has(key) ? strings.t(key, vars) : key;
}
/** An engine account string (starhermit.<key>). */
export function A(key: string, vars?: Record<string, string | number>): string {
  return strings.t(`starhermit.${key}`, vars);
}
