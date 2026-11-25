/* =====================================================================
 * 170-incidents.js — CE QUI ARRIVE EN PISTE A UNE CAUSE ET UNE SUITE
 *
 * POURQUOI
 * Mesuré sur 30 courses (v311) : aucune safety car. Son contrôle (04m) ne
 * tournait qu'au lancement de la boucle, une fois. Les « Safety Car ! » et
 * « Drapeau rouge ! » affichés étaient un décor : personne n'était sorti, le
 * peloton n'était pas regroupé. Aucun dépassement ne finissait mal et les
 * abandons n'avaient pas de cause.
 *
 * CE QUE FAIT LE MODULE, à chaque tour
 *   - ACCROCHAGES : une attaque manquée (81 : RJIncidents.attaque) ou le
 *     premier tour peuvent finir en contact : temps perdu, aileron cassé ou
 *     crevaison, parfois l'abandon, parfois 5 s de pénalité au fautif.
 *   - SORTIES : un pilote peu régulier, sous pression, sous la pluie ou entre
 *     des murs peut finir dans la barrière.
 *   - NEUTRALISATIONS : elles suivent un abandon, et lui seul. Voiture en
 *     panne : souvent rien, parfois la VSC. Accident : safety car selon le
 *     circuit, rarement drapeau rouge. Le peloton se regroupe (81), les
 *     écuries avancent leur arrêt, la relance se joue (107).
 *   - RISQUE DES CHOIX : le risque d'un choix dépend de ton niveau, de la
 *     pluie et des murs, au lieu d'être le même pour tous.
 * Les fausses neutralisations du moteur (04) sont retirées. Jamais d'abandon
 * du joueur par accident tiré au sort : il n'y serait pour rien.
 *
 * Réversible : window._rj170Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[170-incidents]", ID = "170-incidents";
  var DRS = ["Formule 1", "Formule 2", "Formule 3"];
  var PANNES = ["casse moteur", "boîte de vitesses bloquée", "fuite hydraulique", "perte de puissance", "problème de freins"];
  var PANNES_KART = ["chaîne cassée", "moteur serré", "problème de carburation"];
  /* Accrochages : probabilité par attaque manquée, et que le premier tour en crée un. */
  var CONTACT = { "Karting Junior": .006, "Karting Senior": .005, "Formule 4": .005, "Formula Regional": .003, "Formule 3": .004, "Formule 2": .003, "Formule 1": .0016, "Super Formula": .0014, "Endurance WEC": .0008, "IndyCar": .0007 };
  var DEPART = { "Karting Junior": .3, "Karting Senior": .28, "Formule 4": .4, "Formula Regional": .35, "Formule 3": .4, "Formule 2": .35, "Formule 1": .3, "Super Formula": .25, "Endurance WEC": .25, "IndyCar": .25 };
  var SORTIE = .0004;        // par tour et par pilote, régularité 0,8, piste sèche

  function LR() { return window.LIVE_RACE || null; }
  function cat() { return (window.G && G.cat) || ""; }
  function kart() { return /Karting/.test(cat()); }
  function circuit() { return (window.RACE_STATE && RACE_STATE.circuitData) || {}; }
  function mouille() { var w = window.RACE_STATE && RACE_STATE.weather; return !!w && (w.id === "wet" || w.id === "storm"); }
  function rue() { return circuit().type === "street"; }
  function court(n) { var m = String(n || "").trim().split(/\s+/); return m.length > 1 ? m.slice(1).join(" ") : m[0] || ""; }
  function entre(a, b) { return a + Math.random() * (b - a); }
  function auHasard(L) { return L[Math.floor(Math.random() * L.length)]; }
  function rival(d) { return (typeof d.rivalIdx === "number" && G.rivals && G.rivals[d.rivalIdx]) || null; }
  function neutre(lr) { return !!(lr._rjNeutral && lr._rjNeutral.active); }

  /* Niveau d'un pilote pour un geste (0 à 1). */
  function niveau(d, geste) {
    if (!d.isPlayer) { var r = rival(d); return r && typeof r.skill === "number" ? r.skill / 100 : .75; }
    var s = G.substats || {}, K = geste === "defense" ? ["pression", "concentration", "freinage"] : ["freinage", "decision", "reactivite"];
    return K.reduce(function (t, k) { return t + (typeof s[k] === "number" ? s[k] : 60); }, 0) / K.length / 100;
  }
  function regularite(d) {
    if (d.isPlayer) return (G.stats && typeof G.stats.regularite === "number") ? G.stats.regularite / 100 : .75;
    var r = rival(d); return r && typeof r.consistency === "number" ? r.consistency : .8;
  }

  /* Ce qui multiplie (et ajoute à) la chance de passer, lu par 81. */
  function elan(d, devant, ecart, lr) {
    var f = Math.exp(1.6 * Math.max(-.25, Math.min(.25, niveau(d, "attaque") - niveau(devant, "defense")))), plus = 0;
    var siege = d._rj170Siege && d._rj170Siege.nom === devant.name ? d._rj170Siege.n : 0;
    f *= 1 + Math.min(.5, siege * .06);                                  // plus on met la pression, plus ça s'ouvre
    if (mouille()) f *= 1.15;
    if (lr.total && lr.cur / lr.total > .9) f *= 1.15;                   // derniers tours : on ose
    var relance = lr._rjLastNeutralEndLap;
    if (relance !== undefined && lr.cur - relance <= 1) f *= 1.5;       // peloton groupé
    else if (drs(lr) && ecart < 1) plus = .055 * (circuit().drsZones || 2) * Math.max(.1, Math.min(1.3, (circuit().overtake || .35) / .4));
    return { f: f, plus: plus };
  }
  function drs(lr) { return DRS.indexOf(cat()) >= 0 && lr.cur > 2 && !mouille(); }

  /* ------------------------------------------------------------------
   * Accrochages
   * ---------------------------------------------------------------- */
  function dire(texte, joueur, fort) { try { if (window.RJBandeau) RJBandeau.poser(texte, joueur ? 8 : fort ? 5 : 2); } catch (e) {} }
  function noter(lr, texte, note, mauvais) {
    if (!window.RACE_STATE || !Array.isArray(RACE_STATE.eventsLog)) return;
    RACE_STATE.eventsLog.push({ lap: lr.cur, phase: "Tour " + lr.cur, text: texte, choice: "—", note: note, sign: mauvais ? "−" : "~", color: mauvais ? "#EF4444" : "#F59E0B" });
  }
  function abandonPossible(d) { return !d.isPlayer && !(window.G && G._noDnf); }
  function sortir(lr, d, cause) {
    d.dnf = true; d.score = 0; d._dnfAtLap = lr.cur || 1; d._rj170Cause = cause;
    noter(lr, d.name + " abandonne", cause.texte, true);
  }
  function contact(d, devant, lr, depart) {
    var L = lr._rj170 = lr._rj170 || [], x = Math.random(), nd = court(d.name), nv = court(devant.name), moi = !!(d.isPlayer || devant.isPlayer), suite = "léger";
    var qui = x < .72 ? null : Math.random() < .6 ? d : devant;          // qui paie le gros prix
    var perte = function (a, s) { a._rj81EvtSec = (a._rj81EvtSec || 0) + s; };
    perte(d, entre(1.5, 4)); perte(devant, entre(.8, 2.5));
    if (qui) {
      if (x > (kart() ? .95 : .88) && abandonPossible(qui)) { suite = "abandon"; sortir(lr, qui, { type: "accident", texte: "Accrochage entre " + nd + " et " + nv }); }
      else { suite = kart() ? "sortie" : "dégâts"; perte(qui, kart() ? entre(6, 10) : entre(14, 22)); }
    }
    var penalite = !depart && Math.random() < .35;
    if (penalite) {
      d.penaltySec = (d.penaltySec || 0) + 5;
      (d.penaltyLog = d.penaltyLog || []).push({ sec: 5, reason: "Accrochage avec " + devant.name, lap: lr.cur });
    }
    L.push({ tour: lr.cur, a: d.name, b: devant.name, suite: suite, depart: !!depart, penalite: penalite, joueur: moi });
    var fin = suite === "abandon" ? court(qui.name) + " abandonne." : suite === "dégâts" ? auHasard(["Aileron cassé pour ", "Crevaison pour "]) + court(qui.name) + "." : suite === "sortie" ? court(qui.name) + " finit dans l'herbe." : "Les deux repartent.";
    dire((depart ? "Accrochage au premier tour : " : "Contact ! ") + nd + " et " + nv + " se touchent. " + fin + (penalite ? " 5 s pour " + nd + "." : ""), moi, suite !== "léger");
    if (moi && suite !== "abandon") noter(lr, "Contact avec " + (d.isPlayer ? devant.name : d.name), fin + (penalite ? " 5 s de pénalité pour " + nd + "." : ""), true);
  }
  /* 81 rend compte de chaque attaque : passée ou manquée. */
  function attaque(d, devant, passe, lr) {
    if (passe) { d._rj170Siege = null; }
    else {
      var s = d._rj170Siege && d._rj170Siege.nom === devant.name ? d._rj170Siege : { nom: devant.name, n: 0 };
      s.n++; d._rj170Siege = s;
    }
    var p = (CONTACT[cat()] || .002) * (mouille() ? 1.6 : 1) * (rue() ? 1.2 : 1) * Math.max(.4, (1.25 - regularite(d)) / .45) * (passe ? .6 : 1);
    /* Un contact au plus par pilote et par tour ; appliqué une fois le tour calculé. */
    if (Math.random() < p) (lr._rj170Attente = lr._rj170Attente || []).push([d, devant]);
  }

  function premierTour(lr) {
    if (Math.random() >= (DEPART[cat()] || .25) * (mouille() ? 1.3 : 1)) return;
    var L = lr.drivers.filter(function (d) { return !d.dnf && !d._mc; }).sort(function (a, b) { return a.pos - b.pos; });
    if (L.length < 6) return;
    var i = 2 + Math.floor(Math.random() * (L.length - 4));              // milieu de peloton, là où ça se resserre
    contact(L[i + 1], L[i], lr, true);
  }

  function sorties(lr) {
    var base = SORTIE * (kart() ? .4 : 1) * (mouille() ? 2.2 : 1) * (rue() ? 1.6 : 1);
    lr.drivers.forEach(function (d) {
      if (!d || d.dnf || !abandonPossible(d)) return;
      var p = base * Math.max(.3, (1.25 - regularite(d)) / .45) * (d._rj170Siege && d._rj170Siege.n > 2 ? 1.4 : 1);
      if (Math.random() >= p) return;
      sortir(lr, d, { type: "accident", texte: auHasard(rue() ? ["Dans le mur", "Suspension arrachée contre le rail"] : mouille() ? ["Aquaplaning, dans le bac à graviers", "Sortie sous la pluie"] : ["Sortie de piste, voiture ensablée", "Tête-à-queue dans la barrière"]) });
    });
  }

  /* ------------------------------------------------------------------
   * Neutralisations
   * ---------------------------------------------------------------- */
  function nouveauxAbandons(lr) {
    var vus = lr._rj170Vus = lr._rj170Vus || {}, L = [];
    lr.drivers.forEach(function (d) {
      if (!d || !d.dnf || vus[d.name]) return;
      vus[d.name] = 1;
      // abandon venu du moteur (04) : son journal dit si c'est une sortie de piste
      var log = ((window.RACE_STATE && RACE_STATE.eventsLog) || []).slice(-6).filter(function (e) { return String(e.text || "").indexOf(d.name) >= 0 || d.isPlayer; }).map(function (e) { return e.text + " " + e.note; }).join(" ");
      if (!d._rj170Cause && /sortie|glissade|aquaplan|accroch|tête-à-queue/i.test(log)) d._rj170Cause = { type: "accident", texte: "Sortie de piste" };
      if (!d._rj170Cause) d._rj170Cause = { type: "panne", texte: auHasard(kart() ? PANNES_KART : PANNES) };
      L.push(d);
    });
    return L;
  }
  function genre(L) {
    if (kart()) return null;
    var accidents = L.filter(function (d) { return d._rj170Cause.type === "accident"; }).length, x = Math.random();
    var danger = Math.max(.1, Math.min(.6, circuit().safety == null ? .3 : circuit().safety));
    var pluie = mouille() ? .1 : 0, ovale = typeof _isOvalRace === "function" && _isOvalRace() ? .5 : 0;
    if (accidents) {
      if (x < .03 + (accidents > 1 ? .12 : 0) + pluie / 2) return "rf";
      if (x < .34 + danger * .8 + pluie + ovale) return "sc";
      return x < .85 && cat() !== "IndyCar" ? "vsc" : null;
    }
    if (x < .08 + danger * .25 + ovale) return "sc";
    return x < .34 && cat() !== "IndyCar" ? "vsc" : null;
  }
  function demarrer(type, lr, d) {
    var bref = lr.total <= 20, duree = type === "rf" ? 1 : type === "vsc" ? 1 + Math.round(Math.random()) : bref ? 2 : 3 + Math.round(Math.random());
    if (lr.total - lr.cur <= duree) return false;                        // trop tard : on finit sous drapeaux locaux
    lr._rjNeutral = { active: true, type: type, startLap: lr.cur, endLap: lr.cur + duree, duration: duree, cause: d.name + " — " + d._rj170Cause.texte, regrouped: true, restartTriggered: false };
    lr._rj170Neutres = (lr._rj170Neutres || 0) + 1;
    var nom = { vsc: "VSC", sc: "Safety car", rf: "Drapeau rouge" }[type];
    var ici = court(d.name) + " (" + d._rj170Cause.texte.toLowerCase() + ")";
    dire(nom + " : " + court(d.name) + ", " + d._rj170Cause.texte.toLowerCase().split(",")[0] + ".", true);
    try { if (typeof rjRadioPush === "function") rjRadioPush("ingenieur", { vsc: "VSC, VSC. Respecte le delta.", sc: "Safety car. On se regroupe, reste concentré.", rf: "Drapeau rouge. Tu rentres doucement." }[type]); } catch (e) {}
    noter(lr, nom, ici, false);
    if (type !== "vsc") avancerArrets(lr);
    return true;
  }
  /* Sous safety car, l'arrêt restant est avancé : tout le monde rentre ensemble. */
  function avancerArrets(lr) {
    if (!lr._rj82Pits || lr.cur < lr.total * .2 || lr.cur + 1 >= lr.total - 1) return;
    lr.drivers.forEach(function (d) {
      var tours = !d.dnf && lr._rj82Pits[d.name], k = d._pitsDone || 0;
      if (tours && tours[k] > lr.cur && tours[k] - lr.cur <= lr.total * .3) tours[k] = lr.cur + 1;
    });
  }
  function finir(lr) {
    lr._rjNeutral.active = false;
    lr._rjLastNeutralEndLap = lr.cur;
    dire(lr._rjNeutral.type === "vsc" ? "Fin de la VSC, on repart." : "Drapeau vert : la course est relancée !", true);
  }

  function aChaqueTour(tour, lr) {
    lr = lr || LR();
    if (!lr || !lr.drivers || lr.finished || lr.cur >= lr.total) return;
    if (neutre(lr)) {
      nouveauxAbandons(lr); lr._rj170Attente = null;
      if (lr.cur >= lr._rjNeutral.endLap) finir(lr);
      return;
    }
    if (tour === 1) premierTour(lr);
    var touches = {};
    (lr._rj170Attente || []).forEach(function (c) {
      var a = c[0], b = c[1];
      if (a.dnf || b.dnf || touches[a.name] || touches[b.name]) return;
      touches[a.name] = touches[b.name] = 1; contact(a, b, lr);
    });
    lr._rj170Attente = null;
    if (tour > 1) sorties(lr);
    var L = nouveauxAbandons(lr);
    if (!L.length) return;
    L.sort(function (a, b) { return (a._rj170Cause.type === "accident" ? 0 : 1) - (b._rj170Cause.type === "accident" ? 0 : 1); });
    L.filter(function (d) { return !d._mc; }).forEach(function (d) { if (!d.isPlayer) dire("Abandon de " + court(d.name) + " : " + d._rj170Cause.texte.toLowerCase() + ".", false, true); });
    var repos = lr._rjLastNeutralEndLap === undefined || lr.cur - lr._rjLastNeutralEndLap >= 3, plafond = /WEC|IndyCar/.test(cat()) ? 3 : 2, g = repos && (lr._rj170Neutres || 0) < plafond ? genre(L) : null;
    if (g) demarrer(g, lr, L[0]);
  }

  /* ------------------------------------------------------------------
   * Risque d'un choix : selon le niveau, la pluie et les murs
   * ---------------------------------------------------------------- */
  function ajuster(ev) {
    if (!ev || ev._rj170 || !Array.isArray(ev.choices)) return;
    ev._rj170 = true;
    var lr = LR(), j = lr && lr.drivers && lr.drivers.find(function (d) { return d.isPlayer; });
    if (!j) return;
    var f = 1.5 - .75 * (niveau(j, "attaque") + niveau(j, "defense")) / 2;
    if (mouille()) f *= 1.25;
    if (rue()) f *= 1.1;
    ev.choices.forEach(function (c) {
      if (!c || !c.chance || !(c.chance.fail > 0) || c._rj170Reel) return;
      c.chance = Object.assign({}, c.chance, { fail: Math.max(.03, Math.min(.75, c.chance.fail * f)) });
    });
  }

  function boot() {
    if (typeof rjInscrire !== "function" || !Array.isArray(window.RJ_LAP_HOOKS) || typeof window.showLiveEvent !== "function" || typeof PASSIVE_EVENTS === "undefined") return setTimeout(boot, 100);
    window.RJ_LAP_HOOKS.push({ id: ID, run: aChaqueTour });
    rjInscrire("showLiveEvent", { id: ID + ":risque", ordre: -8000, avant: function (args) { try { ajuster(args[0]); } catch (e) { console.warn(TAG, e && e.message); } } });
    for (var i = PASSIVE_EVENTS.length - 1; i >= 0; i--) if (/safety|^sc$|vsc|slow_zone|red_flag|full_course/i.test(PASSIVE_EVENTS[i].id || "")) PASSIVE_EVENTS.splice(i, 1);
    window.RJIncidents = { attaque: attaque, elan: elan, drs: drs, ajuster: ajuster, surTour: aChaqueTour, demarrer: demarrer, niveau: niveau, contact: contact };
    window._rj170Uninstall = function () {
      window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(function (h) { return !h || h.id !== ID; });
      rjDesinscrire([ID], "showLiveEvent"); delete window.RJIncidents;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
