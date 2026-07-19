/* =====================================================================
 * 47-event-odds.js — TROIS PROBABILITÉS PAR CHOIX (ÉVÉNEMENTS DE COURSE)
 *
 * Sur CHAQUE choix d'un événement de course, affiche en dessous :
 *   ✓ Réussite       = éclatant + succès + neutre
 *   ✗ Échec          = raté mineur / pénalité
 *   ☠ Échec critique = raté majeur / abandon
 *
 * SOURCE DES CHOIX (corrigé) : les événements à CHOIX ne posent PAS
 * LIVE_RACE.pendingEvent. Le moteur les empile dans RACE_STATE.events et les
 * affiche via showNextRaceEvent (modal #race-event-modal), avec des boutons
 * onclick="resolveRaceEvt(evtIdx, choiceIdx)". On lit donc le choix directement
 * dans RACE_STATE.events[evtIdx].choices[choiceIdx] (l'evtIdx est l'argument du
 * bouton). pendingEvent + resolveLiveEvent restent gérés en secours (crises).
 *
 * Source des % : issues FIGÉES du choix (choices[i]._frozenOutcomes, calculées
 * par le moteur via _computeChoiceOutcomes → l'affichage colle au tirage réel).
 * À défaut, cascade sur chance.dnf/penalty, mods.chance, difficulty, puis choix
 * sûr (100/0/0). Ainsi aucun choix ne reste sans pourcentage.
 *
 * Affichage pur, ne touche pas la résolution. Réversible :
 * window._rjEventOddsUninstall().
 * =================================================================== */
(function () {
  "use strict";

  var GREEN = "#34D399", AMBER = "#F59E0B", RED = "#EF4444";

  function pct(x) { var v = Math.round(x * 100); return v < 0 ? 0 : (v > 100 ? 100 : v); }

  // Renvoie TOUJOURS {rea,ech,cri} (jamais null) pour qu'aucun choix ne soit nu.
  function oddsFromChoice(ch) {
    if (!ch) return null;

    // 1) Issues figées par le moteur — le plus fiable.
    var fo = ch._frozenOutcomes;
    if (fo && typeof fo.rateMaj === "number") {
      var tot = (fo.brillant || 0) + (fo.succes || 0) + (fo.neutre || 0) +
                (fo.rateMin || 0) + (fo.rateMaj || 0);
      if (tot > 0) {
        var ech = pct((fo.rateMin || 0) / tot);
        var cri = pct((fo.rateMaj || 0) / tot);
        var rea = 100 - ech - cri; if (rea < 0) rea = 0;
        return { rea: rea, ech: ech, cri: cri };
      }
    }

    // 2) Format modal : chance.dnf (critique) / chance.penalty (échec).
    if (ch.chance && (typeof ch.chance.dnf === "number" || typeof ch.chance.penalty === "number")) {
      var cri2 = pct(ch.chance.dnf || 0);
      var ech2 = pct(ch.chance.penalty || 0);
      var rea2 = 100 - ech2 - cri2; if (rea2 < 0) rea2 = 0;
      return { rea: rea2, ech: ech2, cri: cri2 };
    }

    // 3) Ancien système : mods.chance = probabilité d'échec.
    if (ch.mods && typeof ch.mods.chance === "number" && ch.mods.chance > 0) {
      var e = pct(ch.mods.chance);
      return { rea: 100 - e, ech: e, cri: 0 };
    }

    // 4) Difficulté seule → estimation (échec croît avec la difficulté, critique faible).
    if (typeof ch.difficulty === "number" && ch.difficulty > 0) {
      var d = ch.difficulty;
      var cri4 = Math.round(Math.min(18, d * 14));
      var ech4 = Math.round(Math.min(55, d * 42));
      var rea4 = 100 - ech4 - cri4; if (rea4 < 0) rea4 = 0;
      return { rea: rea4, ech: ech4, cri: cri4 };
    }

    // 5) Choix sûr / narratif : AUCUNE notion de risque -> pas de pourcentage.
    return null;
  }

  function oddsHtml(o) {
    return '<span class="rj-odds" style="font-size:10px;font-family:var(--font-display);' +
      'letter-spacing:.03em;font-weight:800;display:inline-flex;gap:9px;flex-wrap:wrap;' +
      'align-items:center;margin-top:4px">' +
      '<span style="color:' + GREEN + '">\u2713 ' + o.rea + '% r\u00E9ussite</span>' +
      '<span style="color:' + AMBER + '">\u2717 ' + o.ech + '% \u00E9chec</span>' +
      '<span style="color:' + RED + '">\u2620 ' + o.cri + '% critique</span>' +
      '</span>';
  }

  function currentEvent() {
    // Les événements à CHOIX ne posent PAS LIVE_RACE.pendingEvent : le moteur les
    // empile dans RACE_STATE.events et les affiche via showNextRaceEvent (modal
    // #race-event-modal). CURRENT_EVT_IDX pointe l'événement courant. C'est CETTE
    // source qui porte les choices[i]._frozenOutcomes ; pendingEvent reste réservé
    // aux crises (showLiveEvent). On lit donc RACE_STATE.events en priorité.
    try {
      if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.events && RACE_STATE.events.length) {
        var idx = (typeof CURRENT_EVT_IDX !== "undefined" && CURRENT_EVT_IDX != null) ? CURRENT_EVT_IDX : (RACE_STATE.events.length - 1);
        var e = RACE_STATE.events[idx];
        if (e && e.choices && e.choices.length) return e;
        // CURRENT_EVT_IDX peut avoir été incrémenté : retomber sur le dernier événement à choix.
        for (var k = RACE_STATE.events.length - 1; k >= 0; k--) {
          var ek = RACE_STATE.events[k];
          if (ek && ek.choices && ek.choices.length) return ek;
        }
      }
    } catch (e) { /* no-op */ }
    // Secours : ancien système à pendingEvent (crises via showLiveEvent).
    return (typeof LIVE_RACE !== "undefined" && LIVE_RACE) ? LIVE_RACE.pendingEvent : null;
  }

  // Extrait {evtIdx, choiceIdx} depuis l'onclick, quel que soit le format du bouton.
  //   resolveRaceEvt(evtIdx, choiceIdx)  → modal à choix (RACE_STATE.events[evtIdx])
  //   resolveLiveEvent(choiceIdx)        → modal crise (LIVE_RACE.pendingEvent)
  function parseChoice(oc) {
    var m = oc.match(/resolveRaceEvt\(\s*(-?\d+)\s*,\s*(\d+)\s*\)/);
    if (m) return { evtIdx: parseInt(m[1], 10), choiceIdx: parseInt(m[2], 10) };
    m = oc.match(/resolveLiveEvent\(\s*(\d+)\s*\)/);
    if (m) return { evtIdx: null, choiceIdx: parseInt(m[1], 10) };
    return null;
  }

  // Renvoie l'objet choix pointé par le bouton, depuis la bonne source.
  function choiceFor(info) {
    if (!info) return null;
    if (info.evtIdx != null) {
      try {
        var ev = (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.events) ? RACE_STATE.events[info.evtIdx] : null;
        if (ev && ev.choices && ev.choices[info.choiceIdx]) return ev.choices[info.choiceIdx];
      } catch (e) { /* no-op */ }
    }
    var pe = currentEvent();
    return (pe && pe.choices && pe.choices[info.choiceIdx]) ? pe.choices[info.choiceIdx] : null;
  }

  function enhanceBtn(btn) {
    if (!btn || btn.getAttribute("data-rj-odds")) return;
    var oc = btn.getAttribute("onclick") || "";
    var info = parseChoice(oc);
    if (!info) return;
    var ch = choiceFor(info);
    if (!ch) return;
    var o = oddsFromChoice(ch);
    if (!o) return; // choix sans notion de risque : aucun pourcentage affiché

    btn.setAttribute("data-rj-odds", "1");

    // Remplacer une mention "% réussite" existante, sinon ajouter une ligne dédiée.
    var spans = btn.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      if (/%\s*r\u00E9ussite/.test(spans[i].textContent || "")) {
        spans[i].outerHTML = oddsHtml(o);
        return;
      }
    }
    var line = document.createElement("div");
    line.style.cssText = "padding-left:10px";
    line.innerHTML = oddsHtml(o);
    btn.appendChild(line);
  }

  var SEL = '[onclick*="resolveLiveEvent"], [onclick*="resolveRaceEvt"]';

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches(SEL)) { enhanceBtn(node); return; }
    if (node.querySelectorAll) {
      var btns = node.querySelectorAll(SEL);
      for (var i = 0; i < btns.length; i++) enhanceBtn(btns[i]);
    }
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var ad = muts[i].addedNodes;
      for (var j = 0; j < ad.length; j++) scan(ad[j]);
    }
  });

  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    obs.observe(document.body, { childList: true, subtree: true });
    scan(document.body);
    console.log("[47-event-odds] actif (cible resolveLiveEvent + resolveRaceEvt)");
  }

  window._rjEventOddsUninstall = function () {
    obs.disconnect();
    console.log("[47-event-odds] désinstallé");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
