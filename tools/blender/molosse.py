# CE SCRIPT NE SERT PAS AU JEU, ET IL FAUT LE SAVOIR AVANT DE LE RELANCER.
#
# Il a ete ecrit pour remplacer le trace du molosse par des images rendues.
# La mesure l'a condamne apres coup, et elle est simple : `scaleM()` vaut
# `ui() * 30` en ligne droite, `ui() * 44` en courbe — UNE CONSTANTE PAR
# COURSE, sans terme de distance. La bete fait 49 x 26 pixels du premier
# metre au dernier, et ne grandit jamais. A cette taille un rendu ne montre
# rien qu'un trace ne montre deja.
#
# Les huit images rendues ont donc ete retirees de public/ : posees la, elles
# partaient dans les DEUX builds — y compris le public, ou le mode n'existe
# pas — sans qu'aucun drapeau ne puisse les retenir, puisque public/ est
# recopie tel quel.
#
# CE QU'IL RESTE DE VRAI ICI, et c'est pourquoi on le garde : ce que les
# metaballs demandent pour faire une bete d'un seul tenant. Elles ne fusionnent
# que par la DENSITE et une RIGIDITE BASSE, jamais par la resolution ; et une
# patte fine veut vingt-quatre masses la ou cinq donnaient un chapelet de
# billes. Si un jour une image du molosse doit etre rendue en grand — une
# affiche, un carton, une vignette de partage — cela se reprend ici.
#
# Pour le jeu, ce qui compte se joue dans game/halloween-molosse.js : la
# silhouette, le rythme du galop, et les deux yeux.

# -----------------------------------------------------------------------
# LA NUIT DU MOLOSSE — la bete, sculptee et rendue sous la vue du jeu.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/molosse.py
#
# Elle etait dessinee au trait, en capsules empilees dans un canvas. A trente
# pixels le metre ca tenait ; agrandie, la silhouette se lisait comme une
# table a quatre pieds, et aucun reglage d'epaisseur n'y changeait rien — une
# somme de segments arrondis n'a aucune des inflexions qui font reconnaitre un
# animal : le stop du front, la nuque, le garrot, le creux du flanc.
#
# On la sculpte donc, comme les decors des stades le sont deja
# (tools/blender/decors/), et pour la meme raison : ce que le moteur ne sait
# pas tracer en quelques lignes, Blender le rend une fois pour toutes.
#
# DES METABALLS, ET NON UN MAILLAGE SCULPTE A LA MAIN.
#
# Une metaball est une masse qui FUSIONNE avec ses voisines : posees le long
# d'une colonne vertebrale, avec le bon rayon a chaque vertebre, elles
# donnent d'elles-memes le galbe d'un animal — le poitrail qui enfle, la
# taille qui se pince, la cuisse qui se noue. C'est exactement la methode que
# le projet emploie deja pour les coureurs (tools/blender/anatomie.py), et
# elle a ici un avantage de plus : le cycle de galop se calcule en deplacant
# des points, sans squelette ni peau a lier.
#
# HUIT PHASES, UN SEUL ANGLE. Le jeu regarde toujours la piste du meme point
# de vue — la camera du moteur est fixe en orientation, elle ne fait que
# suivre le coureur. Un angle suffit donc, et huit phases couvrent un cycle
# de galop sans qu'on voie sauter la foulee.
#
# CE QUE BLENDER NE FAIT PAS, ET POURQUOI. Ni l'oeil, ni le halo, ni la gueule
# ouverte, ni la bave, ni l'echine herissee : tout cela doit REAGIR a la
# distance qui separe la bete du joueur (voir halloween-molosse.js), et un
# sprite ne reagit a rien. Blender donne le corps et le galop — la partie
# qu'on ne sait pas tracer — et le canvas pose par-dessus ce qui doit vivre.
# -----------------------------------------------------------------------

import bpy
import sys
import os
import math
import json

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, 'decors'))
import vue      # noqa: E402  (il faut le chemin avant l'import)

# Le nombre de pixels par metre du sprite. Le jeu dessine la bete a une
# trentaine de pixels le metre en course ; on rend au quadruple pour que
# l'image tienne aussi sur la page d'apercu et sur un ecran dense, et le
# moteur reduit.
PX_PAR_M = 120.0

# Combien d'images pour un cycle de galop complet.
PHASES = 8

# OU LES IMAGES ATTERRISSENT, ET POURQUOI CE N'EST PLUS EN DUR.
#
# Elles allaient dans public/molosse/. C'est precisement ce qui a coute leur
# retrait : public/ est recopie tel quel dans LES DEUX builds, y compris le
# public ou le mode n'existe pas, et aucun drapeau ne peut l'en empecher (voir
# HALLOWEEN_OUVERT dans game/canal.ts). Huit images d'une edition limitee
# etaient telechargeables un mois avant son ouverture.
#
# Le dossier se choisit donc a l'appel, et le defaut est un dossier de travail
# hors du depot : on regarde ce qu'on a rendu avant de decider ou ca vit.
#
#   MOLOSSE_SORTIE=/chemin  python tools/blender/molosse.py
SORTIE = os.environ.get('MOLOSSE_SORTIE') or os.path.join(ICI, '..', '..', '.rendus', 'molosse')

# --- les mesures de la bete, en metres ---------------------------------
# Les memes que celles du trace qu'elle remplace, pour que rien ne bouge dans
# le jeu : un metre au garrot, un metre quatre-vingt-cinq du poitrail a la
# croupe. A cote d'un coureur d'un metre soixante-quinze, elle arrive a
# hauteur de hanche.
GARROT = 1.02
LONG = 1.85
PATTE = 0.94

# La colonne, du poitrail a la croupe : (avancement, hauteur, rayon).
#
# C'EST CETTE TABLE QUI FAIT L'ANIMAL. Le rayon enfle au poitrail (0,30) et
# se pince au rein (0,17) : c'est la taille creusee d'une bete batie pour
# courir. Un rayon constant donnerait un tube, et c'est precisement le defaut
# du trace qu'on remplace.
# LA HAUTEUR EST CELLE DE L'AXE, LE RAYON S'Y AJOUTE. Premiere version : des
# hauteurs proches du garrot PLUS des rayons de trente centimetres, et la bete
# culminait a un metre trente. On pose donc l'axe bas et l'on laisse le rayon
# faire le dos.
#
# CORRIGE APRES AVOIR REGARDE LE RENDU, ET C'EST TOUT L'INTERET DE REGARDER.
# La premiere table donnait un LEVRIER : encolure fine, taille tres creusee,
# museau long. Sur la planche de contact, les huit phases montraient une bete
# mince et pale qui ne ressemblait a rien de ce que le mode raconte — le
# molosse est un chien LOURD, et sa peur vient de sa masse, pas de sa vitesse.
#
# Ce qui a change, et pourquoi chaque nombre :
#   - L'ENCOLURE PASSE DE 0,18 A 0,25. Un molosse a un cou presque aussi epais
#     que son crane. C'est le premier signe qu'on lit sur une silhouette : un
#     cou fin dit « il court vite », un cou epais dit « il va me faire mal ».
#   - LE POITRAIL PASSE DE 0,25 A 0,32, et descend. C'est la partie qu'on voit
#     arriver dans le coin de l'ecran.
#   - LE REIN NE SE PINCE PLUS QU'A 0,225 au lieu de 0,17. La taille creusee
#     d'un levrier lisait comme de la maigreur ; celle-ci lit comme un flanc.
#   - LA CROUPE EPAISSIT (0,19 -> 0,235) : c'est elle qui pousse, et on doit
#     voir d'ou vient la poussee.
COLONNE = [
    (+0.86, 0.48, 0.175),  # la gorge, pleine
    (+0.72, 0.55, 0.250),  # l'encolure, epaisse — la marque du molosse
    (+0.54, 0.62, 0.300),  # le garrot, haut et large
    (+0.34, 0.60, 0.320),  # le poitrail, le plus profond, et il descend
    (+0.14, 0.61, 0.270),  # le dos
    (-0.08, 0.61, 0.225),  # le rein, a peine pince
    (-0.30, 0.62, 0.235),  # la croupe, qui pousse
    (-0.50, 0.60, 0.170),  # la naissance de la queue
]

# LA TETE — et le commentaire d'origine disait exactement l'inverse de la
# verite. Il affirmait qu'« un museau court donne un chien de salon », et la
# table qui suivait donnait un museau long et fin : quinze centimetres de rayon
# au crane, cinq a la truffe, sur trente-huit centimetres de longueur. Le rendu
# l'a tranche — c'etait un museau de LEVRIER, et de loin ca se lisait comme un
# bec.
#
# Un museau court ne donne pas un chien de salon : il donne un molosse. C'est
# la definition meme de la famille — brachycephale, machoire large et courte,
# faite pour tenir et non pour attraper. Ce qui donne un chien de salon, c'est
# la TAILLE, pas les proportions du crane.
#
# Le museau raccourcit donc de 1,35 a 1,255, et double d'epaisseur. Et l'on
# creuse un STOP : la cassure entre le front et le chanfrein, cette marche que
# tous les molosses ont et qu'aucun levrier n'a. C'est trois centimetres de
# hauteur, et c'est ce qui fait qu'on reconnait la bete de profil a vingt
# metres.
TETE = [
    (+0.95, 0.475, 0.205),  # le crane, large
    (+1.05, 0.470, 0.180),  # le front, plein
    (+1.10, 0.440, 0.140),  # LE STOP — la cassure sous le front
    (+1.18, 0.430, 0.130),  # le chanfrein, court et profond
    (+1.255, 0.425, 0.105), # la truffe, large
]

# Les quatre pattes : (avancement de l'epaule, hauteur de l'epaule, phase).
# Les memes decalages de phase que le trace : galop transverse.
EPAULES = [
    (-0.42, 0.80, 0.00, False),
    (-0.42, 0.80, 0.12, False),
    (+0.42, 0.86, 0.45, True),
    (+0.42, 0.86, 0.57, True),
]
# L'ecartement des deux cotes, en metres.
VOIE = 0.17


def nettoyer():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def pied_de(u, amplitude):
    """Ou se trouve le pied a la phase `u`, dans le repere de la bete.

    La meme loi que le trace (halloween-molosse.js, `pied`) : contact sur la
    premiere moitie, le pied au sol qui recule sous le corps ; rappel sur la
    seconde, la patte qui se replie et revient devant. Les deux doivent
    coincider, sinon le sprite et l'ombre que le jeu dessine sous lui ne
    racontent pas la meme foulee.
    """
    if u < 0.5:
        k = u / 0.5
        return amplitude * (0.5 - k), 0.0
    k = (u - 0.5) / 0.5
    return amplitude * (-0.5 + k), math.sin(k * math.pi) * amplitude * 0.52


def bete(phase):
    """Une metaball par masse, posee pour cette phase du galop."""
    mb = bpy.data.metaballs.new('molosse')
    # La resolution decide de la finesse de la peau. 0,012 donne une surface
    # lisse a cent vingt pixels le metre sans faire exploser le temps de
    # rendu ; au-dela on compte les facettes sur le museau.
    mb.resolution = 0.012
    mb.render_resolution = 0.010
    obj = bpy.data.objects.new('molosse', mb)
    bpy.context.collection.objects.link(obj)

    def masse(x, y, z, r, rigide=2.0):
        e = mb.elements.new()
        e.co = (x, y, z)
        e.radius = r
        e.stiffness = rigide
        return e

    # Le corps oscille : le dos se cambre deux fois par foulee, et la bete
    # decolle une fois. C'est la respiration du galop — sans elle, l'animal
    # glisse sur ses pattes comme un jouet a roulettes.
    cambre = math.sin(phase * 2 * math.pi) * 0.030
    bond = max(0.0, math.sin(phase * 2 * math.pi - 0.6)) * 0.085

    for i in range(len(COLONNE) - 1):
        x0, h0, r0 = COLONNE[i]
        x1, h1, r1 = COLONNE[i + 1]
        for k in range(3):
            a = k / 3.0
            x, h, r = x0 + (x1 - x0) * a, h0 + (h1 - h0) * a, r0 + (r1 - r0) * a
            # La cambrure porte surtout le rein, pas les epaules.
            poids = math.sin((i + a) / (len(COLONNE) - 1) * math.pi)
            # RIGIDITE HAUTE SUR LE TRONC, et c'est ce qui rend le reste
            # visible. Une metaball de trente centimetres de rayon a la
            # rigidite par defaut porte son champ bien au-dela d'elle-meme :
            # elle absorbait les oreilles, le haut des pattes et le stop du
            # crane, et la bete sortait en une masse lisse — un phoque. A 3,2
            # le champ se resserre sur la masse : le galbe du flanc reste (il
            # vient de la SUITE des masses, pas de leur portee), mais ce qui
            # est pose a cote cesse d'etre englouti.
            masse(x * 0.925, 0.0, h * GARROT + bond + cambre * poids, r, 3.2)
    x, h, r = COLONNE[-1]
    masse(x * 0.925, 0.0, h * GARROT + bond, r)

    # Le cou et la tete plongent vers l'avant : la posture de la poursuite.
    # On interpole entre les points donnes pour que la chaine reste dense —
    # meme raison que pour les pattes.
    for i in range(len(TETE) - 1):
        x0, h0, r0 = TETE[i]
        x1, h1, r1 = TETE[i + 1]
        for k in range(3):
            a = k / 3.0
            masse((x0 + (x1 - x0) * a) * 0.925, 0.0,
                  (h0 + (h1 - h0) * a) * GARROT + bond * 0.7, r0 + (r1 - r0) * a)
    x, h, r = TETE[-1]
    masse(x * 0.925, 0.0, h * GARROT + bond * 0.7, r)

    # LA MACHOIRE — trois masses, et non une.
    #
    # Une seule, posee a 0,060 sous le milieu du museau, ne suffisait pas : le
    # profil s'affinait quand meme en pointe, et le rendu montrait un bec. Or
    # c'est la gueule que le joueur voit arriver — c'est la partie de l'animal
    # qui porte la menace, et la seule qui doive se lire a deux metres.
    #
    # Un molosse a un bas de machoire qui DEBORDE : plus large que le
    # chanfrein, plus lourd, et il descend franchement. On pose donc une
    # chaine qui suit le museau par en dessous, epaisse a la naissance et
    # encore large a la pointe — c'est ce qui donne la gueule carree.
    for t, r in ((0.00, 0.115), (0.45, 0.098), (1.00, 0.072)):
        masse((1.05 + 0.20 * t) * 0.925, 0.0,
              (0.375 - 0.020 * t) * GARROT + bond * 0.7, r)
    # Et les babines, de part et d'autre : deux masses basses et ecartees qui
    # elargissent la gueule vue de trois quarts, l'angle exact du jeu.
    for cote in (-1, 1):
        masse(1.14 * 0.925, cote * 0.062, 0.385 * GARROT + bond * 0.7, 0.072)

    # LES OREILLES — elles se lisaient comme des AILERONS.
    #
    # Deux masses de 0,050, posees a 0,88 — donc SEPT CENTIMETRES DERRIERE le
    # crane, qui commence a 0,95 — et ecartees de sept centimetres seulement.
    # A cette position elles ne fusionnaient pas avec le crane mais avec le
    # COU, et elles en sortaient vers l'arriere : sur la planche de contact,
    # deux nageoires.
    #
    # Une oreille de molosse part du HAUT DU CRANE, sur les cotes, et tombe.
    # On la pose donc sur le crane meme, plus ecartee, et on la fait DESCENDRE
    # en deux masses : une attache haute et serree, un pavillon plus bas et
    # plus large. C'est la chute qui fait reconnaitre l'oreille — une bosse
    # ronde posee sur la tete ne se lit pas du tout.
    for cote in (-1, 1):
        masse(0.96 * 0.925, cote * 0.105, 0.545 * GARROT + bond * 0.7, 0.058)
        masse(0.93 * 0.925, cote * 0.118, 0.475 * GARROT + bond * 0.7, 0.070)

    # Les quatre pattes. Chacune est une chaine de masses qui va de l'epaule
    # au pied en passant par le coude, et le coude est pousse vers l'avant
    # devant, vers l'arriere derriere : c'est ce pli inverse qui fait lire un
    # quadrupede et non un homme a quatre jambes.
    amp = PATTE * 1.05
    for k, (ex, eh, ph, avant) in enumerate(EPAULES):
        cote = -1 if k % 2 == 0 else 1
        u = (phase + ph) % 1.0
        px, pz = pied_de(u, amp)
        hx, hz = ex * 0.925, eh * GARROT + bond
        fx, fz = hx + px, pz
        cx = (hx + fx) * 0.5 + (0.07 if avant else -0.10)
        cz = (hz + fz) * 0.5
        y = cote * VOIE
        # UNE MASSE TOUS LES QUATRE CENTIMETRES, ET UNE RIGIDITE BASSE.
        #
        # Deux metaballs ne fusionnent que si leurs champs se recouvrent, et
        # le champ d'une masse porte d'autant plus loin que sa RIGIDITE est
        # faible. Premiere version : cinq masses rigides a 2,0, ecartees du
        # double de leur rayon — la patte sortait en chapelet de billes.
        # Neuf ne suffisaient pas davantage. A vingt-quatre masses et une
        # rigidite de 1,1, le membre est continu et reste fin, ce qui est tout
        # le probleme d'une patte : mince ET soudee.
        # LE RAYON NE DECROIT PAS EN LIGNE DROITE, et c'est ce qui faisait
        # des BATONS. L'ancienne loi — 0,098 a l'epaule, 0,040 au pied, en
        # interpolation lineaire — donne un tube regulierement effile : ce
        # qu'on appelle un pied de table.
        #
        # Une patte de chien n'a rien de regulier. Le tiers haut est un
        # MUSCLE — cuisse derriere, bras devant — et c'est la partie la plus
        # epaisse de l'animal apres le poitrail. Puis ca se PINCE brutalement
        # au coude ou au grasset. Puis l'avant-bras descend presque droit et
        # fin. Ce profil-la, epais-pince-fin, est ce qui se lit comme une
        # patte meme reduite a quarante pixels de haut.
        #
        # Le muscle ne descend qu'a 35 % de la longueur : plus bas, on
        # obtient une cuisse de grenouille.
        def rayon_de(t):
            if t < 0.35:
                # De l'attache au bas du muscle : large, et qui enfle un peu
                # avant de se pincer.
                a2 = t / 0.35
                return 0.155 - 0.020 * a2 * a2
            if t < 0.50:
                # Le pincement de l'articulation, court et franc.
                a2 = (t - 0.35) / 0.15
                return 0.135 - 0.072 * a2
            # L'avant-bras, fin, qui s'affine doucement jusqu'au boulet.
            a2 = (t - 0.50) / 0.50
            return 0.063 - 0.021 * a2

        for j in range(28):
            t = j / 27.0
            r = rayon_de(t)
            if t <= 0.55:
                a = t / 0.55
                x, z = hx + (cx - hx) * a, hz + (cz - hz) * a
            else:
                a = (t - 0.55) / 0.45
                x, z = cx + (fx - cx) * a, cz + (fz - cz) * a
            # LA RIGIDITE MONTE AVEC LA FINESSE. Le muscle du haut doit fondre
            # dans le flanc — c'est une continuite anatomique — mais
            # l'avant-bras doit en RESSORTIR, sinon les quatre membres se
            # noient dans le tronc et l'on retrouve la masse unique que la
            # planche de contact montrait. Une rigidite plus haute resserre le
            # champ de la masse : elle ne fusionne plus qu'avec ses voisines
            # immediates.
            masse(x, y, z, r, 1.1 if t < 0.35 else 1.9)
        # LE PIED EST UN PATTE, PAS UNE BILLE. Une sphere de 0,052 au bout
        # d'un tube donne exactement la bille au bout du pied de table. Trois
        # masses posees a plat, ecartees dans le sens de la marche, donnent
        # une surface d'appui — et c'est cette surface qu'on lit comme un
        # pied qui porte le poids de l'animal.
        for dx, r in ((0.010, 0.050), (0.046, 0.055), (0.080, 0.044)):
            masse(fx + dx, y, fz + 0.018, r, 2.2)

    # LA QUEUE FAISAIT LE RAT, et c'etait l'element le plus nuisible de toute
    # la sculpture.
    #
    # Soixante-six centimetres de long, de 0,072 a 0,038 de rayon : un fouet
    # fin, presque aussi long que le tronc, tendu droit vers l'arriere. Sur la
    # planche de contact c'etait la premiere chose qu'on voyait, et elle disait
    # « rongeur » avant que la silhouette ait le temps de dire autre chose.
    #
    # Un molosse porte une queue COURTE et EPAISSE, attachee bas, qui s'affine
    # vite. Elle fait un tiers de la longueur du corps, pas les trois quarts.
    # Elle passe donc de 0,66 a 0,38 m, et son rayon de naissance double — a
    # 0,125 elle part du corps comme un prolongement de la croupe, ce qui est
    # exactement ce qu'elle est.
    bat = math.sin(phase * 2 * math.pi * 1.5) * 0.10
    for j in range(14):
        t = j / 13.0
        masse(-0.50 * 0.925 - t * 0.38, bat * t * 0.5,
              0.60 * GARROT + bond - t * 0.06 + bat * t,
              0.125 - 0.082 * t * t, 1.4)

    return obj


def matiere_oeil():
    """Le rouge des yeux, en emission pure.

    IL NE S'ECLAIRE PAS, IL ECLAIRE. Un materiau diffus rendu dans une scene
    sans lumiere sortirait noir ; ici la couleur EST l'emission, comme pour le
    poil (voir matiere_bete) et pour les decors du jeu. La difference est la
    force : le poil emet a 1,0 — c'est un aplat — l'oeil a 9,0, ce qui le fait
    deborder de lui-meme au rendu et donne le halo sans qu'on ait a le
    dessiner.
    """
    m = bpy.data.materials.new('oeil')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    sortie = nt.nodes.new('ShaderNodeOutputMaterial')
    emis = nt.nodes.new('ShaderNodeEmission')
    emis.inputs['Color'].default_value = (1.0, 0.12, 0.05, 1)
    # 9,0 SATURAIT VERS LE BLANC. Le capteur virtuel ecrete comme un vrai :
    # au-dela d'une certaine force, les trois canaux montent ensemble et le
    # rouge devient rose puis blanc. A 4,5 l'oeil deborde encore — c'est ce
    # qu'on veut, le halo sans le dessiner — mais il reste rouge.
    emis.inputs['Strength'].default_value = 4.5
    nt.links.new(emis.outputs['Emission'], sortie.inputs['Surface'])
    return m


def yeux(phase):
    """LES DEUX YEUX — la signature du mode, et ils n'etaient pas dans le rendu.

    Le tracé à la main les pose depuis le premier jour (halloween-molosse.js) :
    deux points rouges dans le noir, et c'est a eux qu'on reconnait la bete
    avant d'en distinguer la forme. Le rendu, lui, ne montrait qu'une masse
    sombre sans regard.

    DES SPHERES A PART, ET NON DES METABALLS. Une metaball rouge posee sur le
    crane aurait FUSIONNE avec lui : le champ de la tete l'aurait absorbee, et
    l'on aurait obtenu une bosse de la couleur du poil. Les yeux sont donc deux
    objets independants, avec leur propre materiau, poses en surface.

    Ils suivent le `bond` du galop comme la tete, sans quoi ils flotteraient
    devant elle a chaque foulee.
    """
    bond = max(0.0, math.sin(phase * 2 * math.pi - 0.6)) * 0.085
    mat = matiere_oeil()
    out = []
    for cote in (-1, 1):
        # QUATRE CENTIMETRES NE SE VOYAIENT PAS. A l'echelle du jeu l'oeil
        # sortait a un pixel et demi : un point perdu, la ou le tracé à la
        # main en fait la signature du mode. A sept, il porte — et l'emission
        # a 9,0 le fait deborder, ce qui vaut mieux qu'un oeil plus gros
        # encore, qui aurait donne une bete de dessin animé.
        # SEPT CENTIMETRES ONT FAIT UN GROIN. Deux spheres de ce rayon,
        # ecartees de huit, se touchaient presque : au rendu elles ont fusionne
        # en une seule masse rose posee au bout du museau — un nez de cochon.
        # Et l'emission a 9,0 les saturait vers le blanc, ce qui achevait de
        # les faire lire comme de la chair et non comme un regard.
        #
        # Un oeil rouge dans le noir n'a pas besoin d'etre gros : il a besoin
        # d'etre SEPARE de son jumeau et d'etre ROUGE. On revient a 4,5 cm, on
        # les ecarte a plus du double de leur diametre, et l'on baisse
        # l'emission pour qu'ils gardent leur teinte.
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, segments=16, ring_count=10)
        o = bpy.context.object
        o.name = 'oeil'
        # Sur le haut du chanfrein, juste devant le stop : c'est la que l'oeil
        # d'un chien se trouve, et c'est la que le regard part vers l'avant.
        # ET ILS ETAIENT SUR LE MUSEAU. A 1,085 on est en plein chanfrein,
        # devant le stop : c'est l'emplacement d'une narine, pas d'un oeil.
        # L'oeil d'un chien est EN ARRIERE du stop, sur le cote du crane.
        o.location = (1.015 * 0.925, cote * 0.112,
                      0.505 * GARROT + bond * 0.7)
        o.data.materials.append(mat)
        for poly in o.data.polygons:
            poly.use_smooth = True
        out.append(o)
    return out


def matiere_bete():
    """Un aplat sombre qui ne recoit aucune ombre.

    C'est la regle du jeu, et matiere.py l'explique pour les decors : les
    personnages n'ont pas d'ombre portee sur eux, donc la couleur vient d'une
    emission. Ici on ajoute une seule chose — un leger eclaircissement vers le
    haut, qui donne le fil de lumiere sur l'echine sans quoi une bete noire
    sur une nuit noire n'a plus de volume du tout.
    """
    m = bpy.data.materials.new('poil')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    sortie = nt.nodes.new('ShaderNodeOutputMaterial')
    emis = nt.nodes.new('ShaderNodeEmission')
    melange = nt.nodes.new('ShaderNodeMixRGB')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')

    nt.links.new(geo.outputs['Normal'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    # LA RAMPE S'OUVRAIT BEAUCOUP TROP TOT, et c'est ce qui rendait la bete
    # PALE. Elle part de la normale en Z : a 0,10, toute surface qui monte un
    # tant soit peu prenait deja de l'eclaircissement — et dans la vue
    # isometrique du jeu, c'est presque tout l'animal. Le resultat etait une
    # masse lavande claire sur une nuit sombre, soit l'inverse de ce qu'on
    # veut : une silhouette se lit sombre sur clair, ou sombre tout court.
    #
    # Le fil de lumiere sur l'echine doit rester un FIL. On ne l'ouvre donc
    # qu'a partir de 0,62 — le haut du dos, et rien d'autre.
    ramp.color_ramp.elements[0].position = 0.62
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 1.00
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    # Les deux teintes : le noir bleute du poil, et l'eclaircissement du dos.
    # Un noir pur ferait un trou dans l'image.
    #
    # LE HAUT BAISSE AUSSI. A 0,200 en lineaire, le fil sortait a pres de la
    # moitie du blanc une fois converti pour l'ecran — ce n'est plus un reflet
    # de lune sur du poil, c'est une couleur. A 0,105 il reste un liseret, et
    # la bete redevient ce qu'elle doit etre : une masse noire qu'on devine.
    melange.inputs['Color1'].default_value = (0.030, 0.026, 0.048, 1)
    melange.inputs['Color2'].default_value = (0.105, 0.092, 0.140, 1)
    nt.links.new(ramp.outputs['Color'], melange.inputs['Fac'])
    nt.links.new(melange.outputs['Color'], emis.inputs['Color'])
    emis.inputs['Strength'].default_value = 1.0
    nt.links.new(emis.outputs['Emission'], sortie.inputs['Surface'])
    return m


def rendre(phase, index, largeur, hauteur, centre):
    cam = vue.camera(PX_PAR_M, largeur, hauteur, centre=centre)
    void = cam
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.quality = 92
    sc.render.filepath = os.path.join(SORTIE, 'galop-%d.webp' % index)
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(SORTIE, exist_ok=True)

    # Le cadre : la bete tient dans une boite qu'on calcule une fois, pour que
    # les huit images aient exactement la meme taille et la meme ancre. Des
    # images recoupees chacune au plus juste feraient sautiller l'animal.
    marge = 0.22
    x0, x1 = -1.45 - marge, 1.45 + marge
    z0, z1 = -0.08, GARROT + 0.34 + marge
    # En vue du jeu, la largeur ecran d'un objet vaut cos(-X+Y) et sa hauteur
    # sin(X+Y)+Z : on prend large, le decoupage se fait a l'affichage.
    largeur = int(math.ceil((x1 - x0) * PX_PAR_M * 1.15))
    hauteur = int(math.ceil((z1 - z0 + (x1 - x0) * 0.5) * PX_PAR_M * 0.80))
    centre = ((x0 + x1) * 0.5, 0.0, (z0 + z1) * 0.5)

    manifeste = {
        'pxParM': PX_PAR_M,
        'phases': PHASES,
        'largeur': largeur,
        'hauteur': hauteur,
        # Ou tombe le point (0, 0, 0) du repere de la bete dans l'image : le
        # moteur y pose ses pattes, c'est-a-dire le sol sous elle.
        'ancre': None,
    }

    for i in range(PHASES):
        nettoyer()
        sys.modules['vue'].__dict__  # le module reste charge d'un appel a l'autre
        phase = i / PHASES
        obj = bete(phase)
        obj.data.materials.append(matiere_bete())
        # LES YEUX NE SONT PAS RENDUS, ET C'EST UNE DECISION, PAS UN OUBLI.
        #
        # `yeux()` existe juste au-dessus et fonctionne. Trois essais ont
        # pourtant donne trois fois la meme chose : une tache rose pale au
        # bout du museau, qui se lit comme un groin et non comme un regard.
        # Ni la taille (7 cm puis 4,5), ni la position (sur le chanfrein puis
        # derriere le stop), ni la force d'emission (9,0 puis 4,5) n'y ont
        # change grand-chose.
        #
        # La raison est dans la VUE. Le jeu regarde la bete de trois quarts
        # arriere, en isometrie : a cet angle, l'oeil d'un vrai chien est
        # presque entierement cache par son propre crane. Ce qu'on voyait
        # n'etait pas l'oeil mais son HALO, deborde par-dessus le museau — et
        # un halo sans source visible se pose la ou il veut.
        #
        # Le tracé à la main, lui, ne simule rien : il POSE deux points rouges
        # la ou le joueur doit les voir, quitte a tricher sur l'anatomie. A
        # l'ecran ils fonctionnent — c'est la seule chose de la bete qu'on
        # reconnait a deux metres. Les yeux restent donc au dessin, par-dessus
        # l'image rendue, et ce script ne s'en occupe pas.
        #
        # La fonction reste : le jour ou la bete sera vue de profil — une
        # affiche, un carton de partage — c'est la qu'il faudra la rappeler.
        # yeux(phase)
        rendre(phase, i, largeur, hauteur, centre)
        print('  phase %d/%d rendue' % (i + 1, PHASES))

    # L'ancre se deduit de la camera : le centre de l'image correspond a
    # `centre`, et un point du repere du jeu tombe a px_par_m * (cos(-X+Y),
    # -(sin(X+Y)+Z)) de la. On ecrit donc ou tombe l'origine.
    COS, SIN = 2 / math.sqrt(5), 1 / math.sqrt(5)
    def ecran(p):
        return (COS * (-p[0] + p[1]), -(SIN * (p[0] + p[1]) + p[2]))
    ec, eo = ecran(centre), ecran((0.0, 0.0, 0.0))
    manifeste['ancre'] = [round(largeur * 0.5 + (eo[0] - ec[0]) * PX_PAR_M, 2),
                          round(hauteur * 0.5 + (eo[1] - ec[1]) * PX_PAR_M, 2)]

    with open(os.path.join(SORTIE, 'manifeste.json'), 'w') as f:
        json.dump(manifeste, f, indent=2)
    print('ecrit : %s' % SORTIE)
    print(json.dumps(manifeste))


if __name__ == '__main__':
    main()


# ---------------------------------------------------------------------------
# OU EN EST CETTE BETE, APRES CINQ RENDUS — ecrit le 27 septembre 2026.
# ---------------------------------------------------------------------------
#
# CE QUI A ETE CORRIGE, ET QUI TIENT :
#
#   - les proportions d'un molosse et non d'un levrier (encolure, poitrail,
#     museau court avec un stop) ;
#   - la matiere : une masse sombre avec un fil de lumiere sur l'echine, au
#     lieu d'une silhouette pale — la rampe s'ouvrait a 0,10 et prenait donc
#     presque tout l'animal dans la vue isometrique du jeu ;
#   - la queue, qui faisait le RAT : 66 cm de fouet fin, ramenes a 38 cm
#     epais. C'etait l'element le plus nuisible de la sculpture, et le seul
#     dont la correction se voit franchement ;
#   - les pieds, qui etaient des billes au bout de tubes : trois masses a
#     plat donnent une surface d'appui ;
#   - le profil des membres, epais-pince-fin au lieu d'un effilement lineaire.
#
# CE QUI NE MARCHE TOUJOURS PAS, ET IL FAUT L'ECRIRE SANS TOURNER AUTOUR :
# CA NE RESSEMBLE PAS A UN CHIEN. Sur la planche de contact, la bete se lit
# comme une LOUTRE ou un phoque — un corps lisse et continu porte par quatre
# fils. Cinq rendus successifs n'y ont rien change, et l'echec est instructif.
#
# LA CAUSE EST DANS LA METHODE, PAS DANS LES NOMBRES.
#
# Une metaball fusionne par recouvrement de champ. Le tronc demande des
# rayons de trente centimetres ; leur champ porte alors si loin qu'il avale
# tout ce qu'on pose a cote — l'attache des membres, la base des oreilles, le
# stop du crane. Monter la rigidite du tronc (essaye, 2,0 -> 3,2) resserre
# bien son champ, mais DETACHE les pattes : on passe d'un phoque a un phoque
# sur echasses. Les deux etats sont mauvais, et il n'y a pas de reglage entre
# les deux qui donne un chien : le probleme n'est pas le curseur, c'est qu'un
# seul objet metaball ne peut pas porter a la fois une masse continue et des
# articulations lisibles.
#
# CE QU'IL FAUDRAIT FAIRE, ET C'EST UN AUTRE CHANTIER :
#
#   1. SEPARER EN PLUSIEURS OBJETS — tronc, tete, quatre membres, queue —
#      chacun sa metaball, donc chacun son champ. Ils se croisent visuellement
#      sans fusionner. C'est ainsi que la tete garderait son stop et que
#      l'epaule ressortirait du flanc.
#   2. DONNER UN VOLUME AU CRANE. Le stop existe dans la table TETE et ne se
#      voit pas : il est noye. Separe (point 1), il se verrait.
#   3. RENONCER AUX YEUX RENDUS. Voir le commentaire dans main() : a l'angle
#      du jeu, l'oeil d'un vrai chien est cache par son propre crane, et l'on
#      ne rend que son halo — qui se pose n'importe ou. Le tracé à la main
#      les POSE, et c'est pour cela qu'ils marchent.
#
# TANT QUE LE POINT 1 N'EST PAS FAIT, LE TRACE A LA MAIN DE
# game/halloween-molosse.js RESTE CE QUI JOUE. Il a ses propres defauts — de
# pres il se lit comme une table a quatre pieds — mais il est LISIBLE : on
# reconnait un chien, et on voit ses deux yeux. Un rendu plus detaille qu'on
# ne reconnait pas est un moins bon rendu.
#
# Aucune image produite par ce script n'entre dans le jeu aujourd'hui.
