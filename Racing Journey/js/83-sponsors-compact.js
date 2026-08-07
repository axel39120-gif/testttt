/* =====================================================================
 * 83-sponsors-compact.js — L'ÉCRAN SPONSORS TIENT ENFIN À L'ÉCRAN
 *
 * MESURE AVANT : 5108 px de contenu pour 831 px de fenêtre, soit SIX
 * hauteurs d'écran, dont 4850 px pour la seule liste des offres. Toutes
 * les familles étaient dépliées les unes sous les autres, chaque sponsor
 * occupant une carte complète (nom, description, badges, bouton).
 *
 * C'est un écran de DÉCISION, pas de consultation : on y compare des
 * cachets et des durées. Six écrans de défilement rendaient impossible de
 * mettre deux offres en regard.
 *
 * CE QUI CHANGE
 *   · une barre de familles (Équipement / Pilote / Écurie / Ambassadeur)
 *     avec le nombre d'offres accessibles dans chacune ;
 *   · une ligne par sponsor : nom, cachet, prime au podium, durée, et
 *     l'état (accessible ou verrouillé, avec la raison) ;
 *   · le détail et le bouton de signature se déplient au tap, un seul à
 *     la fois — on ne perd aucune information, on la met en réserve ;
 *   · les offres accessibles d'abord, les verrouillées ensuite, grisées.
 *
 * OPTION A — aucun fichier cœur modifié : renderSponsorsNew est
 * enveloppée, la signature passe toujours par signSponsorNew.
 *
 * Réversible : window._rj83Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[83-sponsors]";
  var CSS_ID = "rj83-css";

  var FAMILLES = [
    { id: "equipement",  label: "Équipement",  court: "Équip.", couleur: "#22D3EE",
      sub: "Matériel pilote, cachets modestes" },
    { id: "pilote",      label: "Sponsor pilote", court: "Pilote", couleur: "#34D399",
      sub: "Te suit personnellement, indépendant de l'écurie" },
    { id: "ecurie",      label: "Sponsor écurie", court: "Écurie", couleur: "#F59E0B",
      sub: "Lié à ton équipe actuelle, expire au changement" },
    { id: "ambassadeur", label: "Ambassadeur", court: "Ambass.", couleur: "#A855F7",
      sub: "Engagement long terme, prestige élevé" }
  ];

  var familleActive = "equipement";
  var deplie = null;                 // un seul détail ouvert à la fois

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function fn(n) { return typeof window[n] === "function"; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function euros(v) { return (v || 0).toLocaleString("fr-FR") + " €"; }

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      ".rj83-fams{display:flex;gap:6px;padding:10px 14px 4px;overflow-x:auto;-webkit-overflow-scrolling:touch}",
      ".rj83-fam{flex:0 0 auto;padding:7px 11px;border:1.5px solid var(--line);border-radius:8px;background:var(--bg3);" +
        "font-family:var(--font-display);font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;" +
        "color:var(--muted);cursor:pointer;white-space:nowrap;transition:border-color .15s,color .15s}",
      ".rj83-fam.on{color:#fff}",
      ".rj83-fam b{font-weight:800;margin-left:5px;opacity:.8}",
      ".rj83-sub{padding:4px 16px 8px;font-size:11px;color:var(--text3);line-height:1.4;font-family:var(--font-body)}",
      ".rj83-row{margin:0 14px 6px;border:1px solid var(--line);border-left-width:3px;border-radius:9px;" +
        "background:var(--bg2);overflow:hidden}",
      ".rj83-row.lock{opacity:.55}",
      ".rj83-head{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer}",
      ".rj83-nom{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--text);line-height:1.25;" +
        "font-family:var(--font-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".rj83-chiffres{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0}",
      ".rj83-fee{font-family:var(--font-display);font-size:13.5px;font-weight:900;color:var(--white);white-space:nowrap}",
      ".rj83-meta{font-size:10px;color:var(--text3);white-space:nowrap;margin-top:1px}",
      ".rj83-chev{flex-shrink:0;color:var(--muted);font-size:15px;transition:transform .18s}",
      ".rj83-row.open .rj83-chev{transform:rotate(90deg)}",
      ".rj83-detail{padding:0 12px 11px;border-top:1px solid var(--line)}",
      ".rj83-desc{font-size:12.5px;color:var(--soft);line-height:1.5;margin:9px 0 8px;font-family:var(--font-body)}",
      ".rj83-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}",
      ".rj83-go{width:100%;padding:10px;border:none;border-radius:8px;color:#fff;" +
        "font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}",
      ".rj83-lock{padding:9px;text-align:center;font-size:11px;color:var(--muted);border:1px dashed var(--line2);border-radius:8px}",
      ".rj83-vide{margin:14px 16px;padding:18px 14px;border:1px dashed var(--line2);background:var(--bg3);" +
        "text-align:center;font-size:12px;color:var(--muted);border-radius:8px}"
    ].join("");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------
   * Données
   * ---------------------------------------------------------------- */
  function offres() {
    var G = G_();
    if (!G || !fn("getSponsorPool")) return [];
    var pool = window.getSponsorPool() || [];
    var signes = (G.sponsors || []).map(function (s) { return s.id; });
    return pool.filter(function (s) { return signes.indexOf(s.id) < 0; });
  }

  function accessible(s) {
    var G = G_(); if (!G) return false;
    if ((G.reputation || 0) < (s.repReq || 0)) return false;
    if ((s.sponsorKind || "pilote") === "ecurie" &&
        (!G.currentTeam || G.currentTeam === "Indépendant")) return false;
    return true;
  }

  function raisonBlocage(s) {
    var G = G_(); if (!G) return "Indisponible";
    if ((G.reputation || 0) < (s.repReq || 0)) {
      return "Réputation " + (s.repReq || 0) + " requise (tu as " + Math.round(G.reputation || 0) + ")";
    }
    if ((s.sponsorKind || "pilote") === "ecurie" &&
        (!G.currentTeam || G.currentTeam === "Indépendant")) return "Réservé aux pilotes en écurie";
    return "Indisponible";
  }

  function parFamille() {
    var g = {};
    FAMILLES.forEach(function (f) { g[f.id] = []; });
    offres().forEach(function (s) {
      var k = s.sponsorKind || "pilote";
      if (!g[k]) g[k] = [];
      g[k].push(s);
    });
    return g;
  }

  /* ------------------------------------------------------------------
   * Rendu
   * ---------------------------------------------------------------- */
  function rendre() {
    var liste = document.getElementById("sp-list");
    if (!liste) return;
    injecterCSS();

    var groupes = parFamille();

    /* Si la famille active est vide, on bascule sur la première qui ne l'est pas. */
    if (!(groupes[familleActive] || []).length) {
      for (var i = 0; i < FAMILLES.length; i++) {
        if ((groupes[FAMILLES[i].id] || []).length) { familleActive = FAMILLES[i].id; break; }
      }
    }

    var h = '<div class="rj83-fams">';
    FAMILLES.forEach(function (f) {
      var lot = groupes[f.id] || [];
      if (!lot.length) return;
      var libres = lot.filter(accessible).length;
      var on = (f.id === familleActive);
      h += '<button class="rj83-fam' + (on ? " on" : "") + '" data-fam="' + f.id + '"' +
           (on ? ' style="border-color:' + f.couleur + ';background:' + f.couleur + '1a;color:' + f.couleur + '"' : '') +
           '>' + esc(f.court) + '<b>' + libres + '/' + lot.length + '</b></button>';
    });
    h += '</div>';

    var meta = FAMILLES.filter(function (f) { return f.id === familleActive; })[0] || FAMILLES[0];
    h += '<div class="rj83-sub">' + esc(meta.sub) + '</div>';

    var lot = (groupes[familleActive] || []).slice();
    if (!lot.length) {
      h += '<div class="rj83-vide">Aucune offre disponible pour le moment.</div>';
      liste.innerHTML = h;
      return;
    }

    /* Accessibles d'abord, puis par cachet décroissant. */
    lot.sort(function (a, b) {
      var da = accessible(a) ? 0 : 1, db = accessible(b) ? 0 : 1;
      if (da !== db) return da - db;
      return (b.fee || 0) - (a.fee || 0);
    });

    lot.forEach(function (s) {
      var ok = accessible(s);
      var ouvert = (deplie === s.id);
      h += '<div class="rj83-row' + (ok ? "" : " lock") + (ouvert ? " open" : "") +
           '" data-sp="' + esc(s.id) + '" style="border-left-color:' + (ok ? meta.couleur : "var(--muted)") + '">';
      h += '<div class="rj83-head">' +
             '<div class="rj83-nom">' + esc(s.name) + '</div>' +
             '<div class="rj83-chiffres">' +
               '<div class="rj83-fee">' + euros(s.fee) + '</div>' +
               '<div class="rj83-meta">' + (s.dur || 1) + ' an' + ((s.dur || 1) > 1 ? 's' : '') +
                 ' · +' + euros(s.perfBonus) + '/podium</div>' +
             '</div>' +
             '<div class="rj83-chev">\u203A</div>' +
           '</div>';

      if (ouvert) {
        h += '<div class="rj83-detail">';
        h += '<div class="rj83-desc">' + esc(s.desc || "") + '</div>';
        h += '<div class="rj83-tags">' +
               '<span class="badge b-gray">' + (s.dur || 1) + ' an' + ((s.dur || 1) > 1 ? 's' : '') + '</span>' +
               '<span class="badge b-amber">+' + euros(s.perfBonus) + ' / podium</span>' +
               (s.repReq ? '<span class="badge b-gray">Réputation ' + s.repReq + '</span>' : '') +
             '</div>';
        if (ok) {
          h += '<button class="rj83-go" data-sign="' + esc(s.id) + '" style="background:' + meta.couleur + '">' +
               'Signer pour ' + euros(s.fee) + '</button>';
        } else {
          h += '<div class="rj83-lock">' + esc(raisonBlocage(s)) + '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    });

    liste.innerHTML = h;
    brancher(liste);
  }

  function brancher(liste) {
    if (liste._rj83) return;
    liste.addEventListener("click", function (ev) {
      var t = ev.target;
      var sign = t.closest ? t.closest("[data-sign]") : null;
      if (sign) {
        var id = sign.getAttribute("data-sign");
        deplie = null;
        if (fn("signSponsorNew")) window.signSponsorNew(id);
        else rendre();
        return;
      }
      var fam = t.closest ? t.closest("[data-fam]") : null;
      if (fam) { familleActive = fam.getAttribute("data-fam"); deplie = null; rendre(); return; }
      var row = t.closest ? t.closest("[data-sp]") : null;
      if (row) {
        var sp = row.getAttribute("data-sp");
        deplie = (deplie === sp) ? null : sp;
        rendre();
      }
    });
    liste._rj83 = true;
  }

  /* ------------------------------------------------------------------
   * Installation
   * ---------------------------------------------------------------- */
  var _orig = null;

  function installer() {
    if (!fn("renderSponsorsNew") || window.renderSponsorsNew._rj83) return !!(window.renderSponsorsNew && window.renderSponsorsNew._rj83);
    _orig = window.renderSponsorsNew;
    window.renderSponsorsNew = function () {
      /* Le verrouillage d'avant-première course (module 07) remplace la
         liste par son propre message : on le laisse faire. */
      try {
        var G = G_();
        if (!G || !G.races || !G.races.length) return _orig.apply(this, arguments);
      } catch (e) {}
      try { rendre(); } catch (e) {
        console.warn(TAG, "rendu compact :", e && e.message);
        return _orig.apply(this, arguments);
      }
    };
    window.renderSponsorsNew._rj83 = true;
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) { console.log(TAG, "actif — offres par famille, détail au tap"); return; }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj83 = { rendre: rendre, famille: function (f) { if (f) { familleActive = f; rendre(); } return familleActive; } };
    window._rj83Uninstall = function () {
      if (_orig) window.renderSponsorsNew = _orig;
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      if (fn("renderSponsorsNew")) window.renderSponsorsNew();
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
