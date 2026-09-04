import AVFoundation
import Foundation

/**
 Le son du jeu, du cote du systeme.

 Sur le web comme sur Android, un `AudioContext` qui joue s'entend. Sur iOS,
 non : tant que l'application n'a rien declare, elle herite de la categorie
 `soloAmbient`, et `soloAmbient` se tait des que le petit interrupteur sur la
 tranche du telephone est pousse. Un joueur sur deux vit avec cet interrupteur
 sur silence toute la journee. Pour lui, sans ce fichier, Sprinter est un jeu
 muet — et il ne conclura pas que son telephone est en silencieux, il conclura
 que le jeu n'a pas de son.

 Ce n'est pas un detail d'ambiance. Le depart se joue au coup de pistolet :
 c'est un signal de chronometrie, pas une musique. Un faux depart coute la
 course. Le son fait donc partie des regles, au meme titre que la secousse du
 vibreur dont `engine.ts` explique qu'elle est une boucle de retour et non un
 ornement.

 D'ou les deux decisions posees ici, et elles se defendent separement :

 1. `playback` — le jeu passe outre l'interrupteur de silence.
    C'est ce que fait un lecteur de musique ou de video : un son que
    l'utilisateur a lui-meme declenche en ouvrant l'application. Le
    contre-pouvoir existe et il est a portee de pouce : le jeu porte son
    propre bouton de son, et les touches de volume repondent.

 2. `mixWithOthers` — le jeu ne coupe pas la musique du joueur.
    Sans cette option, ouvrir Sprinter arrete Spotify. Beaucoup de jeux le
    font ; aucun n'a de bonne raison. Celui qui court en musique garde sa
    musique, et baisse le jeu s'il le veut.

 Si l'on voulait un jour l'inverse — respecter l'interrupteur de silence —
 il suffirait de remplacer `.playback` par `.ambient` ci-dessous. Rien
 d'autre dans le fichier ne changerait.
 */
enum SessionAudio {

    /// Pose la categorie une fois pour toutes, et s'abonne aux interruptions.
    static func poser() {
        appliquer()

        // Un appel telephonique, une alarme, Siri : le systeme desactive la
        // session le temps de l'interruption. A la fin il ne la rend PAS tout
        // seul — l'application qui ne se reveille pas reste muette jusqu'a
        // son prochain lancement. C'est exactement le scenario « j'ai repondu
        // au telephone pendant une course et le jeu n'a plus jamais eu de
        // son », qu'on ne reproduit jamais en developpement parce qu'on ne
        // s'appelle pas soi-meme.
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { note in
            guard
                let brut = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                let type = AVAudioSession.InterruptionType(rawValue: brut)
            else { return }

            if type == .ended { appliquer() }
        }
    }

    /// Rend la session au jeu. Appelable autant de fois qu'on veut.
    ///
    /// Aussi appelee au retour au premier plan : une autre application a pu
    /// prendre la main entre-temps et laisser la session dans un autre etat.
    static func appliquer() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true, options: [.notifyOthersOnDeactivation])
        } catch {
            // Un echec ici ne justifie pas de refuser le jeu : on retombe sur
            // le comportement d'avant, c'est-a-dire un son qui obeit a
            // l'interrupteur de silence. Degrade, pas casse.
            NSLog("[Sprinter] session audio refusee : \(error.localizedDescription)")
        }
    }
}
