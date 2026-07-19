/* ============================================================================
 * 53-result-screen-fix.js — Écran de résultat noir en fin de course
 * ----------------------------------------------------------------------------
 * CAUSE : dans index.html, l'onglet résultat #rt-res est imbriqué À L'INTÉRIEUR
 * de l'onglet course #rt-course (un </div> manquant — rt-res est en profondeur 3
 * au lieu de 2 comme les autres onglets). Or rtab("res") fait
 *   rt-course.display = "none"  ET  rt-res.display = "block"
 * Comme rt-res est ENFANT de rt-course, masquer le parent masque l'enfant :
 * le classement est bien construit dans #res-content mais reste invisible
 * (hauteur 0) -> écran noir. Ce bug était latent tant que la course ne se
 * terminait pas ; il apparaît maintenant qu'on atteint l'écran de résultat.
 *
 * CORRECTIF : re-parenter #rt-res comme FRÈRE de #rt-course (même conteneur),
 * exactement comme les autres onglets. rtab("res") affiche alors le résultat
 * correctement (rt-res visible, rt-course masqué, sans conflit).
 *
 * Sûr / réversible : simple déplacement DOM au démarrage, retrait du <script>
 * = retour à l'état d'origine. Uninstall : _rj53Uninstall().
 * ========================================================================== */
(function () {
  "use strict";

  function fix() {
    var rtRes = document.getElementById("rt-res");
    var rtCourse = document.getElementById("rt-course");
    if (!rtRes || !rtCourse) return false;
    // déjà frères ? rien à faire
    if (rtRes.parentElement === rtCourse) {
      var host = rtCourse.parentElement;
      if (!host) return false;
      // insérer rt-res juste après rt-course, dans le même parent
      if (rtCourse.nextSibling) host.insertBefore(rtRes, rtCourse.nextSibling);
      else host.appendChild(rtRes);
      // s'assurer qu'il reste masqué tant qu'on ne bascule pas dessus
      rtRes.style.display = "none";
      console.log("[53-result-screen-fix] #rt-res re-parenté comme frère de #rt-course");
    }
    return true;
  }

  var tries = 0;
  function boot() {
    if (fix()) return;
    if (tries++ < 60) setTimeout(boot, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj53Uninstall = function () {
    console.log("[53-result-screen-fix] désinstallé (rechargez pour revenir à l'origine)");
  };
})();
