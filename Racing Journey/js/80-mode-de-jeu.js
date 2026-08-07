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
      "#cre-next.rj80-off{opacity:.4;cursor:not-allowed;filter:grayscale(.5)}",
      /* grille des écuries de cœur */
      ".rj80-fav-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}",
      ".rj80-fav-opt{display:flex;align-items:center;gap:8px;padding:8px 9px;background:var(--bg3);border:1.5px solid var(--line);" +
        "border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;transition:border-color .15s,background .15s}",
      ".rj80-fav-opt:hover{border-color:var(--border-hi)}",
      ".rj80-fav-opt.on{border-color:" + CYAN + ";background:rgba(0,212,255,.10)}",
      ".rj80-fav-opt .rj80-fav-logo{display:inline-flex;width:22px;height:22px;border-radius:4px;overflow:hidden;flex-shrink:0}",
      ".rj80-fav-opt .rj80-fav-nom{font-size:11.5px;font-weight:600;color:var(--text);line-height:1.25;font-family:var(--font-body)}",
      ".rj80-fav-opt.on .rj80-fav-nom{color:var(--white)}",
      ".rj80-fav-none{grid-column:1 / -1;justify-content:center;font-size:11.5px;color:var(--muted)}",
      ".rj80-fav-nologo{display:inline-block;width:22px;height:22px;border-radius:4px;background:var(--line)}"
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
    photographierSaisie();
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

  /* ==================================================================
   * 2 bis. CONSERVATION DE LA SAISIE
   *
   * goCreate() remet le formulaire à zéro : sans précaution, un aller-retour
   * par l'écran des modes effaçait le nom, la nationalité, le style déjà
   * choisis. On photographie donc l'état avant de sortir, et on le rejoue au
   * retour — y compris l'étape en cours.
   * ================================================================== */

  var _saisie = null;

  function champ(id) {
    var el = document.getElementById(id);
    return el ? el.value : null;
  }

  function photographierSaisie() {
    var scr = document.getElementById("S-create");
    if (!scr || !scr.classList.contains("on")) return;   // pas en cours de création
    _saisie = {
      fn: champ("p-fn"), ln: champ("p-ln"), ville: champ("p-birthcity"),
      num: champ("p-num"),
      jour: champ("p-dob-day"), mois: champ("p-dob-month"), annee: champ("p-dob-year"),
      debut: champ("p-startyear"),
      nat: window.selNatVal || null,
      continent: window._selectedContinent || null,
      style: window.selStyleVal || null,
      trait: window.selTraitVal || null,
      favTeam: choixEcurie,
      step: (typeof window.creStep === "number") ? window.creStep : 1
    };
  }

  function poser(id, v) {
    if (v == null || v === "") return;
    var el = document.getElementById(id);
    if (!el) return;
    el.value = v;
    try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
  }

  function restaurerSaisie() {
    if (!_saisie) return;
    var s = _saisie;
    try {
      poser("p-fn", s.fn); poser("p-ln", s.ln); poser("p-birthcity", s.ville);
      poser("p-num", s.num);
      poser("p-dob-day", s.jour); poser("p-dob-month", s.mois); poser("p-dob-year", s.annee);
      poser("p-startyear", s.debut);

      /* La nationalité se rejoue par les fonctions du jeu : la grille des
         pays et le badge de sélection doivent se reconstruire comme si le
         joueur venait de cliquer. */
      if (s.continent && fn("selContinent")) {
        window.selContinent(s.continent);
        if (s.nat) {
          var btn = document.querySelector('#nat-grid .nat-opt[data-code="' + s.nat + '"]');
          if (btn && fn("selNat")) window.selNat(btn, s.nat);
          else window.selNatVal = s.nat;
        }
      }

      if (s.style && fn("selStyle")) {
        var bs = document.querySelector('#style-grid .trait-opt[onclick*="\'' + s.style + '\'"]');
        if (bs) window.selStyle(bs, s.style); else window.selStyleVal = s.style;
      }
      if (s.trait && fn("selTrait")) {
        var bt = document.querySelector('#trait-list .trait-opt[onclick*="\'' + s.trait + '\'"]');
        if (bt) window.selTrait(bt, s.trait); else window.selTraitVal = s.trait;
      }
      if (s.favTeam) choixEcurie = s.favTeam;

      /* On rend la main là où le joueur s'était arrêté. */
      if (s.step && s.step > 1 && fn("updateCreUI")) {
        window.creStep = s.step;
        window.updateCreUI();
      }
    } catch (e) {
      console.warn(TAG, "restauration de la saisie :", e && e.message);
    }
    _saisie = null;
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

    setTimeout(function () {
      habillerCreation();
      restaurerSaisie();
      habillerCreation();
      majBoutonContinuer();
    }, 60);
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

    /* l'emplacement libéré accueille l'écurie de cœur */
    try { injecterChoixEcurie(); } catch (e) {}

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
   * 3 bis. ÉCURIE DE CŒUR
   *
   * Le pilote désigne l'écurie de Formule 1 qu'il rêve de rejoindre. Deux
   * conséquences, volontairement discrètes :
   *   - un très léger avantage pour y entrer un jour : le seuil de
   *     réputation exigé par cette écurie baisse de quelques points, et une
   *     petite chance hebdomadaire de proposition spontanée s'ouvre une fois
   *     le joueur arrivé dans la catégorie ;
   *   - le jour où il signe enfin, un bond de moral temporaire, avec la
   *     réaction presse qui va avec.
   * ================================================================== */

  var choixEcurie = null;              // pendant la création
  var BONUS_REP = 5;                   // points de réputation en moins pour l'écurie de cœur

  function ecuriesF1() {
    try {
      var t = window.TEAM_OFFERS && window.TEAM_OFFERS["Formule 1"];
      if (!t) return [];
      return t.map(function (x) { return x.team; }).sort();
    } catch (e) { return []; }
  }

  function injecterChoixEcurie() {
    var hote = document.getElementById("cs1");
    if (!hote) return;
    if (document.getElementById("rj80-fav")) { majSelectEcurie(); return; }
    var liste = ecuriesF1();
    if (!liste.length) return;

    var bloc = document.createElement("div");
    bloc.id = "rj80-fav";
    bloc.style.cssText = "margin-top:14px;padding:13px 14px;background:linear-gradient(135deg,rgba(0,212,255,.07),rgba(0,212,255,.02));" +
      "border:1px solid rgba(0,212,255,.3);border-radius:12px";
    bloc.innerHTML =
      '<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:' + CYAN +
        ';letter-spacing:.08em;text-transform:uppercase">Écurie de cœur</div>' +
      '<div style="font-size:11px;color:var(--text2);margin:3px 0 9px;line-height:1.45">' +
        'L\'écurie de Formule 1 que ton pilote rêve de rejoindre. Facultatif.</div>' +
      '<div id="rj80-fav-grid" class="rj80-fav-grid"></div>';
    hote.appendChild(bloc);
    hote.querySelector("#rj80-fav-grid").addEventListener("click", function (ev) {
      var opt = ev.target.closest ? ev.target.closest(".rj80-fav-opt") : null;
      if (!opt) return;
      var team = opt.getAttribute("data-team") || null;
      choixEcurie = (choixEcurie === team) ? null : team;   // re-cliquer retire le choix
      majSelectEcurie();
    });
    majSelectEcurie();
  }

  /* Un <select> natif n'accepte pas de logo : on rend une grille de vignettes
     avec l'écusson de chaque écurie, comme partout ailleurs dans le jeu. */
  function logoEcurie(team) {
    try {
      var svg = window.TEAM_LOGOS && window.TEAM_LOGOS[team];
      if (!svg) return '<span class="rj80-fav-nologo"></span>';
      return svg.replace('width="40" height="40"', 'width="22" height="22"');
    } catch (e) { return '<span class="rj80-fav-nologo"></span>'; }
  }

  function majSelectEcurie() {
    var grille = document.getElementById("rj80-fav-grid");
    if (!grille) return;
    var liste = ecuriesF1();
    var h = '<button type="button" class="rj80-fav-opt rj80-fav-none' +
            (choixEcurie ? "" : " on") + '" data-team="">Aucune préférence</button>';
    liste.forEach(function (t) {
      h += '<button type="button" class="rj80-fav-opt' + (choixEcurie === t ? " on" : "") +
           '" data-team="' + esc(t) + '">' +
             '<span class="rj80-fav-logo">' + logoEcurie(t) + '</span>' +
             '<span class="rj80-fav-nom">' + esc(t) + '</span>' +
           '</button>';
    });
    grille.innerHTML = h;
  }

  /* Applique la remise de réputation sur l'entrée du catalogue, de façon
     idempotente : la valeur d'origine est conservée à part. */
  function appliquerBonusReputation() {
    var G = G_(); if (!G) return;
    try {
      var table = window.TEAM_OFFERS && window.TEAM_OFFERS["Formule 1"];
      if (!table) return;
      table.forEach(function (t) {
        if (typeof t._repReqBase !== "number") t._repReqBase = t.repReq || 0;
        var cible = (G._favTeam && t.team === G._favTeam);
        t.repReq = cible ? Math.max(0, t._repReqBase - BONUS_REP) : t._repReqBase;
      });
    } catch (e) { console.warn(TAG, "bonus écurie de cœur :", e && e.message); }
  }

  /* Petite chance hebdomadaire que l'écurie de cœur se manifeste, une fois
     le joueur dans la catégorie et suffisamment réputé. */
  function tenterOffreEcurieDeCoeur() {
    var G = G_(); if (!G || !G._favTeam) return;
    if (G.cat !== "Formule 1") return;
    if (G.currentTeam === G._favTeam) return;
    if (G.pendingTransfer) return;
    if ((G.offers || []).some(function (o) { return o && o.team === G._favTeam; })) return;

    var base = null;
    try {
      base = (window.TEAM_OFFERS["Formule 1"] || []).find(function (t) { return t.team === G._favTeam; });
    } catch (e) {}
    if (!base) return;
    if ((G.reputation || 0) < (base.repReq || 0)) return;

    /* 2,5 % par semaine, doublé en fin de saison : de l'ordre d'une
       proposition par saison et demie quand le niveau est atteint. */
    var p = (G.semaine >= 34) ? 0.05 : 0.025;
    if (Math.random() >= p) return;

    var offre = null;
    if (fn("buildOffer")) {
      try {
        offre = window.buildOffer({
          team: base.team, cat: "Formule 1", cost: base.cost, salary: base.salary,
          bonusWin: base.bonusWin, bonusPodium: base.bonusPodium,
          duration: 2, expire: 6, role: "num2"
        });
      } catch (e) {}
    }
    if (!offre) return;
    G.offers = G.offers || [];
    G.offers.push(offre);

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Ton agent", role: "agent",
          subject: base.team + " s'intéresse à toi",
          body: "Je sais ce que cette écurie représente pour toi. Ils ont appelé.\n\n" +
                "L'offre est dans tes contrats. Prends le temps de la lire — mais pas trop.",
          actions: [{ label: "Voir l'offre", kind: "dismiss", responseBody: "J'arrive." }]
        });
      } catch (e) {}
    }
    var dot = document.getElementById("ni-more-dot");
    if (dot) dot.style.display = "block";
  }

  /* Le jour où il signe enfin. */
  function verifierArriveeEcurieDeCoeur() {
    var G = G_(); if (!G || !G._favTeam) return;
    if (G.currentTeam !== G._favTeam) return;
    if (G._favTeamAtteinte) return;
    G._favTeamAtteinte = { saison: G.saison, semaine: G.semaine };

    if (fn("changeMental")) {
      try { window.changeMental(18, "Tu pilotes enfin pour " + G._favTeam); } catch (e) {}
    }
    if (typeof G.happiness === "number") G.happiness = Math.min(100, G.happiness + 15);
    /* Élan temporaire : quelques semaines portées par l'enthousiasme. */
    G._favTeamBoost = { semainesRestantes: 6 };

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Ton agent", role: "agent",
          subject: "Tu y es",
          body: "Tu te souviens du gamin qui avait écrit " + G._favTeam + " sur son casque ?\n\n" +
                "Il signe aujourd'hui. Profite de ce moment, il n'arrive qu'une fois.",
          actions: [{ label: "Merci", kind: "dismiss", responseBody: "Je n'y crois pas encore." }]
        });
      } catch (e) {}
    }
    if (fn("_addFeedPost") && window.SOCIAL_PRESS_ACCOUNTS) {
      try {
        var acc = window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)];
        window._addFeedPost({
          type: "press", author: acc.name, handle: acc.handle, color: acc.color,
          body: "Un rêve de gosse qui se réalise : " + (G.pilot ? (G.pilot.prenom + " " + G.pilot.nom) : "le pilote") +
                " rejoint " + G._favTeam + ", l'écurie qu'il citait déjà dans ses premières interviews."
        });
      } catch (e) {}
    }
  }

  /* L'élan retombe progressivement. */
  function decompterBoost() {
    var G = G_(); if (!G || !G._favTeamBoost) return;
    G._favTeamBoost.semainesRestantes--;
    if (G._favTeamBoost.semainesRestantes > 0) {
      if (fn("changeMental")) { try { window.changeMental(2, "Élan des débuts chez " + G._favTeam); } catch (e) {} }
    } else {
      G._favTeamBoost = null;
    }
  }

  function hookHebdo() {
    try {
      appliquerBonusReputation();
      verifierArriveeEcurieDeCoeur();
      decompterBoost();
      tenterOffreEcurieDeCoeur();
    } catch (e) { console.warn(TAG, "hook hebdo :", e && e.message); }
  }

  function enregistrerHook() {
    if (!window.WEEKLY_TICK_HOOKS || !window.WEEKLY_TICK_HOOKS.push) return false;
    if (window.WEEKLY_TICK_HOOKS.some(function (h) { return h && h.id === "favoriteTeam"; })) return true;
    window.WEEKLY_TICK_HOOKS.push({ id: "favoriteTeam", run: hookHebdo });
    return true;
  }

  /* Le choix est scellé au lancement de la carrière. */
  var _origLaunch = null;
  function installLancement() {
    if (!fn("launchGame") || window.launchGame._rj80) return false;
    _origLaunch = window.launchGame;
    window.launchGame = function () {
      var r = _origLaunch.apply(this, arguments);
      try {
        var G = G_();
        if (G) {
          G._favTeam = choixEcurie || null;
          G._favTeamAtteinte = null;
          G._favTeamBoost = null;
          appliquerBonusReputation();
          verifierArriveeEcurieDeCoeur();   // cas du bac à sable démarrant chez elle
        }
      } catch (e) {}
      return r;
    };
    window.launchGame._rj80 = true;
    return true;
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

  /* Persistance déléguée au registre commun (module 87). */
  function installPersistance() {
    if (!Array.isArray(window.RJ_SAVE_HOOKS)) window.RJ_SAVE_HOOKS = [];
    if (window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "rj80"; })) return;
    window.RJ_SAVE_HOOKS.push({
      cle: "rj80",
      ecrire: function (G) {
        return {
          v: 2,
          mode: G._gameMode || "normal",
          favTeam: G._favTeam || null,
          favAtteinte: G._favTeamAtteinte || null,
          favBoost: G._favTeamBoost || null
        };
      },
      lire: function (bloc, G) {
        G._gameMode = (bloc && bloc.mode) || "normal";
        G._favTeam = (bloc && bloc.favTeam) || null;
        G._favTeamAtteinte = (bloc && bloc.favAtteinte) || null;
        G._favTeamBoost = (bloc && bloc.favBoost) || null;
        appliquerBonusReputation();
      }
    });
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
      installLancement();
      enregistrerHook();
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
      etapes: ETAPES,
      ecurieCoeur: function () { var G = G_(); return G ? G._favTeam : null; },
      testerOffreCoeur: tenterOffreEcurieDeCoeur,
      testerArrivee: verifierArriveeEcurieDeCoeur
    };

    window._rj80Uninstall = function () {
      try {
        if (_origGoCreate) window.goCreate = _origGoCreate;
        if (_origUpdate) window.updateCreUI = _origUpdate;
        if (_origRecap) window.buildRecap = _origRecap;
        if (_origNext) window.creNext = _origNext;
        if (_origLaunch) window.launchGame = _origLaunch;
        if (window.WEEKLY_TICK_HOOKS) {
          for (var i = window.WEEKLY_TICK_HOOKS.length - 1; i >= 0; i--) {
            if (window.WEEKLY_TICK_HOOKS[i] && window.WEEKLY_TICK_HOOKS[i].id === "favoriteTeam") {
              window.WEEKLY_TICK_HOOKS.splice(i, 1);
            }
          }
        }
        ["S-mode", CSS_ID, "rj80-banner", "rj80-stepname", "rj80-recap", "rj80-fav"].forEach(function (id) {
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
