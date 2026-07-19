/* =====================================================================
 * 04h-graphics-overlay.js — REFONTE PHASE GRAPHIQUE
 * 
 * Ajoute trois éléments visuels au leaderboard live, sans modifier le
 * rendu legacy. Le module wrappe renderLiveLeaderboard et augmente
 * le DOM après que le rendu original ait été fait.
 * 
 * 1. PASTILLE COMPOUND par pilote (à côté du nom)
 *    - Lit driver._tyreCompound (legacy ET nouveau)
 *    - Couleurs officielles : rouge (soft), jaune (medium), blanc (hard),
 *      vert (intermediate, pas utilisé), bleu (wet)
 * 
 * 2. BARRE D'USURE PNEUS DU JOUEUR (sous son nom)
 *    - Lit rjGetAvgTyreWear() de Phase 2
 *    - Vert (0-50) → Jaune (50-75) → Rouge (75-100)
 *    - Clignote quand approche du cliff (>85)
 * 
 * 3. BADGE YELLOW/SC en haut du leaderboard
 *    - Lit LIVE_RACE._track de Phase 5
 *    - Bandeau ambre pour yellow flag
 *    - Bandeau rouge plus prononcé pour safety car
 * 
 * ARCHITECTURE :
 *   - Wrap renderLiveLeaderboard pour s'exécuter APRÈS le rendu legacy
 *   - Manipule le DOM existant pour ajouter les éléments
 *   - CSS injecté dynamiquement au chargement (animation cliff, etc.)
 * ===================================================================== */

/* ========================================================================
 * 1. CSS INJECTÉ
 * ===================================================================== */

(function rjInjectGraphicsCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("rj-graphics-style")) return;
  
  var style = document.createElement("style");
  style.id = "rj-graphics-style";
  style.textContent = [
    /* Pastille compound (pour tous les pilotes) */
    ".rj-compound-pill{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;margin-left:6px;font-size:10px;flex-shrink:0;line-height:1;vertical-align:-1px}",
    
    /* Wrapper barre d'usure joueur */
    ".rj-tyre-wear-wrap{display:flex;align-items:center;gap:6px;margin-top:4px;padding-right:8px;height:6px}",
    ".rj-tyre-wear-label{font-family:var(--font-display);font-size:8px;font-weight:800;color:var(--text3);letter-spacing:.10em;text-transform:uppercase;flex-shrink:0;min-width:34px}",
    ".rj-tyre-wear-track{flex:1;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;position:relative}",
    ".rj-tyre-wear-fill{height:100%;border-radius:2px;transition:width .4s ease,background .3s ease}",
    ".rj-tyre-wear-fill.cliff{animation:rjTyreCliff 0.6s ease-in-out infinite}",
    "@keyframes rjTyreCliff{0%,100%{opacity:1}50%{opacity:0.4}}",
    
    /* Badge yellow/SC en haut du leaderboard */
    ".rj-track-badge{display:flex;align-items:center;gap:8px;padding:6px 14px;font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid var(--border)}",
    ".rj-track-badge-yellow{background:linear-gradient(90deg,rgba(255,179,0,0.18) 0%,rgba(255,179,0,0.08) 100%);color:#FFB300;border-top:1px solid rgba(255,179,0,0.4);border-bottom:1px solid rgba(255,179,0,0.4)}",
    ".rj-track-badge-sc{background:linear-gradient(90deg,rgba(255,140,0,0.22) 0%,rgba(255,140,0,0.10) 100%);color:#FF8C00;border-top:1px solid rgba(255,140,0,0.5);border-bottom:1px solid rgba(255,140,0,0.5);animation:rjBadgePulse 1.4s ease-in-out infinite}",
    "@keyframes rjBadgePulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)}}",
    ".rj-track-badge-icon{display:inline-flex;width:12px;height:12px;border-radius:50%;flex-shrink:0;align-items:center;justify-content:center;font-size:10px;line-height:1}",
    ".rj-track-badge-yellow .rj-track-badge-icon{background:#FFB300;color:#1a1a1f;font-weight:900}",
    ".rj-track-badge-sc .rj-track-badge-icon{background:#FF8C00;color:#fff}"
  ].join("");
  
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener("DOMContentLoaded", function() {
      if (document.head && !document.getElementById("rj-graphics-style")) {
        document.head.appendChild(style);
      }
    });
  }
})();

/* ========================================================================
 * 2. HELPERS
 * ===================================================================== */

function _rjGetTyreWearColor(wear) {
  // 0-50 vert, 50-75 jaune, 75-100 rouge
  if (wear < 50) {
    // Vert dégradé selon proximité du jaune
    var t = wear / 50;  // 0..1
    return "#00E676"; // garde vert constant pour clarté
  } else if (wear < 75) {
    return "#FFB300"; // amber
  } else {
    return "#FF1801"; // red
  }
}

function _rjGetCompoundPill(compound, weatherId) {
  if (!compound || typeof _compoundEffects !== "function") return "";
  var eff = _compoundEffects(compound, weatherId);
  if (!eff) return "";
  return '<span class="rj-compound-pill" title="' + (eff.label || compound) + '">' + 
         (eff.icon || "•") + '</span>';
}

/* ========================================================================
 * 3. AUGMENTATION DU LEADERBOARD
 * Pour chaque ligne pilote, ajoute la pastille compound juste après le nom.
 * Pour le joueur, ajoute aussi la barre d'usure pneus.
 * ===================================================================== */

function _rjAugmentLeaderboardRows() {
  if (typeof document === "undefined") return;
  if (!LIVE_RACE || !LIVE_RACE.drivers) return;
  
  var leaderboard = document.getElementById("live-leaderboard");
  if (!leaderboard) return;
  
  // Récupère toutes les lignes de pilotes (les divs avec P1, P2, etc.)
  // Ce sont les divs enfants directs qui ne sont ni le best-lap ni le header
  var rows = leaderboard.querySelectorAll("div");
  if (!rows || rows.length === 0) return;
  
  // Le rendu legacy : chaque ligne contient un span "P1" en début, puis un span flex
  // contenant le nom du pilote.
  // 
  // Stratégie : on parcourt LIVE_RACE.drivers triés par position et on cherche
  // pour chaque pilote la ligne correspondante par position dans le DOM.
  
  var sortedDrivers = LIVE_RACE.drivers.slice().sort(function(a, b) {
    return (a.pos || 99) - (b.pos || 99);
  });
  
  // Trouve les lignes qui ressemblent à des lignes pilotes
  var driverRows = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var posSpan = row.querySelector('span[style*="font-family:var(--font-display)"]');
    if (!posSpan) continue;
    var posText = posSpan.textContent || "";
    var match = posText.match(/^P(\d+)$/);
    if (match) {
      driverRows.push({ row: row, pos: parseInt(match[1], 10) });
    }
  }
  
  if (driverRows.length === 0) return;
  
  var weatherId = (typeof RACE_STATE !== "undefined" && RACE_STATE.weather) ? RACE_STATE.weather.id : "dry";
  
  // Pour chaque pilote, augmente sa ligne
  sortedDrivers.forEach(function(driver) {
    if (driver.dnf) return;
    
    var driverRow = driverRows.find(function(dr) { return dr.pos === driver.pos; });
    if (!driverRow) return;
    
    var row = driverRow.row;
    var compound = driver._tyreCompound;
    
    // === 1. Pastille compound pour TOUS les pilotes ===
    // Le rendu legacy ajoute déjà la pastille pour le joueur. On ne touche pas
    // la sienne, mais on ajoute pour les autres.
    if (compound && !driver.isPlayer) {
      // Vérifie si on a déjà ajouté la pastille (idempotence pour re-renders)
      var existingPill = row.querySelector(".rj-compound-pill");
      if (!existingPill) {
        // Trouve le span flex qui contient le nom (le 2ème span du row)
        var nameContainer = row.querySelectorAll('span')[1];
        if (nameContainer) {
          // Trouve le span qui contient le texte du pilote (text node ou span direct)
          var nameSpan = nameContainer.querySelector('span:not(.rj-compound-pill)');
          if (nameSpan) {
            // Insert la pastille après le nom
            var pill = document.createElement("span");
            pill.className = "rj-compound-pill";
            var eff = (typeof _compoundEffects === "function") ? _compoundEffects(compound, weatherId) : null;
            if (eff) {
              pill.title = eff.label || compound;
              pill.textContent = eff.icon || "•";
              nameSpan.parentNode.insertBefore(pill, nameSpan.nextSibling);
            }
          }
        }
      }
    }
    
    // === 2. Barre d'usure pneus pour le JOUEUR uniquement ===
    if (driver.isPlayer && driver._rjCarState && typeof rjGetAvgTyreWear === "function") {
      var avgWear = 0;
      try { avgWear = rjGetAvgTyreWear(driver); } catch(e) { return; }
      
      // Vérifie si on a déjà ajouté la barre
      var existingWear = row.querySelector(".rj-tyre-wear-wrap");
      
      if (!existingWear) {
        // Crée la barre
        var wearWrap = document.createElement("div");
        wearWrap.className = "rj-tyre-wear-wrap";
        
        var wearLabel = document.createElement("span");
        wearLabel.className = "rj-tyre-wear-label";
        wearLabel.textContent = "PNEUS";
        
        var wearTrack = document.createElement("div");
        wearTrack.className = "rj-tyre-wear-track";
        
        var wearFill = document.createElement("div");
        wearFill.className = "rj-tyre-wear-fill";
        wearTrack.appendChild(wearFill);
        
        wearWrap.appendChild(wearLabel);
        wearWrap.appendChild(wearTrack);
        
        // Insère après la dernière span du row mais avant le span de droite (last lap + gap)
        // En pratique on l'insère à la fin du row (devient une ligne suivante grâce à flex-wrap)
        // Mais le row a `display:flex;align-items:center` — il faut donc que la barre soit
        // dans le container central (le 2ème span avec flex:1).
        var nameContainer = row.querySelectorAll('span')[1];
        if (nameContainer) {
          // Force flex-direction column sur le container central pour empiler nom+barre
          var nameContainerStyle = nameContainer.getAttribute("style") || "";
          if (nameContainerStyle.indexOf("flex-direction:column") < 0) {
            nameContainer.setAttribute("style", nameContainerStyle + ";flex-direction:column;align-items:flex-start");
          }
          nameContainer.appendChild(wearWrap);
        }
        
        existingWear = wearWrap;
      }
      
      // Update la barre
      var fill = existingWear.querySelector(".rj-tyre-wear-fill");
      if (fill) {
        fill.style.width = Math.max(0, Math.min(100, avgWear)) + "%";
        fill.style.background = _rjGetTyreWearColor(avgWear);
        // Cliff warning
        if (avgWear > 85) {
          fill.classList.add("cliff");
        } else {
          fill.classList.remove("cliff");
        }
      }
    }
  });
}

/* ========================================================================
 * 4. BADGE YELLOW/SC EN HAUT DU LEADERBOARD
 * ===================================================================== */

function _rjUpdateTrackBadge() {
  if (typeof document === "undefined") return;
  if (!LIVE_RACE) return;
  
  var leaderboard = document.getElementById("live-leaderboard");
  if (!leaderboard) return;
  
  var existingBadge = document.getElementById("rj-track-badge");
  
  // Détermine quel badge afficher
  var badgeContent = null;
  
  if (LIVE_RACE._track) {
    var t = LIVE_RACE._track;
    
    if (t.safetyCar && t.safetyCar.active) {
      badgeContent = {
        type: "sc",
        text: "SAFETY CAR · " + (t.safetyCar.lapsRemaining || 1) + " tour" + 
              ((t.safetyCar.lapsRemaining || 1) > 1 ? "s" : "") + " restant" + 
              ((t.safetyCar.lapsRemaining || 1) > 1 ? "s" : "")
      };
    } else if (t.yellowSectors && t.yellowSectors.length > 0) {
      var sectors = t.yellowSectors.map(function(y) { return y.sectorId; }).join(" · ");
      var totalLapsLeft = Math.max.apply(null, t.yellowSectors.map(function(y) { return y.lapsRemaining; }));
      badgeContent = {
        type: "yellow",
        text: "DRAPEAU JAUNE · " + sectors + " · " + totalLapsLeft + " tour" + 
              (totalLapsLeft > 1 ? "s" : "")
      };
    }
  }
  
  if (!badgeContent) {
    // Pas de track event actif → retire le badge s'il existe
    if (existingBadge) existingBadge.remove();
    return;
  }
  
  // Crée ou update le badge
  if (!existingBadge) {
    existingBadge = document.createElement("div");
    existingBadge.id = "rj-track-badge";
    // Insère en première position dans le leaderboard
    if (leaderboard.firstChild) {
      leaderboard.insertBefore(existingBadge, leaderboard.firstChild);
    } else {
      leaderboard.appendChild(existingBadge);
    }
  }
  
  var className = "rj-track-badge ";
  var iconChar = "!";
  if (badgeContent.type === "sc") {
    className += "rj-track-badge-sc";
    iconChar = "SC";
  } else {
    className += "rj-track-badge-yellow";
    iconChar = "!";
  }
  
  existingBadge.className = className;
  existingBadge.innerHTML = '<span class="rj-track-badge-icon">' + iconChar + '</span>' +
                            '<span>' + badgeContent.text + '</span>';
}

/* ========================================================================
 * 5. DEBUG
 * ===================================================================== */

function rjDebugGraphics() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE) {
    console.log("[RJ] Pas de course active");
    return;
  }
  console.log("=== RJ GRAPHICS ===");
  console.log("Track badge actif :",
    (LIVE_RACE._track && LIVE_RACE._track.safetyCar && LIVE_RACE._track.safetyCar.active) ? "SC" :
    (LIVE_RACE._track && LIVE_RACE._track.yellowSectors && LIVE_RACE._track.yellowSectors.length > 0) ? "YELLOW" : "aucun"
  );
  
  var player = LIVE_RACE.drivers && LIVE_RACE.drivers.find(function(d){ return d.isPlayer; });
  if (player) {
    console.log("Joueur :");
    console.log("  Compound :", player._tyreCompound || "(non défini)");
    if (typeof rjGetAvgTyreWear === "function") {
      console.log("  Usure moyenne :", rjGetAvgTyreWear(player).toFixed(1) + "%");
    }
  }
  
  console.log("Compounds des autres pilotes :");
  if (LIVE_RACE.drivers) {
    LIVE_RACE.drivers.filter(function(d){ return !d.isPlayer && !d.dnf; }).slice(0, 10).forEach(function(d) {
      console.log("  P" + d.pos + " " + d.name + " : " + (d._tyreCompound || "(non défini)"));
    });
  }
}

/* ========================================================================
 * 6. HOOK PRINCIPAL — Wrap renderLiveLeaderboard
 * ===================================================================== */

(function rjInstallGraphicsHook() {
  if (typeof window === "undefined") return;
  if (window._rjGraphicsHookInstalled) return;
  
  var prevRender = window.renderLiveLeaderboard;
  if (typeof prevRender !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallGraphicsHook, 50);
    return;
  }
  
  window._rjGraphicsHookInstalled = true;
  
  window.renderLiveLeaderboard = function rjGraphicsWrappedRender() {
    var result = prevRender.apply(this, arguments);
    
    try {
      if (LIVE_RACE && LIVE_RACE.drivers && !LIVE_RACE.finished) {
        // Update badge yellow/SC en premier (affecte la position des autres éléments)
        _rjUpdateTrackBadge();
        // Augmente les lignes (compound + barre joueur)
        _rjAugmentLeaderboardRows();
      }
    } catch(e) {
      console.warn("[RJ] Erreur graphics overlay:", e && e.message);
    }
    
    return result;
  };
  
  console.log("[RJ] Module Graphics chargé — leaderboard augmenté. Debug: rjDebugGraphics()");
})();
