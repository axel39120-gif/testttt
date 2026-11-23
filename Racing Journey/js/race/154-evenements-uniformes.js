/* =====================================================================
 * 154-evenements-uniformes.js — UNE SEULE PRÉSENTATION DES ÉVÉNEMENTS
 *
 * POURQUOI
 * En course, trois fenêtres d'événement coexistaient, chacune avec son
 * dessin : la carte du module 143 (bandeau, choix côte à côte, risque en
 * clair), l'ancienne fenêtre du moteur (choix empilés, encadré ambre) avec
 * son compte rendu à part (module 47), et les « moments décisifs » (106).
 *
 * CE QUE FAIT LE MODULE
 * Les deux anciennes fenêtres du moteur sont redessinées dans la carte 143,
 * avec les mêmes boutons (mêmes actions) : bandeau « Événement · Tour x / y »,
 * titre, récit, choix côte à côte ; puis un compte rendu « Résultat » de la
 * même famille. Le module 106 dessine directement avec ces classes.
 *
 * Réversible : window._rj154Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[154-evenements]";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function LR() { return window.LIVE_RACE || null; }
  function phase(lr) {
    var p = lr && lr.total ? lr.cur / lr.total : 0;
    return p < 0.25 ? "Début de course" : p < 0.55 ? "Mi-course" : p < 0.85 ? "Fin de course" : "Derniers tours";
  }

  /* Le bandeau commun : point lumineux, type, tour et phase. */
  function tete(type) {
    var lr = LR();
    return '<div class="rj143-tete"><span class="rj143-led"></span><span class="rj143-type">' + esc(type) + "</span>" +
      (lr && lr.total ? '<span class="rj143-tour">Tour ' + (lr.cur || 0) + " / " + lr.total + " · " + phase(lr) + "</span>" : "") + "</div>";
  }

  /* Un choix de l'ancien format, lu comme ceux du module 143. */
  function lire(ch) {
    var m = ch.mods || {};
    if (!(typeof ch.difficulty === "number" && ch.actionType)) {
      var c = m.chance && typeof m.chance === "object" ? m.chance : typeof m.chance === "number" && m.chance > 0 ? { fail: m.chance, failMod: -2.3 * Math.abs(m.player || 0) } : null;
      return RJ143.lecture({ mod: m.player || 0, chance: c });
    }
    var o = ch._frozenOutcomes || _computeChoiceOutcomes(ch.difficulty, ch.actionType), tot = (o.brillant + o.succes + o.neutre + o.rateMin + o.rateMaj) || 1;
    var rate = Math.round((o.rateMin + o.rateMaj) / tot * 100), gain = typeof ch.successMod === "number" ? ch.successMod : m.player || 0;
    var perte = typeof ch.rateMinMod === "number" ? ch.rateMinMod : -.4 * Math.abs(gain), s = function (x) { return Math.abs(x * 90).toFixed(1).replace(".", ",") + " s"; };
    var effet = ch.posGainOnSucces || ch.intent === "attaque" || ch.actionType === "attaque" ? "dépassement" : ch.actionType === "defense" ? "place conservée" :
      Math.abs(gain * 90) < .25 ? "effet léger" : "≈ " + s(gain) + (gain > 0 ? " gagnées" : " perdues");
    if (rate) effet += " · raté : " + (ch.dnfOnMaj ? "abandon possible" : ch.posLossOnRateMin || ch.posLossOnRateMaj || ch.actionType === "defense" ? "place perdue" : "≈ " + s(Math.min(perte, -.003)) + " perdues");
    return { risque: rate ? (100 - rate) + " % de réussite" : "Sans risque", effet: effet, classe: ch.dnfOnMaj ? "fatal" : rate > 5 ? "ose" : "sur" };
  }

  /* Ancienne fenêtre du moteur : on garde ses boutons (leur onclick), on change l'habit. */
  function redessinerChoix() {
    var t = document.getElementById("race-event-modal");
    if (!t || t.style.display === "none" || t.querySelector(".rj143-carte")) return;
    var e = window.RACE_STATE && RACE_STATE.events && RACE_STATE.events[window.CURRENT_EVT_IDX];
    var boutons = [].slice.call(t.querySelectorAll("button[onclick]"));
    if (!e || !boutons.length) return;
    var desc = "";
    try { desc = typeof e.text === "function" ? e.text() : e.text || ""; } catch (x) { desc = ""; }
    /* v301 : mêmes informations que les autres événements (risque en clair, effet en
       secondes) — fini « Skill 62 · mental +2 » et « 9 % critique ». */
    var choix = e.choices.map(function (ch, k) {
      var b = boutons[k]; if (!b) return "";
      var l = lire(ch);
      return '<button class="rj143-btn rj143-' + l.classe + '" data-rj-odds="1" onclick="' + esc(b.getAttribute("onclick")) + '">' +
        '<span class="rj143-btxt">' + esc(ch.text || ch.label) + "</span>" +
        '<span class="rj143-risque">' + l.risque + "</span>" + '<span class="rj143-effet">' + l.effet + "</span></button>";
    }).join("");
    t.innerHTML = '<div class="rj143-carte" data-rj-noround="1">' + tete("Événement") +
      '<div class="rj143-situation">' + (window.RJ143 && RJ143.situation ? RJ143.situation() : "") + "</div>" +
      '<div class="rj143-corps"><div class="rj143-titre">' + esc(e.title || "Événement de course") + '</div><div class="rj143-desc">' + desc + "</div></div>" +
      '<div class="rj143-choix">' + choix + "</div></div>";
    t.classList.add("rj143-modale");
  }

  /* Compte rendu du module 47 : même carte, bloc « Résultat ». */
  function redessinerCompteRendu(m) {
    if (!m || m.querySelector(".rj143-carte")) return;
    var titre = m.querySelector('div[style*="font-size:18px"]'), note = m.querySelector('div[style*="font-size:14px"]');
    var lignes = [].slice.call(m.querySelectorAll('div[style*="gap:9px"]')).map(function (l) {
      var s = l.querySelectorAll("span");
      return { puce: s[0] ? s[0].textContent : "•", txt: s[1] ? s[1].innerHTML : l.innerHTML };
    });
    var ok = m.querySelector("#rj47-outcome-ok");   // déjà branché par 47 : on le déplace, sans le recréer
    var ton = lignes.some(function (l) { return l.puce === "▼"; }) ? "mauvais" : lignes.some(function (l) { return l.puce === "▲"; }) ? "bon" : "neutre";
    var ev = window.RACE_STATE && RACE_STATE.events && RACE_STATE.events[(window.CURRENT_EVT_IDX || 1) - 1];
    var fin = lignes.length && / devant|mènes la course/.test(lignes[lignes.length - 1].txt) ? lignes.pop() : null;
    m.innerHTML = '<div class="rj143-carte" data-rj-noround="1">' + tete("Résultat") +
      '<div class="rj143-corps"><div class="rj143-titre">' + esc(ev && ev.title || "Ton choix") + "</div></div>" +
      '<div class="rj143-resultat rj143-' + ton + '"><span class="rj143-verdict">' + (titre ? titre.innerHTML : "Fait") + "</span>" +
      (note ? '<span class="rj143-recit">' + note.innerHTML + "</span>" : "") +
      '<span class="rj143-effets">' + (lignes.map(function (l) { return l.txt; }).join(" · ") || "Aucun changement notable") + "</span>" +
      (fin ? '<span class="rj143-instant">' + fin.txt + "</span>" : "") + "</div>" +
      '<div class="rj154-pied"></div></div>';
    if (ok) { ok.removeAttribute("style"); ok.className = "rj154-ok"; m.querySelector(".rj154-pied").appendChild(ok); }
    m.classList.add("rj143-modale");
  }

  var obs = null;
  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.showNextRaceEvent !== "function") return false;
    rjInscrire("showNextRaceEvent", { id: "154-choix", apres: function () { try { redessinerChoix(); } catch (e) { console.warn(TAG, e); } } });
    /* Le compte rendu (47) est créé puis son bouton branché par addEventListener :
       on le redessine avant ce branchement, dès son insertion dans la page. */
    obs = new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        [].forEach.call(mu.addedNodes, function (n) {
          if (n.id === "rj47-outcome-modal") try { redessinerCompteRendu(n); } catch (e) { console.warn(TAG, e); }
        });
      });
    });
    obs.observe(document.body, { childList: true });
    window._rj154Uninstall = function () { rjDesinscrire("154-"); if (obs) obs.disconnect(); };
    console.log(TAG, "actif — une seule présentation des événements en course");
    return true;
  }
  (function boot(n) { if (!installer() && n < 80) setTimeout(function () { boot(n + 1); }, 100); })(0);
})();
