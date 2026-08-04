/* =====================================================================
 * 80-mode-de-jeu.js — CHOIX DU MODE DE JEU + PARCOURS DE CRÉATION REVU
 *
 * AVANT : « Nouvelle carrière » envoyait directement sur les six étapes de
 * création. Aucune notion de mode de jeu. Le bac à sable, qui est pourtant
 * un mode à part entière, était un interrupteur perdu sous le sélecteur de
 * nationalité — au milieu de l'identité du pilote, sans rapport.
 *
 * APRÈS :
 *   1. Une étape « Mode de jeu » ouvre le parcours. Elle repose sur un
 *      REGISTRE EXTENSIBLE : ajouter un mode plus tard ne demandera qu'un
 *      appel à window.rjRegisterGameMode({...}), sans toucher à cet écran
 *      ni au reste du jeu.
 *   2. Le bac à sable y est remonté comme mode à part entière et disparaît
 *      de l'étape identité.
 *   3. Les six étapes suivantes sont retravaillées : chaque étape est
 *      nommée dans l'en-tête, la barre de progression indique la position
 *      réelle (mode compris), et le bouton « Continuer » reste inactif tant
 *      que l'étape est incomplète au lieu d'afficher une erreur après coup.
 *   4. Le mode choisi est rappelé en tête de création, dans le récapitulatif
 *      final, et conservé dans la sauvegarde.
 *
 * OPTION A — aucun fichier cœur modifié : enveloppes de goCreate,
 * updateCreUI, buildRecap, saveGame et loadSave.
 *
 * PERSISTANCE : saveGame sérialise une liste fermée de champs ; on écrit
 * donc un bloc « rj80 » à côté, dans le même emplacement.
 *
 * Réversible : window._rj80Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[80-mode-de-jeu]";
  var CYAN = "#00D4FF", GOLD = "#F0B41E", GREEN = "#34D399";

  function G_() { return typeof window.G !== "undefined" ? window.G : null; }
  function fn(n) { return typeof window[n] === "function"; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ==================================================================
   * 1. REGISTRE DES MODES DE JEU
   *
   * Pour ajouter un mode plus tard, il suffit d'appeler :
   *   window.rjRegisterGameMode({
   *     id: "iron", nom: "Mode Iron", tagline: "Une seule vie",
   *     description: "...", points: ["...", "..."],
   *     couleur: "#EF4444",
   *     onStart: function (G) { ... }   // appliqué au lancement de carrière
   *   });
   * L'écran se met à jour tout seul.
   * ================================================================== */

  var MODES = [];

  function enregistrerMode(def) {
    if (!def || !def.id) return false;
    for (var i = 0; i < MODES.length; i++) {
      if (MODES[i].id === def.id) { MODES[i] = def; return true; }
    }
    MODES.push(def);
    return true;
  }

  function modeParId(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return null;
  }

  function modeCourant() {
    var G = G_();
    var id = (G && G._gameMode) || "normal";
    return modeParId(id) || MODES[0];
  }

  /* --- les modes livrés --- */

  enregistrerMode({
    id: "normal",
    nom: "Carrière",
    tagline: "L'expérience complète",
    description: "Tu débutes en karting avec un budget serré et tu te fais un nom saison après saison. " +
                 "Les écuries te jugent sur tes résultats, le mercato ne fait pas de cadeau.",
    points: [
      "Départ en karting, progression jusqu'à la Formule 1",
      "Budget, contrats et réputation à construire",
      "Aucune facilité : c'est le mode de référence"
    ],
    couleur: CYAN,
    defaut: true,
    onStart: function () { try { window.SANDBOX_ACTIVE = false; } catch (e) {} }
  });

  enregistrerMode({
    id: "sandbox",
    nom: "Bac à sable",
    tagline: "Paddock Pass",
    description: "Tu choisis ton point de départ : catégorie, écurie et budget. Pour tester une " +
                 "situation précise ou commencer directement au sommet, sans passer par les petites catégories.",
    points: [
      "Catégorie de départ au choix, karting comme Formule 1",
      "Écurie et budget initial personnalisables",
      "Idéal pour expérimenter — la progression perd son enjeu"
    ],
    couleur: GOLD,
    onStart: function () { try { window.SANDBOX_ACTIVE = true; } catch (e) {} }
  });

  /* ==================================================================
   * 2. ÉCRAN DE SÉLECTION
   * ================================================================== */

  var CSS_ID = "rj80-css";
  var choixTemporaire = "normal";

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#S-mode .rj80-wrap{max-width:560px;margin:0 auto;padding:0 14px 40px}",
      "#S-mode .rj80-head{padding:16px 2px 6px;display:flex;align-items:flex-start;gap:12px}",
      "#S-mode .rj80-back{background:none;border:none;color:var(--muted);font-family:inherit;font-size:20px;cursor:pointer;padding:2px 6px 2px 0;line-height:1}",
      "#S-mode .rj80-eyebrow{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:" + CYAN + "}",
      "#S-mode .rj80-title{font-family:var(--font-display);font-size:23px;font-weight:900;color:var(--white);margin-top:5px;line-height:1.15}",
      "#S-mode .rj80-sub{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.5;font-family:var(--font-body)}",
      ".rj80-card{position:relative;display:block;width:100%;text-align:left;margin-bottom:11px;padding:15px 14px;cursor:pointer;" +
        "background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);border:2px solid var(--line);border-radius:var(--r);" +
        "font-family:inherit;transition:border-color .15s,background .15s}",
      ".rj80-card:hover{border-color:var(--border-hi)}",
      ".rj80-card.on{border-color:var(--sel,#00D4FF);background:linear-gradient(160deg,var(--bg3) 0%,var(--bg) 100%)}",
      ".rj80-card .mt{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".rj80-card .mn{font-family:var(--font-display);font-size:16px;font-weight:900;color:var(--white);letter-spacing:.02em}",
      ".rj80-card .mtag{font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:2px 7px;border-radius:3px}",
      ".rj80-card .md{font-size:12.5px;color:var(--soft);line-height:1.5;margin-top:8px;font-family:var(--font-body)}",
      ".rj80-card .mp{margin-top:10px;display:flex;flex-direction:column;gap:5px}",
      ".rj80-card .mp span{font-size:11.5px;color:var(--muted);line-height:1.45;font-family:var(--font-body);padding-left:14px;position:relative}",
      ".rj80-card .mp span:before{content:'';position:absolute;left:2px;top:6px;width:4px;height:4px;border-radius:50%;background:var(--border-hi)}",
      ".rj80-card .mcheck{position:absolute;top:14px;right:13px;width:19px;height:19px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center}",
      ".rj80-card.on .mcheck{border-color:var(--sel,#00D4FF);background:var(--sel,#00D4FF)}",
      ".rj80-card.on .mcheck:after{content:'';width:7px;height:7px;border-radius:50%;background:#08131a}",
      ".rj80-soon{margin-top:6px;padding:13px 14px;border:1px dashed var(--line);border-radius:var(--r);" +
        "font-size:12px;color:var(--text3);line-height:1.5;font-family:var(--font-body);text-align:center}",
      ".rj80-go{width:100%;margin-top:16px;padding:15px;border:none;border-radius:var(--r);background:var(--red);color:#fff;" +
        "font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}",
      /* rappel du mode dans l'en-tête de création */
      ".rj80-banner{display:inline-flex;align-items:center;gap:7px;margin:0 0 12px;padding:5px 10px;border-radius:4px;" +
        "font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}",
      ".rj80-banner button{background:none;border:none;color:inherit;font:inherit;text-decoration:underline;cursor:pointer;opacity:.75;padding:0}",
      /* nom de l'étape courante */
      ".rj80-stepname{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}",
      "#cre-next.rj80-off{opacity:.4;cursor:not-allowed;filter:grayscale(.5)}"
    ].join("");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  function creerEcran() {
    if (document.getElementById("S-mode")) return true;
    var ancre = document.getElementById("S-create") || document.getElementById("S-home");
    if (!ancre || !ancre.parentNode) return false;
    injecterCSS();
    var scr = document.createElement("div");
    scr.className = "scr";
    scr.id = "S-mode";
    scr.innerHTML =
      '<div class="scroll" style="flex:1">' +
        '<div class="rj80-wrap">' +
          '<div class="rj80-head">' +
            '<button class="rj80-back" id="rj80-back" aria-label="Retour">\u2039</button>' +
            '<div>' +
              '<div class="rj80-eyebrow">Nouvelle carrière</div>' +
              '<div class="rj80-title">Mode de jeu</div>' +
              '<div class="rj80-sub">Ce choix fixe les règles de ta carrière. Il ne pourra plus être modifié ensuite.</div>' +
            '</div>' +
          '</div>' +
          '<div id="rj80-liste"></div>' +
          '<div class="rj80-soon">D\'autres modes de jeu viendront s\'ajouter ici.</div>' +
          '<button class="rj80-go" id="rj80-go">Continuer \u2192</button>' +
        '</div>' +
      '</div>';
    ancre.parentNode.insertBefore(scr, ancre);

    scr.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t.closest && t.closest("#rj80-back")) { retourSplash(); return; }
      if (t.closest && t.closest("#rj80-go")) { validerMode(); return; }
      var carte = t.closest ? t.closest(".rj80-card") : null;
      if (carte) {
        choixTemporaire = carte.getAttribute("data-mode");
        rendreListe();
      }
    });
    return true;
  }

  function rendreListe() {
    var host = document.getElementById("rj80-liste");
    if (!host) return;
    var h = "";
    MODES.forEach(function (m) {
      var on = (m.id === choixTemporaire);
      h += '<button class="rj80-card' + (on ? " on" : "") + '" data-mode="' + esc(m.id) + '"' +
           ' style="--sel:' + (m.couleur || CYAN) + '">' +
             '<span class="mcheck"></span>' +
             '<span class="mt">' +
               '<span class="mn">' + esc(m.nom) + '</span>' +
               (m.tagline ? '<span class="mtag" style="color:' + (m.couleur || CYAN) + ';border:1px solid ' +
                 (m.couleur || CYAN) + '55;background:' + (m.couleur || CYAN) + '18">' + esc(m.tagline) + '</span>' : '') +
             '</span>' +
             '<span class="md">' + esc(m.description || "") + '</span>' +
             (m.points && m.points.length
               ? '<span class="mp">' + m.points.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join("") + '</span>'
               : '') +
           '</button>';
    });
    host.innerHTML = h;
  }

  function ouvrirEcranMode() {
    if (!creerEcran()) return false;
    var G = G_();
    choixTemporaire = (G && G._gameMode) || "normal";
    rendreListe();
    if (fn("navTo")) window.navTo("S-mode", null);
    else if (fn("go")) window.go("S-mode");
    return true;
  }

  function retourSplash() {
    if (fn("go")) window.go("S-splash");
    else if (fn("navTo")) window.navTo("S-splash", null);
  }

  /* Le mode est retenu, on entre dans la création proprement dite. */
  function validerMode() {
    var G = G_();
    var m = modeParId(choixTemporaire) || MODES[0];
    if (G) G._gameMode = m.id;

    /* ORDRE IMPORTANT : goCreate remet lui-même SANDBOX_ACTIVE à false en
       fin de réinitialisation. Le mode doit donc être appliqué APRÈS son
       appel, sinon le bac à sable est éteint dans la foulée. */
    _dansCreation = true;
    try { if (_origGoCreate) _origGoCreate(); } catch (e) { console.warn(TAG, "goCreate :", e && e.message); }

    try { if (typeof m.onStart === "function") m.onStart(G); } catch (e) {}

    /* Le bac à sable pilote un interrupteur du cœur : on le synchronise
       via sa propre bascule plutôt que de dupliquer son état. */
    try {
      var attendu = (m.id === "sandbox");
      if (!!window.SANDBOX_ACTIVE !== attendu && fn("_sbToggle")) window._sbToggle();
      else window.SANDBOX_ACTIVE = attendu;
    } catch (e) {}

    setTimeout(function () { habillerCreation(); }, 60);
  }

  /* ==================================================================
   * 3. PARCOURS DE CRÉATION REVU
   * ================================================================== */

  var ETAPES = [
    { n: 1, nom: "Identité",     aide: "Ton nom et ta nationalité." },
    { n: 2, nom: "Origines",     aide: "Date de naissance, ville et année de début." },
    { n: 3, nom: "Style",        aide: "Ta manière de piloter." },
    { n: 4, nom: "Caractère",    aide: "Le trait qui te définit." },
    { n: 5, nom: "Numéro",       aide: "Le numéro qui te suivra toute ta carrière." },
    { n: 6, nom: "Récapitulatif", aide: "Vérifie ton profil avant de te lancer." }
  ];

  var _dansCreation = false;
  var _origGoCreate = null, _origUpdate = null, _origRecap = null;

  /* Bandeau de rappel + nom de l'étape, injectés dans l'écran existant. */
  function habillerCreation() {
    var scr = document.getElementById("S-create");
    if (!scr) return;
    injecterCSS();

    /* 1. le bloc bac à sable de l'étape identité n'a plus lieu d'être :
       le choix se fait désormais en tête de parcours. */
    var inline = document.getElementById("sb-inline-card");
    if (inline) inline.style.display = "none";

    /* 2. rappel du mode retenu, cliquable pour revenir en arrière */
    var m = modeCourant();
    var ban = document.getElementById("rj80-banner");
    if (!ban) {
      ban = document.createElement("div");
      ban.className = "rj80-banner";
      ban.id = "rj80-banner";
      var corps = scr.querySelector(".apex-create-body");
      var prog = document.getElementById("step-prog");
      if (corps && prog && prog.parentNode === corps) corps.insertBefore(ban, prog);
      else if (corps) corps.insertBefore(ban, corps.firstChild);
      ban.addEventListener("click", function (ev) {
        if (ev.target && ev.target.tagName === "BUTTON") ouvrirEcranMode();
      });
    }
    var c = m.couleur || CYAN;
    ban.style.color = c;
    ban.style.border = "1px solid " + c + "55";
    ban.style.background = c + "14";
    ban.innerHTML = "Mode " + esc(m.nom) + " <button type=\"button\">changer</button>";

    /* 3. nom de l'étape courante */
    var nom = document.getElementById("rj80-stepname");
    if (!nom) {
      nom = document.createElement("div");
      nom.className = "rj80-stepname";
      nom.id = "rj80-stepname";
      var prog2 = document.getElementById("step-prog");
      if (prog2 && prog2.parentNode) prog2.parentNode.insertBefore(nom, prog2.nextSibling);
    }
    var step = (typeof window.creStep === "number") ? window.creStep : 1;
    var e = ETAPES[step - 1];
    if (e) nom.textContent = e.nom + " \u2014 " + e.aide;

    majBoutonContinuer();
  }

  /* ------------------------------------------------------------------
   * Validation en direct : le bouton reste inactif tant que l'étape
   * n'est pas remplie, au lieu d'afficher une erreur après le clic.
   * On ne double PAS la validation du cœur (âge, numéro) : creNext garde
   * le dernier mot et ses messages. On bloque seulement l'évident.
   * ---------------------------------------------------------------- */
  function etapeComplete() {
    var step = (typeof window.creStep === "number") ? window.creStep : 1;
    function val(id) {
      var el = document.getElementById(id);
      return el && el.value ? String(el.value).trim() : "";
    }
    if (step === 1) {
      if (!val("p-fn") || !val("p-ln")) return false;
      if (!window.selNatVal) return false;
      return true;
    }
    if (step === 2) return !!val("p-birthcity");
    return true;
  }

  function majBoutonContinuer() {
    var btn = document.getElementById("cre-next");
    if (!btn) return;
    var ok = etapeComplete();
    btn.classList.toggle("rj80-off", !ok);
    btn.setAttribute("aria-disabled", ok ? "false" : "true");
  }

  /* Les champs de l'étape courante réévaluent le bouton à chaque frappe. */
  function brancherEcoute() {
    var ids = ["p-fn", "p-ln", "p-birthcity"];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el._rj80) return;
      el.addEventListener("input", majBoutonContinuer);
      el._rj80 = true;
    });
    /* la nationalité se choisit au clic, pas au clavier */
    var grille = document.getElementById("nat-grid");
    if (grille && !grille._rj80) {
      grille.addEventListener("click", function () { setTimeout(majBoutonContinuer, 30); });
      grille._rj80 = true;
    }
  }

  /* Clic sur un bouton inactif : on garde le message du cœur (il est
     explicite) mais on amène le joueur directement au champ fautif. */
  var _origNext = null;

  function installFocusManquant() {
    if (!fn("creNext") || window.creNext._rj80) return false;
    _origNext = window.creNext;
    window.creNext = function () {
      var r = _origNext.apply(this, arguments);
      try {
        if (!etapeComplete()) {
          var step = (typeof window.creStep === "number") ? window.creStep : 1;
          var cible = null;
          if (step === 1) {
            var fnm = document.getElementById("p-fn"), lnm = document.getElementById("p-ln");
            if (fnm && !fnm.value.trim()) cible = fnm;
            else if (lnm && !lnm.value.trim()) cible = lnm;
            else cible = document.getElementById("continent-grid");
          } else if (step === 2) {
            cible = document.getElementById("p-birthcity");
          }
          if (cible && cible.focus) { try { cible.focus(); } catch (e) {} }
          if (cible && cible.scrollIntoView) { try { cible.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }
        }
        majBoutonContinuer();
      } catch (e) {}
      return r;
    };
    window.creNext._rj80 = true;
    return true;
  }

  function installParcours() {
    if (fn("goCreate") && !window.goCreate._rj80) {
      _origGoCreate = window.goCreate;
      window.goCreate = function () {
        /* premier passage : on montre les modes ; ensuite on laisse faire */
        if (!_dansCreation) {
          if (ouvrirEcranMode()) return;
        }
        _dansCreation = false;
        return _origGoCreate.apply(this, arguments);
      };
      window.goCreate._rj80 = true;
    }

    if (fn("updateCreUI") && !window.updateCreUI._rj80) {
      _origUpdate = window.updateCreUI;
      window.updateCreUI = function () {
        var r = _origUpdate.apply(this, arguments);
        try {
          habillerCreation();
          brancherEcoute();
        } catch (e) { console.warn(TAG, "habillage :", e && e.message); }
        return r;
      };
      window.updateCreUI._rj80 = true;
    }

    /* Le récapitulatif rappelle le mode retenu. */
    if (fn("buildRecap") && !window.buildRecap._rj80) {
      _origRecap = window.buildRecap;
      window.buildRecap = function () {
        var r = _origRecap.apply(this, arguments);
        try { injecterRecapMode(); } catch (e) {}
        return r;
      };
      window.buildRecap._rj80 = true;
    }
    return true;
  }

  function injecterRecapMode() {
    var host = document.getElementById("cs6");
    if (!host) return;
    var anc = document.getElementById("rj80-recap");
    if (anc && anc.parentNode) anc.parentNode.removeChild(anc);
    var m = modeCourant();
    var c = m.couleur || CYAN;
    var div = document.createElement("div");
    div.id = "rj80-recap";
    div.style.cssText = "margin:0 0 14px;padding:12px 14px;border:1px solid " + c + "44;border-left:3px solid " + c +
      ";background:" + c + "10;border-radius:var(--r)";
    div.innerHTML =
      '<div style="font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.16em;' +
      'text-transform:uppercase;color:' + c + ';margin-bottom:3px">Mode de jeu</div>' +
      '<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--white)">' +
        esc(m.nom) + (m.tagline ? ' <span style="font-size:11px;font-weight:700;color:var(--muted)">\u00b7 ' + esc(m.tagline) + '</span>' : '') +
      '</div>';
    if (host.firstChild) host.insertBefore(div, host.firstChild);
    else host.appendChild(div);
  }

  /* ==================================================================
   * 4. PERSISTANCE DU MODE
   * ================================================================== */

  var _origSave = null, _origLoad = null;

  function cleSlot(slot) {
    try {
      if (window.SAVE_KEYS && window.SAVE_KEYS[slot] != null) return window.SAVE_KEYS[slot];
    } catch (e) {}
    return "rj_s" + (Number(slot) + 1);
  }

  function installPersistance() {
    if (fn("saveGame") && !window.saveGame._rj80) {
      _origSave = window.saveGame;
      window.saveGame = function (slot) {
        var r = _origSave.apply(this, arguments);
        try {
          var G = G_(); if (!G) return r;
          var s = (typeof slot === "undefined") ? (G._slot || 0) : slot;
          var k = cleSlot(s);
          var brut = localStorage.getItem(k);
          if (brut) {
            var obj = JSON.parse(brut);
            obj.rj80 = { v: 1, mode: G._gameMode || "normal" };
            localStorage.setItem(k, JSON.stringify(obj));
          }
        } catch (e) { console.warn(TAG, "sauvegarde du mode :", e && e.message); }
        return r;
      };
      window.saveGame._rj80 = true;
    }

    if (fn("loadSave") && !window.loadSave._rj80) {
      _origLoad = window.loadSave;
      window.loadSave = function (slot) {
        var r = _origLoad.apply(this, arguments);
        try {
          var G = G_(); if (!G) return r;
          var brut = localStorage.getItem(cleSlot(slot));
          var obj = brut ? JSON.parse(brut) : null;
          G._gameMode = (obj && obj.rj80 && obj.rj80.mode) || "normal";
        } catch (e) { console.warn(TAG, "lecture du mode :", e && e.message); }
        return r;
      };
      window.loadSave._rj80 = true;
    }
  }

  /* ==================================================================
   * 5. INSTALLATION
   * ================================================================== */

  function install() {
    if (window._rj80Installed) return;
    window._rj80Installed = true;

    var essais = 0;
    (function boot() {
      var a = installParcours();
      installFocusManquant();
      installPersistance();
      if (a && fn("goCreate")) {
        creerEcran();
        console.log(TAG, "actif — " + MODES.length + " mode(s) de jeu");
        return;
      }
      if (essais++ < 60) setTimeout(boot, 150);
      else console.warn(TAG, "installation partielle (goCreate introuvable)");
    })();

    /* API publique : ajout de modes et lecture du mode courant. */
    window.rjRegisterGameMode = function (def) {
      var ok = enregistrerMode(def);
      try { rendreListe(); } catch (e) {}
      return ok;
    };
    window.rjGameMode = modeCourant;
    window._rj80 = {
      modes: function () { return MODES.slice(); },
      ouvrir: ouvrirEcranMode,
      courant: modeCourant,
      etapes: ETAPES
    };

    window._rj80Uninstall = function () {
      try {
        if (_origGoCreate) window.goCreate = _origGoCreate;
        if (_origUpdate) window.updateCreUI = _origUpdate;
        if (_origRecap) window.buildRecap = _origRecap;
        if (_origNext) window.creNext = _origNext;
        if (_origSave) window.saveGame = _origSave;
        if (_origLoad) window.loadSave = _origLoad;
        ["S-mode", CSS_ID, "rj80-banner", "rj80-stepname", "rj80-recap"].forEach(function (id) {
          var el = document.getElementById(id);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        var inline = document.getElementById("sb-inline-card");
        if (inline) inline.style.display = "";
        var btn = document.getElementById("cre-next");
        if (btn) btn.classList.remove("rj80-off");
        window._rj80Installed = false;
        console.log(TAG, "désinstallé");
      } catch (e) { console.warn(TAG, "désinstallation :", e && e.message); }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
