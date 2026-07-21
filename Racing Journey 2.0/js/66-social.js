/* =====================================================================
 * 66-social.js — RÉSEAUX SOCIAUX (v2, refonte visuelle et fonctionnelle)
 *
 * CE QUI CHANGE PAR RAPPORT À LA v1
 * ---------------------------------
 *  1. CARTE DE PROFIL conservée dans son principe (c'est ce qui marchait),
 *     mais reconstruite : avatar, nom affiché MODIFIABLE via un crayon,
 *     identifiant @, biographie, et une ligne de statistiques
 *     Publications / Abonnés / Abonnements.
 *  2. PASTILLE DE CERTIFICATION à partir de 300 000 abonnés, propre à
 *     chaque réseau : une audience X certifiée ne certifie pas Instagram.
 *  3. LE RESTE EST REDESSINÉ. La v1 empilait des dégradés et des blocs
 *     bordés, chaque élément portant ses styles en ligne. Tout passe
 *     désormais par une feuille injectée une fois (#rj66-css) : surfaces
 *     plates, séparateurs fins, sélecteur segmenté, compteur de caractères
 *     en anneau, grille Instagram en trois colonnes.
 *  4. FIL X RÉTABLI. La v1 n'affichait que les messages du pilote. Le fil
 *     mélange à nouveau ses publications et les réactions du paddock :
 *     rivaux, journalistes, écurie, supporters. Le contenu dépend du
 *     dernier résultat, de la catégorie et de l'audience, et il est tiré
 *     d'un générateur déterministe par semaine (FNV-1a puis Mulberry32) :
 *     le fil reste donc stable tant que la semaine de jeu ne change pas,
 *     au lieu de se réécrire à chaque affichage.
 *  5. PHOTOS RÉELLES SUR INSTAGRAM. Le joueur peut publier une image de sa
 *     propre galerie, en plus des scènes dessinées. L'image est ramenée à
 *     720 px de côté maximum et réencodée en JPEG qualité 0.72 avant
 *     stockage : la sauvegarde passe par localStorage, et une photo de
 *     téléphone brute (3 à 8 Mo une fois en base64) ferait sauter le quota
 *     et corromprait la partie. Au-delà de 9 photos conservées, les plus
 *     anciennes perdent leur image mais gardent leur publication et leurs
 *     statistiques.
 *
 * PERSISTANCE : inchangée. L'état vit dans G._rjSocial, déclaré à la
 * sauvegarde via _rj64Champs("_rjSocial") comme en v1.
 *
 * Réversible : window._rj66Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var wrapped = {};
  var etat = { installe: false, erreur: null, photos: 0, poids: 0 };
  window._rj66Status = function () { return etat; };

  var ONGLET = "x";
  var SEUIL_CERTIF = 300000;
  var PHOTO_COTE = 720;
  var PHOTO_QUALITE = 0.72;
  var PHOTO_MAX = 9;

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
    if (!G._rjSocial.profil) G._rjSocial.profil = { nom: null, handle: null, bio: null };
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
    s[res].nb = (s[res].nb || 0) + 1;
  }

  function fmt(n) {
    n = Math.round(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "") + " M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(".0", "") + " k";
    return String(n);
  }

  function ech(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function nomAffiche() {
    var s = S();
    if (s && s.profil && s.profil.nom) return s.profil.nom;
    try { return ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim() || "Pilote"; }
    catch (e) { return "Pilote"; }
  }

  function pseudo() {
    var s = S();
    if (s && s.profil && s.profil.handle) return s.profil.handle;
    try {
      var norm = function (t) {
        return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase().replace(/[^a-z0-9]/g, "");
      };
      return norm(G.pilot.prenom) + norm(G.pilot.nom) + (G.pilot.number || "");
    } catch (e) { return "pilote"; }
  }

  function bio() {
    var s = S();
    if (s && s.profil && s.profil.bio) return s.profil.bio;
    var cat = "", eq = "";
    try { cat = G.cat || ""; } catch (e) {}
    try { eq = G.currentTeam || ""; } catch (e) {}
    return (cat || "Pilote") + (eq ? " · " + eq : "");
  }

  function certifie(res) {
    var s = S(); if (!s) return false;
    return (s[res].f || 0) >= SEUIL_CERTIF;
  }

  function couleurEquipe() {
    try {
      if (typeof G !== "undefined" && G.currentTeam && typeof getTeamLogo === "function") {
        var svg = String(getTeamLogo(G.currentTeam) || "");
        var m = svg.match(/#[0-9A-Fa-f]{6}/g) || [];
        for (var i = 0; i < m.length; i++) {
          var r = parseInt(m[i].substr(1, 2), 16),
              g = parseInt(m[i].substr(3, 2), 16),
              b = parseInt(m[i].substr(5, 2), 16);
          if (r + g + b > 150 && r + g + b < 700) return m[i];
        }
      }
    } catch (e) {}
    return "#FF1801";
  }

  function dernierResultat() {
    try {
      var r = (G.races || []).slice(-1)[0];
      if (!r) return null;
      return r.pos || 0;
    } catch (e) { return null; }
  }

  function avatarUrl() {
    try { return (G.pilot && G.pilot.avatarPhoto) || null; } catch (e) { return null; }
  }

  function initiales() {
    try {
      return ((G.pilot.prenom || "P").charAt(0) + (G.pilot.nom || "L").charAt(0)).toUpperCase();
    } catch (e) { return "PL"; }
  }

  function sauver() {
    try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
  }

  /* -------------------------------------------------------- retombées --- */
  function appliquer(res, gainF, repMedias, repPublic) {
    var s = S(); if (!s) return;
    s[res].f = Math.max(0, Math.round(s[res].f + gainF));
    if (res === "ig") { try { G.igFollowers = s.ig.f; } catch (e) {} }
    try {
      if (G.rep) {
        if (repMedias) G.rep.medias = Math.max(0, Math.min(100, (G.rep.medias || 0) + repMedias));
        if (repPublic) G.rep.public = Math.max(0, Math.min(100, (G.rep.public || 0) + repPublic));
      }
    } catch (e) {}
    sauver();
  }

  /* ------------------------------------------------------- générateur --- */
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

  var MEDIAS = [
    { nom: "Paddock Live", h: "paddocklive", v: true },
    { nom: "Motorsport Daily", h: "msportdaily", v: true },
    { nom: "Le Grand Prix", h: "legrandprix", v: true },
    { nom: "Pit Lane Report", h: "pitlanereport", v: false },
    { nom: "Chrono Mag", h: "chronomag", v: false }
  ];

  var SUPPORTERS = [
    { nom: "Julien", h: "julien_rc" }, { nom: "Emma", h: "emmadrives" },
    { nom: "Karim", h: "karim_gp" }, { nom: "Sofia", h: "sofia_paddock" },
    { nom: "Thomas", h: "tom_apex" }, { nom: "Lea", h: "lea_boxbox" },
    { nom: "Marco", h: "marco_tifosi" }, { nom: "Nina", h: "nina_onboard" }
  ];

  function nomsRivaux() {
    var out = [];
    try {
      var r = G.rivals || [];
      for (var i = 0; i < r.length && out.length < 8; i++) {
        var n = r[i] && (r[i].name || r[i].nom);
        if (n) out.push(String(n));
      }
    } catch (e) {}
    return out;
  }

  function handleDe(nom) {
    return String(nom || "pilote").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "compte";
  }

  function genererFil() {
    var s = S(); if (!s) return [];
    var sem = semaine();
    if (s.filSem === sem && s.filCache) return s.filCache;

    var rnd = mulberry(fnv("fil|" + sem + "|" + pseudo()));
    var pos = dernierResultat();
    var cat = "";
    try { cat = G.cat || "la catégorie"; } catch (e) {}
    var moi = nomAffiche();
    var rivaux = nomsRivaux();
    var items = [];

    function pick(arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }

    var m = pick(MEDIAS), txtMedia;
    if (pos === 1) txtMedia = "VICTOIRE de " + moi + " en " + cat + ". Une démonstration du premier au dernier tour, et un message clair envoyé au championnat.";
    else if (pos && pos <= 3) txtMedia = moi + " monte sur le podium en " + cat + ". La régularité commence à payer.";
    else if (pos && pos <= 10) txtMedia = "Course solide de " + moi + " (P" + pos + "). Des points pris, mais il manque encore un cran en qualification.";
    else if (pos) txtMedia = "Week-end compliqué pour " + moi + " (P" + pos + "). L'équipe cherche des réponses.";
    else txtMedia = "Nouvelle semaine en " + cat + ". Les équipes affûtent leurs plans avant la prochaine manche.";
    items.push({ nom: m.nom, h: m.h, v: m.v, txt: txtMedia, type: "media" });

    if (rivaux.length) {
      var rv = pick(rivaux), txtRival;
      if (pos === 1) txtRival = "Bravo à @" + pseudo() + ", rien à dire cette fois. On remet ça à la prochaine.";
      else if (pos && pos <= 5) txtRival = "Belle bagarre en piste aujourd'hui. C'est comme ça qu'on aime courir.";
      else txtRival = "On avait le rythme, il manquait la fenêtre. Prochaine manche, on revient.";
      items.push({ nom: rv, h: handleDe(rv), v: rnd() > 0.6, txt: txtRival, type: "rival" });
    }

    try {
      if (G.currentTeam) {
        items.push({
          nom: G.currentTeam, h: handleDe(G.currentTeam), v: true, type: "team",
          txt: (pos && pos <= 3)
            ? "Quel week-end. Merci à toute l'équipe, à l'usine comme au circuit. On savoure, puis on repart au travail."
            : "Beaucoup de données à analyser. Merci à l'équipe pour le travail, on rentre et on corrige."
        });
      }
    } catch (e) {}

    var nbFans = 1 + Math.min(3, Math.floor((s.x.f || 0) / 40000));
    var utilises = {};
    for (var i = 0; i < nbFans; i++) {
      var f = pick(SUPPORTERS);
      if (utilises[f.h]) continue;
      utilises[f.h] = 1;
      var phrases = (pos && pos <= 3)
        ? ["Quelle course !! @" + pseudo() + " est en feu cette saison.",
           "J'ai crié devant ma télé. Allez @" + pseudo() + " !",
           "Ce dépassement dans le dernier tour, je le revois en boucle."]
        : ["Courage @" + pseudo() + ", on est derrière toi quoi qu'il arrive.",
           "La voiture n'y était pas, ça se voyait. Ça va revenir.",
           "Toujours là, bonne ou mauvaise course. Allez !"];
      items.push({ nom: f.nom, h: f.h, v: false, txt: pick(phrases), type: "fan" });
    }

    for (var k = 0; k < items.length; k++) {
      var poids = items[k].type === "media" ? 3
                : items[k].type === "team" ? 2
                : items[k].type === "rival" ? 2.2 : 0.6;
      var socle = Math.max(12, (s.x.f || 500) * 0.004) * poids;
      items[k].likes = Math.round(socle * (0.7 + rnd() * 0.9));
      items[k].rt = Math.round(items[k].likes * (0.12 + rnd() * 0.22));
      items[k].rep = Math.round(items[k].likes * (0.05 + rnd() * 0.12));
      items[k].hDep = Math.round(rnd() * 22) + 1;
      items[k].sem = sem;
    }

    s.filSem = sem;
    s.filCache = items;
    return items;
  }

  /* ------------------------------------------------------------ photos --- */
  var PHOTO_EN_COURS = null;

  function compresser(dataUrl, cb) {
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) { cb(null); return; }
          var ratio = Math.min(1, PHOTO_COTE / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * ratio));
          var ch = Math.max(1, Math.round(h * ratio));
          var cv = document.createElement("canvas");
          cv.width = cw; cv.height = ch;
          cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
          cb(cv.toDataURL("image/jpeg", PHOTO_QUALITE));
        } catch (e) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = dataUrl;
    } catch (e) { cb(null); }
  }

  // Garde-fou de quota : au-delà de PHOTO_MAX images, les plus anciennes
  // perdent leur photo. La publication et ses statistiques restent.
  function limiterPhotos() {
    var s = S(); if (!s) return;
    var vus = 0, poids = 0;
    for (var i = 0; i < s.ig.posts.length; i++) {
      var p = s.ig.posts[i];
      if (!p.photo) continue;
      vus++;
      if (vus > PHOTO_MAX) { p.photo = null; p.photoPurgee = true; }
      else poids += p.photo.length;
    }
    etat.photos = Math.min(vus, PHOTO_MAX);
    etat.poids = poids;
  }

  window._rj66ChoisirPhoto = function () {
    var inp = document.getElementById("rj66-photo-file");
    if (inp) inp.click();
  };

  window._rj66PhotoFichier = function (ev) {
    var f = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!f) return;
    if (!f.type || f.type.indexOf("image/") !== 0) {
      if (typeof showToast === "function") showToast("Fichier image requis");
      ev.target.value = ""; return;
    }
    if (f.size > 12 * 1024 * 1024) {
      if (typeof showToast === "function") showToast("Image trop lourde (max 12 Mo)");
      ev.target.value = ""; return;
    }
    var rd = new FileReader();
    rd.onload = function (e) {
      compresser(e.target.result, function (petite) {
        if (!petite) {
          if (typeof showToast === "function") showToast("Image illisible");
          return;
        }
        PHOTO_EN_COURS = petite;
        SCENE_SEL = null;
        rendre();
      });
    };
    rd.onerror = function () { if (typeof showToast === "function") showToast("Erreur de lecture"); };
    rd.readAsDataURL(f);
    ev.target.value = "";
  };

  window._rj66RetirerPhoto = function () {
    PHOTO_EN_COURS = null;
    SCENE_SEL = "podium";
    rendre();
  };

  /* ------------------------------------------------------------ scènes --- */
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
  window._rj66Scene = function (k) { SCENE_SEL = k; PHOTO_EN_COURS = null; rendre(); };

  function vignette(k, taille) {
    var C = couleurEquipe();
    return '<svg viewBox="0 0 120 120" width="' + taille + '" height="' + taille +
           '" style="display:block;border-radius:8px">' + SCENES[k].dessin(C) + '</svg>';
  }

  /* ---------------------------------------------------------- publier --- */
  function tonalite(t) {
    var b = t.toLowerCase();
    if (/(merci|ensemble|equipe|équipe|fier|bravo|supporters)/.test(b)) return "fédérateur";
    if (/(ridicule|nul|injuste|scandale|honte|incompetent|incompétent)/.test(b)) return "provocateur";
    return "neutre";
  }

  window._rj66PublierX = function () {
    if (restant("x") <= 0) return;
    var ta = document.getElementById("rj66-x-txt");
    var txt = ta ? String(ta.value || "").trim() : "";
    if (!txt) { if (typeof showToast === "function") showToast("Message vide"); return; }
    if (txt.length > 280) txt = txt.slice(0, 280);

    var s = S();
    var pos = dernierResultat();
    var ton = tonalite(txt);
    var socle = Math.max(40, s.x.f * 0.02);
    var mult = ton === "fédérateur" ? 1.25 : ton === "provocateur" ? 1.5 : 1;
    var badBuzz = (ton === "provocateur" && pos && pos > 8 && Math.random() < 0.45);
    var gain = Math.round(socle * (0.7 + Math.random() * 0.7) * mult * (badBuzz ? -0.5 : 1));

    s.x.posts.unshift({
      txt: txt, ton: ton, sem: semaine(), badBuzz: badBuzz,
      likes: Math.round(Math.abs(gain) * (6 + Math.random() * 6)),
      rt: Math.round(Math.abs(gain) * (1 + Math.random() * 2)),
      rep: Math.round(Math.abs(gain) * (0.4 + Math.random() * 0.8)),
      gain: gain
    });
    if (s.x.posts.length > 40) s.x.posts.length = 40;
    consommer("x");
    appliquer("x", gain, badBuzz ? -3 : (ton === "provocateur" ? 3 : 2), badBuzz ? -2 : 1);
    if (ta) ta.value = "";
    rendre();
  };

  window._rj66PublierIG = function () {
    if (restant("ig") <= 0) return;
    var lg = document.getElementById("rj66-ig-legende");
    var legende = lg ? String(lg.value || "").trim() : "";
    var s = S();
    var estPhoto = !!PHOTO_EN_COURS;
    var sc = estPhoto ? { pub: 1.5, med: 0.9 } : SCENES[SCENE_SEL];
    if (!sc) sc = { pub: 1, med: 1 };

    var socle = Math.max(30, s.ig.f * 0.012);
    var gain = Math.round(socle * (0.85 + Math.random() * 0.4) * sc.pub);

    s.ig.posts.unshift({
      scene: estPhoto ? null : SCENE_SEL,
      photo: estPhoto ? PHOTO_EN_COURS : null,
      legende: legende, sem: semaine(),
      likes: Math.round(gain * (4 + Math.random() * 4)),
      comm: Math.round(gain * (0.2 + Math.random() * 0.4)),
      gain: gain
    });
    if (s.ig.posts.length > 40) s.ig.posts.length = 40;
    limiterPhotos();
    consommer("ig");
    appliquer("ig", gain, Math.round(sc.med * 0.6), Math.round(sc.pub));
    PHOTO_EN_COURS = null;
    if (!SCENE_SEL) SCENE_SEL = "podium";
    if (lg) lg.value = "";
    rendre();
  };

  /* --------------------------------------------------- profil éditable --- */
  window._rj66EditProfil = function () {
    var s = S(); if (!s) return;
    var d = document.getElementById("rj66-modal");
    if (d) d.classList.add("on");
    var n = document.getElementById("rj66-e-nom");
    var h = document.getElementById("rj66-e-handle");
    var b = document.getElementById("rj66-e-bio");
    if (n) n.value = nomAffiche();
    if (h) h.value = pseudo();
    if (b) b.value = bio();
    if (n) setTimeout(function () { try { n.focus(); } catch (e) {} }, 60);
  };

  window._rj66FermerProfil = function () {
    var d = document.getElementById("rj66-modal");
    if (d) d.classList.remove("on");
  };

  window._rj66SauverProfil = function () {
    var s = S(); if (!s) return;
    var n = document.getElementById("rj66-e-nom");
    var h = document.getElementById("rj66-e-handle");
    var b = document.getElementById("rj66-e-bio");
    var nom = n ? String(n.value || "").trim().slice(0, 32) : "";
    var han = h ? String(h.value || "").trim().toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20) : "";
    var bi  = b ? String(b.value || "").trim().slice(0, 80) : "";
    s.profil.nom = nom || null;
    s.profil.handle = han || null;
    s.profil.bio = bi || null;
    sauver();
    window._rj66FermerProfil();
    rendre();
    if (typeof showToast === "function") showToast("Profil mis à jour");
  };

  window._rj66Onglet = function (t) { ONGLET = t; rendre(); };

  /* ------------------------------------------------------------ styles --- */
  function css() {
    if (document.getElementById("rj66-css")) return;
    var st = document.createElement("style");
    st.id = "rj66-css";
    st.textContent = [
      ".rj66{padding:8px 12px 22px}",
      ".rj66-seg{display:flex;background:var(--bg2);border-radius:12px;padding:3px;margin-bottom:14px}",
      ".rj66-seg button{flex:1;padding:9px 6px;border:0;border-radius:9px;background:transparent;",
      "color:var(--text2);font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.04em;",
      "cursor:pointer;transition:background .18s,color .18s;-webkit-appearance:none;appearance:none}",
      ".rj66-seg button.on{background:var(--bg4,#1f1f28);color:#fff}",
      ".rj66-seg button.on.ig{background:linear-gradient(90deg,#E1306C,#F77737);color:#fff}",
      ".rj66-prof{display:flex;gap:13px;align-items:flex-start;padding:2px 2px 14px}",
      ".rj66-av{width:62px;height:62px;border-radius:50%;flex-shrink:0;background-size:cover;",
      "background-position:center;display:flex;align-items:center;justify-content:center;",
      "font-family:var(--font-display);font-size:20px;font-weight:900;color:#fff;border:2px solid var(--border-hi)}",
      ".rj66-id{flex:1;min-width:0}",
      ".rj66-nom{display:flex;align-items:center;gap:5px;font-family:var(--font-display);font-size:16px;",
      "font-weight:900;color:#fff;line-height:1.2}",
      ".rj66-crayon{border:0;background:transparent;padding:2px 4px;cursor:pointer;color:var(--text3);",
      "line-height:0;-webkit-appearance:none;appearance:none;flex-shrink:0}",
      ".rj66-crayon:active{color:var(--text)}",
      ".rj66-han{font-size:12.5px;color:var(--text3);margin-top:1px}",
      ".rj66-bio{font-size:12.5px;color:var(--text2);margin-top:6px;line-height:1.45}",
      ".rj66-stats{display:flex;gap:20px;margin-top:11px}",
      ".rj66-stat{display:flex;align-items:baseline;gap:4px}",
      ".rj66-stat b{font-family:var(--font-display);font-size:14.5px;font-weight:900;color:#fff}",
      ".rj66-stat span{font-size:11.5px;color:var(--text3)}",
      ".rj66-sep{height:1px;background:var(--border);margin:2px 0 14px}",
      ".rj66-comp{padding:0 0 14px}",
      ".rj66-ta{width:100%;box-sizing:border-box;background:transparent;border:0;color:var(--text);",
      "font-size:15px;line-height:1.5;resize:none;outline:none;font-family:inherit;min-height:66px}",
      ".rj66-ta::placeholder{color:var(--text3)}",
      ".rj66-barre{display:flex;align-items:center;gap:10px;margin-top:6px}",
      ".rj66-ring{width:22px;height:22px;flex-shrink:0}",
      ".rj66-pub{margin-left:auto;padding:8px 18px;border:0;border-radius:999px;background:#e7e9ea;",
      "color:#0d0d12;font-family:var(--font-display);font-size:12.5px;font-weight:900;cursor:pointer;",
      "-webkit-appearance:none;appearance:none}",
      ".rj66-pub.ig{background:linear-gradient(90deg,#E1306C,#F77737);color:#fff}",
      ".rj66-pub:disabled{opacity:.35;cursor:default}",
      ".rj66-quota{font-size:11px;color:var(--text3)}",
      ".rj66-sugg{display:flex;gap:6px;overflow-x:auto;padding:9px 0 2px;-webkit-overflow-scrolling:touch}",
      ".rj66-sugg button{flex-shrink:0;padding:7px 11px;border-radius:999px;border:1px solid var(--border-hi);",
      "background:transparent;color:var(--text2);font-size:11.5px;cursor:pointer;white-space:nowrap;",
      "-webkit-appearance:none;appearance:none}",
      ".rj66-titre{font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);",
      "letter-spacing:.14em;text-transform:uppercase;margin:4px 0 8px}",
      ".rj66-tw{display:flex;gap:11px;padding:12px 0;border-top:1px solid var(--border)}",
      ".rj66-tav{width:38px;height:38px;border-radius:50%;flex-shrink:0;background-size:cover;",
      "background-position:center;display:flex;align-items:center;justify-content:center;font-size:13px;",
      "font-weight:800;color:#fff;font-family:var(--font-display)}",
      ".rj66-tc{flex:1;min-width:0}",
      ".rj66-tt{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:13px}",
      ".rj66-tt b{color:#fff;font-weight:800}",
      ".rj66-tt span{color:var(--text3);font-size:12.5px}",
      ".rj66-txt{font-size:13.5px;color:var(--text);line-height:1.5;margin-top:3px;",
      "white-space:pre-wrap;word-wrap:break-word}",
      ".rj66-act{display:flex;gap:18px;margin-top:8px;font-size:11.5px;color:var(--text3);align-items:center}",
      ".rj66-act i{font-style:normal;opacity:.75}",
      ".rj66-gain{margin-left:auto;font-weight:700}",
      ".rj66-bad{color:#EF4444}",
      ".rj66-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px}",
      ".rj66-cell{position:relative;aspect-ratio:1/1;background:var(--bg2);overflow:hidden;border-radius:2px}",
      ".rj66-cell img{width:100%;height:100%;object-fit:cover;display:block}",
      ".rj66-cell svg{width:100%;height:100%;display:block}",
      ".rj66-cell .lk{position:absolute;left:5px;bottom:4px;font-size:10px;color:#fff;",
      "text-shadow:0 1px 3px rgba(0,0,0,.8);font-weight:700}",
      ".rj66-vide{padding:22px 10px;text-align:center;font-size:12.5px;color:var(--text3)}",
      ".rj66-apercu{position:relative;border-radius:12px;overflow:hidden;background:var(--bg2);margin-bottom:9px}",
      ".rj66-apercu img{width:100%;display:block;max-height:280px;object-fit:cover}",
      ".rj66-x{position:absolute;top:7px;right:7px;width:28px;height:28px;border-radius:50%;border:0;",
      "background:rgba(0,0,0,.6);color:#fff;font-size:15px;line-height:1;cursor:pointer;",
      "-webkit-appearance:none;appearance:none}",
      ".rj66-gal{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:11px;",
      "border-radius:11px;border:1px dashed var(--border-hi);background:transparent;color:var(--text2);",
      "font-size:12.5px;cursor:pointer;margin-bottom:9px;-webkit-appearance:none;appearance:none}",
      ".rj66-scenes{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}",
      ".rj66-sc{flex-shrink:0;border:2px solid transparent;border-radius:10px;padding:0;background:none;",
      "cursor:pointer;line-height:0;-webkit-appearance:none;appearance:none}",
      ".rj66-sc.on{border-color:#E1306C}",
      ".rj66-modal{position:fixed;inset:0;z-index:9000;display:none;align-items:center;",
      "justify-content:center;background:rgba(0,0,0,.72);padding:18px}",
      ".rj66-modal.on{display:flex}",
      ".rj66-box{width:100%;max-width:340px;background:var(--bg2);border:1px solid var(--border-hi);",
      "border-radius:16px;padding:17px}",
      ".rj66-box h4{margin:0 0 13px;font-family:var(--font-display);font-size:13px;font-weight:900;",
      "letter-spacing:.1em;text-transform:uppercase;color:#fff}",
      ".rj66-lab{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;",
      "color:var(--dim,#6b6b78);margin:9px 0 4px;font-family:var(--font-display)}",
      ".rj66-inp{width:100%;box-sizing:border-box;padding:10px;border-radius:9px;background:var(--bg);",
      "border:1px solid var(--border-hi);color:var(--text);font-size:14px;outline:none;font-family:inherit}",
      ".rj66-btns{display:flex;gap:8px;margin-top:15px}",
      ".rj66-btns button{flex:1;padding:11px;border-radius:10px;font-family:var(--font-display);",
      "font-size:12px;font-weight:800;cursor:pointer;-webkit-appearance:none;appearance:none}",
      ".rj66-ko{background:transparent;border:1px solid var(--border-hi);color:var(--text2)}",
      ".rj66-ok{background:var(--apex-red,#FF1801);border:0;color:#fff}"
    ].join("");
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------- rendu --- */
  function badge(res) {
    if (!certifie(res)) return "";
    var c = (res === "x") ? "#1D9BF0" : "#3897F0";
    return '<svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0">' +
      '<path fill="' + c + '" d="M12 1.5l2.6 2.1 3.3-.3 1 3.2 2.8 1.8-1.3 3.1 1.3 3.1-2.8 1.8-1 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-1-3.2L2.3 15.7l1.3-3.1-1.3-3.1L5.1 7.7l1-3.2 3.3.3z"/>' +
      '<path fill="#fff" d="M10.6 15.4l-3-3 1.3-1.3 1.7 1.7 4.2-4.2 1.3 1.3z"/></svg>';
  }

  function avatarBloc(cls) {
    var url = avatarUrl(), C = couleurEquipe();
    if (url) return '<div class="' + cls + '" style="background-image:url(\'' + url + '\')"></div>';
    return '<div class="' + cls + '" style="background:' + C + '22;border-color:' + C + '">' + initiales() + '</div>';
  }

  function enTete(res) {
    var s = S(), d = s[res];
    var suivis = 40 + Math.round(Math.log10((d.f || 0) + 10) * 60);
    return '<div class="rj66-prof">' +
      avatarBloc("rj66-av") +
      '<div class="rj66-id">' +
        '<div class="rj66-nom">' + ech(nomAffiche()) + badge(res) +
          '<button class="rj66-crayon" type="button" onclick="_rj66EditProfil()" aria-label="Modifier le profil">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/>' +
          '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
        '</div>' +
        '<div class="rj66-han">@' + ech(pseudo()) + '</div>' +
        '<div class="rj66-bio">' + ech(bio()) + '</div>' +
        '<div class="rj66-stats">' +
          '<div class="rj66-stat"><b>' + fmt(d.posts.length) + '</b><span>publications</span></div>' +
          '<div class="rj66-stat"><b>' + fmt(d.f) + '</b><span>abonnés</span></div>' +
          '<div class="rj66-stat"><b>' + fmt(suivis) + '</b><span>abonnements</span></div>' +
        '</div>' +
      '</div>' +
    '</div><div class="rj66-sep"></div>';
  }

  function anneau(reste) {
    var total = 280, use = total - reste;
    var p = Math.max(0, Math.min(1, use / total));
    var c = reste < 0 ? "#EF4444" : reste <= 20 ? "#F59E0B" : "#1D9BF0";
    var r = 9, circ = 2 * Math.PI * r;
    return '<svg class="rj66-ring" viewBox="0 0 22 22">' +
      '<circle cx="11" cy="11" r="' + r + '" fill="none" stroke="var(--border-hi)" stroke-width="2"/>' +
      '<circle cx="11" cy="11" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="2" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - p)).toFixed(1) + '" ' +
      'transform="rotate(-90 11 11)" stroke-linecap="round"/></svg>';
  }

  function suggestionsX() {
    var pos = dernierResultat();
    var base = [
      "Semaine de travail au simulateur. On ne lâche rien.",
      "Merci pour tous vos messages, ça compte plus que vous ne croyez."
    ];
    if (pos === 1) base.unshift("Victoire. Merci à toute l'équipe, ce trophée est le vôtre.");
    else if (pos && pos <= 3) base.unshift("Podium. On construit, week-end après week-end.");
    else if (pos && pos > 10) base.unshift("Pas le résultat espéré. On analyse, on corrige, on revient.");
    return base.slice(0, 3);
  }

  window._rj66Sugg = function (i) {
    var ta = document.getElementById("rj66-x-txt");
    if (!ta) return;
    ta.value = suggestionsX()[i] || "";
    window._rj66Compte();
    try { ta.focus(); } catch (e) {}
  };

  window._rj66Compte = function () {
    var ta = document.getElementById("rj66-x-txt");
    var z = document.getElementById("rj66-x-ring");
    var b = document.getElementById("rj66-x-pub");
    if (!ta) return;
    var reste = 280 - ta.value.length;
    if (z) z.innerHTML = anneau(reste);
    if (b) b.disabled = (reste < 0 || !ta.value.trim() || restant("x") <= 0);
  };

  function composerX() {
    var q = restant("x");
    var sugg = suggestionsX().map(function (t, i) {
      return '<button type="button" onclick="_rj66Sugg(' + i + ')">' + ech(t.slice(0, 34)) + '…</button>';
    }).join("");
    return '<div class="rj66-comp">' +
      '<textarea class="rj66-ta" id="rj66-x-txt" maxlength="300" placeholder="Quoi de neuf ?"' +
      (q <= 0 ? " disabled" : "") + ' oninput="_rj66Compte()"></textarea>' +
      '<div class="rj66-sugg">' + sugg + '</div>' +
      '<div class="rj66-barre">' +
        '<span id="rj66-x-ring">' + anneau(280) + '</span>' +
        '<span class="rj66-quota">' +
          (q > 0 ? q + " publication" + (q > 1 ? "s" : "") + " cette semaine" : "Quota atteint") +
        '</span>' +
        '<button class="rj66-pub" id="rj66-x-pub" type="button" onclick="_rj66PublierX()" disabled>Publier</button>' +
      '</div></div>';
  }

  function composerIG() {
    var q = restant("ig");
    var scenes = Object.keys(SCENES).map(function (k) {
      return '<button type="button" class="rj66-sc' + (SCENE_SEL === k && !PHOTO_EN_COURS ? " on" : "") +
             '" onclick="_rj66Scene(\'' + k + '\')" title="' + ech(SCENES[k].nom) + '">' +
             vignette(k, 54) + '</button>';
    }).join("");

    var apercu = PHOTO_EN_COURS
      ? '<div class="rj66-apercu"><img src="' + PHOTO_EN_COURS + '" alt="">' +
        '<button class="rj66-x" type="button" onclick="_rj66RetirerPhoto()">×</button></div>'
      : "";

    return '<div class="rj66-comp">' + apercu +
      '<input type="file" id="rj66-photo-file" accept="image/*" style="display:none" onchange="_rj66PhotoFichier(event)">' +
      '<button class="rj66-gal" type="button" onclick="_rj66ChoisirPhoto()">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/>' +
        '<circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
        (PHOTO_EN_COURS ? "Choisir une autre photo" : "Photo depuis ma galerie") +
      '</button>' +
      (PHOTO_EN_COURS ? "" : '<div class="rj66-scenes">' + scenes + '</div>') +
      '<textarea class="rj66-ta" id="rj66-ig-legende" maxlength="180" placeholder="Écris une légende…"' +
      (q <= 0 ? " disabled" : "") + ' style="min-height:48px;margin-top:9px"></textarea>' +
      '<div class="rj66-barre">' +
        '<span class="rj66-quota">' + (q > 0 ? "1 publication cette semaine" : "Quota atteint") + '</span>' +
        '<button class="rj66-pub ig" type="button" onclick="_rj66PublierIG()"' +
        (q <= 0 ? " disabled" : "") + '>Partager</button>' +
      '</div></div>';
  }

  function filX() {
    var s = S();
    var moi = s.x.posts.slice(0, 12).map(function (p) {
      return {
        nom: nomAffiche(), h: pseudo(), v: certifie("x"), moi: true, type: "moi",
        txt: p.txt, likes: p.likes, rt: p.rt, rep: p.rep || 0,
        gain: p.gain, badBuzz: p.badBuzz, sem: p.sem, hDep: 0
      };
    });
    var tout = moi.concat(genererFil());
    tout.sort(function (a, b) {
      if ((b.sem || 0) !== (a.sem || 0)) return (b.sem || 0) - (a.sem || 0);
      return (a.hDep || 0) - (b.hDep || 0);
    });
    if (!tout.length) return '<div class="rj66-vide">Le fil est encore vide. Publie un premier message.</div>';

    return tout.map(function (t) {
      var av = t.moi
        ? avatarBloc("rj66-tav")
        : '<div class="rj66-tav" style="background:' +
          (t.type === "media" ? "#2b3440" : t.type === "team" ? couleurEquipe() + "33" : "#2a2a38") +
          '">' + ech(String(t.nom).charAt(0).toUpperCase()) + '</div>';
      var quand = t.moi ? "" : " · il y a " + t.hDep + " h";
      return '<div class="rj66-tw">' + av + '<div class="rj66-tc">' +
        '<div class="rj66-tt"><b>' + ech(t.nom) + '</b>' + (t.v ? badge("x") : "") +
        '<span>@' + ech(t.h) + ech(quand) + '</span></div>' +
        '<div class="rj66-txt">' + ech(t.txt) + '</div>' +
        '<div class="rj66-act">' +
          '<span><i>&#8617;</i> ' + fmt(t.rep) + '</span>' +
          '<span><i>&#8635;</i> ' + fmt(t.rt) + '</span>' +
          '<span><i>&#9829;</i> ' + fmt(t.likes) + '</span>' +
          (t.moi ? '<span class="rj66-gain' + (t.badBuzz ? " rj66-bad" : "") + '">' +
                   (t.gain >= 0 ? "+" : "") + fmt(t.gain) + '</span>' : "") +
        '</div></div></div>';
    }).join("");
  }

  function grilleIG() {
    var s = S();
    if (!s.ig.posts.length) {
      return '<div class="rj66-vide">Aucune publication. Ajoute une photo ou choisis une scène.</div>';
    }
    return '<div class="rj66-grid">' + s.ig.posts.map(function (p, i) {
      var media = p.photo
        ? '<img src="' + p.photo + '" alt="">'
        : (p.scene && SCENES[p.scene]
            ? '<svg viewBox="0 0 120 120">' + SCENES[p.scene].dessin(couleurEquipe()) + '</svg>'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
              'font-size:10px;color:var(--text3);text-align:center;padding:4px">image retirée</div>');
      return '<div class="rj66-cell" onclick="_rj66Post(' + i + ')">' + media +
             '<span class="lk">&#9829; ' + fmt(p.likes) + '</span></div>';
    }).join("") + '</div>';
  }

  window._rj66Post = function (i) {
    var s = S(); if (!s) return;
    var p = s.ig.posts[i];
    if (!p) return;
    if (typeof showToast === "function") {
      showToast((p.legende ? p.legende + " · " : "") +
                fmt(p.likes) + " j'aime · " + fmt(p.comm) + " commentaires");
    }
  };

  function modal() {
    return '<div class="rj66-modal" id="rj66-modal"><div class="rj66-box">' +
      '<h4>Modifier le profil</h4>' +
      '<div class="rj66-lab">Nom affiché</div>' +
      '<input class="rj66-inp" id="rj66-e-nom" maxlength="32">' +
      '<div class="rj66-lab">Identifiant</div>' +
      '<input class="rj66-inp" id="rj66-e-handle" maxlength="20">' +
      '<div class="rj66-lab">Biographie</div>' +
      '<input class="rj66-inp" id="rj66-e-bio" maxlength="80">' +
      '<div class="rj66-btns">' +
        '<button class="rj66-ko" type="button" onclick="_rj66FermerProfil()">Annuler</button>' +
        '<button class="rj66-ok" type="button" onclick="_rj66SauverProfil()">Enregistrer</button>' +
      '</div></div></div>';
  }

  function rendre() {
    var host = document.getElementById("mt-reseaux");
    if (!host) return;
    var s = S(); if (!s) return;
    css();
    limiterPhotos();
    var estX = ONGLET === "x";

    host.innerHTML = '<div class="rj66">' +
      '<div class="rj66-seg">' +
        '<button type="button" class="' + (estX ? "on" : "") + '" onclick="_rj66Onglet(\'x\')">X · ' + fmt(s.x.f) + '</button>' +
        '<button type="button" class="' + (!estX ? "on ig" : "") + '" onclick="_rj66Onglet(\'ig\')">Instagram · ' + fmt(s.ig.f) + '</button>' +
      '</div>' +
      enTete(ONGLET) +
      (estX ? composerX() : composerIG()) +
      '<div class="rj66-titre">' + (estX ? "Fil" : "Publications") + '</div>' +
      (estX ? filX() : grilleIG()) +
      modal() +
    '</div>';

    if (estX) { try { window._rj66Compte(); } catch (e) {} }
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
        console.log("[66-social] v2 actif — profil éditable, certification à " +
                    fmt(SEUIL_CERTIF) + " abonnés, fil X et photos de galerie");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj66Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    var st = document.getElementById("rj66-css");
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log("[66-social] désinstallé");
  };
  window._rj66Rendre = rendre;
})();
