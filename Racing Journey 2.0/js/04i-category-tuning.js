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
 *   1. Définit RJ_CAT_PROFILE par catégorie au démarrage de course
 *   2. Wrappe les fonctions de Phase 6 (_rjPushRadio) et Graphics
 *      (_rjAugmentLeaderboardRows, _rjUpdateTrackBadge) pour filtrer
 *      les comportements selon le profil
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
 * 3. PATCH PHASE 6 — Radio émergente
 * Filtre les messages incohérents avec la catégorie.
 * ===================================================================== */

(function rjPatchRadio() {
  if (typeof window === "undefined") return;
  if (window._rjRadioCatPatchInstalled) return;
  
  // On patch _rjPushRadio quand il existe
  function tryInstall() {
    if (typeof window._rjPushRadio !== "function" && typeof _rjPushRadio !== "function") {
      // Phase 6 pas encore chargée, on retentera
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjRadioCatPatchInstalled) return;
    window._rjRadioCatPatchInstalled = true;
    
    // Liste des catégories radio à filtrer selon le profil
    var TYRE_RELATED = [
      "tyre_overheat", "tyre_cliff_warning", "tyre_cold_pit", "tyre_optimal"
    ];
    var PIT_RELATED = [
      "strategy_pit_window", "strategy_undercut_threat", "strategy_undercut_opportunity",
      "tyre_cold_pit"  // sortie de stand seulement si pit existe
    ];
    
    var origPush = window._rjPushRadio || _rjPushRadio;
    
    var wrapped = function rjCatFilteredPushRadio(category, vars, opts) {
      try {
        var profile = rjCatProfile();
        
        // Filtre 1 : pas de messages pneus en karting (pas de compound visible)
        if (!profile.hasCompounds && TYRE_RELATED.indexOf(category) >= 0) {
          return false;
        }
        
        // Filtre 2 : pas de messages pit dans les catégories sans pit
        if (!profile.hasPit && PIT_RELATED.indexOf(category) >= 0) {
          return false;
        }
        
        // Filtre 3 : pas de messages SC dans les catégories sans SC
        if (!profile.hasSC && (category === "track_safety_car" || category === "track_sc_end")) {
          return false;
        }
        
        // Filtre 4 : si la catégorie utilise FCY, on remplace le titre du message SC
        // (on ne peut pas modifier le template en place, donc on substitute)
        if (profile.useFCY && category === "track_safety_car") {
          // On laisse passer mais on tag pour que le message dise "FCY"
          // → modifié à la source via vars
          if (vars && !vars._fcy) {
            vars._fcy = true;
            // Ce qui sera lu dans les templates : on insère "Full Course Yellow"
          }
        }
        
      } catch(e) {
        // En cas de doute, laisse passer
      }
      
      return origPush.apply(this, arguments);
    };
    
    if (typeof window._rjPushRadio !== "undefined") window._rjPushRadio = wrapped;
    // Aussi le global non-window pour les modules qui y accèdent directement
    try { _rjPushRadio = wrapped; } catch(e) {}
  }
  
  tryInstall();
})();

/* ========================================================================
 * 4. PATCH PHASE 6 — Modifie les templates radio pour FCY
 * On wrappe _rjFormatRadioMsg pour substituer "Safety Car" → "FCY" en WEC
 * ===================================================================== */

(function rjPatchRadioFormatForFCY() {
  if (typeof window === "undefined") return;
  if (window._rjRadioFCYPatchInstalled) return;
  
  function tryInstall() {
    if (typeof window._rjFormatRadioMsg !== "function" && typeof _rjFormatRadioMsg !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjRadioFCYPatchInstalled) return;
    window._rjRadioFCYPatchInstalled = true;
    
    var origFormat = window._rjFormatRadioMsg || _rjFormatRadioMsg;
    
    var wrapped = function rjCatFormatRadioMsg(template, vars) {
      var formatted = origFormat.apply(this, arguments);
      
      try {
        if (rjCatHas("useFCY") && formatted) {
          // Remplace "Safety Car" / "SC" par "Full Course Yellow" / "FCY"
          if (formatted.title) {
            formatted.title = formatted.title.replace(/Safety Car/gi, "Full Course Yellow")
                                              .replace(/\bSC\b/g, "FCY");
          }
          if (formatted.desc) {
            formatted.desc = formatted.desc.replace(/Safety car/gi, "Full Course Yellow")
                                            .replace(/\bSC\b/g, "FCY");
          }
        }
      } catch(e) {}
      
      return formatted;
    };
    
    if (typeof window._rjFormatRadioMsg !== "undefined") window._rjFormatRadioMsg = wrapped;
    try { _rjFormatRadioMsg = wrapped; } catch(e) {}
  }
  
  tryInstall();
})();

/* ========================================================================
 * 5. PATCH GRAPHICS — Overlay leaderboard
 * Filtre l'affichage des pastilles compound et de la barre d'usure.
 * Modifie le badge yellow/SC pour afficher FCY.
 * ===================================================================== */

(function rjPatchGraphics() {
  if (typeof window === "undefined") return;
  if (window._rjGraphicsCatPatchInstalled) return;
  
  function tryInstall() {
    if (typeof window._rjAugmentLeaderboardRows !== "function" && 
        typeof _rjAugmentLeaderboardRows !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjGraphicsCatPatchInstalled) return;
    window._rjGraphicsCatPatchInstalled = true;
    
    // ===== A. Patch _rjAugmentLeaderboardRows =====
    // Si la catégorie n'a pas de compounds visibles ou de pneus visibles,
    // on retire les éléments correspondants.
    var origAugment = window._rjAugmentLeaderboardRows || _rjAugmentLeaderboardRows;
    
    var wrappedAugment = function rjCatAugmentLeaderboardRows() {
      var profile = rjCatProfile();
      
      // Si compounds ET tyre invisibles (karting) : pas la peine d'appeler
      if (!profile.compoundVisible && !profile.tyreVisible) {
        return;
      }
      
      // Sinon on appelle la version originale
      var result = origAugment.apply(this, arguments);
      
      // Post-process : retire les éléments selon le profil
      try {
        if (typeof document === "undefined") return result;
        var leaderboard = document.getElementById("live-leaderboard");
        if (!leaderboard) return result;
        
        if (!profile.compoundVisible) {
          // Retire toutes les pastilles compound ajoutées par 04h
          var pills = leaderboard.querySelectorAll(".rj-compound-pill");
          for (var i = pills.length - 1; i >= 0; i--) {
            pills[i].parentNode && pills[i].parentNode.removeChild(pills[i]);
          }
        }
        
        if (!profile.tyreVisible) {
          // Retire la barre d'usure du joueur
          var bars = leaderboard.querySelectorAll(".rj-tyre-wear-wrap");
          for (var j = bars.length - 1; j >= 0; j--) {
            bars[j].parentNode && bars[j].parentNode.removeChild(bars[j]);
          }
        }
      } catch(e) {
        console.warn("[RJ] Erreur cat patch graphics:", e && e.message);
      }
      
      return result;
    };
    
    if (typeof window._rjAugmentLeaderboardRows !== "undefined") {
      window._rjAugmentLeaderboardRows = wrappedAugment;
    }
    try { _rjAugmentLeaderboardRows = wrappedAugment; } catch(e) {}
    
    // ===== B. Patch _rjUpdateTrackBadge pour FCY =====
    var origBadge = window._rjUpdateTrackBadge || _rjUpdateTrackBadge;
    if (typeof origBadge === "function") {
      var wrappedBadge = function rjCatUpdateTrackBadge() {
        var result = origBadge.apply(this, arguments);
        
        // Si FCY actif, modifie le texte du badge SC
        try {
          if (rjCatHas("useFCY") && typeof document !== "undefined") {
            var badge = document.getElementById("rj-track-badge");
            if (badge && badge.classList.contains("rj-track-badge-sc")) {
              // Remplace "SAFETY CAR" par "FCY" dans le contenu
              var icon = badge.querySelector(".rj-track-badge-icon");
              var text = badge.querySelector("span:not(.rj-track-badge-icon)");
              if (icon) icon.textContent = "FCY";
              if (text) {
                text.textContent = text.textContent.replace(/SAFETY CAR/g, "FULL COURSE YELLOW");
              }
            }
          }
          
          // Si la catégorie n'a pas de SC ni de yellow, retire le badge
          var profile = rjCatProfile();
          if (!profile.hasSC) {
            var b = document.getElementById("rj-track-badge");
            if (b && b.classList.contains("rj-track-badge-sc")) {
              b.remove();
            }
          }
        } catch(e) {}
        
        return result;
      };
      
      if (typeof window._rjUpdateTrackBadge !== "undefined") {
        window._rjUpdateTrackBadge = wrappedBadge;
      }
      try { _rjUpdateTrackBadge = wrappedBadge; } catch(e) {}
    }
  }
  
  tryInstall();
})();

/* ========================================================================
 * 6. PATCH PHASE 5 — Safety Car
 * Bloque le déclenchement du SC dans les catégories sans SC.
 * Important : on patch _rjDetectSCTrigger qui est l'entrée du système.
 * ===================================================================== */

(function rjPatchSCTrigger() {
  if (typeof window === "undefined") return;
  if (window._rjSCCatPatchInstalled) return;
  
  function tryInstall() {
    if (typeof window._rjDetectSCTrigger !== "function" && 
        typeof _rjDetectSCTrigger !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjSCCatPatchInstalled) return;
    window._rjSCCatPatchInstalled = true;
    
    var origDetect = window._rjDetectSCTrigger || _rjDetectSCTrigger;
    
    var wrapped = function rjCatDetectSCTrigger() {
      // Si la catégorie n'a pas de SC, ne déclenche jamais
      if (!rjCatHas("hasSC")) return null;
      return origDetect.apply(this, arguments);
    };
    
    if (typeof window._rjDetectSCTrigger !== "undefined") {
      window._rjDetectSCTrigger = wrapped;
    }
    try { _rjDetectSCTrigger = wrapped; } catch(e) {}
  }
  
  tryInstall();
})();

/* ========================================================================
 * 7. PATCH PHASE 5 — Drapeaux jaunes
 * En karting et F4, pas de drapeaux jaunes. On bloque l'entrée.
 * ===================================================================== */

(function rjPatchYellow() {
  if (typeof window === "undefined") return;
  if (window._rjYellowCatPatchInstalled) return;
  
  function tryInstall() {
    if (typeof window._rjUpdateYellowSectors !== "function" && 
        typeof _rjUpdateYellowSectors !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjYellowCatPatchInstalled) return;
    window._rjYellowCatPatchInstalled = true;
    
    var origUpdate = window._rjUpdateYellowSectors || _rjUpdateYellowSectors;
    
    var wrapped = function rjCatUpdateYellowSectors() {
      var profile = rjCatProfile();
      
      // Karting : pas de drapeau jaune (course trop simple)
      if (G && (G.cat === "Karting Junior" || G.cat === "Karting Senior")) {
        // On laisse decay les jaunes existants au cas où, mais on ne crée pas de nouveaux
        try {
          if (LIVE_RACE && LIVE_RACE._track && LIVE_RACE._track.yellowSectors) {
            LIVE_RACE._track.yellowSectors = LIVE_RACE._track.yellowSectors.filter(function(y) {
              y.lapsRemaining--;
              return y.lapsRemaining > 0;
            });
          }
        } catch(e) {}
        return;
      }
      
      // Sinon comportement normal
      return origUpdate.apply(this, arguments);
    };
    
    if (typeof window._rjUpdateYellowSectors !== "undefined") {
      window._rjUpdateYellowSectors = wrapped;
    }
    try { _rjUpdateYellowSectors = wrapped; } catch(e) {}
  }
  
  tryInstall();
})();

/* ========================================================================
 * 8. INITIALISATION
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
    
    var origRun = window.runRaceLive;
    window.runRaceLive = function rjCatLoggedRunRaceLive() {
      var result = origRun.apply(this, arguments);
      
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
      
      return result;
    };
  }
  
  tryInstall();
  
  console.log("[RJ] Module Cat Tuning chargé — adaptation par catégorie. Debug: rjDebugCat()");
})();
