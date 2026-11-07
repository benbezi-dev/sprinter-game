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

# Capacitor lit par reflexion les annotations des greffons (@CapacitorPlugin,
# @Permission : alias et chaines de permission). Sans ces regles, R8 vidait ces
# annotations et getPermissionStates plantait au demarrage (FirebaseMessaging,
# Samsung Galaxy Z Flip6, 7/11/2026).
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep @interface com.getcapacitor.annotation.** { *; }
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }
