
// ===========================================================================
// FIX 18 : CONTACTS & RÉSEAU PADDOCK — renderNetworkScreen()
// ---------------------------------------------------------------------------
// Problème : G._network existe et est alimenté, mais aucun écran ne l'affiche.
// Le joueur ne voit jamais ses contacts paddock ni l'effet des relations.
// Solution : renderNetworkScreen() injectée dans refreshScreen("S-contact-thread")
// + action "Entretenir la relation" coûtant 1 PA.
// ===========================================================================
(function _rjFixNetworkScreen() {
  // Render complet de l'écran réseau paddock
  window.renderNetworkScreen = function() {
    var el = document.getElementById('network-screen-content');
    if (!el) return;

    var contacts = (typeof getNetworkList === 'function') ? getNetworkList() : [];
    var html = '';

    // Header stats
    var totalContacts = contacts.length;
    var avgRel = totalContacts > 0
      ? Math.round(contacts.reduce(function(s,c){ return s + (c.relation||50); }, 0) / totalContacts)
      : 0;
    var strongContacts = contacts.filter(function(c){ return (c.relation||0) >= 65; }).length;

    html += '<div style="padding:14px 16px 10px">';
    html += '<div style="display:flex;gap:10px;margin-bottom:14px">';
    // Stat 1 : contacts
    html += '<div style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:var(--white)">' + totalContacts + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Contacts</div>';
    html += '</div>';
    // Stat 2 : relation moyenne
    var relColor = avgRel >= 65 ? '#4ADE80' : avgRel >= 45 ? '#F59E0B' : '#EF4444';
    html += '<div style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:' + relColor + '">' + avgRel + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Rel. moy.</div>';
    html += '</div>';
    // Stat 3 : alliés (>= 65)
    html += '<div style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:#4ADE80">' + strongContacts + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Alliés</div>';
    html += '</div>';
    html += '</div>'; // fin stats

    if (totalContacts === 0) {
      html += '<div style="padding:32px 16px;text-align:center;color:var(--muted);font-size:13px;font-style:italic">';
      html += 'Aucun contact pour l\'instant. Rencontre des pros du paddock en course, lors des Media Days et via ton académie.';
      html += '</div>';
    } else {
      // Grouper par rôle
      var roleOrder = {tp:0, dir_sport:1, dir_tech:2, ing_course:3};
      var roleLabels = {tp:'Team Principal', dir_sport:'Dir. Sportif', dir_tech:'Dir. Technique', ing_course:'Ingénieur de course'};
      var roleColors = {tp:'#F59E0B', dir_sport:'#22D3EE', dir_tech:'#A78BFA', ing_course:'#34D399'};

      contacts.forEach(function(c) {
        var rel = c.relation || 50;
        var relColor = rel >= 70 ? '#4ADE80' : rel >= 50 ? '#F59E0B' : rel >= 30 ? '#FB923C' : '#EF4444';
        var relLabel = rel >= 75 ? 'Allié' : rel >= 60 ? 'Positif' : rel >= 40 ? 'Neutre' : rel >= 25 ? 'Froid' : 'Hostile';
        var contactColor = c.color || roleColors[c.role] || '#60A5FA';

        // Décroissance — depuis quand vu ?
        var weeksSince = 0;
        if (c.lastSeen) {
          weeksSince = 50 * ((G.saison || 1) - (c.lastSeen.saison || 1)) + ((G.semaine || 1) - (c.lastSeen.week || 1));
        }
        var decayWarning = weeksSince > 10;

        html += '<div style="display:flex;align-items:center;gap:12px;padding:13px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:8px;position:relative;overflow:hidden">';
        // Accent couleur gauche
        html += '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:' + contactColor + ';border-radius:3px 0 0 3px"></div>';
        // Avatar
        html += '<div style="width:42px;height:42px;border-radius:50%;background:' + contactColor + '22;border:2px solid ' + contactColor + '55;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px">';
        html += (typeof renderIcon === 'function') ? renderIcon(c.icon || 'user', 18, contactColor) : '👤';
        html += '</div>';
        // Info
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (c.name || 'Inconnu') + '</span>';
        if (decayWarning) {
          html += '<span style="font-size:9px;color:#EF4444;font-weight:700;background:rgba(239,68,68,.12);padding:1px 6px;border-radius:4px;letter-spacing:.05em;white-space:nowrap">INACTIF</span>';
        }
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (roleLabels[c.role] || c.roleLabel || c.role || 'Contact') + (c.team ? ' · ' + c.team : '') + '</div>';
        // Barre relation
        html += '<div style="display:flex;align-items:center;gap:6px;margin-top:6px">';
        html += '<div style="flex:1;height:3px;background:var(--bg3);border-radius:2px;overflow:hidden">';
        html += '<div style="height:100%;width:' + rel + '%;background:' + relColor + ';border-radius:2px;transition:width .3s"></div>';
        html += '</div>';
        html += '<span style="font-size:10px;font-weight:700;color:' + relColor + ';width:34px;text-align:right">' + relLabel + '</span>';
        html += '</div>';
        html += '</div>';
        // Bouton entretenir (si PA dispo)
        var canMaintain = (G.pa || 0) >= 1 && weeksSince >= 2;
        html += '<div style="flex-shrink:0;text-align:right">';
        html += '<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:' + relColor + '">' + rel + '</div>';
        html += '<div style="font-size:9px;color:var(--muted);margin-top:1px">/ 100</div>';
        if (canMaintain) {
          html += '<button onclick="rjMaintainContact(\'' + (c.key || '') + '\')" style="margin-top:6px;padding:5px 9px;background:' + contactColor + '22;border:1px solid ' + contactColor + '55;border-radius:6px;color:' + contactColor + ';font-size:10px;font-weight:700;font-family:var(--font-display);cursor:pointer;white-space:nowrap">Contacter −1 PA</button>';
        }
        html += '</div>';
        html += '</div>'; // fin carte
      });
    }

    html += '</div>'; // fin padding
    el.innerHTML = html;
  };

  // Action "Entretenir la relation" — coûte 1 PA, gagne +5-8 relation
  window.rjMaintainContact = function(key) {
    if (!key || (G.pa || 0) < 1) {
      if (typeof showToast === 'function') showToast('Pas assez de PA.');
      return;
    }
    if (typeof getNetworkEntry !== 'function') return;
    var entry = getNetworkEntry(key);
    if (!entry) return;
    var gain = 5 + Math.floor(Math.random() * 4); // +5 à +8
    entry.relation = Math.min(100, (entry.relation || 50) + gain);
    entry.lastSeen = {saison: G.saison || 1, week: G.semaine || 1};
    entry.interactions = (entry.interactions || 0) + 1;
    G.pa = Math.max(0, (G.pa || 0) - 1);
    if (typeof showToast === 'function') showToast('Relation renforcée avec ' + (entry.name || 'ce contact') + ' (+' + gain + ')');
    if (typeof updateUI === 'function') updateUI();
    // Re-render
    renderNetworkScreen();
  };

  // Wrapper refreshScreen pour injecter renderNetworkScreen sur S-contact-thread
  (function _rjWrapRefreshForNetwork() {
    if (typeof window.refreshScreen !== 'function') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _rjWrapRefreshForNetwork);
      } else { setTimeout(_rjWrapRefreshForNetwork, 500); }
      return;
    }
    if (window.refreshScreen._rjNetworkWrapped) return;
    var orig = window.refreshScreen;
    /* Ce module ne complète qu'un écran : il s'inscrit au registre des
       réactions d'écran (module 88) au lieu d'envelopper la navigation. */
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "07-user-fixes"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "07-user-fixes",
        ecran: "S-contact-thread",
        apres: function (screenId) {
      
      try {
        if (screenId === 'S-contact-thread') {
          // On détourne S-contact-thread pour afficher le réseau
          var titleEl = document.getElementById('ct-title');
          var subEl = document.getElementById('ct-sub');
          if (titleEl) titleEl.textContent = 'Réseau Paddock';
          if (subEl) {
            var contacts = (typeof getNetworkList === 'function') ? getNetworkList() : [];
            subEl.textContent = contacts.length + ' contact' + (contacts.length > 1 ? 's' : '');
          }
          // Injecter le contenu réseau dans le scroll du thread
          var scroll = document.querySelector('#S-contact-thread .scroll');
          if (scroll) {
            var netDiv = document.getElementById('network-screen-content');
            if (!netDiv) {
              netDiv = document.createElement('div');
              netDiv.id = 'network-screen-content';
              scroll.innerHTML = '';
              scroll.appendChild(netDiv);
            }
            renderNetworkScreen();
          }
        }
      } catch(e) { console.warn('[07-FIX18] network screen:', e); }        }
      });
    }
    
    console.log('[07-FIX18] renderNetworkScreen injectée');
  })();

  // Décroissance hebdomadaire des relations réseau — hook weekly
  if (typeof WEEKLY_TICK_HOOKS !== 'undefined') {
    var alreadyHasDecay = WEEKLY_TICK_HOOKS.some(function(h){ return h.id === 'networkDecay'; });
    if (!alreadyHasDecay) {
      WEEKLY_TICK_HOOKS.push({
        id: 'networkDecay',
        run: function(weeks) {
          if (typeof decayNetworkRelations === 'function') decayNetworkRelations(weeks);
        }
      });
      console.log('[07-FIX18] Hook networkDecay enregistré');
    }
  }

})();
