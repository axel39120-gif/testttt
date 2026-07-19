/* =============================================================================
 * 09 — RACE WEEKEND HEADER (titre Manche X + pays/circuit + drapeau)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Quand le joueur arrive sur l'écran S-race (week-end de course), le header
 * doit afficher :
 *   ┌──────────────────────────────────────────────┐
 *   │ ‹  [🇬🇧]  Manche 6                            │
 *   │           Grande-Bretagne • Silverstone      │
 *   └──────────────────────────────────────────────┘
 *
 * - Titre (hdr-title)   : « Manche X » où X = G.races.length + 1
 * - Sous-titre (hdr-sub) : « Pays • Circuit »
 * - À gauche            : drapeau SVG du pays (via flagSvg)
 *
 * IMPLÉMENTATION
 * --------------
 * 1) Mapping circuit → {country (FR human), code (ISO 2 lettres)} construit
 *    à partir des listes de circuits de toutes les catégories du jeu.
 * 2) Injection d'un container drapeau dans le `.hdr` de S-race au boot.
 * 3) Observer sur navTo()/showScreen() pour rafraîchir quand on entre dans
 *    S-race ; observer aussi sur les tabs (rtab) qui changent l'écran.
 * 4) Wrap de showResult() pour cohérence quand race-title est mis à jour
 *    après la course.
 *
 * CHARGEMENT : APRÈS 08-radio-commentary.js
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ========================================================================
  // MAPPING CIRCUIT → PAYS
  // ========================================================================
  // Format : nom_circuit_normalisé → { country: "Nom FR", code: "XX" }
  // La clé est le nom du circuit en minuscules sans accents/espaces, pour
  // matcher facilement les variantes ("GP Monaco Kart" → "monaco kart").
  //
  // Codes ISO 2 lettres compatibles avec flagSvg().
  // ========================================================================
  var CIRCUIT_TO_COUNTRY = {
    // ─── Karting Junior (régions françaises) ────────────────────────────────
    'gp lorraine':       { country: 'France',        code: 'FR' },
    'gp alsace':         { country: 'France',        code: 'FR' },
    'gp normandie':      { country: 'France',        code: 'FR' },
    'gp bretagne':       { country: 'France',        code: 'FR' },
    'gp bourgogne':      { country: 'France',        code: 'FR' },
    'gp auvergne':       { country: 'France',        code: 'FR' },
    'gp picardie':       { country: 'France',        code: 'FR' },
    'gp provence':       { country: 'France',        code: 'FR' },
    'gp languedoc':      { country: 'France',        code: 'FR' },
    'gp cote azur':      { country: 'France',        code: 'FR' },

    // ─── Karting Senior ─────────────────────────────────────────────────────
    'gp monaco kart':       { country: 'Monaco',       code: 'MC' },
    'gp lyon':              { country: 'France',       code: 'FR' },
    'gp valencia':          { country: 'Espagne',      code: 'ES' },
    'gp spa kart':          { country: 'Belgique',     code: 'BE' },
    'gp monza kart':        { country: 'Italie',       code: 'IT' },
    'gp portimao':          { country: 'Portugal',     code: 'PT' },
    'gp zandvoort kart':    { country: 'Pays-Bas',     code: 'NL' },
    'gp abu dhabi kart':    { country: 'Émirats AU',   code: 'AE' },
    'gp bahrain kart':      { country: 'Bahreïn',      code: 'BH' },
    'gp silverstone kart':  { country: 'Royaume-Uni',  code: 'GB' },

    // ─── Circuits internationaux (F4 → F1, SF, WEC, IndyCar) ────────────────
    // Italie
    'monza':            { country: 'Italie',         code: 'IT' },
    'misano':           { country: 'Italie',         code: 'IT' },
    'mugello':          { country: 'Italie',         code: 'IT' },
    'imola':            { country: 'Italie',         code: 'IT' },
    'vallelunga':       { country: 'Italie',         code: 'IT' },
    'monza 6h':         { country: 'Italie',         code: 'IT' },
    // Autriche
    'red bull ring':    { country: 'Autriche',       code: 'AT' },
    'spielberg':        { country: 'Autriche',       code: 'AT' },
    // Hongrie
    'hungaroring':      { country: 'Hongrie',        code: 'HU' },
    'budapest':         { country: 'Hongrie',        code: 'HU' },
    // Belgique
    'spa':              { country: 'Belgique',       code: 'BE' },
    'spa 6h':           { country: 'Belgique',       code: 'BE' },
    // France
    'paul ricard':      { country: 'France',         code: 'FR' },
    'castellet':        { country: 'France',         code: 'FR' },
    'magny-cours':      { country: 'France',         code: 'FR' },
    'magny cours':      { country: 'France',         code: 'FR' },
    'le mans':          { country: 'France',         code: 'FR' },
    '24h le mans':      { country: 'France',         code: 'FR' },
    // Pays-Bas
    'zandvoort':        { country: 'Pays-Bas',       code: 'NL' },
    // Espagne
    'barcelona':        { country: 'Espagne',        code: 'ES' },
    'barcelone':        { country: 'Espagne',        code: 'ES' },
    'catalunya':        { country: 'Espagne',        code: 'ES' },
    // Portugal
    'portimao':         { country: 'Portugal',       code: 'PT' },
    'portimao 6h':      { country: 'Portugal',       code: 'PT' },
    'algarve':          { country: 'Portugal',       code: 'PT' },
    // Royaume-Uni
    'silverstone':      { country: 'Royaume-Uni',    code: 'GB' },
    'brands hatch':     { country: 'Royaume-Uni',    code: 'GB' },
    // Monaco
    'monaco':           { country: 'Monaco',         code: 'MC' },
    // Bahreïn
    'bahrain':          { country: 'Bahreïn',        code: 'BH' },
    'bahrain 8h':       { country: 'Bahreïn',        code: 'BH' },
    'bahrain final':    { country: 'Bahreïn',        code: 'BH' },
    'sakhir':           { country: 'Bahreïn',        code: 'BH' },
    // Arabie Saoudite
    'jeddah':           { country: 'Arabie S.',      code: 'SA' },
    // États-Unis
    'miami':            { country: 'États-Unis',     code: 'US' },
    'austin':           { country: 'États-Unis',     code: 'US' },
    'las vegas':        { country: 'États-Unis',     code: 'US' },
    'vegas':            { country: 'États-Unis',     code: 'US' },
    'cota':             { country: 'États-Unis',     code: 'US' },
    'sebring':          { country: 'États-Unis',     code: 'US' },
    'sebring 12h':      { country: 'États-Unis',     code: 'US' },
    'daytona':          { country: 'États-Unis',     code: 'US' },
    'watkins glen':     { country: 'États-Unis',     code: 'US' },
    'laguna seca':      { country: 'États-Unis',     code: 'US' },
    'road america':     { country: 'États-Unis',     code: 'US' },
    'long beach':       { country: 'États-Unis',     code: 'US' },
    'iowa':             { country: 'États-Unis',     code: 'US' },
    'nashville':        { country: 'États-Unis',     code: 'US' },
    'portland':         { country: 'États-Unis',     code: 'US' },
    'gateway':          { country: 'États-Unis',     code: 'US' },
    'monterey':         { country: 'États-Unis',     code: 'US' },
    'detroit':          { country: 'États-Unis',     code: 'US' },
    'mid-ohio':         { country: 'États-Unis',     code: 'US' },
    'mid ohio':         { country: 'États-Unis',     code: 'US' },
    'indianapolis':     { country: 'États-Unis',     code: 'US' },
    'indianapolis 500': { country: 'États-Unis',     code: 'US' },
    'indy 500':         { country: 'États-Unis',     code: 'US' },
    'st petersburg':    { country: 'États-Unis',     code: 'US' },
    'st. petersburg':   { country: 'États-Unis',     code: 'US' },
    'texas':            { country: 'États-Unis',     code: 'US' },
    'phoenix':          { country: 'États-Unis',     code: 'US' },
    'sonoma':           { country: 'États-Unis',     code: 'US' },
    'belle isle':       { country: 'États-Unis',     code: 'US' },
    'belle-isle':       { country: 'États-Unis',     code: 'US' },
    // Mexique
    'mexico':           { country: 'Mexique',        code: 'MX' },
    'mexico city':      { country: 'Mexique',        code: 'MX' },
    'hermanos rodriguez': { country: 'Mexique',      code: 'MX' },
    // Brésil
    'sao paulo':        { country: 'Brésil',         code: 'BR' },
    'interlagos':       { country: 'Brésil',         code: 'BR' },
    'são paulo':        { country: 'Brésil',         code: 'BR' },
    // Émirats
    'abu dhabi':        { country: 'Émirats AU',     code: 'AE' },
    'yas marina':       { country: 'Émirats AU',     code: 'AE' },
    // Singapour
    'singapore':        { country: 'Singapour',      code: 'SG' },
    'singapour':        { country: 'Singapour',      code: 'SG' },
    // Japon
    'suzuka':           { country: 'Japon',          code: 'JP' },
    'suzuka final':     { country: 'Japon',          code: 'JP' },
    'fuji speedway':    { country: 'Japon',          code: 'JP' },
    'fuji round 2':     { country: 'Japon',          code: 'JP' },
    'fuji 6h':          { country: 'Japon',          code: 'JP' },
    'fuji':             { country: 'Japon',          code: 'JP' },
    'okayama':          { country: 'Japon',          code: 'JP' },
    'okayama round 2':  { country: 'Japon',          code: 'JP' },
    'autopolis':        { country: 'Japon',          code: 'JP' },
    'sugo':             { country: 'Japon',          code: 'JP' },
    'motegi':           { country: 'Japon',          code: 'JP' },
    'sapporo':          { country: 'Japon',          code: 'JP' },
    // Australie
    'melbourne':        { country: 'Australie',      code: 'AU' },
    'albert park':      { country: 'Australie',      code: 'AU' },
    // Azerbaïdjan
    'baku':             { country: 'Azerbaïdjan',    code: 'AZ' },
    // Macao
    'macao gp':         { country: 'Macao',          code: 'MO' },
    'macao':            { country: 'Macao',          code: 'MO' },
    // Qatar
    'lusail':           { country: 'Qatar',          code: 'QA' },
    'qatar':            { country: 'Qatar',          code: 'QA' },
    // Canada (au cas où)
    'montreal':         { country: 'Canada',         code: 'CA' },
    'toronto':          { country: 'Canada',         code: 'CA' },
    'mosport':          { country: 'Canada',         code: 'CA' },
    // Chine
    'shanghai':         { country: 'Chine',          code: 'CN' },
    // Russie
    'sochi':            { country: 'Russie',         code: 'RU' },
    // Vietnam
    'hanoi':            { country: 'Vietnam',        code: 'VN' },
    // Malaisie
    'sepang':           { country: 'Malaisie',       code: 'MY' },
    // Allemagne
    'hockenheim':       { country: 'Allemagne',      code: 'DE' },
    'nurburgring':      { country: 'Allemagne',      code: 'DE' }
  };

  function _normalize(name) {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o').replace(/[ûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[''`]/g, '')
      .trim();
  }

  function _resolveCircuit(rawName) {
    if (!rawName) return { country: '', code: '' };
    var norm = _normalize(rawName);
    // Match exact
    if (CIRCUIT_TO_COUNTRY[norm]) return CIRCUIT_TO_COUNTRY[norm];
    // Match partiel (le nom du circuit contient une clé connue)
    for (var key in CIRCUIT_TO_COUNTRY) {
      if (!CIRCUIT_TO_COUNTRY.hasOwnProperty(key)) continue;
      if (norm.indexOf(key) >= 0 || key.indexOf(norm) >= 0) {
        return CIRCUIT_TO_COUNTRY[key];
      }
    }
    return { country: '', code: '' };
  }

  // ========================================================================
  // CSS — drapeau à gauche dans le .hdr de S-race
  // ========================================================================
  function injectCSS() {
    if (document.getElementById('rj-race-header-css')) return;
    var style = document.createElement('style');
    style.id = 'rj-race-header-css';
    style.textContent = [
      '#rj-race-flag-wrap{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:46px;height:32px;margin-right:12px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.16);background:var(--surface2);box-shadow:0 2px 8px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.04);position:relative;z-index:1}',
      '#rj-race-flag-wrap svg{width:100%;height:100%;display:block}',
      '#S-race > .hdr{display:flex;align-items:center;position:relative;padding:12px 16px;background:linear-gradient(135deg,#17171d 0%,#0e0e12 58%,#0a0a0d 100%);border-bottom:2px solid var(--red,#FF1801);box-shadow:0 2px 14px rgba(0,0,0,.5)}',
      '#S-race > .hdr::before{content:"";position:absolute;left:0;top:0;bottom:0;width:140px;background:radial-gradient(ellipse at left center,rgba(255,24,1,.13),transparent 72%);pointer-events:none}',
      '#S-race > .hdr > div:not(.hdr-back):not(#rj-race-flag-wrap){display:flex;flex-direction:column;justify-content:center;align-items:flex-start;flex:1;min-width:0}',
      '#S-race > .hdr .hdr-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#S-race > .hdr > div:not(.hdr-back){position:relative;z-index:1}',
      '#S-race > .hdr #race-title{font-family:var(--font-display,Rubik,sans-serif)!important;font-size:19px!important;font-weight:900!important;letter-spacing:.005em!important;text-transform:uppercase!important;line-height:1.05!important;color:#fff!important}',
      '#S-race > .hdr #race-sub{font-family:var(--font-display,Rubik,sans-serif)!important;font-size:10.5px!important;font-weight:700!important;color:var(--soft,#a8a8b4)!important;letter-spacing:.13em!important;text-transform:uppercase!important;margin-top:3px!important}',
      '#race-hdr-flag{display:none!important}',
      '#S-race > .hdr .hdr-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    ].join('');
    document.head.appendChild(style);
  }

  // ========================================================================
  // STRUCTURE DOM — drapeau injecté dans le .hdr
  // ========================================================================
  function _ensureFlagContainer() {
    var screen = document.getElementById('S-race');
    if (!screen) return null;

    var hdr = screen.querySelector('.hdr');
    if (!hdr) return null;

    var existing = document.getElementById('rj-race-flag-wrap');
    if (existing) return existing;

    // Récupérer le bloc qui contient race-title + race-sub
    var titleContainer = null;
    var children = hdr.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.tagName === 'DIV' && child.querySelector('#race-title')) {
        titleContainer = child;
        break;
      }
    }
    if (!titleContainer) return null;

    // Créer le wrapper drapeau
    var flagWrap = document.createElement('div');
    flagWrap.id = 'rj-race-flag-wrap';
    flagWrap.innerHTML = '';

    // Insérer juste avant titleContainer (donc à gauche du bloc texte)
    titleContainer.parentNode.insertBefore(flagWrap, titleContainer);
    return flagWrap;
  }

  // ========================================================================
  // MISE À JOUR DU HEADER
  // ========================================================================
  function updateRaceHeader() {
    try {
      if (typeof G === 'undefined' || !G) return;

      var titleEl = document.getElementById('race-title');
      var subEl = document.getElementById('race-sub');
      if (!titleEl || !subEl) return;

      // Numéro de manche = nombre de courses faites + 1
      var manche = (G.races && G.races.length ? G.races.length : 0) + 1;

      // Récupérer le nom du circuit en cours :
      //   1. priorité à RACE_STATE.circuit (mis à jour quand on entre dans la course)
      //   2. sinon getNextRace().name
      //   3. sinon CAL_RACES[races.length].name
      var circuitName = '';
      if (typeof RACE_STATE !== 'undefined' && RACE_STATE && RACE_STATE.circuit) {
        circuitName = RACE_STATE.circuit;
      }
      if (!circuitName && typeof getNextRace === 'function') {
        try {
          var nr = getNextRace();
          if (nr && nr.name) circuitName = nr.name;
        } catch (e) {}
      }
      if (!circuitName && typeof CAL_RACES !== 'undefined' && CAL_RACES && CAL_RACES.length) {
        var idx = Math.min(G.races ? G.races.length : 0, CAL_RACES.length - 1);
        var entry = CAL_RACES[idx];
        if (entry && !entry.done) circuitName = entry.name;
        else {
          // Chercher la première non-done
          for (var j = 0; j < CAL_RACES.length; j++) {
            if (!CAL_RACES[j].done) { circuitName = CAL_RACES[j].name; break; }
          }
        }
      }

      // Titre
      titleEl.textContent = 'Manche ' + manche;

      // Sous-titre : pays • circuit
      if (circuitName) {
        var info = _resolveCircuit(circuitName);
        if (info.country) {
          subEl.textContent = info.country + ' • ' + circuitName;
        } else {
          // Pas de mapping → on affiche juste le circuit
          subEl.textContent = circuitName;
        }

        // Drapeau
        _ensureFlagContainer();
        var flagWrap = document.getElementById('rj-race-flag-wrap');
        if (flagWrap) {
          if (info.code && typeof flagSvg === 'function') {
            try {
              flagWrap.innerHTML = flagSvg(info.code, 36);
              flagWrap.style.display = '';
            } catch (e) {
              flagWrap.style.display = 'none';
            }
          } else {
            // Pas de pays connu : on masque le drapeau pour ne pas afficher un placeholder vide
            flagWrap.style.display = 'none';
            flagWrap.innerHTML = '';
          }
        }
      } else {
        // Pas de course en cours → garder le sous-titre catégorie par fallback
        if (G.cat) subEl.textContent = G.cat;
        var fw = document.getElementById('rj-race-flag-wrap');
        if (fw) { fw.style.display = 'none'; fw.innerHTML = ''; }
      }
    } catch (err) {
      console.warn('[09-race-header] updateRaceHeader:', err);
    }
  }

  // ========================================================================
  // HOOKS — détecter l'entrée dans S-race
  // ========================================================================

  // 1) navTo() — fonction de navigation principale
  function wrapNavTo() {
    if (typeof window.navTo !== 'function') return false;
    if (window._rjNavToRaceHeaderPatched) return true;
    window._rjNavToRaceHeaderPatched = true;

    var orig = window.navTo;
    window.navTo = function rjNavToWithRaceHeader(screenId) {
      var ret = orig.apply(this, arguments);
      try {
        if (screenId === 'S-race') {
          // Petit délai pour laisser le DOM se rendre
          setTimeout(updateRaceHeader, 30);
        }
      } catch (e) {}
      return ret;
    };
    return true;
  }

  // 2) navMore() — autre fonction de navigation
  function wrapNavMore() {
    if (typeof window.navMore !== 'function') return true; // optionnel
    if (window._rjNavMoreRaceHeaderPatched) return true;
    window._rjNavMoreRaceHeaderPatched = true;

    var orig = window.navMore;
    window.navMore = function rjNavMoreWithRaceHeader(screenId) {
      var ret = orig.apply(this, arguments);
      try {
        if (screenId === 'S-race') {
          setTimeout(updateRaceHeader, 30);
        }
      } catch (e) {}
      return ret;
    };
    return true;
  }

  // 3) showResult() — pour cohérence après course (race-title est setté ici)
  function wrapShowResult() {
    if (typeof window.showResult !== 'function') return false;
    if (window._rjShowResultHeaderPatched) return true;
    window._rjShowResultHeaderPatched = true;

    var orig = window.showResult;
    window.showResult = function rjShowResultWithHeader() {
      var ret = orig.apply(this, arguments);
      try {
        setTimeout(updateRaceHeader, 50);
      } catch (e) {}
      return ret;
    };
    return true;
  }

  // 4) Observer le changement d'écran via mutation
  // Au cas où d'autres chemins de navigation existent, on observe
  // l'attribut style/class de S-race pour rafraîchir quand il devient visible.
  function setupVisibilityObserver() {
    var screen = document.getElementById('S-race');
    if (!screen) return false;
    if (window._rjRaceVisibilityObs) return true;

    try {
      var obs = new MutationObserver(function(mutations) {
        var visible = screen.classList.contains('on') ||
          (screen.style && screen.style.display !== 'none' && screen.offsetParent !== null);
        if (visible) updateRaceHeader();
      });
      obs.observe(screen, { attributes: true, attributeFilter: ['class', 'style'] });
      window._rjRaceVisibilityObs = obs;
    } catch (e) {
      console.warn('[09-race-header] observer:', e);
    }
    return true;
  }

  // ========================================================================
  // BOOTSTRAP
  // ========================================================================
  function bootstrap() {
    injectCSS();
    var allOk =
      wrapNavTo() &
      wrapNavMore() &
      wrapShowResult();
    setupVisibilityObserver();

    if (!allOk) {
      setTimeout(bootstrap, 80);
    } else {
      // Si on est déjà sur S-race au démarrage, rafraîchir
      var screen = document.getElementById('S-race');
      if (screen && (screen.classList.contains('on') ||
          (screen.style.display !== 'none' && screen.offsetParent !== null))) {
        setTimeout(updateRaceHeader, 60);
      }
      console.log('[09-race-header] active — header weekend course (Manche X + pays • circuit + drapeau)');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
