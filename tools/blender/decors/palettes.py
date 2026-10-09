# -----------------------------------------------------------------------
# Les couleurs de chaque stade, pour les decors.
#
# Elles partent des THEMES de sprinter-app.js — un decor qui ne reprend pas
# la palette de son stade s'y lit comme une piece rapportee. Le materiel
# (tapis bleus, sable, beton) garde ses couleurs reelles, legerement
# accordees a la lumiere du stade.
# -----------------------------------------------------------------------

BASE = {
    'beton': (196, 194, 188), 'cercle': (132, 130, 128), 'metal': (168, 174, 184),
    'filet': (40, 44, 54), 'blanc': (242, 242, 238), 'sombre': (46, 48, 58),
    'tapis': (34, 86, 172), 'tapisDessus': (58, 118, 204), 'barre': (246, 196, 52),
    'toile': (222, 222, 214), 'sable': (222, 190, 138),
}

PALETTES = {
    # les quatre premieres etapes : piste rouge, pelouse verte, accent orange
    'day': dict(BASE, accent=(240, 158, 46), elan=(138, 10, 10),
                pavillons=[(214, 74, 62), (44, 108, 186), (240, 196, 70)]),
    # les Jeux mondiaux : piste bleue, liseret vert, pavillons vert-blanc-or
    'mondiaux': dict(BASE, accent=(56, 196, 92), elan=(21, 70, 158),
                     tapis=(22, 56, 128), tapisDessus=(40, 86, 164),
                     pavillons=[(56, 196, 92), (255, 255, 255), (240, 196, 70)]),
}


# -----------------------------------------------------------------------
# LES STADES ET CE QU'ILS PORTENT
# -----------------------------------------------------------------------
# `debout` / `sol` : les pieces a rendre. `symetriques` : celles qu'on
# regarde pareil de tous les cotes, rendues sous un seul cap. `contours` :
# un trait noir autour des formes, pour les stades dessines a l'encre.

PALETTES.update({
    'cosmos': dict(BASE, roche=(58, 44, 84), monolithe=(30, 22, 48), metalCosmos=(150, 138, 186),
                   cristalA=(232, 121, 216), cristalB=(52, 190, 196), accent=(232, 121, 216)),
    'danube': dict(BASE, remorque=(52, 44, 68), metal=(128, 124, 144), sombre=(26, 24, 34),
                   accent=(236, 46, 150),
                   panneaux=[(236, 46, 150), (56, 214, 236), (128, 78, 222)]),
    'riviera': dict(BASE, paliers=3, liseret=0.35, creme=(255, 248, 236), corail=(247, 138, 100),
                    turquoise=(72, 184, 194),
                    cabinesToit=[(240, 131, 156), (46, 190, 200), (247, 201, 96)],
                    cabinesRayure=[(240, 131, 156), (46, 190, 200), (247, 201, 96)]),
    'nuit': dict(BASE, paliers=0, liseret=0.6, fer=(28, 44, 52), lueur=(250, 214, 96), table=(214, 178, 96),
                 ors=[(226, 172, 62), (242, 198, 88), (208, 152, 52), (234, 184, 72)]),
    'namek': dict(BASE, paliers=3, liseret=0.0, roche=(122, 176, 168), rocheSombre=(56, 110, 116),
                  tronc=(206, 186, 142), chapeau=(34, 148, 118)),
})

STADES = {
    'day': dict(debout=['cage', 'hauteur', 'perche', 'haies', 'drapeaux', 'tente'],
                sol=['longueur', 'poids'], symetriques=['cage', 'drapeaux']),
    'mondiaux': dict(debout=['cage', 'hauteur', 'perche', 'haies', 'drapeaux', 'tente'],
                     sol=['longueur', 'poids'], symetriques=['cage', 'drapeaux']),
    'cosmos': dict(debout=['cristaux', 'obelisque', 'antenne', 'rocher_flottant'], sol=[],
                   symetriques=['cristaux', 'obelisque', 'antenne', 'rocher_flottant']),
    'danube': dict(debout=['tour_lumiere', 'camera_tv', 'grue', 'ecran_retour',
                           'caisses', 'projecteur_sol'], sol=[],
                   symetriques=['tour_lumiere', 'caisses', 'projecteur_sol']),
    'riviera': dict(debout=['vigie', 'cabines'], sol=[], symetriques=[]),
    'nuit': dict(debout=['meule', 'lanterne'], sol=[], symetriques=['meule', 'lanterne']),
    'namek': dict(debout=['rocs', 'bulbes', 'aiguille'], sol=[],
                  symetriques=['rocs', 'bulbes', 'aiguille'], contours=True),
}

# LA PISTE ARC-EN-CIEL. Ses pieces (pieces_arcenciel.py) sont les seules du
# jeu en ECLAIRAGE REEL : Cycles, or, laque, chrome et neons, au lieu de la
# formule plate du moteur (voir reel.py). Rendues plus fin que les autres
# stades (128 pixels par metre, 96 echantillons debruites) : elles brillent,
# et une arete de lumiere crenelee se voit bien plus qu'une arete de beton.
# Et SANS OMBRE AU SOL : il n'y a pas de sol sous cette piste, seulement le
# vide — chaque piece porte sa lueur a la place. Leurs couleurs sont dans
# leur module ; la palette ci-dessous ne sert plus qu'a declarer le stade.
PALETTES['arcenciel'] = dict(
    BASE, liseret=1.0,
    arc=[(238, 58, 72), (250, 138, 44), (252, 212, 60), (84, 206, 94), (52, 194, 234),
         (70, 108, 240), (168, 86, 236)],
    nuage=(238, 234, 255), blanc=(250, 248, 255), rouge=(232, 58, 78),
    metal=(196, 200, 222), sombre=(46, 40, 76),
    feuille=(236, 184, 64), panneau=(36, 64, 168), panneauTrait=(150, 206, 255),
    globe=[(236, 96, 196), (120, 84, 226), (70, 196, 222)],
    **{'or': (255, 200, 52), 'orClair': (255, 232, 140)})
STADES['arcenciel'] = dict(debout=['arche', 'etoile', 'satellite', 'fusee', 'planete', 'borne'],
                           sol=[], symetriques=['etoile', 'fusee', 'planete', 'borne'],
                           virage=['arche', 'satellite'],
                           pxParM=128, echantillons=96, sansOmbre=True, eclairage='reel')

# Les pieces orientees qu'on pose aussi dans un virage : rendues sous seize
# caps en plus des quatre des lignes droites (voir CAPS_VIRAGE).
for _st, _pieces in (('day', ['hauteur', 'perche', 'tente']),
                     ('mondiaux', ['hauteur', 'perche', 'tente']),
                     ('danube', ['grue', 'ecran_retour']),
                     ('riviera', ['vigie', 'cabines'])):
    STADES[_st]['virage'] = _pieces

# Le materiel de piste, le meme dans tous les stades : un bloc de depart ne
# prend pas la couleur du lieu. Rendu plus fin (petit objet vu de pres), et
# sous trente-deux caps : dans le virage, les huit blocs s'echelonnent et
# chacun a son propre angle.
PALETTES['materiel'] = dict(BASE)
STADES['materiel'] = dict(debout=['blocs'], sol=[], symetriques=[], caps=32, pxParM=160)

# LE STADE JEAN-DELBERT, A MONTREUIL (defi Aurel Manga). Ses deux pieces
# viennent de Tripo (pieces_tripo.py) : la cabine du chronometrage sur ses
# pilotis et un mat d'eclairage, d'apres les photos du lieu. Leur couleur est
# celle de leur texture : la palette ne sert qu'a declarer le stade. Le mat
# se regarde pareil de partout ; la cabine a une face, tournee vers la piste.
PALETTES['montreuil'] = dict(BASE)
STADES['montreuil'] = dict(debout=['cabine', 'mat'], sol=[], symetriques=['mat'])
# La ruelle de la nuit du molosse : maisons et reverberes Tripo, rendus sous
# les cameras basses des nuits (fabriquer.py --angle). Les maisons longent la
# piste en ligne droite ET dans les virages : tous les caps.
PALETTES['halloween'] = dict(BASE)
# Sans ombre au sol : une ombre de plein soleil n'a rien a faire dans une
# ruelle de nuit, et son rendu Cycles coutait plusieurs minutes par cap.
STADES['halloween'] = dict(debout=['maison', 'reverbere', 'porte', 'poubelles'], sol=[],
                           symetriques=['reverbere'], virage=['maison', 'porte', 'poubelles'],
                           pxParM=96, sansOmbre=True)
