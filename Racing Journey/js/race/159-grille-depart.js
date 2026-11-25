/* =====================================================================
 * 159-grille-depart.js — LA GRILLE, FILMÉE COMME À LA TÉLÉVISION
 *
 * Juste avant la course : toute la grille, de la dernière ligne à la
 * première, la caméra remonte la piste. Un toucher passe la séquence ; à la
 * fin, la grille entière se parcourt au doigt et le bouton Départ est là.
 * Remplace, tant que la course n'est pas lancée, le bandeau du direct et le
 * classement réduit.
 * =================================================================== */
(function () {
  "use strict";
  var TAG = "[159-grille]", vue = null, cle = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function avantCourse() {
    var b = document.getElementById("race-btn");
    return !!b && !b.disabled && /^\s*Départ/i.test(b.textContent || "");
  }
  /* Même ordre que le moteur (04) : le joueur à sa place de qualification, les
     rivaux dans l'ordre de leurs chronos. */
  function ordre() {
    var Q = (typeof QUALI_STATE !== "undefined" && QUALI_STATE.drivers) || [];
    if (!Q.length || !(RACE_STATE.qualiPos > 0)) return [];
    var L = Q.filter(function (d) { return !d.isPlayer; }).slice().sort(function (a, b) { return (a.bestTime || 9999) - (b.bestTime || 9999); });
    var moi = Q.filter(function (d) { return d.isPlayer; })[0];
    if (moi) L.splice(Math.min(L.length, RACE_STATE.qualiPos - 1), 0, moi);
    return _inverserGrille(L);            // F2, F3 : tête de grille inversée au sprint
  }
  function couleur(d) {
    var c = null; try { c = typeof couleurEcurie === "function" && couleurEcurie(d.team); } catch (e) {}
    if (c) return c;
    var h = 0; String(d.team && d.team !== "Indépendant" ? d.team : d.name).split("").forEach(function (x) { h = (h * 31 + x.charCodeAt(0)) % 360; });
    return "hsl(" + h + ",62%,48%)";
  }
  function voiture(d) {
    var c = couleur(d), kart = /karting/i.test(G.cat);
    return '<svg class="v" viewBox="0 0 40 70" aria-hidden="true">' + (kart ?
      '<rect x="4" y="10" width="8" height="13" rx="2" fill="#111"/><rect x="28" y="10" width="8" height="13" rx="2" fill="#111"/><rect x="3" y="45" width="10" height="15" rx="2" fill="#111"/><rect x="27" y="45" width="10" height="15" rx="2" fill="#111"/><path d="M11 5h18l3 10-4 8v28l3 8-5 6H14l-5-6 3-8V23l-4-8z" fill="' + c + '"/><circle cx="20" cy="38" r="7" fill="#f3f4f6" stroke="#111" stroke-width="2"/>' :
      '<rect x="2" y="12" width="8" height="14" rx="2" fill="#111"/><rect x="30" y="12" width="8" height="14" rx="2" fill="#111"/><rect x="1" y="45" width="10" height="17" rx="2" fill="#111"/><rect x="29" y="45" width="10" height="17" rx="2" fill="#111"/><rect x="5" y="3" width="30" height="5" rx="1" fill="' + c + '"/><path d="M18 4h4l3 22 6 10-2 22H11L9 36l6-10z" fill="' + c + '"/><rect x="7" y="62" width="26" height="6" rx="1" fill="' + c + '"/><circle cx="20" cy="37" r="5" fill="#f3f4f6" stroke="#111" stroke-width="2"/>') + "</svg>";
  }
  function temps(d) {
    var t = d.bestTime; if (!t || t > 900) return "";
    var m = Math.floor(t / 60), s = (t - m * 60).toFixed(3); return (m ? m + ":" + (s < 10 ? "0" : "") : "") + s;
  }

  function montrer() {
    var ecran = document.getElementById("race-screen"), L = ordre();
    if (!ecran || !avantCourse() || !L.length) return retirer();
    var k = RACE_STATE.circuit + "|" + RACE_WEEKEND_STATE.sprintDone + "|" + G.saison + "|" + L.map(function (d) { return d.name; }).join();
    if (vue && k === cle && ecran.contains(vue)) return;
    retirer(); cle = k;
    vue = document.createElement("div"); vue.id = "rj159"; vue.setAttribute("data-rj-noround", "1");   // 04q arrondit les nombres de la page : les millièmes disparaissaient
    vue.setAttribute("aria-label", "Grille de départ");
    vue.innerHTML = '<div class="rj159-piste">' + L.map(function (d, i) {
      var logo = window.TEAM_LOGOS && TEAM_LOGOS[d.team];
      return '<div class="rj159-place ' + (i % 2 ? "d" : "g") + (d.isPlayer ? " moi" : "") + '"><span class="n">' + (i + 1) + "</span>" + voiture(d) +
        '<span class="i"><b>' + esc(d.name) + "</b><em>" + (logo ? '<i class="l">' + logo + "</i>" : "") + esc(d.team || "Indépendant") + "</em></span><span class=\"t\">" + temps(d) + "</span></div>";
    }).join("") + '</div><div class="rj159-titre">' + (window.RJLogoCat ? RJLogoCat.svg(G.cat, 18) : "") + "Grille de départ" + (window.RJSprint && RJSprint.libelle() ? " · " + RJSprint.libelle() : "") + "</div>" + '<button type="button" class="rj159-revoir">Passer</button>';
    ecran.insertBefore(vue, ecran.firstChild);
    ecran.classList.add("rj159-on");
    vue.addEventListener("click", function (e) { if (e.target.closest(".rj159-revoir") && vue.classList.contains("fin")) filmer(); else finir(); });
    filmer();
  }
  var anim = null;
  function filmer() {
    if (!vue) return;
    var p = vue.querySelector(".rj159-piste"), course = p.scrollHeight - vue.clientHeight, n = p.children.length;
    vue.classList.remove("fin"); vue.scrollTop = 0; vue.querySelector(".rj159-revoir").textContent = "Passer";
    if (anim) anim.cancel();
    if (course <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return finir();
    anim = p.animate([{ transform: "translateY(" + -course + "px)" }, { transform: "translateY(" + -course + "px)", offset: .06 }, { transform: "translateY(0)" }],
      { duration: Math.min(14000, 1500 + n * 520), easing: "linear", fill: "both" });
    anim.onfinish = finir;
  }
  function finir() {
    if (!vue || vue.classList.contains("fin")) return;
    if (anim) { anim.onfinish = null; anim.cancel(); anim = null; }
    vue.classList.add("fin"); vue.querySelector(".rj159-revoir").textContent = "Revoir";
  }
  function retirer() {
    if (anim) { anim.onfinish = null; anim.cancel(); anim = null; }
    if (vue) vue.remove(); vue = null; cle = null;
    var e = document.getElementById("race-screen"); if (e) e.classList.remove("rj159-on");
  }
  function boot() {
    if (!Array.isArray(window.RJ_RACE_TAB_HOOKS) || !Array.isArray(window.RJ_RACE_START_HOOKS)) return setTimeout(boot, 100);
    window.RJ_RACE_TAB_HOOKS.push({ id: "159-grille", apres: function (o) { if (o === "course") setTimeout(montrer, 60); else retirer(); } });
    window.RJ_RACE_START_HOOKS.push({ id: "159-grille", ordre: 1, avant: retirer });
    window.RJGrille = { montrer: montrer, retirer: retirer, ordre: ordre, finir: finir };
    console.log(TAG, "actif — grille de départ filmée");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
