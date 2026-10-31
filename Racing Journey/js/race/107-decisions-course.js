/* =====================================================================
 * 107-decisions-course.js — LA COURSE SE JOUE, ELLE NE SE REGARDE PAS
 *
 * POURQUOI
 * Depuis que la simulation a été simplifiée (90, 82), le joueur suivait sa
 * course à la barre de progression sans rien y décider. Ce module lui rend
 * la main aux quatre moments où un pilote fait réellement la différence.
 *
 * CE QUI S'AJOUTE
 *   · jusqu'à 4 décisions par course, espacées d'au moins 3 tours :
 *       relance après neutralisation · duel · derniers tours ;
 *     chacune oppose un choix osé (gros gain, échec possible) à un choix
 *     sûr (petit gain). Ni départ ni pluie : les évènements « Départ ! » et
 *     Météo du moteur les couvrent déjà, comme l'arrêt sous safety car.
 *   · un mini-classement : la voiture devant, le joueur, la voiture
 *     derrière, avec les écarts. Le reste du classement reste caché (90).
 *
 * COMMENT
 * Aucune fonction enveloppée : le module s'inscrit aux registres de course
 * (RJ_RACE_START_HOOKS, RJ_LAP_HOOKS, RJ_LEADERBOARD_HOOKS) et pose ses
 * décisions par le chemin natif (pendingEvent + showLiveEvent). Les effets
 * sont appliqués par resolveLiveEvent, qui gère déjà le risque (chance) et
 * convertit le gain en rythme : pas de posGain, qui s'appliquerait même en
 * cas d'échec.
 *
 * Réversible : window._rj107Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[107-decisions]";
  var ID = "rj107";
  var CSS_ID = "rj107-css";
  var PLAFOND = 4;
  var ESPACEMENT = 3;
  var REGISTRES = ["RJ_LAP_HOOKS", "RJ_RACE_START_HOOKS", "RJ_LEADERBOARD_HOOKS"];

  function LR() { return (typeof LIVE_RACE !== "undefined" && LIVE_RACE) ? LIVE_RACE : null; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function visible(id) {
    var el = document.getElementById(id);
    return !!el && getComputedStyle(el).display !== "none" && el.innerHTML.length > 0;
  }

  /* ------------------------------------------------------------------
   * Voisins du joueur (le trafic multi-classes n'est pas un adversaire)
   * ---------------------------------------------------------------- */
  function voisins(lr) {
    var drivers = (lr && lr.drivers) || [];
    var joueur = null;
    for (var i = 0; i < drivers.length; i++) if (drivers[i].isPlayer) { joueur = drivers[i]; break; }
    var res = { joueur: joueur, devant: null, derriere: null, ecartDevant: null, ecartDerriere: null };
    if (!joueur) return res;
    drivers.forEach(function (d) {
      if (d === joueur || d.dnf || d._mc || d.gridPos === 99) return;
      if (d.pos === joueur.pos - 1) res.devant = d;
      else if (d.pos === joueur.pos + 1) res.derriere = d;
    });
    if (res.devant) res.ecartDevant = Math.max(0, (joueur.gap || 0) - (res.devant.gap || 0));
    if (res.derriere) res.ecartDerriere = Math.max(0, (res.derriere.gap || 0) - (joueur.gap || 0));
    return res;
  }

  /* ------------------------------------------------------------------
   * Le moment à jouer maintenant, ou null. Ne modifie rien.
   * ---------------------------------------------------------------- */
  function choixDuMoment(lr) {
    if (!lr || lr.finished) return null;
    var st = lr._rj107;
    var v = voisins(lr);
    if (!st || !v.joueur || v.joueur.dnf) return null;
    if (st.n >= PLAFOND) return null;

    var cur = lr.cur || 0, total = lr.total || 0;
    if (cur === 0 || cur - st.dernierTour < ESPACEMENT) return null;
    if (lr._rjNeutral && lr._rjNeutral.active) return null; // pas de duel derrière la voiture de sécurité

    var finNeutre = lr._rjLastNeutralEndLap;
    if (finNeutre && finNeutre !== st.neutreVu && cur - finNeutre <= 1) return "relance";

    var reste = total - cur;
    var sousPression = (v.devant && v.ecartDevant < 2) || (v.derriere && v.ecartDerriere < 2);
    if (!st.faits.fin && reste >= 1 && reste <= 4 && sousPression) return "fin";

    var part = total ? cur / total : 0;
    if (!st.faits.duel && part >= 0.3 && part <= 0.75 && v.devant && v.ecartDevant < 1) return "duel";
    return null;
  }

  /* ------------------------------------------------------------------
   * Les décisions. mod > 0 : gain de rythme ; chance.failMod : la note
   * en cas d'échec. Rester au-dessus de -0.28, seuil d'abandon du moteur.
   * Espérance du choix osé (0.06 - 0.3 × 0.1 = 0.03) > choix sûr (0.012) :
   * oser doit payer en moyenne, sinon le choix n'en est pas un.
   * ---------------------------------------------------------------- */
  function ose(text, msg) {
    return { text: text, mod: 0.06, chance: { fail: 0.3, failMod: -0.1, msg: msg } };
  }
  function sur(text) { return { text: text, mod: 0.012 }; }

  function evenement(moment, lr) {
    var v = voisins(lr);
    // showLiveEvent injecte titre et textes tels quels dans innerHTML
    var nomDevant = v.devant ? esc(v.devant.name) : "la voiture devant";
    var nomDerriere = v.derriere ? esc(v.derriere.name) : "la voiture derrière";
    switch (moment) {
      case "relance":
        return {
          icon: "flag", color: "#34D399", title: "Relance de la course",
          desc: "La neutralisation prend fin. Le peloton est groupé : c'est le moment de surprendre.",
          choices: [
            ose("Relancer très tôt pour surprendre " + nomDevant, "Relance mal calée : on te reprend dans l'aspiration."),
            sur("Assurer la relance, pneus en température")
          ]
        };
      case "duel":
        return {
          icon: "flag", color: "#A78BFA", title: "Duel avec " + nomDevant,
          desc: "Tu es dans l'aileron de " + nomDevant + " depuis plusieurs tours. Une ouverture se dessine au freinage.",
          choices: [
            ose("Tenter le dépassement au freinage", "Freinage trop tardif : tu élargis et perds du temps."),
            sur("Patienter et mettre la pression")
          ]
        };
      case "fin":
        if (v.devant && v.ecartDevant < 2) {
          return {
            icon: "flag", color: "#EF4444", title: "Derniers tours : l'attaque",
            desc: nomDevant + " est à portée, à " + v.ecartDevant.toFixed(1).replace(".", ",") + " s. Il reste quelques tours pour aller le chercher.",
            choices: [
              ose("Tout donner jusqu'au drapeau", "Tu forces trop : erreur dans le dernier secteur."),
              sur("Gérer et ramener la voiture")
            ]
          };
        }
        return {
          icon: "flag", color: "#60A5FA", title: "Derniers tours : la défense",
          desc: nomDerriere + " revient fort. Il faut tenir jusqu'au drapeau à damier.",
          choices: [
            ose("Fermer chaque porte, quitte à prendre des risques", "Défense trop agressive : tu perds ton rythme."),
            sur("Rouler propre et tenir sa trajectoire")
          ]
        };
    }
    return null;
  }

  /* ------------------------------------------------------------------
   * Pose d'une décision par le chemin natif du moteur
   * ---------------------------------------------------------------- */
  function poser(moment, lr) {
    if (!lr || lr !== LR() || lr.finished || lr.paused || lr.pendingEvent) return false;
    if (visible("live-event-modal") || visible("rj106-modal")) return false;
    if (typeof window.showLiveEvent !== "function") return false;
    var ev = evenement(moment, lr);
    if (!ev) return false;
    var st = lr._rj107;
    st.n++;
    st.dernierTour = lr.cur || 0;
    st.faits[moment] = true;
    if (moment === "relance") st.neutreVu = lr._rjLastNeutralEndLap;
    lr.pendingEvent = ev;
    lr.paused = true;
    window.showLiveEvent(ev);
    return true;
  }

  function auDepart(lr) {
    lr = lr || LR();
    if (lr) lr._rj107 = { n: 0, dernierTour: 0, faits: {} };
  }

  /* Le hook de tour passe avant l'échéancier d'évènements du même tick :
     on diffère pour ne pas être écrasé, puis on revérifie. */
  function aChaqueTour(tour, lr) {
    majMini();
    var m = choixDuMoment(lr);
    if (!m) return;
    setTimeout(function () {
      try { if (choixDuMoment(lr) === m) poser(m, lr); } catch (e) { console.warn(TAG, e && e.message); }
    }, 0);
  }

  /* ------------------------------------------------------------------
   * Mini-classement, dans le bloc de progression (90 masque le reste)
   * ---------------------------------------------------------------- */
  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent =
      "#rj107-mini{margin-top:10px;border:1px solid var(--border-hi);border-radius:10px;background:var(--bg2);overflow:hidden}" +
      ".rj107-l{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:13px;color:var(--soft)}" +
      ".rj107-l+.rj107-l{border-top:1px solid var(--border-hi)}" +
      ".rj107-pos{min-width:32px;font-family:var(--font-display);font-weight:700}" +
      ".rj107-nom{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".rj107-ecart{font-variant-numeric:tabular-nums;color:var(--muted)}" +
      ".rj107-moi{color:#fff;font-weight:600}" +
      ".rj107-devant .rj107-ecart{color:var(--red)}" +
      ".rj107-derriere .rj107-ecart{color:var(--green)}";
    document.head.appendChild(s);
  }

  function ligne(cls, d, ecart) {
    return '<div class="rj107-l ' + cls + '"><span class="rj107-pos">P' + d.pos + '</span>' +
      '<span class="rj107-nom">' + esc(d.name) + '</span>' +
      '<span class="rj107-ecart">' + ecart + '</span></div>';
  }

  // Le moteur peut donner un écart nul entre deux voitures distinctes : jamais « 0,0 s ».
  function sec(x) { return Math.max(0.1, x).toFixed(1).replace(".", ",") + " s"; }

  function majMini() {
    var bloc = document.getElementById("rj90-progression");
    var lr = LR();
    var mini = document.getElementById("rj107-mini");
    var v = voisins(lr);
    if (!bloc || !lr || lr.finished || !v.joueur || v.joueur.dnf) { if (mini) mini.style.display = "none"; return; }
    if (!mini) {
      injecterCSS();
      mini = document.createElement("div");
      mini.id = "rj107-mini";
      mini.setAttribute("data-rj-noround", "1"); // l'arrondi global de 04q effaçait les dixièmes
      var barre = document.getElementById("rj90-barre");
      if (barre && barre.parentNode === bloc) bloc.insertBefore(mini, barre.nextSibling);
      else bloc.appendChild(mini);
    }
    mini.style.display = "";
    mini.innerHTML =
      (v.devant ? ligne("rj107-devant", v.devant, "−" + sec(v.ecartDevant)) : "") +
      ligne("rj107-moi", v.joueur, "") +
      (v.derriere ? ligne("rj107-derriere", v.derriere, "+" + sec(v.ecartDerriere)) : "");
  }

  /* ------------------------------------------------------------------
   * Installation
   * ---------------------------------------------------------------- */
  function inscrire(registre, hook) {
    if (!Array.isArray(window[registre])) window[registre] = [];
    if (!window[registre].some(function (h) { return h && h.id === ID; })) window[registre].push(hook);
  }

  function boot() {
    inscrire("RJ_RACE_START_HOOKS", { id: ID, apres: function (lr) { try { auDepart(lr); } catch (e) { console.warn(TAG, e && e.message); } } });
    inscrire("RJ_LAP_HOOKS", { id: ID, run: aChaqueTour });
    inscrire("RJ_LEADERBOARD_HOOKS", { id: ID, apres: function () { try { majMini(); } catch (e) { console.warn(TAG, e && e.message); } } });

    window.RJ107 = { voisins: voisins, choixDuMoment: choixDuMoment, evenement: evenement };
    window._rj107Uninstall = function () {
      REGISTRES.forEach(function (r) {
        if (!Array.isArray(window[r])) return;
        for (var i = window[r].length - 1; i >= 0; i--) {
          if (window[r][i] && window[r][i].id === ID) window[r].splice(i, 1);
        }
      });
      [document.getElementById("rj107-mini"), document.getElementById(CSS_ID)].forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      console.log(TAG, "désinstallé");
    };
    console.log(TAG, "actif — " + PLAFOND + " décisions au plus par course, mini-classement");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
