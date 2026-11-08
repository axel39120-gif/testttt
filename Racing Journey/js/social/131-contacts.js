/* =====================================================================
 * 131-contacts.js — MESSAGERIE › CONTACTS : UNE VRAIE APPLI DE MESSAGES
 *
 * POURQUOI
 * La liste et la conversation étaient dessinées dans un conteneur mis en
 * colonnes : l'en-tête collant recouvrait les messages, des widgets
 * s'intercalaient, les sujets à envoyer ne disaient rien de leurs effets.
 *
 * CE QUE FAIT LE MODULE
 *   - Liste : une colonne de fiches (portrait ou pictogramme, rôle, jauge de
 *     relation quand elle existe, disponibilité, aperçu de la dernière
 *     réponse).
 *   - Conversation : en-tête (retour, portrait, rôle, jauge), fil daté avec
 *     tes bulles à droite et les siennes à gauche, effets obtenus sous chaque
 *     échange ; puis « Que veux-tu lui écrire ? » : chaque sujet montre le
 *     message envoyé, les effets possibles et, s'il y a plusieurs réponses
 *     possibles, leurs chances.
 * La logique (sujets, délais, effets) reste celle de 03 : startContactChat.
 *
 * Réversible : window._rj131Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[131-contacts]";
  var RELATION = { parents: "parents", partner: "partner", friends: "friends", coach: "coach" };
  var ROLES = { parents: "Famille", friends: "Amis", partner: "Couple", coach: "Coach perso", agent: "Agent" };
  function role(c) {
    if (ROLES[c.id]) return ROLES[c.id];
    var d = String(c.description || "").split("·")[0].trim();
    return d && !/^relation/i.test(d) ? d : String(c.role || "");
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function appel(f) { try { return typeof f === "function" ? f() : f; } catch (e) { return null; } }

  function relation(id) {
    var k = RELATION[id], r = k && typeof G !== "undefined" && G.relations && G.relations[k];
    if (!k) return null;
    return r && typeof r.closeness === "number" ? Math.round(r.closeness) : 50;   // 50 : valeur par défaut du jeu
  }

  /* Un portrait pour une personne, un pictogramme pour un groupe (« Tes parents »). */
  function visage(def, couleur, taille) {
    var nom = appel(def.getName) || "";
    var personne = /\s/.test(nom) && !/^tes\s/i.test(nom) && window.RJAvatar;
    if (personne) {
      try { return '<span class="rj131-av" style="--c:' + couleur + ';width:' + taille + 'px;height:' + taille + 'px">' + RJAvatar.html(RJAvatar.personnage(nom, { role: "civil" }), taille) + "</span>"; } catch (e) {}
    }
    var ico = "";
    try { ico = typeof renderIcon === "function" ? renderIcon(appel(def.getIcon) || "phone", Math.round(taille * .46), couleur) : ""; } catch (e) {}
    return '<span class="rj131-av rj131-ico" style="--c:' + couleur + ';width:' + taille + 'px;height:' + taille + 'px">' + ico + "</span>";
  }

  function jauge(v, couleur) {
    if (v === null) return "";
    return '<span class="rj131-jauge" title="Relation ' + v + '/100"><i style="width:' + v + "%;background:" + couleur + '"></i></span><b class="rj131-jv">' + v + "</b>";
  }

  function etat(id) {
    var st = typeof getContactState === "function" ? getContactState(id) : { threads: [] };
    var ecart = 50 * (G.saison - st.lastInteractionSaison) + (G.semaine - st.lastInteractionWeek);
    var delai = typeof CONTACT_COOLDOWN_WEEKS === "number" ? CONTACT_COOLDOWN_WEEKS : 1;
    return { st: st, libre: ecart >= delai, attente: Math.max(0, delai - ecart) };
  }

  /* --- Effets : lecture des sujets sans les appliquer -------------------- */
  var NOMS_STAT = { regularite: "Régularité", vitesse: "Vitesse", mental: "Mental", physique: "Physique", technique: "Technique", depassement: "Dépassement", pluie: "Pluie", defense: "Défense" };
  function effet(e) {
    if (!e || typeof e !== "object") return null;
    var v = +e.value || 0, s = v > 0 ? "+" : v < 0 ? "−" : "", a = Math.abs(v);
    if (e.type === "money") return { t: s + a.toLocaleString("fr-FR") + " €", v: v };
    if (e.type === "rep") return { t: s + a + " réputation", v: v };
    if (e.type === "mental") return { t: s + a + " mental", v: v };
    if (e.type === "pa") return { t: s + a + " PA", v: v };
    if (e.type === "stat") return { t: s + a + " " + (NOMS_STAT[e.key] || e.key || "stat"), v: v };
    if (e.type === "relation") return { t: s + a + " relation", v: v };
    if (e.type === "custom") return { t: "effet spécial", v: 0 };
    return null;
  }
  function apercu(sujet) {
    var issues = appel(sujet.outcomes);
    if (!Array.isArray(issues) || !issues.length) issues = [{ weight: 1, effects: appel(sujet.effects) || [] }];
    var total = issues.reduce(function (a, o) { return a + (o.weight || 1); }, 0), vus = {}, effets = [];
    issues.forEach(function (o) {
      (appel(o.effects) || []).forEach(function (e) { var f = effet(e); if (f && !vus[f.t]) { vus[f.t] = 1; effets.push(f); } });
    });
    var chances = issues.length > 1 ? issues.filter(function (o) { return o.label; }).map(function (o) { return esc(o.label) + " " + Math.round(100 * (o.weight || 1) / total) + " %"; }) : [];
    return { effets: effets, chances: chances };
  }
  function puces(liste) {
    return liste.map(function (f) { return '<span class="rj131-fx ' + (f.v > 0 ? "plus" : f.v < 0 ? "moins" : "") + '">' + esc(f.t) + "</span>"; }).join("");
  }

  /* --- Liste ----------------------------------------------------------- */
  function liste() {
    var hote = document.getElementById("mb-contacts-list");
    if (!hote || typeof getContactList !== "function") return;
    marquer("liste");
    var cs = getContactList();
    if (!cs.length) { hote.innerHTML = '<div class="rj-vide">Aucun contact pour l\'instant. Ils arrivent au fil de ta carrière.</div>'; return; }
    hote.innerHTML = '<div class="rj131-liste">' + cs.map(function (c) {
      var def = getContactDef(c.id), e = etat(c.id), rel = relation(c.id), dernier = "";
      var fil = e.st.threads && e.st.threads[0];
      if (fil) { var m = fil.messages.filter(function (x) { return x.from !== "player"; }).pop(); if (m) dernier = m.text; }
      return '<button type="button" class="rj131-carte" style="--c:' + c.color + '" onclick="openContactChat(\'' + c.id + '\')">' +
        visage(def, c.color, 46) +
        '<span class="rj131-corps"><span class="rj131-role">' + esc(role(c)) + "</span>" +
        '<span class="rj131-nom">' + esc(c.name) + "</span>" +
        (dernier ? '<span class="rj131-dernier">« ' + esc(dernier.length > 80 ? dernier.slice(0, 78) + "…" : dernier) + " »</span>" : '<span class="rj131-dernier vide">Pas encore d\'échange</span>') +
        "</span>" +
        '<span class="rj131-droite">' + (rel !== null ? '<span class="rj131-rel">' + jauge(rel, c.color) + "</span>" : "") +
        '<span class="rj131-pastille ' + (e.libre ? "libre" : "") + '">' + (e.libre ? "Disponible · " + c.topicsCount + " sujets" : "Dans " + e.attente + " sem.") + "</span></span>" +
        '<span class="rj131-chev">›</span></button>';
    }).join("") + "</div>";
  }

  /* --- Conversation ------------------------------------------------------ */
  function conversation(id) {
    var hote = document.getElementById("mb-contacts-list"), def = typeof getContactDef === "function" ? getContactDef(id) : null;
    if (!hote || !def) return;
    marquer("fil");
    var couleur = appel(def.getColor) || "#60A5FA", nom = appel(def.getName) || "", e = etat(id), rel = relation(id);
    var h = '<div class="rj131-fil" style="--c:' + couleur + '">' +
      '<div class="rj131-tete"><button type="button" class="rj131-retour" onclick="renderContactsList()">‹ Contacts</button>' +
        visage(def, couleur, 54) +
        '<div class="rj131-id"><div class="rj131-nom">' + esc(nom) + '</div><div class="rj131-desc">' + esc(appel(def.getDescription) || "") + "</div>" +
        (rel !== null ? '<div class="rj131-rel">Relation ' + jauge(rel, couleur) + "</div>" : "") + "</div></div>";

    var fils = (e.st.threads || []).slice().reverse();
    h += '<div class="rj131-messages">';
    if (!fils.length) h += '<div class="rj131-debut">Début de la conversation avec ' + esc(nom) + ".</div>";
    fils.forEach(function (f, i) {
      h += '<div class="rj131-date">Saison ' + f.saison + " · Semaine " + f.week + "</div>";
      f.messages.forEach(function (m) {
        var moi = m.from === "player";
        h += '<div class="rj131-bulle ' + (moi ? "moi" : "lui") + (i === fils.length - 1 ? " recent" : "") + '">' + esc(m.text) + "</div>";
      });
      if (f.effects && f.effects.length) {
        h += '<div class="rj131-effets">' + f.effects.map(function (t) {
          var sg = /^\+/.test(t) ? "plus" : /^[−-]/.test(t) ? "moins" : "";
          return '<span class="rj131-fx ' + sg + '">' + esc(t) + "</span>";
        }).join("") + "</div>";
      }
    });
    h += "</div>";

    var sujets = (def.topics || []).filter(function (t) { return typeof t.available !== "function" || appel(t.available); });
    h += '<div class="rj131-composer"><div class="rj131-titre">Que veux-tu lui écrire ?</div>';
    if (!e.libre) h += '<div class="rj131-attente">Vous avez déjà échangé cette semaine — réponse possible dans ' + e.attente + " semaine" + (e.attente > 1 ? "s" : "") + ".</div>";
    if (!sujets.length) h += '<div class="rj-vide">Aucun sujet à aborder pour l\'instant.</div>';
    sujets.forEach(function (t) {
      var a = apercu(t), msg = Array.isArray(t.playerMsg) ? t.playerMsg[0] : t.playerMsg || "";
      h += '<button type="button" class="rj131-sujet"' + (e.libre ? ' onclick="sendContactMessage(\'' + id + "','" + t.id + '\')"' : " disabled") + ">" +
        '<span class="rj131-sujet-l">' + esc(t.label || msg) + "</span>" +
        (t.label && msg ? '<span class="rj131-sujet-m">« ' + esc(msg) + " »</span>" : "") +
        '<span class="rj131-sujet-fx">' + (a.effets.length ? puces(a.effets) : '<span class="rj131-fx">Juste pour garder le lien</span>') + "</span>" +
        (a.chances.length ? '<span class="rj131-chances">' + a.chances.join(" · ") + "</span>" : "") + "</button>";
    });
    h += "</div></div>";
    hote.innerHTML = h;
    // l'échange le plus récent à l'écran, les sujets juste en dessous
    setTimeout(function () {
      var r = hote.querySelectorAll(".rj131-bulle.recent"), cible = r.length ? r[r.length - 1] : hote.querySelector(".rj131-composer");
      if (cible && cible.scrollIntoView) cible.scrollIntoView({ block: "center" });
    }, 40);
  }

  function marquer(mode) {
    var c = document.getElementById("mb-contacts");
    if (c) { c.classList.toggle("rj131-mode-fil", mode === "fil"); c.classList.toggle("rj131-mode-liste", mode !== "fil"); }
  }

  function boot() {
    if (typeof window.rjInscrire !== "function" || typeof window.openContactChat !== "function" || typeof window.renderContactsList !== "function") return setTimeout(boot, 100);
    rjInscrire("renderContactsList", { id: "131-contacts:liste", remplace: function () { try { liste(); } catch (e) { console.warn(TAG, e && e.message); } } });
    rjInscrire("openContactChat", { id: "131-contacts:fil", remplace: function (args) { try { conversation(args[0]); } catch (e) { console.warn(TAG, e && e.message); } } });
    window.RJContacts = { liste: liste, conversation: conversation, apercu: apercu };
    window._rj131Uninstall = function () {
      if (typeof rjDesinscrire === "function") { rjDesinscrire(["131-contacts"], "renderContactsList"); rjDesinscrire(["131-contacts"], "openContactChat"); }
      marquer(""); delete window.RJContacts;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
