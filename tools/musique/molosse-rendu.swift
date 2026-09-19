// LA NUIT DU MOLOSSE — le rendu de secours.
//
// Il transforme molosse.mid en fichier audio, avec le synthetiseur General
// MIDI livre dans macOS (gs_instruments.dls, la banque de CoreAudio).
//
// POURQUOI « DE SECOURS », ET CE QU'IL NE REMPLACE PAS.
//
// Ni Logic Pro ni FL Studio n'exposent le moindre dictionnaire AppleScript :
// aucun des deux ne se pilote depuis un script, ni pour dicter des notes, ni
// pour lancer un export. La partition est donc ecrite a part
// (molosse-partition.py), et c'est un humain qui ouvre le MIDI dans la station
// de son choix pour lui preter de vrais instruments.
//
// Ce programme comble l'intervalle : il rend la partition ECOUTABLE tout de
// suite, et fournit au jeu une piste jouable avant que la version finale
// n'existe. Le son qu'il produit est celui d'une banque General MIDI de 1998 —
// honnete, daté, et sans commune mesure avec un orgue de Logic. C'est une
// maquette, pas un master.
//
// Il rend HORS LIGNE (manualRenderingMode) : la duree du rendu ne depend pas
// de celle du morceau, et rien ne sort par les haut-parleurs. Un rendu en
// temps reel aurait demande cinquante-trois secondes et capte le son de la
// machine avec.
//
// Usage :  swift molosse-rendu.swift molosse.mid molosse.wav [secondes]

import AVFoundation
import Foundation

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: molosse-rendu.swift <entree.mid> <sortie.wav> [secondes]\n".data(using: .utf8)!)
    exit(2)
}
let midiURL = URL(fileURLWithPath: args[1])
let sortieURL = URL(fileURLWithPath: args[2])
// La queue de reverberation et les cloches depassent la derniere mesure : on
// rend un peu plus long que la boucle, et l'on recoupera au montage.
let secondes = args.count > 3 ? Double(args[3]) ?? 56.0 : 56.0

let banque = URL(fileURLWithPath:
    "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
guard FileManager.default.fileExists(atPath: banque.path) else {
    FileHandle.standardError.write("banque General MIDI introuvable\n".data(using: .utf8)!)
    exit(1)
}

// Les sept pistes de la partition, dans l'ordre ou molosse-partition.py les
// ecrit. `programme` est le numero General MIDI ; `percussion` bascule le
// sampler sur le kit de batterie, qui vit dans une autre banque.
struct Voix {
    let nom: String
    let programme: UInt8
    let percussion: Bool
    let volume: Float      // en decibels, pour equilibrer le melange
    let panoramique: Float // -1 a gauche, +1 a droite
}
// L'ORDRE EST CELUI DE `PISTES` DANS molosse-partition.py, et il n'y a pas
// d'autre lien entre les deux fichiers : ajouter une piste a la partition sans
// ajouter sa voix ici decale tout le routage d'un cran, ce qui s'entend
// immediatement — la basse sort a l'orgue. Le decompte ci-dessous le rattrape
// et le signale.
let voix: [Voix] = [
    Voix(nom: "Basse",        programme: 38, percussion: false, volume:  -1, panoramique:  0.00),
    Voix(nom: "Orgue",        programme: 19, percussion: false, volume:  -8, panoramique: -0.18),
    Voix(nom: "Lead",         programme: 81, percussion: false, volume:  -6, panoramique:  0.14),
    Voix(nom: "Celesta",      programme:  8, percussion: false, volume:  -5, panoramique:  0.26),
    Voix(nom: "Cuivres",      programme: 61, percussion: false, volume:  -9, panoramique: -0.28),
    Voix(nom: "Choeur",       programme: 52, percussion: false, volume: -13, panoramique:  0.32),
    Voix(nom: "Cloches",      programme: 14, percussion: false, volume:  -7, panoramique:  0.12),
    Voix(nom: "Percussions",  programme:  0, percussion: true,  volume:  -3, panoramique:  0.00),
]

let moteur = AVAudioEngine()
var samplers: [AVAudioUnitSampler] = []

for _ in voix {
    let s = AVAudioUnitSampler()
    moteur.attach(s)
    moteur.connect(s, to: moteur.mainMixerNode, format: nil)
    samplers.append(s)
}

// Le format de sortie : 44,1 kHz stereo, ce que le jeu attend.
let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
do {
    try moteur.enableManualRenderingMode(.offline, format: format,
                                         maximumFrameCount: 4096)
} catch {
    FileHandle.standardError.write("mode hors ligne refuse : \(error)\n".data(using: .utf8)!)
    exit(1)
}

do {
    try moteur.start()
} catch {
    FileHandle.standardError.write("moteur audio : \(error)\n".data(using: .utf8)!)
    exit(1)
}

// LES SONS SE CHARGENT APRES LE DEMARRAGE DU MOTEUR, et pas avant : un
// sampler charge sur un graphe a l'arret perd son programme au demarrage, et
// les sept pistes sortent toutes au piano.
for (i, v) in voix.enumerated() {
    let s = samplers[i]
    do {
        if v.percussion {
            // Le kit de batterie vit dans la banque de percussions, qui se
            // designe par son octet de poids fort — c'est la convention
            // General MIDI, et le sampler d'Apple la suit.
            try s.loadSoundBankInstrument(at: banque, program: 0,
                                          bankMSB: UInt8(kAUSampler_DefaultPercussionBankMSB),
                                          bankLSB: UInt8(kAUSampler_DefaultBankLSB))
        } else {
            try s.loadSoundBankInstrument(at: banque, program: v.programme,
                                          bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
                                          bankLSB: UInt8(kAUSampler_DefaultBankLSB))
        }
    } catch {
        FileHandle.standardError.write("\(v.nom) : instrument refuse — \(error)\n".data(using: .utf8)!)
    }
    s.overallGain = v.volume
    s.pan = v.panoramique
}

let sequenceur = AVAudioSequencer(audioEngine: moteur)
do {
    try sequenceur.load(from: midiURL, options: [])
} catch {
    FileHandle.standardError.write("lecture du MIDI : \(error)\n".data(using: .utf8)!)
    exit(1)
}

// CHAQUE PISTE VERS SON SAMPLER. Sans cela, tout part sur le nœud par defaut
// et le morceau entier sort au piano — ce qui, pour une musique d'Halloween,
// enleve a peu pres tout.
//
// LA PISTE DE TEMPO COMPTE DANS LE LOT, et c'est le premier essai qui l'a dit :
// « 8 pistes pour 7 voix ». Le fichier est un SMF de format 1 dont la premiere
// piste ne porte que le tempo et l'armure ; AVAudioSequencer ne la met pas a
// part, il la rend avec les autres. Router bêtement piste i vers sampler i
// decalait donc tout d'un cran — la basse jouait a l'orgue, l'orgue au
// celesta, et les percussions, sans destination, sortaient au piano.
//
// On mesure le decalage au lieu de le supposer : si le sequenceur rend une
// piste de plus que de voix, la premiere est celle du tempo et l'on saute.
let pistes = sequenceur.tracks
let decalage = pistes.count - voix.count
if decalage != 0 && decalage != 1 {
    FileHandle.standardError.write(
        "attention : \(pistes.count) pistes pour \(voix.count) voix\n".data(using: .utf8)!)
}
for (i, s) in samplers.enumerated() {
    let j = i + max(0, decalage)
    if j < pistes.count { pistes[j].destinationAudioUnit = s }
}

// LE SEQUENCEUR NE BOUCLE PAS, ET C'EST VOULU.
//
// Il sait le faire, et c'est ce qu'il faisait : `isLoopingEnabled` laissait
// un blanc de cinquante millisecondes a chaque raccord, parce qu'une plage
// bouclee coupe les notes en cours au lieu de les laisser sonner par-dessus
// la reprise. Les tours sont donc ecrits dans le fichier MIDI lui-meme
// (molosse-partition.py, `construire(tours)`), et ce programme se contente
// de jouer ce qu'on lui donne, une fois, du debut a la fin.

sequenceur.prepareToPlay()
do {
    try sequenceur.start()
} catch {
    FileHandle.standardError.write("sequenceur : \(error)\n".data(using: .utf8)!)
    exit(1)
}

// Le fichier de sortie, en PCM 16 bits : le format que ffmpeg et lame
// attendent, et qui n'impose aucune perte avant le mp3 final.
let reglages: [String: Any] = [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVSampleRateKey: 44100.0,
    AVNumberOfChannelsKey: 2,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false,
]
guard let fichier = try? AVAudioFile(forWriting: sortieURL, settings: reglages) else {
    FileHandle.standardError.write("impossible d'ecrire \(sortieURL.path)\n".data(using: .utf8)!)
    exit(1)
}

let tampon = AVAudioPCMBuffer(pcmFormat: moteur.manualRenderingFormat,
                              frameCapacity: moteur.manualRenderingMaximumFrameCount)!
let total = AVAudioFramePosition(secondes * format.sampleRate)

while moteur.manualRenderingSampleTime < total {
    let reste = total - moteur.manualRenderingSampleTime
    let combien = AVAudioFrameCount(min(AVAudioFramePosition(tampon.frameCapacity), reste))
    do {
        let etat = try moteur.renderOffline(combien, to: tampon)
        switch etat {
        case .success:
            try fichier.write(from: tampon)
        case .insufficientDataFromInputNode:
            continue
        case .cannotDoInCurrentContext, .error:
            FileHandle.standardError.write("rendu interrompu\n".data(using: .utf8)!)
            exit(1)
        @unknown default:
            exit(1)
        }
    } catch {
        FileHandle.standardError.write("rendu : \(error)\n".data(using: .utf8)!)
        exit(1)
    }
}

sequenceur.stop()
moteur.stop()
print("rendu : \(sortieURL.path) — \(String(format: "%.1f", secondes)) s")
