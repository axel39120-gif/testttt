/* =====================================================================
 * 39-lifestyle-effects.js — LE STYLE DE VIE AGIT SUR FATIGUE & MORAL
 *
 * Le lifestyle (biens, activités, vie perso) alimente déjà G.happiness,
 * mais le bonheur n'avait aucun effet de jeu. Ce module en fait le canal :
 * chaque semaine, ton niveau de bonheur module ta récupération de fatigue
 * et ton moral.
 *   - bonheur élevé  -> tu récupères mieux, moral soutenu
 *   - bonheur faible -> fatigue accrue, moral qui s'érode
 *
 * Branché sur WEEKLY_TICK_HOOKS (effet) + renderLifestyle (retour visuel).
 * Option A : n'écrit rien dans le cœur. Réversible : window._rjLifeUninstall().
 *
 * S'appuie sur : G.happiness, G.training.fatigue, changeMental.
 * =================================================================== */
(function () {
  "use strict";

  function G_() { return window.G; }
  function tr_() {
    if (typeof window.getTraining === "function") { try { return window.getTraining(); } catch (e) {} }
    var G = G_(); return G ? (G.training = G.training || {}) : null;
  }

  /* normalisé -1..+1 autour de 50 de bonheur */
  function happyNorm() {
    var G = G_(), h = (G && typeof G.happiness === "number") ? G.happiness : 50;
    return Math.max(-1, Math.min(1, (h - 50) / 50));
  }
  /* effet hebdomadaire anticipé selon le bonheur courant */
  function weeklyEffect() {
    var G = G_(), n = happyNorm();
    return {
      happy: (G && typeof G.happiness === "number") ? G.happiness : 50,
      fatigue: -Math.round(n * 8),          // bonheur haut => fatigue en baisse
      moral: Math.round(n * 2 * 10) / 10    // bonheur haut => moral en hausse
    };
  }
  /* applique l'effet (appelé une fois par semaine) */
  function applyWeeklyLifestyle() {
    var eff = weeklyEffect(), tr = tr_();
    if (tr) tr.fatigue = Math.max(0, Math.min(100, (tr.fatigue || 0) + eff.fatigue));
    if (eff.moral && typeof window.changeMental === "function") {
      try { window.changeMental(eff.moral, "Équilibre de vie"); } catch (e) {}
    }
    return eff;
  }

  function registerHook() {
    if (!window.WEEKLY_TICK_HOOKS || !window.WEEKLY_TICK_HOOKS.push) return false;
    for (var i = 0; i < window.WEEKLY_TICK_HOOKS.length; i++) {
      if (window.WEEKLY_TICK_HOOKS[i] && window.WEEKLY_TICK_HOOKS[i].id === "lifestyleEffects") return true;
    }
    window.WEEKLY_TICK_HOOKS.push({ id: "lifestyleEffects", run: function () { try { applyWeeklyLifestyle(); } catch (e) {} } });
    return true;
  }

  /* ============================== UI =============================== */
  function injectCSS() {
    if (document.getElementById("rj-life-css")) return;
    var css = [
      '.rjlife-eff{position:relative;margin:12px 14px 4px;padding:13px 14px 13px 17px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);overflow:hidden;font-family:var(--font-display);box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 8px 24px rgba(0,0,0,.4)}',
      '.rjlife-stripe{position:absolute;left:0;top:0;bottom:0;width:3px}',
      '.rjlife-kicker{font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}',
      '.rjlife-rows{display:flex;flex-direction:column;gap:9px}',
      '.rjlife-row{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.rjlife-row-l{display:flex;align-items:center;gap:8px}',
      '.rjlife-ico{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.rjlife-ico svg{width:15px;height:15px}',
      '.rjlife-row-lbl{font-size:11.5px;font-weight:700;color:var(--text2)}',
      '.rjlife-row-val{font-size:12.5px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.rjlife-note{font-size:9.5px;font-weight:600;color:var(--muted);line-height:1.4;margin-top:10px}'
    ].join("");
    var st = document.createElement("style"); st.id = "rj-life-css"; st.textContent = css;
    document.head.appendChild(st);
  }
  function renderEffectCard() {
    var eff = weeklyEffect();
    var accent = eff.happy >= 65 ? "var(--green)" : eff.happy <= 35 ? "var(--red3)" : "var(--amber)";
    var fatVal = eff.fatigue < 0 ? '<span style="color:var(--green)">\u2212' + Math.abs(eff.fatigue) + " énergie / sem</span>"
      : eff.fatigue > 0 ? '<span style="color:var(--red3)">+' + eff.fatigue + " fatigue / sem</span>"
      : '<span style="color:var(--text2)">stable</span>';
    var morVal = eff.moral > 0 ? '<span style="color:var(--green)">+' + eff.moral + " / sem</span>"
      : eff.moral < 0 ? '<span style="color:var(--red3)">' + eff.moral + " / sem</span>"
      : '<span style="color:var(--text2)">stable</span>';
    var note = eff.happy >= 65 ? "Ton équilibre de vie te fait récupérer plus vite et soutient ton moral."
      : eff.happy <= 35 ? "Un bonheur trop bas te fatigue et entame ton moral. Soigne ta vie hors-piste."
      : "Maintiens ou élève ton bonheur pour transformer ton style de vie en récupération et en moral.";
    var bolt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>';
    var heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
    return '<div class="rjlife-stripe" style="background:linear-gradient(180deg,' + accent + ',transparent 80%);box-shadow:0 0 16px ' + accent + '66"></div>'
      + '<div class="rjlife-kicker">Effet de ton style de vie</div>'
      + '<div class="rjlife-rows">'
      + '<div class="rjlife-row"><div class="rjlife-row-l"><div class="rjlife-ico" style="background:rgba(0,212,255,.12);color:#00D4FF">' + bolt + '</div><span class="rjlife-row-lbl">Énergie physique</span></div><span class="rjlife-row-val">' + fatVal + "</span></div>"
      + '<div class="rjlife-row"><div class="rjlife-row-l"><div class="rjlife-ico" style="background:rgba(180,123,255,.12);color:var(--purple)">' + heart + '</div><span class="rjlife-row-lbl">Moral</span></div><span class="rjlife-row-val">' + morVal + "</span></div>"
      + "</div>"
      + '<div class="rjlife-note">' + note + "</div>";
  }
  function injectEffect() {
    var host = document.getElementById("ls-overview");
    if (!host) host = document.getElementById("ls-biens") || document.getElementById("ls-happiness");
    if (!host) return;
    var ex = document.getElementById("rjlife-eff"); if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    var div = document.createElement("div"); div.className = "rjlife-eff"; div.id = "rjlife-eff";
    div.innerHTML = renderEffectCard();
    if (host.firstChild) host.insertBefore(div, host.firstChild); else host.appendChild(div);
  }
  var _origRL = null;
  function wrapRenderLifestyle() {
    if (typeof window.renderLifestyle !== "function") return false;
    if (window.renderLifestyle._rjLife) return true;
    _origRL = window.renderLifestyle;
    window.renderLifestyle = function () {
      var r = _origRL.apply(this, arguments);
      try { injectEffect(); } catch (e) {}
      return r;
    };
    window.renderLifestyle._rjLife = true;
    return true;
  }

  function install() {
    if (window._rjLifeInstalled) return;
    window._rjLifeInstalled = true;
    try { injectCSS(); } catch (e) {}
    var tries = 0;
    (function boot() {
      var a = registerHook(), b = wrapRenderLifestyle();
      if (a && b) return;
      if (tries++ < 50 && typeof setTimeout === "function") setTimeout(boot, 150);
    })();
    window._rjLife = {
      weeklyEffect: weeklyEffect, applyWeeklyLifestyle: applyWeeklyLifestyle,
      happyNorm: happyNorm, renderEffectCard: renderEffectCard, injectEffect: injectEffect
    };
    window._rjLifeUninstall = function () {
      if (_origRL) window.renderLifestyle = _origRL;
      if (window.WEEKLY_TICK_HOOKS) {
        for (var i = window.WEEKLY_TICK_HOOKS.length - 1; i >= 0; i--)
          if (window.WEEKLY_TICK_HOOKS[i] && window.WEEKLY_TICK_HOOKS[i].id === "lifestyleEffects") window.WEEKLY_TICK_HOOKS.splice(i, 1);
      }
      var c = document.getElementById("rj-life-css"); if (c && c.parentNode) c.parentNode.removeChild(c);
      window._rjLifeInstalled = false;
      console.log("[39-lifestyle-effects] désinstallé");
    };
    console.log("[39-lifestyle-effects] actif — bonheur -> fatigue + moral");
  }

  install();
})();
