import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Avant toute image : la session audio. Sans elle, le jeu est muet sur
        // un telephone en silencieux — voir SessionAudio.swift, qui explique
        // pourquoi c'est une regle du jeu et pas un reglage d'ambiance.
        SessionAudio.poser()
        return true
    }

    // ------------------------------------------------------------------
    // Le jeton de notification, et les trois messages qu'iOS envoie ici
    // ------------------------------------------------------------------
    //
    // APNs ne parle qu'a l'AppDelegate. Ces trois methodes ne font rien
    // d'autre que reposter ce qu'il dit sur le NotificationCenter, ou le
    // greffon Firebase l'attend : c'est le seul chemin entre le systeme et
    // le code JavaScript qui enregistre le jeton.
    //
    // Sans elles, `getToken()` reste en attente pour toujours — sans erreur,
    // sans message dans la console, sans rien. L'application se lance, tout
    // a l'air normal, et aucune notification n'arrive jamais.

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(
            name: Notification.Name.init("didReceiveRemoteNotification"),
            object: completionHandler, userInfo: userInfo)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Une autre application a pu prendre le son pendant qu'on etait au
        // fond — un appel, une video, un autre jeu — et la rendre dans un
        // autre etat que celui qu'on avait pose. On le repose, a chaque
        // retour : l'operation est sans effet quand rien n'a bouge.
        SessionAudio.appliquer()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
