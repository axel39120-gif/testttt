/* =====================================================================
 * 93-paddock-dans-evenements.js — UN SEUL ENDROIT POUR LES DÉCISIONS
 *
 * CE QU'IL Y AVAIT
 * Les arcs narratifs disposaient de leur propre espace, « Vie de paddock »,
 * qui s'ouvrait après une course par un mail ou par une carte posée sur
 * l'accueil. À côté, l'onglet « Événements » de Réseaux affichait déjà des
 * situations à trancher, du même genre et avec la même mécanique de choix.
 *
 * Deux endroits pour la même chose, dont un qui s'imposait au joueur au
 * sortir d'une course.
 *
 * CE QUE FAIT CE MODULE
 *   · les décisions en attente sont injectées en tête de l'onglet
 *     « Événements » de Réseaux, avec leurs choix et leurs effets ;
 *   · l'espace « Vie de paddock » n'est plus accessible : sa carte
 *     d'accueil disparaît, et le mail qui y menait renvoie sur l'onglet ;
 *   · l'écran lui-même reste en place mais inatteignable — le module 32
 *     continue de faire vivre les arcs, seule leur présentation change.
 *
 * Rien n'est perdu : ce sont les mêmes situations, les mêmes choix et les
 * mêmes conséquences, à un endroit unique.
 *
 * Réversible : window._rj93Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[93-paddock]";
  var CSS_ID = "rj93-css";

  function api() { return window._rj32 || null; }

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#rj93-arcs{margin-bottom:10px}",
      "#rj93-arcs .rj93-tete{display:flex;align-items:center;gap:7px;margin:0 0 8px;" +
        "font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.14em;" +
        "text-transform:uppercase;color:var(--red3,#FF1801)}",
      "#rj93-arcs .rj93-tete .pt{width:6px;height:6px;border-radius:50%;background:var(--red3,#FF1801)}",
      /* Les cartes d'arc viennent du module 32 avec leurs propres classes ;
         on les habille pour qu'elles se fondent dans l'onglet. */
      "#rj93-arcs .rjsa-arc{background:var(--bg2);border:1px solid var(--border-hi);" +
        "border-left:3px solid var(--red3,#FF1801);border-radius:12px;padding:13px 14px;margin-bottom:9px}",
      "#rj93-arcs .rjsa-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}",
      "#rj93-arcs .rjsa-tag{font-family:var(--font-display);font-size:9px;font-weight:800;" +
        "letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:3px;" +
        "background:rgba(255,255,255,.06);color:var(--muted)}",
      "#rj93-arcs .rjsa-prog{margin-left:auto;font-size:10px;color:var(--text3)}",
      "#rj93-arcs h3{font-family:var(--font-display);font-size:15px;font-weight:900;" +
        "color:var(--white);margin:0 0 2px}",
      "#rj93-arcs .rjsa-who{font-size:11px;color:var(--muted);margin-bottom:7px}",
      "#rj93-arcs .rjsa-body{font-size:12.5px;color:var(--soft);line-height:1.5;margin-bottom:7px}",
      "#rj93-arcs .rjsa-prompt{font-size:12.5px;color:var(--text);font-weight:600;margin-bottom:9px}",
      "#rj93-arcs .rjsa-choices{display:flex;flex-direction:column;gap:6px}",
      "#rj93-arcs .rjsa-choice{display:block;width:100%;text-align:left;padding:10px 12px;" +
        "background:var(--bg3);border:1px solid var(--line);border-radius:9px;cursor:pointer;font-family:inherit}",
      "#rj93-arcs .rjsa-choice.primary{border-color:var(--red3,#FF1801)}",
      "#rj93-arcs .rjsa-choice .cl{display:block;font-size:12.5px;font-weight:700;color:var(--text)}",
      "#rj93-arcs .rjsa-choice .cd{display:block;font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------
   * Injection dans l'onglet Événements
   * ---------------------------------------------------------------- */
  function injecter() {
    var a = api();
    var hote = document.getElementById("evt-media-list");
    if (!a || !hote) return;

    var enAttente = [];
    try { enAttente = a.enAttente() || []; } catch (e) { return; }

    var bloc = document.getElementById("rj93-arcs");
    if (!enAttente.length) { if (bloc) bloc.remove(); return; }

    injecterCSS();
    if (!bloc) {
      bloc = document.createElement("div");
      bloc.id = "rj93-arcs";
      hote.parentNode.insertBefore(bloc, hote);
      bloc.addEventListener("click", function (ev) {
        var btn = ev.target.closest ? ev.target.closest(".rjsa-choice") : null;
        if (!btn) return;
        var arc = btn.getAttribute("data-arc");
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        try { api().choisir(arc, idx); } catch (e) { console.warn(TAG, "choix :", e && e.message); }
        setTimeout(injecter, 60);
      });
    } else if (bloc.parentNode !== hote.parentNode) {
      hote.parentNode.insertBefore(bloc, hote);
    }

    var html = '<div class="rj93-tete"><span class="pt"></span>' +
               (enAttente.length > 1 ? enAttente.length + " décisions t\u2019attendent" : "Une décision t\u2019attend") +
               '</div>';
    enAttente.forEach(function (inst) {
      try { html += a.carteHTML(inst); } catch (e) {}
    });
    bloc.innerHTML = html;
  }

  /* ------------------------------------------------------------------
   * Fermeture de l'ancien espace
   * ---------------------------------------------------------------- */
  function fermerAncienEspace() {
    /* La carte posée sur l'accueil n'a plus de destination. */
    var carte = document.getElementById("rjsa-homecard");
    if (carte) carte.remove();

    /* Toute navigation vers l'espace est redirigée vers l'onglet. */
    if (typeof window.navTo === "function" && !window.navTo._rj93) {
      var orig = window.navTo;
      window.navTo = function (id) {
        if (id === "S-arcs") {
          var r = orig.call(this, "S-media", "ni-media");
          try {
            /* L'onglet s'appelle « evenements » côté code. */
            if (typeof window.mtab === "function") window.mtab("evenements");
          } catch (e) {}
          setTimeout(injecter, 120);
          return r;
        }
        return orig.apply(this, arguments);
      };
      window.navTo._rj93 = true;
      _origNav = orig;
    }
  }

  var _origNav = null;

  function boot() {
    var essais = 0;
    (function tenter() {
      if (api()) {
        fermerAncienEspace();

        /* L'onglet Événements est reconstruit à chaque affichage : on
           réinjecte après chaque rendu de l'écran Réseaux. */
        if (Array.isArray(window.RJ_SCREEN_HOOKS) &&
            !window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "93-paddock"; })) {
          window.RJ_SCREEN_HOOKS.push({
            id: "93-paddock",
            ecran: "S-media",
            apres: function () { setTimeout(injecter, 80); }
          });
          /* Le module d'arcs repose sa carte d'accueil à chaque retour sur
             l'accueil : on la retire aussi souvent, puisqu'elle mène à un
             espace devenu inaccessible. */
          window.RJ_SCREEN_HOOKS.push({
            id: "93-paddock-accueil",
            ecran: "S-home",
            apres: function () {
              setTimeout(function () {
                var c = document.getElementById("rjsa-homecard");
                if (c) c.remove();
              }, 60);
            }
          });
        }
        if (typeof window.renderRepEvents === "function" && !window.renderRepEvents._rj93) {
          var origRender = window.renderRepEvents;
          window.renderRepEvents = function () {
            var r = origRender.apply(this, arguments);
            try { injecter(); } catch (e) {}
            return r;
          };
          window.renderRepEvents._rj93 = true;
          _origRender = origRender;
        }
        console.log(TAG, "décisions regroupées dans l'onglet Événements");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj93 = { injecter: injecter };
    window._rj93Uninstall = function () {
      if (_origNav) window.navTo = _origNav;
      if (_origRender) window.renderRepEvents = _origRender;
      var b = document.getElementById("rj93-arcs"); if (b) b.remove();
      var css = document.getElementById(CSS_ID); if (css) css.remove();
      console.log(TAG, "désinstallé");
    };
  }

  var _origRender = null;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
