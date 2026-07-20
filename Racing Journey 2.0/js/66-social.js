/* =====================================================================
 * 66-social.js — DEUX RÉSEAUX SOCIAUX DISTINCTS
 *
 * L'onglet « Réseaux sociaux » n'en contenait qu'un seul, mi-Instagram
 * mi-générique : un compteur de followers, quatre boutons de tonalité et
 * un post par semaine. Ce module le remplace entièrement par deux réseaux
 * qui ne se jouent pas de la même façon.
 *
 *  X (ex-Twitter) — le pilote ÉCRIT vraiment ses messages (280 signes),
 *    seul ou à partir de suggestions liées à sa dernière course. Deux
 *    publications par semaine. L'audience réagit vite et fort : les gains
 *    sont supérieurs, mais un message mal tourné après un mauvais résultat
 *    peut se retourner contre lui. C'est le réseau qui parle aux médias.
 *
 *  INSTAGRAM — le pilote PUBLIE DE VRAIES PHOTOS, choisies parmi des
 *    scènes générées (podium, paddock, coulisses, entraînement, casque,
 *    circuit au crépuscule, vie perso), avec une légende. Une publication
 *    par semaine. La progression est plus lente mais régulière, sans
 *    risque de retour de bâton, et elle nourrit la cote auprès du public
 *    et la valeur commerciale.
 *
 * Les deux comptes ont leur propre audience : elles ne progressent ni au
 * même rythme ni pour les mêmes raisons.
 *
 * Réversible : window._rj66Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var wrapped = {};
  var etat = { installe: false, erreur: null };
  window._rj66Status = function () { return etat; };

  var ONGLET = "x";   // réseau affiché

  /* ------------------------------------------------------------- état --- */
  function S() {
    if (typeof G === "undefined" || !G) return null;
    if (!G._rjSocial) {
      var base = G.igFollowers || 0;
      G._rjSocial = {
        x:  { f: Math.round(base * 0.55), posts: [], sem: 0, nb: 0 },
        ig: { f: base, posts: [], sem: 0, nb: 0 }
      };
    }
    return G._rjSocial;
  }

  function semaine() { try { return (G.saison || 1) * 100 + (G.semaine || 1); } catch (e) { return 0; } }

  function restant(res) {
    var s = S(); if (!s) return 0;
    var max = (res === "x") ? 2 : 1;
    if (s[res].sem !== semaine()) return max;
    return Math.max(0, max - (s[res].nb || 0));
  }

  function consommer(res) {
    var s = S(); if (!s) return;
    if (s[res].sem !== semaine()) { s[res].sem = semaine(); s[res].nb = 0; }
    s[res].nb++;
  }

  function fmt(n) {
    n = Math.round(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "") + " M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(".0", "") + " k";
    return String(n);
  }

  function pseudo() {
    try {
      var norm = function (t) { return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
      return norm(G.pilot.prenom) + norm(G.pilot.nom) + (G.pilot.number || "");
    } catch (e) { return "pilote"; }
  }

  function dernierResultat() {
    try {
      var r = (G.races || []).slice(-1)[0];
      if (!r) return null;
      return r.pos || 0;
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------- retombées --- */
  function appliquer(res, gainF, repMedias, repPublic) {
    var s = S(); if (!s) return;
    s[res].f = Math.max(0, Math.round(s[res].f + gainF));
    // Instagram reste la référence commerciale du jeu : on garde G.igFollowers aligné.
    if (res === "ig") { try { G.igFollowers = s.ig.f; } catch (e) {} }
    try {
      if (G.rep) {
        if (repMedias) G.rep.medias = Math.max(0, Math.min(100, (G.rep.medias || 0) + repMedias));
        if (repPublic) G.rep.public = Math.max(0, Math.min(100, (G.rep.public || 0) + repPublic));
      }
    } catch (e) {}
    try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
  }

  /* ============================================================ X ======= */
  function suggestionsX() {
    var pos = dernierResultat();
    var base = [
      "Semaine de travail au simulateur. On ne lâche rien.",
      "Merci pour tous vos messages, ça compte plus que vous ne le croyez.",
      "Nouveau week-end, nouvelle occasion. On y va."
    ];
    if (pos === 1) return ["VICTOIRE. Merci à toute l'équipe, ce résultat est le vôtre.",
                           "On a travaillé toute la semaine pour ça. Savourons, puis au boulot.",
                           "Première place. Il n'y a pas de mots."].concat(base);
    if (pos && pos <= 3) return ["Podium ! Une belle récompense pour l'équipe.",
                                 "On progresse à chaque course. Merci à tous."].concat(base);
    if (pos === 0) return ["Abandon aujourd'hui. Déçu, mais on analyse et on revient.",
                           "Ça fait partie du sport. On relève la tête."].concat(base);
    if (pos && pos > 10) return ["Week-end compliqué. On va comprendre pourquoi.",
                                 "Pas le résultat espéré. L'équipe mérite mieux, on va chercher ça."].concat(base);
    return base;
  }

  // Analyse sommaire du ton : sert à mesurer le risque de retour de bâton.
  function tonalite(txt) {
    var t = (txt || "").toLowerCase();
    var neg = /(nul|honte|incompétent|scandale|jamais vu ça|ridicule|dégoût|colère|faute de l'équipe|leur faute)/.test(t);
    var arrogant = /(imbattable|personne ne peut|les autres sont|facile|trop fort pour)/.test(t);
    var merci = /(merci|équipe|ensemble|fier|bravo)/.test(t);
    if (neg || arrogant) return "risque";
    if (merci) return "fédérateur";
    return "neutre";
  }

  window._rj66PublierX = function () {
    var ta = document.getElementById("rj66-x-texte");
    if (!ta) return;
    var txt = String(ta.value || "").trim();
    if (!txt) return;
    if (restant("x") <= 0) return;
    var s = S();
    var ton = tonalite(txt);
    var pos = dernierResultat();

    // X : audience réactive, gains supérieurs mais volatils
    var socle = Math.max(40, s.x.f * 0.02);
    var mult = ton === "fédérateur" ? 1.25 : ton === "risque" ? 1.6 : 1;
    var gain = Math.round(socle * mult * (0.7 + Math.random() * 0.8));
    var badBuzz = false;
    if (ton === "risque" && Math.random() < 0.45) {
      badBuzz = true;
      gain = Math.round(gain * 0.5);
    }
    var repM = ton === "fédérateur" ? 1 : badBuzz ? -2 : 0;

    s.x.posts.unshift({
      txt: txt, sem: semaine(), ton: ton, badBuzz: badBuzz,
      likes: Math.round(gain * (2 + Math.random() * 3)),
      rt: Math.round(gain * (0.4 + Math.random())),
      gain: gain, pos: pos
    });
    if (s.x.posts.length > 30) s.x.posts.length = 30;
    consommer("x");
    appliquer("x", gain, repM, 0);
    ta.value = "";
    rendre();
  };

  window._rj66Suggestion = function (i) {
    var ta = document.getElementById("rj66-x-texte");
    var sug = suggestionsX();
    if (ta && sug[i]) { ta.value = sug[i]; majCompteur(); }
  };

  window._rj66Compteur = majCompteur;
  function majCompteur() {
    var ta = document.getElementById("rj66-x-texte");
    var c = document.getElementById("rj66-x-compteur");
    if (!ta || !c) return;
    var n = (ta.value || "").length;
    c.textContent = n + " / 280";
    c.style.color = n > 280 ? "#EF4444" : n > 240 ? "#F59E0B" : "var(--text3)";
    var b = document.getElementById("rj66-x-publier");
    if (b) b.disabled = (n === 0 || n > 280);
  }

  /* ==================================================== INSTAGRAM ======= */
  /* Scènes générées : chaque photo est un petit décor SVG, pas une image
     importée. La couleur d'accent suit l'écurie du pilote quand elle existe. */
  function couleurEquipe() {
    try {
      if (typeof G !== "undefined" && G.currentTeam && typeof getTeamLogo === "function") {
        var svg = String(getTeamLogo(G.currentTeam) || "");
        var m = svg.match(/#[0-9A-Fa-f]{6}/g) || [];
        for (var i = 0; i < m.length; i++) {
          var r = parseInt(m[i].substr(1, 2), 16), g = parseInt(m[i].substr(3, 2), 16), b = parseInt(m[i].substr(5, 2), 16);
          if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.22) return m[i];
        }
      }
    } catch (e) {}
    return "#FF1801";
  }

  var SCENES = {
    podium: { nom: "Podium", pub: 1.6, med: 1.0, dessin: function (C) {
      return '<rect width="120" height="120" fill="#0d0d12"/>' +
        '<rect x="46" y="34" width="28" height="60" fill="' + C + '"/>' +
        '<rect x="16" y="52" width="28" height="42" fill="' + C + '99"/>' +
        '<rect x="76" y="62" width="28" height="32" fill="' + C + '66"/>' +
        '<circle cx="60" cy="24" r="8" fill="#FFD400"/>' +
        '<path d="M20 96 h84" stroke="' + C + '" stroke-width="2"/>'; } },
    paddock: { nom: "Paddock", pub: 1.0, med: 1.4, dessin: function (C) {
      return '<rect width="120" height="120" fill="#101018"/>' +
        '<rect x="10" y="30" width="100" height="10" fill="' + C + '"/>' +
        '<rect x="16" y="46" width="26" height="44" rx="3" fill="#1b1b26" stroke="' + C + '55"/>' +
        '<rect x="48" y="46" width="26" height="44" rx="3" fill="#1b1b26" stroke="' + C + '55"/>' +
        '<rect x="80" y="46" width="26" height="44" rx="3" fill="#1b1b26" stroke="' + C + '55"/>'; } },
    coulisses: { nom: "Coulisses", pub: 1.3, med: 0.8, dessin: function (C) {
      return '<rect width="120" height="120" fill="#0f0f16"/>' +
        '<circle cx="60" cy="46" r="18" fill="' + C + '33" stroke="' + C + '" stroke-width="2"/>' +
        '<path d="M34 96 c0-16 12-24 26-24 s26 8 26 24z" fill="#1c1c28"/>' +
        '<path d="M46 44 h28" stroke="' + C + '" stroke-width="2"/>'; } },
    entrainement: { nom: "Entraînement", pub: 1.1, med: 0.9, dessin: function (C) {
      return '<rect width="120" height="120" fill="#0d1014"/>' +
        '<rect x="20" y="54" width="80" height="8" rx="4" fill="' + C + '"/>' +
        '<rect x="12" y="44" width="14" height="28" rx="4" fill="#22222e"/>' +
        '<rect x="94" y="44" width="14" height="28" rx="4" fill="#22222e"/>' +
        '<path d="M40 86 h40" stroke="' + C + '66" stroke-width="3"/>'; } },
    casque: { nom: "Casque", pub: 1.4, med: 1.1, dessin: function (C) {
      return '<rect width="120" height="120" fill="#0d0d12"/>' +
        '<path d="M60 26 c20 0 32 14 32 32 v14 H28 V58 c0-18 12-32 32-32z" fill="' + C + '"/>' +
        '<path d="M34 56 c6-12 16-18 26-18 s20 6 26 18z" fill="#0d0d12" opacity=".85"/>' +
        '<rect x="28" y="72" width="64" height="8" rx="3" fill="#1b1b26"/>'; } },
    circuit: { nom: "Circuit au crépuscule", pub: 1.2, med: 1.2, dessin: function (C) {
      return '<rect width="120" height="120" fill="#12101a"/>' +
        '<circle cx="60" cy="44" r="20" fill="' + C + '55"/>' +
        '<path d="M0 78 h120" stroke="#2a2a38" stroke-width="14"/>' +
        '<path d="M0 78 h120" stroke="' + C + '" stroke-width="2" stroke-dasharray="8 8"/>'; } },
    perso: { nom: "Vie perso", pub: 1.5, med: 0.6, dessin: function (C) {
      return '<rect width="120" height="120" fill="#141018"/>' +
        '<circle cx="44" cy="50" r="14" fill="' + C + '44" stroke="' + C + '"/>' +
        '<circle cx="74" cy="50" r="14" fill="#2a2a38" stroke="' + C + '77"/>' +
        '<path d="M24 92 c8-14 22-20 36-20 s28 6 36 20z" fill="#1c1c28"/>'; } }
  };

  var SCENE_SEL = "podium";
  window._rj66Scene = function (k) { SCENE_SEL = k; rendre(); };

  function vignette(k, taille) {
    var C = couleurEquipe();
    return '<svg viewBox="0 0 120 120" width="' + taille + '" height="' + taille + '" style="display:block;border-radius:8px">' +
           SCENES[k].dessin(C) + '</svg>';
  }

  window._rj66PublierIG = function () {
    if (restant("ig") <= 0) return;
    var lg = document.getElementById("rj66-ig-legende");
    var legende = lg ? String(lg.value || "").trim() : "";
    var s = S();
    var sc = SCENES[SCENE_SEL];

    // Instagram : progression plus lente mais régulière, sans mauvaise surprise
    var socle = Math.max(30, s.ig.f * 0.012);
    var gain = Math.round(socle * (0.85 + Math.random() * 0.4) * sc.pub);
    s.ig.posts.unshift({
      scene: SCENE_SEL, legende: legende, sem: semaine(),
      likes: Math.round(gain * (4 + Math.random() * 4)),
      comm: Math.round(gain * (0.2 + Math.random() * 0.4)), gain: gain
    });
    if (s.ig.posts.length > 30) s.ig.posts.length = 30;
    consommer("ig");
    appliquer("ig", gain, Math.round(sc.med * 0.6), Math.round(sc.pub));
    if (lg) lg.value = "";
    rendre();
  };

  /* ------------------------------------------------------------ rendu --- */
  function enTete(res) {
    var s = S();
    var d = s[res];
    var estX = (res === "x");
    var C = estX ? "#e7e9ea" : "#E1306C";
    var fond = estX ? "linear-gradient(160deg,#16161c 0%,#0d0d12 100%)"
                    : "linear-gradient(135deg,rgba(225,48,108,.18) 0%,rgba(255,180,0,.10) 55%,var(--bg) 100%)";
    var eng = d.f > 0 ? Math.max(0.6, (estX ? 9 : 6) - Math.log10(d.f + 1)) : 0;
    return '<div style="padding:14px;border-radius:var(--r,10px);background:' + fond + ';' +
      'border:1px solid ' + (estX ? "var(--border-hi)" : "rgba(225,48,108,.35)") + ';margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
        '<div><div style="font-family:var(--font-display);font-size:15px;font-weight:900;color:#fff">@' + pseudo() + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:1px">' +
        (estX ? "Réactions rapides, portée volatile" : "Image soignée, progression régulière") + '</div></div>' +
        '<div style="text-align:right"><div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:' + C + '">' +
        fmt(d.f) + '</div><div style="font-size:9px;color:var(--dim,#6b6b78);letter-spacing:.1em;text-transform:uppercase">abonnés</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--text2)">' +
        '<div>Publications <strong style="color:var(--text)">' + d.posts.length + '</strong></div>' +
        '<div>Engagement <strong style="color:var(--text)">' + eng.toFixed(1) + ' %</strong></div>' +
        '<div>Restant cette semaine <strong style="color:' + C + '">' + restant(res) + '</strong></div>' +
      '</div></div>';
  }

  function composerX() {
    var reste = restant("x");
    var sug = suggestionsX().slice(0, 3).map(function (t, i) {
      return '<button type="button" onclick="_rj66Suggestion(' + i + ')" style="text-align:left;width:100%;' +
        'padding:9px 10px;margin-bottom:5px;border-radius:8px;background:rgba(255,255,255,.04);' +
        'border:1px solid var(--border);color:var(--text2);font-size:11.5px;line-height:1.4;cursor:pointer">' +
        t + '</button>';
    }).join("");

    if (reste <= 0) {
      return '<div style="padding:14px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);' +
        'font-size:12px;color:var(--text2);text-align:center">Tu as déjà publié deux fois cette semaine. ' +
        'Laisse retomber, ton audience aussi a besoin de souffler.</div>';
    }
    return '<div style="padding:12px;border-radius:10px;background:var(--bg2);border:1px solid var(--border-hi);margin-bottom:10px">' +
      '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);' +
      'letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Écrire un message</div>' +
      '<textarea id="rj66-x-texte" oninput="_rj66Compteur()" rows="3" maxlength="320" ' +
      'placeholder="Quoi de neuf ?" style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;' +
      'background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:inherit;' +
      'font-size:13px;line-height:1.45;resize:vertical"></textarea>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0 10px">' +
        '<div id="rj66-x-compteur" style="font-size:11px;color:var(--text3)">0 / 280</div>' +
        '<button type="button" id="rj66-x-publier" onclick="_rj66PublierX()" disabled ' +
        'style="padding:9px 16px;border-radius:999px;border:none;background:#e7e9ea;color:#0d0d12;' +
        'font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.06em;' +
        'text-transform:uppercase;cursor:pointer">Publier</button>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--dim,#6b6b78);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Suggestions</div>' +
      sug + '</div>';
  }

  function composerIG() {
    if (restant("ig") <= 0) {
      return '<div style="padding:14px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);' +
        'font-size:12px;color:var(--text2);text-align:center">Une publication par semaine — la rareté fait la valeur.</div>';
    }
    var choix = Object.keys(SCENES).map(function (k) {
      var actif = (k === SCENE_SEL);
      return '<button type="button" onclick="_rj66Scene(\'' + k + '\')" style="padding:4px;border-radius:10px;' +
        'background:transparent;cursor:pointer;line-height:0;' +
        'border:' + (actif ? "2px solid #E1306C" : "1px solid var(--border)") + '">' +
        vignette(k, 62) +
        '<div style="font-size:8.5px;color:' + (actif ? "#E1306C" : "var(--text3)") + ';margin-top:3px;text-align:center">' +
        SCENES[k].nom + '</div></button>';
    }).join("");

    return '<div style="padding:12px;border-radius:10px;background:var(--bg2);border:1px solid rgba(225,48,108,.3);margin-bottom:10px">' +
      '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);' +
      'letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Choisir une photo</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">' + choix + '</div>' +
      '<input id="rj66-ig-legende" type="text" maxlength="120" placeholder="Légende…" ' +
      'style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;background:var(--surface2);' +
      'border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:12.5px;margin-bottom:10px">' +
      '<button type="button" onclick="_rj66PublierIG()" style="width:100%;padding:11px;border-radius:10px;border:none;' +
      'background:linear-gradient(90deg,#E1306C 0%,#F77737 100%);color:#fff;font-family:var(--font-display);' +
      'font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer">Publier</button></div>';
  }

  function fil(res) {
    var s = S(), d = s[res];
    if (!d.posts.length) {
      return '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text3)">Aucune publication pour le moment.</div>';
    }
    return d.posts.map(function (p) {
      if (res === "x") {
        var couleurTon = p.badBuzz ? "#EF4444" : p.ton === "fédérateur" ? "#34D399" : "var(--text3)";
        return '<div style="padding:11px 12px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);margin-bottom:7px">' +
          '<div style="font-size:12.5px;color:var(--text);line-height:1.5">' + p.txt.replace(/</g, "&lt;") + '</div>' +
          '<div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:var(--text3)">' +
            '<span>♥ ' + fmt(p.likes) + '</span><span>⟲ ' + fmt(p.rt) + '</span>' +
            '<span style="color:#e7e9ea">+' + fmt(p.gain) + ' abonnés</span>' +
            (p.badBuzz ? '<span style="color:#EF4444;margin-left:auto">retour de bâton</span>'
                       : '<span style="color:' + couleurTon + ';margin-left:auto">' + p.ton + '</span>') +
          '</div></div>';
      }
      return '<div style="border-radius:10px;background:var(--bg2);border:1px solid var(--border);' +
        'margin-bottom:7px;overflow:hidden;display:flex;gap:10px;padding:10px">' +
        '<div style="flex-shrink:0">' + vignette(p.scene, 64) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:12px;color:var(--text);line-height:1.45">' +
          (p.legende ? p.legende.replace(/</g, "&lt;") : '<span style="color:var(--text3)">Sans légende</span>') + '</div>' +
          '<div style="display:flex;gap:12px;margin-top:7px;font-size:11px;color:var(--text3)">' +
            '<span>♥ ' + fmt(p.likes) + '</span><span>💬 ' + fmt(p.comm) + '</span>' +
            '<span style="color:#E1306C">+' + fmt(p.gain) + '</span>' +
          '</div></div></div>';
    }).join("");
  }

  window._rj66Onglet = function (res) { ONGLET = res; rendre(); };

  function rendre() {
    var host = document.getElementById("mt-reseaux");
    if (!host) return;
    var s = S(); if (!s) return;
    var estX = ONGLET === "x";
    var h = '<div style="padding:10px 14px 18px">' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        '<button type="button" onclick="_rj66Onglet(\'x\')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;' +
        'font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.06em;' +
        (estX ? 'background:#e7e9ea;color:#0d0d12;border:none;' : 'background:transparent;color:var(--text2);border:1px solid var(--border);') +
        '">X · ' + fmt(s.x.f) + '</button>' +
        '<button type="button" onclick="_rj66Onglet(\'ig\')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;' +
        'font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.06em;' +
        (!estX ? 'background:linear-gradient(90deg,#E1306C,#F77737);color:#fff;border:none;' : 'background:transparent;color:var(--text2);border:1px solid var(--border);') +
        '">Instagram · ' + fmt(s.ig.f) + '</button>' +
      '</div>' +
      enTete(ONGLET) +
      (estX ? composerX() : composerIG()) +
      '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);' +
      'letter-spacing:.14em;text-transform:uppercase;margin:14px 0 7px">Publications</div>' +
      fil(ONGLET) + '</div>';
    host.innerHTML = h;
    if (estX) majCompteur();
  }

  /* ---------------------------------------------------------- montage --- */
  function installer() {
    if (typeof window.mtab !== "function") return false;
    if (!window.mtab._rj66) {
      var orig = window.mtab;
      var fn = function (t) {
        var r = orig.apply(this, arguments);
        try { if (t === "reseaux") setTimeout(rendre, 0); } catch (e) {}
        return r;
      };
      fn._rj66 = true;
      wrapped.mtab = orig;
      window.mtab = fn;
    }
    // le champ doit être sauvegardé avec la partie
    try {
      if (typeof window._rj64Champs === "function") window._rj64Champs("_rjSocial");
    } catch (e) {}
    return true;
  }

  var essais = 0;
  function boot() {
    try {
      if (installer()) {
        etat.installe = true;
        console.log("[66-social] actif — X et Instagram séparés, publication réelle");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj66Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    console.log("[66-social] désinstallé");
  };
  window._rj66Rendre = rendre;
})();
