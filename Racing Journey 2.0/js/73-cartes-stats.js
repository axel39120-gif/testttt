/* =====================================================================
 * 73-cartes-stats.js — DESIGN UNIFIÉ DES CARTES DE STATISTIQUES (.mc)
 *
 * Les cartes chiffrées du jeu — Budget actuel, Revenus / mois, Bonheur,
 * Propriétés, Entretien / mois, et toutes celles construites sur le même
 * balisage — partagent la classe .mc dans la grille .mg. Elles portaient
 * un liseré rouge de 2 px sur le bord SUPÉRIEUR uniquement, plus une
 * bordure claire sur les trois autres côtés et un dégradé de fond.
 *
 * Trois défauts à ce traitement :
 *  1. le trait rouge horizontal en haut de chaque carte crée une ligne de
 *     rupture qui coupe la lecture, d'autant plus visible que les cartes
 *     sont larges et peu hautes ;
 *  2. le rouge est la couleur d'action du jeu (boutons, alertes). L'utiliser
 *     en décor permanent sur des cartes purement informatives dilue sa
 *     valeur de signal ;
 *  3. dégradé + bordure claire + liseré coloré font trois traitements
 *     concurrents sur un élément qui n'affiche qu'un libellé et un nombre.
 *
 * NOUVEAU TRAITEMENT — un seul et même design partout :
 *  · fond plat, sans dégradé ;
 *  · bordure fine et neutre sur les quatre côtés, coins plus arrondis ;
 *  · accent coloré déplacé sur le bord GAUCHE, en 3 px, dans le sens de
 *    lecture — c'est le marqueur déjà utilisé ailleurs dans le jeu, devant
 *    les titres de section de l'accueil ;
 *  · libellé plus lisible, valeur légèrement resserrée ;
 *  · la couleur de l'accent suit le sens de la donnée quand il est
 *    détectable : ambre pour une valeur négative (une dépense), cyan pour
 *    le reste. Une carte « Entretien -0 € » ne s'annonce donc plus de la
 *    même façon qu'un budget.
 *
 * MÉTHODE — feuille de styles injectée, aucune modification du HTML ni des
 * modules qui génèrent ces cartes. La détection du signe se fait au rendu,
 * sur le texte de .mc-v, via un observateur limité à l'écran actif.
 *
 * Réversible : window._rj73Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[73-cartes-stats]";
  var ID = "rj73-css";
  var CYAN = "#00D4FF";
  var AMBRE = "#F59E0B";

  function css() {
    if (document.getElementById(ID)) return;
    var st = document.createElement("style");
    st.id = ID;
    st.textContent = [
      /* --- Style repris À L'IDENTIQUE des cartes de l'onglet Activités →
         Entraînement (.rjf-card, module 38) :
             border-radius: 11px
             background: linear-gradient(180deg, var(--bg3), var(--bg2))
             border: 1px solid var(--border)
             padding: 12px 13px 13px 16px
         Dégradé vertical discret, bordure neutre sur les quatre côtés,
         aucun liseré coloré, et un retrait à gauche légèrement plus
         généreux qui donne son assise à la carte. --- */

      ".mg{gap:11px !important;padding:11px 14px 5px !important}",

      ".mc, .f1-metric{",
      "border-radius:11px !important;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2)) !important;",
      "border:1px solid var(--border) !important;",
      "padding:12px 13px 13px 16px !important;",
      "position:relative !important;overflow:hidden !important}",

      /* les variantes colorées de .f1-metric ne teintent plus le bord :
         elles n'ont plus lieu d'être dans un style sans accent */
      ".f1-metric-gold, .f1-metric-green, .f1-metric-blue{",
      "border-color:var(--border) !important}",

      /* libellé calé sur .rjf-kicker, valeur sur .rjf-name en plus grand */
      ".mc .mc-l{font-size:9.5px !important;font-weight:700 !important;",
      "letter-spacing:.2em !important;text-transform:uppercase !important;",
      "color:var(--muted) !important;margin:0 0 9px !important}",

      ".mc .mc-v{font-size:21px !important;font-weight:900 !important;",
      "letter-spacing:.02em !important;line-height:1.05 !important}",

      /* une dépense reste identifiable, par la couleur du nombre seul */
      ".mc.rj73-neg .mc-v, .f1-metric.rj73-neg .mc-v{color:" + AMBRE + " !important}"
    ].join("");
    document.head.appendChild(st);
  }

  // Une valeur négative se reconnaît au signe moins en tête, y compris sous
  // la forme « -0 € » que le jeu affiche pour une dépense nulle.
  var enEcriture = false;
  function marquer() {
    if (enEcriture) return;
    enEcriture = true;
    try {
      var cartes = document.querySelectorAll(".mc, .f1-metric");
      for (var i = 0; i < cartes.length; i++) {
        var v = cartes[i].querySelector(".mc-v, .f1-metric-val, .f1-metric-v");
        var t = v ? (v.textContent || "").trim() : "";
        var neg = /^[-−]/.test(t);
        if (neg) cartes[i].classList.add("rj73-neg");
        else cartes[i].classList.remove("rj73-neg");
      }
    } catch (e) {
    } finally {
      enEcriture = false;
    }
  }

  var minuteur = null, observer = null;
  function differer() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(marquer, 50);
  }

  function boot() {
    if (!document.head || !document.body) { setTimeout(boot, 60); return; }
    css();
    marquer();
    try {
      if (typeof MutationObserver === "function") {
        observer = new MutationObserver(differer);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    } catch (e) {}
    console.log(TAG + " actif — cartes chiffrées unifiées, accent latéral");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj73Marquer = marquer;
  window._rj73Uninstall = function () {
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    try { if (observer) observer.disconnect(); } catch (e) {}
    if (minuteur) clearTimeout(minuteur);
    var c = document.querySelectorAll(".rj73-neg");
    for (var i = 0; i < c.length; i++) c[i].classList.remove("rj73-neg");
    console.log(TAG + " désinstallé");
  };
})();
