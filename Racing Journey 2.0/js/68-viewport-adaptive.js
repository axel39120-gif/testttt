/* =====================================================================
 * 68-viewport-adaptive.js — ADAPTATION D'ÉCRAN UNIFIÉE (source unique)
 *
 * CONTEXTE D'ARCHITECTURE
 * -----------------------
 * Racing Journey n'est pas une mise en page fluide : c'est un CANEVAS À
 * TAILLE FIXE. #app est piloté par --app-width / --app-height (430 × 932
 * par défaut) et l'ensemble des tailles en px du jeu est cohérent À
 * L'INTÉRIEUR de ce canevas. Rendre le jeu « responsive » ne consiste
 * donc PAS à supprimer les px (il y en a ~10 900, dont 80 % générés par
 * les fichiers cœur en innerHTML), mais à faire correspondre le canevas
 * à l'écran réel, en continu et sur tout appareil.
 *
 * CE QUI N'ALLAIT PAS (mesuré sur la source déployée)
 * --------------------------------------------------
 *  1. 60-auto-screen-fit ne dimensionne qu'à la PREMIÈRE installation, ou
 *     sur appui manuel. Les joueurs installés avant ce module n'ont jamais
 *     SETTINGS.appAutoSize défini → aucune réaction à la rotation, au
 *     redimensionnement, ni au passage navigateur → PWA installée.
 *  2. Le calcul ignorait les marges de sécurité : la zone était calée sur
 *     la hauteur brute, donc le bas du contenu passait sous l'indicateur
 *     d'accueil.
 *  3. Aucune notion de tablette : la zone était traitée comme un téléphone.
 *  4. Trois modules concurrents mesuraient et compensaient les Safe Areas
 *     chacun de leur côté (41, 61, 67), dont un (67) corrigeant la double
 *     application provoquée par les autres.
 *
 * CE QUE FAIT CE MODULE
 * ---------------------
 *  A. SAFE AREAS — source unique. Sonde les quatre env(safe-area-inset-*),
 *     détecte le double comptage (fenêtre excluant déjà l'encoche : logique
 *     de 67 reprise telle quelle, elle était juste) et expose les valeurs
 *     EFFECTIVES en variables CSS : --sa-top / --sa-right / --sa-bottom /
 *     --sa-left, plus --safe-top / --safe-bot pour la compatibilité avec
 *     le CSS existant.
 *  B. PROFIL D'APPAREIL déduit des dimensions réelles, jamais du user-agent :
 *     data-rj-device = phone | tablet | desktop, data-rj-orient =
 *     portrait | landscape sur <html>. Utilisable en CSS sans toucher aux px.
 *  C. CANEVAS ADAPTATIF CONTINU : la zone de jeu est recalculée sur la
 *     surface RÉELLEMENT utilisable (viewport moins marges effectives), au
 *     pas des bornes du jeu, arrondie vers le bas pour ne jamais déborder.
 *  D. SUIVI CONTINU : visualViewport, resize, orientationchange,
 *     changement de display-mode (navigateur ↔ PWA installée), pageshow,
 *     ResizeObserver. Débounce 120 ms + passes de stabilisation iOS.
 *
 * COEXISTENCE AVEC LES MODULES EXISTANTS
 * --------------------------------------
 *  - 60 reste chargé et GARDE son panneau « Zone de jeu » des Paramètres.
 *    Ce module s'interpose en amont de applyAppSize() : en mode auto, il
 *    impose ses valeurs quel que soit l'appelant. Toucher un stepper ou un
 *    préréglage de 60 bascule automatiquement en mode manuel (l'auto est
 *    désactivé), et 60 reprend alors la main sans interférence.
 *  - 41 et 67 sont neutralisés au démarrage : 67 est remplacé (sa logique
 *    est intégrée ici), 41 compensait un SYMPTÔME (translateY négatif sur
 *    l'écran actif) dont ce module traite la cause. Le translateY résiduel
 *    est nettoyé.
 *  - 61 (tiroir « Plus ») est conservé : correctif ponctuel et mesuré.
 *
 * ÉTAT PERSISTANT : aucun nouveau. Le seul réglage utilisé est
 * SETTINGS.appAutoSize, déjà existant, simplement activé par défaut pour
 * les installations antérieures qui ne l'avaient jamais défini.
 *
 * Réversible : window._rj68Uninstall(). Diagnostic : window._rj68Status().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[68-viewport-adaptive]";
  var DEBOUNCE = 120;

  var etat = {
    actif: false,
    device: null,
    orient: null,
    viewport: null,
    insetsBruts: null,
    insetsEffectifs: null,
    hautNeutralise: false,
    basNeutralise: false,
    standalone: false,
    decision: null,
    zone: null,
    echelle: 1,
    auto: null,
    neutralises: []
  };
  window._rj68Status = function () { return etat; };

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  function px(v) {
    var n = parseFloat(String(v || "").replace("px", ""));
    return isFinite(n) ? n : 0;
  }

  function bornes() {
    if (typeof APP_SIZE_BOUNDS !== "undefined" && APP_SIZE_BOUNDS) return APP_SIZE_BOUNDS;
    return {
      width:  { min: 340, max: 600,  step: 10, default: 430 },
      height: { min: 700, max: 1200, step: 20, default: 932 }
    };
  }

  // Ramène dans les bornes, aligné sur le pas, arrondi vers le BAS pour ne
  // jamais dépasser l'écran.
  function caler(valeur, b) {
    var v = Math.floor(valeur / b.step) * b.step;
    if (v < b.min) v = b.min;
    if (v > b.max) v = b.max;
    return v;
  }

  function mesurerViewport() {
    var w = 0, h = 0;
    try {
      if (window.visualViewport && window.visualViewport.width) {
        w = window.visualViewport.width;
        h = window.visualViewport.height;
      }
    } catch (e) {}
    if (!w) w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (!h) h = window.innerHeight || document.documentElement.clientHeight || 0;
    return { w: Math.round(w), h: Math.round(h) };
  }

  /* ------------------------------------------------------------------ */
  /* A. Safe areas — source unique                                       */
  /* ------------------------------------------------------------------ */

  // Lecture des env() via une sonde dédiée : on ne peut pas lire --safe-top,
  // c'est justement la variable qu'on est en train de redéfinir.
  function sonderInsets() {
    var sonde = document.getElementById("rj68-sonde");
    if (!sonde) {
      sonde = document.createElement("div");
      sonde.id = "rj68-sonde";
      sonde.setAttribute("aria-hidden", "true");
      sonde.style.cssText =
        "position:fixed;left:-9999px;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
        "padding-top:env(safe-area-inset-top,0px);" +
        "padding-right:env(safe-area-inset-right,0px);" +
        "padding-bottom:env(safe-area-inset-bottom,0px);" +
        "padding-left:env(safe-area-inset-left,0px);";
      (document.body || document.documentElement).appendChild(sonde);
    }
    var cs = getComputedStyle(sonde);
    return {
      haut:   px(cs.paddingTop),
      droite: px(cs.paddingRight),
      bas:    px(cs.paddingBottom),
      gauche: px(cs.paddingLeft)
    };
  }

  function estStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (navigator && navigator.standalone) return true;
    } catch (e) {}
    return false;
  }

  function forcageHaut() {
    try {
      if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
      var v = SETTINGS.safeTopForce;
      return (typeof v === "number" && isFinite(v)) ? v : null;
    } catch (e) { return null; }
  }

  // Certaines configurations (PWA installée sur iOS) renvoient une fenêtre
  // qui EXCLUT DÉJÀ l'encoche, tout en continuant à renvoyer un inset non
  // nul. Appliquer l'inset une seconde fois crée un vide de la hauteur de
  // l'îlot dynamique — c'est le défaut que corrigeait le module 67.
  //
  // MAIS l'inverse est bien pire : neutraliser à tort fait passer l'en-tête
  // SOUS l'objectif. Deux verrous ont donc été ajoutés :
  //   - la neutralisation n'est envisagée QU'EN PWA INSTALLÉE. Dans un
  //     navigateur, la fenêtre est réduite par la barre d'adresse, ce qui
  //     satisfait la comparaison de hauteurs par accident et déclenchait
  //     un faux positif ;
  //   - un forçage manuel (SETTINGS.safeTopForce) court-circuite tout, pour
  //     le cas où un appareil rapporterait des mesures incohérentes.
  function insetsEffectifs(brut, vp) {
    var force = forcageHaut();
    if (force !== null) {
      etat.hautNeutralise = (force === 0);
      etat.decision = "forcé à " + force + "px";
      return { haut: force, droite: brut.droite, bas: brut.bas, gauche: brut.gauche };
    }

    var sh = 0;
    try { sh = (window.screen && window.screen.height) || 0; } catch (e) {}
    var vh = vp.h;
    var standalone = estStandalone();

    var hautDejaExclu = standalone && (sh > 0 && brut.haut > 0 && vh <= sh - brut.haut + 2);
    var basDejaExclu  = standalone && (sh > 0 && brut.bas  > 0 && vh <= sh - brut.haut - brut.bas + 2);

    etat.standalone = standalone;
    etat.hautNeutralise = hautDejaExclu;
    etat.basNeutralise  = basDejaExclu;
    etat.decision = !standalone
      ? "navigateur — marges conservées"
      : (hautDejaExclu ? "PWA — fenêtre excluant déjà l'encoche, marge haute neutralisée"
                       : "PWA — marge haute conservée");

    return {
      haut:   hautDejaExclu ? 0 : brut.haut,
      droite: brut.droite,          // paysage : l'encoche chevauche toujours
      bas:    basDejaExclu ? 0 : brut.bas,
      gauche: brut.gauche
    };
  }

  function publierInsets(eff) {
    var r = document.documentElement;
    if (!r) return;
    r.style.setProperty("--sa-top",    eff.haut + "px");
    r.style.setProperty("--sa-right",  eff.droite + "px");
    r.style.setProperty("--sa-bottom", eff.bas + "px");
    r.style.setProperty("--sa-left",   eff.gauche + "px");
    // Compatibilité avec le CSS existant (:root les définit en env()).
    r.style.setProperty("--safe-top", eff.haut + "px");
    r.style.setProperty("--safe-bot", eff.bas + "px");
  }

  /* ------------------------------------------------------------------ */
  /* B. Profil d'appareil — déduit des dimensions, pas du user-agent      */
  /* ------------------------------------------------------------------ */

  // Un écran 1440 × 900 a un petit côté de 900 : le seul critère de taille
  // le classait en tablette. On croise donc la taille avec la nature du
  // pointeur — un pointeur fin et survolable signe un ordinateur, jamais
  // un écran tactile. Toujours aucune lecture du user-agent.
  function pointeurPrecis() {
    try {
      return !!(window.matchMedia &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    } catch (e) { return false; }
  }

  function profil(vp) {
    var petitCote = Math.min(vp.w, vp.h);
    var device;
    if (pointeurPrecis()) {
      // Souris ou trackpad : ordinateur. Une fenêtre étroite reste traitée
      // comme un téléphone, c'est le cas des outils de développement.
      device = (petitCote >= 600) ? "desktop" : "phone";
    } else {
      // Tactile : c'est la taille qui tranche. Un iPad Pro 12,9" en portrait
      // fait 1024 de large — sans ce chemin il serait classé ordinateur.
      device = (petitCote >= 600) ? "tablet" : "phone";
    }
    return { device: device, orient: (vp.w > vp.h ? "landscape" : "portrait") };
  }

  function publierProfil(p, vp) {
    var r = document.documentElement;
    if (!r) return;
    if (r.getAttribute("data-rj-device") !== p.device) r.setAttribute("data-rj-device", p.device);
    if (r.getAttribute("data-rj-orient") !== p.orient) r.setAttribute("data-rj-orient", p.orient);
    r.style.setProperty("--rj-vw", vp.w + "px");
    r.style.setProperty("--rj-vh", vp.h + "px");
    etat.device = p.device;
    etat.orient = p.orient;
  }

  /* ------------------------------------------------------------------ */
  /* C. Calcul de la zone de jeu                                         */
  /* ------------------------------------------------------------------ */

  function calculerZone(vp, eff) {
    var b = bornes();
    // Surface réellement utilisable : on retire les marges effectives.
    var utileW = vp.w - eff.gauche - eff.droite;
    var utileH = vp.h - eff.haut - eff.bas;

    var w = caler(utileW, b.width);
    var h = caler(utileH, b.height);

    // Le plancher des bornes (340 × 700) dépasse la surface utile sur les
    // très petits écrans et en paysage téléphone (844 × 390). Dans ce cas
    // le plancher est un mensonge : on annonce la surface réelle, quitte à
    // passer sous la borne, plutôt qu'une zone plus grande que l'écran.
    if (w > utileW) w = Math.max(1, Math.floor(utileW));
    if (h > utileH) h = Math.max(1, Math.floor(utileH));

    return { w: w, h: h, utileW: utileW, utileH: utileH, sousBorne: (w < b.width.min || h < b.height.min) };
  }

  function modeAuto() {
    try {
      return !!(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appAutoSize);
    } catch (e) { return false; }
  }

  var origApplyAppSize = null;
  var enCours = false;

  // Application effective. En mode auto, les valeurs calculées écrasent
  // celles de SETTINGS avant que le moteur d'origine ne pose les variables.
  function appliquerZone(vp, eff) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    var z = calculerZone(vp, eff);
    etat.zone = z;
    if (!modeAuto()) return z;

    var changed = (SETTINGS.appWidth !== z.w || SETTINGS.appHeight !== z.h);
    SETTINGS.appWidth = z.w;
    SETTINGS.appHeight = z.h;

    if (changed) {
      try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    }
    return z;
  }

  /* ------------------------------------------------------------------ */
  /* Passe complète                                                      */
  /* ------------------------------------------------------------------ */

  function passe(raison) {
    if (enCours) return;
    enCours = true;
    try {
      if (!document.body) return;
      var vp = mesurerViewport();
      var brut = sonderInsets();
      var eff = insetsEffectifs(brut, vp);

      etat.viewport = vp;
      etat.insetsBruts = brut;
      etat.insetsEffectifs = eff;
      etat.auto = modeAuto();

      publierInsets(eff);
      publierProfil(profil(vp), vp);
      appliquerZone(vp, eff);
      appliquerEchelle(vp, eff);

      // Pose effective des variables --app-width / --app-height.
      try {
        if (typeof applyAppSize === "function") applyAppSize();
      } catch (e) {}

      // applyAppSize ramène de force dans les bornes (340 × 700 minimum).
      // Sur un écran plus petit que le plancher, on repose la valeur réelle
      // par-dessus, sinon la zone déborderait.
      try {
        if (etat.zone && etat.zone.sousBorne && modeAuto()) {
          var rr = document.documentElement;
          rr.style.setProperty("--app-width", etat.zone.w + "px");
          rr.style.setProperty("--app-height", etat.zone.h + "px");
        }
      } catch (e) {}

      // Rafraîchit le panneau des Paramètres de 60 s'il est à l'écran.
      try {
        if (raison !== "boot" && typeof renderDisplaySetup === "function" &&
            document.getElementById("display-setup-content")) renderDisplaySetup();
      } catch (e) {}
    } catch (e) {
      console.warn(TAG, e);
    } finally {
      enCours = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* C bis. Mise à l'échelle du canevas — DÉSACTIVÉE PAR DÉFAUT          */
  /*                                                                     */
  /* Découverte en test navigateur : styles.css contient un bloc          */
  /* « EMERGENCY FULL-SCREEN FIX », sans media query et tout en           */
  /* !important, qui force #app à width:100% / max-width:100vw /          */
  /* height:100dvh. Il écrase --app-width et --app-height. Autrement dit  */
  /* la zone de jeu est INERTE depuis ce correctif : le panneau de        */
  /* réglage de 60 (molettes, préréglages, « Ajuster à mon écran »)       */
  /* n'a aucun effet visible. Le jeu remplit l'écran, mais son contenu    */
  /* reste dessiné aux tailles en px d'un canevas de 430 de large.        */
  /*                                                                     */
  /* La mise à l'échelle est LA réponse à ce problème : un facteur zoom   */
  /* sur #app fait suivre proportionnellement les ~10 900 valeurs en px,  */
  /* sans en modifier une seule. Réduction sur les écrans plus étroits    */
  /* que la référence (Galaxy Fold fermé), agrandissement sur tablette.   */
  /*                                                                     */
  /* Elle change l'aspect du jeu partout : elle reste donc désactivée     */
  /* tant que tu ne l'as pas évaluée. Activation : _rj68Scale(true).      */
  /* ------------------------------------------------------------------ */

  var REF_W = 430;          // largeur du canevas de référence
  var SCALE_MIN = 0.80;
  var SCALE_MAX = 1.60;

  function echelleActive() {
    try { return !!(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appScaleCanvas); }
    catch (e) { return false; }
  }

  function appliquerEchelle(vp, eff) {
    var app = document.getElementById("app");
    var r = document.documentElement;
    if (!app || !r) return;

    if (!echelleActive()) {
      app.style.removeProperty("zoom");
      app.style.removeProperty("width");
      app.style.removeProperty("height");
      app.style.removeProperty("max-width");
      app.style.removeProperty("max-height");
      r.style.setProperty("--rj-scale", "1");
      etat.echelle = 1;
      return;
    }
    var utileW = vp.w - eff.gauche - eff.droite;
    var utileH = vp.h - eff.haut - eff.bas;
    var s = utileW / REF_W;
    if (s < SCALE_MIN) s = SCALE_MIN;
    if (s > SCALE_MAX) s = SCALE_MAX;
    s = Math.round(s * 100) / 100;

    // zoom plutôt que transform:scale : pas de décalage des position:fixed,
    // pas de désalignement du toucher.
    // En revanche zoom redimensionne AUSSI la boîte : à 1.6, un #app en
    // width:100% déborderait de 60 %, et à 0.8 il ne remplirait plus que
    // 80 % de l'écran. On lui donne donc ses dimensions AVANT zoom, en
    // priorité !important pour passer devant le bloc d'urgence de styles.css.
    app.style.setProperty("width", Math.round(utileW / s) + "px", "important");
    app.style.setProperty("height", Math.round(utileH / s) + "px", "important");
    app.style.setProperty("max-width", "none", "important");
    app.style.setProperty("max-height", "none", "important");
    app.style.zoom = s;

    r.style.setProperty("--rj-scale", String(s));
    etat.echelle = s;
  }

  window._rj68Scale = function (on) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    if (typeof on === "undefined") return echelleActive();
    SETTINGS.appScaleCanvas = !!on;
    try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    passe("echelle");
    console.log(TAG, "mise à l'échelle " + (on ? "activée (facteur " + etat.echelle + ")" : "désactivée"));
    return etat.echelle;
  };

  /* ------------------------------------------------------------------ */
  /* Correctifs de mise en page liés aux marges                          */
  /*                                                                     */
  /* La marge HAUTE est appliquée globalement par l'entretoise <div       */
  /* class="sb"> placée en tête de #app, dont la hauteur vaut             */
  /* var(--safe-top). Le mécanisme est bon : il suffit que --safe-top     */
  /* soit juste, ce dont ce module se charge.                            */
  /*                                                                     */
  /* Deux endroits le contredisaient :                                   */
  /*  - un correctif manuscrit dans styles.css rajoute la marge haute au  */
  /*    .hdr de quatre écrans nommés (lifestyle, achievements, settings,  */
  /*    save). Avec l'entretoise déjà en place, ces quatre écrans         */
  /*    comptaient la marge DEUX FOIS ;                                  */
  /*  - un <style> en ligne dans index.html fixe .screens à              */
  /*    padding-bottom:56px, valeur en dur qui ignore l'indicateur        */
  /*    d'accueil : sur les iPhone récents, le bas du contenu passait     */
  /*    sous la barre de navigation.                                     */
  /* ------------------------------------------------------------------ */
  function injecterCorrectifs() {
    if (document.getElementById("rj68-css")) return;
    var st = document.createElement("style");
    st.id = "rj68-css";
    st.textContent = [
      /* l'entretoise reste la seule source de la marge haute */
      "#S-lifestyle > .hdr, #S-achievements > .hdr, #S-settings > .hdr, #S-save > .hdr",
      "{padding-top:10px !important}",
      /* la barre basse est en position:fixed : on rend sa réserve réelle */
      ".screens{padding-bottom:calc(56px + var(--sa-bottom,0px)) !important}"
    ].join("");
    document.head.appendChild(st);
  }

  /* Diagnostic lisible, à lancer depuis la console de l'appareil. */
  window._rj68Marges = function () {
    var vp = etat.viewport || mesurerViewport();
    var b = etat.insetsBruts || {}, e = etat.insetsEffectifs || {};
    var sb = document.querySelector(".sb");
    var lignes = [
      "── marges de sécurité ──",
      "appareil ........ " + etat.device + " / " + etat.orient,
      "fenêtre ......... " + vp.w + " × " + vp.h,
      "écran physique .. " + ((window.screen && window.screen.height) || "?"),
      "PWA installée ... " + (etat.standalone ? "oui" : "non"),
      "env() brut ...... haut " + b.haut + " · bas " + b.bas + " · gauche " + b.gauche + " · droite " + b.droite,
      "appliqué ........ haut " + e.haut + " · bas " + e.bas,
      "décision ........ " + etat.decision,
      "entretoise .sb .. " + (sb ? Math.round(sb.getBoundingClientRect().height) + "px" : "absente"),
      "forçage ......... " + (forcageHaut() === null ? "aucun (auto)" : forcageHaut() + "px")
    ];
    console.log(lignes.join("\n"));
    return lignes.join("\n");
  };

  // _rj68ForcerHaut(59) impose la marge ; _rj68ForcerHaut(null) rend la main
  // à la détection automatique. La valeur est enregistrée avec les réglages.
  window._rj68ForcerHaut = function (px) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    if (px === null || typeof px === "undefined") delete SETTINGS.safeTopForce;
    else SETTINGS.safeTopForce = Math.max(0, Math.round(px));
    try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    passe("forçage");
    return window._rj68Marges();
  };

  var minuteur = null;
  function differer(raison) {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(function () { passe(raison || "resize"); }, DEBOUNCE);
  }

  /* ------------------------------------------------------------------ */
  /* Interception de applyAppSize : le mode auto est toujours prioritaire */
  /* ------------------------------------------------------------------ */

  function interceptApplyAppSize() {
    if (typeof window.applyAppSize !== "function" || window.applyAppSize._rj68) return false;
    origApplyAppSize = window.applyAppSize;
    var fn = function () {
      // Appel externe (60, molettes, boot du jeu) : en mode auto on
      // recalcule d'abord, pour que ce soit toujours la même valeur qui
      // gagne, quel que soit l'appelant.
      if (!enCours && modeAuto()) {
        try {
          var vp = mesurerViewport();
          var eff = insetsEffectifs(sonderInsets(), vp);
          var z = calculerZone(vp, eff);
          if (typeof SETTINGS !== "undefined" && SETTINGS) {
            SETTINGS.appWidth = z.w;
            SETTINGS.appHeight = z.h;
          }
          etat.zone = z;
        } catch (e) {}
      }
      return origApplyAppSize.apply(this, arguments);
    };
    fn._rj68 = true;
    window.applyAppSize = fn;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Bascule en manuel dès que le joueur touche un réglage de 60          */
  /* ------------------------------------------------------------------ */

  function surClicReglage(ev) {
    try {
      var el = ev.target;
      while (el && el !== document.body && !(el.getAttribute && el.getAttribute("data-act"))) {
        el = el.parentElement;
      }
      if (!el || !el.getAttribute) return;
      var bloc = el.closest ? el.closest("#rj60-bloc") : null;
      if (!bloc) return;
      var act = el.getAttribute("data-act") || "";
      var manuel = (act === "w-" || act === "w+" || act === "h-" || act === "h+" ||
                    act.indexOf("preset:") === 0);
      if (!manuel) return;
      if (typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appAutoSize) {
        SETTINGS.appAutoSize = false;
        try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
        console.log(TAG, "réglage manuel détecté — ajustement automatique désactivé");
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* Neutralisation des modules remplacés                                */
  /* ------------------------------------------------------------------ */

  function neutraliser() {
    // 67 : logique intégrée ici, source unique désormais.
    if (typeof window._rj67Uninstall === "function") {
      try { window._rj67Uninstall(); etat.neutralises.push("67-safearea-fix"); } catch (e) {}
    }
    // 41 : compensait un symptôme par translateY sur l'écran actif.
    if (typeof window._rjHeaderFixUninstall === "function") {
      try { window._rjHeaderFixUninstall(); etat.neutralises.push("41-header-safearea-fix"); } catch (e) {}
    }
    // Nettoyage de tout translateY résiduel laissé par 41.
    try {
      var restes = document.querySelectorAll(".scr[data-rj-hfix]");
      for (var i = 0; i < restes.length; i++) {
        restes[i].style.transform = "";
        restes[i].removeAttribute("data-rj-hfix");
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */

  var ecouteurs = [];
  function ecouter(cible, type, fn, opts) {
    if (!cible || !cible.addEventListener) return;
    cible.addEventListener(type, fn, opts);
    ecouteurs.push([cible, type, fn, opts]);
  }

  var ro = null, mqDisplay = null;
  function onResize() { differer("resize"); }
  function onOrient() { setTimeout(function () { differer("orientation"); }, 60); }

  var essais = 0;
  function boot() {
    var pret = (document.body &&
                typeof SETTINGS !== "undefined" && SETTINGS &&
                typeof applyAppSize === "function");
    if (!pret) {
      if (essais++ < 120) { setTimeout(boot, 80); return; }
      console.warn(TAG, "abandon : SETTINGS ou applyAppSize indisponibles");
      return;
    }

    // Migration douce : les installations antérieures à 60 n'ont jamais eu
    // appAutoSize défini. On active l'automatique pour elles, sans écraser
    // un choix explicite du joueur.
    if (typeof SETTINGS.appAutoSize === "undefined" || SETTINGS.appAutoSize === null) {
      SETTINGS.appAutoSize = true;
      try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
      console.log(TAG, "ajustement automatique activé (installation antérieure)");
    }

    neutraliser();
    injecterCorrectifs();
    interceptApplyAppSize();
    passe("boot");

    ecouter(window, "resize", onResize);
    ecouter(window, "orientationchange", onOrient);
    ecouter(window, "pageshow", onResize);
    try {
      if (window.visualViewport) {
        ecouter(window.visualViewport, "resize", onResize);
        ecouter(window.visualViewport, "scroll", onResize);
      }
    } catch (e) {}

    // Passage navigateur ↔ PWA installée : la fenêtre et les marges changent.
    try {
      if (window.matchMedia) {
        mqDisplay = window.matchMedia("(display-mode: standalone)");
        if (mqDisplay.addEventListener) mqDisplay.addEventListener("change", onResize);
        else if (mqDisplay.addListener) mqDisplay.addListener(onResize);
      }
    } catch (e) {}

    // Filet supplémentaire : certains WebView ne déclenchent pas resize.
    try {
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver(function () { differer("observer"); });
        ro.observe(document.documentElement);
      }
    } catch (e) {}

    ecouter(document, "click", surClicReglage, true);

    // iOS stabilise ses marges avec un temps de retard après l'ouverture.
    setTimeout(function () { passe("stabilisation-400"); }, 400);
    setTimeout(function () { passe("stabilisation-1200"); }, 1200);

    etat.actif = true;
    var vp = etat.viewport || mesurerViewport();
    var z = etat.zone || {};
    console.log(TAG + " actif — " + etat.device + "/" + etat.orient +
                " · écran " + vp.w + " × " + vp.h +
                " · zone " + (z.w || "?") + " × " + (z.h || "?") +
                " · marges " + JSON.stringify(etat.insetsEffectifs) +
                " · " + etat.decision +
                (etat.neutralises.length ? " · remplace " + etat.neutralises.join(", ") : ""));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ------------------------------------------------------------------ */
  /* Désinstallation                                                     */
  /* ------------------------------------------------------------------ */

  window._rj68Refit = function () { passe("manuel"); return etat.zone; };

  window._rj68Uninstall = function () {
    try {
      if (origApplyAppSize && window.applyAppSize && window.applyAppSize._rj68) {
        window.applyAppSize = origApplyAppSize;
      }
    } catch (e) {}
    for (var i = 0; i < ecouteurs.length; i++) {
      try { ecouteurs[i][0].removeEventListener(ecouteurs[i][1], ecouteurs[i][2], ecouteurs[i][3]); } catch (e) {}
    }
    ecouteurs = [];
    try { if (ro) ro.disconnect(); } catch (e) {}
    try {
      if (mqDisplay) {
        if (mqDisplay.removeEventListener) mqDisplay.removeEventListener("change", onResize);
        else if (mqDisplay.removeListener) mqDisplay.removeListener(onResize);
      }
    } catch (e) {}
    if (minuteur) clearTimeout(minuteur);

    var r = document.documentElement;
    if (r) {
      ["--sa-top", "--sa-right", "--sa-bottom", "--sa-left",
       "--safe-top", "--safe-bot", "--rj-vw", "--rj-vh"].forEach(function (v) {
        r.style.removeProperty(v);
      });
      r.removeAttribute("data-rj-device");
      r.removeAttribute("data-rj-orient");
    }
    var s = document.getElementById("rj68-sonde");
    if (s && s.parentNode) s.parentNode.removeChild(s);
    var cssEl = document.getElementById("rj68-css");
    if (cssEl && cssEl.parentNode) cssEl.parentNode.removeChild(cssEl);
    var appEl = document.getElementById("app");
    if (appEl) {
      ["zoom", "width", "height", "max-width", "max-height"].forEach(function (k) {
        appEl.style.removeProperty(k);
      });
    }

    etat.actif = false;
    console.log(TAG, "désinstallé — recharger la page pour réactiver 41 et 67");
  };
})();
