/* Harbor Stories — Settings panel (window.HSSettings).
 * A modal dialog outside #app (so board re-renders never touch it) with the
 * Graphics section: quality preset, render scale, one override per effect,
 * adaptive resolution and a frame-rate readout. Strings for the panel are
 * localized in the nine supported locales; the locale comes from ?lang= or
 * navigator.languages. */
(function () {
'use strict';

var STRINGS = {
  'en-US': {
    settings: 'Settings', graphics: 'Graphics', close: 'Close', quality: 'Quality',
    auto: 'Auto (detected: {tier})', fromPreset: 'From preset ({tier})',
    presets: { low: 'Low', balanced: 'Balanced', high: 'High', ultra: 'Ultra' },
    renderScale: 'Render scale', adaptive: 'Adaptive resolution', showFps: 'Show frame rate',
    cats: { background: 'Harbor backdrop', detail: 'Tile detail', shadows: 'Shadows', bloom: 'Glow (bloom)', grade: 'Color grade & vignette', particles: 'Particles' },
    tiers: { off: 'Off', on: 'On', 'static': 'Still', animated: 'Animated', plain: 'Flat', detailed: 'Detailed', low: 'Low', high: 'High' },
    sum: {
      background: { off: 'no backdrop', 'static': 'still harbor', animated: 'animated harbor' },
      detail: { plain: 'flat tiles', detailed: 'detailed tiles' },
      shadows: { low: 'shadows', high: 'soft shadows' }, bloom: { on: 'glow' }, grade: { on: 'color grade' },
      particles: { low: 'few particles', high: 'particles' }
    },
    unknownGpu: 'No hardware GPU detected',
    failed: 'Scene effects are unavailable on this device, so the game is drawn without them.',
    reduced: 'Reduced motion is on: the backdrop stays still and particles are off.',
    saved: 'Changes apply immediately and are saved on this device.'
  },
  'en-GB': {
    settings: 'Settings', graphics: 'Graphics', close: 'Close', quality: 'Quality',
    auto: 'Auto (detected: {tier})', fromPreset: 'From preset ({tier})',
    presets: { low: 'Low', balanced: 'Balanced', high: 'High', ultra: 'Ultra' },
    renderScale: 'Render scale', adaptive: 'Adaptive resolution', showFps: 'Show frame rate',
    cats: { background: 'Harbour backdrop', detail: 'Tile detail', shadows: 'Shadows', bloom: 'Glow (bloom)', grade: 'Colour grade & vignette', particles: 'Particles' },
    tiers: { off: 'Off', on: 'On', 'static': 'Still', animated: 'Animated', plain: 'Flat', detailed: 'Detailed', low: 'Low', high: 'High' },
    sum: {
      background: { off: 'no backdrop', 'static': 'still harbour', animated: 'animated harbour' },
      detail: { plain: 'flat tiles', detailed: 'detailed tiles' },
      shadows: { low: 'shadows', high: 'soft shadows' }, bloom: { on: 'glow' }, grade: { on: 'colour grade' },
      particles: { low: 'few particles', high: 'particles' }
    },
    unknownGpu: 'No hardware GPU detected',
    failed: 'Scene effects are unavailable on this device, so the game is drawn without them.',
    reduced: 'Reduced motion is on: the backdrop stays still and particles are off.',
    saved: 'Changes apply immediately and are saved on this device.'
  },
  'es-419': {
    settings: 'Ajustes', graphics: 'Gráficos', close: 'Cerrar', quality: 'Calidad',
    auto: 'Automática (detectada: {tier})', fromPreset: 'Según el ajuste ({tier})',
    presets: { low: 'Baja', balanced: 'Equilibrada', high: 'Alta', ultra: 'Ultra' },
    renderScale: 'Escala de renderizado', adaptive: 'Resolución adaptable', showFps: 'Mostrar fotogramas por segundo',
    cats: { background: 'Fondo del puerto', detail: 'Detalle de fichas', shadows: 'Sombras', bloom: 'Resplandor (bloom)', grade: 'Corrección de color y viñeta', particles: 'Partículas' },
    tiers: { off: 'Desactivado', on: 'Activado', 'static': 'Fijo', animated: 'Animado', plain: 'Plano', detailed: 'Detallado', low: 'Bajo', high: 'Alto' },
    sum: {
      background: { off: 'sin fondo', 'static': 'puerto fijo', animated: 'puerto animado' },
      detail: { plain: 'fichas planas', detailed: 'fichas detalladas' },
      shadows: { low: 'sombras', high: 'sombras suaves' }, bloom: { on: 'resplandor' }, grade: { on: 'corrección de color' },
      particles: { low: 'pocas partículas', high: 'partículas' }
    },
    unknownGpu: 'No se detectó una GPU de hardware',
    failed: 'Los efectos de escena no están disponibles en este dispositivo; el juego se dibuja sin ellos.',
    reduced: 'Movimiento reducido activado: el fondo queda fijo y no hay partículas.',
    saved: 'Los cambios se aplican al instante y se guardan en este dispositivo.'
  },
  'es-ES': {
    settings: 'Ajustes', graphics: 'Gráficos', close: 'Cerrar', quality: 'Calidad',
    auto: 'Automática (detectada: {tier})', fromPreset: 'Según el ajuste ({tier})',
    presets: { low: 'Baja', balanced: 'Equilibrada', high: 'Alta', ultra: 'Ultra' },
    renderScale: 'Escala de renderizado', adaptive: 'Resolución adaptativa', showFps: 'Mostrar fotogramas por segundo',
    cats: { background: 'Fondo del puerto', detail: 'Detalle de fichas', shadows: 'Sombras', bloom: 'Resplandor (bloom)', grade: 'Etalonaje y viñeta', particles: 'Partículas' },
    tiers: { off: 'Desactivado', on: 'Activado', 'static': 'Fijo', animated: 'Animado', plain: 'Plano', detailed: 'Detallado', low: 'Bajo', high: 'Alto' },
    sum: {
      background: { off: 'sin fondo', 'static': 'puerto fijo', animated: 'puerto animado' },
      detail: { plain: 'fichas planas', detailed: 'fichas detalladas' },
      shadows: { low: 'sombras', high: 'sombras suaves' }, bloom: { on: 'resplandor' }, grade: { on: 'etalonaje' },
      particles: { low: 'pocas partículas', high: 'partículas' }
    },
    unknownGpu: 'No se ha detectado una GPU de hardware',
    failed: 'Los efectos de escena no están disponibles en este dispositivo; el juego se dibuja sin ellos.',
    reduced: 'Movimiento reducido activado: el fondo queda fijo y no hay partículas.',
    saved: 'Los cambios se aplican al momento y se guardan en este dispositivo.'
  },
  'de-DE': {
    settings: 'Einstellungen', graphics: 'Grafik', close: 'Schließen', quality: 'Qualität',
    auto: 'Automatisch (erkannt: {tier})', fromPreset: 'Aus Voreinstellung ({tier})',
    presets: { low: 'Niedrig', balanced: 'Ausgewogen', high: 'Hoch', ultra: 'Ultra' },
    renderScale: 'Renderskalierung', adaptive: 'Adaptive Auflösung', showFps: 'Bildrate anzeigen',
    cats: { background: 'Hafenkulisse', detail: 'Kacheldetails', shadows: 'Schatten', bloom: 'Leuchten (Bloom)', grade: 'Farbkorrektur & Vignette', particles: 'Partikel' },
    tiers: { off: 'Aus', on: 'An', 'static': 'Unbewegt', animated: 'Animiert', plain: 'Flach', detailed: 'Detailliert', low: 'Niedrig', high: 'Hoch' },
    sum: {
      background: { off: 'keine Kulisse', 'static': 'unbewegter Hafen', animated: 'animierter Hafen' },
      detail: { plain: 'flache Kacheln', detailed: 'detaillierte Kacheln' },
      shadows: { low: 'Schatten', high: 'weiche Schatten' }, bloom: { on: 'Leuchten' }, grade: { on: 'Farbkorrektur' },
      particles: { low: 'wenige Partikel', high: 'Partikel' }
    },
    unknownGpu: 'Keine Hardware-GPU erkannt',
    failed: 'Szeneneffekte sind auf diesem Gerät nicht verfügbar; das Spiel wird ohne sie dargestellt.',
    reduced: 'Reduzierte Bewegung ist aktiv: Die Kulisse bleibt still, Partikel sind aus.',
    saved: 'Änderungen gelten sofort und werden auf diesem Gerät gespeichert.'
  },
  'fr-FR': {
    settings: 'Paramètres', graphics: 'Graphismes', close: 'Fermer', quality: 'Qualité',
    auto: 'Auto (détectée : {tier})', fromPreset: 'Selon le préréglage ({tier})',
    presets: { low: 'Basse', balanced: 'Équilibrée', high: 'Haute', ultra: 'Ultra' },
    renderScale: 'Échelle de rendu', adaptive: 'Résolution adaptative', showFps: 'Afficher les images par seconde',
    cats: { background: 'Décor du port', detail: 'Détail des tuiles', shadows: 'Ombres', bloom: 'Lueur (bloom)', grade: 'Étalonnage et vignettage', particles: 'Particules' },
    tiers: { off: 'Désactivé', on: 'Activé', 'static': 'Fixe', animated: 'Animé', plain: 'Plat', detailed: 'Détaillé', low: 'Bas', high: 'Élevé' },
    sum: {
      background: { off: 'sans décor', 'static': 'port fixe', animated: 'port animé' },
      detail: { plain: 'tuiles plates', detailed: 'tuiles détaillées' },
      shadows: { low: 'ombres', high: 'ombres douces' }, bloom: { on: 'lueur' }, grade: { on: 'étalonnage' },
      particles: { low: 'peu de particules', high: 'particules' }
    },
    unknownGpu: 'Aucun GPU matériel détecté',
    failed: 'Les effets de scène ne sont pas disponibles sur cet appareil ; le jeu s’affiche sans eux.',
    reduced: 'Mouvements réduits activés : le décor reste fixe et les particules sont coupées.',
    saved: 'Les changements s’appliquent aussitôt et sont enregistrés sur cet appareil.'
  },
  'fr-CA': {
    settings: 'Paramètres', graphics: 'Graphiques', close: 'Fermer', quality: 'Qualité',
    auto: 'Auto (détectée : {tier})', fromPreset: 'Selon le préréglage ({tier})',
    presets: { low: 'Basse', balanced: 'Équilibrée', high: 'Haute', ultra: 'Ultra' },
    renderScale: 'Échelle de rendu', adaptive: 'Résolution adaptative', showFps: 'Afficher les images par seconde',
    cats: { background: 'Décor du port', detail: 'Détail des tuiles', shadows: 'Ombres', bloom: 'Lueur (bloom)', grade: 'Correction des couleurs et vignette', particles: 'Particules' },
    tiers: { off: 'Désactivé', on: 'Activé', 'static': 'Fixe', animated: 'Animé', plain: 'Plat', detailed: 'Détaillé', low: 'Bas', high: 'Élevé' },
    sum: {
      background: { off: 'sans décor', 'static': 'port fixe', animated: 'port animé' },
      detail: { plain: 'tuiles plates', detailed: 'tuiles détaillées' },
      shadows: { low: 'ombres', high: 'ombres douces' }, bloom: { on: 'lueur' }, grade: { on: 'correction des couleurs' },
      particles: { low: 'peu de particules', high: 'particules' }
    },
    unknownGpu: 'Aucun GPU matériel détecté',
    failed: 'Les effets de scène ne sont pas offerts sur cet appareil; le jeu s’affiche sans eux.',
    reduced: 'Mouvements réduits activés : le décor reste fixe et les particules sont désactivées.',
    saved: 'Les changements s’appliquent tout de suite et sont enregistrés sur cet appareil.'
  },
  'pt-BR': {
    settings: 'Configurações', graphics: 'Gráficos', close: 'Fechar', quality: 'Qualidade',
    auto: 'Automática (detectada: {tier})', fromPreset: 'Conforme predefinição ({tier})',
    presets: { low: 'Baixa', balanced: 'Equilibrada', high: 'Alta', ultra: 'Ultra' },
    renderScale: 'Escala de renderização', adaptive: 'Resolução adaptável', showFps: 'Mostrar taxa de quadros',
    cats: { background: 'Cenário do porto', detail: 'Detalhe das peças', shadows: 'Sombras', bloom: 'Brilho (bloom)', grade: 'Correção de cor e vinheta', particles: 'Partículas' },
    tiers: { off: 'Desligado', on: 'Ligado', 'static': 'Parado', animated: 'Animado', plain: 'Plano', detailed: 'Detalhado', low: 'Baixo', high: 'Alto' },
    sum: {
      background: { off: 'sem cenário', 'static': 'porto parado', animated: 'porto animado' },
      detail: { plain: 'peças planas', detailed: 'peças detalhadas' },
      shadows: { low: 'sombras', high: 'sombras suaves' }, bloom: { on: 'brilho' }, grade: { on: 'correção de cor' },
      particles: { low: 'poucas partículas', high: 'partículas' }
    },
    unknownGpu: 'Nenhuma GPU de hardware detectada',
    failed: 'Os efeitos de cena não estão disponíveis neste dispositivo; o jogo é desenhado sem eles.',
    reduced: 'Movimento reduzido ativado: o cenário fica parado e as partículas ficam desligadas.',
    saved: 'As mudanças valem na hora e ficam salvas neste dispositivo.'
  },
  'it-IT': {
    settings: 'Impostazioni', graphics: 'Grafica', close: 'Chiudi', quality: 'Qualità',
    auto: 'Automatica (rilevata: {tier})', fromPreset: 'Da preimpostazione ({tier})',
    presets: { low: 'Bassa', balanced: 'Bilanciata', high: 'Alta', ultra: 'Ultra' },
    renderScale: 'Scala di rendering', adaptive: 'Risoluzione adattiva', showFps: 'Mostra frame rate',
    cats: { background: 'Sfondo del porto', detail: 'Dettaglio tessere', shadows: 'Ombre', bloom: 'Bagliore (bloom)', grade: 'Correzione colore e vignettatura', particles: 'Particelle' },
    tiers: { off: 'Disattivato', on: 'Attivato', 'static': 'Fermo', animated: 'Animato', plain: 'Piatto', detailed: 'Dettagliato', low: 'Basso', high: 'Alto' },
    sum: {
      background: { off: 'nessuno sfondo', 'static': 'porto fermo', animated: 'porto animato' },
      detail: { plain: 'tessere piatte', detailed: 'tessere dettagliate' },
      shadows: { low: 'ombre', high: 'ombre morbide' }, bloom: { on: 'bagliore' }, grade: { on: 'correzione colore' },
      particles: { low: 'poche particelle', high: 'particelle' }
    },
    unknownGpu: 'Nessuna GPU hardware rilevata',
    failed: 'Gli effetti di scena non sono disponibili su questo dispositivo; il gioco viene disegnato senza.',
    reduced: 'Movimento ridotto attivo: lo sfondo resta fermo e le particelle sono disattivate.',
    saved: 'Le modifiche si applicano subito e vengono salvate su questo dispositivo.'
  }
};

// StarHermit account UI (sign-in, invite link, toasts) — used by main.js via HSSettings.t().
var SH_STRINGS = {
  'en-US': { signIn: 'Sign in with StarHermit', invite: 'Invite a friend', copied: 'Invite link copied to clipboard.', copyFailed: 'Could not copy the invite link: {link}', signedOut: 'Signed out of StarHermit. Progress keeps saving on this device.' },
  'en-GB': { signIn: 'Sign in with StarHermit', invite: 'Invite a friend', copied: 'Invite link copied to clipboard.', copyFailed: 'Could not copy the invite link: {link}', signedOut: 'Signed out of StarHermit. Progress keeps saving on this device.' },
  'es-419': { signIn: 'Iniciar sesión con StarHermit', invite: 'Invitar a un amigo', copied: 'Enlace de invitación copiado al portapapeles.', copyFailed: 'No se pudo copiar el enlace de invitación: {link}', signedOut: 'Sesión de StarHermit cerrada. El progreso se sigue guardando en este dispositivo.' },
  'es-ES': { signIn: 'Iniciar sesión con StarHermit', invite: 'Invitar a un amigo', copied: 'Enlace de invitación copiado al portapapeles.', copyFailed: 'No se ha podido copiar el enlace de invitación: {link}', signedOut: 'Se ha cerrado la sesión de StarHermit. El progreso se sigue guardando en este dispositivo.' },
  'de-DE': { signIn: 'Mit StarHermit anmelden', invite: 'Freund einladen', copied: 'Einladungslink in die Zwischenablage kopiert.', copyFailed: 'Einladungslink konnte nicht kopiert werden: {link}', signedOut: 'Von StarHermit abgemeldet. Der Fortschritt wird weiter auf diesem Gerät gespeichert.' },
  'fr-FR': { signIn: 'Se connecter avec StarHermit', invite: 'Inviter un ami', copied: 'Lien d’invitation copié dans le presse-papiers.', copyFailed: 'Impossible de copier le lien d’invitation : {link}', signedOut: 'Déconnecté de StarHermit. La progression reste enregistrée sur cet appareil.' },
  'fr-CA': { signIn: 'Se connecter avec StarHermit', invite: 'Inviter un ami', copied: 'Lien d’invitation copié dans le presse-papiers.', copyFailed: 'Impossible de copier le lien d’invitation : {link}', signedOut: 'Déconnecté de StarHermit. La progression reste enregistrée sur cet appareil.' },
  'pt-BR': { signIn: 'Entrar com StarHermit', invite: 'Convidar um amigo', copied: 'Link de convite copiado para a área de transferência.', copyFailed: 'Não foi possível copiar o link de convite: {link}', signedOut: 'Você saiu do StarHermit. O progresso continua salvo neste dispositivo.' },
  'it-IT': { signIn: 'Accedi con StarHermit', invite: 'Invita un amico', copied: 'Link di invito copiato negli appunti.', copyFailed: 'Impossibile copiare il link di invito: {link}', signedOut: 'Disconnesso da StarHermit. I progressi restano salvati su questo dispositivo.' }
};

function pickLocale() {
  var wanted = [];
  try {
    var p = new URLSearchParams(window.location.search).get('lang');
    if (p) wanted.push(p);
  } catch (e) { /* ignore */ }
  wanted = wanted.concat(navigator.languages || [navigator.language || 'en-US']);
  for (var i = 0; i < wanted.length; i++) {
    var tag = String(wanted[i] || '');
    var lower = tag.toLowerCase();
    var exact = Object.keys(STRINGS).filter(function (k) { return k.toLowerCase() === lower; })[0];
    if (exact) return exact;
    var lang = lower.split('-')[0];
    if (lang === 'en') return /^en-(gb|au|nz|ie|za|in)/.test(lower) ? 'en-GB' : 'en-US';
    if (lang === 'es') return lower === 'es' ? 'es-ES' : 'es-419';
    if (lang === 'fr') return /^fr-ca/.test(lower) ? 'fr-CA' : 'fr-FR';
    if (lang === 'de') return 'de-DE';
    if (lang === 'pt') return 'pt-BR';
    if (lang === 'it') return 'it-IT';
  }
  return 'en-US';
}

var LOCALE = pickLocale();
var T = STRINGS[LOCALE];
var Gfx = window.HSGfx;
var Model = Gfx.model;
var root = null, opener = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
function fmt(s, tier) { return s.replace('{tier}', tier); }

function build() {
  var info = Gfx.info();
  var s = Gfx.settings();
  var r = info.resolved;
  var presetSel = Model.PRESETS.indexOf(s.preset) >= 0 ? s.preset : 'auto';
  var html = '<div class="hs-settings" role="dialog" aria-modal="true" aria-labelledby="hs-settings-title">' +
    '<div class="hs-settings-head"><h2 id="hs-settings-title">' + esc(T.settings) + '</h2>' +
    '<button id="btn-settings-close" class="hs-btn secondary" type="button">' + esc(T.close) + '</button></div>' +
    '<section class="hs-settings-section" aria-labelledby="hs-gfx-heading"><h3 id="hs-gfx-heading">' + esc(T.graphics) + '</h3>' +
    '<div class="hs-set-row"><label for="gfx-preset">' + esc(T.quality) + '</label>' +
    '<select id="gfx-preset" data-gfx="preset">' +
    '<option value="auto"' + (presetSel === 'auto' ? ' selected' : '') + '>' + esc(fmt(T.auto, T.presets[info.detected])) + '</option>' +
    Model.PRESETS.map(function (p) {
      return '<option value="' + p + '"' + (presetSel === p ? ' selected' : '') + '>' + esc(T.presets[p]) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="hs-set-row"><label for="gfx-scale">' + esc(T.renderScale) + '</label>' +
    '<div class="hs-range"><input id="gfx-scale" data-gfx="render_scale" type="range" min="50" max="200" step="5" value="' +
    r.renderScale + '"><output id="gfx-scale-value" for="gfx-scale">' + r.renderScale + '%</output></div></div>';
  Object.keys(Model.CATEGORIES).forEach(function (cat) {
    var cur = Model.CATEGORIES[cat].indexOf(s[cat]) >= 0 ? s[cat] : 'preset';
    html += '<div class="hs-set-row"><label for="gfx-' + cat + '">' + esc(T.cats[cat]) + '</label>' +
      '<select id="gfx-' + cat + '" data-gfx-cat="' + cat + '">' +
      '<option value="preset"' + (cur === 'preset' ? ' selected' : '') + '>' +
      esc(fmt(T.fromPreset, T.tiers[Model.presetTier(r.preset, cat)])) + '</option>' +
      Model.CATEGORIES[cat].map(function (tier) {
        return '<option value="' + tier + '"' + (cur === tier ? ' selected' : '') + '>' + esc(T.tiers[tier]) + '</option>';
      }).join('') + '</select></div>';
  });
  html += '<div class="hs-set-row hs-set-check"><label for="gfx-adaptive">' + esc(T.adaptive) + '</label>' +
    '<input id="gfx-adaptive" data-gfx="adaptive" type="checkbox"' + (r.adaptive ? ' checked' : '') + '></div>' +
    '<div class="hs-set-row hs-set-check"><label for="gfx-fps">' + esc(T.showFps) + '</label>' +
    '<input id="gfx-fps" data-gfx="show_fps" type="checkbox"' + (r.showFps ? ' checked' : '') + '></div>' +
    '<p id="gfx-summary" class="hs-gfx-summary" aria-live="polite">' + esc(summary(info)) + '</p>' +
    (info.failed ? '<p id="gfx-note" class="hs-gfx-note">' + esc(T.failed) + '</p>' : '') +
    (info.reduced && !info.failed ? '<p class="hs-gfx-note">' + esc(T.reduced) + '</p>' : '') +
    '<p class="hs-gfx-hint">' + esc(T.saved) + '</p></section></div>';
  return html;
}

function summary(info) {
  return (info.gpu || T.unknownGpu) + ' · ' + Model.describe(info.resolved, info.pixels, T.sum);
}

function render(focusId) {
  if (!root) return;
  root.innerHTML = build();
  wire();
  var el = focusId && document.getElementById(focusId);
  if (el) el.focus();
}

function wire() {
  document.getElementById('btn-settings-close').addEventListener('click', close);
  var preset = document.getElementById('gfx-preset');
  preset.addEventListener('change', function () {
    Gfx.set(Model.choosePreset(Gfx.settings(), preset.value));
    render('gfx-preset');
  });
  var scale = document.getElementById('gfx-scale');
  var out = document.getElementById('gfx-scale-value');
  scale.addEventListener('input', function () { out.textContent = scale.value + '%'; });
  scale.addEventListener('change', function () {
    var s = Gfx.settings();
    s.render_scale = Model.clampScale(scale.value);
    Gfx.set(s);
    render('gfx-scale');
  });
  root.querySelectorAll('select[data-gfx-cat]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      Gfx.set(Model.setOverride(Gfx.settings(), sel.dataset.gfxCat, sel.value));
      render(sel.id);
    });
  });
  [['gfx-adaptive', 'adaptive'], ['gfx-fps', 'show_fps']].forEach(function (pair) {
    var box = document.getElementById(pair[0]);
    box.addEventListener('change', function () {
      var s = Gfx.settings();
      if (pair[1] === 'adaptive') { if (box.checked) delete s.adaptive; else s.adaptive = false; }
      else if (box.checked) s.show_fps = true; else delete s.show_fps;
      Gfx.set(s);
      render(pair[0]);
    });
  });
}

function focusables() {
  return Array.prototype.slice.call(root.querySelectorAll('button, select, input')).filter(function (el) { return !el.disabled; });
}

function open() {
  if (root) return;
  opener = document.activeElement && document.activeElement.id ? document.activeElement.id : 'btn-settings';
  root = document.createElement('div');
  root.className = 'hs-settings-backdrop';
  root.id = 'hs-settings-root';
  document.body.appendChild(root);
  root.addEventListener('click', function (e) { if (e.target === root) close(); });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      var list = focusables();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation(); // game shortcuts (D/H/R) never fire while the panel is open
  });
  render('gfx-preset');
}

function close() {
  if (!root) return;
  root.parentNode.removeChild(root);
  root = null;
  var back = document.getElementById(opener) || document.getElementById('btn-settings');
  if (back) back.focus();
}

// Live summary (fps / adaptive scale) while the panel is open.
Gfx.onChange(function () {
  if (!root) return;
  var el = document.getElementById('gfx-summary');
  if (el) el.textContent = summary(Gfx.info());
});

window.HSSettings = {
  open: open, close: close, isOpen: function () { return !!root; },
  label: function () { return T.settings; }, locale: LOCALE,
  t: function (key, vars) {
    var str = (SH_STRINGS[LOCALE] || SH_STRINGS['en-US'])[key] || key;
    Object.keys(vars || {}).forEach(function (k) { str = str.replace('{' + k + '}', vars[k]); });
    return str;
  }
};
})();
