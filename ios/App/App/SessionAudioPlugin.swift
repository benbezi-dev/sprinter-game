import Capacitor
import Foundation

/**
 Le seul geste que le jeu demande au systeme sur le son : « rends-la moi ».

 Le web est le seul a savoir quand la capture du direct s'arrete — le natif ne
 voit pas les fenetres de parole, il ne voit que WebKit poser et reposer des
 categories. Il faut donc que le jeu le dise, et ce greffon n'existe que pour
 porter cette phrase-la. Il ne prend aucun argument, ne rend aucune valeur, et
 ne fait rien d'autre que rappeler `SessionAudio.appliquer()`, qui est deja ce
 qu'on fait au retour d'un appel telephonique.

 Il est volontairement idempotent et sans effet quand rien n'a bouge : le jeu
 l'appelle deux fois apres chaque micro rendu, parce que WebKit ajuste sa
 session APRES avoir coupe la capture et qu'une premiere reprise trop rapide se
 fait ecraser.
 */
@objc(SessionAudioPlugin)
public class SessionAudioPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "SessionAudioPlugin"
    public let jsName = "SessionAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "rendreAuJeu", returnType: CAPPluginReturnPromise)
    ]

    /// Le micro vient d'etre rendu : la sortie revient au jeu.
    @objc func rendreAuJeu(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            SessionAudio.appliquer()
            call.resolve()
        }
    }
}
