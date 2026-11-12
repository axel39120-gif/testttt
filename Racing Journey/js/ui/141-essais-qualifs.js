/* =====================================================================
 * 141-essais-qualifs.js — ESSAIS ET QUALIFS SUR UN ÉCRAN, SANS DÉFILER
 *
 * POURQUOI
 * Sur un téléphone à l'horizontale, les onglets Essais et Qualif
 * défilaient de 500 px : la feuille de temps listait les vingt pilotes en
 * grandes lignes, le statut de la séance (« Qualifié Q2 — actuellement P7 »)
 * se retrouvait sous la liste, hors de l'écran, et le bouton « Rentrer au
 * stand » des essais tout en bas.
 *
 * CE QUE FAIT LE MODULE
 *   - Feuilles de temps (essais et qualifs) : les cinq premiers, puis le
 *     joueur et ses deux voisins ; un bouton « Classement complet » ouvre
 *     les vingt pilotes en deux colonnes, sans défilement.
 *   - Le statut des qualifs remonte dans la colonne de gauche.
 *   - Les blocs de gauche (en-tête de séance, pneus, chrono, relais) sont
 *     resserrés (css/seances.css).
 * Les tableaux sont redessinés en direct par le cœur : on réapplique après
 * chaque redessin (MutationObserver).
 *
 * Aucun état. Réversible : window._rj141Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[141-essais-qualifs]";
  var TABLEAUX = ["quali-timing-board", "fpl-board-body"];
  var TETE = 3;
  var obs = [];

  function $(id) { return document.getElementById(id); }
  function nomJoueur() {
    var p = (typeof G !== "undefined" && G && G.pilot) || {};
    return ((p.prenom || "") + " " + (p.nom || "")).trim();
  }
  /* Les lignes de pilotes d'un tableau : elles commencent par la position. */
  function lignes(tab) {
    return [].slice.call(tab.children).filter(function (l) {
      return l.classList && !l.classList.contains("rj141-plus") && /^\s*\d+/.test(l.textContent || "");
    });
  }
  /* Le reste (séparateur de la zone d'élimination…), hors en-tête et bouton. */
  function autres(tab) {
    return [].slice.call(tab.children).filter(function (l) {
      return l.classList && !l.classList.contains("rj141-plus") && !/^\s*\d+/.test(l.textContent || "") && !/^\s*pos/i.test(l.textContent || "");   // « PosPilote… » : l'en-tête reste
    });
  }

  function resserrer(tab) {
    var L = lignes(tab); if (L.length <= TETE + 3) return;
    var nom = nomJoueur(), moi = -1;
    for (var i = 0; i < L.length; i++) if (nom && L[i].textContent.indexOf(nom) >= 0) { moi = i; break; }
    var tete = moi >= 0 && moi < 4 ? 4 : TETE;   // joueur devant : les quatre premiers tiennent
    L.forEach(function (l, i) {
      var garde = i < tete || (moi >= 0 && Math.abs(i - moi) <= 1);
      l.classList.toggle("rj141-cache", !garde);
      l.classList.toggle("rj141-saut", garde && i > 0 && L[i - 1].classList.contains("rj141-cache"));
      l.classList.toggle("rj141-moi", i === moi);
    });
    autres(tab).forEach(function (l) { l.classList.add("rj141-cache"); });   // la liste complète les montre
    var plus = tab.querySelector(":scope > .rj141-plus");
    if (!plus) {
      plus = document.createElement("button");
      plus.type = "button"; plus.className = "rj141-plus";
      tab.appendChild(plus);
    } else if (plus !== tab.lastElementChild) tab.appendChild(plus);
    var libelle = "Classement complet (" + L.length + ") ›";
    if (plus.textContent !== libelle) plus.textContent = libelle;   // réécrire sans changement relancerait l'observateur sans fin
    var ouverte = $("rj141-modale");
    if (ouverte && ouverte._tab === tab) remplirModale(tab);   // la feuille des essais, cachée mais vivante, écrasait celle des qualifs
  }

  /* Les vingt pilotes en deux colonnes de dix, dans une fenêtre, lus dans les
     données de la séance. (Avant : une copie des lignes de la feuille, dont les
     temps restaient vides en essais et qui ne suivait pas la séance.) */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function chrono(t) {
    if (typeof t !== "number" || !isFinite(t)) return "—";
    if (typeof formatQualiTime === "function") return formatQualiTime(t);
    var m = Math.floor(t / 60), s = t - m * 60;
    return m ? m + ":" + (s < 10 ? "0" : "") + s.toFixed(3) : s.toFixed(3);
  }
  function donnees(tab) {
    if (tab.id === "quali-timing-board" && window.QUALI_STATE && QUALI_STATE.drivers) {
      var D = QUALI_STATE.drivers, ids = QUALI_STATE.survived || D.map(function (d, i) { return i; });
      var coupe = typeof getQualiCutoff === "function" ? getQualiCutoff(QUALI_STATE.session) : 99;
      var elim = QUALI_STATE.session === 1 || QUALI_STATE.session === 2;
      return ids.map(function (i) { return D[i]; }).filter(Boolean).sort(function (a, b) {
        return (a.bestTime == null) - (b.bestTime == null) || (a.bestTime || 0) - (b.bestTime || 0);
      }).map(function (d, k) {
        return { nom: d.isPlayer ? nomJoueur() : d.name, equipe: d.team, temps: d.bestTime, moi: !!d.isPlayer, elimine: elim && k + 1 > coupe };
      });
    }
    if (tab.id === "fpl-board-body" && typeof window._rjEssaisClassement === "function") {
      return (window._rjEssaisClassement() || []).map(function (r) { return { nom: r.name, equipe: r.team, temps: r.time, moi: !!r.isPlayer }; });
    }
    return null;
  }
  function remplirModale(tab) {
    var m = $("rj141-modale"); if (!m) return;
    var R = donnees(tab);
    if (!R) return;
    var tete = null;
    R.forEach(function (r) { if (typeof r.temps === "number" && (tete == null || r.temps < tete)) tete = r.temps; });
    var moitie = Math.ceil(R.length / 2);
    var ligne = function (r, k) {
      var ecart = typeof r.temps !== "number" || r.temps === tete ? "" : "+" + (r.temps - tete).toFixed(3);
      return '<div class="rj141-ligne' + (r.moi ? " rj141-moi" : "") + (r.elimine ? " rj141-elim" : "") + '">' +
        '<span class="rj141-p">' + (k + 1) + '</span><span class="rj141-n">' + esc(r.nom) +
        (r.equipe ? "<em>" + esc(r.equipe) + "</em>" : "") + '</span><span class="rj141-t">' + chrono(r.temps) +
        '</span><span class="rj141-e">' + ecart + "</span></div>";
    };
    var col = function (a, b) { return '<div class="rj141-col">' + R.slice(a, b).map(function (r, i) { return ligne(r, a + i); }).join("") + "</div>"; };
    var html = col(0, moitie) + col(moitie, R.length);
    var g = m.querySelector(".rj141-grille");
    if (g.innerHTML !== html) g.innerHTML = html;
  }
  function ouvrirModale(tab) {
    fermerModale();
    var m = document.createElement("div");
    m.id = "rj141-modale";
    m.setAttribute("data-rj-noround", "1");   // l'arrondi global (04q) effaçait les millièmes : « 50.086 » devenait « 50 »
    m.innerHTML = '<div class="rj141-feuille"><div class="rj141-titre"><span>Classement complet</span>' +
      '<button type="button" class="rj141-fermer" aria-label="Fermer">×</button></div><div class="rj141-grille"></div></div>';
    document.body.appendChild(m);
    m._tab = tab;
    remplirModale(tab);
    // la séance continue pendant que la fenêtre est ouverte
    m._minuteur = setInterval(function () { if (!document.body.contains(m)) return clearInterval(m._minuteur); remplirModale(tab); }, 500);
    m.addEventListener("click", function (e) { if (e.target === m || (e.target.closest && e.target.closest(".rj141-fermer"))) fermerModale(); });
  }
  function fermerModale() { var m = $("rj141-modale"); if (m) { clearInterval(m._minuteur); m.remove(); } }

  /* Le statut des qualifs, sous la liste et donc hors de l'écran, passe à gauche. */
  function statut() {
    var s = $("quali-status"), h = $("quali-session-header");
    if (s && h && s.previousElementSibling !== h) h.parentNode.insertBefore(s, h.nextSibling);
  }

  function appliquer() {
    try {
      TABLEAUX.forEach(function (id) {
        var t = $(id); if (!t) return;
        resserrer(t);
        if (!t._rj141) {
          t._rj141 = true;
          /* Appliqué avant l'affichage (les observateurs passent avant le rendu) :
             attendre l'image suivante laissait voir les vingt lignes à chaque redessin. */
          var o = new MutationObserver(function () { try { resserrer(t); } catch (e) {} });
          o.observe(t, { childList: true });
          obs.push(o);
        }
      });
      statut();
    } catch (e) { console.warn(TAG, e && e.message); }
  }

  function surClic(e) {
    var b = e.target && e.target.closest && e.target.closest(".rj141-plus");
    if (b) { e.preventDefault(); ouvrirModale(b.parentNode); }
  }

  /* Les tableaux naissent avec la séance : on regarde l'écran de course. */
  var obsEcran = null;
  function installer() {
    var course = $("S-race"); if (!course || typeof MutationObserver !== "function") return false;
    obsEcran = new MutationObserver(function () { appliquer(); });
    obsEcran.observe(course, { childList: true, subtree: true });
    document.addEventListener("click", surClic, true);
    appliquer();
    return true;
  }

  window._rj141 = { appliquer: appliquer, ouvrir: ouvrirModale, fermer: fermerModale };
  window._rj141Uninstall = function () {
    if (obsEcran) obsEcran.disconnect();
    obs.forEach(function (o) { o.disconnect(); }); obs = [];
    document.removeEventListener("click", surClic, true);
    fermerModale();
    document.querySelectorAll(".rj141-plus").forEach(function (b) { b.remove(); });
    document.querySelectorAll(".rj141-cache").forEach(function (l) { l.classList.remove("rj141-cache"); });
    delete window._rj141;
  };

  var essais = 0;
  (function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120);
  })();
})();
