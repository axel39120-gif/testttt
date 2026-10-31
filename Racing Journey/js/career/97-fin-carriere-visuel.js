/* =====================================================================
 * 97-fin-carriere-visuel.js — L'ÉCRAN DE FIN DE CARRIÈRE MÉRITE MIEUX
 *
 * C'est le dernier écran d'une partie, celui qui referme parfois vingt
 * saisons de jeu. Il présentait un score, quatre chiffres et trois
 * sections dépliables sur fond uni — correct, mais sans relief.
 *
 * CE QUE CE MODULE APPORTE
 *   · un fond qui réagit au rang atteint : une carrière de Légende n'a pas
 *     la même lumière qu'une carrière d'Espoir ;
 *   · un score mis en scène, avec dégradé et halo ;
 *   · le rang porté par un bandeau à sa couleur, plutôt qu'une ligne de
 *     texte parmi d'autres ;
 *   · les quatre chiffres transformés en cartes, chacune à sa teinte ;
 *   · une frise du parcours : les catégories traversées, du karting au
 *     sommet atteint, qui raconte la trajectoire d'un coup d'œil ;
 *   · les titres en vitrine dorée plutôt qu'en pastilles grises ;
 *   · une entrée en scène progressive des blocs.
 *
 * Aucune donnée n'est ajoutée ni recalculée : tout vient de ce que l'écran
 * affiche déjà. On ne touche pas non plus à sa structure — les sections
 * dépliables, le détail par saison et les boutons restent en place.
 *
 * Réversible : window._rj97Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[97-fin-carriere]";
  var CSS_ID = "rj97-css";

  /* Chaque rang a sa lumière. L'ordre suit les seuils du module 74. */
  var RANGS = [
    { nom: "Légende",              teinte: "#F5C542", halo: "245,197,66" },
    { nom: "Champion d'exception", teinte: "#E879F9", halo: "232,121,249" },
    { nom: "Grand pilote",         teinte: "#F59E0B", halo: "245,158,11" },
    { nom: "Pilote confirmé",      teinte: "#34D399", halo: "52,211,153" },
    { nom: "Professionnel",        teinte: "#00D4FF", halo: "0,212,255" },
    { nom: "Espoir",               teinte: "#8B9DC3", halo: "139,157,195" },
    { nom: "Débutant",             teinte: "#8b93a7", halo: "139,147,167" }
  ];

  var ECHELLE = ["Karting Junior", "Karting Senior", "Formule 4",
                 "Formula Regional", "Formule 3", "Formule 2", "Formule 1"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function rangCourant() {
    var box = document.getElementById("rj74-ecran");
    var el = box && box.querySelector(".rj74-rang");
    var nom = el ? (el.textContent || "").trim() : "";
    for (var i = 0; i < RANGS.length; i++) if (RANGS[i].nom === nom) return RANGS[i];
    return RANGS[RANGS.length - 1];
  }

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* --- fond : halo teinté par le rang, et fines diagonales ---------- */
      /* Surtout ne pas toucher au position:fixed de l'écran : une règle
         « position:relative » l'avait fait glisser sous la page, invisible
         alors même qu'il était marqué ouvert. */
      ".rj74::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;" +
        "background:radial-gradient(circle at 50% -10%,rgba(var(--rj97-halo,255,24,1),.20),transparent 62%)}",
      ".rj74::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;" +
        "background:repeating-linear-gradient(115deg,transparent 0 22px,rgba(255,255,255,.014) 22px 44px)}",
      ".rj74 > *{position:relative;z-index:1}",

      /* --- bandeau du rang --------------------------------------------- */
      ".rj74-hero{position:relative;overflow:hidden;padding:30px 16px 26px !important;" +
        "border:1px solid rgba(var(--rj97-halo,255,24,1),.28) !important;" +
        "background:linear-gradient(168deg,rgba(var(--rj97-halo,255,24,1),.10) 0%," +
        "rgba(255,255,255,.02) 46%,transparent 100%) !important}",
      ".rj74-hero::before{content:'';position:absolute;top:-40%;left:50%;width:150%;height:120%;" +
        "transform:translateX(-50%);pointer-events:none;" +
        "background:radial-gradient(ellipse at center,rgba(var(--rj97-halo,255,24,1),.16),transparent 66%)}",
      ".rj74-hero > *{position:relative}",

      ".rj74-k{font-size:10px !important;letter-spacing:.24em !important;opacity:.7}",

      /* --- score ------------------------------------------------------- */
      ".rj74-pts{font-size:62px !important;line-height:1 !important;margin:12px 0 2px !important;" +
        "background:linear-gradient(180deg,#ffffff 26%,var(--rj97-teinte,#F59E0B) 100%);" +
        "-webkit-background-clip:text;background-clip:text;color:transparent !important;" +
        "-webkit-text-fill-color:transparent;filter:drop-shadow(0 3px 14px rgba(var(--rj97-halo,255,24,1),.35))}",
      ".rj74-ptsl{font-size:10px !important;letter-spacing:.22em !important;opacity:.62}",

      ".rj74-rang{display:inline-block;margin-top:15px !important;padding:6px 16px;border-radius:999px;" +
        "font-size:14px !important;letter-spacing:.06em;" +
        "color:var(--rj97-teinte,#F59E0B) !important;" +
        "background:rgba(var(--rj97-halo,255,24,1),.12);" +
        "border:1px solid rgba(var(--rj97-halo,255,24,1),.42)}",
      ".rj74-rangt{margin-top:10px !important;font-style:italic;opacity:.8;line-height:1.5}",
      ".rj74-nom{margin-top:14px !important;padding-top:13px;border-top:1px solid rgba(255,255,255,.07);" +
        "letter-spacing:.02em;opacity:.72}",

      /* --- chiffres en cartes ------------------------------------------ */
      ".rj74-stats{gap:8px !important}",
      ".rj74-st{position:relative;overflow:hidden;padding:14px 6px !important;border-radius:13px !important;" +
        "background:linear-gradient(170deg,rgba(255,255,255,.055),rgba(255,255,255,.015)) !important;" +
        "border:1px solid rgba(255,255,255,.09) !important}",
      ".rj74-st::after{content:'';position:absolute;left:14%;right:14%;top:0;height:2px;border-radius:0 0 3px 3px;" +
        "background:var(--rj97-accent,#8b93a7);opacity:.85}",
      ".rj74-st:nth-child(1){--rj97-accent:#F5C542}",
      ".rj74-st:nth-child(2){--rj97-accent:#F59E0B}",
      ".rj74-st:nth-child(3){--rj97-accent:#34D399}",
      ".rj74-st:nth-child(4){--rj97-accent:#00D4FF}",
      ".rj74-stv{font-size:26px !important;color:#fff !important}",
      ".rj74-stl{font-size:8.5px !important;letter-spacing:.14em !important;opacity:.68}",

      /* --- titres en vitrine -------------------------------------------- */
      ".rj74-pal{gap:7px !important;margin-top:12px !important}",
      ".rj74-badge{padding:7px 12px !important;border-radius:9px !important;" +
        "background:linear-gradient(150deg,rgba(245,197,66,.20),rgba(245,158,11,.07)) !important;" +
        "border:1px solid rgba(245,197,66,.42) !important;color:#F5C542 !important;" +
        "font-weight:800 !important;letter-spacing:.03em}",

      /* --- frise du parcours -------------------------------------------- */
      ".rj97-frise{margin:16px 0 4px;padding:15px 14px 13px;border-radius:14px;" +
        "background:linear-gradient(170deg,rgba(255,255,255,.045),rgba(255,255,255,.012));" +
        "border:1px solid rgba(255,255,255,.08)}",
      ".rj97-frise .tt{font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.18em;" +
        "text-transform:uppercase;color:var(--rj97-teinte,#F59E0B);margin-bottom:12px}",
      ".rj97-piste{position:relative;display:flex;align-items:center;justify-content:space-between}",
      ".rj97-piste::before{content:'';position:absolute;left:6px;right:6px;top:6px;height:2px;" +
        "background:rgba(255,255,255,.08);border-radius:2px}",
      ".rj97-piste .rj97-fait{position:absolute;left:6px;top:6px;height:2px;border-radius:2px;" +
        "background:linear-gradient(90deg,var(--rj97-teinte,#F59E0B),rgba(255,255,255,.25))}",
      ".rj97-et{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;flex:1}",
      ".rj97-pt{width:13px;height:13px;border-radius:50%;background:#15161c;" +
        "border:2px solid rgba(255,255,255,.16);z-index:1}",
      ".rj97-et.on .rj97-pt{background:var(--rj97-teinte,#F59E0B);border-color:var(--rj97-teinte,#F59E0B);" +
        "box-shadow:0 0 0 4px rgba(var(--rj97-halo,255,24,1),.16)}",
      ".rj97-et .rj97-lb{font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;" +
        "color:var(--text3,#6b7280);text-align:center;line-height:1.2}",
      ".rj97-et.on .rj97-lb{color:var(--soft,#aeb6c6);font-weight:700}",

      /* --- boutons ------------------------------------------------------ */
      ".rj74-btn{transition:transform .12s ease,filter .12s ease}",
      ".rj74-btn:active{transform:scale(.985);filter:brightness(1.08)}",

      /* --- entrée en scène ---------------------------------------------- */
      "@keyframes rj97-monte{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
      ".rj74.on .rj74-hero,.rj74.on .rj74-stats,.rj74.on .rj97-frise," +
      ".rj74.on .rj74-pal,.rj74.on .rj74-pl,.rj74.on #rj95-saisons,.rj74.on .rj74-btns{" +
        "animation:rj97-monte .42s ease both}",
      ".rj74.on .rj74-stats{animation-delay:.06s}",
      ".rj74.on .rj97-frise{animation-delay:.12s}",
      ".rj74.on .rj74-pal{animation-delay:.16s}",
      ".rj74.on .rj74-pl{animation-delay:.2s}",
      ".rj74.on #rj95-saisons{animation-delay:.24s}",
      ".rj74.on .rj74-btns{animation-delay:.28s}",
      "@media (prefers-reduced-motion:reduce){.rj74.on *{animation:none !important}}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------
   * Frise du parcours : les catégories traversées, dans l'ordre de
   * l'échelle. Elle se lit d'un coup d'œil, là où la liste des saisons
   * demande d'être dépliée.
   * ---------------------------------------------------------------- */
  function categoriesTraversees() {
    var vues = {};
    try {
      var h = window._rj95 ? window._rj95.historique() : [];
      h.forEach(function (s) { if (s && s.cat) vues[s.cat] = true; });
    } catch (e) {}
    /* Repli : la répartition par catégorie du calcul de score. */
    if (!Object.keys(vues).length) {
      try {
        var c = window._rj74Points ? window._rj74Points() : null;
        if (c && c.parCat) Object.keys(c.parCat).forEach(function (k) { if (c.parCat[k]) vues[k] = true; });
      } catch (e) {}
    }
    return vues;
  }

  function friseHTML() {
    var vues = categoriesTraversees();
    var atteintes = ECHELLE.filter(function (c) { return vues[c]; });
    if (atteintes.length < 2) return "";       // une frise d'une étape ne dit rien

    var dernier = -1;
    ECHELLE.forEach(function (c, i) { if (vues[c]) dernier = i; });
    var largeur = (dernier / (ECHELLE.length - 1)) * 100;

    var courts = {
      "Karting Junior": "KJ", "Karting Senior": "KS", "Formule 4": "F4",
      "Formula Regional": "FR", "Formule 3": "F3", "Formule 2": "F2", "Formule 1": "F1"
    };

    var h = '<div class="rj97-frise"><div class="tt">Parcours</div><div class="rj97-piste">' +
            '<span class="rj97-fait" style="width:calc(' + largeur.toFixed(1) + '% - 12px)"></span>';
    ECHELLE.forEach(function (cat) {
      h += '<span class="rj97-et' + (vues[cat] ? " on" : "") + '">' +
             '<span class="rj97-pt"></span>' +
             '<span class="rj97-lb">' + esc(courts[cat] || cat) + '</span>' +
           '</span>';
    });
    return h + "</div></div>";
  }

  /* ------------------------------------------------------------------
   * Habillage : teinte du rang et frise, posés à chaque affichage.
   * ---------------------------------------------------------------- */
  function habiller() {
    var box = document.getElementById("rj74-ecran");
    if (!box || !box.classList.contains("on")) return;
    injecterCSS();

    var r = rangCourant();
    box.style.setProperty("--rj97-teinte", r.teinte);
    box.style.setProperty("--rj97-halo", r.halo);

    if (!box.querySelector(".rj97-frise")) {
      var html = friseHTML();
      if (html) {
        var stats = box.querySelector(".rj74-stats");
        var support = document.createElement("div");
        support.innerHTML = html;
        var frise = support.firstChild;
        if (stats && stats.parentNode) stats.parentNode.insertBefore(frise, stats.nextSibling);
      }
    }
  }

  function boot() {
    injecterCSS();
    habiller();

    /* L'écran s'ouvre par plusieurs chemins : on surveille son apparition. */
    if (!window._rj97Observer) {
      try {
        var obs = new MutationObserver(function () {
          var box = document.getElementById("rj74-ecran");
          if (box && box.classList.contains("on")) setTimeout(habiller, 70);
        });
        obs.observe(document.body, {
          childList: true, subtree: true, attributes: true, attributeFilter: ["class"]
        });
        window._rj97Observer = obs;
      } catch (e) {}
    }

    console.log(TAG, "écran de fin de carrière habillé");

    window._rj97 = { habiller: habiller, frise: friseHTML, rang: rangCourant };
    window._rj97Uninstall = function () {
      if (window._rj97Observer) { window._rj97Observer.disconnect(); delete window._rj97Observer; }
      var f = document.querySelector(".rj97-frise"); if (f) f.remove();
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
