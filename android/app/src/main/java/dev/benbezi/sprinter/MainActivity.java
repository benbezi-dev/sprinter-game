package dev.benbezi.sprinter;

import android.os.Build;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Avant Android 15, SystemBars garde les encarts natifs des anciennes WebView.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            EdgeToEdge.enable(this);
        }
        super.onCreate(savedInstanceState);
    }
}
