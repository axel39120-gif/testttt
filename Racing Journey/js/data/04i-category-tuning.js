/* =====================================================================
 * 04i-category-tuning.js — ADAPTATION PAR CATÉGORIE
 * 
 * Patch les modules 04b-04h pour adapter leur comportement à chaque
 * catégorie de course. Les modules continuent de fonctionner partout,
 * mais ce module supprime les incohérences narratives :
 *   - Pas de message radio "Pneus tendres en limite" en karting
 *   - Pas de "Fenêtre pit ouverte" en F4/FR/F3
 *   - Pas de pastille compound en karting (juste slick/wet)
 *   - Pas de barre usure pneus pour les courses trop courtes
 *   - Badge "FCY" (Full Course Yellow) en endurance au lieu de "SAFETY CAR"
 * 
 * APPROCHE :
 *   Définit RJ_CAT_PROFILE par catégorie ; les modules le consultent.
 *   (Les correctifs des anciennes phases 5, 6 et Graphics ont été retirés :
 *   leurs fonctions cibles n'existent plus, et ils réessayaient de
 *   s'installer toutes les 50 ms depuis le lancement du jeu.)
 * 
 * EXPOSE :
 *   - rjCatProfile()   → renvoie le profil de la catégorie courante
 *   - rjCatHas(flag)   → bool, vérifie un flag du profil
 *   - rjDebugCat()     → affichage debug
 * ===================================================================== */

/* ========================================================================
 * 1. PROFILS PAR CATÉGORIE
 * 
 * Chaque flag indique si la catégorie a une fonctionnalité donnée.
 *   hasCompounds  : choix tendre/medium/dur disponible
 *   hasPit        : arrêts aux stands obligatoires/possibles
 *   hasSC         : safety car peut se déclencher
 *   useFCY        : utilise "Full Course Yellow" au lieu de "Safety Car"
 *   tyreVisible   : afficher la barre d'usure du joueur (course assez longue)
 *   compoundVisible: afficher les pastilles compound
 *   isShort       : course courte (<25 tours) — usure pneus peu pertinente
 * ===================================================================== */

var RJ_CAT_PROFILES = {
  "Karting Junior": {
    hasCompounds: false,
    hasPit: false,
    hasSC: false,
    useFCY: false,
    tyreVisible: false,
    compoundVisible: false,
    isShort: true
  },
  "Karting Senior": {
    hasCompounds: false,
    hasPit: false,
    hasSC: false,
    useFCY: false,
    tyreVisible: false,
    compoundVisible: false,
    isShort: true
  },
  "Formule 4": {
    hasCompounds: true,         // pneus existent (slick/wet)
    hasPit: false,              // mais pas de stop course
    hasSC: false,
    useFCY: false,
    tyreVisible: false,         // course trop courte (~20 min)
    compoundVisible: true,      // OK d'afficher (slick par défaut, wet sous pluie)
    isShort: true
  },
  "Formula Regional": {
    hasCompounds: true,
    hasPit: false,
    hasSC: false,               // FR a SC en théorie mais très rare
    useFCY: false,
    tyreVisible: false,
    compoundVisible: true,
    isShort: true
  },
  "Formule 3": {
    hasCompounds: true,
    hasPit: false,              // F3 actuel pas d'arrêt obligatoire
    hasSC: true,                // F3 a des SC réels
    useFCY: false,
    tyreVisible: false,         // course ~25-30 min, usure pas critique
    compoundVisible: true,
    isShort: false
  },
  "Formule 2": {
    hasCompounds: true,
    hasPit: true,
    hasSC: true,
    useFCY: false,
    tyreVisible: true,
    compoundVisible: true,
    isShort: false
  },
  "Formule 1": {
    hasCompounds: true,
    hasPit: true,
    hasSC: true,
    useFCY: false,
    tyreVisible: true,
    compoundVisible: true,
    isShort: false
  },
  "Super Formula": {
    hasCompounds: true,
    hasPit: true,
    hasSC: true,
    useFCY: false,
    tyreVisible: true,
    compoundVisible: true,
    isShort: false
  },
  "Endurance WEC": {
    hasCompounds: true,
    hasPit: true,
    hasSC: true,
    useFCY: true,               // WEC utilise FCY
    tyreVisible: true,
    compoundVisible: true,
    isShort: false
  },
  "IndyCar": {
    hasCompounds: true,
    hasPit: true,
    hasSC: true,
    useFCY: false,
    tyreVisible: true,
    compoundVisible: true,
    isShort: false
  }
};

/* Profil par défaut si catégorie inconnue : F1-like */
var RJ_CAT_PROFILE_DEFAULT = {
  hasCompounds: true,
  hasPit: true,
  hasSC: true,
  useFCY: false,
  tyreVisible: true,
  compoundVisible: true,
  isShort: false
};

/* ========================================================================
 * 2. ACCESSEURS
 * ===================================================================== */

function rjCatProfile() {
  if (typeof G === "undefined" || !G.cat) return RJ_CAT_PROFILE_DEFAULT;
  return RJ_CAT_PROFILES[G.cat] || RJ_CAT_PROFILE_DEFAULT;
}

function rjCatHas(flag) {
  var p = rjCatProfile();
  return !!p[flag];
}

function rjDebugCat() {
  if (typeof G === "undefined") {
    console.log("[RJ] G non défini");
    return;
  }
  var p = rjCatProfile();
  console.log("=== RJ CATEGORY PROFILE ===");
  console.log("Catégorie courante : " + (G.cat || "(non définie)"));
  console.log("Profil appliqué :");
  Object.keys(p).forEach(function(k) {
    console.log("  " + k.padEnd(18) + " = " + p[k]);
  });
}

/* ========================================================================
 * 3. INITIALISATION
 * On log le profil au démarrage de chaque course pour debug.
 * ===================================================================== */

(function rjInstallCatLogger() {
  if (typeof window === "undefined") return;
  if (window._rjCatLoggerInstalled) return;
  
  function tryInstall() {
    if (typeof window.runRaceLive !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjCatLoggerInstalled) return;
    window._rjCatLoggerInstalled = true;
    
    /* Ce module ne faisait qu'imprimer un diagnostic au départ : il n'a pas
       à s'insérer dans la chaîne de lancement. Il s'inscrit au registre
       prévu pour cela (RJ_RACE_START_HOOKS), ce qui retire une enveloppe
       de plus sur runRaceLive. */
    if (!Array.isArray(window.RJ_RACE_START_HOOKS)) window.RJ_RACE_START_HOOKS = [];
    window.RJ_RACE_START_HOOKS.push({
      id: "04i-category-tuning",
      apres: function rjCatLoggedRunRaceLive() {
      try {
        var p = rjCatProfile();
        var flags = [];
        if (p.hasCompounds) flags.push("compounds");
        if (p.hasPit) flags.push("pit");
        if (p.hasSC) flags.push("SC");
        if (p.useFCY) flags.push("FCY");
        if (p.tyreVisible) flags.push("tyre-bar");
        console.log("[RJ] Catégorie '" + (G.cat || "?") + "' — flags: " + flags.join(", "));
      } catch(e) {}
      }
    });
  }
  
  tryInstall();
  
  console.log("[RJ] Module Cat Tuning chargé — adaptation par catégorie. Debug: rjDebugCat()");
})();
