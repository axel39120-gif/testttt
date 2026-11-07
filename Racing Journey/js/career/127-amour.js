/* =====================================================================
 * 127-amour.js — LA VIE AMOUREUSE
 *
 * POURQUOI
 * La relation amoureuse n'existait que si un événement faisait apparaître un
 * partenaire, puis se résumait à une jauge qui baissait chaque semaine.
 *
 * CE QUE FAIT LE MODULE
 *  - Qui l'on rencontre dépend de l'âge (pas avant 18 ans) et de la
 *    réputation : une personne discrète, quelqu'un de connu, ou une
 *    célébrité quand ton nom fait les gros titres. La rencontre est le
 *    moment « rencontre » de 125.
 *  - Un couple avance par étapes, chacune annoncée par un message à choix :
 *    vie commune, fiançailles, mariage, puis l'envie d'un enfant, une
 *    grossesse et une naissance. Chaque étape demande du temps ensemble et
 *    une relation solide, et un âge raisonnable.
 *  - Une relation négligée longtemps mène à « il faut qu'on parle » : se
 *    battre pour le couple, ou rompre.
 *  - La presse people suit : rumeurs de couple, mariage, naissance, rupture
 *    (catégorie « Vie privée » de Médias › Presse, 123), d'autant plus que
 *    la personne est connue.
 *  - Un couple heureux et des enfants donnent du bonheur au fil des semaines.
 *
 * Réversible : window._rj127Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[127-amour]";
  function hasard(t) { return t[Math.floor(Math.random() * t.length)]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function R() { return getRelations(); }
  function pilote() { try { var n = ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim(); if (n) return n; } catch (e) {} return "Le pilote"; }

  /* ------------------------------------------------------- rencontres --- */
  var PROFILS = {
    discret:   { lbl: "Vie discrète", noms: ["Clara Vidal", "Sacha Morel", "Noa Bernard", "Lou Ferreira", "Inès Garnier", "Hugo Lemoine"], metiers: ["infirmière", "architecte", "professeur", "kiné", "photographe"] },
    connu:     { lbl: "Personnalité connue", noms: ["Emma Rossi", "Alex Laurent", "Maya Costa", "Léon Hart"], metiers: ["présentatrice télé", "joueur de tennis", "influenceuse", "styliste"] },
    celebrite: { lbl: "Célébrité", noms: ["Lana Rivière", "Zoé Marchetti", "Jade Okoro", "Nina Valenti"], metiers: ["chanteuse", "actrice", "mannequin", "pop star"] }
  };
  function peutRencontrer() { return (G.age || 16) >= 18 && !R().partner; }
  /* La réputation décide de qui croise ta route : en haut de l'affiche,
     les célébrités ; à mi-chemin, des visages connus ; sinon, la vraie vie. */
  function pretendant(rep) {
    rep = rep == null ? (G.reputation || 0) : rep;
    var profil = rep >= 75 ? "celebrite" : rep >= 45 ? "connu" : "discret", p = PROFILS[profil];
    return { qui: hasard(p.noms), profil: profil, metier: hasard(p.metiers) };
  }

  /* --------------------------------------------------------- la presse --- */
  var TABLOIDS = ["The Paddock Post", "Circuito"];
  function rumeur(titre) {
    if (!G._rjPresse) G._rjPresse = { medias: {}, promesses: [], revue: [], polemique: 0 };
    var p = G._rjPresse;
    p.people = p.people || [];
    p.people.unshift({ s: G.saison || 1, w: G.semaine || 1, media: hasard(TABLOIDS), titre: titre });
    if (p.people.length > 10) p.people.length = 10;
  }

  /* ------------------------------------------------------- le couple ---- */
  function couple() {
    var p = R().partner;
    if (!p) return null;
    if (!p.etape) {
      p.etape = "couple"; p.semaines = 0; p.profil = p.profil || "discret";
      if (p.profil !== "discret") rumeur(pilote() + " et " + p.name + " : la photo qui affole les réseaux");
    }
    return p;
  }
  function enfants() { var r = R(); return r.enfants || (r.enfants = []); }
  var PRENOMS = ["Léo", "Rose", "Nino", "Alma", "Gabriel", "Lina", "Marius", "Louise"];

  function bonheur(d) { G.happiness = Math.max(0, Math.min(100, (G.happiness || 50) + d)); }
  function proche(d) { var p = R().partner; if (p) { p.closeness = Math.max(0, Math.min(100, p.closeness + d)); p.lastContact = G.semaine || 1; } }

  /* Étapes : condition, message, effets des réponses. */
  var ETAPES = {
    vie_commune: { apres: "couple", semaines: 12, age: 19, proche: 60,
      mail: function (p) { return { subject: "On emménage ensemble ?", body: p.name + " a trouvé un appartement pour deux, pas loin de l'usine. « Et si on se lançait ? »",
        actions: [{ label: "Oui, on se lance", kind: "accept", rj127: { etape: "vie_commune", proche: 10, bonheur: 6, budget: -3000 } },
                  { label: "Pas encore, la saison d'abord", kind: "refuse", rj127: { proche: -6 } }] }; } },
    fiancailles: { apres: "vie_commune", semaines: 24, age: 21, proche: 70,
      mail: function (p) { return { subject: "La bague", body: "Ton meilleur ami te glisse : « Ça fait un moment que tu parles de " + p.name + "… Tu y penses, à la demande ? »",
        actions: [{ label: "Faire ma demande (8 000 €)", kind: "accept", rj127: { etape: "fiancailles", proche: 15, bonheur: 10, budget: -8000, presse: "{pilote} a demandé {nom} en mariage" } },
                  { label: "Plus tard", kind: "refuse", rj127: {} }] }; } },
    mariage: { apres: "fiancailles", semaines: 20, age: 22, proche: 65,
      mail: function (p) { return { subject: "La date du mariage", body: p.name + " a réservé une date entre deux courses. Grand mariage ou cérémonie intime ?",
        actions: [{ label: "Grand mariage (40 000 €)", kind: "accept", rj127: { etape: "marie", proche: 15, bonheur: 15, mental: 4, budget: -40000, presse: "Le mariage de l'année : {pilote} et {nom} se sont dit oui" } },
                  { label: "Cérémonie intime (6 000 €)", kind: "reply", rj127: { etape: "marie", proche: 12, bonheur: 12, mental: 4, budget: -6000, presse: "{pilote} et {nom} se sont mariés en secret" } }] }; } },
    enfant: { apres: ["marie", "vie_commune"], semaines: 30, age: 24, proche: 70,
      mail: function (p) { return { subject: "Et si on agrandissait la famille ?", body: p.name + " t'en parle un soir, doucement : « On en parle depuis longtemps… On se lance ? »",
        actions: [{ label: "Oui, j'en rêve", kind: "accept", rj127: { grossesse: true, proche: 12, bonheur: 8 } },
                  { label: "Attendons la fin de ma carrière", kind: "refuse", rj127: { proche: -8 } }] }; } }
  };

  function envoyer(o, type) {
    var avant = getMailbox()[0];
    pushMail({ from: (R().partner && R().partner.name) || "Ton couple", role: "family", subject: o.subject, body: o.body, actions: o.actions });
    var m = getMailbox()[0];
    if (!m || m === avant) return null;
    m.rj127 = type; m.rj124Garde = true;   // une étape de vie n'expire pas
    return m;
  }
  function appliquer(eff, p) {
    if (!eff) return;
    if (eff.proche) proche(eff.proche);
    if (eff.bonheur) bonheur(eff.bonheur);
    if (eff.mental && typeof changeMental === "function") { try { changeMental(eff.mental, "Vie de couple"); } catch (e) {} }
    if (eff.budget) G.budget = (G.budget || 0) + eff.budget;
    if (p && eff.etape) { p.etape = eff.etape; p.semainesEtape = 0; }
    if (p && eff.grossesse) p.grossesse = 0;
    if (p && eff.presse && p.profil) rumeur(eff.presse.replace("{pilote}", pilote()).replace("{nom}", p.name));
    if (eff.rupture) rompre();
  }

  function rompre() {
    var p = R().partner;
    if (!p) return;
    if (p.profil !== "discret" || (G.reputation || 0) >= 45) rumeur("C'est fini entre " + pilote() + " et " + p.name);
    R().ex = (R().ex || []).concat([{ name: p.name, saison: G.saison || 1 }]);
    R().partner = null;
    bonheur(-10);
  }

  function tick(n) {
    n = n || 1;
    var p = couple();
    if (!p) return;
    p.semaines = (p.semaines || 0) + n;
    p.semainesEtape = (p.semainesEtape || 0) + n;
    /* Naissance : neuf mois, soit trente-six semaines de jeu. */
    if (p.grossesse != null) {
      p.grossesse += n;
      if (p.grossesse >= 36) {
        p.grossesse = null;
        var nom = hasard(PRENOMS);
        enfants().push({ prenom: nom, saison: G.saison || 1, semaine: G.semaine || 1 });
        bonheur(15); proche(10);
        if (typeof changeMental === "function") { try { changeMental(5, "Naissance"); } catch (e) {} }
        envoyer({ subject: "Bienvenue " + nom + " !", body: nom + " est arrivé cette semaine. " + p.name + " va bien. Toute l'équipe t'envoie ses félicitations." }, "naissance");
        rumeur(pilote() + " devient parent : bienvenue à " + nom);
      }
    }
    /* Une relation glacée mène à la conversation difficile. */
    p.froid = p.closeness < 25 ? (p.froid || 0) + n : 0;
    if (p.froid >= 4 && !p.crise) {
      p.crise = true;
      envoyer({ subject: "Il faut qu'on parle", body: "On ne se voit plus. Tu es toujours sur un circuit, et moi je t'attends. Je ne sais plus si ça a un sens.",
        actions: [{ label: "Tout faire pour nous sauver (2 PA)", kind: "accept", rj127: { proche: 20, bonheur: 2, pa: -2, crise: true } },
                  { label: "On arrête là", kind: "refuse", rj127: { rupture: true } }] }, "crise");
      return;
    }
    if (p.attente) return;
    Object.keys(ETAPES).forEach(function (k) {
      var e = ETAPES[k];
      if (p.attente || p["fait_" + k]) return;
      var avant = [].concat(e.apres);
      if (avant.indexOf(p.etape) < 0 || (k === "enfant" && (p.grossesse != null || enfants().length >= 3))) return;
      if (p.semainesEtape < e.semaines || p.closeness < e.proche || (G.age || 16) < e.age) return;
      p["fait_" + k] = true;
      if (envoyer(e.mail(p), k)) p.attente = k;
    });
    /* Le bonheur d'un foyer solide, toutes les quatre semaines. */
    if (p.semaines % 4 < n && (p.closeness >= 70 || enfants().length)) bonheur(1 + Math.min(2, enfants().length));
  }

  /* Célibataire en vue : les tabloïds s'emballent de temps en temps. */
  function ragots() {
    if (R().partner || (G.reputation || 0) < 60 || Math.random() > 0.12) return;
    var c = PROFILS.celebrite;
    rumeur(pilote() + " aperçu avec " + hasard(c.noms) + " à Monaco : simple amitié ?");
  }

  /* --------------------------------------------------------- l'écran ---- */
  var LIB_ETAPE = { couple: "En couple", vie_commune: "Vie commune", fiancailles: "Fiancés", marie: "Mariés" };
  function injecter() {
    var hote = document.getElementById("vp-content");
    if (!hote) return;
    var p = R().partner, es = R().enfants || [], bloc = document.getElementById("rj127-bloc") || document.createElement("div");
    bloc.id = "rj127-bloc";
    if (!p && !es.length) { bloc.innerHTML = ""; return; }
    var h = '<div class="t-sec">Ton foyer</div><div class="rj127-foyer">';
    if (p) h += '<div class="rj127-carte"><small>' + esc(LIB_ETAPE[p.etape] || "En couple") + (p.grossesse != null ? " · un bébé en route" : "") + "</small><b>" + esc(p.name) + "</b><span>" +
      esc((PROFILS[p.profil] || PROFILS.discret).lbl) + (p.metier ? " · " + esc(p.metier) : "") + " · " + Math.round(p.closeness) + " de complicité</span></div>";
    if (es.length) h += '<div class="rj127-carte enfants"><small>Enfant' + (es.length > 1 ? "s" : "") + "</small><b>" + es.map(function (e) { return esc(e.prenom); }).join(", ") + "</b><span>" +
      es.map(function (e) { return "arrivé en saison " + e.saison; }).join(" · ") + "</span></div>";
    bloc.innerHTML = h + "</div>";
    var avant = document.getElementById("rj125-bloc");
    hote.insertBefore(bloc, avant ? avant.nextSibling : hote.firstChild);
  }

  /* ------------------------------------------------------ installation --- */
  function installer() {
    if (typeof rjInscrire !== "function" || typeof getRelations !== "function" || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !window._rj125) return false;
    window.WEEKLY_TICK_HOOKS.push({ id: "127-amour", run: function (n) { try { tick(n); ragots(); } catch (e) { console.warn(TAG, e && e.message); } } });
    rjInscrire("handleMailAction", { id: "127-amour:handleMailAction", apres: function (res, args) {
      var m = getMailbox().filter(function (x) { return x.id === args[0]; })[0];
      var a = m && m.rj127 && m.actions && m.actions[args[1]], p = R().partner;
      if (!a || !a.rj127 || m.rj127Traite) return;
      m.rj127Traite = true;
      if (p) p.attente = null;
      if (a.rj127.pa) G.pa = Math.max(0, (G.pa || 0) + a.rj127.pa);
      if (a.rj127.crise && p) { p.crise = false; p.froid = 0; }
      appliquer(a.rj127, p);
    } });
    rjInscrire("renderVieperso", { id: "127-amour:renderVieperso", apres: function () { injecter(); } });
    return true;
  }
  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — rencontres, couple, enfants, presse people"); return; }
    if (essais++ < 80) setTimeout(boot, 150);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window._rj127 = { pretendant: pretendant, peutRencontrer: peutRencontrer, tick: tick, rompre: rompre, rumeur: rumeur, couple: couple, ETAPES: ETAPES };
  window._rj127Uninstall = function () {
    window.WEEKLY_TICK_HOOKS = (window.WEEKLY_TICK_HOOKS || []).filter(function (h) { return h.id !== "127-amour"; });
    rjDesinscrire(["127-amour:"]);
    var b = document.getElementById("rj127-bloc"); if (b) b.remove();
    delete window._rj127;
  };
})();
