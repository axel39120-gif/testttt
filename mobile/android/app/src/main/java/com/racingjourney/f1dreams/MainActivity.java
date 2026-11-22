package com.racingjourney.f1dreams;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

/**
 * Le jeu s'adapte seul à l'appareil (js/core/00-ecran.js : échelle selon la taille de l'écran).
 * Ici, on lui garantit un affichage fiable sur tous les Android :
 *  - plein écran immersif ;
 *  - jeu dessiné jusque sous l'encoche ou le poinçon de la caméra, dont on transmet la zone
 *    au jeu (RJEcran.encoche) pour qu'il n'y place rien d'important ;
 *  - taille du texte du système ignorée (sinon « grand texte » dans les réglages casse la mise en page) ;
 *  - balise viewport respectée (sinon l'échelle calculée par le jeu serait sans effet).
 */
public class MainActivity extends BridgeActivity {

    private String derniereEncoche = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        pleinEcran();
        WebView wv = webView();
        if (wv != null) {
            WebSettings s = wv.getSettings();
            s.setTextZoom(100);
            s.setUseWideViewPort(true);
            s.setLoadWithOverviewMode(false);
            // l'encoche change avec la rotation, le pliage ou le multi-fenêtre
            wv.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> envoyerEncoche(false));
            wv.postDelayed(() -> envoyerEncoche(true), 1500);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Android réaffiche les barres après une fenêtre système (clavier, notification) : on les recache.
        if (hasFocus) {
            pleinEcran();
            envoyerEncoche(true);
        }
    }

    /** Plein écran immersif : barres d'état et de navigation cachées, réaffichées le temps d'un glissement. */
    private void pleinEcran() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private WebView webView() {
        return getBridge() != null ? getBridge().getWebView() : null;
    }

    /** Zone de l'encoche, en dp, transmise au jeu. force : renvoyer même si rien n'a changé (page rechargée). */
    private void envoyerEncoche(boolean force) {
        WebView wv = webView();
        if (wv == null) return;
        WindowInsetsCompat w = ViewCompat.getRootWindowInsets(wv);
        if (w == null) return;
        Insets i = w.getInsets(WindowInsetsCompat.Type.displayCutout());
        float d = getResources().getDisplayMetrics().density;
        String js = String.format(Locale.US,
            "window.RJEcran&&RJEcran.encoche({g:%.1f,d:%.1f,h:%.1f,b:%.1f})",
            i.left / d, i.right / d, i.top / d, i.bottom / d);
        if (!force && js.equals(derniereEncoche)) return;
        derniereEncoche = js;
        wv.post(() -> wv.evaluateJavascript(js, null));
    }
}
