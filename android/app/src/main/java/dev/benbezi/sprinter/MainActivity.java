package dev.benbezi.sprinter;

import android.os.Build;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // super.onCreate D'ABORD : c'est lui qui quitte le theme de demarrage pour
        // AppTheme.NoActionBar. Appele avant, EdgeToEdge.enable construisait la fenetre
        // sous le theme de demarrage, qui a une barre d'action : un bandeau « Sprinter »
        // avec le logo restait en haut de l'ecran (Samsung Galaxy Z Flip6, 7/11/2026).
        super.onCreate(savedInstanceState);
        // Avant Android 15, SystemBars garde les encarts natifs des anciennes WebView.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            EdgeToEdge.enable(this);
        }
    }
}
