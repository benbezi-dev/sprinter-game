# Le pont et ses entrees JavaScript restent accessibles apres optimisation.
-keep class com.getcapacitor.Bridge { *; }
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor fournit deja les regles consumer pour les classes @CapacitorPlugin,
# les constructeurs, @PluginMethod, @PermissionCallback et @ActivityCallback.
# AdMob, UMP et Firebase fournissent leurs regles dans leurs AAR/JAR : Gradle
# les fusionne automatiquement, y compris les registrars Firebase.
# Les services FCM sont conserves via le manifeste fusionne.
