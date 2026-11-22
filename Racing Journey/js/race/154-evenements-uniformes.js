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

  /* Ancienne fenêtre du moteur : on garde ses boutons (leur onclick), on change l'habit. */
  function redessinerChoix() {
    var t = document.getElementById("race-event-modal");
    if (!t || t.style.display === "none" || t.querySelector(".rj143-carte")) return;
    var e = window.RACE_STATE && RACE_STATE.events && RACE_STATE.events[window.CURRENT_EVT_IDX];
    var boutons = [].slice.call(t.querySelectorAll("button[onclick]"));
    if (!e || !boutons.length) return;
    var desc = "";
    try { desc = typeof e.text === "function" ? e.text() : e.text || ""; } catch (x) { desc = ""; }
    var choix = boutons.map(function (b) {
      var infos = [].slice.call(b.querySelectorAll("span")).map(function (s) { return s.textContent; });
      var texte = (b.childNodes[0] && b.childNodes[0].nodeType === 3 ? b.childNodes[0].textContent : b.textContent).trim();
      var risque = infos[0] || "", c = /risqu|faible|%/.test(risque) && parseInt((risque.match(/(\d+)\s*%/) || [])[1], 10) < 60 ? "ose" : "sur";
      return '<button class="rj143-btn rj143-' + c + '" onclick="' + esc(b.getAttribute("onclick")) + '">' +
        '<span class="rj143-btxt">' + esc(texte) + "</span>" +
        (risque ? '<span class="rj143-risque">' + esc(risque) + "</span>" : "") +
        (infos.length > 1 ? '<span class="rj143-effet">' + esc(infos.slice(1).join(" · ")) + "</span>" : "") + "</button>";
    }).join("");
    t.innerHTML = '<div class="rj143-carte" data-rj-noround="1">' + tete("Événement") +
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
    m.innerHTML = '<div class="rj143-carte" data-rj-noround="1">' + tete("Résultat") +
      '<div class="rj143-corps"><div class="rj143-titre">' + (titre ? titre.innerHTML : "Ton choix") + "</div>" +
      (note ? '<div class="rj143-desc">' + note.innerHTML + "</div>" : "") + "</div>" +
      '<div class="rj143-resultat rj143-' + ton + '"><span class="rj143-verdict">Effets</span>' +
      (lignes.length ? lignes.map(function (l) { return '<span class="rj143-effets">' + esc(l.puce) + " " + l.txt + "</span>"; }).join("") : '<span class="rj143-effets">Aucun effet mesurable</span>') +
      "</div>" +
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
