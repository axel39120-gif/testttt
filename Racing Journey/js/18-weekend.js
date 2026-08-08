/* =====================================================================
 * 18-weekend.js — LE WEEK-END DE COURSE
 *
 * Regroupe les sept modules qui construisent un week-end : essais libres,
 * format de l'épreuve, manches multiples, calendrier, qualifications,
 * découpage en secteurs, et compacité des écrans.
 *
 * L'ordre de chargement d'origine est scrupuleusement conservé : plusieurs
 * de ces modules ajustent les mêmes fonctions — le nombre de séances
 * d'essais, la bascule d'onglet, le rendu d'une session de qualification —
 * et le comportement dépend de qui passe en dernier.
 *
 * Chaque partie garde sa désinstallation d'origine.
 * =================================================================== */

/* ==================================================================== *
 * Essais libres — séances, réglages, briefing ingénieur
 * (anciennement 30-essais-consolidated.js)
 * ==================================================================== */

(function rjEssaisLibresFlow() {
  if (typeof window === "undefined") return;
  if (window._rjEssaisLibresInstalled) return;

  // --------------------------------------------------------------------------
  // Bootstrap : on attend que 03 ait posé ses fonctions, puis on installe.
  // --------------------------------------------------------------------------
  function ready() {
    return typeof window.runPracticeTest === "function"
      && typeof window.renderPracticeSection === "function"
      && typeof window.getPracticeMaxTests === "function";
  }

  function boot() {
    if (!ready()) return false;
    if (window._rjEssaisLibresInstalled) return true;
    window._rjEssaisLibresInstalled = true;
    install();
    console.log("[12] Essais libres — flux qualif activé (timer + tour de chauffe + modal ingénieur + réglages intégrés)");
    return true;
  }

  if (!boot()) {
    var _tries = 0;
    var _iv = setInterval(function () {
      if (boot() || ++_tries > 80) clearInterval(_iv);
    }, 80);
  }

  // ==========================================================================
  // INSTALLATION
  // ==========================================================================
  function install() {
    try{window.buildSetupPanel=buildSetupPanel;window.refreshSetupValues=refreshSetupValues;}catch(e){}

    // Fallback : la section pratique native (03) référence _formatLapTime SANS
    // garde (6 appels), mais cette fonction n'est pas définie globalement
    // (06 expose _formatLapTime2). Sans elle, le rendu natif plante dès qu'un
    // meilleur tour existe → on la définit ici (idempotent).
    try {
      if (typeof window._formatLapTime !== "function") {
        window._formatLapTime = function (seconds) {
          if (!seconds || seconds <= 0) return "—";
          var m = Math.floor(seconds / 60), s = seconds - m * 60;
          return m > 0 ? (m + ":" + (s < 10 ? "0" : "") + s.toFixed(3)) : s.toFixed(3);
        };
      }
    } catch (e) {}

    var PARAM_LABELS = {
      aileron_av: "Aileron avant",
      aileron_ar: "Aileron arrière",
      antiroulis_av: "Antiroulis avant",
      antiroulis_ar: "Antiroulis arrière",
      carrossage: "Carrossage",
      suspension: "Suspension",
      pression_pneus: "Pression pneus",
      differentiel: "Différentiel",
      repartition_frein: "Répartition freinage"
    };

    // ------------------------------------------------------------------------
    // Helpers sûrs (fallback si une dépendance manque)
    // ------------------------------------------------------------------------
    function esc(s) {
      return (typeof _ppEscSafe === "function") ? _ppEscSafe(s) : String(s == null ? "" : s);
    }
    function fmtLap(t) {
      if (typeof _formatLapTime === "function") return _formatLapTime(t);
      var m = Math.floor(t / 60), s = (t - 60 * m);
      return (m > 0 ? m + ":" + (s < 10 ? "0" : "") : "") + s.toFixed(3);
    }

    // ========================================================================
    // 1. HELPERS MANQUANTS — briefing & quote ingénieur
    // ========================================================================

    window._buildEngineerBriefing = function (session, circuit, weather) {
      var ctype = (typeof RACE_STATE !== "undefined" && RACE_STATE.circuitData && RACE_STATE.circuitData.type) || "";
      var wid = (weather && weather.id) || "dry";
      var intro = [
        "On attaque les essais. Cale-moi la voiture, on a quelques tours pour trouver le bon équilibre.",
        "C'est parti pour la séance. Ajuste les réglages, envoie un tour, et je te dis ce que ça donne.",
        "Première séance : prends ton temps sur le setup. Le chrono tourne, mais on a de la marge."
      ];
      var msg = intro[Math.floor(Math.random() * intro.length)];
      if (ctype === "street") msg += " Ici c'est étroit, vise la stabilité plutôt que la vitesse pure.";
      else if (ctype === "highspeed") msg += " Tracé rapide : allège les appuis pour la vitesse de pointe.";
      else if (ctype === "technical") msg += " Beaucoup de virages : il faut de l'agilité et un bon train avant.";
      if (wid === "wet" || wid === "storm") msg += " Et avec cette pluie, charge les appuis et adoucis la voiture.";
      else if (wid === "hot") msg += " Il fait chaud : attention à la dégradation, soigne le carrossage.";
      return msg;
    };

    window._buildEngineerQuote = function (testResult) {
      var fb = (testResult && testResult.feedback) || {};
      var keys = Object.keys(fb);
      var nPerfect = 0, nClose = 0, nHigh = 0, nLow = 0;
      keys.forEach(function (k) {
        var d = fb[k].direction;
        if (d === "perfect") nPerfect++;
        else if (d === "close") nClose++;
        else if (d === "too_high") nHigh++;
        else if (d === "too_low") nLow++;
      });
      var total = keys.length, verdict;
      if (total === 0) verdict = "mixed";
      else if (nPerfect >= 0.75 * total) verdict = "excellent";
      else if ((nPerfect + nClose) >= 0.6 * total) verdict = "good";
      else verdict = "adjust";

      var pools = {
        excellent: [
          "Voilà, la voiture est dans la fenêtre. On garde cette base pour la qualif.",
          "Rien à redire, le setup est au point. Tu peux pousser en confiance.",
          "Parfait, tout est calé. On est prêts."
        ],
        good: [
          "On progresse bien. Encore deux-trois retouches et c'est nickel.",
          "Bonne direction. Affine ce que je t'indique et on y est.",
          "Ça vient : le gros est fait, il reste les détails."
        ],
        adjust: [
          "Il y a du boulot. Regarde mes retours, on corrige et on relance.",
          "La voiture n'est pas encore là. Suis mes indications et refais un tour.",
          "Pas mal d'écart sur les réglages. On ajuste avant de chercher le chrono."
        ],
        mixed: [
          "Difficile à lire, ce tour. Refais-m'en un propre pour que je confirme.",
          "Pas assez de données claires. Relance, j'ai besoin d'un repère."
        ]
      };
      var arr = pools[verdict] || pools.mixed;
      var msg = arr[Math.floor(Math.random() * arr.length)];
      if (verdict === "adjust" || verdict === "good") {
        if (nHigh > nLow && nHigh > 0) msg += " Globalement tu mets un peu trop, allège.";
        else if (nLow > nHigh && nLow > 0) msg += " Tu es un peu juste sur plusieurs réglages, ajoute par petites touches.";
      }
      return msg;
    };

    // ========================================================================
    // 2. doPracticeTest — version correcte + TOUR DE CHAUFFE
    // ========================================================================
    //
    // Flux : pause timer → run → animation [tour de chauffe → tour chrono →
    // terminé] → modal ingénieur → reprise timer + re-render.
    // ------------------------------------------------------------------------

    // Rythme des essais libres accéléré d'environ 22 %. Les valeurs
    // d'origine étaient 2400 / 4600 / 2800 / 5000. La colorisation des
    // secteurs est calculée en fraction de FLYLAP_MS
    // (FLYLAP_MS * (idx+1) / 3 * 0.92) : elle suit donc proportionnellement
    // et reste dans la fenêtre du tour chronométré, sans recalibrage.
    var WARMUP_MS = 1900;   // durée visuelle du tour de chauffe
    var CHRONO_MS = 3600;   // durée visuelle du tour chrono

    window.doPracticeTest = function () {
      var pr = (typeof RACE_STATE !== "undefined") ? RACE_STATE.practice : null;
      if (!pr) return;
      if (pr.testsThisSession >= getPracticeMaxTests()) {
        if (typeof showToast === "function") showToast("Session complète, passe à la suivante.");
        return;
      }

      if (typeof _fpPauseTimer === "function") _fpPauseTimer();

      var btn = document.getElementById("fp-launch-btn");
      if (btn) { btn.disabled = true; btn.style.opacity = "0.5"; btn.style.pointerEvents = "none"; }

      var result = runPracticeTest();
      if (!result || result.error) {
        if (typeof showToast === "function") showToast("Impossible de lancer un tour maintenant.");
        if (typeof _fpResumeTimer === "function") _fpResumeTimer();
        if (btn) { btn.disabled = false; btn.style.opacity = ""; btn.style.pointerEvents = ""; }
        return;
      }

      var lastTest = pr.tests[pr.tests.length - 1];
      var lapTime = lastTest.lapTime || 80;
      var feedback = lastTest.feedback || {};
      var s1t = +(0.32 * lapTime).toFixed(3);
      var s2t = +(0.36 * lapTime).toFixed(3);
      var s3t = +(lapTime - s1t - s2t).toFixed(3);

      // Couleurs de secteurs pondérées par la qualité du feedback
      var fKeys = Object.keys(feedback);
      var nPerfect = fKeys.filter(function (k) { return feedback[k].direction === "perfect"; }).length;
      var nClose = fKeys.filter(function (k) { return feedback[k].direction === "close"; }).length;
      var hTot = fKeys.length;
      function pickSecCol() {
        if (hTot === 0) return { col: "#F59E0B", label: "OK" };
        var r = Math.random() * hTot;
        return r < nPerfect ? { col: "#A78BFA", label: "VIOLET" }
          : r < nPerfect + nClose ? { col: "#22D3EE", label: "VERT" }
            : { col: "#F59E0B", label: "JAUNE" };
      }
      var sv = pickSecCol(), sx = pickSecCol(), sy = pickSecCol();
      var secData = [
        { n: 1, t: s1t, info: sv },
        { n: 2, t: s2t, info: sx },
        { n: 3, t: s3t, info: sy }
      ];

      var circuit = (RACE_STATE.circuitData && RACE_STATE.circuitData.name) || RACE_STATE.circuit || "Circuit";
      var weather = RACE_STATE.weather || { label: "Sec", id: "dry" };
      var prevBest = (typeof _getBestPracticeLap === "function") ? _getBestPracticeLap(pr.tests.slice(0, -1)) : null;
      var prevBestTime = prevBest ? (typeof prevBest === "number" ? prevBest : prevBest.lapTime) : null;
      var delta = (prevBestTime != null) ? lapTime - prevBestTime : null;
      var isPB = delta !== null && delta < 0;

      var container = document.getElementById("race-practice-section");
      if (!container) { if (typeof _fpResumeTimer === "function") _fpResumeTimer(); return; }

      // ---- Markup de l'animation ----
      var b = '';
      b += '<div style="background:linear-gradient(135deg,#0a1418 0%,#0d1a20 100%);border:1px solid #1a3540;border-left:3px solid #22D3EE;margin-bottom:10px;overflow:hidden">';
      b += '<div style="padding:10px 14px;background:rgba(34,211,238,.08);border-bottom:1px solid rgba(34,211,238,.18);display:flex;justify-content:space-between;align-items:center">';
      b += '<div style="display:flex;align-items:center;gap:8px"><div id="fp-live-dot" style="width:8px;height:8px;background:#F59E0B;border-radius:50%;box-shadow:0 0 8px #F59E0B;animation:practice-pulse 0.8s ease-in-out infinite"></div>';
      b += '<span id="fp-live-tag" style="font-family:var(--font-display);font-size:11px;font-weight:900;color:#F59E0B;letter-spacing:.22em;text-transform:uppercase">Tour de chauffe</span></div>';
      b += '<span style="font-family:var(--font-display);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">' + esc(circuit) + ' · ' + esc(weather.label) + '</span>';
      b += '</div>';
      b += '<div style="padding:18px 14px 8px;text-align:center">';
      b += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.28em;text-transform:uppercase;margin-bottom:6px">Tour chrono</div>';
      b += '<div id="practice-chrono" style="font-family:var(--font-display);font-size:34px;font-weight:900;color:var(--dim);line-height:1;letter-spacing:.02em">0:00.000</div>';
      b += '<div style="margin:12px 14px 0;height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;position:relative"><div id="practice-progress-bar" style="position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,#22D3EE 0%,#ef4444 100%);transition:width .1s linear"></div></div>';
      b += '<div id="practice-current-sector" style="margin-top:10px;font-family:var(--font-display);font-size:11px;font-weight:800;color:#F59E0B;letter-spacing:.2em;text-transform:uppercase;min-height:14px">Sortie des stands…</div>';
      b += '</div>';
      b += '<div style="padding:6px 12px 12px;display:flex;gap:7px">';
      var secLabels = ["S1", "S2", "S3"];
      for (var i = 0; i < 3; i++) {
        b += '<div class="practice-sector" data-sec="' + secData[i].n + '" style="flex:1;padding:10px 6px 9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:6px;text-align:center;opacity:0.25;transition:all .35s ease;position:relative;overflow:hidden">';
        b += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.22em;text-transform:uppercase;margin-bottom:4px">' + secLabels[i] + '</div>';
        b += '<div class="practice-sector-time" style="font-family:var(--font-display);font-size:15px;font-weight:900;color:var(--dim);line-height:1;letter-spacing:.01em">—.———</div>';
        b += '</div>';
      }
      b += '</div></div>';
      container.innerHTML = b;

      var chronoEl = document.getElementById("practice-chrono");
      var progEl = document.getElementById("practice-progress-bar");
      var curSecEl = document.getElementById("practice-current-sector");
      var dotEl = document.getElementById("fp-live-dot");
      var tagEl = document.getElementById("fp-live-tag");

      var t0 = Date.now();
      var chronoStarted = false;
      var iv = setInterval(function () {
        var el = Date.now() - t0;
        if (el < WARMUP_MS) {
          // Phase tour de chauffe
          if (curSecEl) {
            curSecEl.textContent = "Tour de chauffe…";
            curSecEl.style.color = "#F59E0B";
          }
          return;
        }
        // Bascule visuelle vers le tour chrono
        if (!chronoStarted) {
          chronoStarted = true;
          if (dotEl) { dotEl.style.background = "#ef4444"; dotEl.style.boxShadow = "0 0 8px #ef4444"; dotEl.style.animation = "practice-pulse 0.6s ease-in-out infinite"; }
          if (tagEl) { tagEl.textContent = "En piste"; tagEl.style.color = "#ef4444"; }
          if (chronoEl) chronoEl.style.color = "var(--white)";
        }
        var r = Math.min(1, (el - WARMUP_MS) / CHRONO_MS);
        if (chronoEl) chronoEl.textContent = fmtLap(lapTime * r);
        if (progEl) progEl.style.width = (100 * r).toFixed(1) + "%";
        if (curSecEl) {
          curSecEl.textContent = r < 0.34 ? "S1 — en cours" : r < 0.7 ? "S2 — en cours" : r < 1 ? "S3 — en cours" : "Tour terminé";
          curSecEl.style.color = r < 1 ? "#22D3EE" : "var(--muted)";
        }
      }, 33);

      // Révélation progressive des secteurs (pendant la phase chrono)
      secData.forEach(function (sd, idx) {
        setTimeout(function () {
          var row = container.querySelector('.practice-sector[data-sec="' + sd.n + '"]');
          if (!row) return;
          row.style.opacity = "1";
          row.style.background = sd.info.col + "22";
          row.style.borderColor = sd.info.col;
          row.style.boxShadow = "0 0 14px " + sd.info.col + "40, inset 0 0 0 1px " + sd.info.col + "55";
          var tn = row.querySelector(".practice-sector-time");
          if (tn) { tn.textContent = sd.t.toFixed(3); tn.style.color = sd.info.col; }
        }, WARMUP_MS + 50 + 400 * idx);
      });

      // Fin de tour → modal ingénieur
      setTimeout(function () {
        clearInterval(iv);
        if (chronoEl) chronoEl.textContent = fmtLap(lapTime);
        if (progEl) progEl.style.width = "100%";
        if (curSecEl) { curSecEl.textContent = "Tour terminé"; curSecEl.style.color = "var(--muted)"; }
        setTimeout(function () {
          var done = function () {
            if (typeof _fpResumeTimer === "function") _fpResumeTimer();
            if (typeof renderPracticeSection === "function") renderPracticeSection();
            if (typeof renderAdvancedSetupUI === "function") renderAdvancedSetupUI();
          };
          if (typeof _fpShowEngineerModal === "function") {
            _fpShowEngineerModal(lastTest, delta, isPB, sv, sx, sy, done);
          } else {
            done();
          }
        }, 450);
      }, WARMUP_MS + CHRONO_MS);
    };

    // ========================================================================
    // 3. doEndPracticeSession — version correcte (reset timer entre sessions)
    // ========================================================================

    window.doEndPracticeSession = function () {
      if (typeof endPracticeSession === "function") endPracticeSession();
      // Réarmer le timer pour la nouvelle session
      if (typeof RACE_STATE !== "undefined" && RACE_STATE.practice) {
        RACE_STATE.practice._timerSessionIdx = undefined;
      }
      if (typeof _fpStopTimer === "function") _fpStopTimer();
      if (typeof renderPracticeSection === "function") renderPracticeSection();
      if (typeof renderAdvancedSetupUI === "function") renderAdvancedSetupUI();
    };

    // ========================================================================
    // 4. CURSEURS DE RÉGLAGES INTÉGRÉS À LA SÉANCE
    // ========================================================================
    //
    // On enrobe renderPracticeSection : après le rendu d'origine, on injecte
    // un panneau de réglages (curseurs) juste avant le bouton « Envoyer en
    // piste ». Les curseurs écrivent dans G.setupAdv via setAdvParam (mêmes
    // couplages que l'onglet Préparation), et le prochain tour les utilise.
    // ------------------------------------------------------------------------

    var _setupPanelOpen = true; // ouvert par défaut pour inviter au réglage

    function refreshSetupValues(panel) {
      var params = (typeof getAvailableSetupParams === "function") ? getAvailableSetupParams(G.cat) : [];
      params.forEach(function (k) {
        var v = (G.setupAdv && typeof G.setupAdv[k] === "number") ? G.setupAdv[k] : 5;
        var slider = panel.querySelector('input[data-param="' + k + '"]');
        var chip = panel.querySelector('[data-valfor="' + k + '"]');
        if (slider && slider !== document.activeElement) slider.value = v;
        if (chip) chip.textContent = v;
      });
    }

    function buildSetupPanel() {
      var params = (typeof getAvailableSetupParams === "function") ? getAvailableSetupParams(G.cat) : [];
      if (!params.length) return null;

      var panel = document.createElement("div");
      panel.id = "fp-setup-panel";
      panel.style.cssText = "margin-bottom:10px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid #22D3EE;border-radius:6px;overflow:hidden";

      // En-tête repliable
      var head = document.createElement("div");
      head.id = "fp-setup-head";
      head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none";
      head.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        '<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#22D3EE;letter-spacing:.16em;text-transform:uppercase">Réglages voiture</span>' +
        '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.08em">' + params.length + ' param' + (params.length > 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<svg id="fp-setup-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .2s ease;transform:rotate(' + (_setupPanelOpen ? '180' : '0') + 'deg)"><polyline points="6 9 12 15 18 9"/></svg>';
      panel.appendChild(head);

      // Corps : on réutilise EXACTEMENT le rendu de réglages de l'onglet
      // « Préparation » (_renderAdvancedSetupUIInner) → barres zone optimale,
      // badges qualité, score, mêmes contrôles (handlers inline globaux).
      var body = document.createElement("div");
      body.id = "fp-setup-body";
      body.style.cssText = "padding:" + (_setupPanelOpen ? "4px 12px 12px" : "0 12px") + ";max-height:" + (_setupPanelOpen ? "1800px" : "0") + ";overflow:hidden;transition:max-height .3s ease,padding .3s ease";

      var usedPrepUI = false;
      if (typeof _renderAdvancedSetupUIInner === "function") {
        try { _renderAdvancedSetupUIInner(body); usedPrepUI = true; }
        catch (e) { usedPrepUI = false; }
      }
      if (!usedPrepUI) {
        // Repli : curseurs simples (si l'UI Préparation est indisponible)
        params.forEach(function (k) {
          var v = (G.setupAdv && typeof G.setupAdv[k] === "number") ? G.setupAdv[k] : 5;
          var label = (typeof PARAM_LABELS !== "undefined" && PARAM_LABELS[k]) || k;
          var row = document.createElement("div");
          row.style.cssText = "padding:7px 0;border-bottom:1px solid var(--border)";
          row.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">' +
            '<span style="font-size:12px;color:var(--text2);font-weight:600">' + label + '</span>' +
            '<span data-valfor="' + k + '" style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#22D3EE;min-width:18px;text-align:right">' + v + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="font-size:9px;color:var(--dim);font-family:var(--font-display)">0</span>' +
            '<input type="range" min="0" max="10" step="1" value="' + v + '" data-param="' + k + '" class="size-slider" style="flex:1;width:100%;cursor:pointer">' +
            '<span style="font-size:9px;color:var(--dim);font-family:var(--font-display)">10</span>' +
            '</div>';
          body.appendChild(row);
        });
        if (body.lastChild) body.lastChild.style.borderBottom = "none";
      }
      panel.appendChild(body);
      panel._usedPrepUI = usedPrepUI;

      // ---- Interactions ----
      head.addEventListener("click", function () {
        _setupPanelOpen = !_setupPanelOpen;
        var chev = panel.querySelector("#fp-setup-chevron");
        if (chev) chev.style.transform = "rotate(" + (_setupPanelOpen ? "180" : "0") + "deg)";
        body.style.maxHeight = _setupPanelOpen ? "1800px" : "0";
        body.style.padding = _setupPanelOpen ? "4px 12px 12px" : "0 12px";
      });

      if (usedPrepUI) {
        // Contrôles Préparation = handlers inline (setAdvParam / _advBarClick).
        // On rafraîchit le panneau après chaque ajustement validé.
        var _fpRerender = function () {
          setTimeout(function () { try { _renderAdvancedSetupUIInner(body); } catch (e) {} }, 0);
        };
        body.addEventListener("change", _fpRerender);
        body.addEventListener("click", function (ev) {
          if (ev.target && ev.target.tagName === "INPUT") return; // géré par "change"
          _fpRerender();
        });
      } else {
        var sliders = panel.querySelectorAll('input[data-param]');
        sliders.forEach(function (slider) {
          // Mise à jour visuelle live pendant le glissement
          slider.addEventListener("input", function () {
            var k = slider.getAttribute("data-param");
            var val = parseInt(slider.value, 10);
            var chip = panel.querySelector('[data-valfor="' + k + '"]');
            if (chip) chip.textContent = val;
          });
          // Validation → écriture dans G.setupAdv (couplages) + refresh des autres
          slider.addEventListener("change", function () {
            var k = slider.getAttribute("data-param");
            var val = parseInt(slider.value, 10);
            if (typeof setAdvParam === "function") setAdvParam("setup", k, val);
            else { G.setupAdv = G.setupAdv || {}; G.setupAdv[k] = val; }
            refreshSetupValues(panel);
            // garder l'onglet Préparation synchro si visible
            if (typeof renderAdvancedSetupUI === "function") renderAdvancedSetupUI();
          });
        });
      }

      return panel;
    }

    function injectSetupPanel() {
      var launch = document.getElementById("fp-launch-btn");
      if (!launch) return; // pas de tour dispo / séance finie / animation en cours
      // éviter les doublons
      var existing = document.getElementById("fp-setup-panel");
      if (existing) existing.remove();
      var panel = buildSetupPanel();
      if (!panel) return;
      var wrap = launch.parentElement;            // <div style="margin-bottom:6px">
      var container = wrap.parentElement;          // #race-practice-section
      if (container && wrap) container.insertBefore(panel, wrap);
    }

    // ========================================================================
    // 5. CLASSEMENT DES ESSAIS — joueur + rivaux
    // ------------------------------------------------------------------------
    // La section pratique native n'affiche que le meilleur chrono du joueur.
    // On injecte un classement complet : le joueur (son vrai meilleur tour) et
    // les rivaux, dont le temps d'essais est simulé de façon DÉTERMINISTE
    // (graine par week-end) à partir de leur skill + niveau d'écurie, ancré sur
    // le meilleur tour réel du joueur. Mêmes facteurs que la pace de qualif
    // (skill/100 + teamRatingToBonus) pour rester cohérent avec la grille.
    // ========================================================================

    function _fpSeed() {
      var cat = G.cat || "";
      var round = (G.races && G.races.length) || 0;
      var str = (G.saison || 1) + "#" + round + "#" + cat;
      var h = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return h >>> 0;
    }
    function _fpRng(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function _fpTeamBonus(team) {
      try {
        if (typeof teamRatingToBonus === "function" && typeof getEffectiveTeamRating === "function") {
          var rating = (team && team !== "Indépendant") ? getEffectiveTeamRating(team) : 75;
          return teamRatingToBonus(rating);
        }
      } catch (e) {}
      return 0;
    }
    function _fpBaseRef() {
      var cat = G.cat || "";
      var circuit = (typeof RACE_STATE !== "undefined" && RACE_STATE.circuit) ||
        (typeof getNextRace === "function" && getNextRace() && getNextRace().name) || "";
      var c = 0;
      try { if (circuit && typeof getCircuitBaseRef === "function") c = getCircuitBaseRef(circuit, cat); } catch (e) {}
      var def = { "Karting Junior": 104, "Karting Senior": 100, "Formule 4": 176, "Formula Regional": 172, "Formule 3": 196, "Formule 2": 204, "Formule 1": 168, "Super Formula": 184, "Endurance WEC": 210, "IndyCar": 160 };
      return (c && c > 0) ? c : (def[cat] || 90);
    }
    function _fpPlayerScore() {
      var st = G.stats || {};
      var base = (0.6 * (st.vitesse || 50) + 0.25 * (st.sangfroid || 50) + 0.15 * (st.adapt || 50)) / 100;
      return base + _fpTeamBonus(G.currentTeam);
    }
    function _fpRivalScore(r) {
      var sk = (typeof r.skill === "number") ? r.skill : 55;
      return sk / 100 + _fpTeamBonus(r.team);
    }
    function _fpFmtLap(t) {
      if (t == null) return "—";
      var m = Math.floor(t / 60), s = t - m * 60;
      return m > 0 ? (m + ":" + (s < 10 ? "0" : "") + s.toFixed(3)) : s.toFixed(3);
    }

    function _fpComputeRivalsBoard() {
      var rivals = G.rivals || [];
      if (!rivals.length) return null;
      var pr = (typeof RACE_STATE !== "undefined") ? RACE_STATE.practice : null;
      var playerLap = (pr && typeof _getBestPracticeLap === "function") ? _getBestPracticeLap(pr.tests) : null;
      var baseRef = _fpBaseRef();
      var K = baseRef * 0.06;          // sensibilité écart-de-score → secondes
      var noiseAmp = baseRef * 0.004;  // bruit déterministe (~±0.3s en F1)
      var rng = _fpRng(_fpSeed());
      var pScore = _fpPlayerScore();
      var hasLap = (typeof playerLap === "number" && playerLap > 0);
      var anchorLap = hasLap ? playerLap : baseRef;

      var rows = [];
      var pName = ((G.pilot && G.pilot.prenom) ? G.pilot.prenom + " " : "") + ((G.pilot && G.pilot.nom) || "Toi");
      rows.push({ name: pName, team: G.currentTeam || null, isPlayer: true, lap: hasLap ? playerLap : null });

      rivals.forEach(function (r) {
        var sc = _fpRivalScore(r);
        var noise = (rng() - 0.5) * 2 * noiseAmp;
        var lap = anchorLap + (pScore - sc) * K + noise;
        if (lap < baseRef * 0.80) lap = baseRef * 0.80; // garde-fou
        rows.push({ name: r.name || "Rival", team: r.team || null, isPlayer: false, lap: lap });
      });

      rows.sort(function (a, b) {
        if (a.lap == null && b.lap == null) return 0;
        if (a.lap == null) return 1;
        if (b.lap == null) return -1;
        return a.lap - b.lap;
      });
      var leader = null;
      for (var i = 0; i < rows.length; i++) { if (rows[i].lap != null) { leader = rows[i].lap; break; } }
      rows.forEach(function (row, idx) {
        row.pos = idx + 1;
        row.gap = (row.lap != null && leader != null) ? (row.lap - leader) : null;
      });
      return rows;
    }

    function injectRivalsBoard() {
      var container = document.getElementById("race-practice-section");
      if (!container) return;
      var existing = document.getElementById("fp-rivals-board");
      if (existing) existing.remove();
      var rows = _fpComputeRivalsBoard();
      if (!rows || rows.length < 2) return; // pas de rivaux connus

      var box = document.createElement("div");
      box.id = "fp-rivals-board";
      box.style.cssText = "margin-bottom:10px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid #F0A020;border-radius:6px;overflow:hidden";

      var html = "";
      html += '<div style="padding:9px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px">';
      html += '<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#F0A020;letter-spacing:.16em;text-transform:uppercase">Classement essais</span>';
      html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.08em">temps de référence</span>';
      html += '</div><div>';
      rows.forEach(function (row) {
        var hl = row.isPlayer;
        var bg = hl ? "rgba(34,211,238,0.08)" : "transparent";
        var nameCol = hl ? "#22D3EE" : "var(--text)";
        var gapTxt = "";
        if (row.lap != null && row.gap != null && row.pos !== 1 && row.gap > 0.0005) gapTxt = "+" + row.gap.toFixed(3);
        html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid var(--border);background:' + bg + '">';
        html += '<span style="font-family:var(--font-display);font-size:12px;font-weight:900;color:' + (hl ? "#22D3EE" : "var(--muted)") + ';min-width:22px">P' + row.pos + '</span>';
        html += '<span style="flex:1;font-size:12px;font-weight:' + (hl ? "800" : "600") + ';color:' + nameCol + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(row.name) + (hl ? ' <span style="font-size:9px;color:var(--muted);font-weight:700">(toi)</span>' : '') + '</span>';
        html += '<span style="font-family:var(--font-display);font-size:12px;font-weight:800;color:' + (row.lap == null ? "var(--muted)" : nameCol) + ';min-width:62px;text-align:right">' + _fpFmtLap(row.lap) + '</span>';
        html += '<span style="font-family:var(--font-display);font-size:10px;font-weight:700;color:var(--muted);min-width:54px;text-align:right">' + gapTxt + '</span>';
        html += '</div>';
      });
      html += '</div>';
      box.innerHTML = html;

      // insérer juste avant le panneau de réglages s'il existe, sinon en tête
      var setupPanel = document.getElementById("fp-setup-panel");
      if (setupPanel && setupPanel.parentElement === container) container.insertBefore(box, setupPanel);
      else container.insertBefore(box, container.firstChild);
    }

    // Enrobage de renderPracticeSection
    var _origRender = window.renderPracticeSection;
    window.renderPracticeSection = function () {
      var out = _origRender.apply(this, arguments);
      try { injectRivalsBoard(); } catch (e) { console.warn("[12] injectRivalsBoard:", e); }
      try { injectSetupPanel(); } catch (e) { console.warn("[12] injectSetupPanel:", e); }
      return out;
    };

    // Si la section est déjà à l'écran au moment de l'install, on rafraîchit.
    try {
      var sec = document.getElementById("race-practice-section");
      if (sec && sec.style.display !== "none" && typeof hasPracticeSystem === "function" && hasPracticeSystem()) {
        window.renderPracticeSection();
      }
    } catch (e) { /* no-op */ }
  }
})();



// ===================================================================

// ===== Bloc intégré : 13-essais-libres-live.js =====

// ===================================================================

/* =============================================================================
 * 13 — ESSAIS LIBRES « LIVE » : SÉANCE EN TEMPS RÉEL (style F1 Manager 24)
 * =============================================================================
 *
 * OBJECTIF (demande Axel) — Immersion & réalisme
 * ----------------------------------------------
 * Transformer les essais libres « 1 clic = 1 tour » en une VRAIE séance vivante :
 *   1. Un chrono de séance défile EN CONTINU (il ne s'arrête plus entre les tours).
 *   2. Au stand, le joueur :
 *        - règle la voiture (curseurs intégrés),
 *        - choisit un COMPOSÉ de pneus (stock limité par séance),
 *        - choisit un MODE de pilotage (Conserver / Normal / Attaque),
 *        - choisit la longueur du relais (3 / 5 / Libre).
 *   3. « ENVOYER EN PISTE » → tour de sortie (warm-up) puis tours lancés qui
 *      défilent en direct (chrono + 3 secteurs), avec USURE PNEUS qui monte tour
 *      après tour, le grip qui baisse (et chute après la falaise d'usure).
 *   4. Le joueur peut RENTRER AU STAND (BOX) à tout moment, ou le relais se
 *      termine seul (nb de tours atteint / pneus morts / chrono écoulé).
 *   5. Fin de relais → débrief ingénieur (setup + état pneus), retour au stand,
 *      on recommence tant qu'il reste du temps. Chrono à 0 → séance terminée.
 *
 * RÉALISME PRÉSERVÉ
 * -----------------
 * Chaque tour lancé appelle runPracticeTest() : l'apprentissage du setup
 * (knowledge / sweet spots / feedback) continue d'alimenter qualifs & course.
 * On ne garde de runPracticeTest que le FEEDBACK ; le chrono affiché est
 * recalculé ici en couplant l'erreur de réglage, l'état des pneus, le mode de
 * pilotage et un peu de bruit pilote — ce qui découple l'affichage de la
 * dérive interne de testsThisSession (sinon les temps tombaient sans fin).
 *
 * ARCHITECTURE (Option A — enrichissement sûr)
 * --------------------------------------------
 * Module autonome, chargé APRÈS 12-essais-libres.js. Il REMPLACE
 * renderPracticeSection / doPracticeTest / doEndPracticeSession et neutralise le
 * plafond getPracticeMaxTests (le chrono est désormais le seul limiteur).
 * Ne modifie AUCUN fichier core. Réversible : retirer la balise <script> de ce
 * fichier rétablit le comportement de 12.
 *
 * Dépendances (vérifiées présentes au runtime) : runPracticeTest,
 * getAvailableSetupParams, setAdvParam, getSetupSweetSpots, calcEngineerPrecision,
 * describeFeedback, _ppEscSafe, showToast, goToQualifStep, getPracticeMaxSessions,
 * initPracticeState, RACE_STATE, G, RJ_COMPOUND_PROFILES (04c), getCircuitBaseRef.
 * NB : _formatLapTime n'est PAS global (closure de 03) → formateur local ici.
 * ===========================================================================*/

(function rjEssaisLibresLive() {
  if (typeof window === "undefined") return;
  if (window._rjEssaisLiveInstalled) return;

  function ready() {
    return typeof window.runPracticeTest === "function"
      && typeof window.renderPracticeSection === "function"
      && typeof window.getAvailableSetupParams === "function"
      && typeof window.getPracticeMaxSessions === "function";
  }

  function boot() {
    if (!ready()) return false;
    if (window._rjEssaisLiveInstalled) return true;
    window._rjEssaisLiveInstalled = true;
    install();
    console.log("[13] Essais libres LIVE activé — chrono continu + runs + usure pneus + débrief ingénieur (style F1M24)");
    return true;
  }

  if (!boot()) {
    var _tries = 0;
    var _iv = setInterval(function () {
      if (boot() || ++_tries > 100) clearInterval(_iv);
    }, 80);
  }

  // ==========================================================================
  function install() {

    // ------------------------------------------------------------------------
    // Constantes & helpers
    // ------------------------------------------------------------------------
    var PARAM_LABELS = {
      aileron_av: "Aileron avant", aileron_ar: "Aileron arrière",
      antiroulis_av: "Antiroulis avant", antiroulis_ar: "Antiroulis arrière",
      carrossage: "Carrossage", suspension: "Suspension",
      pression_pneus: "Pression pneus", differentiel: "Différentiel",
      repartition_frein: "Répartition freinage"
    };

    // Durée RÉELLE (ms) du chrono de séance, par catégorie. Plus long que les
    // anciens timers pour faire tenir plusieurs relais.
    var SESSION_MS = {
      "Karting Junior": 140000, "Karting Senior": 140000, "Formule 4": 160000,
      "Formula Regional": 170000, "Formule 3": 180000, "Formule 2": 190000,
      "Formule 1": 210000, "Super Formula": 190000, "Endurance WEC": 200000, "IndyCar": 190000
    };
    function sessionMs() { return SESSION_MS[G.cat] || 170000; }

    // Animation d'un tour (ms réelles). Le chrono de séance continue de couler
    // pendant ces animations.
    var OUTLAP_MS = 2200;   // tour de sortie (warm-up)
    var FLYLAP_MS = 3900;   // tour lancé

    // Usure de base par tour lancé (%) avant modulateurs.
    var BASE_WEAR = 6.2;

    function esc(s) { return (typeof _ppEscSafe === "function") ? _ppEscSafe(s) : String(s == null ? "" : s); }

    function fmtLap(t) {
      if (t == null || !isFinite(t) || t <= 0) return "—:——.———";
      var m = Math.floor(t / 60), s = t - 60 * m;
      return (m > 0 ? m + ":" + (s < 10 ? "0" : "") : "0:") + s.toFixed(3);
    }

    function isKart() { return (G.cat || "").indexOf("Karting") === 0; }

    function circuitBaseRef() {
      var cn = (RACE_STATE && RACE_STATE.circuit) || "";
      // Filet de sécurité : si l'état course n'a pas encore le circuit (entrée
      // de week-end pas finalisée), on récupère le circuit de la prochaine
      // manche — exactement comme le moteur de qualif/course — pour que la
      // référence des essais soit IDENTIQUE à celle affichée ailleurs.
      if (!cn && typeof getNextRace === "function") {
        var nr = getNextRace();
        cn = (nr && nr.name) || "";
      }
      var cbr = (typeof getCircuitBaseRef === "function" && cn) ? getCircuitBaseRef(cn, G.cat) : 0;
      if (cbr > 0) return cbr;
      var fallback = {
        "Karting Junior": 104, "Karting Senior": 98, "Formule 4": 188,
        "Formula Regional": 180, "Formule 3": 174, "Formule 2": 166, "Formule 1": 156,
        "Super Formula": 160, "Endurance WEC": 204, "IndyCar": 152
      };
      var base = fallback[G.cat] || 85;
      if (RACE_STATE && RACE_STATE.weather) {
        if (RACE_STATE.weather.id === "wet") base *= 1.06;
        else if (RACE_STATE.weather.id === "storm") base *= 1.12;
      }
      return base;
    }

    // ------------------------------------------------------------------------
    // Composés de pneus disponibles selon catégorie / météo
    // ------------------------------------------------------------------------
    function compoundProfile(id) {
      var P = (typeof RJ_COMPOUND_PROFILES !== "undefined") ? RJ_COMPOUND_PROFILES : null;
      if (P && P[id]) return P[id];
      // Fallback minimal si 04c absent
      var f = {
        soft: { peakGrip: 1.04, wearRate: 1.45, warmupRate: 1.30, cliffStart: 65, cliffSeverity: 1.8, label: "Tendre" },
        medium: { peakGrip: 1.00, wearRate: 1.00, warmupRate: 1.00, cliffStart: 78, cliffSeverity: 1.4, label: "Médium" },
        hard: { peakGrip: 0.96, wearRate: 0.65, warmupRate: 0.75, cliffStart: 88, cliffSeverity: 1.2, label: "Dur" },
        wet: { peakGrip: 1.00, wearRate: 0.90, warmupRate: 1.10, cliffStart: 70, cliffSeverity: 1.4, label: "Pluie" }
      };
      return f[id] || f.medium;
    }

    var COMPOUND_COLORS = { soft: "#EF4444", medium: "#FBBF24", hard: "#E5E7EB", wet: "#3B82F6", inter: "#34D399" };
    var COMPOUND_SHORT = { soft: "T", medium: "M", hard: "D", wet: "P", inter: "I" };

    // Positionnement du peloton : skill de référence (haut de grille) + amplitude
    var FIELD_REF = 0.62, FIELD_SPREAD = 0.115;

    // Talent du joueur (0..1) dérivé de ses stats — influe sur son rythme
    function playerSkillN() {
      try {
        var s = G.stats || {};
        var pace = (s.vitesse || 50) * 0.55 + (s.regularite || 50) * 0.2 + (s.adapt || 50) * 0.15 + (s.sangfroid || 50) * 0.1;
        return Math.max(0, Math.min(1, pace / 100));
      } catch (e) { return 0.5; }
    }

    // ------------------------------------------------------------------------
    // Connaissance de la voiture (% par week-end, façon F1 Manager)
    //  - augmente avec chaque tour bouclé (gain décroissant)
    //  - baisse quand on modifie les réglages (le setup change → à revalider)
    //  - améliore légèrement le rythme et la régularité quand elle est haute
    // ------------------------------------------------------------------------
    // Connaissance de la voiture — barème ADAPTÉ À LA COMPLEXITÉ de la catégorie.
    //  La complexité = nombre de réglages disponibles (getAvailableSetupParams) :
    //   Karting Junior = 1 réglage … Formule 1 = 9 réglages.
    //  → Catégories d'entrée : peu de réglages, donc la connaissance démarre haut
    //    et monte TRÈS vite (rien de compliqué à comprendre).
    //  → Catégories avancées : beaucoup de réglages, donc montée plus progressive
    //    et plus exigeante quand on touche au setup — mais toujours atteignable
    //    sur un week-end (3 séances de tours).
    function _knowParamCount() {
      try {
        if (typeof getAvailableSetupParams === "function") {
          var p = getAvailableSetupParams(G.cat);
          if (p && p.length) return p.length;
        }
      } catch (e) {}
      return 6;
    }
    function knowStart() {
      // KJ(1)≈18 % … F1(9)≈4 %
      return Math.max(4, Math.round(20 - 1.8 * _knowParamCount()));
    }
    function knowGain() {
      // gain de base par tour (×(1−k/100)) : KJ(1)≈20 … F1(9)≈8
      return Math.max(7, 22 - 1.6 * _knowParamCount());
    }
    function knowLossUnit() {
      // perte (%) par cran de réglage modifié : KJ≈1.6 … F1≈2.7
      return 1.5 + 0.13 * _knowParamCount();
    }

    function setupSnapshot() {
      var s = (G && G.setupAdv) || {};
      var o = {};
      Object.keys(s).forEach(function (k) { if (typeof s[k] === "number") o[k] = s[k]; });
      return o;
    }
    function setupDelta(a, b) {
      if (!a || !b) return 0;
      var d = 0;
      Object.keys(b).forEach(function (k) {
        if (typeof a[k] === "number") d += Math.abs(b[k] - a[k]);
      });
      return d;
    }
    function ensureKnowledge(pr) {
      if (typeof pr.carKnowledge !== "number") pr.carKnowledge = knowStart();
      if (!pr._knowSetup) pr._knowSetup = setupSnapshot();
    }
    // Détecte un changement de réglages (fait dans l'onglet Préparation) et
    // réduit la connaissance en conséquence. Appelée à chaque rendu.
    function syncKnowledgeWithSetup(pr) {
      ensureKnowledge(pr);
      var now = setupSnapshot();
      var d = setupDelta(pr._knowSetup, now);
      if (d > 0.001) {
        pr.carKnowledge = Math.max(0, pr.carKnowledge - d * knowLossUnit());
        pr._knowSetup = now;
      }
    }
    function addKnowledgeForLap(pr) {
      ensureKnowledge(pr);
      var gain = knowGain() * (1 - pr.carKnowledge / 100);
      pr.carKnowledge = Math.min(100, pr.carKnowledge + Math.max(0.6, gain));
      // un tour "valide" le setup courant → on resynchronise le snapshot
      pr._knowSetup = setupSnapshot();
    }
    function knowledgeColor(k) {
      return k >= 75 ? "#34D399" : k >= 45 ? "#22D3EE" : k >= 20 ? "#F59E0B" : "#EF4444";
    }

    function availableCompounds() {
      var w = (RACE_STATE && RACE_STATE.weather && RACE_STATE.weather.id) || "dry";
      if (w === "wet" || w === "storm") return ["wet"];
      if (isKart()) return ["medium"]; // karting : pneu unique
      return ["soft", "medium", "hard"];
    }

    // Stock de trains par séance (réinitialisé à chaque séance)
    function defaultStock() {
      var w = (RACE_STATE && RACE_STATE.weather && RACE_STATE.weather.id) || "dry";
      if (w === "wet" || w === "storm") return { wet: 6 };
      if (isKart()) return { medium: 99 };
      return { soft: 3, medium: 4, hard: 3 };
    }

    // ------------------------------------------------------------------------
    // État live (sur RACE_STATE.practice._live)
    // ------------------------------------------------------------------------
    function ensureLive() {
      if (!RACE_STATE.practice && typeof initPracticeState === "function") initPracticeState();
      var pr = RACE_STATE.practice;
      if (!pr) return null;
      pr.tests = Array.isArray(pr.tests) ? pr.tests : [];
      if (typeof pr.sessionsCompleted !== "number") pr.sessionsCompleted = 0;
      if (typeof pr.testsThisSession !== "number") pr.testsThisSession = 0;
      if (!pr._live || pr._live.sessionIdx !== pr.sessionsCompleted) {
        // Nouvelle séance → chrono neuf, stock neuf
        var comps = availableCompounds();
        pr._live = {
          sessionIdx: pr.sessionsCompleted,
          clockTotal: sessionMs(),
          clockStart: Date.now(),
          ended: false,
          onTrack: false,
          stock: defaultStock(),
          compound: comps[0],
          push: "norm",
          plan: 5,                 // tours planifiés (0 = libre)
          runs: [],
          bestLap: null,
          run: null,               // relais en cours
          briefingShown: false,
          field: null,             // peloton adverse (classement live)
          secBestPerso: [null, null, null]  // meilleur temps perso par secteur (réf. couleur)
        };
        buildField(pr._live);
      }
      if (pr._live && (!pr._live.field || (pr._live.field.length === 0 && typeof G !== "undefined" && Array.isArray(G.rivals) && G.rivals.length))) buildField(pr._live);
      return pr;
    }

    // ------------------------------------------------------------------------
    // Peloton adverse — chaque séance, les rivaux posent des temps en direct.
    // On génère pour chacun un temps cible (selon son skill) et un planning de
    // "révélations" réparties sur la durée de séance. Le ticker dévoile ces
    // temps progressivement → la feuille de temps évolue comme en qualif.
    // ------------------------------------------------------------------------
    function buildField(L) {
      var base = circuitBaseRef();
      var rivals = (typeof G !== "undefined" && Array.isArray(G.rivals)) ? G.rivals : [];
      var field = [];
      // skill de référence (haut de grille) — un très bon pilote tourne ≈ base
      var REF = FIELD_REF, SPREAD = FIELD_SPREAD;
      rivals.forEach(function (rv, i) {
        var sk = (typeof rv.skill === "number") ? rv.skill : 50;
        var skN = Math.max(0, Math.min(1, sk / 100));
        // temps cible : meilleur skill → plus proche de base
        var target = base * (1 + (REF - skN) * SPREAD);
        // régularité du pilote → amplitude du bruit
        var cons = (typeof rv.consistency === "number") ? rv.consistency : 0.7;
        var noiseAmp = base * 0.006 * (1.2 - cons);
        target += (Math.random() - 0.5) * 2 * noiseAmp;
        // planning : 2 à 4 sorties, dont la dernière proche du temps cible
        var nReveals = 2 + Math.floor(Math.random() * 3);
        var reveals = [];
        var firstFrac = 0.04 + Math.random() * 0.12;     // 1re sortie très tôt (4–16 %)
        for (var r = 0; r < nReveals; r++) {
          var frac = Math.min(0.95, firstFrac + r * (0.58 / nReveals) + Math.random() * 0.05);
          // les premiers tours sont plus lents, on converge vers target
          var prog = nReveals > 1 ? r / (nReveals - 1) : 1;
          var slowOff = base * (0.02 * (1 - prog)) + base * (Math.random() * 0.004);
          reveals.push({ atFrac: frac, time: target + slowOff });
        }
        reveals.sort(function (a, b) { return a.atFrac - b.atFrac; });
        // Décalage de tours par rapport au joueur : chaque pilote tourne autant que le
        // joueur, à ± ~8 tours près (évite que les rivaux fassent beaucoup moins de tours).
        var lapOffset = Math.round((Math.random() - 0.5) * 16); // ≈ [-8, +8]
        field.push({ name: rv.name || rv.nom || ("Pilote " + (i + 1)), nat: rv.nat || null, team: rv.team || null, skill: sk, target: target, reveals: reveals, lapOffset: lapOffset });
      });
      L.field = field;
    }

    // Classement courant : rivaux (temps dévoilés selon le chrono) + joueur
    function fieldStandings(pr) {
      var L = pr._live;
      var frac = L.clockTotal > 0 ? (L.clockTotal - clockRemaining(pr)) / L.clockTotal : 1;
      var rows = [];
      // Tours du joueur (calculés en premier : servent de référence pour le peloton)
      var pLaps = 0;
      (L.runs || []).forEach(function (r) { pLaps += (r.flyingLaps || 0); });
      if (L.run) pLaps += (L.run.flyingLaps || 0);
      (L.field || []).forEach(function (d) {
        var best = null;
        for (var i = 0; i < d.reveals.length; i++) {
          if (d.reveals[i].atFrac <= frac) {
            if (best == null || d.reveals[i].time < best) best = d.reveals[i].time;
          }
        }
        // Nombre de tours aligné sur le joueur, à ± un décalage propre au pilote.
        // Plancher à 1 dès que le joueur a roulé, pour que tout le peloton participe.
        var laps = pLaps > 0 ? Math.max(1, pLaps + (d.lapOffset || 0)) : 0;
        // Si le pilote a roulé mais qu'aucun temps n'est encore dévoilé par le chrono,
        // on affiche au moins son premier temps (cohérence tours/temps).
        if (laps > 0 && best == null && d.reveals && d.reveals.length) best = d.reveals[0].time;
        rows.push({ name: d.name, nat: d.nat, team: d.team, time: best, laps: laps, isPlayer: false });
      });
      var pName = "Toi";
      try { pName = ((G.pilot && (G.pilot.prenom || "")) + " " + (G.pilot && (G.pilot.nom || ""))).trim() || "Toi"; } catch (e) {}
      rows.push({ name: pName, nat: (G.pilot && G.pilot.nat) || null, team: (G.currentTeam && G.currentTeam !== "Indépendant") ? G.currentTeam : null, time: L.bestLap ? L.bestLap.lapTime : null, laps: pLaps, isPlayer: true });
      rows.sort(function (a, b) {
        if (a.time == null && b.time == null) return 0;
        if (a.time == null) return 1;
        if (b.time == null) return -1;
        return a.time - b.time;
      });
      return rows;
    }

    function fmtGap(t, leader) {
      if (t == null) return "—";
      if (leader == null || t === leader) return "";
      var d = t - leader;
      return "+" + d.toFixed(3);
    }

    function clockRemaining(pr) {
      var L = pr._live;
      if (!L) return 0;
      if (L.ended) return 0;
      return Math.max(0, L.clockTotal - (Date.now() - L.clockStart));
    }

    // ------------------------------------------------------------------------
    // Modèle de chrono d'un tour lancé
    // ------------------------------------------------------------------------
    function computeFlyingLap(pr, run, feedback) {
      var base = circuitBaseRef();

      // 1) Pénalité de réglage (erreur moyenne aux sweet spots, via feedback)
      var sumAbs = 0, n = 0;
      Object.keys(feedback || {}).forEach(function (k) {
        var f = feedback[k];
        if (f && typeof f.absDiff === "number") { sumAbs += f.absDiff; n++; }
      });
      var avgErr = n ? sumAbs / n : 2.5;
      var setupPenalty = base * Math.min(0.045, avgErr * 0.006); // erreur ~5 → +3%

      // 1b) Talent du pilote — positionne le joueur dans le peloton (même barème
      //     que les rivaux). S'améliore avec la progression de carrière.
      var talentOffset = base * (FIELD_REF - playerSkillN()) * FIELD_SPREAD;

      // 2) Pneus : grip = peak * warm * usure
      var prof = compoundProfile(run.compound);
      var peak = prof.peakGrip;
      var flyIdx = run.flyingLaps; // 0 pour le 1er tour lancé
      var warm = flyIdx <= 0 ? 0.984 : (flyIdx === 1 ? 0.996 : 1.0); // montée en température
      var wear = run.wear;
      var wearGrip;
      if (wear > prof.cliffStart) {
        var over = (wear - prof.cliffStart) / Math.max(1, (100 - prof.cliffStart));
        wearGrip = Math.max(0.80, 1 - (0.06 + over * over * (prof.cliffSeverity - 1) * 0.42));
      } else {
        wearGrip = 1 - (wear / 100) * 0.07;
      }
      var grip = peak * warm * wearGrip;
      var tyreMult = peak / Math.max(0.5, grip); // <peak → >1 → plus lent

      // 3) Mode de pilotage
      var pushMult = run.push === "push" ? 0.9955 : run.push === "cool" ? 1.0065 : 1.0;

      // 4) Bruit pilote (talent → bruit plus faible)
      var prec = (typeof calcEngineerPrecision === "function") ? calcEngineerPrecision() : 0.6;
      // Connaissance de la voiture : meilleure régularité (moins de bruit) et
      // léger gain de rythme quand elle est élevée.
      var kn = (typeof pr.carKnowledge === "number") ? pr.carKnowledge / 100 : 0.06;
      var noiseAmp = base * 0.004 * (1.2 - prec) * (1 - 0.45 * kn);
      var noise = (Math.random() - 0.45) * 2 * noiseAmp;
      var knowledgeGain = base * 0.012 * kn; // jusqu'à −1.2 % à 100 %

      var lap = (base + setupPenalty + talentOffset) * tyreMult * pushMult - knowledgeGain + noise;

      // 5) Petit incident en mode attaque
      var incident = null;
      if (run.push === "push" && Math.random() < 0.05) {
        lap += base * (0.012 + Math.random() * 0.02);
        incident = "lock";
      } else if (wear > prof.cliffStart + 12 && Math.random() < 0.10) {
        lap += base * (0.01 + Math.random() * 0.015);
        incident = "slide";
      }

      lap = Math.max(0.92 * base, lap);
      return { lapTime: +lap.toFixed(3), gripPct: Math.round(100 * grip / peak), incident: incident };
    }

    function wearPerLap(run) {
      var prof = compoundProfile(run.compound);
      var sev = (RACE_STATE.circuitData && typeof RACE_STATE.circuitData.tyreDeg === "number") ? RACE_STATE.circuitData.tyreDeg : 5;
      var sevF = 0.72 + (Math.max(2, Math.min(9, sev)) - 2) / 7 * 0.85; // ~0.72..1.57
      var pushW = run.push === "push" ? 1.4 : run.push === "cool" ? 0.72 : 1.0;
      var catW = isKart() ? 0.8 : 1.0;
      return BASE_WEAR * prof.wearRate * sevF * pushW * catW;
    }

    // ------------------------------------------------------------------------
    // Helpers ingénieur (autonomes — n'imposent pas la présence de 12)
    // ------------------------------------------------------------------------
    function engBriefing() {
      if (typeof window._buildEngineerBriefing === "function") {
        try { return window._buildEngineerBriefing(0, RACE_STATE.circuit, RACE_STATE.weather); } catch (e) {}
      }
      return "On attaque les essais. Cale-moi la voiture, choisis tes pneus et envoie quelques tours quand tu veux. Le chrono tourne, mais on a de la marge.";
    }

    function engRunDebrief(run, feedback) {
      var keys = Object.keys(feedback || {});
      var nPerfect = 0, nClose = 0, nHigh = 0, nLow = 0;
      keys.forEach(function (k) {
        var d = feedback[k].direction;
        if (d === "perfect") nPerfect++; else if (d === "close") nClose++;
        else if (d === "too_high") nHigh++; else if (d === "too_low") nLow++;
      });
      var total = keys.length, verdict;
      if (total === 0) verdict = "mixed";
      else if (nPerfect >= 0.75 * total) verdict = "excellent";
      else if ((nPerfect + nClose) >= 0.6 * total) verdict = "good";
      else verdict = "adjust";

      var pools = {
        excellent: ["La voiture est dans la fenêtre, beau relais. On garde cette base.",
          "Rien à redire, le setup répond bien. On est prêts à pousser."],
        good: ["On progresse. Encore deux-trois retouches et c'est nickel.",
          "Bonne direction. Affine ce que je t'indique et on y est."],
        adjust: ["Il reste du boulot sur le setup. Regarde mes retours et relance.",
          "La voiture n'est pas encore là, on ajuste avant de chercher le chrono."],
        mixed: ["Pas assez de tours propres pour juger. Refais-m'en un relais."]
      };
      var msg = pools[verdict][Math.floor(Math.random() * pools[verdict].length)];
      if (verdict === "adjust" || verdict === "good") {
        if (nHigh > nLow && nHigh > 0) msg += " Globalement tu en mets un peu trop, allège.";
        else if (nLow > nHigh && nLow > 0) msg += " Tu es un peu juste sur plusieurs réglages, ajoute par petites touches.";
      }
      // Note pneus
      if (run.wear >= 85) msg += " Côté gommes, les pneus étaient finis sur la fin — rentre plus tôt la prochaine fois.";
      else if (run.wear >= 60) msg += " Les pneus commençaient à fatiguer, c'était le bon moment de rentrer.";
      return { msg: msg, verdict: verdict };
    }

    // ========================================================================
    // RENDU — aiguillage stand / piste
    // ========================================================================
    function render() {
      var sec = document.getElementById("race-practice-section");
      if (!sec) return;
      if (typeof hasPracticeSystem === "function" && !hasPracticeSystem()) { sec.style.display = "none"; return; }
      sec.style.display = "block";
      // Anti-clignotement : les temps des essais sont déjà formatés au millième.
      // On exclut toute la section de l'observer d'arrondi global de 04q, qui sinon
      // arrondit puis voit le refresh réécrire la valeur précise (oscillation visible).
      sec.setAttribute("data-rj-noround", "1");
      var pr = ensureLive();
      if (!pr) { sec.style.display = "none"; return; }
      syncKnowledgeWithSetup(pr);

      var maxSessions = (typeof getPracticeMaxSessions === "function") ? getPracticeMaxSessions() : 3;
      if (pr.sessionsCompleted >= maxSessions) { renderAllDone(sec, pr, maxSessions); return; }

      if (pr._live.onTrack && pr._live.run) renderTrack(sec, pr);
      else renderGarage(sec, pr, maxSessions);
    }

    // ---- En-tête commun (séance + chrono) ----
    function headerHtml(pr, maxSessions) {
      var L = pr._live;
      var curSession = pr.sessionsCompleted + 1;
      var circuit = (RACE_STATE.circuitData && RACE_STATE.circuitData.name) || RACE_STATE.circuit || "Circuit";
      var weather = RACE_STATE.weather || { label: "Sec", id: "dry" };
      var rem = clockRemaining(pr);
      var pct = rem / L.clockTotal;
      var col = pct > 0.4 ? "#22D3EE" : pct > 0.15 ? "#F59E0B" : "#EF4444";
      var secs = Math.ceil(rem / 1000);
      var mm = Math.floor(secs / 60), ss = secs % 60;
      var clk = mm + ":" + (ss < 10 ? "0" : "") + ss;

      var h = '';
      h += '<div style="background:linear-gradient(135deg,#0a1418 0%,#0d1a20 100%);border:1px solid #1a3540;border-left:3px solid #22D3EE;margin-bottom:10px;overflow:hidden">';
      h += '<div style="padding:10px 14px;background:rgba(34,211,238,.06);border-bottom:1px solid rgba(34,211,238,.15);display:flex;justify-content:space-between;align-items:center">';
      h += '<div style="display:flex;align-items:center;gap:8px">';
      h += '<div style="width:8px;height:8px;background:#22D3EE;border-radius:50%;box-shadow:0 0 6px #22D3EE;animation:practice-pulse 1.5s ease-in-out infinite"></div>';
      h += '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#22D3EE;letter-spacing:.22em;text-transform:uppercase">EL' + curSession + '</span>';
      h += '</div>';
      h += '<span style="font-family:var(--font-display);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">' + esc(circuit) + ' · ' + esc(weather.label) + '</span>';
      h += '</div>';
      // dots séances
      h += '<div style="padding:8px 14px 4px;display:flex;align-items:center;gap:10px">';
      h += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;flex-shrink:0">Séances</span>';
      h += '<div style="flex:1;display:flex;gap:3px">';
      for (var si = 0; si < maxSessions; si++) {
        var done = si < pr.sessionsCompleted, cur = si === pr.sessionsCompleted;
        h += '<div style="flex:1;height:3px;background:' + (done ? '#34D399' : cur ? '#22D3EE' : 'rgba(255,255,255,.06)') + ';opacity:' + (done || cur ? 1 : .6) + ';border-radius:2px"></div>';
      }
      h += '</div></div>';
      // chrono séance
      h += '<div style="padding:4px 14px 10px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      h += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Temps de séance</span>';
      h += '<span id="fpl-clock" style="font-family:var(--font-display);font-size:13px;font-weight:900;color:' + col + ';letter-spacing:.04em">' + clk + '</span>';
      h += '</div>';
      h += '<div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">';
      h += '<div id="fpl-clock-bar" style="height:100%;width:' + (100 * pct).toFixed(1) + '%;background:' + col + ';transition:width .12s linear;border-radius:3px"></div>';
      h += '</div>';
      // Connaissance de la voiture (% du week-end)
      ensureKnowledge(pr);
      var kv = Math.round(pr.carKnowledge);
      var kc = knowledgeColor(pr.carKnowledge);
      h += '<div style="margin-top:9px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      h += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Connaissance voiture</span>';
      h += '<span id="fpl-know-lbl" style="font-family:var(--font-display);font-size:12px;font-weight:900;color:' + kc + '">' + kv + '%</span>';
      h += '</div>';
      h += '<div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">';
      h += '<div id="fpl-know-bar" style="height:100%;width:' + kv + '%;background:' + kc + ';transition:width .3s ease;border-radius:3px"></div>';
      h += '</div></div>';
      h += '</div></div>';
      return h;
    }

    // ---- Bandeau meilleur tour ----
    function bestBannerHtml(pr) {
      var L = pr._live;
      if (!L.bestLap) return '';
      var b = '';
      b += '<div style="margin-bottom:10px;padding:10px 14px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid var(--gold);display:flex;justify-content:space-between;align-items:center">';
      b += '<div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--gold);letter-spacing:.18em;text-transform:uppercase;margin-bottom:2px">★ Meilleur tour</div>';
      b += '<div style="font-family:var(--font-display);font-size:21px;font-weight:900;color:var(--white)">' + fmtLap(L.bestLap.lapTime) + '</div></div>';
      b += '<div style="text-align:right"><div style="font-size:10px;color:var(--muted);font-family:var(--font-display);letter-spacing:.1em">' + (COMPOUND_PROFILES_LABEL(L.bestLap.compound)) + '</div>';
      b += '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + L.runs.length + ' relais</div></div>';
      b += '</div>';
      return b;
    }
    function COMPOUND_PROFILES_LABEL(id) { return compoundProfile(id).label || id; }

    // ---- Journal des tours ----
    function lapLogHtml(pr) {
      var L = pr._live;
      var allLaps = [];
      L.runs.forEach(function (r) { r.laps.forEach(function (lp) { allLaps.push(lp); }); });
      if (L.run) L.run.laps.forEach(function (lp) { allLaps.push(lp); });
      if (!allLaps.length) return '';
      var best = L.bestLap ? L.bestLap.lapTime : null;
      var rows = allLaps.slice(-6).reverse();
      var b = '';
      b += '<div style="margin-bottom:10px;background:var(--bg3);border:1px solid var(--line);border-radius:6px;overflow:hidden">';
      b += '<div style="padding:8px 12px;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.16em;text-transform:uppercase">Derniers tours</div>';
      rows.forEach(function (lp) {
        var isBest = best != null && Math.abs(lp.lapTime - best) < 0.0005;
        var col = COMPOUND_COLORS[lp.compound] || "#9CA3AF";
        b += '<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--border);font-size:12px">';
        b += '<span style="color:' + col + ';font-family:var(--font-display);font-size:12px;font-weight:900;flex-shrink:0;width:16px;text-align:center">' + (COMPOUND_SHORT[lp.compound] || '?') + '</span>';
        b += '<span style="font-family:var(--font-display);font-size:14px;font-weight:800;color:' + (isBest ? 'var(--gold)' : 'var(--white)') + ';min-width:74px">' + (lp.outLap ? '<span style="color:var(--muted);font-size:11px">Tour sortie</span>' : fmtLap(lp.lapTime)) + '</span>';
        if (!lp.outLap) {
          b += '<span style="font-size:10px;color:var(--muted);flex:1">usure ' + Math.round(lp.wearAfter) + '%</span>';
          if (isBest) b += '<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--gold);letter-spacing:.1em">MEILLEUR</span>';
        }
        b += '</div>';
      });
      if (b.slice(-6)) { /* noop */ }
      b += '</div>';
      return b;
    }

    // ========================================================================
    // STAND (garage)
    // ========================================================================
    // ------------------------------------------------------------------------
    // Feuille de temps live (classement) — affichée au stand et en piste
    // ------------------------------------------------------------------------
    function timingBoardRowsHtml(pr) {
      var rows = fieldStandings(pr);
      var leader = null;
      for (var i = 0; i < rows.length; i++) { if (rows[i].time != null) { leader = rows[i].time; break; } }
      var hasBadge = (typeof driverBadge === "function");
      var h = "";
      rows.forEach(function (r, idx) {
        var pos = idx + 1;
        var isP = r.isPlayer;
        var bg = isP ? "rgba(34,211,238,.12)" : (idx % 2 ? "rgba(255,255,255,.015)" : "transparent");
        var bd = isP ? "border-left:2px solid #22D3EE" : "border-left:2px solid transparent";
        var posCol = pos === 1 ? "#FBBF24" : pos === 2 ? "#D1D5DB" : pos === 3 ? "#D97706" : "var(--muted)";
        var nameCol = isP ? "#22D3EE" : "var(--text2)";
        var t = r.time != null ? fmtLap(r.time) : "—:——.———";
        var gap = pos === 1 && r.time != null ? "Réf" : fmtGap(r.time, leader);
        var gapCol = pos === 1 && r.time != null ? "var(--gold)" : "var(--dim)";
        var badge = hasBadge ? driverBadge(r.team, r.nat || "FR", 15) : "";
        h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:' + bg + ';' + bd + '">';
        h += '<div style="width:18px;text-align:center;font-family:var(--font-display);font-size:12px;font-weight:900;color:' + posCol + '">' + pos + '</div>';
        h += '<div style="flex:1;min-width:0;display:flex;align-items:center">' + badge + '<span style="font-size:12px;font-weight:' + (isP ? '800' : '600') + ';color:' + nameCol + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</span></div>';
        h += '<div style="width:20px;text-align:center;font-family:var(--font-display);font-size:10px;color:var(--muted)">' + (r.laps > 0 ? r.laps : '—') + '</div>';
        h += '<div style="font-size:10px;color:' + gapCol + ';font-family:var(--font-display);min-width:58px;text-align:right;white-space:nowrap;overflow:hidden">' + esc(gap) + '</div>';
        h += '<div style="font-family:var(--font-display);font-size:13px;font-weight:800;color:' + (r.time != null ? (isP ? '#fff' : 'var(--soft)') : 'var(--dim)') + ';min-width:74px;text-align:right">' + t + '</div>';
        h += '</div>';
      });
      return h;
    }

    function timingBoardHtml(pr) {
      var c = '<div style="margin-bottom:10px;background:var(--bg3);border:1px solid var(--line);border-radius:6px;overflow:hidden">';
      c += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--line)">';
      c += '<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--soft);letter-spacing:.16em;text-transform:uppercase">Feuille de temps</span>';
      c += '<span style="display:flex;align-items:center;gap:5px"><span style="width:6px;height:6px;border-radius:50%;background:#34D399;box-shadow:0 0 6px #34D399;animation:practice-pulse 1.2s ease-in-out infinite"></span><span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:#34D399;letter-spacing:.1em;text-transform:uppercase">Live</span></span>';
      c += '</div>';
      // Référence circuit — temps de référence de la catégorie sur ce circuit.
      // Les chronos de la séance (joueur + peloton) gravitent autour de cette
      // valeur : c'est le repère qui rend les temps « lisibles ».
      var _ref = circuitBaseRef();
      if (_ref > 0) {
        c += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid var(--line);background:rgba(245,158,11,.05)">';
        c += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Référence circuit</span>';
        c += '<span style="font-family:var(--font-display);font-size:13px;font-weight:900;color:var(--gold);letter-spacing:.03em">' + fmtLap(_ref) + '</span>';
        c += '</div>';
      }
      // En-têtes de colonnes
      c += '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">';
      c += '<div style="width:18px;text-align:center">Pos</div><div style="flex:1">Pilote</div><div style="width:20px;text-align:center">Tr</div><div style="min-width:58px;text-align:right">Écart</div><div style="min-width:74px;text-align:right">Meilleur</div>';
      c += '</div>';
      c += '<div id="fpl-board-body">' + timingBoardRowsHtml(pr) + '</div>';
      c += '</div>';
      return c;
    }

    function refreshBoard(pr) {
      var sec = document.getElementById("race-practice-section");
      if (!sec) return;
      var body = sec.querySelector("#fpl-board-body");
      if (body) body.innerHTML = timingBoardRowsHtml(pr);
    }

    function renderGarage(sec, pr, maxSessions) {
      var L = pr._live;
      var c = headerHtml(pr, maxSessions);

      // Briefing 1er passage
      if (!L.briefingShown && L.runs.length === 0) {
        c += '<div style="margin-bottom:10px;padding:11px 14px;border:1px solid var(--line);border-left:2px solid #22D3EE;background:var(--bg3);font-style:italic;font-size:13px;color:var(--soft);line-height:1.5;font-family:var(--font-body)">« ' + esc(engBriefing()) + ' »</div>';
      }

      c += bestBannerHtml(pr);

      // -- Panneau de configuration du relais --
      c += '<div style="margin-bottom:10px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid #22D3EE;border-radius:6px;overflow:hidden">';
      c += '<div style="padding:9px 14px;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:10px;font-weight:800;color:#22D3EE;letter-spacing:.16em;text-transform:uppercase">Stand — préparation du relais</div>';
      c += '<div style="padding:12px 14px">';

      // Composé (si choix)
      var comps = availableCompounds();
      if (comps.length > 1) {
        c += '<div style="font-size:10px;color:var(--muted);font-family:var(--font-display);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Pneus</div>';
        c += '<div style="display:flex;gap:6px;margin-bottom:12px">';
        comps.forEach(function (id) {
          var prof = compoundProfile(id);
          var col = COMPOUND_COLORS[id] || "#9CA3AF";
          var stock = L.stock[id] || 0;
          var on = L.compound === id;
          var disabled = stock <= 0;
          c += '<button data-fpl-comp="' + id + '"' + (disabled ? ' disabled' : '') + ' style="flex:1;padding:9px 4px;background:' + (on ? col + '22' : 'transparent') + ';border:1px solid ' + (on ? col : 'var(--line2)') + ';border-radius:6px;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (disabled ? '.4' : '1') + '; -webkit-tap-highlight-color:transparent">';
          c += '<div style="font-family:var(--font-display);font-size:16px;font-weight:900;color:' + col + ';line-height:1">' + (COMPOUND_SHORT[id] || '?') + '</div>';
          c += '<div style="font-size:9px;color:' + (on ? col : 'var(--muted)') + ';font-weight:700;margin-top:2px">' + esc(prof.label) + '</div>';
          c += '<div style="font-size:9px;color:var(--dim);font-family:var(--font-display);margin-top:1px">' + stock + ' set' + (stock > 1 ? 's' : '') + '</div>';
          c += '</button>';
        });
        c += '</div>';
      }

      // Style de pilotage et longueur de relais retirés : le pilote part en piste
      // directement (consigne "norm" + relais libre par défaut), puis on le rappelle
      // au stand et on le relance via le débrief.

      c += '</div></div>';

      // Note : les réglages se font dans l'onglet Préparation
      c += '<div style="margin-bottom:10px;padding:8px 12px;background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.25);border-radius:6px;display:flex;align-items:center;gap:8px">';
      c += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
      c += '<span style="font-size:11px;color:var(--soft);line-height:1.4">Les réglages de la voiture se font dans l\'onglet <b style="color:#A78BFA">Préparation</b>. Le travail en piste affine le retour de l\'ingénieur sur ces réglages.</span>';
      c += '</div>';

      // -- Feuille de temps (classement live) --
      c += timingBoardHtml(pr);

      // -- Bouton ENVOYER --
      var enoughTime = clockRemaining(pr) > OUTLAP_MS + FLYLAP_MS + 500;
      c += '<div style="margin-bottom:8px">';
      if (enoughTime) {
        c += '<button id="fpl-send-btn" style="width:100%;padding:14px 16px;background:linear-gradient(135deg,#22D3EE 0%,#0EA5E9 100%);border:none;color:#07151c;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:4px">';
        c += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polygon points="5 3 19 12 5 21"/></svg>';
        c += 'Envoyer en piste';
        c += '</button>';
      } else {
        c += '<div style="padding:12px 14px;background:var(--bg3);border:1px solid var(--line);color:var(--muted);font-size:12px;text-align:center;border-radius:6px">Plus assez de temps pour un tour — termine la séance.</div>';
      }
      c += '</div>';

      // Journal
      c += lapLogHtml(pr);

      // -- Fin de séance / qualif --
      var curSession = pr.sessionsCompleted + 1;
      if (curSession < maxSessions) {
        c += '<button id="fpl-next-btn" style="width:100%;padding:12px 16px;background:transparent;border:1px solid var(--line2);color:var(--text2);font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;margin-bottom:6px;border-radius:4px">Terminer EL' + curSession + ' → EL' + (curSession + 1) + '</button>';
      }
      c += '<button id="fpl-qualif-btn" style="width:100%;padding:10px 16px;background:transparent;border:1px solid var(--red2);color:var(--red2);font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:4px">Partir en qualif maintenant</button>';

      sec.innerHTML = c;
      wireGarage(sec, pr, maxSessions);
      startClockTicker(pr);
    }

    function wireGarage(sec, pr, maxSessions) {
      var L = pr._live;
      sec.querySelectorAll("[data-fpl-comp]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          L.compound = btn.getAttribute("data-fpl-comp"); render();
        });
      });
      var send = sec.querySelector("#fpl-send-btn");
      if (send) send.addEventListener("click", function () { startRun(pr); });
      var next = sec.querySelector("#fpl-next-btn");
      if (next) next.addEventListener("click", function () { advanceSession(pr); });
      var qual = sec.querySelector("#fpl-qualif-btn");
      if (qual) qual.addEventListener("click", function () { stopClockTicker(); if (typeof goToQualifStep === "function") goToQualifStep(); });
    }

    // ---- Panneau de réglages (HTML + câblage) ----
    function setupPanelHtml() {
      var params = (typeof getAvailableSetupParams === "function") ? getAvailableSetupParams(G.cat) : [];
      if (!params.length) return '';
      var b = '';
      b += '<div id="fpl-setup-panel" style="margin-bottom:10px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid #A78BFA;border-radius:6px;overflow:hidden">';
      b += '<div id="fpl-setup-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none">';
      b += '<div style="display:flex;align-items:center;gap:8px">';
      b += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
      b += '<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#A78BFA;letter-spacing:.16em;text-transform:uppercase">Réglages voiture</span>';
      b += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.08em">' + params.length + ' param' + (params.length > 1 ? 's' : '') + '</span>';
      b += '</div>';
      b += '<svg id="fpl-setup-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .2s ease;transform:rotate(' + (_setupOpen ? '180' : '0') + 'deg)"><polyline points="6 9 12 15 18 9"/></svg>';
      b += '</div>';
      b += '<div id="fpl-setup-body" style="padding:' + (_setupOpen ? '4px 14px 12px' : '0 14px') + ';max-height:' + (_setupOpen ? '600px' : '0') + ';overflow:hidden;transition:max-height .25s ease,padding .25s ease">';
      params.forEach(function (k, idx) {
        var v = (G.setupAdv && typeof G.setupAdv[k] === "number") ? G.setupAdv[k] : 5;
        var label = PARAM_LABELS[k] || k;
        b += '<div style="padding:7px 0;border-bottom:' + (idx === params.length - 1 ? 'none' : '1px solid var(--border)') + '">';
        b += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">';
        b += '<span style="font-size:12px;color:var(--text2);font-weight:600">' + label + '</span>';
        b += '<span data-fpl-valfor="' + k + '" style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#A78BFA;min-width:18px;text-align:right">' + v + '</span>';
        b += '</div>';
        b += '<div style="display:flex;align-items:center;gap:10px">';
        b += '<span style="font-size:9px;color:var(--dim);font-family:var(--font-display)">0</span>';
        b += '<input type="range" min="0" max="10" step="1" value="' + v + '" data-fpl-param="' + k + '" class="size-slider" style="flex:1;width:100%;cursor:pointer">';
        b += '<span style="font-size:9px;color:var(--dim);font-family:var(--font-display)">10</span>';
        b += '</div></div>';
      });
      b += '</div></div>';
      return b;
    }
    var _setupOpen = true;

    function wireSetupPanel(sec, pr) {
      var panel = sec.querySelector("#fpl-setup-panel");
      if (!panel) return;
      var head = panel.querySelector("#fpl-setup-head");
      var body = panel.querySelector("#fpl-setup-body");
      head.addEventListener("click", function () {
        _setupOpen = !_setupOpen;
        var chev = panel.querySelector("#fpl-setup-chevron");
        if (chev) chev.style.transform = "rotate(" + (_setupOpen ? "180" : "0") + "deg)";
        body.style.maxHeight = _setupOpen ? "600px" : "0";
        body.style.padding = _setupOpen ? "4px 14px 12px" : "0 14px";
      });
      panel.querySelectorAll("input[data-fpl-param]").forEach(function (slider) {
        slider.addEventListener("input", function () {
          var k = slider.getAttribute("data-fpl-param");
          var chip = panel.querySelector('[data-fpl-valfor="' + k + '"]');
          if (chip) chip.textContent = slider.value;
        });
        slider.addEventListener("change", function () {
          var k = slider.getAttribute("data-fpl-param");
          var val = parseInt(slider.value, 10);
          if (typeof setAdvParam === "function") setAdvParam("setup", k, val);
          else { G.setupAdv = G.setupAdv || {}; G.setupAdv[k] = val; }
          // resync (couplages possibles)
          var params = (typeof getAvailableSetupParams === "function") ? getAvailableSetupParams(G.cat) : [];
          params.forEach(function (kk) {
            var vv = (G.setupAdv && typeof G.setupAdv[kk] === "number") ? G.setupAdv[kk] : 5;
            var sl = panel.querySelector('input[data-fpl-param="' + kk + '"]');
            var ch = panel.querySelector('[data-fpl-valfor="' + kk + '"]');
            if (sl && sl !== document.activeElement) sl.value = vv;
            if (ch) ch.textContent = vv;
          });
          if (typeof renderAdvancedSetupUI === "function") { try { renderAdvancedSetupUI(); } catch (e) {} }
        });
      });
    }

    // ========================================================================
    // PISTE (run en cours)
    // ========================================================================
    function renderTrack(sec, pr) {
      var L = pr._live, run = L.run;
      var maxSessions = (typeof getPracticeMaxSessions === "function") ? getPracticeMaxSessions() : 3;
      var circuit = (RACE_STATE.circuitData && RACE_STATE.circuitData.name) || RACE_STATE.circuit || "Circuit";
      var weather = RACE_STATE.weather || { label: "Sec", id: "dry" };
      var col = COMPOUND_COLORS[run.compound] || "#9CA3AF";

      var c = headerHtml(pr, maxSessions);

      // Bloc live
      c += '<div style="background:linear-gradient(135deg,#0a1418 0%,#0d1a20 100%);border:1px solid #1a3540;border-left:3px solid ' + col + ';margin-bottom:10px;overflow:hidden">';
      c += '<div style="padding:10px 14px;background:rgba(34,211,238,.08);border-bottom:1px solid rgba(34,211,238,.18);display:flex;justify-content:space-between;align-items:center">';
      c += '<div style="display:flex;align-items:center;gap:8px"><div id="fpl-dot" style="width:8px;height:8px;background:#F59E0B;border-radius:50%;box-shadow:0 0 8px #F59E0B;animation:practice-pulse .8s ease-in-out infinite"></div>';
      c += '<span id="fpl-phase" style="font-family:var(--font-display);font-size:11px;font-weight:900;color:#F59E0B;letter-spacing:.2em;text-transform:uppercase">En piste</span></div>';
      c += '<span style="font-family:var(--font-display);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">' + esc(circuit) + ' · ' + esc(weather.label) + '</span>';
      c += '</div>';

      // Chrono tour courant
      c += '<div style="padding:16px 14px 6px;text-align:center">';
      c += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.28em;text-transform:uppercase;margin-bottom:6px">Tour en cours <span id="fpl-lapnum" style="color:' + col + '"></span></div>';
      c += '<div id="fpl-chrono" style="font-family:var(--font-display);font-size:34px;font-weight:900;color:var(--dim);line-height:1;letter-spacing:.02em">0:00.000</div>';
      c += '<div style="margin:12px 14px 0;height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;position:relative"><div id="fpl-lap-prog" style="position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,#22D3EE 0%,' + col + ' 100%);transition:width .1s linear"></div></div>';
      c += '<div id="fpl-sectorlbl" style="margin-top:10px;font-family:var(--font-display);font-size:11px;font-weight:800;color:#F59E0B;letter-spacing:.2em;text-transform:uppercase;min-height:14px">Sortie des stands…</div>';
      c += '</div>';

      // Secteurs
      c += '<div data-rj-noround style="padding:6px 12px 10px;display:flex;gap:7px">';
      ["S1", "S2", "S3"].forEach(function (lbl, i) {
        c += '<div class="fpl-sec" data-sec="' + (i + 1) + '" style="flex:1;padding:10px 6px 9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:6px;text-align:center;opacity:.25;transition:all .35s ease">';
        c += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.22em;text-transform:uppercase;margin-bottom:4px">' + lbl + '</div>';
        c += '<div class="fpl-sec-t sector-time" style="font-family:var(--font-display);font-size:15px;font-weight:900;color:var(--dim);line-height:1">—.———</div>';
        c += '</div>';
      });
      c += '</div>';

      // Bandeau pneus + relais
      c += '<div style="padding:8px 14px 12px;border-top:1px solid rgba(255,255,255,.05)">';
      c += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">';
      c += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Type pneu <span style="color:' + col + '">' + esc(compoundProfile(run.compound).label) + '</span></span>';
      c += '<span id="fpl-wear-lbl" style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#34D399">' + Math.round(run.wear) + '%</span>';
      c += '</div>';
      c += '<div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden"><div id="fpl-wear-bar" style="height:100%;width:' + Math.round(run.wear) + '%;background:#34D399;transition:width .25s ease;border-radius:3px"></div></div>';
      c += '<div style="margin-top:6px;font-size:10px;color:var(--muted)">Relais : <span id="fpl-runlaps" style="color:var(--white);font-weight:700">' + run.flyingLaps + '</span>' + (run.plan ? ' / ' + run.plan : '') + ' tour' + (run.plan && run.plan > 1 ? 's' : '') + '</div>';
      c += '</div></div>';

      // Meilleur tour du relais
      c += '<div id="fpl-runbest" style="margin-bottom:10px;padding:8px 14px;background:var(--bg3);border:1px solid var(--line);border-radius:6px;font-size:11px;color:var(--muted);display:' + (run.bestLap ? 'flex' : 'none') + ';justify-content:space-between;align-items:center">';
      c += '<span>Meilleur tour du relais</span><span id="fpl-runbest-t" style="font-family:var(--font-display);font-size:15px;font-weight:900;color:var(--white)">' + (run.bestLap ? fmtLap(run.bestLap) : '—') + '</span>';
      c += '</div>';

      // Feuille de temps (classement live) — visible aussi en piste
      c += timingBoardHtml(pr);

      // Bouton BOX
      c += '<button id="fpl-box-btn" style="width:100%;padding:14px 16px;background:linear-gradient(135deg,var(--red2) 0%,var(--red) 100%);border:none;color:#fff;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:4px">';
      c += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
      c += 'Rentrer au stand (Box)';
      c += '</button>';

      sec.innerHTML = c;
      var box = sec.querySelector("#fpl-box-btn");
      if (box) box.addEventListener("click", function () { run.boxRequested = true; box.style.opacity = ".6"; box.innerHTML = box.innerHTML.replace("Rentrer au stand (Box)", "Retour au stand en fin de tour…"); });
      startClockTicker(pr);
    }

    // ========================================================================
    // BOUCLE DE RELAIS
    // ========================================================================
    function startRun(pr) {
      var L = pr._live;
      var comp = L.compound;
      if (availableCompounds().indexOf(comp) < 0) comp = availableCompounds()[0];
      // Consommer un train
      if (typeof L.stock[comp] === "number" && L.stock[comp] < 99) {
        if (L.stock[comp] <= 0) { if (typeof showToast === "function") showToast("Plus de trains de ce composé."); return; }
        L.stock[comp]--;
      }
      L.run = {
        compound: comp, push: L.push, plan: L.plan,
        wear: 0, flyingLaps: 0, laps: [], bestLap: null, boxRequested: false, phase: "outlap"
      };
      L.onTrack = true;
      render();
      // Lancer le tour de sortie puis enchaîner
      runOutLap(pr);
    }

    function runOutLap(pr) {
      var L = pr._live, run = L.run;
      if (!run) return;
      var sec = document.getElementById("race-practice-section");
      var phase = sec && sec.querySelector("#fpl-phase");
      var dot = sec && sec.querySelector("#fpl-dot");
      var lbl = sec && sec.querySelector("#fpl-sectorlbl");
      if (phase) { phase.textContent = "Tour de sortie"; phase.style.color = "#F59E0B"; }
      if (lbl) { lbl.textContent = "Mise en température…"; lbl.style.color = "#F59E0B"; }
      run.laps.push({ outLap: true, compound: run.compound, lapTime: 0, wearAfter: run.wear });
      run._t0 = Date.now();
      run._anim = setInterval(function () {
        var el = Date.now() - run._t0;
        var prog = sec && sec.querySelector("#fpl-lap-prog");
        if (prog) prog.style.width = Math.min(100, (100 * el / OUTLAP_MS)).toFixed(0) + "%";
        if (clockRemaining(pr) <= 0) { clearInterval(run._anim); finishRun(pr, "time"); }
      }, 60);
      setTimeout(function () {
        clearInterval(run._anim);
        if (clockRemaining(pr) <= 0) { finishRun(pr, "time"); return; }
        runFlyingLap(pr);
      }, OUTLAP_MS);
    }

    function runFlyingLap(pr) {
      var L = pr._live, run = L.run;
      if (!run) return;
      if (clockRemaining(pr) <= 0) { finishRun(pr, "time"); return; }

      // 1) Apprentissage setup via runPracticeTest (on garde le feedback)
      var feedback = {};
      try {
        // Empêcher le plafond + saturer l'apprentissage (évite la dérive infinie)
        var realTests = pr.testsThisSession;
        if (realTests > 5) pr.testsThisSession = 5;
        var res = runPracticeTest();
        pr.testsThisSession = realTests + 1;
        if (pr.tests && pr.tests.length) feedback = pr.tests[pr.tests.length - 1].feedback || {};
      } catch (e) { console.warn("[13] runPracticeTest:", e); }

      // 2) Chrono recalculé (setup + pneus + consigne + bruit)
      var comp = computeFlyingLap(pr, run, feedback);
      var lapTime = comp.lapTime;

      // Synchroniser le test enregistré avec le temps affiché (cohérence best lap)
      if (pr.tests && pr.tests.length) {
        var last = pr.tests[pr.tests.length - 1];
        last.lapTime = lapTime; last.compound = run.compound;
      }

      // Secteurs : proportions de base + variation INDÉPENDANTE par secteur (réalisme F1 :
      // on peut améliorer un secteur sans les autres). On renormalise pour que la somme
      // des trois secteurs égale exactement le temps du tour (cohérence avec le meilleur tour).
      var _baseProp = [0.32, 0.36, 0.32];
      var _rawP = [
        _baseProp[0] * (1 + (Math.random() - 0.5) * 0.07),
        _baseProp[1] * (1 + (Math.random() - 0.5) * 0.07),
        _baseProp[2] * (1 + (Math.random() - 0.5) * 0.07)
      ];
      var _sumP = _rawP[0] + _rawP[1] + _rawP[2];
      var s1 = +(lapTime * _rawP[0] / _sumP).toFixed(3);
      var s2 = +(lapTime * _rawP[1] / _sumP).toFixed(3);
      var s3 = +(lapTime - s1 - s2).toFixed(3);
      var secData = [s1, s2, s3];

      var sec = document.getElementById("race-practice-section");
      var chronoEl = sec && sec.querySelector("#fpl-chrono");
      var progEl = sec && sec.querySelector("#fpl-lap-prog");
      var lblEl = sec && sec.querySelector("#fpl-sectorlbl");
      var phaseEl = sec && sec.querySelector("#fpl-phase");
      var dotEl = sec && sec.querySelector("#fpl-dot");
      var lapnumEl = sec && sec.querySelector("#fpl-lapnum");

      if (phaseEl) { phaseEl.textContent = "Tour lancé"; phaseEl.style.color = "#EF4444"; }
      if (dotEl) { dotEl.style.background = "#EF4444"; dotEl.style.boxShadow = "0 0 8px #EF4444"; }
      if (chronoEl) chronoEl.style.color = "var(--white)";
      if (lapnumEl) lapnumEl.textContent = "#" + (run.flyingLaps + 1);

      // reset secteurs
      if (sec) sec.querySelectorAll(".fpl-sec").forEach(function (el) {
        el.style.opacity = ".25"; el.style.background = "rgba(255,255,255,.025)"; el.style.borderColor = "rgba(255,255,255,.06)"; el.style.boxShadow = "none";
        var tn = el.querySelector(".fpl-sec-t"); if (tn) { tn.textContent = "—.———"; tn.style.color = "var(--dim)"; }
      });

      var t0 = Date.now();
      run._anim = setInterval(function () {
        var el = Date.now() - t0;
        var r = Math.min(1, el / FLYLAP_MS);
        if (chronoEl) chronoEl.textContent = fmtLap(lapTime * r);
        if (progEl) progEl.style.width = (100 * r).toFixed(1) + "%";
        if (lblEl) { lblEl.textContent = r < .34 ? "S1 — en cours" : r < .7 ? "S2 — en cours" : r < 1 ? "S3 — en cours" : "Tour bouclé"; lblEl.style.color = r < 1 ? "#22D3EE" : "var(--muted)"; }
        if (clockRemaining(pr) <= 0 && r < 1) { /* on laisse finir le tour entamé */ }
      }, 33);

      secData.forEach(function (st, idx) {
        setTimeout(function () {
          if (!sec) return;
          var row = sec.querySelector('.fpl-sec[data-sec="' + (idx + 1) + '"]');
          if (!row) return;
          var scol = (function () {
            try {
              var L = (typeof pr !== "undefined" && pr) ? pr._live : null;
              if (!L || st == null) return "#34D399";
              var baseProp = [0.32, 0.36, 0.32];
              // Meilleur temps PERSO de CE secteur, avant ce tour
              var pbSec = (L.secBestPerso && typeof L.secBestPerso[idx] === "number") ? L.secBestPerso[idx] : null;
              // Référence séance pour CE secteur : meilleur tour du peloton réparti au prorata du secteur
              var fb = null;
              if (L.field && L.field.length) L.field.forEach(function (f) { if (f && f.time != null && (fb == null || f.time < fb)) fb = f.time; });
              var fbSec = (fb != null) ? fb * baseProp[idx] : null;
              // Meilleur de la séance sur ce secteur = min(perso, peloton)
              var sessSec = pbSec;
              if (fbSec != null && (sessSec == null || fbSec < sessSec)) sessSec = fbSec;
              if (sessSec != null && st < sessSec - 1e-6) return "#7C3AED"; // violet : meilleur de la séance sur ce secteur
              if (pbSec == null || st < pbSec - 1e-6) return "#34D399";     // vert : meilleur temps perso sur ce secteur
              return "#FBBF24";                                             // jaune : secteur non amélioré
            } catch (e) { return "#34D399"; }
          })();
          row.style.opacity = "1"; row.style.background = scol + "22"; row.style.borderColor = scol; row.style.boxShadow = "0 0 12px " + scol + "33";
          var tn = row.querySelector(".fpl-sec-t"); if (tn) { tn.textContent = st.toFixed(3); tn.style.color = scol; }
        }, FLYLAP_MS * (idx + 1) / 3 * 0.92);
      });

      setTimeout(function () {
        clearInterval(run._anim);
        if (chronoEl) chronoEl.textContent = fmtLap(lapTime);
        if (progEl) progEl.style.width = "100%";

        // Comptabiliser le tour
        run.flyingLaps++;
        run.wear = Math.min(100, run.wear + wearPerLap(run));
        run.laps.push({ outLap: false, compound: run.compound, lapTime: lapTime, wearAfter: run.wear, incident: comp.incident });
        if (run.bestLap == null || lapTime < run.bestLap) { run.bestLap = lapTime; run.bestSectors = secData.slice(); }
        if (L.bestLap == null || lapTime < L.bestLap.lapTime) { L.bestLap = { lapTime: lapTime, compound: run.compound, sectors: secData.slice() }; try { refreshBoard(pr); } catch (e) {} }
        // Meilleurs temps perso par secteur (référence pour le coloriage des tours suivants)
        if (!L.secBestPerso) L.secBestPerso = [null, null, null];
        for (var _si = 0; _si < 3; _si++) {
          if (L.secBestPerso[_si] == null || secData[_si] < L.secBestPerso[_si]) L.secBestPerso[_si] = secData[_si];
        }
        // Connaissance de la voiture : chaque tour bouclé enrichit la connaissance
        try { addKnowledgeForLap(pr); var kb = sec && sec.querySelector("#fpl-know-bar"), kl = sec && sec.querySelector("#fpl-know-lbl"); var kvv = Math.round(pr.carKnowledge), kcc = knowledgeColor(pr.carKnowledge); if (kb) { kb.style.width = kvv + "%"; kb.style.background = kcc; } if (kl) { kl.textContent = kvv + "%"; kl.style.color = kcc; } } catch (e) {}

        // MAJ visuelle pneus / relais / best
        var wlbl = sec && sec.querySelector("#fpl-wear-lbl"), wbar = sec && sec.querySelector("#fpl-wear-bar");
        var wcol = run.wear < 55 ? "#34D399" : run.wear < 80 ? "#F59E0B" : "#EF4444";
        if (wlbl) { wlbl.textContent = Math.round(run.wear) + "%"; wlbl.style.color = wcol; }
        if (wbar) { wbar.style.width = Math.round(run.wear) + "%"; wbar.style.background = wcol; }
        var rl = sec && sec.querySelector("#fpl-runlaps"); if (rl) rl.textContent = run.flyingLaps;
        var rb = sec && sec.querySelector("#fpl-runbest"), rbt = sec && sec.querySelector("#fpl-runbest-t");
        if (rb) rb.style.display = "flex"; if (rbt) rbt.textContent = fmtLap(run.bestLap);
        if (lblEl) {
          if (comp.incident === "lock") { lblEl.textContent = "Petit blocage de roue"; lblEl.style.color = "#EF4444"; }
          else if (comp.incident === "slide") { lblEl.textContent = "La voiture glisse — pneus usés"; lblEl.style.color = "#F59E0B"; }
          else { lblEl.textContent = "Tour bouclé"; lblEl.style.color = "var(--muted)"; }
        }

        // Conditions de fin de relais
        var stop = false, reason = null;
        if (clockRemaining(pr) <= 0) { stop = true; reason = "time"; }
        else if (run.boxRequested) { stop = true; reason = "box"; }
        else if (run.plan && run.flyingLaps >= run.plan) { stop = true; reason = "plan"; }
        else if (run.wear >= 99) { stop = true; reason = "tyres"; }

        if (stop) { setTimeout(function () { finishRun(pr, reason); }, 1200); }
        else { setTimeout(function () { runFlyingLap(pr); }, 1100); }
      }, FLYLAP_MS);
    }

    function finishRun(pr, reason) {
      var L = pr._live, run = L.run;
      if (!run) { render(); return; }
      if (run._anim) { clearInterval(run._anim); run._anim = null; }
      L.onTrack = false;

      // Archiver
      var feedback = (pr.tests && pr.tests.length) ? (pr.tests[pr.tests.length - 1].feedback || {}) : {};
      L.runs.push(run);
      L.run = null;

      // Débrief seulement si le relais a produit des tours lancés
      var hadLaps = run.flyingLaps > 0;
      stopClockTicker();

      if (hadLaps) {
        var deb = engRunDebrief(run, feedback);
        showRunDebrief(pr, run, feedback, deb, reason);
      } else {
        render();
      }
    }

    // ========================================================================
    // MODAL DÉBRIEF DE RELAIS
    // ========================================================================
    function showRunDebrief(pr, run, feedback, deb, reason) {
      var existing = document.getElementById("fpl-debrief");
      if (existing) existing.remove();
      var verdictColors = { excellent: "#34D399", good: "#22D3EE", adjust: "#F59E0B", mixed: "#9CA3AF" };
      var verdictLabels = { excellent: "Setup au point !", good: "Bonne direction", adjust: "Ajustements nécessaires", mixed: "Données insuffisantes" };
      var vc = verdictColors[deb.verdict] || "#9CA3AF";
      var engName = (G.staff && G.staff.engineer && G.staff.engineer.name) || "Ingénieur";
      var col = COMPOUND_COLORS[run.compound] || "#9CA3AF";

      var overlay = document.createElement("div");
      overlay.id = "fpl-debrief";
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9500;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px)";
      var card = document.createElement("div");
      card.style.cssText = "background:var(--bg2);border-top:2px solid " + vc + ";border-left:1px solid var(--line2);border-right:1px solid var(--line2);max-width:440px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 -10px 40px rgba(0,0,0,.7);border-radius:14px 14px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)";

      var h = '';
      // Header
      h += '<div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">';
      h += '<div style="width:36px;height:36px;background:' + vc + '22;border:1px solid ' + vc + '55;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0">';
      h += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + vc + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      h += '</div>';
      h += '<div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:' + vc + ';letter-spacing:.2em;text-transform:uppercase">Débrief relais — ' + esc(engName) + '</div>';
      h += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-top:2px">' + verdictLabels[deb.verdict] + '</div></div>';
      h += '<div style="text-align:right;flex-shrink:0"><div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:var(--white)">' + fmtLap(run.bestLap) + '</div>';
      h += '<div style="font-size:10px;color:' + col + ';font-family:var(--font-display);font-weight:700">' + esc(compoundProfile(run.compound).label) + ' · ' + run.flyingLaps + ' tour' + (run.flyingLaps > 1 ? 's' : '') + '</div></div>';
      h += '</div>';
      // Quote
      h += '<div style="padding:11px 14px;background:var(--bg3);border-bottom:1px solid var(--line);font-style:italic;font-size:13px;color:var(--soft);line-height:1.5;font-family:var(--font-body)">« ' + esc(deb.msg) + ' »</div>';
      // Détail du meilleur tour : secteurs au millième
      if (run.bestSectors && run.bestSectors.length === 3 && run.bestLap) {
        h += '<div data-rj-noround style="padding:11px 14px;border-bottom:1px solid var(--line)">';
        h += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Meilleur tour — détail</div>';
        h += '<div style="display:flex;gap:7px;margin-bottom:8px">';
        ["S1", "S2", "S3"].forEach(function (lbl, i) {
          var scol = (function () {
            try {
              var L = (typeof pr !== "undefined" && pr) ? pr._live : null;
              if (!L) return "#34D399";
              var pb = (L.bestLap && L.bestLap.lapTime != null) ? L.bestLap.lapTime : null; // meilleur tour perso
              var fb = null;
              if (L.field && L.field.length) L.field.forEach(function (f) { if (f && f.time != null && (fb == null || f.time < fb)) fb = f.time; });
              // Le détail affiche le meilleur tour perso : violet s'il est aussi le meilleur de la séance, sinon vert.
              if (pb != null && (fb == null || pb <= fb + 1e-6)) return "#7C3AED";
              return "#34D399";
            } catch (e) { return "#34D399"; }
          })();
          h += '<div style="flex:1;padding:8px 6px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:6px;text-align:center">';
          h += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.2em;margin-bottom:3px">' + lbl + '</div>';
          h += '<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:' + scol + '">' + run.bestSectors[i].toFixed(3) + '</div>';
          h += '</div>';
        });
        h += '</div>';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:2px;border-top:1px solid var(--border)">';
        h += '<span style="font-family:var(--font-display);font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">Tour complet</span>';
        h += '<span style="font-family:var(--font-display);font-size:16px;font-weight:900;color:#fff">' + fmtLap(run.bestLap) + '</span>';
        h += '</div>';
        h += '</div>';
      }
      // Feedback setup
      var fKeys = Object.keys(feedback);
      if (fKeys.length) {
        h += '<div style="padding:10px 14px 6px"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Réglages</div>';
        fKeys.forEach(function (k) {
          var fb = feedback[k];
          var fc = fb.direction === "perfect" ? "#34D399" : fb.direction === "close" ? "#22D3EE" : "#F59E0B";
          var fi = fb.direction === "perfect" ? "✓" : fb.direction === "close" ? "◉" : "▲";
          var desc = (typeof describeFeedback === "function") ? describeFeedback(k, fb) : (PARAM_LABELS[k] || k);
          h += '<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px;color:var(--text);line-height:1.4">';
          h += '<span style="color:' + fc + ';font-weight:900;flex-shrink:0;min-width:14px;font-size:13px">' + fi + '</span><span style="flex:1">' + esc(desc) + '</span></div>';
        });
        h += '</div>';
      }
      // Bouton
      var noTime = clockRemaining(pr) <= OUTLAP_MS + FLYLAP_MS + 500;
      h += '<div style="padding:12px 14px 16px;display:flex;flex-direction:column;gap:8px">';
      if (!noTime) {
        h += '<button id="fpl-debrief-retrack" style="width:100%;padding:14px 16px;background:linear-gradient(135deg,#22D3EE 0%,#0EA5E9 100%);border:none;color:#07151c;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polygon points="5 3 19 12 5 21"/></svg>Repartir en piste</button>';
      }
      h += '<button id="fpl-debrief-close" style="width:100%;padding:13px 16px;background:' + (noTime ? 'linear-gradient(135deg,var(--red2) 0%,var(--red) 100%)' : '#13131c') + ';border:' + (noTime ? 'none' : '1px solid var(--line2)') + ';color:#fff;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:8px">Retour au stand</button>';
      h += '</div>';
      card.innerHTML = h;
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      var _retrack = document.getElementById("fpl-debrief-retrack");
      if (_retrack) _retrack.addEventListener("click", function () { overlay.remove(); startRun(pr); });
      document.getElementById("fpl-debrief-close").addEventListener("click", function () {
        overlay.remove();
        render();
      });
    }

    // ========================================================================
    // SÉANCE TERMINÉE / TRANSITIONS
    // ========================================================================
    function renderAllDone(sec, pr, maxSessions) {
      stopClockTicker();
      var L = pr._live;
      var circuit = (RACE_STATE.circuitData && RACE_STATE.circuitData.name) || RACE_STATE.circuit || "Circuit";
      var weather = RACE_STATE.weather || { label: "Sec", id: "dry" };
      var c = '';
      c += '<div style="background:linear-gradient(135deg,#0a1418 0%,#0d1a20 100%);border:1px solid #1a3540;border-left:3px solid #34D399;margin-bottom:10px;overflow:hidden">';
      c += '<div style="padding:10px 14px;background:rgba(52,211,153,.06);border-bottom:1px solid rgba(52,211,153,.15);display:flex;justify-content:space-between;align-items:center">';
      c += '<div style="display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;background:#34D399;border-radius:50%;box-shadow:0 0 6px #34D399"></div>';
      c += '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#34D399;letter-spacing:.22em;text-transform:uppercase">Essais terminés</span></div>';
      c += '<span style="font-family:var(--font-display);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">' + esc(circuit) + ' · ' + esc(weather.label) + '</span></div>';
      c += '<div style="padding:8px 14px;display:flex;align-items:center;gap:10px"><span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Séances</span><div style="flex:1;display:flex;gap:3px">';
      for (var s = 0; s < maxSessions; s++) c += '<div style="flex:1;height:3px;background:#34D399;border-radius:2px"></div>';
      c += '</div></div></div>';
      var bestLap = (L && L.bestLap) ? L.bestLap : null;
      // si pas de best en live (séance avancée sans live), retomber sur tests
      if (!bestLap && pr.tests && pr.tests.length) {
        var b = null; pr.tests.forEach(function (t) { if (t && typeof t.lapTime === "number" && (b == null || t.lapTime < b.lapTime)) b = { lapTime: t.lapTime, compound: t.compound || "medium" }; });
        bestLap = b;
      }
      if (bestLap) {
        c += '<div style="margin-bottom:10px;padding:14px;background:var(--bg3);border:1px solid var(--line);border-left:3px solid var(--gold)">';
        c += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--gold);letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px">★ Meilleur tour des essais</div>';
        c += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:var(--white)">' + fmtLap(bestLap.lapTime) + '</div>';
        c += '<div style="font-size:10px;color:var(--muted);margin-top:3px">' + esc(compoundProfile(bestLap.compound).label) + '</div></div>';
      }
      c += '<div style="padding:12px 14px;background:var(--green-bg);border:1px solid var(--green);color:var(--green);font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-align:center;margin-bottom:10px;border-radius:4px">✓ Essais libres terminés</div>';
      c += '<button id="fpl-go-qualif" style="width:100%;padding:14px 16px;background:linear-gradient(135deg,var(--red2) 0%,var(--red) 100%);border:none;color:#fff;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:4px">Aller en qualif<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg></button>';
      sec.innerHTML = c;
      var b2 = sec.querySelector("#fpl-go-qualif");
      if (b2) b2.addEventListener("click", function () { if (typeof goToQualifStep === "function") goToQualifStep(); });
    }

    function advanceSession(pr) {
      stopClockTicker();
      if (typeof endPracticeSession === "function") endPracticeSession();
      else { pr.sessionsCompleted = Math.min((typeof getPracticeMaxSessions === "function" ? getPracticeMaxSessions() : 3), pr.sessionsCompleted + 1); pr.testsThisSession = 0; }
      pr._live = null; // forcera une nouvelle séance (chrono + stock neufs)
      render();
      if (typeof renderAdvancedSetupUI === "function") { try { renderAdvancedSetupUI(); } catch (e) {} }
    }

    // ========================================================================
    // TICKER DU CHRONO DE SÉANCE (continu)
    // ========================================================================
    var _clockIv = null;
    var _boardTickN = 0;
    function startClockTicker(pr) {
      stopClockTicker();
      _boardTickN = 0;
      _clockIv = setInterval(function () {
        var L = pr._live;
        if (!L || L.ended) { stopClockTicker(); return; }
        var sec = document.getElementById("race-practice-section");
        // Si l'écran essais n'est plus affiché, on stoppe le ticker (le chrono
        // se fige : on ne pénalise pas le joueur qui change d'onglet).
        var rtEssais = document.getElementById("rt-essais");
        if (!sec || (rtEssais && rtEssais.style.display === "none")) { stopClockTicker(); return; }
        var rem = clockRemaining(pr);
        var pct = rem / L.clockTotal;
        var col = pct > 0.4 ? "#22D3EE" : pct > 0.15 ? "#F59E0B" : "#EF4444";
        var bar = sec.querySelector("#fpl-clock-bar"), lbl = sec.querySelector("#fpl-clock");
        if (bar) { bar.style.width = (100 * pct).toFixed(1) + "%"; bar.style.background = col; }
        if (lbl) {
          var secs = Math.ceil(rem / 1000), mm = Math.floor(secs / 60), ss = secs % 60;
          lbl.textContent = mm + ":" + (ss < 10 ? "0" : "") + ss; lbl.style.color = col;
        }
        // Feuille de temps live : les rivaux dévoilent leurs temps au fil du chrono
        _boardTickN++;
        if (_boardTickN % 3 === 0) { try { refreshBoard(pr); } catch (e) {} }
        if (rem <= 0) {
          L.ended = true; stopClockTicker();
          // Si on n'est pas en piste, terminer la séance
          if (!L.onTrack) {
            if (typeof showToast === "function") showToast("Fin de séance — temps écoulé.");
            advanceSession(pr);
          }
          // Si en piste, finishRun gérera la fin (tour entamé terminé).
        }
      }, 120);
    }
    function stopClockTicker() { if (_clockIv) { clearInterval(_clockIv); _clockIv = null; } }

    // Quand le chrono se fige (changement d'onglet) puis qu'on revient : on
    // "rebase" le départ pour ne pas avoir consommé le temps hors écran.
    var _frozenRemaining = null;

    // ========================================================================
    // OVERRIDES DES POINTS D'ENTRÉE
    // ========================================================================
    // Le chrono de séance ne doit pas continuer à courir pendant qu'on est sur
    // un autre onglet → on gèle/dégèle via wrap de rtab si présent.
    if (typeof window.rtab === "function" && !window._rjFplRtabWrapped) {
      window._rjFplRtabWrapped = true;
      var _origRtab = window.rtab;
      window.rtab = function (tab, force) {
        var pr = (typeof RACE_STATE !== "undefined" && RACE_STATE.practice) ? RACE_STATE.practice : null;
        // Quitter l'onglet essais → geler le chrono
        if (pr && pr._live && tab !== "essais") {
          if (!pr._live.ended && !pr._live._frozen) {
            pr._live._frozen = clockRemaining(pr);
            stopClockTicker();
          }
        }
        var out = _origRtab.apply(this, arguments);
        // Revenir sur essais → dégeler
        if (tab === "essais" && pr && pr._live && typeof pr._live._frozen === "number") {
          pr._live.clockStart = Date.now() - (pr._live.clockTotal - pr._live._frozen);
          pr._live._frozen = undefined;
        }
        return out;
      };
    }

    // getPracticeMaxTests neutralisé (le chrono est désormais le limiteur)
    window.getPracticeMaxTests = function () { return 9999; };

    // 3 séances d'essais pour la plupart des catégories (Karting : 2)
    if (!window._rjFplSessionsPatched) {
      window._rjFplSessionsPatched = true;
      window.getPracticeMaxSessions = function () {
        var c = (typeof G !== "undefined" && G.cat) || "";
        return (c === "Karting Junior" || c === "Karting Senior") ? 2 : 3;
      };
    }

    // Remplacements
    window.renderPracticeSection = function () { try { render(); } catch (e) { console.error("[13] render:", e); } };
    window.doPracticeTest = function () { /* legacy — remplacé par le flux de relais */ var pr = ensureLive(); if (pr && !pr._live.onTrack) startRun(pr); };
    window.doEndPracticeSession = function () { var pr = ensureLive(); if (pr) advanceSession(pr); };

    // Premier rendu si la section est déjà visible
    try {
      var sec = document.getElementById("race-practice-section");
      var rt = document.getElementById("rt-essais");
      if (sec && rt && rt.style.display !== "none" && typeof hasPracticeSystem === "function" && hasPracticeSystem()) {
        render();
      }
    } catch (e) { /* no-op */ }
  }
})();


/* ==================================================================== *
 * Formats de week-end — sprint, séquences de séances
 * (anciennement 18-weekend-formats.js)
 * ==================================================================== */

(function () {
  'use strict';
  var TAG = '[18-weekend-formats]';

  // Types de qualif : "timed" (chrono karting), "single" (1 séance),
  //   "groups" (2 groupes F4), "knockout2" (Q1/Q2), "knockout3" (Q1/Q2/Q3),
  //   "hyperpole" (WEC), "multiround" (IndyCar).
  // Types de course : "heat", "prefinal", "final", "race", "sprint", "feature".
  // Grilles : "quali", "heatResult", "heats", "prefinal", "reverse10",
  //   "reverse12", "partialReverse", "prevResult".
  var WEEKEND_FORMATS = {
    'Karting Junior': {
      practice: 1, quali: 'timed',
      races: [
        { type: 'heat', label: 'Manche 1', grid: 'quali' },
        { type: 'heat', label: 'Manche 2', grid: 'heatResult' },
        { type: 'prefinal', label: 'Préfinale', grid: 'heats' },
        { type: 'final', label: 'Finale', grid: 'prefinal' }
      ],
      pit: { min: 0 }
    },
    'Karting Senior': {
      practice: 1, quali: 'timed',
      races: [
        { type: 'heat', label: 'Manche 1', grid: 'quali' },
        { type: 'heat', label: 'Manche 2', grid: 'heatResult' },
        { type: 'prefinal', label: 'Préfinale', grid: 'heats' },
        { type: 'final', label: 'Finale', grid: 'prefinal' }
      ],
      pit: { min: 0 }
    },
    'Formule 4': {
      practice: 1, quali: 'groups',
      races: [
        { type: 'race', label: 'Course 1', grid: 'quali' },
        { type: 'race', label: 'Course 2', grid: 'quali' },
        { type: 'race', label: 'Course 3', grid: 'partialReverse' }
      ],
      pit: { min: 0 }
    },
    'Formula Regional': {
      practice: 2, quali: 'groups',
      races: [
        { type: 'race', label: 'Course 1', grid: 'quali' },
        { type: 'race', label: 'Course 2', grid: 'partialReverse' }
      ],
      pit: { min: 0 }
    },
    'Formule 3': {
      practice: 1, quali: 'single',
      races: [
        { type: 'sprint', label: 'Course Sprint', grid: 'reverse12' },
        { type: 'feature', label: 'Course Principale', grid: 'quali' }
      ],
      pit: { min: 0 }
    },
    'Formule 2': {
      practice: 1, quali: 'single',
      races: [
        { type: 'sprint', label: 'Course Sprint', grid: 'reverse10' },
        { type: 'feature', label: 'Course Principale', grid: 'quali', pit: { min: 1, compounds: 2 } }
      ],
      pit: { min: 0 }
    },
    'Formule 1': {
      practice: 3, quali: 'knockout3',
      races: [
        { type: 'feature', label: 'Grand Prix', grid: 'quali', pit: { min: 1, compounds: 2 } }
      ],
      pit: { min: 1, compounds: 2 },
      sprintWeekend: true   // certains week-ends passent en format Sprint (Phase 2)
    },
    'Super Formula': {
      practice: 2, quali: 'knockout2',
      races: [
        { type: 'feature', label: 'Course', grid: 'quali', pit: { min: 1, compounds: 2 } }
      ],
      pit: { min: 1, compounds: 2 }
    },
    'Endurance WEC': {
      practice: 3, quali: 'hyperpole',
      races: [
        { type: 'feature', label: 'Course', grid: 'quali', endurance: true }
      ],
      pit: { min: 3 }
    },
    'IndyCar': {
      practice: 2, quali: 'multiround',
      races: [
        { type: 'feature', label: 'Course', grid: 'quali' }
      ],
      pit: { min: 1 }
    }
  };

  var DEFAULT_FORMAT = {
    practice: 2, quali: 'single',
    races: [{ type: 'race', label: 'Course', grid: 'quali' }],
    pit: { min: 0 }
  };

  function fn(name) { return typeof window[name] === 'function'; }
  function curCat() { return (typeof window !== 'undefined' && window.G && window.G.cat) ? window.G.cat : null; }

  function getWeekendFormat(cat) {
    cat = cat || curCat();
    return (cat && WEEKEND_FORMATS[cat]) ? WEEKEND_FORMATS[cat] : DEFAULT_FORMAT;
  }

  // Séquence ordonnée des séances pour piloter onglets + état (Phase 2+).
  function getSessionSequence(cat) {
    var f = getWeekendFormat(cat);
    var seq = ['prep'];
    if (f.practice > 0) seq.push('essais');
    seq.push('qualif', 'strat');
    f.races.forEach(function (r, i) { seq.push({ phase: 'race', index: i, def: r }); });
    seq.push('res');
    return seq;
  }

  function weekendRaceDefs(cat) { return getWeekendFormat(cat).races.slice(); }
  function weekendHasSprint(cat) { return getWeekendFormat(cat).races.some(function (r) { return r.type === 'sprint'; }); }
  function weekendRaceCount(cat) { return getWeekendFormat(cat).races.length; }

  /* ----------------------------------------------------------------------- *
   *  Branchement Phase 1 : nombre de séances d'essais fidèle
   * ----------------------------------------------------------------------- */
  function installPracticeCount() {
    if (!fn('getPracticeMaxSessions') || window.getPracticeMaxSessions._wf18) return false;
    var orig = window.getPracticeMaxSessions;
    window.getPracticeMaxSessions = function () {
      try {
        var f = getWeekendFormat(curCat());
        if (f && typeof f.practice === 'number') return f.practice;
      } catch (e) { /* no-op */ }
      return orig.apply(this, arguments);
    };
    window.getPracticeMaxSessions._wf18 = true;
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    // expose pour les phases suivantes (toujours, même avant que G existe)
    window.WEEKEND_FORMATS = WEEKEND_FORMATS;
    window.getWeekendFormat = getWeekendFormat;
    window.getSessionSequence = getSessionSequence;
    window.weekendRaceDefs = weekendRaceDefs;
    window.weekendHasSprint = weekendHasSprint;
    window.weekendRaceCount = weekendRaceCount;

    if (fn('getPracticeMaxSessions')) {
      // NB : getPracticeMaxSessions contrôle le nombre de RUNS jouables dans la
      // séance d'essais live (module 13), pas le nombre de séances du format.
      // On NE le wrappe donc PAS : le brancher sur format.practice (ex. 1 en
      // karting) limitait le joueur à un seul run et terminait les essais
      // instantanément. Le nombre de séances du format est géré séparément.
      window.rjDebugWeekendFormat = function () {
        var c = curCat();
        console.log(TAG, c, '→', getWeekendFormat(c), '| essais:', (fn('getPracticeMaxSessions') ? window.getPracticeMaxSessions() : '?'));
      };
      console.log(TAG, 'activé — formats de week-end par catégorie (Phase 1 : séances d\u2019essais). Debug: rjDebugWeekendFormat()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — getPracticeMaxSessions introuvable.');
  }

  boot(50);
})();


/* ==================================================================== *
 * Week-ends à plusieurs manches
 * (anciennement 20-weekend-races.js)
 * ==================================================================== */

(function () {
  'use strict';
  var TAG = '[20-weekend-races]';

  // ---------------------------------------------------------------------------
  // INTERRUPTEUR — courses multiples par week-end.
  //   false → UNE seule course par week-end : la course se termine toujours
  //           normalement (clôture native du moteur). Solution sûre contre le
  //           bug "course qui se relance à l'infini au dernier tour" reproduit
  //           sur iOS. Le Karting n'a alors qu'une course au lieu de 4 manches.
  //   true  → enchaînement complet des manches (Karting : Manche 1→2→Préfinale
  //           →Finale). À ne réactiver qu'une fois le bug iOS élucidé.
  // Réglable aussi à chaud depuis la console : window.RJ_WEEKEND_MULTI_RACE = true
  // ---------------------------------------------------------------------------
  var MULTI_RACE = (typeof window !== 'undefined' && typeof window.RJ_WEEKEND_MULTI_RACE === 'boolean')
    ? window.RJ_WEEKEND_MULTI_RACE : false;

  var seq = null;          // séquence du week-end en cours : {key,idx,total,defs,lastPos}
  var pendingRelaunch = false; // une relance de manche est déjà programmée
  var weekendRaceCount = 0;    // filet anti-infini : nb de courses lancées ce week-end
  // Détection nouveau week-end vs relance de manche — DÉTERMINISTE (ne dépend
  // d'aucun timing, contrairement aux versions précédentes par booléen ou
  // horodatage, fragiles sur WebKit/iOS et cause de "même manche à l'infini").
  // La séquence est ancrée à une CLÉ de week-end (circuit + saison + semaine) :
  // pendant les 4 manches, la clôture de semaine est neutralisée donc la clé
  // reste STABLE → seq est conservée et idx progresse jusqu'à la finale. Elle ne
  // se réinitialise que si la clé change réellement (autre week-end). L'infini
  // "même manche" devient ainsi structurellement impossible.

  function fn(name) { return typeof window[name] === 'function'; }
  function G_() { return (typeof window !== 'undefined' && window.G) ? window.G : null; }

  function weekendKey() {
    var c = (typeof RACE_STATE !== 'undefined' && RACE_STATE && RACE_STATE.circuit) ? RACE_STATE.circuit : '';
    var G = G_();
    var s = (G && typeof G.saison === 'number') ? G.saison : 0;
    var w = (G && typeof G.semaine === 'number') ? G.semaine : 0;
    return c + '#' + s + '#' + w;
  }

  function raceDefs() {
    var G = G_();
    if (fn('weekendRaceDefs')) { try { return window.weekendRaceDefs(G && G.cat); } catch (e) { /* no-op */ } }
    return [{ type: 'race', label: 'Course', grid: 'quali' }];
  }

  function ensureSeq() {
    if (seq) return seq;
    var defs = raceDefs();
    seq = { key: weekendKey(), idx: 0, total: defs.length, defs: defs, lastPos: null };
    if (defs.length > 1) console.log(TAG, 'week-end ' + defs.length + ' courses :', defs.map(function (d) { return d.label; }).join(' → '));
    return seq;
  }

  // Position de départ de la manche suivante selon le type de grille.
  function gridStartPos(def, lastPos) {
    var G = G_();
    var fieldSize = (G && G.rivals ? G.rivals.length + 1 : 20);
    var g = def.grid || 'quali';
    if (g === 'quali') return (typeof RACE_STATE !== 'undefined' && RACE_STATE.qualiPos) ? RACE_STATE.qualiPos : (G && G.qualiPos) || 5;
    if (lastPos == null) lastPos = (typeof RACE_STATE !== 'undefined' && RACE_STATE.qualiPos) ? RACE_STATE.qualiPos : 5;
    if (/reverse(\d+)/.test(g)) {
      var n = parseInt(g.match(/reverse(\d+)/)[1], 10) || 10;     // top N inversés
      return (lastPos <= n) ? (n + 1 - lastPos) : lastPos;
    }
    if (g === 'partialReverse') {                                  // F4 course 3 : top 8 inversés
      var n2 = 8;
      return (lastPos <= n2) ? (n2 + 1 - lastPos) : lastPos;
    }
    // heatResult / heats / prefinal / prevResult → grille = arrivée précédente
    return Math.max(1, Math.min(fieldSize, lastPos));
  }

  function relaunchNext() {
    if (pendingRelaunch) return;   // une relance est déjà programmée (anti-doublon)
    try {
      var def = seq.defs[seq.idx];
      var start = gridStartPos(def, seq.lastPos);
      if (typeof RACE_STATE !== 'undefined') RACE_STATE.qualiPos = start;
      var G = G_(); if (G) G.qualiPos = start;
      // Réinitialise les drapeaux du week-end pour autoriser une nouvelle course.
      if (typeof RACE_WEEKEND_STATE !== 'undefined') { RACE_WEEKEND_STATE.courseDone = false; }
      pendingRelaunch = true;
      // La clé de week-end est inchangée (clôture neutralisée) → la séquence sera
      // conservée au prochain runRaceLive, qui enchaîne sur la manche suivante.
      setTimeout(function () {
        pendingRelaunch = false;
        try { window.runRaceLive(); }
        catch (e) { console.warn(TAG, 'relance:', e); }
      }, 60);
    } catch (e) { console.warn(TAG, 'relaunchNext:', e); }
  }

  function renameLast(def) {
    try {
      var G = G_();
      if (G && G.races && G.races.length && def && def.label) {
        G.races[G.races.length - 1].nom = def.label;
      }
    } catch (e) { /* no-op */ }
  }

  function install() {
    if (!fn('showResult') || !fn('runRaceLive')) return false;
    // Garde anti-double-wrap STABLE : un flag global qui survit aux re-wraps
    // d'autres modules (ex. 04j re-wrappe runRaceLive/showResult ~200ms après le
    // chargement, ce qui efface la propriété _td20 et poussait l'ancien garde à
    // ré-installer 20 PAR-DESSUS → double comptage de weekendRaceCount et clôture
    // prématurée). Avec ce flag, 20 ne s'installe qu'une fois ; comme les wraps de
    // 04j appellent la chaîne d'origine, l'orchestration de 20 reste active.
    if (window._rj20Installed) return false;
    window._rj20Installed = true;

    // MODE COURSE UNIQUE : on n'installe AUCUN wrap de relance. showResult et
    // runRaceLive restent ceux du moteur → la course finalise et clôture le
    // week-end normalement, sans jamais se relancer. Garantit qu'elle se termine.
    if (!MULTI_RACE) {
      console.log(TAG, 'v15 — mode UNE COURSE par week-end (relance multi-manches désactivée)');
      installPracticeReset();
      return true;
    }
    console.log(TAG, 'v15 — mode MULTI-MANCHES actif');

    // --- wrap runRaceLive : un nouveau week-end (clé différente) démarre une séquence ---
    var origRun = window.runRaceLive;
    /* Comptage des manches du week-end : un simple relevé au départ, qui
       s'inscrit au registre plutôt que d'entourer le lancement.
       Si la séquence n'appartient pas au week-end courant (clé changée ou
       absente), c'est un nouveau week-end et l'on repart à zéro ; sinon
       c'est une relance de manche du même week-end et la séquence
       progresse. */
    if (!Array.isArray(window.RJ_RACE_START_HOOKS)) window.RJ_RACE_START_HOOKS = [];
    window.RJ_RACE_START_HOOKS.push({
      id: "20-weekend-races",
      avant: function () {
        var key = weekendKey();
        if (!seq || seq.key !== key) { seq = null; weekendRaceCount = 0; }
        weekendRaceCount++;
      }
    });

    // --- wrap showResult : orchestration de la séquence ---
    var origSR = window.showResult;
    window.showResult = function () {
      // IDEMPOTENCE : une seule orchestration par course. finalizeLiveRace peut
      // être déclenché plusieurs fois pour une même course (watchdog 04j,
      // fallback rjGuardedFinalize, double tick). Sans ce verrou, chaque appel
      // relançait la séquence et la 2ᵉ relance était prise pour un lancement
      // MANUEL → seq réinitialisée → le week-end recommençait à l'infini
      // (écran noir + événements en boucle). Le verrou est porté par l'instance
      // LIVE_RACE, recréée à chaque runRaceLive → naturellement par-course.
      try {
        if (typeof LIVE_RACE !== 'undefined' && LIVE_RACE) {
          if (LIVE_RACE._td20Resulted) return null; // résultat déjà traité
          LIVE_RACE._td20Resulted = true;
        }
      } catch (e) { /* no-op */ }

      var G = G_();
      var s = ensureSeq();
      var def = s.defs[s.idx];
      // GARDE ANTI-INFINI : on ne lance jamais plus de courses que de manches
      // prévues. Même si seq dérive (idx figé), weekendRaceCount, lui, compte les
      // courses réellement lancées et force la clôture au-delà du total.
      var isLast = (s.idx >= s.total - 1) || (weekendRaceCount >= s.total);

      if (isLast || s.total <= 1) {
        // Dernière course (ou catégorie mono-course) : clôture normale.
        var r = origSR.apply(this, arguments);
        renameLast(def);
        seq = null;                       // prêt pour le prochain week-end
        weekendRaceCount = 0;
        return r;
      }

      // Course intermédiaire : on neutralise la clôture de semaine.
      var savedSemaine = (G && typeof G.semaine === 'number') ? G.semaine : null;
      var origTicks = window.runWeeklyTicks;
      window.runWeeklyTicks = function () { /* différé jusqu'à la dernière course */ };
      try {
        origSR.apply(this, arguments);    // calcule pos/pts + push G.races (clôture neutralisée)
      } finally {
        window.runWeeklyTicks = origTicks;
        if (savedSemaine != null && G) G.semaine = savedSemaine;  // annule l'avancement de semaine
      }

      // Enregistre le résultat de la manche et enchaîne.
      try {
        var rec = (G && G.races && G.races.length) ? G.races[G.races.length - 1] : null;
        if (rec) { rec.nom = (def && def.label) || rec.nom; s.lastPos = rec.pos; }
      } catch (e) { /* no-op */ }
      s.idx++;
      relaunchNext();
      return null;
    };
    window.showResult._td20 = true;

    installPracticeReset();
    return true;
  }

  // --- wrap initRaceState : réinitialiser les ESSAIS à chaque nouveau week-end ---
  // Bug : initRaceState (03) restaure RACE_STATE.practice du week-end précédent
  // dès que sessionsCompleted != 0 (condition `!_prevPractice.sessionsCompleted`).
  // Résultat : en arrivant sur un nouveau week-end, les essais s'affichent comme
  // « terminés » (bouton « Aller en qualif »). On tamponne la pratique avec une
  // clé de week-end (circuit + manche) et on repart à neuf si elle appartient à
  // un autre week-end ; une séance en cours sur le MÊME week-end est conservée.
  // Inoffensif et utile dans les deux modes (course unique ou multi-manches).
  function installPracticeReset() {
    if (fn('initRaceState') && !window.initRaceState._rjPracReset) {
      var origIRS = window.initRaceState;
      window.initRaceState = function () {
        var r = origIRS.apply(this, arguments);
        try {
          if (fn('hasPracticeSystem') && window.hasPracticeSystem()) {
            var G = G_(), rs = window.RACE_STATE;
            if (rs) {
              var key = (rs.circuit || '') + '#' + ((G && G.races && G.races.length) || 0);
              var pr = rs.practice;
              if (pr && pr._wknd && pr._wknd !== key && fn('initPracticeState')) {
                window.initPracticeState();        // essais d'un autre week-end → frais
                pr = rs.practice;
              }
              if (pr && !pr._wknd) pr._wknd = key;  // tampon du week-end courant
            }
          }
        } catch (e) { /* no-op */ }
        return r;
      };
      window.initRaceState._rjPracReset = true;
    }
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (fn('showResult') && fn('runRaceLive')) {
      install();
      setTimeout(install, 1500);
      window.rjDebugWeekendRaces = function () {
        console.log(TAG, 'mode:', MULTI_RACE ? 'multi-manches' : 'course unique', '| séquence:', seq, '| defs:', raceDefs().map(function (d) { return d.label; }));
      };
      console.log(TAG, 'activé (' + (MULTI_RACE ? 'multi-manches' : 'course unique') + '). Debug: rjDebugWeekendRaces()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — showResult/runRaceLive introuvables.');
  }

  boot(50);
})();


/* ==================================================================== *
 * Calendrier du week-end
 * (anciennement 24-weekend-calendar.js)
 * ==================================================================== */

(function () {
  'use strict';
  var TAG = '[24-weekend-calendar]';

  // Durée réaliste du week-end (nombre de jours, course incluse) par catégorie.
  var WEEKEND_DAYS = {
    'Karting Junior': 2,
    'Karting Senior': 2,
    'Formule 4': 3,
    'Formula Regional': 3,
    'Formule 3': 3,
    'Formule 2': 3,
    'Formule 1': 3,
    'Super Formula': 2,
    'Endurance WEC': 3,
    'IndyCar': 2
  };

  var MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  var MONTHS_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  var WD_HEAD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var WD_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']; // 0 = lundi
  var DPM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var EV_COLOR = { media: '#60A5FA', sponsors: '#F0A020', relations: '#F472B6', team: '#34D399', rivalry: '#EF4444', commerce: '#A78BFA', crisis: '#F59E0B', training: '#22D3EE' };
  var EV_LABEL = { media: 'Médias', sponsors: 'Sponsor', relations: 'Perso', team: 'Écurie', rivalry: 'Rival', commerce: 'Commerce', crisis: 'Crise', training: 'Entraîn.' };

  function clampDoy(d) { return Math.min(365, Math.max(1, d)); }
  // jour de l'année (1..365) → { m: mois 0..11, d: jour 1..31 }
  function f(doy) { var t = 0, e = doy; while (t < 11 && e > DPM[t]) { e -= DPM[t]; t++; } return { m: t, d: e }; }
  // jour de l'année → index jour de semaine (0 = lundi … 6 = dimanche). 1er janv = jeudi.
  function wd(doy) { return (doy - 1 + 3) % 7; }
  function firstDoyOfMonth(m) { var e = 1; for (var t = 0; t < m; t++) e += DPM[t]; return e; }

  // Course : dimanche de la semaine (7×week tombe un mercredi → +4 = dimanche).
  function raceEndDoy(week) { return clampDoy(7 * week + 4); }
  // Événement : décalé de quelques jours avant (logique d'origine conservée).
  function eventDoy(week) { var off = [5, 3, 1][week % 3]; return clampDoy(7 * week - off); }

  function curCat() { return (window.G && window.G.cat) ? window.G.cat : null; }

  function weekendDays(cat, raceName) {
    var n = WEEKEND_DAYS[cat] || 2;
    if (cat === 'Endurance WEC' && /le mans/i.test(raceName || '')) n = 4;
    if (cat === 'IndyCar' && /indianapolis 500|indy 500/i.test(raceName || '')) n = 3;
    return n;
  }

  function gYearSafe() { try { return (typeof window.gYear === 'function') ? window.gYear() : ''; } catch (e) { return ''; } }

  function enhancedRenderCal() {
    var G = window.G;
    if (!G) return;
    if (!window.CAL_RACES || !window.CAL_RACES.length) { try { window.buildCalendar(); } catch (e) {} }
    if (!G._scheduledEvents) { try { window.scheduleSeasonEvents(); } catch (e) {} }

    var sub = document.getElementById('cal-sub');
    if (sub) sub.textContent = G.cat + ' — ' + gYearSafe();

    var cat = G.cat;
    var N = weekendDays(cat);

    // --- Construction des « moments » par mois -----------------------------
    var byMonth = {}; for (var z = 0; z < 12; z++) byMonth[z] = [];
    var raceEndMap = {};   // doy -> raceMoment (jour de course)
    var raceLeadMap = {};  // doy -> raceMoment (jour d'avant week-end)
    var eventMap = {};     // doy -> eventMoment

    (window.CAL_RACES || []).forEach(function (r) {
      var nDays = weekendDays(cat, r.name);
      var end = raceEndDoy(r.week);
      var start = clampDoy(end - (nDays - 1));
      var ei = f(end), si = f(start);
      var mom = {
        kind: 'race', week: r.week, data: r, label: r.name, done: r.done,
        endDoy: end, startDoy: start, endInfo: ei, startInfo: si, nDays: nDays,
        manche: r.manche, isSprint: r.isSprint
      };
      byMonth[ei.m].push(mom);
      raceEndMap[end] = mom;
      for (var dd = start; dd < end; dd++) { if (!raceEndMap[dd]) raceLeadMap[dd] = mom; }
    });

    (G._scheduledEvents || []).forEach(function (se) {
      if (se.saison !== G.saison || !se.announced) return;
      var def = (window.SCHEDULED_EVENTS || []).find(function (x) { return x.id === se.eventId; });
      if (!def) return;
      var doy = eventDoy(se.week), info = f(doy);
      var ec = def.cat || 'media';
      var title = EV_LABEL[ec] || 'Événement';
      try {
        if (typeof def.gen === 'function') {
          var ctx = { rep: G.reputation || 0, cat: G.cat, budget: G.budget, saison: G.saison, semaine: G.semaine, age: G.age };
          var out = def.gen(ctx);
          if (out && out.title) title = out.title;
        }
      } catch (e) {}
      var mom = {
        kind: 'event', week: se.week, data: se, label: title,
        color: EV_COLOR[ec] || '#60A5FA', cat: ec, catLabel: EV_LABEL[ec] || 'Événement',
        done: se.resolved, doy: doy, info: info
      };
      byMonth[info.m].push(mom);
      if (!eventMap[doy]) eventMap[doy] = mom;
    });

    for (var k in byMonth) byMonth[k].sort(function (a, b) {
      var da = a.kind === 'race' ? a.endDoy : a.doy, db = b.kind === 'race' ? b.endDoy : b.doy;
      return da - db;
    });

    // --- Mois affiché (semaine courante) -----------------------------------
    var todayDoy = clampDoy(7 * G.semaine + 4);
    var y = f(todayDoy).m;
    var container = document.getElementById('cal-main-container');
    if (!container) return;

    var A = '';
    var monthMoments = byMonth[y] || [];
    var nbDaysMonth = DPM[y];

    A += '<div class="cal-current-month">';
    A += '<div class="cal-current-head">';
    A += '<div class="cal-current-title">' + MONTHS_FULL[y] + '</div>';
    A += '<div class="cal-current-year">' + gYearSafe() + '</div>';
    A += '</div>';
    A += '<div class="cal-current-grid-wrap">';
    A += '<div class="cal-weekdays">';
    WD_HEAD.forEach(function (w) { A += '<div class="cal-weekday">' + w + '</div>'; });
    A += '</div>';

    var firstDoy = firstDoyOfMonth(y);
    var lead = wd(firstDoy); // colonnes vides avant le 1er
    A += '<div class="cal-grid">';
    for (var i = 0; i < lead; i++) A += '<div class="cal-cell empty"></div>';

    var todayInfo = f(todayDoy);
    var curDay = (todayInfo.m === y) ? todayInfo.d : -1;

    for (var P = 1; P <= nbDaysMonth; P++) {
      var doy = firstDoy + P - 1;
      var cls = ['cal-cell'];
      var styleAttr = '';
      var band = '';
      if (raceEndMap[doy]) {
        cls.push('has-moment', 'has-race');
        band = '<div class="cal-cell-band" style="background:var(--red2)"></div>';
      } else if (eventMap[doy]) {
        cls.push('has-moment', 'has-event');
        styleAttr = ' style="--moment-color:' + eventMap[doy].color + '"';
        band = '<div class="cal-cell-band" style="background:' + eventMap[doy].color + '"></div>';
      } else if (raceLeadMap[doy]) {
        cls.push('has-moment', 'rj-wk-lead');
        band = '<div class="cal-cell-band rj-wk-band" style="background:var(--red2);opacity:.34"></div>';
      }
      if (curDay > 0 && P === curDay) cls.push('current-day');
      A += '<div class="' + cls.join(' ') + '"' + styleAttr + '>';
      A += '<span class="cal-cell-day">' + P + '</span>';
      A += band;
      A += '</div>';
    }
    A += '</div>'; // .cal-grid
    A += '</div>'; // .cal-current-grid-wrap

    // --- Liste « ce mois-ci » ----------------------------------------------
    if (monthMoments.length > 0) {
      A += '<div class="cal-current-events">';
      monthMoments.forEach(function (m) {
        var dim = m.done ? 'opacity:.45' : '';
        if (m.kind === 'race') {
          var dateTxt = raceDateRange(m);
          var typeTxt = m.nDays > 1 ? 'Week-end' : 'Course';
          var pre = 'M' + m.manche + ' · ';
          A += '<div class="cal-event-tag" style="color:var(--red2);' + dim + '">';
          A += '<div class="cal-event-tag-date">' + dateTxt + '</div>';
          A += '<div class="cal-event-tag-type">' + typeTxt + '</div>';
          A += '<div class="cal-event-tag-title" style="color:var(--text)">' + pre + m.label + '</div>';
          A += '</div>';
        } else {
          var d2 = MONTHS_ABBR[y] + ' ' + m.info.d;
          A += '<div class="cal-event-tag" style="color:' + m.color + ';' + dim + '">';
          A += '<div class="cal-event-tag-date">' + d2 + '</div>';
          A += '<div class="cal-event-tag-type">' + m.catLabel + '</div>';
          A += '<div class="cal-event-tag-title" style="color:var(--text)">' + m.label + '</div>';
          A += '</div>';
        }
      });
      A += '</div>';
    } else {
      A += '<div style="padding:12px 14px 14px;text-align:center;font-size:12px;color:var(--muted);font-style:italic">Aucun moment programmé ce mois-ci.</div>';
    }
    A += '</div>'; // .cal-current-month

    // --- Saison complète ----------------------------------------------------
    A += '<div class="cal-other-months-title">Saison complète</div>';
    for (var j = 0; j < 12; j++) {
      if (j === y) continue;
      var arr = byMonth[j];
      if (!arr || !arr.length) continue;
      var nbR = arr.filter(function (m) { return m.kind === 'race'; }).length;
      var nbE = arr.filter(function (m) { return m.kind === 'event'; }).length;
      A += '<div class="cal-other-month">';
      A += '<div class="cal-other-month-head">';
      A += '<div class="cal-other-month-name">' + MONTHS_FULL[j] + '</div>';
      A += '<div class="cal-other-month-counts">' + (nbR > 0 ? nbR + ' course' + (nbR > 1 ? 's' : '') : '') + (nbR > 0 && nbE > 0 ? ' · ' : '') + (nbE > 0 ? nbE + ' évén.' : '') + '</div>';
      A += '</div>';
      A += '<div class="cal-other-events">';
      arr.forEach(function (m) {
        if (m.kind === 'race') {
          A += '<div class="cal-mini-event">';
          A += '<div class="cal-mini-event-dot" style="background:var(--red2)"></div>';
          A += '<div class="cal-mini-event-date">' + raceMiniRange(m) + '</div>';
          A += '<div class="cal-mini-event-title">' + m.label + '</div>';
          A += '</div>';
        } else {
          A += '<div class="cal-mini-event">';
          A += '<div class="cal-mini-event-dot" style="background:' + m.color + '"></div>';
          A += '<div class="cal-mini-event-date">' + m.info.d + ' ' + MONTHS_ABBR[j] + '</div>';
          A += '<div class="cal-mini-event-title">' + m.label + '</div>';
          A += '</div>';
        }
      });
      A += '</div>';
      A += '</div>';
    }

    container.innerHTML = A;
  }

  // « Ven 12 → Dim 14 Mai » (ou avec mois aux deux bouts si à cheval).
  function raceDateRange(m) {
    var s = m.startInfo, e = m.endInfo;
    if (m.nDays <= 1) return WD_SHORT[wd(m.endDoy)] + ' ' + e.d + ' ' + MONTHS_ABBR[e.m];
    if (s.m === e.m) {
      return WD_SHORT[wd(m.startDoy)] + ' ' + s.d + ' → ' + WD_SHORT[wd(m.endDoy)] + ' ' + e.d + ' ' + MONTHS_ABBR[e.m];
    }
    return WD_SHORT[wd(m.startDoy)] + ' ' + s.d + ' ' + MONTHS_ABBR[s.m] + ' → ' + WD_SHORT[wd(m.endDoy)] + ' ' + e.d + ' ' + MONTHS_ABBR[e.m];
  }
  // « 12–14 Mai » (ou « 30 Avr–2 Mai » si à cheval).
  function raceMiniRange(m) {
    var s = m.startInfo, e = m.endInfo;
    if (m.nDays <= 1) return e.d + ' ' + MONTHS_ABBR[e.m];
    if (s.m === e.m) return s.d + '–' + e.d + ' ' + MONTHS_ABBR[e.m];
    return s.d + ' ' + MONTHS_ABBR[s.m] + '–' + e.d + ' ' + MONTHS_ABBR[e.m];
  }

  function injectCss() {
    if (document.getElementById('rj-wk-cal-css')) return;
    var st = document.createElement('style');
    st.id = 'rj-wk-cal-css';
    st.textContent =
      '.cal-cell.rj-wk-lead .cal-cell-day{opacity:.85}' +
      '.cal-cell.rj-wk-lead .rj-wk-band{height:3px}';
    document.head.appendChild(st);
  }

  function install() {
    if (typeof window.renderCal !== 'function') return false;
    if (window.renderCal._wk24) return true;
    window._origRenderCal = window.renderCal;
    window.renderCal = function () {
      try { injectCss(); enhancedRenderCal(); }
      catch (err) {
        console.error(TAG, 'fallback original renderCal:', err && err.message);
        try { return window._origRenderCal.apply(this, arguments); } catch (e2) {}
      }
    };
    window.renderCal._wk24 = true;
    window.rjDebugWeekendCal = function () {
      var c = curCat();
      console.log(TAG, c, '→ week-end de', weekendDays(c), 'jours · course = dimanche (7×week+4)');
    };
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (install()) {
      console.log(TAG, 'activé — week-ends multi-jours dans le calendrier (course = dimanche). Debug: rjDebugWeekendCal()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — renderCal introuvable.');
  }

  boot(50);
})();


/* ==================================================================== *
 * Qualifications — nomenclature des sessions, secteurs
 * (anciennement 46-fp-qualif-shortcut.js)
 * ==================================================================== */

(function () {
  "use strict";

  var BTN_ID = "fpl-perfect-qualif";
  var PERFECT = "\u2713"; // ✓

  function allPerfect(overlay) {
    var icons = overlay.querySelectorAll('span[style*="min-width:14px"]');
    if (!icons.length) return false;
    for (var i = 0; i < icons.length; i++) {
      if ((icons[i].textContent || "").trim() !== PERFECT) return false;
    }
    return true;
  }

  function goQualif() {
    var fn = (typeof window.goToQualifStep === "function") ? window.goToQualifStep
           : (typeof goToQualifStep === "function") ? goToQualifStep : null;
    if (fn) { try { fn(); } catch (e) { console.warn("[46] goToQualifStep:", e); } }
  }

  function enhance(overlay) {
    if (!overlay || overlay.querySelector("#" + BTN_ID)) return;
    var closeBtn = overlay.querySelector("#fpl-debrief-close");
    if (!closeBtn || !closeBtn.parentNode) return;
    if (!allPerfect(overlay)) return;

    var box = closeBtn.parentNode;
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.style.cssText = [
      "width:100%", "padding:14px 16px",
      "background:linear-gradient(135deg,var(--red2) 0%,var(--red) 100%)",
      "border:none", "color:#fff", "font-family:var(--font-display)",
      "font-size:13px", "font-weight:900", "letter-spacing:.14em",
      "text-transform:uppercase", "cursor:pointer",
      "-webkit-tap-highlight-color:transparent", "border-radius:8px",
      "display:flex", "align-items:center", "justify-content:center", "gap:8px"
    ].join(";");
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>' +
      'Acc\u00E9der aux qualifs';

    btn.addEventListener("click", function () {
      var ov = document.getElementById("fpl-debrief");
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      goQualif();
    });

    box.insertBefore(btn, box.firstChild); // tout en haut des boutons
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.id === "fpl-debrief") { enhance(node); return; }
    if (node.querySelector) {
      var ov = node.querySelector("#fpl-debrief");
      if (ov) enhance(ov);
    }
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var ad = muts[i].addedNodes;
      for (var j = 0; j < ad.length; j++) scan(ad[j]);
    }
  });


  /* ===================================================================
   * NOMENCLATURE DES SESSIONS DE QUALIFICATION
   *
   * Le moteur connaît déjà le format de chaque catégorie
   * (_qualiFormatForCat : maxSessions, singleSession, durée), mais l'en-tête
   * du classement était écrit pour la seule Formule 1 : il annonçait une
   * élimination même là où personne n'est éliminé.
   *
   * On réécrit donc titre, badge et ligne de détail après le rendu, sans
   * toucher au fichier cœur ni à la logique de qualification elle-même.
   * =================================================================== */

  /* Intitulé de la séance unique, catégorie par catégorie. */
  var SEANCE_UNIQUE = {
    "Karting Junior":   { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Karting Senior":   { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formule 4":        { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formula Regional": { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formule 3":        { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formule 2":        { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Endurance WEC":    { titre: "Hyperpole",                detail: "Séance unique — une voiture par équipage" },
    "IndyCar":          { titre: "Qualification",            detail: "Tours lancés en solo — un pilote à la fois" }
  };

  /* Intitulés des formats à élimination, par catégorie et par session. */
  var MULTI = {
    "Formule 1": {
      badge: function (n) { return "Q" + n; },
      titre: function (n, elim, restants) {
        if (n >= 3) return "Q3 — Bataille pour la pole";
        return "Q" + n + " — Élimination";
      },
      detail: function (n, elim, restants) {
        if (n >= 3) return restants + " pilotes en piste pour la pole";
        return elim > 0
          ? "Les " + elim + " derniers sont éliminés"
          : restants + " pilotes en piste";
      }
    },
    "Super Formula": {
      badge: function (n) { return "Q" + n; },
      titre: function (n) { return n >= 3 ? "Q3 — Bataille pour la pole" : "Q" + n + " — Élimination"; },
      detail: function (n, elim, restants) {
        return n >= 3 ? restants + " pilotes pour la pole"
                      : (elim > 0 ? "Les " + elim + " derniers sont éliminés" : restants + " pilotes en piste");
      }
    },
    "IndyCar": {
      badge: function (n) { return n >= 3 ? "FAST 6" : (n === 2 ? "FAST 12" : "SEG. 1"); },
      titre: function (n) {
        if (n >= 3) return "Fast Six — Bataille pour la pole";
        if (n === 2) return "Fast Twelve";
        return "Segment 1 — Élimination";
      },
      detail: function (n, elim, restants) {
        if (n >= 3) return "Les six plus rapides se disputent la pole";
        if (n === 2) return "Les six meilleurs passent en Fast Six";
        return elim > 0 ? "Les " + elim + " derniers sont éliminés" : restants + " pilotes en piste";
      }
    }
  };

  function formatCat(cat) {
    try {
      if (typeof window._qualiFormatForCat === "function") return window._qualiFormatForCat(cat);
    } catch (e) {}
    return { maxSessions: 1, singleSession: true, duration: {} };
  }

  function intitule() {
    var G = window.G;
    var cat = (G && G.cat) || "Formule 1";
    var st = window.QUALI_STATE;
    if (!st) return null;

    var n = st.session || 1;
    var restants = (st.survived && st.survived.length) || 0;
    var fmt = formatCat(cat);
    var elim = 0;
    try {
      if (!fmt.singleSession && n < (fmt.maxSessions || 1) && typeof window.getQualiElimCount === "function") {
        elim = window.getQualiElimCount(n) || 0;
      }
    } catch (e) {}

    /* Séance unique : aucune élimination à annoncer. */
    if (fmt.singleSession || (fmt.maxSessions || 1) <= 1) {
      var u = SEANCE_UNIQUE[cat] || { titre: "Qualification", detail: "Séance unique — le meilleur tour fixe la grille" };
      return { titre: u.titre, detail: u.detail, badge: "QUALIF", restants: restants };
    }

    var m = MULTI[cat] || MULTI["Formule 1"];
    return {
      titre: m.titre(n, elim, restants),
      detail: m.detail(n, elim, restants),
      badge: m.badge(n),
      restants: restants
    };
  }

  function habillerEnTete() {
    var host = document.getElementById("quali-session-header");
    if (!host) return;
    var info = intitule();
    if (!info) return;

    var G = window.G;
    var st = window.QUALI_STATE;
    var n = (st && st.session) || 1;

    var circuit = "";
    try { circuit = (window.RACE_STATE && window.RACE_STATE.circuit) || (G && G.cat) || ""; } catch (e) {}
    var minutes = "";
    try {
      var d = formatCat(G && G.cat).duration || {};
      var v = d[n] || (window.QUALI_DURATION && window.QUALI_DURATION[n]);
      if (v) minutes = v + " minutes";
    } catch (e) {}

    var bouts = [info.restants + " pilotes"];
    if (circuit) bouts.push(circuit);
    if (minutes) bouts.push(minutes);

    var couleurs = { 1: "var(--blue)", 2: "var(--amber)", 3: "#F59E0B" };
    var coul = (info.badge === "QUALIF") ? "var(--blue)" : (couleurs[n] || "var(--blue)");
    var classeBadge = (info.badge === "QUALIF") ? "b-blue"
                    : (n >= 3 ? "b-gold" : (n === 2 ? "b-amber" : "b-blue"));

    /* On regénère l'en-tête entier : le retoucher nœud par nœud dépendait
       d'une structure interne qui n'a pas à être un contrat. */
    host.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 6px">' +
        '<div>' +
          '<div style="font-size:16px;font-weight:800;color:' + coul + '">' + info.titre + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + bouts.join(" \u00b7 ") + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;opacity:.85">' + info.detail + '</div>' +
        '</div>' +
        '<span class="badge ' + classeBadge + '">' + info.badge + '</span>' +
      '</div>';

    /* Le compteur du bandeau annonçait « Q1 » même sans session multiple. */
    var compteur = document.getElementById("rj-quali-counter");
    if (compteur) compteur.textContent = (info.badge === "QUALIF") ? "" : info.badge;

    habillerBouton(info);
  }

  /* « Lancer Q1 » n'a pas de sens là où il n'y a pas de Q2. */
  function habillerBouton(info) {
    if (!info || info.badge !== "QUALIF") return;
    var zone = document.getElementById("quali-btn-zone");
    if (!zone) return;
    var boutons = zone.querySelectorAll("button");
    for (var i = 0; i < boutons.length; i++) {
      var b = boutons[i];
      var t = (b.textContent || "");
      if (/Lancer\s*Q\d/i.test(t)) {
        b.innerHTML = b.innerHTML.replace(/Lancer\s*Q\d/i, "Lancer la qualification");
      }
    }
  }

  /* ===================================================================
   * REMISE À ZÉRO DES SECTEURS ENTRE LES SESSIONS
   *
   * renderQualiSession vide bestTime, lastTime, laps et improved à chaque
   * nouvelle session — mais laisse intacts bestSectors (record personnel),
   * QUALI_STATE.bestSectors (record de session) et lastSectorFlags.
   *
   * Conséquence : le premier tour de Q2 était comparé aux secteurs de Q1.
   * Comme un premier tour est presque toujours plus lent que le meilleur de
   * la session précédente, les trois secteurs s'affichaient en jaune. Or par
   * convention, sur un chrono qui repart de zéro, le premier tour est
   * nécessairement une amélioration : vert au minimum, violet s'il devient
   * la référence.
   *
   * On vide donc les références au début de chaque session. renderQualiSession
   * n'est appelée qu'à l'ouverture d'une session (init, advanceQuali,
   * watchNextQuali), jamais en cours de séance : aucun record en cours ne
   * peut être effacé par erreur.
   * =================================================================== */

  var _dernierePhase = null;

  function clePhase() {
    var G = window.G, st = window.QUALI_STATE;
    var courses = 0, circuit = "";
    try { courses = (G && G.races) ? G.races.length : 0; } catch (e) {}
    try { circuit = (window.RACE_STATE && window.RACE_STATE.circuit) || ""; } catch (e) {}
    return courses + "|" + circuit + "|" + ((st && st.session) || 0);
  }

  function reinitialiserSecteurs() {
    var st = window.QUALI_STATE;
    if (!st) return;
    try {
      var pilotes = st.drivers || [];
      for (var i = 0; i < pilotes.length; i++) {
        var d = pilotes[i];
        if (!d) continue;
        d.bestSectors = [null, null, null];
        d.lastSectors = null;
        d.lastSectorFlags = null;
      }
      st.bestSectors = [null, null, null];
      st.bestSectorsHolder = [null, null, null];
    } catch (e) { console.warn("[46-qualif] remise à zéro des secteurs :", e && e.message); }
  }

  var _origRender = null, _origPick = null;

  function installBoutonTiming() {
    if (typeof window._qualiPickTiming !== "function") return false;
    if (window._qualiPickTiming._rj46) return true;
    _origPick = window._qualiPickTiming;
    window._qualiPickTiming = function () {
      var r = _origPick.apply(this, arguments);
      try { habillerBouton(intitule()); } catch (e) {}
      return r;
    };
    window._qualiPickTiming._rj46 = true;
    return true;
  }

  function installNomenclature() {
    if (typeof window.renderQualiSession !== "function") return false;
    if (window.renderQualiSession._rj46) return true;
    _origRender = window.renderQualiSession;
    window.renderQualiSession = function () {
      try {
        var cle = clePhase();
        if (cle !== _dernierePhase) { reinitialiserSecteurs(); _dernierePhase = cle; }
      } catch (e) {}
      var r = _origRender.apply(this, arguments);
      try { habillerEnTete(); } catch (e) { console.warn("[46-qualif] en-tête :", e && e.message); }
      return r;
    };
    window.renderQualiSession._rj46 = true;
    return true;
  }

  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    obs.observe(document.body, { childList: true, subtree: true });
    var essais = 0;
    (function bootQ() {
      installBoutonTiming();
      if (installNomenclature()) return;
      if (essais++ < 60) setTimeout(bootQ, 150);
    })();
    var ex = document.getElementById("fpl-debrief");
    if (ex) enhance(ex);
    console.log("[46-fp-qualif-shortcut] actif");
  }

  window._rjFpQualifShortcutUninstall = function () {
    if (_origRender) window.renderQualiSession = _origRender;
    if (_origPick) window._qualiPickTiming = _origPick;
    obs.disconnect();
    var b = document.getElementById(BTN_ID);
    if (b && b.parentNode) b.parentNode.removeChild(b);
    console.log("[46-fp-qualif-shortcut] désinstallé");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();


/* ==================================================================== *
 * Secteurs — découpage cohérent du tour
 * (anciennement 69-secteurs-coherents.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[69-secteurs-coherents]";
  var VIOLET = "#A78BFA", VERT = "#22D3EE", JAUNE = "#F59E0B";

  var etat = {
    installe: false,
    qualifCorrigees: 0,
    essaisCorriges: 0,
    dernierRecalcul: null,
    erreur: null
  };
  window._rj69Status = function () { return etat; };

  var origSplit = null, origSeq = null, observer = null, minuteur = null;
  var enEcriture = false;

  /* ------------------------------------------------------- utilitaires --- */
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

  function ratios(circuit) {
    try {
      if (typeof getCircuitSectorRatios === "function") {
        var r = getCircuitSectorRatios(circuit);
        if (r && r.length === 3) return r;
      }
    } catch (e) {}
    return [0.33, 0.35, 0.32];
  }

  // Même principe que splitLapIntoSectors, mais semé : deux appels pour le
  // même tour donnent le même découpage. La somme est renormalisée, donc
  // trois violets impliquent toujours le meilleur temps.
  function decouperSeme(lap, circuit, graine, ampleur) {
    var n = ratios(circuit);
    var rnd = mulberry(fnv(graine + "|" + lap.toFixed(3)));
    var r = (typeof ampleur === "number") ? ampleur : 0.012;
    var a = 2 * (rnd() - 0.5) * r;
    var i = 2 * (rnd() - 0.5) * r;
    var o = -0.5 * (a + i);
    var s1 = lap * n[0] * (1 + a);
    var s2 = lap * n[1] * (1 + i);
    var s3 = lap * n[2] * (1 + o);
    var p = lap / (s1 + s2 + s3);
    return [s1 * p, s2 * p, s3 * p];
  }

  /* ================================================================== */
  /* A. QUALIFICATION                                                    */
  /* ================================================================== */

  var photo = null;   // état des meilleurs secteurs avant le découpage optimiste

  function prendrePhoto() {
    if (typeof QUALI_STATE === "undefined" || !QUALI_STATE) return null;
    var d = QUALI_STATE.drivers || [];
    var pilotes = [];
    for (var i = 0; i < d.length; i++) {
      var o = d[i] || {};
      pilotes.push({
        bestSectors: o.bestSectors ? o.bestSectors.slice() : null,
        lastSectorFlags: o.lastSectorFlags ? o.lastSectorFlags.slice() : null,
        lastSectors: o.lastSectors ? o.lastSectors.slice() : null
      });
    }
    return {
      best: QUALI_STATE.bestSectors ? QUALI_STATE.bestSectors.slice() : null,
      holder: QUALI_STATE.bestSectorsHolder ? QUALI_STATE.bestSectorsHolder.slice() : null,
      pilotes: pilotes
    };
  }

  function restaurerPhoto(ph) {
    if (!ph || typeof QUALI_STATE === "undefined" || !QUALI_STATE) return false;
    QUALI_STATE.bestSectors = ph.best ? ph.best.slice() : [null, null, null];
    QUALI_STATE.bestSectorsHolder = ph.holder ? ph.holder.slice() : [null, null, null];
    var d = QUALI_STATE.drivers || [];
    for (var i = 0; i < d.length && i < ph.pilotes.length; i++) {
      var o = d[i]; if (!o) continue;
      var p = ph.pilotes[i];
      o.bestSectors = p.bestSectors ? p.bestSectors.slice() : null;
      o.lastSectorFlags = p.lastSectorFlags ? p.lastSectorFlags.slice() : null;
      o.lastSectors = p.lastSectors ? p.lastSectors.slice() : null;
    }
    return true;
  }

  function indexJoueur() {
    try {
      var d = QUALI_STATE.drivers || [];
      for (var i = 0; i < d.length; i++) if (d[i] && d[i].isPlayer) return i;
    } catch (e) {}
    return -1;
  }

  // Reproduction fidèle de l'algorithme d'origine, appliqué au bon temps.
  function reattribuer(finalTime) {
    if (typeof QUALI_STATE === "undefined" || !QUALI_STATE) return false;
    var idx = indexJoueur();
    if (idx < 0) return false;
    var o = QUALI_STATE.drivers[idx];
    if (!o) return false;

    var d = origSplit
      ? origSplit(finalTime, QUALI_STATE.circuitName || "", 0.016)
      : decouperSeme(finalTime, QUALI_STATE.circuitName || "", "q" + idx, 0.016);

    if (!o.bestSectors) o.bestSectors = [null, null, null];
    if (!QUALI_STATE.bestSectors) QUALI_STATE.bestSectors = [null, null, null];
    if (!QUALI_STATE.bestSectorsHolder) QUALI_STATE.bestSectorsHolder = [null, null, null];

    var p = [0, 0, 0];
    for (var u = 0; u < 3; u++) {
      var f = d[u];
      if (QUALI_STATE.bestSectors[u] === null || QUALI_STATE.bestSectors[u] === undefined ||
          f < QUALI_STATE.bestSectors[u]) {
        QUALI_STATE.bestSectors[u] = f;
        var m = QUALI_STATE.bestSectorsHolder[u];
        if (m !== null && m !== undefined && m !== idx) {
          var g = QUALI_STATE.drivers[m];
          if (g && g.lastSectorFlags && g.lastSectorFlags[u] === 2) g.lastSectorFlags[u] = 1;
        }
        QUALI_STATE.bestSectorsHolder[u] = idx;
        p[u] = 2;
      }
      if (o.bestSectors[u] === null || o.bestSectors[u] === undefined || f < o.bestSectors[u]) {
        o.bestSectors[u] = f;
        if (p[u] < 2) p[u] = 1;
      }
    }
    o.lastSectors = d;
    o.lastSectorFlags = p;

    etat.qualifCorrigees++;
    etat.dernierRecalcul = {
      temps: +finalTime.toFixed(3),
      secteurs: d.map(function (x) { return +x.toFixed(3); }),
      drapeaux: p.slice()
    };
    return true;
  }

  function installerQualif() {
    if (typeof window.splitLapIntoSectors === "function" && !window.splitLapIntoSectors._rj69) {
      origSplit = window.splitLapIntoSectors;
      var fnSplit = function () {
        // La photo doit être prise AVANT que l'appelant ne mette à jour les
        // meilleurs secteurs avec le découpage optimiste.
        try { photo = prendrePhoto(); } catch (e) {}
        return origSplit.apply(this, arguments);
      };
      fnSplit._rj69 = true;
      window.splitLapIntoSectors = fnSplit;
    }

    if (typeof window._qualiHotLapSequence === "function" && !window._qualiHotLapSequence._rj69) {
      origSeq = window._qualiHotLapSequence;
      var fnSeq = function (lapTime, session, lap, totalLaps, onDone) {
        var ph = photo;
        var suite = function (finalTime) {
          try {
            if (ph && typeof finalTime === "number" && isFinite(finalTime)) {
              restaurerPhoto(ph);
              reattribuer(finalTime);
            }
          } catch (e) {
            etat.erreur = String(e && e.message || e);
            console.warn(TAG, e);
          }
          return onDone.apply(this, arguments);
        };
        return origSeq.call(this, lapTime, session, lap, totalLaps, suite);
      };
      fnSeq._rj69 = true;
      window._qualiHotLapSequence = fnSeq;
    }

    return !!(origSplit && origSeq);
  }

  /* ================================================================== */
  /* B. ESSAIS LIBRES                                                    */
  /* ================================================================== */

  function circuitEssais() {
    try {
      return (RACE_STATE.circuitData && RACE_STATE.circuitData.name) || RACE_STATE.circuit || "";
    } catch (e) { return ""; }
  }

  // Recalcule les secteurs de tous les tests, dans l'ordre, et renvoie ceux
  // du dernier avec leurs couleurs.
  function secteursDuDernierTest() {
    var pr = null;
    try { pr = (typeof RACE_STATE !== "undefined") ? RACE_STATE.practice : null; } catch (e) {}
    if (!pr || !pr.tests || !pr.tests.length) return null;

    var circuit = circuitEssais();
    var meilleurs = [null, null, null];
    var precedents = null, courants = null, flags = null;

    for (var i = 0; i < pr.tests.length; i++) {
      var lt = pr.tests[i] && pr.tests[i].lapTime;
      if (typeof lt !== "number" || !isFinite(lt) || lt <= 0) continue;

      var d = decouperSeme(lt, circuit, "el" + i, 0.014);
      var f = [0, 0, 0];
      for (var u = 0; u < 3; u++) {
        if (meilleurs[u] === null || d[u] < meilleurs[u]) { meilleurs[u] = d[u]; f[u] = 2; }
        else if (precedents && d[u] < precedents[u]) { f[u] = 1; }
        else { f[u] = 0; }
      }
      precedents = courants;
      courants = d;
      flags = f;
    }
    if (!courants) return null;
    return { secteurs: courants, flags: flags };
  }

  function couleurDe(f) { return f === 2 ? VIOLET : f === 1 ? VERT : JAUNE; }
  function libelleDe(f) { return f === 2 ? "VIOLET" : f === 1 ? "VERT" : "JAUNE"; }

  function corrigerEssais() {
    var sec = document.getElementById("race-practice-section");
    if (!sec) return;
    var lignes = sec.querySelectorAll(".practice-sector[data-sec]");
    if (lignes.length < 3) return;

    // Ne rien faire tant que les temps ne sont pas révélés : le module 30
    // dévoile les secteurs progressivement, on ne corrige qu'une fois posés.
    var pret = false;
    for (var k = 0; k < lignes.length; k++) {
      var t0 = lignes[k].querySelector(".practice-sector-time");
      if (t0 && /\d/.test(t0.textContent || "")) { pret = true; break; }
    }
    if (!pret) return;

    var res = secteursDuDernierTest();
    if (!res) return;

    enEcriture = true;
    try {
      for (var i = 0; i < lignes.length; i++) {
        var row = lignes[i];
        var n = parseInt(row.getAttribute("data-sec"), 10);
        if (!(n >= 1 && n <= 3)) continue;
        var idx = n - 1;
        var f = res.flags[idx];
        var col = couleurDe(f);
        var tps = res.secteurs[idx];

        var tn = row.querySelector(".practice-sector-time");
        if (tn && /\d/.test(tn.textContent || "")) {
          // 04q-polish-rebalance arrondit les décimales trouvées dans le DOM.
          // Les deux échappatoires qu'il reconnaît : l'attribut data-rj-noround
          // et la classe sector-time. On pose les deux, sinon 26.819 devient 27.
          if (!row.hasAttribute("data-rj-noround")) row.setAttribute("data-rj-noround", "1");
          if (!tn.hasAttribute("data-rj-noround")) tn.setAttribute("data-rj-noround", "1");
          if (tn.className.indexOf("sector-time") < 0) tn.className += " sector-time";
          var voulu = tps.toFixed(3);
          if (tn.textContent !== voulu) tn.textContent = voulu;
          if (tn.style.color !== col) tn.style.color = col;
        }
        row.style.background = col + "22";
        row.style.borderColor = col;
        row.style.boxShadow = "0 0 14px " + col + "40, inset 0 0 0 1px " + col + "55";
        row.setAttribute("data-rj69", libelleDe(f));
      }
      etat.essaisCorriges++;
    } catch (e) {
      etat.erreur = String(e && e.message || e);
    } finally {
      enEcriture = false;
    }
  }

  function differer() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(corrigerEssais, 60);
  }

  function installerEssais() {
    if (observer || typeof MutationObserver !== "function") return !!observer;
    var cible = document.body || document.documentElement;
    if (!cible) return false;
    observer = new MutationObserver(function () {
      if (enEcriture) return;      // nos propres écritures ne se rappellent pas
      differer();
    });
    observer.observe(cible, { childList: true, subtree: true, characterData: true });
    return true;
  }

  /* ---------------------------------------------------------- montage --- */
  var essais = 0;
  function boot() {
    var q = false;
    try { q = installerQualif(); } catch (e) { etat.erreur = String(e && e.message || e); }
    var e2 = false;
    try { e2 = installerEssais(); } catch (e) {}

    if (!q && essais++ < 120) { setTimeout(boot, 100); return; }

    etat.installe = true;
    console.log(TAG + " actif — qualif : secteurs recalculés sur le temps final" +
                (q ? "" : " (interception partielle)") +
                " · essais : couleurs déduites des temps" + (e2 ? "" : " (observateur indisponible)"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Déclenchement manuel, utile pour vérifier depuis la console.
  window._rj69Corriger = function () {
    corrigerEssais();
    return etat;
  };

  window._rj69Uninstall = function () {
    try { if (origSplit && window.splitLapIntoSectors && window.splitLapIntoSectors._rj69) window.splitLapIntoSectors = origSplit; } catch (e) {}
    try { if (origSeq && window._qualiHotLapSequence && window._qualiHotLapSequence._rj69) window._qualiHotLapSequence = origSeq; } catch (e) {}
    try { if (observer) observer.disconnect(); } catch (e) {}
    observer = null;
    if (minuteur) clearTimeout(minuteur);
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();


/* ==================================================================== *
 * Compacité des écrans du week-end
 * (anciennement 84-weekend-compact.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[84-weekend]";
  var CSS_ID = "rj84-css";
  var MODAL_ID = "rj84-modal";

  function fn(n) { return typeof window[n] === "function"; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#" + MODAL_ID + "{position:fixed;inset:0;z-index:9500;display:none;align-items:flex-end;justify-content:center;" +
        "background:rgba(0,0,0,.72);backdrop-filter:blur(3px)}",
      "#" + MODAL_ID + ".on{display:flex}",
      "#" + MODAL_ID + " .rj84-box{width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;" +
        "background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);" +
        "border-bottom:none;border-radius:16px 16px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.6)}",
      "#" + MODAL_ID + " .rj84-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);flex-shrink:0}",
      "#" + MODAL_ID + " .rj84-ti{flex:1;font-family:var(--font-display);font-size:15px;font-weight:900;color:var(--white);letter-spacing:.02em}",
      "#" + MODAL_ID + " .rj84-x{background:none;border:none;color:var(--muted);font-size:24px;line-height:1;cursor:pointer;padding:0 4px}",
      "#" + MODAL_ID + " .rj84-bd{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 0 18px}",
      /* bouton d'accès, affiche déjà l'essentiel */
      ".rj84-open{display:flex;align-items:center;gap:11px;box-sizing:border-box;width:100%;" +
        "margin:0 0 10px;padding:12px 13px;cursor:pointer;" +
        "background:var(--bg3);border:1px solid var(--border-hi);border-left:3px solid var(--red);border-radius:10px;" +
        "font-family:inherit;text-align:left}",
      ".rj84-open .l{flex:1;min-width:0;display:block}",
      ".rj84-open .t{display:block;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.1em;" +
        "text-transform:uppercase;color:var(--text);line-height:1.3}",
      ".rj84-open .s{display:block;font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.4;" +
        "font-family:var(--font-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".rj84-open .c{color:var(--red);font-size:18px;flex-shrink:0}"
    ].join("");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ==================================================================
   * 1. LA FENÊTRE
   * ================================================================== */

  var ouvert = null;         // clé du bloc actuellement présenté

  function modale() {
    var m = document.getElementById(MODAL_ID);
    if (m) return m;
    injecterCSS();
    m = document.createElement("div");
    m.id = MODAL_ID;
    m.innerHTML =
      '<div class="rj84-box">' +
        '<div class="rj84-hd"><div class="rj84-ti" id="rj84-titre"></div>' +
          '<button class="rj84-x" id="rj84-fermer" aria-label="Fermer">\u00d7</button></div>' +
        '<div class="rj84-bd" id="rj84-corps"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      if (ev.target === m || (ev.target.closest && ev.target.closest("#rj84-fermer"))) fermer();
    });
    return m;
  }

  /* Déplacement du nœud d'origine, avec marqueur de position. */
  function ouvrir(cle, titre) {
    var bloc = document.getElementById(cle);
    if (!bloc) return;
    var m = modale();
    var corps = document.getElementById("rj84-corps");
    var t = document.getElementById("rj84-titre");
    if (!corps || !t) return;

    if (ouvert && ouvert !== cle) fermer();

    if (!document.getElementById("rj84-slot-" + cle)) {
      var marqueur = document.createElement("div");
      marqueur.id = "rj84-slot-" + cle;
      marqueur.style.display = "none";
      if (bloc.parentNode) bloc.parentNode.insertBefore(marqueur, bloc);
    }
    t.textContent = titre || "";
    corps.appendChild(bloc);
    bloc.style.display = "";
    m.classList.add("on");
    document.body.style.overflow = "hidden";
    ouvert = cle;
  }

  function fermer() {
    var m = document.getElementById(MODAL_ID);
    if (!m) return;
    if (ouvert) {
      var bloc = document.getElementById(ouvert);
      var marqueur = document.getElementById("rj84-slot-" + ouvert);
      if (bloc && marqueur && marqueur.parentNode) {
        marqueur.parentNode.insertBefore(bloc, marqueur);
        /* le classement de course reste visible : seule sa portion basse
           est repliée par compacterCourse */
        bloc.style.display = (ouvert === "live-leaderboard") ? "" : "none";
      }
    }
    m.classList.remove("on");
    document.body.style.overflow = "";
    var etait = ouvert;
    ouvert = null;
    if (etait === "live-leaderboard") {
      var lb = document.getElementById("live-leaderboard");
      if (lb) { lb.style.display = ""; try { compacterCourse(); } catch (e) {} }
    }
  }

  /* ==================================================================
   * 2. LES BOUTONS D'ACCÈS
   *
   * Chaque bouton porte un résumé lu dans le bloc rangé : on ne perd pas
   * l'information la plus utile en la mettant en fenêtre.
   * ================================================================== */

  function poserBouton(opts) {
    /* opts : { cle, idBouton, titre, libelle, resume() , avant } */
    var bloc = document.getElementById(opts.cle);
    if (!bloc) return false;
    if (ouvert === opts.cle) return true;      // en cours d'affichage, on n'y touche pas

    injecterCSS();
    var btn = document.getElementById(opts.idBouton);
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "rj84-open";
      btn.id = opts.idBouton;
      btn.addEventListener("click", function () { ouvrir(opts.cle, opts.titre); });
      if (bloc.parentNode) bloc.parentNode.insertBefore(btn, bloc);
    } else if (btn.parentNode !== bloc.parentNode) {
      /* le conteneur a été régénéré : on replace le bouton */
      if (bloc.parentNode) bloc.parentNode.insertBefore(btn, bloc);
    }

    var resume = "";
    try { resume = opts.resume ? opts.resume(bloc) : ""; } catch (e) {}
    btn.innerHTML =
      '<span class="l"><span class="t">' + esc(opts.libelle) + '</span>' +
      (resume ? '<span class="s">' + esc(resume) + '</span>' : '') + '</span>' +
      '<span class="c">\u203A</span>';

    bloc.style.display = "none";
    return true;
  }

  /* --- résumés ------------------------------------------------------ */

  function resumeReglages() {
    /* Le bandeau d'auto-réglages est juste au-dessus du bouton : répéter son
       texte n'apporte rien. On annonce plutôt ce que contient la fenêtre. */
    return "Aéro, suspensions, transmission, freins";
  }

  function resumeFeuilleTemps(bloc) {
    try {
      var txt = (bloc.innerText || "").replace(/\s+/g, " ");
      var m = txt.match(/(\d:\d{2}\.\d{3})/);
      var pos = txt.match(/P(\d+)/);
      var bouts = [];
      if (m) bouts.push("meilleur " + m[1]);
      if (pos) bouts.push("P" + pos[1]);
      return bouts.length ? bouts.join(" · ") : "Chronos de la séance";
    } catch (e) { return "Chronos de la séance"; }
  }

  /* ==================================================================
   * 3. APPLICATION AUX ONGLETS DU WEEK-END
   * ================================================================== */

  function compacterPreparation() {
    /* 975 px de réglages : le plus gros bloc du week-end. */
    poserBouton({
      cle: "setup-mode-advanced",
      idBouton: "rj84-btn-setup",
      titre: "Réglages de la monoplace",
      libelle: "Réglages de la voiture",
      resume: resumeReglages
    });
  }

  function compacterEssais() {
    /* 678 px de feuille de temps. On la retrouve d'un tap, résumé en tête. */
    var section = document.getElementById("race-practice-section");
    if (!section) return;
    var feuille = null;
    var enfants = section.children;
    for (var i = 0; i < enfants.length; i++) {
      var e = enfants[i];
      if (e.id && e.id.indexOf("rj84") === 0) continue;
      if ((e.innerText || "").indexOf("FEUILLE DE TEMPS") >= 0) { feuille = e; break; }
    }
    if (!feuille) return;
    if (!feuille.id) feuille.id = "rj84-feuille-temps";
    poserBouton({
      cle: feuille.id,
      idBouton: "rj84-btn-temps",
      titre: "Feuille de temps",
      libelle: "Feuille de temps",
      resume: resumeFeuilleTemps
    });
  }

  /* Pendant la course, le classement est l'information principale : le
     mettre entièrement en fenêtre serait un contresens. On n'affiche donc
     que la portion utile — le leader, puis les concurrents directs autour
     du joueur — et le tableau complet reste accessible d'un tap.
     Le classement étant régénéré à chaque tour, la réduction est
     réappliquée après chaque rendu. */
  var VOISINS = 3;

  function lignesClassement(lb) {
    var l = lb.querySelectorAll(".lb-row, .live-row, [data-pos]");
    if (l.length >= 4) return l;
    return lb.children;                          // repli : enfants directs
  }

  function compacterCourse() {
    var lb = document.getElementById("live-leaderboard");
    if (!lb || !lb.parentNode) return;
    if (ouvert === "live-leaderboard") return;   // affiché en grand, on n'y touche pas

    /* Le classement en course n'est pas une liste de lignes mais un
       composant complet (bandeau position/écart, panneaux, tableau) rendu
       par le module de télémétrie. Le découper à l'aveugle masquerait des
       éléments qui ne sont pas des pilotes : on s'abstient tant qu'une
       analyse dédiée de ce composant n'a pas été faite. */
    if (lb.querySelector(".rjdc")) return;

    var lignes = lignesClassement(lb);
    if (!lignes || lignes.length < 8) return;    // plateau court : tout tient déjà

    /* Repérage du joueur : la ligne mise en avant par le moteur. */
    var idxJoueur = -1;
    for (var i = 0; i < lignes.length; i++) {
      var cl = String(lignes[i].className || "");
      if (/player|is-player|moi|me\b/i.test(cl) || lignes[i].getAttribute("data-player") === "1") {
        idxJoueur = i; break;
      }
    }
    if (idxJoueur < 0) {
      try {
        var G = (typeof window.G !== "undefined") ? window.G : null;
        var nom = G && G.pilot ? (G.pilot.nom || "") : "";
        if (nom) {
          for (var j = 0; j < lignes.length; j++) {
            if ((lignes[j].innerText || "").indexOf(nom) >= 0) { idxJoueur = j; break; }
          }
        }
      } catch (e) {}
    }
    if (idxJoueur < 0) return;                   // sans repère, on ne masque rien

    var debut = Math.max(0, idxJoueur - VOISINS);
    var fin = Math.min(lignes.length - 1, idxJoueur + VOISINS);
    var masquees = 0;
    for (var k = 0; k < lignes.length; k++) {
      var garder = (k === 0) || (k >= debut && k <= fin);
      if (lignes[k]._rj84Base === undefined) lignes[k]._rj84Base = lignes[k].style.display || "";
      lignes[k].style.display = garder ? lignes[k]._rj84Base : "none";
      if (!garder) masquees++;
    }
    if (!masquees) return;

    /* Bouton d'accès au tableau complet, sous le classement réduit. */
    injecterCSS();
    var btn = document.getElementById("rj84-btn-classement");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "rj84-open";
      btn.id = "rj84-btn-classement";
      btn.addEventListener("click", function () {
        var bloc = document.getElementById("live-leaderboard");
        if (bloc) {
          var ls = lignesClassement(bloc);
          for (var n = 0; n < ls.length; n++) ls[n].style.display = ls[n]._rj84Base || "";
        }
        ouvrir("live-leaderboard", "Classement de la course");
      });
      lb.parentNode.insertBefore(btn, lb.nextSibling);
    }
    btn.innerHTML =
      '<span class="l"><span class="t">Classement complet</span>' +
      '<span class="s">' + masquees + ' autres pilotes</span></span>' +
      '<span class="c">\u203A</span>';
  }

  function compacter() {
    try {
      var scr = document.getElementById("S-race");
      if (!scr || !scr.classList.contains("on")) return;
      compacterPreparation();
      compacterEssais();
      compacterCourse();
    } catch (e) { console.warn(TAG, "compactage :", e && e.message); }
  }

  /* ==================================================================
   * 4. BRANCHEMENT
   *
   * Les onglets du week-end sont régénérés à chaque rendu : on repasse
   * après chaque bascule d'onglet et après chaque rafraîchissement.
   * ================================================================== */

  var _orig = {};

  function wrap(nom) {
    if (!fn(nom) || window[nom]._rj84) return;
    var o = window[nom];
    window[nom] = function () {
      var r = o.apply(this, arguments);
      try { setTimeout(compacter, 30); } catch (e) {}
      return r;
    };
    window[nom]._rj84 = true;
    _orig[nom] = o;
  }

  function installer() {
    ["rtab", "renderRaceScreen", "renderPracticeScreen", "refreshScreen",
     "renderLiveLeaderboard"].forEach(wrap);
    /* On ferme la fenêtre si l'on quitte l'écran de course, et l'on
       recompacte après chaque navigation. Inscription au registre des
       réactions d'écran plutôt qu'une enveloppe de plus sur navTo. */
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "84-weekend-compact"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "84-weekend-compact",
        ecran: "*",
        avant: function (id) { if (id !== "S-race") { try { fermer(); } catch (e) {} } },
        apres: function () { try { setTimeout(compacter, 40); } catch (e) {} }
      });
    }
    return !!(window.rtab && window.rtab._rj84);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        compacter();
        console.log(TAG, "actif — réglages, feuille de temps et classement en fenêtre");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj84 = { ouvrir: ouvrir, fermer: fermer, compacter: compacter };
    window._rj84Uninstall = function () {
      try {
        fermer();
        Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
        ["setup-mode-advanced", "rj84-feuille-temps", "live-leaderboard"].forEach(function (id) {
          var b = document.getElementById(id);
          if (b) b.style.display = "";
        });
        ["rj84-btn-setup", "rj84-btn-temps", "rj84-btn-classement", MODAL_ID, CSS_ID].forEach(function (id) {
          var e = document.getElementById(id);
          if (e && e.parentNode) e.parentNode.removeChild(e);
        });
        console.log(TAG, "désinstallé");
      } catch (e) {}
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
