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
 * Affichage pur, ne touche pas la résolution.
 *
 * SECOND VOLET — POP-UP DE CONSÉQUENCE (voir plus bas)
 * Après que le joueur a tranché, une seconde modale annonce le résultat :
 * un court texte narratif, puis, sous un trait, les effets concrets
 * (vert = favorable, rouge = défavorable). La course reste en pause tant
 * que cette modale est ouverte.
 *
 * Réversible : window._rjEventOddsUninstall().
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

  /* ================================================================== *
   * POP-UP DE CONSÉQUENCE
   *
   * resolveRaceEvt applique tout d'un bloc puis, selon le cas, referme la
   * modale (course live en pause) ou enchaîne sur l'événement suivant. Le
   * joueur ne voyait donc jamais ce que son choix avait produit.
   *
   * On enveloppe resolveRaceEvt pour :
   *   1. photographier l'état du pilote avant résolution ;
   *   2. capturer les outcomes passés à applyEventOutcome pendant l'appel
   *      (source structurée : positions, pace, pneus, pénalités, DNF) ;
   *   3. retenir l'événement suivant (showNextRaceEvent neutralisé le temps
   *      de l'appel) pour qu'il ne recouvre pas le compte rendu ;
   *   4. afficher la modale de résultat, la course restant figée jusqu'au
   *      clic sur « Continuer ».
   *
   * Aucun fichier cœur n'est modifié.
   * ================================================================== */
  var MODAL_ID = "rj47-outcome-modal";
  var _capture = null;                 // tampon des outcomes pendant la résolution
  var _origResolveEvt = null, _origApply = null, _origShowNext = null;
  var _repriseCourse = false;          // faut-il relancer la course à la fermeture ?
  var _nextEnAttente = false;          // un événement suivant a-t-il été retenu ?

  function joueur() {
    try {
      if (!window.LIVE_RACE || !LIVE_RACE.drivers) return null;
      return LIVE_RACE.drivers.find(function (d) { return d.isPlayer; }) || null;
    } catch (e) { return null; }
  }

  function photo() {
    var p = joueur();
    var trust = null;
    try { if (window.TEAM_TRUST && typeof TEAM_TRUST.value === "number") trust = TEAM_TRUST.value; } catch (e) {}
    var evtMod = null;
    try { if (window.RACE_STATE && typeof RACE_STATE.evtMod === "number") evtMod = RACE_STATE.evtMod; } catch (e) {}
    return {
      pos: p ? p.pos : null,
      dnf: p ? !!p.dnf : false,
      trust: trust,
      evtMod: evtMod,
      logLen: (window.RACE_STATE && RACE_STATE.eventsLog) ? RACE_STATE.eventsLog.length : 0
    };
  }

  function pluriel(n, mot) { return n + " " + mot + (n > 1 ? "s" : ""); }

  /* Traduit les outcomes capturés + les traces laissées dans le journal
     en une liste d'effets lisibles. */
  function listerEffets(av, ap, captures, logs) {
    var eff = [], positionDite = false;

    if (ap.dnf && !av.dnf) eff.push({ txt: "Abandon — ta course s'arrête ici", ton: "neg" });

    for (var i = 0; i < captures.length; i++) {
      var o = captures[i].outcome || {}, r = captures[i].res || {};

      if (typeof o.penaltySec === "number" && o.penaltySec > 0) {
        eff.push({ txt: "Pénalité de " + Math.round(o.penaltySec) + " s", ton: "neg" });
      }

      var pms = o.paceMod ? (Array.isArray(o.paceMod) ? o.paceMod : [o.paceMod]) : [];
      for (var j = 0; j < pms.length; j++) {
        var pm = pms[j];
        if (!pm || typeof pm.deltaSec !== "number" || !(pm.laps > 0)) continue;
        var tot = Math.abs(pm.deltaSec * pm.laps).toFixed(1);
        if (pm.deltaSec > 0) eff.push({ txt: "Rythme dégradé — +" + tot + " s sur " + pluriel(pm.laps, "tour"), ton: "neg" });
        else                 eff.push({ txt: "Rythme gagné — −" + tot + " s sur " + pluriel(pm.laps, "tour"), ton: "pos" });
      }

      if (o.tyreDamage && o.tyreDamage.laps > 0) {
        eff.push({ txt: "Pneus abîmés pendant " + pluriel(o.tyreDamage.laps, "tour"), ton: "neg" });
      }

      if (typeof r.posChange === "number" && r.posChange !== 0) {
        positionDite = true;
        if (r.posChange > 0) eff.push({ txt: pluriel(r.posChange, "place") + " perdue" + (r.posChange > 1 ? "s" : ""), ton: "neg" });
        else                 eff.push({ txt: pluriel(-r.posChange, "place") + " gagnée" + (-r.posChange > 1 ? "s" : ""), ton: "pos" });
      }
    }

    /* Traces laissées par les duels (dépassement, défense) : le moteur les
       journalise avec leur propre signe, on les reprend telles quelles. */
    for (var k = 0; k < logs.length; k++) {
      var l = logs[k];
      if (!l || l._principal) continue;
      var txt = (l.text || "") + (l.note ? " — " + l.note : "");
      if (!txt.trim()) continue;
      positionDite = true;
      eff.push({ txt: txt, ton: l.sign === "+" ? "pos" : (l.sign === "−" ? "neg" : "neutre") });
    }

    /* Filet : si la position a bougé sans qu'aucune source ne l'ait dit. */
    if (!positionDite && typeof av.pos === "number" && typeof ap.pos === "number" && av.pos !== ap.pos) {
      var d = av.pos - ap.pos;
      if (d > 0) eff.push({ txt: pluriel(d, "place") + " gagnée" + (d > 1 ? "s" : "") + " — tu es P" + ap.pos, ton: "pos" });
      else       eff.push({ txt: pluriel(-d, "place") + " perdue" + (-d > 1 ? "s" : "") + " — tu es P" + ap.pos, ton: "neg" });
    }

    /* Les petits modificateurs (< seuil de conversion du moteur) n'ont pas
       d'effet concret à montrer, mais ils pèsent sur le rythme : plutôt que
       d'annoncer « aucun effet », on les traduit en une ligne qualitative. */
    if (!eff.length && typeof av.evtMod === "number" && typeof ap.evtMod === "number") {
      var dm = ap.evtMod - av.evtMod;
      if (dm > 0.001)       eff.push({ txt: "Léger gain de rythme sur les prochains tours", ton: "pos" });
      else if (dm < -0.001) eff.push({ txt: "Léger manque de rythme sur les prochains tours", ton: "neg" });
    }

    if (av.trust !== null && ap.trust !== null && av.trust !== ap.trust) {
      var dt = Math.round(ap.trust - av.trust);
      if (dt !== 0) eff.push({ txt: "Confiance de l'équipe " + (dt > 0 ? "+" : "−") + Math.abs(dt), ton: dt > 0 ? "pos" : "neg" });
    }

    return eff;
  }

  /* Le moteur journalise la résolution : dernier enregistrement ajouté. */
  function lireVerdict(logs) {
    var principal = null;
    for (var i = logs.length - 1; i >= 0; i--) {
      if (logs[i] && typeof logs[i].choice === "string" && logs[i].choice.indexOf(" → ") >= 0) { principal = logs[i]; break; }
    }
    if (!principal && logs.length) principal = logs[logs.length - 1];
    if (principal) principal._principal = true;

    var label = "", note = "", sign = "~";
    if (principal) {
      note = principal.note || "";
      sign = principal.sign || "~";
      var c = principal.choice || "";
      var p = c.lastIndexOf(" → ");
      if (p >= 0) label = c.substring(p + 3).trim();
    }
    if (!label) label = sign === "+" ? "Réussi" : (sign === "−" ? "Raté" : "Sans effet notable");
    return { label: label, note: note, sign: sign };
  }

  /* Le moteur accole le résumé technique d'applyEventOutcome à la note
     (« … tu gagnes du terrain. · -3.1s sur 5T »). Comme on détaille ces
     effets sous le trait, on l'enlève du texte narratif. */
  function noteSansResume(note, captures) {
    if (!note) return note;
    for (var i = 0; i < captures.length; i++) {
      var s = captures[i].res && captures[i].res.summary;
      if (!s) continue;
      note = note.split(" · " + s).join("").split(s).join("");
    }
    return note.replace(/\s*·\s*$/, "").trim();
  }

  function accent(label, sign) {
    if (/brillante/i.test(label)) return GREEN;
    if (/^Réussi/i.test(label)) return GREEN;
    if (/^Gros raté/i.test(label)) return RED;
    if (/^Raté/i.test(label)) return AMBER;
    if (sign === "+") return GREEN;
    if (sign === "−") return RED;
    return "#9CA3AF";
  }

  function fermerModale() {
    var m = document.getElementById(MODAL_ID);
    if (m && m.parentNode) m.parentNode.removeChild(m);

    /* L'événement suivant retenu pendant la résolution peut sortir. */
    if (_nextEnAttente) {
      _nextEnAttente = false;
      try { if (typeof _origShowNext === "function") _origShowNext(); } catch (e) {}
    }
    /* Modale de choix laissée masquée alors qu'il n'y a plus rien à montrer. */
    try {
      var rem = document.getElementById("race-event-modal");
      if (rem && rem.style.display === "none" && typeof window._hideRaceEventModal === "function") {
        _hideRaceEventModal();
      }
    } catch (e) {}

    if (_repriseCourse) {
      _repriseCourse = false;
      try { if (window.LIVE_RACE && !LIVE_RACE.finished) LIVE_RACE.paused = false; } catch (e) {}
    }
  }

  function afficherModale(verdict, effets) {
    var col = accent(verdict.label, verdict.sign);
    var anc = document.getElementById(MODAL_ID);
    if (anc && anc.parentNode) anc.parentNode.removeChild(anc);

    var m = document.createElement("div");
    m.id = MODAL_ID;
    m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:10000;display:flex;" +
                      "align-items:center;justify-content:center;padding:16px 22px;backdrop-filter:blur(4px)";

    var lignes = "";
    if (!effets.length) {
      lignes = '<div style="font-size:13px;color:var(--text3);font-family:var(--font-body)">Aucun effet mesurable.</div>';
    } else {
      for (var i = 0; i < effets.length; i++) {
        var e = effets[i];
        var c = e.ton === "pos" ? GREEN : (e.ton === "neg" ? RED : "#9CA3AF");
        var puce = e.ton === "pos" ? "▲" : (e.ton === "neg" ? "▼" : "•");
        lignes += '<div style="display:flex;align-items:flex-start;gap:9px;font-size:13px;line-height:1.45;' +
                  'font-family:var(--font-body);color:' + c + '">' +
                  '<span style="font-size:10px;line-height:1.7;flex-shrink:0">' + puce + '</span>' +
                  '<span>' + e.txt + '</span></div>';
      }
    }

    m.innerHTML =
      '<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);' +
      'border-top:3px solid ' + col + ';border-radius:var(--r);max-width:420px;width:100%;max-height:90vh;overflow-y:auto;' +
      'box-shadow:0 16px 48px rgba(0,0,0,0.7)">' +

        '<div style="padding:14px 16px;border-bottom:1px solid var(--line)">' +
          '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:' + col + ';' +
          'letter-spacing:.22em;text-transform:uppercase;margin-bottom:4px;display:flex;align-items:center;gap:8px">' +
            '<span style="display:inline-block;width:3px;height:11px;background:' + col + '"></span>Ton choix</div>' +
          '<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--white);' +
          'line-height:1.2;letter-spacing:.01em">' + verdict.label + '</div>' +
        '</div>' +

        '<div style="padding:16px">' +
          '<div style="font-size:14px;font-weight:500;color:var(--text);line-height:1.5">' +
            (verdict.note || "L'action est passée sans conséquence marquante.") + '</div>' +

          '<div style="height:1px;background:var(--line);margin:14px 0"></div>' +

          '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);' +
          'letter-spacing:.18em;text-transform:uppercase;margin-bottom:9px">Effets</div>' +
          '<div style="display:flex;flex-direction:column;gap:7px">' + lignes + '</div>' +

          '<button id="rj47-outcome-ok" style="margin-top:18px;width:100%;padding:12px;border:none;border-radius:var(--r2,8px);' +
          'background:' + col + ';color:#0d0d12;font-family:var(--font-display);font-size:12px;font-weight:900;' +
          'letter-spacing:.14em;text-transform:uppercase;cursor:pointer">Continuer</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(m);
    var ok = document.getElementById("rj47-outcome-ok");
    if (ok) ok.addEventListener("click", fermerModale);
  }

  function wrapResolution() {
    if (typeof window.resolveRaceEvt !== "function") return false;
    if (window.resolveRaceEvt._rj47) return true;

    /* Capture des outcomes appliqués au joueur pendant la résolution. */
    if (typeof window.applyEventOutcome === "function" && !window.applyEventOutcome._rj47) {
      _origApply = window.applyEventOutcome;
      window.applyEventOutcome = function (d, outcome) {
        var res = _origApply.apply(this, arguments);
        try { if (_capture && d && d.isPlayer) _capture.push({ outcome: outcome, res: res }); } catch (e) {}
        return res;
      };
      window.applyEventOutcome._rj47 = true;
    }

    _origResolveEvt = window.resolveRaceEvt;
    window.resolveRaceEvt = function () {
      var av, captures = [], retour;
      try { av = photo(); } catch (e) { av = null; }

      _capture = captures;
      _nextEnAttente = false;
      _origShowNext = window.showNextRaceEvent;
      if (typeof _origShowNext === "function") {
        window.showNextRaceEvent = function () {
          _nextEnAttente = true;
          try {
            var rem = document.getElementById("race-event-modal");
            if (rem) rem.style.display = "none";   // ne pas recouvrir le compte rendu
          } catch (e) {}
        };
      }

      try {
        retour = _origResolveEvt.apply(this, arguments);
      } finally {
        _capture = null;
        if (typeof _origShowNext === "function") window.showNextRaceEvent = _origShowNext;
      }

      try {
        if (av) {
          var ap = photo();
          var logs = (window.RACE_STATE && RACE_STATE.eventsLog) ? RACE_STATE.eventsLog.slice(av.logLen) : [];
          var verdict = lireVerdict(logs);
          verdict.note = noteSansResume(verdict.note, captures);
          var effets = listerEffets(av, ap, captures, logs);

          /* la course reste figée le temps de la lecture */
          if (window.LIVE_RACE && !LIVE_RACE.finished) { LIVE_RACE.paused = true; _repriseCourse = true; }
          afficherModale(verdict, effets);
        }
      } catch (e) {
        /* un compte rendu raté ne doit jamais bloquer la course */
        if (_repriseCourse) { _repriseCourse = false; try { if (window.LIVE_RACE) LIVE_RACE.paused = false; } catch (e2) {} }
        if (_nextEnAttente) { _nextEnAttente = false; try { if (typeof _origShowNext === "function") _origShowNext(); } catch (e3) {} }
      }

      return retour;
    };
    window.resolveRaceEvt._rj47 = true;
    return true;
  }

  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    obs.observe(document.body, { childList: true, subtree: true });
    scan(document.body);
    var tries = 0;
    (function boot() {
      if (wrapResolution()) return;
      if (tries++ < 60) setTimeout(boot, 150);
    })();
    console.log("[47-event-odds] actif (probabilités + compte rendu de choix)");
  }

  window._rjEventOddsUninstall = function () {
    obs.disconnect();
    if (_origResolveEvt) window.resolveRaceEvt = _origResolveEvt;
    if (_origApply) window.applyEventOutcome = _origApply;
    var m = document.getElementById(MODAL_ID);
    if (m && m.parentNode) m.parentNode.removeChild(m);
    console.log("[47-event-odds] désinstallé");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
