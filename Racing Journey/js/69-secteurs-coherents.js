/* =====================================================================
 * 69-secteurs-coherents.js — COHÉRENCE DES SECTEURS (qualif + essais)
 *
 * SYMPTÔME : trois secteurs violets, mais pas le meilleur temps.
 * C'est arithmétiquement impossible dans un système cohérent : comme
 * splitLapIntoSectors renormalise (la somme des trois secteurs vaut
 * exactement le temps au tour), battre les trois meilleurs secteurs de la
 * session implique d'avoir battu tous les tours de la session.
 *
 * Deux causes distinctes, sans rapport l'une avec l'autre.
 *
 * ── A. QUALIFICATION : les secteurs décrivent un tour qui n'a pas eu lieu
 *
 * Dans runQualiSession (04-race-engine), l'ordre est :
 *     if(!_willUseSeq){ o.bestTime = ...; o.lastTime = l; }   // rivaux
 *     var d = splitLapIntoSectors(l, circuit, .016);          // TOUJOURS sur l
 *     ... attribution des violets, mise à jour de QUALI_STATE.bestSectors
 *
 * Le découpage est calculé à partir de `l`, le temps AVANT la séquence de
 * tour chaud. Ensuite seulement, et uniquement pour le joueur,
 * _qualiHotLapSequence applique ses deltas :
 *     finalTime = Math.max(lapTime*0.92, lapTime + totalDelta)
 * Sur les seize deltas de la séquence (sortie des stands, trafic, mise en
 * température, tour de lancement), onze sont strictement positifs. Le
 * temps enregistré est donc presque toujours plus lent que celui qui a
 * servi à colorer les secteurs. Les rivaux, eux, ne passent jamais par la
 * séquence : le décalage ne touche que le joueur.
 *
 * CORRECTIF : on photographie l'état des meilleurs secteurs juste avant le
 * découpage optimiste, puis, à la fin de la séquence, on restaure cette
 * photo et on refait le découpage et l'attribution des drapeaux à partir
 * de finalTime. L'algorithme de comparaison d'origine est reproduit à
 * l'identique — il était juste, c'est son entrée qui ne l'était pas.
 *
 * ── B. ESSAIS LIBRES : les couleurs sont tirées au sort
 *
 * Dans 03-data-agent, dupliqué dans 30-essais-consolidated :
 *     function _pickSecCol(){ var e = Math.random()*h;
 *       return e<f ? VIOLET : e<f+m ? VERT : JAUNE; }
 * Les couleurs sont tirées aléatoirement, pondérées par la qualité du
 * réglage, sans jamais consulter un temps. Et les temps affichés sont des
 * fractions figées du tour (32 % / 36 % / le reste). Aucun lien entre
 * l'affichage et le chronomètre, dans les deux sens : trois violets sur un
 * tour lent, ou un record personnel tout en jaune.
 *
 * CORRECTIF : après chaque rendu de la section, les trois secteurs sont
 * recalculés pour TOUS les tests de la session, avec le vrai découpage du
 * circuit et un tirage déterministe par test (FNV + Mulberry32, semé sur
 * le temps et l'indice) — les valeurs ne bougent donc pas d'un rendu à
 * l'autre. Les couleurs découlent de la comparaison :
 *     VIOLET = meilleur secteur de la session
 *     VERT   = mieux que le test précédent, sans battre le record
 *     JAUNE  = ni l'un ni l'autre
 * En essais, le joueur est seul en piste : « meilleur de la session » et
 * « record personnel » sont la même chose, d'où cette convention à trois
 * niveaux plutôt que celle de la qualification.
 *
 * L'influence du réglage n'est pas perdue : elle continue d'agir là où
 * elle a du sens, sur la performance du tour, pas sur la couleur.
 *
 * Aucun fichier cœur modifié : 03 et 04 sont interceptés, pas édités.
 * Réversible : window._rj69Uninstall(). Diagnostic : window._rj69Status().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[69-secteurs-coherents]";
  var VIOLET = "#A78BFA", VERT = "#22D3EE", JAUNE = "#F59E0B";

  var etat = {
    installe: false,
    qualifCorrigees: 0,
    essaisCorriges: 0,
    dernierRecalcul: null,
    erreur: null
  };
  window._rj69Status = function () { return etat; };

  var origSplit = null, origSeq = null, observer = null, minuteur = null;
  var enEcriture = false;

  /* ------------------------------------------------------- utilitaires --- */
  function fnv(t) {
    var h = 2166136261;
    t = String(t);
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ratios(circuit) {
    try {
      if (typeof getCircuitSectorRatios === "function") {
        var r = getCircuitSectorRatios(circuit);
        if (r && r.length === 3) return r;
      }
    } catch (e) {}
    return [0.33, 0.35, 0.32];
  }

  // Même principe que splitLapIntoSectors, mais semé : deux appels pour le
  // même tour donnent le même découpage. La somme est renormalisée, donc
  // trois violets impliquent toujours le meilleur temps.
  function decouperSeme(lap, circuit, graine, ampleur) {
    var n = ratios(circuit);
    var rnd = mulberry(fnv(graine + "|" + lap.toFixed(3)));
    var r = (typeof ampleur === "number") ? ampleur : 0.012;
    var a = 2 * (rnd() - 0.5) * r;
    var i = 2 * (rnd() - 0.5) * r;
    var o = -0.5 * (a + i);
    var s1 = lap * n[0] * (1 + a);
    var s2 = lap * n[1] * (1 + i);
    var s3 = lap * n[2] * (1 + o);
    var p = lap / (s1 + s2 + s3);
    return [s1 * p, s2 * p, s3 * p];
  }

  /* ================================================================== */
  /* A. QUALIFICATION                                                    */
  /* ================================================================== */

  var photo = null;   // état des meilleurs secteurs avant le découpage optimiste

  function prendrePhoto() {
    if (typeof QUALI_STATE === "undefined" || !QUALI_STATE) return null;
    var d = QUALI_STATE.drivers || [];
    var pilotes = [];
    for (var i = 0; i < d.length; i++) {
      var o = d[i] || {};
      pilotes.push({
        bestSectors: o.bestSectors ? o.bestSectors.slice() : null,
        lastSectorFlags: o.lastSectorFlags ? o.lastSectorFlags.slice() : null,
        lastSectors: o.lastSectors ? o.lastSectors.slice() : null
      });
    }
    return {
      best: QUALI_STATE.bestSectors ? QUALI_STATE.bestSectors.slice() : null,
      holder: QUALI_STATE.bestSectorsHolder ? QUALI_STATE.bestSectorsHolder.slice() : null,
      pilotes: pilotes
    };
  }

  function restaurerPhoto(ph) {
    if (!ph || typeof QUALI_STATE === "undefined" || !QUALI_STATE) return false;
    QUALI_STATE.bestSectors = ph.best ? ph.best.slice() : [null, null, null];
    QUALI_STATE.bestSectorsHolder = ph.holder ? ph.holder.slice() : [null, null, null];
    var d = QUALI_STATE.drivers || [];
    for (var i = 0; i < d.length && i < ph.pilotes.length; i++) {
      var o = d[i]; if (!o) continue;
      var p = ph.pilotes[i];
      o.bestSectors = p.bestSectors ? p.bestSectors.slice() : null;
      o.lastSectorFlags = p.lastSectorFlags ? p.lastSectorFlags.slice() : null;
      o.lastSectors = p.lastSectors ? p.lastSectors.slice() : null;
    }
    return true;
  }

  function indexJoueur() {
    try {
      var d = QUALI_STATE.drivers || [];
      for (var i = 0; i < d.length; i++) if (d[i] && d[i].isPlayer) return i;
    } catch (e) {}
    return -1;
  }

  // Reproduction fidèle de l'algorithme d'origine, appliqué au bon temps.
  function reattribuer(finalTime) {
    if (typeof QUALI_STATE === "undefined" || !QUALI_STATE) return false;
    var idx = indexJoueur();
    if (idx < 0) return false;
    var o = QUALI_STATE.drivers[idx];
    if (!o) return false;

    var d = origSplit
      ? origSplit(finalTime, QUALI_STATE.circuitName || "", 0.016)
      : decouperSeme(finalTime, QUALI_STATE.circuitName || "", "q" + idx, 0.016);

    if (!o.bestSectors) o.bestSectors = [null, null, null];
    if (!QUALI_STATE.bestSectors) QUALI_STATE.bestSectors = [null, null, null];
    if (!QUALI_STATE.bestSectorsHolder) QUALI_STATE.bestSectorsHolder = [null, null, null];

    var p = [0, 0, 0];
    for (var u = 0; u < 3; u++) {
      var f = d[u];
      if (QUALI_STATE.bestSectors[u] === null || QUALI_STATE.bestSectors[u] === undefined ||
          f < QUALI_STATE.bestSectors[u]) {
        QUALI_STATE.bestSectors[u] = f;
        var m = QUALI_STATE.bestSectorsHolder[u];
        if (m !== null && m !== undefined && m !== idx) {
          var g = QUALI_STATE.drivers[m];
          if (g && g.lastSectorFlags && g.lastSectorFlags[u] === 2) g.lastSectorFlags[u] = 1;
        }
        QUALI_STATE.bestSectorsHolder[u] = idx;
        p[u] = 2;
      }
      if (o.bestSectors[u] === null || o.bestSectors[u] === undefined || f < o.bestSectors[u]) {
        o.bestSectors[u] = f;
        if (p[u] < 2) p[u] = 1;
      }
    }
    o.lastSectors = d;
    o.lastSectorFlags = p;

    etat.qualifCorrigees++;
    etat.dernierRecalcul = {
      temps: +finalTime.toFixed(3),
      secteurs: d.map(function (x) { return +x.toFixed(3); }),
      drapeaux: p.slice()
    };
    return true;
  }

  function installerQualif() {
    if (typeof window.splitLapIntoSectors === "function" && !window.splitLapIntoSectors._rj69) {
      origSplit = window.splitLapIntoSectors;
      var fnSplit = function () {
        // La photo doit être prise AVANT que l'appelant ne mette à jour les
        // meilleurs secteurs avec le découpage optimiste.
        try { photo = prendrePhoto(); } catch (e) {}
        return origSplit.apply(this, arguments);
      };
      fnSplit._rj69 = true;
      window.splitLapIntoSectors = fnSplit;
    }

    if (typeof window._qualiHotLapSequence === "function" && !window._qualiHotLapSequence._rj69) {
      origSeq = window._qualiHotLapSequence;
      var fnSeq = function (lapTime, session, lap, totalLaps, onDone) {
        var ph = photo;
        var suite = function (finalTime) {
          try {
            if (ph && typeof finalTime === "number" && isFinite(finalTime)) {
              restaurerPhoto(ph);
              reattribuer(finalTime);
            }
          } catch (e) {
            etat.erreur = String(e && e.message || e);
            console.warn(TAG, e);
          }
          return onDone.apply(this, arguments);
        };
        return origSeq.call(this, lapTime, session, lap, totalLaps, suite);
      };
      fnSeq._rj69 = true;
      window._qualiHotLapSequence = fnSeq;
    }

    return !!(origSplit && origSeq);
  }

  /* ================================================================== */
  /* B. ESSAIS LIBRES                                                    */
  /* ================================================================== */

  function circuitEssais() {
    try {
      return (RACE_STATE.circuitData && RACE_STATE.circuitData.name) || RACE_STATE.circuit || "";
    } catch (e) { return ""; }
  }

  // Recalcule les secteurs de tous les tests, dans l'ordre, et renvoie ceux
  // du dernier avec leurs couleurs.
  function secteursDuDernierTest() {
    var pr = null;
    try { pr = (typeof RACE_STATE !== "undefined") ? RACE_STATE.practice : null; } catch (e) {}
    if (!pr || !pr.tests || !pr.tests.length) return null;

    var circuit = circuitEssais();
    var meilleurs = [null, null, null];
    var precedents = null, courants = null, flags = null;

    for (var i = 0; i < pr.tests.length; i++) {
      var lt = pr.tests[i] && pr.tests[i].lapTime;
      if (typeof lt !== "number" || !isFinite(lt) || lt <= 0) continue;

      var d = decouperSeme(lt, circuit, "el" + i, 0.014);
      var f = [0, 0, 0];
      for (var u = 0; u < 3; u++) {
        if (meilleurs[u] === null || d[u] < meilleurs[u]) { meilleurs[u] = d[u]; f[u] = 2; }
        else if (precedents && d[u] < precedents[u]) { f[u] = 1; }
        else { f[u] = 0; }
      }
      precedents = courants;
      courants = d;
      flags = f;
    }
    if (!courants) return null;
    return { secteurs: courants, flags: flags };
  }

  function couleurDe(f) { return f === 2 ? VIOLET : f === 1 ? VERT : JAUNE; }
  function libelleDe(f) { return f === 2 ? "VIOLET" : f === 1 ? "VERT" : "JAUNE"; }

  function corrigerEssais() {
    var sec = document.getElementById("race-practice-section");
    if (!sec) return;
    var lignes = sec.querySelectorAll(".practice-sector[data-sec]");
    if (lignes.length < 3) return;

    // Ne rien faire tant que les temps ne sont pas révélés : le module 30
    // dévoile les secteurs progressivement, on ne corrige qu'une fois posés.
    var pret = false;
    for (var k = 0; k < lignes.length; k++) {
      var t0 = lignes[k].querySelector(".practice-sector-time");
      if (t0 && /\d/.test(t0.textContent || "")) { pret = true; break; }
    }
    if (!pret) return;

    var res = secteursDuDernierTest();
    if (!res) return;

    enEcriture = true;
    try {
      for (var i = 0; i < lignes.length; i++) {
        var row = lignes[i];
        var n = parseInt(row.getAttribute("data-sec"), 10);
        if (!(n >= 1 && n <= 3)) continue;
        var idx = n - 1;
        var f = res.flags[idx];
        var col = couleurDe(f);
        var tps = res.secteurs[idx];

        var tn = row.querySelector(".practice-sector-time");
        if (tn && /\d/.test(tn.textContent || "")) {
          // 04q-polish-rebalance arrondit les décimales trouvées dans le DOM.
          // Les deux échappatoires qu'il reconnaît : l'attribut data-rj-noround
          // et la classe sector-time. On pose les deux, sinon 26.819 devient 27.
          if (!row.hasAttribute("data-rj-noround")) row.setAttribute("data-rj-noround", "1");
          if (!tn.hasAttribute("data-rj-noround")) tn.setAttribute("data-rj-noround", "1");
          if (tn.className.indexOf("sector-time") < 0) tn.className += " sector-time";
          var voulu = tps.toFixed(3);
          if (tn.textContent !== voulu) tn.textContent = voulu;
          if (tn.style.color !== col) tn.style.color = col;
        }
        row.style.background = col + "22";
        row.style.borderColor = col;
        row.style.boxShadow = "0 0 14px " + col + "40, inset 0 0 0 1px " + col + "55";
        row.setAttribute("data-rj69", libelleDe(f));
      }
      etat.essaisCorriges++;
    } catch (e) {
      etat.erreur = String(e && e.message || e);
    } finally {
      enEcriture = false;
    }
  }

  function differer() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(corrigerEssais, 60);
  }

  function installerEssais() {
    if (observer || typeof MutationObserver !== "function") return !!observer;
    var cible = document.body || document.documentElement;
    if (!cible) return false;
    observer = new MutationObserver(function () {
      if (enEcriture) return;      // nos propres écritures ne se rappellent pas
      differer();
    });
    observer.observe(cible, { childList: true, subtree: true, characterData: true });
    return true;
  }

  /* ---------------------------------------------------------- montage --- */
  var essais = 0;
  function boot() {
    var q = false;
    try { q = installerQualif(); } catch (e) { etat.erreur = String(e && e.message || e); }
    var e2 = false;
    try { e2 = installerEssais(); } catch (e) {}

    if (!q && essais++ < 120) { setTimeout(boot, 100); return; }

    etat.installe = true;
    console.log(TAG + " actif — qualif : secteurs recalculés sur le temps final" +
                (q ? "" : " (interception partielle)") +
                " · essais : couleurs déduites des temps" + (e2 ? "" : " (observateur indisponible)"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Déclenchement manuel, utile pour vérifier depuis la console.
  window._rj69Corriger = function () {
    corrigerEssais();
    return etat;
  };

  window._rj69Uninstall = function () {
    try { if (origSplit && window.splitLapIntoSectors && window.splitLapIntoSectors._rj69) window.splitLapIntoSectors = origSplit; } catch (e) {}
    try { if (origSeq && window._qualiHotLapSequence && window._qualiHotLapSequence._rj69) window._qualiHotLapSequence = origSeq; } catch (e) {}
    try { if (observer) observer.disconnect(); } catch (e) {}
    observer = null;
    if (minuteur) clearTimeout(minuteur);
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();
