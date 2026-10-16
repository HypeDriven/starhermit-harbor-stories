/* Harbor Stories — localization runtime (window.HSI18N).
 *
 * Nine locales: en-US, en-GB, es-419, es-ES, de-DE, fr-FR, fr-CA, pt-BR, it-IT.
 * English source strings are the keys; js/strings.js holds the tables (en-GB,
 * es-ES and fr-CA carry only their differences from en-US, es-419 and fr-FR).
 * The locale comes from the game's Language setting through sh-language.js
 * (explicit choice → StarHermit account preference → navigator.languages →
 * en-US); ?lang= forces one for the page load (QA links) and hides the selector.
 * A change sets <html lang> and fires `hs-language` on document; main.js
 * re-renders the screen and settings.js the panel, keeping the round as is.
 */
(function (root) {
  'use strict';

  var LOCALES = ['en-US', 'en-GB', 'es-419', 'es-ES', 'de-DE', 'fr-FR', 'fr-CA', 'pt-BR', 'it-IT'];
  var PARENT = { 'en-GB': 'en-US', 'es-ES': 'es-419', 'fr-CA': 'fr-FR' };
  var TABLES = root.HS_STRINGS || {};
  var hasOwn = Object.prototype.hasOwnProperty;
  var lang = 'en-US';

  function lookup(key) {
    for (var l = lang; l; l = PARENT[l]) {
      var t = TABLES[l];
      if (t && hasOwn.call(t, key)) return t[key];
    }
    return key;
  }
  function fill(s, vars) {
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return hasOwn.call(vars, k) ? String(vars[k]) : m; }) : s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  /** Translate an English source string; {name} placeholders come from vars. */
  function T(key, vars) { return fill(lookup(String(key)), vars); }
  /** Translated, HTML-escaped; vars are inserted as given (callers pass escaped HTML). */
  function TH(key, vars) { return fill(esc(lookup(String(key))), vars); }

  function setLocale(next) {
    lang = LOCALES.indexOf(next) >= 0 ? next : 'en-US';
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.dispatchEvent(new CustomEvent('hs-language', { detail: { lang: lang } }));
  }

  var forced = null;
  try { forced = new URLSearchParams(root.location.search).get('lang'); } catch (e) { /* opaque origin */ }
  var SL = root.StarHermitLanguage;
  var forcedLocale = forced && SL ? SL.match(forced, LOCALES) : null;
  var language = SL ? SL.create({
    game: 'harbor-stories', supported: LOCALES, panel: !forcedLocale,
    apply: function (locale) { setLocale(forcedLocale || locale); }
  }) : null;
  if (!language) setLocale('en-US');

  root.HSI18N = {
    T: T, TH: TH,
    get lang() { return lang; },
    locales: LOCALES,
    language: language,
    tables: TABLES
  };
})(typeof self !== 'undefined' ? self : this);
