/* =============================================================================
 * 04q — POLISH & REBALANCE (corrections d'expérience UX)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Module de corrections d'expérience qui regroupe plusieurs petites améliorations
 * sans toucher aux fichiers source 03/04/06. Wraps et observers DOM uniquement.
 *
 * CORRECTIONS APPLIQUÉES :
 *   1. Notifications menu principal : suppression badge agent, activation
 *      dynamique badges sponsors (offres dispo) et contrats (offres + sponsors)
 *   2. Suppression km/h dans onglets simulation tour (essais libres + qualif)
 *   3. Cache la valeur "vmax" (km/h) dans #quali-live-sec-vmax
 *   4. Bandeau S-save coupé : wrap showSaveMenu pour passer par navTo
 *
 * ORDRE DE CHARGEMENT :
 *   - APRÈS 04-race-engine.js (showSaveMenu, updateHomeBadges)
 *   - APRÈS 03-data-agent.js (sponsorOffers, offers)
 *   - Place naturelle : tout à la fin (après 04p)
 *
 * COMPATIBILITÉ :
 *   - Aucune modification de comportement de gameplay
 *   - Tous les wraps préservent les fonctions originales
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ========================================================================
  // 1. POINT 4 — FIX BANDEAU S-SAVE COUPÉ
  // ========================================================================
  //
  // PROBLÈME : showSaveMenu() utilise classList.add("on") direct sans
  // passer par navTo()/go(), ce qui omet _scrollScreenTop et fait apparaître
  // l'écran avec un état CSS incomplet.
  //
  // FIX : wrap showSaveMenu pour qu'après son rendu, on appelle go() (qui
  // fait le bon scroll-top + classes correctes) au lieu de juste classList.add.
  // ========================================================================

  function wrapShowSaveMenu() {
    if (typeof window.showSaveMenu !== "function") return false;
    if (window.showSaveMenu._rjPolishedSave) return true;

    var orig = window.showSaveMenu;
    window.showSaveMenu = function rjShowSaveMenuWrapped() {
      var r;
      try {
        r = orig.apply(this, arguments);
      } catch (err) {
        console.warn("[04q] showSaveMenu orig error:", err);
      }
      // Re-applique l'ouverture proprement via go() si dispo
      try {
        if (typeof window.go === "function") {
          // go() fait le _scrollScreenTop et applique correctement les classes
          window.go("S-save");
        } else {
          // Fallback : reset scroll manuel
          var scr = document.getElementById("S-save");
          if (scr) {
            if (typeof scr.scrollTop === "number") scr.scrollTop = 0;
            scr.querySelectorAll(".scroll").forEach(function(el) {
              el.scrollTop = 0;
            });
          }
        }
        // Masque main-nav comme l'original
        var mn = document.getElementById("main-nav");
        if (mn) mn.classList.remove("show");
      } catch (e) {
        console.warn("[04q] showSaveMenu post error:", e);
      }
      return r;
    };
    window.showSaveMenu._rjPolishedSave = true;
    console.log("[04q] showSaveMenu wrapped (bandeau S-save fix)");
    return true;
  }

  // ========================================================================
  // 2. POINT 2 — SUPPRESSION DES KM/H DANS QUALIF/ESSAIS
  // ========================================================================
  //
  // CONTEXTE : .quali-live-sec-vmax affiche "245 km/h" en bas des secteurs
  // pendant qualif/essais. À masquer entièrement (pas pertinent dans un
  // simulateur où la vitesse de pointe n'a pas de sens représentatif).
  //
  // STRATÉGIE : ajouter une règle CSS qui masque tous les .quali-live-sec-vmax
  // ainsi que tout élément avec id ou classe similaire. Plus robuste qu'un
  // wrap car indépendant du timing.
  // ========================================================================

  function injectVmaxHideStyles() {
    if (document.getElementById("rj-vmax-hide-styles")) return;
    var st = document.createElement("style");
    st.id = "rj-vmax-hide-styles";
    st.textContent = [
      "/* Hide km/h en qualif/essais (point 2 demande utilisateur) */",
      ".quali-live-sec-vmax { display: none !important; }",
      "[class*='quali-live-sec-vmax'] { display: none !important; }",
      // Header secteur "Vmax" peut aussi rester orphelin → on cherche label sibling
      ".quali-live-sec-vmax-label { display: none !important; }",
      // FP equivalents si existants
      ".fp-live-sec-vmax { display: none !important; }",
      ".practice-live-sec-vmax { display: none !important; }"
    ].join("\n");
    document.head.appendChild(st);
    console.log("[04q] Styles km/h masqués injectés");
  }

  // ========================================================================
  // 3. POINT 4 — NOTIFICATIONS MENU PRINCIPAL (badges)
  // ========================================================================
  //
  // CONTEXTE :
  //   - h-agent-badge : actuellement affiche unread mails agent → SUPPRIMER
  //   - h-contracts-badge : déjà fonctionnel (offres en attente)
  //   - h-sponsors-badge : pas activé → ACTIVER quand offres sponsors dispo
  //
  // STRATÉGIE : wrap updateHomeBadges pour :
  //   1. Toujours masquer h-agent-badge
  //   2. Calculer les sponsors dispos et activer h-sponsors-badge
  //   3. (h-contracts-badge laissé tel quel : déjà OK)
  // ========================================================================

  function countAvailableSponsorOffers() {
    if (typeof G === "undefined" || !G) return 0;
    // sponsorOffers = offres reçues, pas encore signées/déclinées
    var offers = G.sponsorOffers || [];
    if (!Array.isArray(offers)) return 0;
    var c = 0;
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      if (!o) continue;
      if (o.signed || o.declined || o.expired) continue;
      c++;
    }
    return c;
  }

  function countAvailableContractOffers() {
    if (typeof G === "undefined" || !G) return 0;
    var offers = G.offers || [];
    if (!Array.isArray(offers)) return 0;
    var c = 0;
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      if (!o) continue;
      if (o.signed || o.declined) continue;
      c++;
    }
    return c;
  }

  function applyHomeBadges() {
    try {
      // 1. Badge agent : TOUJOURS masqué (point 4 — l'agent passe par messagerie)
      var ba = document.getElementById("h-agent-badge");
      if (ba) {
        ba.style.display = "none";
        ba.textContent = "";
      }

      // 2. Badge sponsors : afficher si offres dispo
      var bs = document.getElementById("h-sponsors-badge");
      if (bs) {
        var nSpons = countAvailableSponsorOffers();
        if (nSpons > 0) {
          bs.style.display = "inline-flex";
          bs.textContent = nSpons > 9 ? "9+" : String(nSpons);
        } else {
          bs.style.display = "none";
          bs.textContent = "";
        }
      }

      // 3. Badge contrats : afficher si offres dispo (vérif redondante avec
      // updateHomeBadges existant, on s'aligne juste pour être sûr)
      var bc = document.getElementById("h-contracts-badge");
      if (bc) {
        var nCont = countAvailableContractOffers();
        if (nCont > 0) {
          bc.style.display = "inline-flex";
          bc.textContent = nCont > 9 ? "9+" : String(nCont);
        } else {
          bc.style.display = "none";
          bc.textContent = "";
        }
      }
    } catch (e) {
      console.warn("[04q] applyHomeBadges error:", e);
    }
  }

  function wrapUpdateHomeBadges() {
    if (typeof window.updateHomeBadges !== "function") return false;
    if (window.updateHomeBadges._rjPolishedBadges) return true;

    var orig = window.updateHomeBadges;
    window.updateHomeBadges = function rjUpdateHomeBadgesWrapped() {
      var r;
      try {
        r = orig.apply(this, arguments);
      } catch (e) {
        console.warn("[04q] updateHomeBadges orig:", e);
      }
      // Override : nos règles l'emportent
      applyHomeBadges();
      return r;
    };
    window.updateHomeBadges._rjPolishedBadges = true;
    console.log("[04q] updateHomeBadges wrapped (badges agent/sponsors/contrats)");
    return true;
  }

  // ========================================================================
  // 4. WATCHDOG : RÉAPPLIQUE LES BADGES PÉRIODIQUEMENT
  // ========================================================================
  //
  // Le code original peut appeler des fonctions qui re-affichent le badge
  // agent. On surveille toutes les secondes et on applique nos règles.
  // ========================================================================

  function startBadgeWatchdog() {
    setInterval(applyHomeBadges, 1500);
  }

  // ========================================================================
  // 5. APPLY ALL
  // ========================================================================

  function applyAllPolish() {
    var ok = 0, total = 0;
    function tryApply(fn) {
      total++;
      try { if (fn()) ok++; } catch (e) { console.warn("[04q] apply:", e); }
    }
    tryApply(wrapShowSaveMenu);
    tryApply(wrapUpdateHomeBadges);
    console.log("[04q] " + ok + "/" + total + " polish wraps appliqués");
  }

  // Init styles immédiatement
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      injectVmaxHideStyles();
      applyAllPolish();
      setTimeout(applyAllPolish, 500);
      setTimeout(applyAllPolish, 1500);
      setTimeout(applyHomeBadges, 200);
      startBadgeWatchdog();
    });
  } else {
    injectVmaxHideStyles();
    applyAllPolish();
    setTimeout(applyAllPolish, 500);
    setTimeout(applyAllPolish, 1500);
    setTimeout(applyHomeBadges, 200);
    startBadgeWatchdog();
  }

  // ========================================================================
  // 6. DEBUG API
  // ========================================================================

  window.rjPolishDebug = function() {
    console.log("=== 04q Polish Debug ===");
    console.log("showSaveMenu wrapped:",
      !!(window.showSaveMenu && window.showSaveMenu._rjPolishedSave));
    console.log("updateHomeBadges wrapped:",
      !!(window.updateHomeBadges && window.updateHomeBadges._rjPolishedBadges));
    console.log("Sponsor offers dispo:", countAvailableSponsorOffers());
    console.log("Contract offers dispo:", countAvailableContractOffers());
    console.log("Vmax styles injectés:",
      !!document.getElementById("rj-vmax-hide-styles"));
  };

  console.log("[04q] Polish & Rebalance module loaded");

})();

/* =============================================================================
 * 04q — PART 2 : ROUNDING DECIMALS (point 3 utilisateur)
 * =============================================================================
 *
 * APPROCHE : MutationObserver qui visite les nodes texte du DOM et arrondit
 * les nombres décimaux selon leur contexte. Préserve les chronos.
 *
 * RÈGLES DE PRÉSERVATION (chronos + données techniques) :
 *   - Texte ressemblant à un temps de tour : "1:23.456", "1:23,4"
 *   - Texte ressemblant à un écart en course : "+0.342s", "−0.1s", "(0.5s)"
 *   - Texte ressemblant à un format K : "1.5k", "12.3K"
 *   - Attribut SVG (path d=, x=, y=, cx=, cy=, r=)
 *   - Texte dans <code>, <pre>
 *
 * RÈGLES D'ARRONDI (valeurs) :
 *   - Pourcentages : "12.5%" → "13%"
 *   - Notes/ratings : "Note 75.5" → "Note 76"
 *   - Moyennes positions : "P1.5" → "P2"
 *   - Decimal seul dans cellule : "12.3" → "12"
 *   - Montants : "1234.5 €" → "1235 €"
 *
 * STRATÉGIE :
 *   - Observer le body en mutation:childList + characterData
 *   - Pour chaque text node ajouté/modifié, parser et remplacer
 *   - Performance : debounced + skip pendant les courses (LIVE_RACE actif)
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // Patterns de DÉTECTION (qu'est-ce qui est un chrono, qu'est-ce qui ne l'est pas)
  // ---------------------------------------------------------------------------
  // CHRONO_PATTERN : reconnait les chronos qu'on ne touche pas
  //   - "1:23.456"  (temps tour)
  //   - "1:23,4"    (avec virgule)
  //   - "+0.342s"   (gap)
  //   - "−0.1s"     (gap signé)
  //   - "0.34s"     (avec s)
  //   - "(0.342s)"  (gap entre parenthèses)
  // ---------------------------------------------------------------------------
  // K_PATTERN : "1.5k", "12.3K" → légitime, on garde
  // ---------------------------------------------------------------------------
  // VALUE_PATTERN : nombres avec décimales à arrondir
  //   - "12.5%" → "13%"
  //   - "+1.8%" → "+2%"
  //   - "P1.5"  → "P2"
  //   - "75.4"  isolé → "75"

  // Regex unique : capture nombre décimal avec contexte autour
  // Group 1 = signe optionnel (+/−/-)
  // Group 2 = entier
  // Group 3 = décimales
  // Group 4 = suffixe immédiat (%, €, k, s, ...)
  // ---------------------------------------------------------------------------
  // On évite de toucher quand le nombre est juste avant un "s" (= secondes)
  // ou juste avant un ":" (= chrono "1:23.4") ou dans "1.5k"

  // ----------------------------------------------------------------------
  // FONCTION DE TRANSFORMATION TEXTE
  // ----------------------------------------------------------------------

  function looksLikeChrono(textBefore, textAfter) {
    // Si le caractère juste avant est un chiffre + ":" → c'est un chrono "1:23.4"
    if (/\d:\s*$/.test(textBefore.slice(-3))) return true;
    // Si juste après il y a un "s" tout seul, c'est un gap en secondes
    if (/^s(?:[\s,.;:!?\)]|$)/i.test(textAfter)) return true;
    // Si juste après il y a un "k" ou "K" tout seul → followers/format K
    if (/^[kK](?:[\s,.;:!?\)]|$)/.test(textAfter)) return true;
    return false;
  }

  function processText(text) {
    if (!text || typeof text !== "string") return text;
    // Quick check : pas de point ni virgule décimale → rien à faire
    if (text.indexOf(".") < 0 && text.indexOf(",") < 0) return text;
    // Skip si très long (probablement code/CSS)
    if (text.length > 500) return text;

    // Match nombre décimal : signe? entier . décimales (point) ou , décimales (virgule)
    // On utilise [.] et exclut les décimales avec plus de 3 chiffres (probable hash/timestamp)
    var re = /([+\-−]?)(\d+)[\.,](\d{1,3})\b/g;
    var result = "";
    var lastEnd = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      var matchStart = m.index;
      var matchEnd = re.lastIndex;
      var sign = m[1] || "";
      var intPart = m[2];
      var decPart = m[3];

      // Contexte avant et après
      var before = text.substring(0, matchStart);
      var after = text.substring(matchEnd);

      // On regarde si c'est un chrono / format à préserver
      if (looksLikeChrono(before, after)) {
        // Skip : on garde le match tel quel
        result += text.substring(lastEnd, matchEnd);
        lastEnd = matchEnd;
        continue;
      }

      // Cas particulier : si le nombre est suivi immédiatement de "h" ou "min" / 
      // "kg" / "km" sans espace, on garde aussi (ex "12.5h" peut signifier h decimal)
      if (/^(?:h|min|kg|km|mph|kph|ms|ml|cl|cm|mm)\b/i.test(after)) {
        result += text.substring(lastEnd, matchEnd);
        lastEnd = matchEnd;
        continue;
      }

      // Sinon, on arrondit
      var fullNum = parseFloat(sign.replace("−", "-") + intPart + "." + decPart);
      var rounded = Math.round(fullNum);
      var roundedStr = (sign === "−" && rounded < 0) ? ("−" + Math.abs(rounded)) :
                       (rounded >= 0 && sign === "+") ? ("+" + rounded) :
                       String(rounded);

      // Append le texte avant + le nombre arrondi
      result += text.substring(lastEnd, matchStart) + roundedStr;
      lastEnd = matchEnd;
    }
    result += text.substring(lastEnd);
    return result;
  }

  // ----------------------------------------------------------------------
  // OBSERVER DOM
  // ----------------------------------------------------------------------

  // Tags qu'on ne touche pas
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, INPUT: 1, SVG: 1 };

  // Walk un node et transforme tous ses text nodes descendants
  function walkAndProcess(node) {
    if (!node) return;
    // Skip pendant qu'une course tourne live (perf)
    if (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.lap > 0 && !LIVE_RACE.finished) {
      return;
    }
    if (node.nodeType === 3) {
      // Text node
      var parent = node.parentNode;
      if (!parent) return;
      // Skip si parent a un tag à éviter
      var tag = parent.tagName;
      if (tag && SKIP_TAGS[tag]) return;
      // Skip si c'est dans un SVG
      var p = parent;
      while (p && p !== document.body) {
        if (p.tagName === "svg" || p.tagName === "SVG") return;
        if (p.hasAttribute && p.hasAttribute("data-rj-noround")) return;
        if (p.classList && (p.classList.contains("rj-bcast-counter") || 
                             p.classList.contains("rj-bcast-title") ||
                             p.classList.contains("lec-lap-display"))) {
          // Garder la précision pour ces éléments (chrono live)
          // Note : on a déjà la chrono detection mais on est conservateur
          return;
        }
        p = p.parentNode;
      }
      // Skip si parent a un attribut data-rj-noround
      if (parent.hasAttribute && parent.hasAttribute("data-rj-noround")) return;
      // Skip pour les classes spécifiques de chrono
      if (parent.classList) {
        var skipClasses = ["lap-time", "chrono", "gap-time", "sector-time", 
                          "delta-time", "best-lap", "rj-bcast-counter", "quali-live-sec-time"];
        for (var i = 0; i < skipClasses.length; i++) {
          if (parent.classList.contains(skipClasses[i])) return;
        }
      }
      var newText = processText(node.nodeValue);
      if (newText !== node.nodeValue) {
        node.nodeValue = newText;
      }
      return;
    }
    if (node.nodeType !== 1) return; // pas un élément
    // Skip tag
    if (SKIP_TAGS[node.tagName]) return;
    // Skip si data-rj-noround ailleurs
    if (node.hasAttribute && node.hasAttribute("data-rj-noround")) return;
    // Walk children
    var children = node.childNodes;
    for (var j = 0; j < children.length; j++) {
      walkAndProcess(children[j]);
    }
  }

  // Debounced run
  var roundTimer = null;
  var pendingNodes = [];

  function scheduleRound(node) {
    if (!node) return;
    pendingNodes.push(node);
    if (roundTimer) return;
    roundTimer = setTimeout(function() {
      roundTimer = null;
      var nodes = pendingNodes.slice();
      pendingNodes.length = 0;
      try {
        for (var i = 0; i < nodes.length; i++) {
          walkAndProcess(nodes[i]);
        }
      } catch (e) {
        console.warn("[04q] rounding walk:", e);
      }
    }, 150);
  }

  function startRoundingObserver() {
    if (window._rj04qRoundObserver) return;
    if (typeof MutationObserver === "undefined") return;

    var obs = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "childList") {
          for (var j = 0; j < m.addedNodes.length; j++) {
            scheduleRound(m.addedNodes[j]);
          }
        } else if (m.type === "characterData") {
          scheduleRound(m.target);
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    window._rj04qRoundObserver = obs;

    // Initial pass
    setTimeout(function() {
      try { walkAndProcess(document.body); } catch (e) {
        console.warn("[04q] initial round walk:", e);
      }
    }, 300);

    console.log("[04q] Rounding observer started");
  }

  // Wait DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(startRoundingObserver, 200);
    });
  } else {
    setTimeout(startRoundingObserver, 200);
  }

  // Expose for debug
  window._rj04qProcessText = processText;

})();

/* =============================================================================
 * 04q — PART 3 : SANDBOX CONSTRAINT — pas d'Indépendant hors Karting Junior
 * =============================================================================
 *
 * CONTEXTE :
 * Dans le mode bac à sable (Paddock Pass), le menu déroulant d'écuries
 * propose toujours "Indépendant" en première option, peu importe la
 * catégorie sélectionnée. Or, jouer indépendant n'a de sens qu'en Karting
 * Junior — au-delà, c'est irréaliste : aucun pilote ne court en F4/FR/F3/F2/
 * F1/SF/WEC/IndyCar sans écurie.
 *
 * STRATÉGIE :
 * Wrap _sbUpdateTeams() pour retirer l'option "Indépendant" si la catégorie
 * sélectionnée est différente de "Karting Junior". On surveille aussi les
 * changements via un MutationObserver léger sur le select sb-team.
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  function applySandboxIndepConstraint() {
    try {
      var catSel = document.getElementById("sb-cat");
      var teamSel = document.getElementById("sb-team");
      if (!catSel || !teamSel) return;
      var cat = catSel.value || "";
      // Indépendant autorisé uniquement en Karting Junior
      if (cat === "Karting Junior") {
        // S'assurer qu'on a une option Indépendant
        var hasIndep = false;
        for (var i = 0; i < teamSel.options.length; i++) {
          if (teamSel.options[i].value === "") {
            hasIndep = true; break;
          }
        }
        if (!hasIndep) {
          var opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "Indépendant";
          teamSel.insertBefore(opt, teamSel.firstChild);
        }
        return;
      }
      // Pour toute autre catégorie : retire les options Indépendant
      var removed = 0;
      var toRemove = [];
      for (var j = 0; j < teamSel.options.length; j++) {
        if (teamSel.options[j].value === "") {
          toRemove.push(teamSel.options[j]);
        }
      }
      toRemove.forEach(function(o) {
        if (o.parentNode) o.parentNode.removeChild(o);
        removed++;
      });
      // Si on vient de retirer l'option sélectionnée, on bascule sur la première option
      // valide (la première équipe disponible)
      if (removed > 0 && teamSel.options.length > 0 && teamSel.value === "") {
        teamSel.value = teamSel.options[0].value;
      }
    } catch (e) {
      console.warn("[04q] sandbox indep constraint error:", e);
    }
  }

  function wrapSbUpdateTeams() {
    if (typeof window._sbUpdateTeams !== "function") return false;
    if (window._sbUpdateTeams._rjSandboxConstrained) return true;

    var orig = window._sbUpdateTeams;
    window._sbUpdateTeams = function rjSbUpdateTeamsConstrained() {
      var r;
      try { r = orig.apply(this, arguments); }
      catch (e) { console.warn("[04q] _sbUpdateTeams orig:", e); }
      // Après que l'orig a peuplé le select, applique la contrainte
      applySandboxIndepConstraint();
      return r;
    };
    window._sbUpdateTeams._rjSandboxConstrained = true;
    console.log("[04q] _sbUpdateTeams wrapped (no Indépendant hors Karting Junior)");
    return true;
  }

  // Watchdog : applique aussi la contrainte si l'écran sandbox est ouvert
  // sans que _sbUpdateTeams soit ré-appelé (au load par exemple)
  function startSandboxWatchdog() {
    setInterval(function() {
      try {
        // Si le bloc sandbox est visible, applique
        var sb = document.getElementById("sandbox-block");
        if (sb && sb.style.display === "block") {
          applySandboxIndepConstraint();
        }
      } catch (e) {}
    }, 1500);
  }

  function applySandboxConstraint() {
    var ok = wrapSbUpdateTeams();
    if (ok) startSandboxWatchdog();
    return ok;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      applySandboxConstraint();
      setTimeout(applySandboxConstraint, 500);
      setTimeout(applySandboxConstraint, 1500);
    });
  } else {
    applySandboxConstraint();
    setTimeout(applySandboxConstraint, 500);
    setTimeout(applySandboxConstraint, 1500);
  }

  // Expose pour debug
  window.rjSandboxApplyConstraint = applySandboxIndepConstraint;

  console.log("[04q] Sandbox constraint module loaded (Indépendant restricted to Karting Junior)");

})();


/* =============================================================================
 * [04q] COLONNE PNEUS dans les classements (qualif + course)
 * -----------------------------------------------------------------------------
 * Ajoute un badge couleur S/M/H/I/W (via TYRE_COMPOUND_INFO) à chaque pilote.
 * Le moteur ne suit PAS le composé des rivaux → composé simulé de façon
 * DÉTERMINISTE (graine = saison + manche + catégorie + pilote), donc stable au
 * re-render. Course = composé de fin de relais ; pour les catégories à règle des
 * 2 composés (F1, course principale F2, lues via getWeekendFormat().pit.compounds)
 * le composé de fin provient d'un plan LÉGAL (≥2 composés secs) ; sous la pluie
 * la règle saute → I/W. Le joueur utilise G._raceStrategy.startCompound si dispo
 * (course mono-gomme). NB : le classement des ESSAIS dépend du module 13 (absent)
 * → aucune table à enrichir là pour l'instant.
 * Réversible : supprimer ce bloc. Idempotent : wraps gardés par _rjPn.
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[04q-tyres]';

  function TI() { return (window.TYRE_COMPOUND_INFO && typeof window.TYRE_COMPOUND_INFO === 'object') ? window.TYRE_COMPOUND_INFO : null; }
  function G() { return window.G; }

  function _hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function _rng(parts) { var seed = _hash(parts.join('|')); return function () { seed = (seed + 0x6D2B79F5) >>> 0; var t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function _pick(rng, arr) { var tot = 0, i; for (i = 0; i < arr.length; i++) tot += arr[i].w; var r = rng() * tot; for (i = 0; i < arr.length; i++) { if ((r -= arr[i].w) <= 0) return arr[i].c; } return arr[arr.length - 1].c; }

  function _ctx() { var g = G() || {}; return { s: g.saison || 1, m: (g.races && g.races.length ? g.races.length : 0) + 1, cat: g.cat || '' }; }
  function _isWet() { var w = window.RACE_STATE && window.RACE_STATE.weather; var id = w && w.id; return id === 'wet' || id === 'storm' || id === 'rain'; }
  function _twoCompounds(cat) {
    try { var f = (typeof window.getWeekendFormat === 'function') ? window.getWeekendFormat(cat) : null; return !!(f && f.pit && f.pit.compounds && f.pit.compounds >= 2); } catch (e) { return false; }
  }

  function _qualiCompound(name) {
    var c = _ctx();
    var seg = (window.QUALI_STATE && QUALI_STATE.session) || 1; // 1=Q1, 2=Q2, 3=Q3
    var rng = _rng(['Q', seg, c.s, c.m, c.cat, name]);
    if (_isWet()) return rng() < 0.6 ? 'inter' : 'wet';
    // Qualif sèche : presque tout le monde en tendre. Un peu de medium en début de Q1
    // (runs d'ouverture sur gomme plus dure), occasionnellement en Q2, jamais en Q3.
    var softProb = seg >= 3 ? 1.0 : seg === 2 ? 0.86 : 0.80;
    return rng() < softProb ? 'soft' : 'medium';
  }

  function _raceCompound(name, isPlayer) {
    var c = _ctx(), rng = _rng(['R', c.s, c.m, c.cat, name]);
    if (_isWet()) return rng() < 0.62 ? 'inter' : 'wet';
    var two = _twoCompounds(c.cat);
    // composé réel du joueur si course mono-gomme (pas d'arrêt imposé)
    if (isPlayer && !two) {
      var g = G();
      if (g && g._raceStrategy && g._raceStrategy.startCompound && TI() && TI()[g._raceStrategy.startCompound]) return g._raceStrategy.startCompound;
    }
    if (two) return _pick(rng, [{ c: 'medium', w: 5 }, { c: 'hard', w: 4 }, { c: 'soft', w: 2 }]); // finit sur le plus dur après ≥2 composés
    return _pick(rng, [{ c: 'medium', w: 5 }, { c: 'soft', w: 4 }, { c: 'hard', w: 1 }]);
  }

  function _badge(compound, w) {
    var info = TI(); if (!info) return '';
    var t = info[compound]; if (!t) return '';
    w = w || 20;
    return '<span title="' + (t.label || '') + '" style="display:inline-flex;align-items:center;justify-content:center;width:' + w + 'px;height:' + w + 'px;border-radius:50%;background:' + (t.bg || 'transparent') + ';border:1.5px solid ' + t.color + ';color:' + t.color + ';font-size:11px;font-weight:800;font-family:var(--font-display,sans-serif);line-height:1;flex-shrink:0">' + t.short + '</span>';
  }

  // Variante sans rond : juste la lettre, à la couleur du composé (classement de course).
  function _letter(compound) {
    var info = TI(); if (!info) return '';
    var t = info[compound]; if (!t) return '';
    return '<span title="' + (t.label || '') + '" style="font-weight:900;font-size:13px;color:' + t.color + ';font-family:var(--font-display,sans-serif);line-height:1;flex-shrink:0">' + t.short + '</span>';
  }

  // Convertit les pastilles pneus (ronds 14px) du classement live, rendues par le
  // cœur (renderLiveLeaderboard), en simples lettres colorées. Idempotent.
  function _decircleLeaderboardTyres() {
    var root = document.getElementById('live-leaderboard');
    if (!root) return;
    var spans = root.querySelectorAll('span'), L = ['S', 'M', 'H', 'I', 'W'];
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i], st = s.getAttribute('style') || '';
      if (st.indexOf('border-radius:50%') < 0 || st.indexOf('14px') < 0) continue;
      var txt = (s.textContent || '').trim();
      if (L.indexOf(txt) < 0) continue;
      var mm = st.match(/background:\s*([^;]+)/);
      var col = (mm && mm[1] ? mm[1] : '#fff').trim();
      s.setAttribute('style', 'font-weight:900;font-size:12px;line-height:1;flex-shrink:0;color:' + col);
    }
  }

  // --- QUALIF : colonne dans #quali-timing-board ---
  function _injectQuali() {
    var board = document.getElementById('quali-timing-board');
    if (!board || board.children.length < 2) return;
    if (board.querySelector('[data-rj-pn]')) return; // déjà fait pour ce render
    var rows = board.children;
    for (var i = 0; i < rows.length; i++) {
      var spans = rows[i].children;
      if (spans.length < 2) continue;
      if (i === 0) {
        var th = document.createElement('span');
        th.textContent = 'Pn'; th.setAttribute('data-rj-pn', '1');
        th.style.cssText = 'width:30px;text-align:center';
        rows[i].insertBefore(th, spans[spans.length - 1]); // avant Écart
        continue;
      }
      var nm = (spans[1].textContent || '').trim();
      if (!nm) continue;
      var cell = document.createElement('span');
      cell.style.cssText = 'width:30px;display:inline-flex;align-items:center;justify-content:center';
      cell.innerHTML = _badge(_qualiCompound(nm), 20);
      rows[i].insertBefore(cell, spans[spans.length - 1]);
    }
  }

  // --- COURSE : colonne dans le « Classement final » de #res-content ---
  function _injectRace() {
    var root = document.getElementById('res-content'); if (!root) return;
    var nodes = root.querySelectorAll('div,span'), header = null;
    for (var i = 0; i < nodes.length; i++) { if ((nodes[i].textContent || '').trim() === 'Classement final') { header = nodes[i]; break; } }
    if (!header || !header.parentNode) return;
    var box = header.parentNode;
    if (box.getAttribute('data-rj-pn')) return;
    box.setAttribute('data-rj-pn', '1');
    var kids = box.children;
    for (var k = 0; k < kids.length; k++) {
      var row = kids[k];
      if (row === header) continue;
      var spans = row.children;
      if (spans.length < 3) continue;
      var nameSpan = spans[1];
      var nm = nameSpan ? (nameSpan.textContent || '').replace('▶', '').replace('DNF', '').trim() : '';
      if (!nm) continue;
      var isPlayer = (row.style.cssText.indexOf('232,16,48') >= 0) || (nameSpan && nameSpan.innerHTML.indexOf('▶') >= 0);
      var cell = document.createElement('span');
      cell.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:24px;flex-shrink:0';
      cell.innerHTML = _letter(_raceCompound(nm, isPlayer));
      row.insertBefore(cell, spans[spans.length - 1]); // avant la colonne points
    }
  }

  function wrapRenders() {
    var have = false;
    // QUALIF : renderTimingBoard n'est wrappé par personne d'autre → wrap précis
    if (typeof window.renderTimingBoard === 'function') {
      have = true;
      if (!window.renderTimingBoard._rjPn) {
        var o1 = window.renderTimingBoard;
        window.renderTimingBoard = function () { var r = o1.apply(this, arguments); try { _injectQuali(); } catch (e) {} return r; };
        window.renderTimingBoard._rjPn = true;
      }
    }
    return have;
  }

  // COURSE : showResult/buildResultScreen sont ré-wrappés par d'autres modules
  // (ex. module 20) → un wrap précoce serait contourné. On observe donc le DOM :
  // dès que le « Classement final » apparaît dans #res-content, on injecte.
  // Le drapeau data-rj-pn rend l'opération idempotente (pas de double colonne).
  var _pending = false;
  function _scan() { _pending = false; try { _injectRace(); } catch (e) {} try { _injectQuali(); } catch (e) {} try { _decircleLeaderboardTyres(); } catch (e) {} }
  function _schedule() { if (_pending) return; _pending = true; setTimeout(_scan, 40); }
  function startObserver() {
    if (window._rjTyreObs) return true;
    if (typeof MutationObserver === 'undefined' || !document.body) return false;
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { _schedule(); return; } }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window._rjTyreObs = obs;
    return true;
  }

  window.rjDebugTyreCol = function () {
    var c = _ctx();
    console.log(TAG, 'cat', c.cat, '| 2 composés:', _twoCompounds(c.cat), '| pluie:', _isWet());
  };
  window.rjInjectTyreCols = function () { try { _injectQuali(); } catch (e) {} try { _injectRace(); } catch (e) {} };

  function boot(n) {
    var q = wrapRenders();
    startObserver();
    if (q) { console.log(TAG, 'colonne pneus activée (qualif via wrap + course via observer). Debug: rjDebugTyreCol()'); return; }
    if (n > 0) setTimeout(function () { boot(n - 1); }, 300);
    else { startObserver(); console.warn(TAG, 'renderTimingBoard introuvable — qualif non couverte, course via observer uniquement.'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(40); });
  else boot(40);
})();
