/* =====================================================================
 * 59-events-page-design.js — PAGE ÉVÉNEMENTS AU DESIGN ACTUEL
 *
 * La page des événements hors course utilisait encore l'ancien motif
 * visuel : fond plat, barre d'accent ambre à gauche, coins gauches
 * carrés, choix en simples boutons gris. Les écrans refaits depuis
 * (résultat, podium, stratégie) suivent un autre motif :
 *   - carte en dégradé sombre (bg2 → bg), rayon complet, liseré
 *     d'accent en HAUT plutôt qu'à gauche, halo radial discret ;
 *   - micro-titres en police display, majuscules, interlettrage large ;
 *   - choix présentés comme des options tapables (bordure 2px, fond
 *     teinté, chevron), à l'image du sélecteur de style de pilotage ;
 *   - effets affichés en pastilles colorées plutôt qu'en texte nu.
 *
 * On agit uniquement par CSS, sans toucher au rendu (05-progression est
 * un fichier cœur) : les futurs événements en héritent automatiquement.
 *
 * Réversible : window._rj59Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var STYLE_ID = "rj59-events-design";

  var CSS = [
    /* ---- carte d'événement ---- */
    "#evt-media-list .rep-evt-card{",
    "  position:relative;margin:10px 14px;padding:16px 14px 14px;",
    "  background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);",
    "  border:1px solid var(--border-hi);border-left:1px solid var(--border-hi);",
    "  border-top:2px solid var(--red,#FF1801);",
    "  border-radius:var(--r,10px);overflow:hidden;",
    "}",
    /* halo discret en haut à droite, comme sur l'écran de résultat */
    "#evt-media-list .rep-evt-card::after{",
    "  content:'';position:absolute;top:-18px;right:-18px;width:90px;height:90px;",
    "  background:radial-gradient(circle,rgba(255,24,1,.16) 0%,transparent 70%);",
    "  pointer-events:none;",
    "}",

    /* ---- titre ---- */
    "#evt-media-list .rep-evt-title{",
    "  font-family:var(--font-display);font-size:13px;font-weight:900;",
    "  letter-spacing:.05em;text-transform:uppercase;color:var(--white,#fff);",
    "  margin-bottom:2px;line-height:1.25;",
    "}",

    /* ---- contexte ---- */
    "#evt-media-list .rep-evt-desc{",
    "  font-size:12.5px;color:var(--text2);line-height:1.55;",
    "  margin:6px 0 12px;padding-left:10px;",
    "  border-left:2px solid rgba(255,255,255,.07);",
    "}",

    /* ---- liste de choix ---- */
    "#evt-media-list .rep-evt-choices{display:flex;flex-direction:column;gap:7px}",

    /* ---- bouton de choix ---- */
    "#evt-media-list .rep-choice-btn{",
    "  position:relative;display:block;width:100%;text-align:left;",
    "  padding:12px 30px 12px 13px;",
    "  background:rgba(255,255,255,.035);",
    "  border:2px solid var(--border-hi);border-radius:10px;",
    "  color:var(--text);font-family:inherit;font-size:12.5px;font-weight:600;line-height:1.35;",
    "  cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none;",
    "  transition:border-color .15s,background .15s,transform .08s;",
    "}",
    "#evt-media-list .rep-choice-btn::after{",
    "  content:'\\203A';position:absolute;right:12px;top:50%;transform:translateY(-50%);",
    "  font-size:17px;line-height:1;color:var(--text3);",
    "}",
    "#evt-media-list .rep-choice-btn:hover{",
    "  border-color:var(--red,#FF1801);background:rgba(255,24,1,.07);",
    "}",
    "#evt-media-list .rep-choice-btn:active{transform:scale(.985)}",

    /* ---- pastilles d'effet (spans en style inline dans le bouton) ---- */
    "#evt-media-list .rep-choice-btn span{",
    "  display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;",
    "  font-family:var(--font-display)!important;font-size:10px!important;font-weight:800!important;",
    "  letter-spacing:.04em;background:rgba(255,255,255,.06);",
    "  border:1px solid rgba(255,255,255,.10);",
    "}",
    "#evt-media-list .rep-choice-btn > div{",
    "  margin-top:8px!important;display:flex;gap:6px;flex-wrap:wrap;",
    "}",

    /* ---- état vide ---- */
    "#evt-media-list > div[style*='color:var(--text3)']{",
    "  margin:10px 14px;padding:16px 14px!important;",
    "  background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);",
    "  border:1px solid var(--border-hi);border-radius:var(--r,10px);",
    "  font-size:12.5px!important;line-height:1.55;",
    "}",

    /* ---- historique ---- */
    "#evt-history-list > div{",
    "  margin:6px 14px;padding:10px 12px;",
    "  background:var(--bg3);border:1px solid var(--border);",
    "  border-radius:8px;font-size:12px;",
    "}"
  ].join("\n");

  function install() {
    if (document.getElementById(STYLE_ID)) return true;
    if (!document.head) return false;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
    return true;
  }

  var tries = 0;
  function boot() {
    if (install()) {
      console.log("[59-events-page-design] page événements alignée sur le design actuel");
      return;
    }
    if (tries++ < 60) setTimeout(boot, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj59Uninstall = function () {
    var st = document.getElementById(STYLE_ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log("[59-events-page-design] désinstallé");
  };
})();
