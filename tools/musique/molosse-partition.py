#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LA NUIT DU MOLOSSE — la partition.

Ce fichier EST la musique. Il n'y a pas de projet Logic quelque part dont il
serait l'export : les notes, les durees et les nuances sont ecrites ici, et le
fichier MIDI en sort. C'est le meme parti pris que le reste du jeu — les
coureurs sont des nombres dans sprinter-core.js, les stades des palettes dans
sprinter-app.js — et il a la meme vertu : on transpose, on change un accord ou
l'on rallonge la boucle en relisant huit lignes.

CE QUE LES STATIONS FONT, ET CE QU'ELLES NE PEUVENT PAS FAIRE ICI. Ni Logic
Pro ni FL Studio n'exposent le moindre dictionnaire AppleScript : aucun des
deux ne se pilote depuis un script, ni pour dicter des notes, ni pour lancer
un export. Le partage des taches est donc celui-ci — ce fichier ecrit la
partition, la station l'ouvre et lui prete ses instruments. Les numeros de
programme General MIDI plus bas ne servent qu'au rendu de secours (voir
molosse-rendu.swift) ; dans Logic ou FL, chaque piste porte son nom et l'on y
pose ce qu'on veut.

===========================================================================
CE QU'ON CHERCHE : UN MORCEAU QUI TAPE, PAS UNE AMBIANCE
===========================================================================

La contrainte vient du jeu, et elle est brutale : UNE COURSE DURE ENTRE NEUF
ET QUINZE SECONDES. Le joueur n'entendra jamais un developpement, une montee
de trente-deux mesures ni un final. Il entend dix secondes, prises n'importe
ou dans la boucle, et il les reentend a chaque tentative.

Trois consequences, et elles commandent tout le reste :

  1. PAS D'INTRODUCTION. Le morceau demarre a pleine charge, des la premiere
     double-croche. Une intro qui s'installe serait, pour la moitie des
     courses, tout ce que le joueur entendrait du morceau.

  2. AUCUN PASSAGE FAIBLE DE PLUS DE QUATRE MESURES. Le break des mesures 17
     a 20 est le seul endroit depeuple, et il dure une seconde et demie. Un
     break de huit mesures aurait laisse des courses entieres dans le vide.

  3. LE CROCHET REVIENT TOUS LES HUIT TEMPS. Il faut pouvoir le fredonner
     apres trois tentatives, parce qu'il y en aura trente.

RE MINEUR HARMONIQUE, et c'est ce qui rend le morceau reconnaissable en deux
notes. Sa sixte mineure et sa septieme majeure laissent une seconde augmentee
entre si bemol et do diese : l'intervalle de toutes les musiques de fantomes
depuis deux siecles, et il ne s'obtient pas autrement. Le do diese n'apparait
que sur la dominante — pose sur une tonique, il sonnerait faux et non
inquietant.

152 A LA NOIRE. Assez rapide pour une poursuite, assez lent pour que l'orgue
garde ses accords lisibles. Au-dela, la reverberation d'orgue empile les
harmonies et le bas du spectre devient une bouillie.

LE GROOVE EST EN 3+3+2, et c'est la seule chose de la partition qui vienne du
chien. Les doubles-croches se groupent par trois, trois, puis deux : l'accent
se deplace a l'interieur du temps, et l'on entend boiter un galop de
quadrupede au lieu d'une pompe reguliere. La grosse caisse double ces appuis,
la basse aussi.

  |x . . x . . x . |x . . x . . x . |
   1     2     3     1     2     3

===========================================================================
LA STRUCTURE — 32 mesures, 50,5 secondes, et la boucle se referme
===========================================================================

  A (1-8)    LE DROP, tout de suite. Basse, orgue en accents, batterie
             pleine, et le crochet au lead des la premiere mesure.
  B (9-16)   Le crochet monte d'une octave, les cuivres entrent sur les
             contretemps. C'est le meme materiau, plus haut et plus dense.
  C (17-20)  LE BREAK, quatre mesures. Tout tombe sauf le celesta et le
             choeur : la comptine se retrouve nue. C'est le contraste qui
             fait peur, pas l'accumulation.
  C'(21-24)  La remontee. Le charley revient en doubles, les toms montent,
             la caisse claire se resserre mesure apres mesure.
  D (25-32)  Le dernier drop : tout joue, les cloches sonnent, et la
             derniere mesure retombe sur la dominante — qui appelle la
             tonique du debut. Jouee en boucle, on ne sait pas ou elle
             recommence.

LE GLAS NE SONNE PAS LES HEURES. Les cloches tombent sur des temps faibles et
jamais douze fois : une cloche qui compte devient une horloge, et l'on se met
a l'ecouter au lieu de courir.
"""

import struct
import os

# --------------------------------------------------------------------------
# L'ECRITURE D'UN FICHIER MIDI, A LA MAIN
# --------------------------------------------------------------------------
# Aucune bibliotheque : un SMF de format 1 tient en quarante lignes, et une
# dependance de plus serait une dependance a installer le jour ou l'on veut
# retoucher un accord.

NOIRE = 480
CROCHE = NOIRE // 2
DOUBLE = NOIRE // 4
BLANCHE = NOIRE * 2
MESURE = NOIRE * 4      # 4/4


def vlq(n):
    """Un entier en quantite de longueur variable, comme MIDI les ecrit."""
    octets = [n & 0x7F]
    n >>= 7
    while n:
        octets.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(octets))


def piste(evenements, nom=None):
    """
    Une piste MIDI a partir d'evenements (tick_absolu, donnees).

    On trie par instant puis on convertit en deltas : ecrire les notes dans
    l'ordre ou elles viennent a l'esprit, plutot que dans l'ordre du fichier,
    est ce qui rend la partition relisible. `sorted` est stable, donc a
    instant egal l'ordre d'ecriture tient — un note-off passe avant le
    note-on qui le suit.
    """
    corps = b''
    if nom:
        titre = nom.encode('utf-8')
        corps += vlq(0) + b'\xFF\x03' + vlq(len(titre)) + titre
    precedent = 0
    for tick, donnees in sorted(evenements, key=lambda e: e[0]):
        corps += vlq(tick - precedent) + donnees
        precedent = tick
    corps += vlq(0) + b'\xFF\x2F\x00'
    return b'MTrk' + struct.pack('>I', len(corps)) + corps


def fichier(pistes, division=NOIRE):
    tete = b'MThd' + struct.pack('>IHHH', 6, 1, len(pistes), division)
    return tete + b''.join(pistes)


def note(evts, canal, hauteur, debut, duree, force=80):
    """
    Une note : son attaque, et son relachement un souffle avant la fin.

    Les deux ticks retires evitent que deux notes voisines de meme hauteur se
    chevauchent — un synthetiseur coupe alors la premiere au lieu de la lier,
    et l'ostinato de basse se met a hoqueter.
    """
    h = max(0, min(127, int(hauteur)))
    f = max(1, min(127, int(force)))
    evts.append((debut, bytes([0x90 | canal, h, f])))
    evts.append((debut + max(1, duree - 2), bytes([0x80 | canal, h, 0])))


def accord(evts, canal, hauteurs, debut, duree, force=80):
    for h in hauteurs:
        note(evts, canal, h, debut, duree, force)


# --------------------------------------------------------------------------
# LES HAUTEURS
# --------------------------------------------------------------------------
# On nomme les notes plutot que de poser des nombres : une partition ecrite en
# entiers MIDI ne se relit pas, et c'est precisement ce qu'on veut pouvoir
# faire dans six mois.

def n(nom, octave):
    base = {'do': 0, 'do#': 1, 're': 2, 'mib': 3, 'mi': 4, 'fa': 5, 'fa#': 6,
            'sol': 7, 'lab': 8, 'la': 9, 'sib': 10, 'si': 11}
    return base[nom] + (octave + 1) * 12


RE = lambda o: n('re', o)
MI = lambda o: n('mi', o)
FA = lambda o: n('fa', o)
SOL = lambda o: n('sol', o)
LA = lambda o: n('la', o)
SIB = lambda o: n('sib', o)
DOD = lambda o: n('do#', o)

# --------------------------------------------------------------------------
# LA GRILLE
# --------------------------------------------------------------------------
# Dm | Dm | Bb | A7 | Dm | Gm | Bb | A7
#
# La cadence la plus usee du repertoire mineur, et c'est exactement pour cela
# qu'elle fonctionne : on sait ou l'on va des la deuxieme mesure, et toute
# l'attention reste sur la course. Un morceau de dix secondes n'a pas le temps
# d'enseigner une harmonie a qui l'ecoute.
GRILLE = [
    [RE(3), FA(3), LA(3)],            # Dm
    [RE(3), FA(3), LA(3)],            # Dm
    [SIB(2), RE(3), FA(3)],           # Bb
    [LA(2), DOD(3), MI(3), SOL(3)],   # A7
    [RE(3), FA(3), LA(3)],            # Dm
    [SOL(2), SIB(2), RE(3)],          # Gm
    [SIB(2), RE(3), FA(3)],           # Bb
    [LA(2), DOD(3), MI(3), SOL(3)],   # A7
]
FONDS = [RE(1), RE(1), SIB(0), LA(0), RE(1), SOL(0), SIB(0), LA(0)]
QUINTES = [LA(1), LA(1), FA(1), MI(1), LA(1), RE(1), FA(1), MI(1)]

MESURES = 32
CANAL_PERC = 9
TEMPO_BPM = 152

# Les quatre sections, en numeros de mesure (a partir de 0).
A = range(0, 8)
B = range(8, 16)
BREAK = range(16, 20)
REMONTEE = range(20, 24)
D = range(24, 32)

# Les seize positions de doubles-croches d'une mesure ou tombe le groove
# 3+3+2, repete deux fois. C'est LA constante du morceau : basse, grosse
# caisse et accents d'orgue s'y alignent, et c'est cet alignement qui fait
# qu'on entend un seul geste au lieu de trois instruments.
APPUIS = (0, 3, 6, 8, 11, 14)


# --------------------------------------------------------------------------
# LA BASSE — le moteur
# --------------------------------------------------------------------------
def basse():
    """
    Doubles-croches sans interruption, du premier au dernier temps.

    ELLE NE S'ARRETE MEME PAS AU BREAK, et c'est volontaire : c'est elle qui
    court. Couper la basse aurait arrete la course ; on lui retire seulement
    son octave superieure et un peu de force, ce qui suffit a creuser sans
    laisser de trou.

    L'octave se leve sur les appuis du 3+3+2 : le saut d'octave marque
    l'accent mieux qu'une nuance, parce qu'il s'entend meme quand tout joue
    par-dessus.
    """
    e = []
    for m in range(MESURES):
        g = m % 8
        fond, quinte = FONDS[g], QUINTES[g]
        creux = m in BREAK
        for i in range(16):
            t = m * MESURE + i * DOUBLE
            if i in APPUIS:
                h = fond if creux else fond + 12
                force = 104 if i in (0, 8) else 94
            else:
                h = fond if (i % 4) in (1, 2) else quinte
                force = 70
            if creux:
                force -= 22
            # La derniere double de chaque phrase de huit mesures remonte vers
            # la reprise : c'est la relance de la boucle, et elle doit
            # s'entendre meme au casque d'un telephone.
            if g == 7 and i == 15:
                h, force = quinte + 12, 110
            note(e, 0, h, t, DOUBLE, force)
    return e


# --------------------------------------------------------------------------
# L'ORGUE — les accents, pas les nappes
# --------------------------------------------------------------------------
def orgue():
    """
    DES ACCENTS COURTS, ET NON DES ACCORDS TENUS.

    C'est le changement qui fait passer le morceau d'une ambiance a un
    morceau qui tape. Un orgue qui tient des rondes remplit l'espace et
    endort ; le meme orgue frappe sur les appuis du 3+3+2 devient une section
    rythmique a lui seul — c'est l'orgue des stades, pas celui des veillees.

    Il tient long a deux endroits seulement : au break, ou il n'y a plus rien
    d'autre a tenir, et sur la derniere mesure, pour lier la boucle.
    """
    e = []
    for m in range(MESURES):
        g = m % 8
        notes = GRILLE[g]
        if m in BREAK:
            # Le break : une seule tenue, doucement, sous le celesta.
            accord(e, 1, notes, m * MESURE, MESURE, 52)
            continue
        plein = (m in D) or (m in B)
        for i in APPUIS:
            t = m * MESURE + i * DOUBLE
            # Une double-croche piquee sur les appuis principaux, deux sur les
            # secondaires : l'orgue respire au lieu de mitrailler.
            duree = DOUBLE if i in (3, 11) else CROCHE
            force = (96 if plein else 84) - (0 if i in (0, 8) else 12)
            accord(e, 1, notes, t, duree, force)
        # La basse d'orgue, une octave sous la fondamentale, seulement quand
        # tout joue : en dessous elle rend le bas du spectre boueux, et le bas
        # appartient deja a la basse.
        if plein:
            note(e, 1, notes[0] - 12, m * MESURE, MESURE, 74)
        # La derniere mesure tient, pour lier la boucle.
        if m == MESURES - 1:
            accord(e, 1, notes, m * MESURE + BLANCHE, BLANCHE, 92)
    return e


# --------------------------------------------------------------------------
# LE CROCHET
# --------------------------------------------------------------------------
# Huit mesures, et il revient a chaque section. Il doit se fredonner : rien
# que des degres de la gamme, aucun intervalle difficile, et une chute sur la
# sensible (do diese) qui appelle la tonique — c'est ce do diese qui rend la
# phrase impossible a laisser en plan.
#
# (hauteur, debut en croches depuis le debut de la phrase, duree en croches)
CROCHET = [
    (RE(5), 0, 2), (FA(5), 2, 1), (LA(5), 3, 1), (SIB(5), 4, 3), (LA(5), 7, 1),
    (FA(5), 8, 2), (MI(5), 10, 2), (RE(5), 12, 4),
    (RE(5), 16, 2), (MI(5), 18, 1), (FA(5), 19, 1), (SOL(5), 20, 2), (FA(5), 22, 2),
    (MI(5), 24, 3), (DOD(5), 27, 1), (RE(5), 28, 4),
    (LA(5), 32, 2), (SIB(5), 34, 1), (LA(5), 35, 1), (SOL(5), 36, 2), (FA(5), 38, 2),
    (MI(5), 40, 4), (RE(5), 44, 4),
    (FA(5), 48, 2), (MI(5), 50, 1), (RE(5), 51, 1), (DOD(5), 52, 4),
    (RE(5), 56, 2), (LA(4), 58, 2), (DOD(5), 60, 4),
]


def lead():
    """
    Le crochet, porte par un synthetiseur qui perce.

    IL PASSE AU LEAD ET NON AU CELESTA, et c'est l'autre changement qui fait
    le morceau. Un celesta est joli et disparait des que la batterie entre :
    ses harmoniques tombent exactement la ou l'orgue et les cymbales sont
    deja. Une dent de scie tient sa place dans le melange, et c'est elle qu'on
    fredonne en sortant.

    Le celesta n'est pas perdu pour autant — il prend le break, ou il n'a plus
    personne devant lui (voir `celesta`).
    """
    e = []
    for depart, octave, force in ((0, 0, 96), (8, 12, 100), (24, 12, 104)):
        for h, d, duree in CROCHET:
            t = depart * MESURE + d * CROCHE
            note(e, 2, h + octave, t, duree * CROCHE, force)
            # Un doublage a la quinte inferieure sur le dernier passage :
            # deux voix paralleles sonnent deux fois plus large sans ajouter
            # une seule note a retenir.
            if depart == 24:
                note(e, 2, h + octave - 5, t, duree * CROCHE, force - 26)
    return e


def celesta():
    """
    Le break, et lui seul : la comptine nue.

    Quatre mesures ou tout s'est tu. C'est le seul moment du morceau ou l'on
    entend que la melodie est, en elle-meme, une chanson d'enfant — et c'est
    ce decalage qui inquiete, pas l'orgue.
    """
    e = []
    for h, d, duree in CROCHET[:16]:
        if d >= 32:
            continue
        t = 16 * MESURE + d * CROCHE
        note(e, 3, h, t, duree * CROCHE, 92)
        note(e, 3, h + 12, t, duree * CROCHE, 66)
    return e


# --------------------------------------------------------------------------
# LES CUIVRES — les contretemps
# --------------------------------------------------------------------------
def cuivres():
    """
    Des piques sur les contretemps, aux sections pleines.

    Ils ne jouent jamais avec l'orgue : celui-ci tient les appuis, les cuivres
    remplissent les trous entre eux. Deux instruments qui frappent ensemble ne
    font qu'un son plus fort ; frappes en alternance, ils font un groove.
    """
    e = []
    for m in list(B) + list(D) + list(REMONTEE):
        g = m % 8
        notes = GRILLE[g]
        force = 84 if m in REMONTEE else 96
        for i in (2, 5, 10, 13):
            t = m * MESURE + i * DOUBLE
            accord(e, 4, [notes[0] + 12, notes[-1] + 12], t, DOUBLE, force)
    return e


# --------------------------------------------------------------------------
# LE CHOEUR — la nappe du break, et le sommet
# --------------------------------------------------------------------------
def choeur():
    e = []
    for m in list(BREAK) + list(D):
        g = m % 8
        notes = GRILLE[g]
        force = 70 if m in BREAK else 58
        accord(e, 5, [notes[0] + 12, notes[2] + 12], m * MESURE, MESURE, force)
    return e


# --------------------------------------------------------------------------
# LES CLOCHES — le glas
# --------------------------------------------------------------------------
def cloches():
    """
    Cinq coups sur trente-deux mesures, jamais sur le premier temps.

    Voir l'en-tete : une cloche qui compte les heures devient une horloge.
    Ces cinq-la tombent sur le troisieme temps, la ou l'oreille ne les attend
    pas, et laissent sonner leur queue par-dessus la mesure suivante.
    """
    e = []
    for m, hauteur in ((3, RE(4)), (11, LA(3)), (19, RE(4)), (24, RE(4)), (29, LA(3))):
        note(e, 6, hauteur, m * MESURE + BLANCHE, MESURE, 100)
    return e


# --------------------------------------------------------------------------
# LES PERCUSSIONS
# --------------------------------------------------------------------------
GROSSE, CAISSE, CHARLEY, OUVERT = 36, 38, 42, 46
CYMBALE, TOM_H, TOM_M, TOM_B, CLAP = 49, 50, 47, 43, 39


def percussions():
    """
    La grosse caisse sur le 3+3+2, le clap sur les deux et quatre, le charley
    en doubles-croches.

    LE CLAP PLUTOT QUE LA SEULE CAISSE CLAIRE : il claque plus haut dans le
    spectre, la ou l'orgue et la basse ne sont pas, et c'est ce qui le rend
    audible sur un haut-parleur de telephone — le seul sur lequel ce morceau
    sera vraiment entendu.

    LES FILLS SONT COURTS, UNE DEMI-MESURE. Un fill d'une mesure entiere, sur
    un morceau ou le joueur n'entend que dix secondes, mange un dixieme de ce
    qu'il percevra du morceau.
    """
    e = []
    for m in range(MESURES):
        base = m * MESURE
        creux = m in BREAK
        fin_de_phrase = (m % 8) == 7

        if creux:
            # Le break garde un charley ouvert tous les temps, et rien d'autre :
            # de quoi ne pas perdre la pulsation pendant une seconde et demie.
            for i in range(0, 16, 4):
                note(e, CANAL_PERC, OUVERT, base + i * DOUBLE, CROCHE, 54)
            continue

        for i in APPUIS:
            note(e, CANAL_PERC, GROSSE, base + i * DOUBLE, DOUBLE,
                 108 if i in (0, 8) else 88)
        note(e, CANAL_PERC, CLAP, base + NOIRE, CROCHE, 100)
        note(e, CANAL_PERC, CLAP, base + 3 * NOIRE, CROCHE, 104)
        # La caisse claire double le clap aux sections pleines : le clap donne
        # le claquement, la caisse le corps.
        if m in D:
            note(e, CANAL_PERC, CAISSE, base + NOIRE, CROCHE, 80)
            note(e, CANAL_PERC, CAISSE, base + 3 * NOIRE, CROCHE, 84)

        for i in range(16):
            if fin_de_phrase and i >= 8:
                continue      # la place du fill
            force = 48 if i % 2 else 66
            note(e, CANAL_PERC, CHARLEY, base + i * DOUBLE, DOUBLE, force)

        if fin_de_phrase:
            # Le fill : huit doubles-croches de toms qui descendent puis
            # remontent, et une cymbale sur la mesure suivante.
            descente = [TOM_H, TOM_H, TOM_M, TOM_M, TOM_B, TOM_B, TOM_M, TOM_H]
            for k, tom in enumerate(descente):
                note(e, CANAL_PERC, tom, base + (8 + k) * DOUBLE, DOUBLE, 86 + k * 3)

        if m in (0, 8, 16, 20, 24):
            note(e, CANAL_PERC, CYMBALE, base, MESURE, 104)

    # La remontee : la caisse claire se resserre mesure apres mesure, de la
    # noire a la double-croche. C'est le seul endroit du morceau qui annonce
    # quelque chose, et il annonce le dernier drop.
    for k, m in enumerate(REMONTEE):
        pas = (NOIRE, CROCHE, CROCHE, DOUBLE)[k]
        t = m * MESURE
        i = 0
        while t + i < (m + 1) * MESURE:
            note(e, CANAL_PERC, CAISSE, m * MESURE + i, max(DOUBLE, pas),
                 58 + k * 12 + (i // pas) * 2)
            i += pas
    return e


# --------------------------------------------------------------------------
# LE MONTAGE
# --------------------------------------------------------------------------
# (nom de piste, canal, programme General MIDI, fabrique)
#
# Les programmes ne servent qu'au rendu de secours. Dans Logic ou FL, chaque
# piste arrive avec son nom et l'on y pose l'instrument qu'on veut : c'est la
# que le morceau cesse d'etre une maquette.
PISTES = [
    ('Basse - ostinato 3+3+2', 0, 38, basse),        # Synth Bass 1
    ("Orgue d'eglise - accents", 1, 19, orgue),       # Church Organ
    ('Lead - le crochet', 2, 81, lead),               # Lead 2 (sawtooth)
    ('Celesta - le break', 3, 8, celesta),            # Celesta
    ('Cuivres - contretemps', 4, 61, cuivres),        # Brass Section
    ('Choeur - nappe', 5, 52, choeur),                # Choir Aahs
    ('Cloches - le glas', 6, 14, cloches),            # Tubular Bells
    ('Percussions', CANAL_PERC, 0, percussions),
]

# Le placement stereo de chaque canal. La basse et la batterie au centre :
# tout ce qui porte le poids reste au milieu, sinon le morceau penche sur un
# haut-parleur de telephone.
PANORAMIQUE = {0: 64, 1: 52, 2: 72, 3: 80, 4: 46, 5: 84, 6: 70, 9: 64}


def construire(tours=1):
    """
    Le fichier MIDI, la partition jouee `tours` fois d'affilee.

    LES TOURS SE FONT EN RECOPIANT LES EVENEMENTS, DECALES D'UNE LONGUEUR DE
    BOUCLE — et surtout pas en allongeant `MESURES`. Les sections du morceau
    sont des plages de mesures fixes (le break est aux mesures 17 a 20) : en
    demandant simplement quatre-vingt-seize mesures aux fabriques, on
    n'obtient pas trois fois le morceau, on obtient un morceau trois fois plus
    long avec un seul break au debut. La recopie, elle, est exacte par
    construction.

    POURQUOI PLUSIEURS TOURS. Le rendu (molosse-rendu.swift) sait faire
    boucler une piste, et c'est ce qu'il faisait : il laissait un blanc de
    cinquante millisecondes au raccord, parce qu'un sequenceur coupe les
    notes en cours a la fin de la plage bouclee au lieu de les laisser sonner
    par-dessus la reprise. A 152 a la noire, cinquante millisecondes valent
    une triple-croche : ca s'entend comme un hoquet, a chaque tour, pendant
    toute une partie. En ecrivant les tours dans le fichier, il n'y a plus de
    raccord du tout — on rend trois tours, on garde celui du milieu, et le
    morceau retenu a des voisins des deux cotes.
    """
    microsec = int(60_000_000 / TEMPO_BPM)
    reglages = [
        (0, b'\xFF\x51\x03' + microsec.to_bytes(3, 'big')),
        (0, b'\xFF\x58\x04\x04\x02\x18\x08'),      # 4/4
        (0, b'\xFF\x59\x02\xFE\x01'),              # re mineur : deux bemols
    ]
    titre = 'La nuit du molosse'.encode('utf-8')
    reglages.append((0, b'\xFF\x03' + vlq(len(titre)) + titre))
    pistes = [piste(reglages)]

    boucle = MESURES * MESURE
    for nom, canal, programme, fabrique in PISTES:
        evts = []
        if canal != CANAL_PERC:
            evts.append((0, bytes([0xC0 | canal, programme])))
        evts.append((0, bytes([0xB0 | canal, 91, 68])))                 # reverb
        evts.append((0, bytes([0xB0 | canal, 10, PANORAMIQUE[canal]]))) # stereo
        un_tour = fabrique()
        for k in range(tours):
            evts += [(t + k * boucle, d) for t, d in un_tour]
        pistes.append(piste(evts, nom))

    return fichier(pistes)


if __name__ == '__main__':
    import sys
    ici = os.path.dirname(os.path.abspath(__file__))
    tours = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    sortie = os.path.join(ici, 'molosse.mid' if tours == 1 else 'molosse-x%d.mid' % tours)
    donnees = construire(tours)
    with open(sortie, 'wb') as f:
        f.write(donnees)
    duree = MESURES * tours * 4 * 60 / TEMPO_BPM
    print('ecrit : %s' % sortie)
    print('%d pistes, %d mesures x %d tour(s), %d BPM — %.1f s'
          % (len(PISTES), MESURES, tours, TEMPO_BPM, duree))
    print('%d octets' % len(donnees))
