package dev.benbezi.sprinter;

import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.webkit.WebViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Seuil de SystemBars (Capacitor) : a partir de la WebView 140, les zones sures
    // arrivent au jeu par env(safe-area-inset-*) meme avant Android 15.
    private static final int WEBVIEW_ZONES_SURES = 140;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // super.onCreate D'ABORD : c'est lui qui quitte le theme de demarrage pour
        // AppTheme.NoActionBar. Appele avant, EdgeToEdge.enable construisait la fenetre
        // sous le theme de demarrage, qui a une barre d'action : un bandeau « Sprinter »
        // avec le logo restait en haut de l'ecran (Samsung Galaxy Z Flip6, 7/11/2026).
        super.onCreate(savedInstanceState);
        // Bord a bord pour tous quand le jeu peut connaitre les zones sures. Avec une
        // WebView plus ancienne avant Android 15, env() vaudrait 0 : le jeu passerait
        // sous la barre d'etat, on garde alors les barres hors de la page.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM || versionWebView() >= WEBVIEW_ZONES_SURES) {
            EdgeToEdge.enable(this);
        }
    }

    private int versionWebView() {
        try {
            PackageInfo info = WebViewCompat.getCurrentWebViewPackage(this);
            return info == null || info.versionName == null ? 0 : Integer.parseInt(info.versionName.split("\\.")[0]);
        } catch (RuntimeException e) {
            return 0;
        }
    }
}
