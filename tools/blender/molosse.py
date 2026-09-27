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
# ─────────────────────────────────────────────────────────────────────────
# UNE CHAINE AXIALE DONNE UN TUBE, ET C'EST MATHEMATIQUE.
#
# Une masse posee sur l'axe a un rayon `r` : elle fait le dos a `h + r` et le
# ventre a `h - r`, avec le MEME nombre. Pincer le rein pour remonter le
# ventre descend donc le dos d'autant, et l'on obtient un tube qui maigrit au
# milieu — jamais un animal. Le creux du flanc d'un chien n'est pas un
# retrecissement : c'est un VENTRE QUI REMONTE SOUS UN DOS QUI NE BOUGE PAS.
#
# Il faut donc deux lignes independantes, plus une paire laterale :
#
#   DOS     la ligne du dessus, presque droite du garrot a la croupe ;
#   VENTRE  la ligne du dessous, qui plonge au poitrail et remonte a l'aine ;
#   FLANC   deux masses de chaque cote, a hauteur de cage thoracique, qui
#           donnent la LARGEUR — un chien est profond devant et plat derriere.
#
# Les trois vivent dans la meme famille « tronc » : elles doivent fusionner
# entre elles, c'est tout l'interet. C'est avec la tete et les pattes qu'elles
# ne doivent pas se melanger.
# ─────────────────────────────────────────────────────────────────────────

# LA LIGNE DU DOS : (avancement, hauteur, rayon).
#
# Les rayons tombent de 0,30 a 0,19 : ils ne font plus tout le corps, ils n'en
# font que le dessus. Les hauteurs montent en consequence — a 0,70 avec un
# rayon de 0,19, le garrot culmine a 0,89, la ou l'ancienne table le mettait a
# 0,92. La ligne du dessus ne change donc presque pas ; c'est ce qu'il y a
# dessous qui change.
#
# Le rein remonte legerement (0,715) : le dos d'un chien qui galope n'est pas
# plat, il est arque — et cette arche est ce qui distingue une course d'un
# trot.
COLONNE = [
    # L'ENCOLURE DESCEND A 0,610, ET C'EST CE QUI FAIT DECROCHER LA NUQUE.
    #
    # Mesure faite avant de toucher a quoi que ce soit : le bord superieur
    # allait de 0,895 au garrot a 0,835 au creux, soit SIX CENTIMETRES de
    # depression sur une bete qui en fait pres de cent. A l'ecran, quinze
    # pixels — un accident de surface, pas un decrochement. La nuque avait
    # beau etre posee, elle n'avait rien a depasser.
    #
    # A 0,610 avec un rayon de 0,150, le creux tombe a 0,760 : quatorze
    # centimetres sous le garrot. C'est du meme ordre que le creux du flanc
    # (dix-huit), et c'est l'echelle a laquelle un relief se lit sur cette
    # bete-la.
    #
    # On ne descend pas plus bas : a 0,55 l'encolure se detacherait du
    # poitrail, dont la ligne de ventre passe a 0,480.
    (+0.72, 0.610, 0.150),  # l'encolure, CREUSEE — c'est elle qui fait la nuque
    (+0.54, 0.700, 0.195),  # le garrot, le point haut
    (+0.34, 0.695, 0.200),  # le dos avant
    (+0.14, 0.700, 0.185),  # le dos
    (-0.08, 0.715, 0.170),  # le rein, arque
    (-0.30, 0.710, 0.180),  # la croupe, qui pousse
    (-0.50, 0.660, 0.140),  # la naissance de la queue
]

# LA LIGNE DU VENTRE : (avancement, hauteur, rayon).
#
# C'est elle qui fait tout, et elle n'existait pas.
#
# Elle plonge au POITRAIL — le point le plus bas de l'animal, sous les
# coudes — puis remonte franchement a l'AINE. Entre les deux, le creux du
# flanc : ce vide sous la derniere cote, qu'on voit se soulever quand une bete
# souffle. Vingt-huit centimetres separent le bas du poitrail du bas de
# l'aine ; c'est cette difference-la, et rien d'autre, qui fait qu'on reconnait
# un animal qui court.
VENTRE = [
    (+0.44, 0.480, 0.170),  # la pointe du poitrail — reculee de six
                            # centimetres : a 0,50 elle depassait DEVANT
                            # l'epaule et pendait sous le cou comme un fanon.
    (+0.28, 0.440, 0.190),  # le poitrail, LE POINT LE PLUS BAS
    (+0.10, 0.490, 0.155),  # la derniere cote
    (-0.08, 0.625, 0.110),  # LE CREUX DU FLANC — creuse davantage : a 0,560
                            # avec un rayon de 0,135, le ventre ne remontait
                            # que de treize centimetres sur le poitrail, et le
                            # creux se lisait comme un simple amincissement.
    (-0.26, 0.640, 0.115),  # l'aine, contre la cuisse
]

# LES FLANCS : (avancement, ecart lateral, hauteur, rayon).
#
# Un chien est PROFOND DEVANT ET PLAT DERRIERE : la cage thoracique porte les
# poumons et le coeur, le rein ne porte rien. Deux paires suffisent a le dire,
# posees a hauteur de cote — plus haut elles gonfleraient le dos, plus bas
# elles rempliraient le creux qu'on vient de creuser.
FLANCS = [
    (+0.40, 0.125, 0.580, 0.155),
    (+0.18, 0.120, 0.590, 0.145),
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
# LA TETE ETAIT TROP BASSE ET TROP LOIN, ET C'EST UNE VUE DE PROFIL QUI L'A
# DIT — apres cinq rendus sous l'angle du jeu qui ne pouvaient pas le montrer.
#
# Les hauteurs allaient de 0,475 a 0,425, quand la colonne, elle, va de 0,48 a
# 0,62. LE CRANE ETAIT DONC SOUS LE NIVEAU DU DOS, museau pointe vers le sol :
# de profil, la bete reniflait la terre en courant. C'est ce qui donnait la
# loutre — un corps qui continue tout droit et se termine en pointe vers le
# bas, sans le decrochement tete/encolure qui fait reconnaitre un chien.
#
# Et le crane etait a 0,95 quand le garrot est a 0,54 : QUARANTE ET UN
# CENTIMETRES D'ENCOLURE sur une bete d'un metre quatre-vingt-cinq. Un molosse
# a le cou court — c'est meme ce qui le distingue le plus vite d'un levrier,
# avec le museau.
#
# La tete remonte donc au niveau du garrot et recule de dix centimetres. Le
# museau garde une legere plongee (0,615 a la truffe contre 0,655 au crane) :
# une tete parfaitement horizontale a l'air empaillee, une tete qui plonge un
# peu regarde ou elle court.
# LA TETE SUIT LA LIGNE DU DOS, ET IL FAUT Y PENSER A CHAQUE FOIS QU'ON LA
# BOUGE. Le bogue a ete introduit deux fois : la premiere quand la table a ete
# ecrite, la seconde en remontant COLONNE de 0,62 a 0,70 pour la separer du
# ventre — la tete, restee a 0,655, est aussitot repassee SOUS le dos, et la
# bete s'est remise a renifler la terre.
#
# La regle, pour la prochaine fois : LE CRANE EST AU NIVEAU DU GARROT OU
# LEGEREMENT AU-DESSUS. Garrot a 0,700 avec un rayon de 0,195, donc sommet a
# 0,895 ; crane a 0,760 avec un rayon de 0,205, donc sommet a 0,965. La tete
# depasse le dos de sept centimetres, ce qui est la posture d'un chien qui
# poursuit — le regard porte devant, pas au sol.
# LA TETE REDESCEND, ET C'EST UN RETOUR EN ARRIERE ASSUME.
#
# Elle avait ete remontee au niveau du garrot parce qu'un chien qui court
# porte la tete haute — c'est vrai, et c'est ce qu'il fallait pour faire UN
# CHIEN. Mais ce qu'on cherche n'est pas un chien : c'est quelque chose qui
# fait peur, et les deux ne demandent pas la meme ligne.
#
# LA LIGNE QUI MENACE EST TETE BASSE, EPAULES HAUTES. C'est la posture du
# predateur qui charge — le loup qui fonce, le molosse qui va prendre — et
# elle se reconnait instantanement parce qu'elle dit une chose simple : cette
# bete ne regarde pas ou elle va, elle regarde CE QU'ELLE VA PRENDRE. Une tete
# portee haut regarde l'horizon ; une tete basse regarde une proie.
#
# Le crane redescend donc a 0,615 sous un garrot a 0,700, et les epaules
# passent au-dessus. La difference avec la version « loutre » du debut, ou la
# tete etait aussi basse : la ligne du dos est maintenant HAUTE et le creux du
# flanc existe, si bien que la tete basse se lit comme une posture et non plus
# comme un affaissement.
TETE = [
    (+0.86, 0.615, 0.215),  # le crane, LOURD et porte bas
    (+0.96, 0.600, 0.185),  # le front
    (+1.01, 0.565, 0.145),  # LE STOP
    (+1.09, 0.552, 0.135),  # le chanfrein
    (+1.175, 0.545, 0.110), # la truffe
]

# LES CRETES DE L'ECHINE — le poil dresse, et c'est le seul element de toute
# cette bete qui ne cherche pas a ressembler a quelque chose de reel.
#
# Un chien qui menace herisse son echine : c'est un signal que tout le monde
# lit sans l'avoir appris, y compris chez une espece qu'on ne connait pas. Et
# surtout, c'est la SEULE facon de donner des angles a une silhouette faite de
# metaballs. Tout le reste de cette sculpture est rond — et une forme ronde
# n'a jamais fait peur a personne. Une dent, une epine, une pointe : voila ce
# qui fait reculer.
#
# Chacune est une masse petite a RIGIDITE TRES HAUTE. C'est ce qui les garde
# separees : a rigidite basse elles auraient fondu en un bourrelet continu le
# long du dos, ce qui ressemble a une nageoire dorsale. Il faut qu'on compte
# les pointes.
#
# (avancement, hauteur de la pointe, rayon)
# LES HAUTEURS SONT CELLES DU CENTRE, ET LA PREMIERE VERSION FLOTTAIT.
#
# Elles allaient de 0,905 a 0,985 quand le dessus du dos est a 0,895 (garrot a
# 0,700, rayon 0,195). Chaque crete etait donc posee ENTIEREMENT AU-DESSUS de
# la peau : sept billes suspendues dans le vide au-dessus de l'echine, ce qui
# est exactement ce que le rendu a montre. Une pointe doit etre PLANTEE — sa
# base dans le corps, sa pointe dehors.
#
# Les centres redescendent donc sous la ligne du dos, et seule la moitie
# superieure depasse. La rigidite passe de 6,0 a 3,6 : a 6,0 elles ne se
# rejoignaient meme pas entre elles, d'ou le chapelet de perles ; a 3,6 leurs
# bases se soudent en une crete continue dont les pointes restent comptables.
# CHAQUE CRETE DOIT DEPASSER DE LA PEAU, ET ON LE CALCULE PLUTOT QUE DE
# L'ESTIMER. Le dessus du dos est a `h + r` de la ligne COLONNE, soit 0,885 a
# 0,895 selon l'endroit ; une crete ne se voit que si `hauteur + rayon` passe
# au-dessus. La version precedente en laissait TROIS enterrees sur sept — les
# trois du milieu du dos, celles qui prolongent la crete vers la croupe — et
# la bete n'avait de poil dresse que sur la nuque.
#
# Les sept depassent maintenant, de deux centimetres a l'arriere jusqu'a dix
# au garrot. La decroissance compte autant que la hauteur : un poil herisse
# part haut sur les epaules et se couche vers la queue, et c'est ce profil en
# vague qui se lit comme du poil plutot que comme des piquants de dinosaure.
CRETES = [
    (+0.80, 0.870, 0.090),  # la nuque
    (+0.70, 0.890, 0.098),
    (+0.60, 0.895, 0.100),  # le garrot — le point le plus haut
    (+0.50, 0.888, 0.094),
    (+0.40, 0.875, 0.086),
    (+0.30, 0.862, 0.076),
    (+0.20, 0.848, 0.066),  # et ca se couche vers la croupe
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
    """La bete, en SEPT OBJETS METABALL et non plus un seul.

    C'EST LA CORRECTION DE FOND, ET ELLE VIENT D'UN ECHEC MESURE.

    Pendant cinq rendus, tout etait dans une seule metaball. Le resultat se
    lisait comme une LOUTRE : un corps lisse et continu porte par quatre fils,
    sans epaule, sans stop au crane, sans attache d'oreille. Aucun reglage de
    nombres n'y a rien change, et l'on a fini par comprendre pourquoi.

    Une metaball fusionne par recouvrement de CHAMP, et le champ d'une masse
    porte bien au-dela de son rayon. Le tronc demande des rayons de trente
    centimetres : son champ avalait tout ce qu'on posait a cote. Monter sa
    rigidite resserre bien le champ — mais detache alors les pattes, et l'on
    passe d'un phoque a un phoque sur echasses. Il n'existe aucun reglage
    entre les deux qui donne un chien, parce qu'un seul objet ne peut pas
    porter A LA FOIS une masse continue et des articulations lisibles.

    LA SOLUTION EST DANS BLENDER ET NON DANS LES NOMBRES. Deux metaballs ne
    fusionnent que si leurs objets appartiennent a la MEME FAMILLE DE NOMS :
    « molosse », « molosse.001 », « molosse.002 » se melangent ; « tronc » et
    « tete » s'ignorent et s'interpenetrent simplement. Sept familles donnent
    donc sept volumes qui se croisent sans se dissoudre :

        tronc   tete   queue   et les quatre pattes, une par membre.

    CE QU'ON GAGNE : la tete garde son stop et sa machoire, puisque plus rien
    de trente centimetres ne vient les lisser ; l'epaule RESSORT du flanc au
    lieu d'y fondre ; l'oreille tient sur le crane.

    CE QU'ON PERD, ET C'EST ASSUME : les raccords ne sont plus des fondus mais
    des INTERSECTIONS. A la jonction patte-flanc, deux surfaces se croisent
    franchement au lieu de se marier. Sur une bete noire vue a trente pixels
    le metre, une intersection ne se voit pas — c'est du volume dans du
    volume. Elle se verrait sur une affiche, et c'est la qu'il faudrait
    revenir. On recouvre donc genereusement : chaque membre remonte DANS le
    tronc, pour que le croisement tombe a l'interieur de la masse.
    """
    familles = {}

    def groupe(nom):
        """Une famille de masses, independante des autres.

        Rend la fonction `masse` de cette famille-la. Le nom porte la
        separation : c'est lui, et lui seul, qui decide de ce qui fusionne.
        """
        mb = bpy.data.metaballs.new(nom)
        # La resolution decide de la finesse de la peau. 0,012 donne une
        # surface lisse a cent vingt pixels le metre sans faire exploser le
        # temps de rendu ; au-dela on compte les facettes sur le museau.
        mb.resolution = 0.012
        mb.render_resolution = 0.010
        o = bpy.data.objects.new(nom, mb)
        bpy.context.collection.objects.link(o)
        familles[nom] = o

        def masse(x, y, z, r, rigide=2.0):
            e = mb.elements.new()
            e.co = (x, y, z)
            e.radius = r
            e.stiffness = rigide
            return e
        return masse

    masse = groupe('tronc')

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
            # LA RIGIDITE REDESCEND A LA VALEUR PAR DEFAUT, maintenant que la
            # separation en familles fait le travail.
            #
            # Elle avait ete montee a 3,2 pour empecher le tronc d'avaler les
            # oreilles et le haut des pattes. Ca marchait a moitie et ca
            # coutait cher : un champ resserre rend le tronc lui-meme moins
            # continu, et l'on voyait les masses de la colonne perler sous la
            # peau du flanc. Le probleme n'etait pas la portee du champ, c'est
            # que tout partageait le meme. Ce n'est plus le cas.
            masse(x * 0.925, 0.0, h * GARROT + bond + cambre * poids, r)
    x, h, r = COLONNE[-1]
    masse(x * 0.925, 0.0, h * GARROT + bond, r)

    # LE VENTRE, ET C'EST LUI QUI CREUSE LE FLANC. Meme interpolation que le
    # dos, meme cambrure — les deux lignes respirent ensemble, sinon le corps
    # se tord a chaque foulee.
    for i in range(len(VENTRE) - 1):
        x0, h0, r0 = VENTRE[i]
        x1, h1, r1 = VENTRE[i + 1]
        for k in range(4):
            a2 = k / 4.0
            x, h, r = (x0 + (x1 - x0) * a2, h0 + (h1 - h0) * a2, r0 + (r1 - r0) * a2)
            poids = math.sin((i + a2) / (len(VENTRE) - 1) * math.pi)
            masse(x * 0.925, 0.0, h * GARROT + bond + cambre * poids * 0.5, r)
    x, h, r = VENTRE[-1]
    masse(x * 0.925, 0.0, h * GARROT + bond, r)

    # LES FLANCS, par paires. Ils donnent la profondeur de la cage thoracique,
    # et ne descendent pas jusqu'au creux : c'est ce qui fait qu'on voit le
    # thorax large ET le ventre pince, au lieu d'un cylindre.
    for fx, fy, fh, fr in FLANCS:
        for cote in (-1, 1):
            masse(fx * 0.925, cote * fy, fh * GARROT + bond, fr)

    # LA TETE DANS SA PROPRE FAMILLE. C'est elle qui gagne le plus a la
    # separation : le stop, la machoire et les oreilles existaient deja dans
    # les tables, et le champ du tronc les lissait tous les trois. Ils sont
    # maintenant seuls a se partager un volume de la taille d'une tete, donc
    # ils se voient.
    #
    # LE COU REMONTE DANS LE TRONC. La premiere masse de TETE est a 0,95, le
    # garrot a 0,54 : sans recouvrement, on verrait la jointure. On ajoute
    # donc une amorce d'encolure qui plonge DANS le poitrail, et le croisement
    # des deux surfaces tombe a l'interieur de l'animal.
    masse = groupe('tete')
    # L'AMORCE D'ENCOLURE EST MINCE, ET LA PREMIERE VERSION NE L'ETAIT PAS.
    #
    # Elle posait trois masses de 0,255, 0,21 et 0,195 de rayon : dans une
    # famille qui ne contient par ailleurs qu'une tete — dont la plus grosse
    # masse fait 0,205 — ces trois-la dominaient tout et refabriquaient le
    # blob A L'INTERIEUR du groupe qu'on venait de separer. On avait deplace
    # le probleme d'un objet a l'autre, sans le resoudre.
    #
    # Deux masses fines suffisent : elles n'ont qu'a plonger dans le poitrail
    # pour cacher la jointure, pas a le remplir. La gorge du tronc est deja a
    # 0,175 au meme endroit, et deux surfaces qui se croisent n'ont pas besoin
    # de se ressembler.
    # L'AMORCE D'ENCOLURE REMPLISSAIT LE CREUX PAR EN DESSOUS. Elle etait a
    # 0,690 avec un rayon de 0,150, donc un bord superieur a 0,840 — plus haut
    # que le creux de la colonne lui-meme. Les deux familles ne fusionnent pas,
    # mais leur UNION est ce qu'on voit : c'est toujours la plus haute des deux
    # surfaces qui fait la silhouette, et c'etait celle-ci.
    #
    # Elle descend donc avec l'encolure, et ne sert plus qu'a ce pour quoi elle
    # existe : faire que la tete tienne au corps sans qu'on voie la jointure.
    for t in (0.0, 0.55):
        masse((0.60 + 0.15 * t) * 0.925, 0.0,
              (0.618 - 0.006 * t) * GARROT + bond * 0.7, 0.132 - 0.010 * t)

    # LA NUQUE — sans elle, la tete est une excroissance du cou.
    #
    # De profil, on passait du crane au corps sans aucune articulation : une
    # ligne continue, et le regard n'avait nulle part ou s'arreter pour
    # reconnaitre une tete. Or ce qu'on lit d'un chien de loin, c'est
    # precisement ce DECROCHEMENT — le crane se detache, la nuque plonge
    # derriere lui, puis l'encolure remonte vers le garrot.
    #
    # Deux masses suffisent, et leur position compte plus que leur taille :
    # elles sont EN ARRIERE du crane et PLUS HAUTES que l'encolure. C'est ce
    # relief-la, trois centimetres, qui fait la difference entre un chien et
    # un phoque.
    # Et elle remonte : bord superieur a 0,975 contre 0,760 au creux, soit
    # vingt et un centimetres de relief. C'est la bosse qu'on cherche — celle
    # qui se voit de loin sur un molosse et qu'aucun levrier n'a.
    #
    # La seconde masse, plus basse et en arriere, est la rampe qui ramene vers
    # l'encolure : sans elle, la nuque serait une boule posee sur un cou.
    masse(0.795 * 0.925, 0.0, 0.720 * GARROT + bond * 0.7, 0.140)
    masse(0.740 * 0.925, 0.0, 0.690 * GARROT + bond * 0.7, 0.120)

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
    # LA GUEULE EST OUVERTE, et c'est le second element qui fait peur apres
    # les cretes.
    #
    # La machoire etait collee sous le museau : la bete arrivait BOUCHE FERMEE,
    # ce qui est l'expression d'un animal qui trotte. Une bete qui va mordre
    # ouvre. On descend donc le bas de machoire de sept centimetres et on le
    # recule legerement : il reste attache au crane a l'arriere — c'est la
    # charniere — et s'en ecarte vers l'avant. Le vide entre les deux EST la
    # gueule, et c'est un trou noir dans une silhouette noire : on ne le voit
    # pas, on le devine, ce qui vaut mieux.
    #
    # `pivot` ouvre d'autant plus qu'on avance vers la truffe : une machoire
    # qui descendrait parallelement au chanfrein s'ouvrirait comme un tiroir.
    # LE PIVOT ETAIT TROP GRAND ET LA MACHOIRE SE DETACHAIT. A 0,105 en bout,
    # la derniere masse tombait a 0,375 quand le museau qui doit la retenir est
    # a 0,545 : dix-sept centimetres de vide, et une bille noire flottant sous
    # la tete. Une gueule ouverte reste ATTACHEE a sa charniere — c'est meme
    # tout ce qui la distingue d'une machoire arrachee.
    #
    # L'ouverture tombe donc a six centimetres en bout, et une masse de
    # charniere est posee sous l'arriere du crane pour tenir l'ensemble.
    masse(0.905 * 0.925, 0.0, 0.468 * GARROT + bond * 0.7, 0.105)
    for t, r in ((0.00, 0.108), (0.45, 0.090), (1.00, 0.066)):
        pivot = 0.012 + 0.048 * t
        masse((0.945 + 0.19 * t) * 0.925, 0.0,
              (0.500 - 0.020 * t - pivot) * GARROT + bond * 0.7, r)
    # Et les babines, de part et d'autre : deux masses basses et ecartees qui
    # elargissent la gueule vue de trois quarts, l'angle exact du jeu.
    for cote in (-1, 1):
        masse(1.04 * 0.925, cote * 0.062, 0.438 * GARROT + bond * 0.7, 0.070)

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
        masse(0.87 * 0.925, cote * 0.105, 0.690 * GARROT + bond * 0.7, 0.058)
        masse(0.84 * 0.925, cote * 0.118, 0.620 * GARROT + bond * 0.7, 0.070)

    # Les quatre pattes. Chacune est une chaine de masses qui va de l'epaule
    # au pied en passant par le coude, et le coude est pousse vers l'avant
    # devant, vers l'arriere derriere : c'est ce pli inverse qui fait lire un
    # quadrupede et non un homme a quatre jambes.
    amp = PATTE * 1.05
    for k, (ex, eh, ph, avant) in enumerate(EPAULES):
        # UNE FAMILLE PAR MEMBRE, et non une pour les quatre. Deux pattes du
        # meme cote se croisent a chaque foulee : dans une famille commune
        # elles auraient fusionne au passage, et l'animal aurait eu par
        # moments trois pattes soudees en palme.
        masse = groupe('patte%d' % k)
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
        # LES RAYONS ONT DOUBLE EN BAS, et la vue de profil dit pourquoi.
        #
        # L'avant-bras faisait 6,3 cm de rayon au coude et 4,2 au boulet. Sur
        # une bete qui fait UN METRE TRENTE au garrot, c'est l'epaisseur d'un
        # manche a balai : de profil, les quatre membres se lisaient comme des
        # fils tendus sous un corps qui, du coup, paraissait enorme et long.
        # Ce n'est pas le corps qui etait trop long, c'est les pattes qui
        # etaient trop fines pour le porter.
        #
        # L'echelle se verifie sur un vrai chien : un dogue de 70 cm au garrot
        # a un avant-bras d'environ 5 cm de rayon, soit 7 % de sa hauteur. A
        # 1,30 m, cela fait 9 cm. On y est.
        def rayon_de(t):
            if t < 0.35:
                # De l'attache au bas du muscle : large, et qui enfle un peu
                # avant de se pincer.
                a2 = t / 0.35
                return 0.175 - 0.020 * a2 * a2
            if t < 0.50:
                # Le pincement de l'articulation, court et franc — mais un
                # pincement reste une inflexion, pas un etranglement : il
                # descendait a moins de la moitie du muscle, ce qui sectionnait
                # la patte au lieu de l'articuler.
                a2 = (t - 0.35) / 0.15
                return 0.160 - 0.055 * a2
            # L'avant-bras, qui s'affine doucement jusqu'au boulet.
            a2 = (t - 0.50) / 0.50
            return 0.105 - 0.028 * a2

        # L'ATTACHE REMONTE DANS LE FLANC. Sans famille commune, une patte qui
        # commencerait a la surface du tronc laisserait voir sa section : un
        # tube coupe net contre un flanc. On pose donc deux masses au-DESSUS
        # de l'epaule, a l'interieur du corps, pour que la jonction se fasse
        # dans le volume et non sur la peau.
        for dz, r in ((0.10, 0.150), (0.05, 0.155)):
            masse(hx, y * 0.72, hz + dz, r, 1.1)
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
        for dx, r in ((0.010, 0.072), (0.050, 0.080), (0.090, 0.062)):
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
    # LES CRETES, DANS LEUR PROPRE FAMILLE ET A RIGIDITE TRES HAUTE.
    #
    # Les deux conditions comptent autant l'une que l'autre. Dans la famille
    # du tronc, le champ du dos les aurait avalees sans laisser de trace — on
    # l'a assez paye. Et a rigidite ordinaire, elles auraient fusionne ENTRE
    # ELLES en un bourrelet continu : une nageoire, pas des epines. A 6,0 le
    # champ de chaque masse ne porte presque pas au-dela de son rayon, et les
    # sept pointes restent sept.
    #
    # Elles suivent la cambrure du dos, sinon elles flottent au-dessus de lui
    # a chaque foulee.
    masse = groupe('cretes')
    for cx, ch, cr in CRETES:
        poids = math.sin((0.86 - cx) / 1.36 * math.pi)
        masse(cx * 0.925, 0.0, ch * GARROT + bond + cambre * poids, cr, 3.6)

    masse = groupe('queue')
    bat = math.sin(phase * 2 * math.pi * 1.5) * 0.10
    for j in range(14):
        t = j / 13.0
        masse(-0.50 * 0.925 - t * 0.38, bat * t * 0.5,
              0.60 * GARROT + bond - t * 0.06 + bat * t,
              0.125 - 0.082 * t * t, 1.4)

    return list(familles.values())


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
        o.location = (0.925 * 0.925, cote * 0.112,
                      0.645 * GARROT + bond * 0.7)
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
        # SEPT OBJETS, UN SEUL MATERIAU. Chacun porte le meme poil : ils ne
        # fusionnent pas, mais ils doivent etre de la meme bete.
        mat = matiere_bete()
        for obj in bete(phase):
            obj.data.materials.append(mat)
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
# OU EN EST CETTE BETE — et le changement de cap qui a debloque l'affaire.
# ---------------------------------------------------------------------------
#
# ON A CESSE DE CHERCHER UN CHIEN. Pendant dix rendus, chaque correction visait
# l'exactitude anatomique : proportions de molosse, stop du crane, creux du
# flanc, nuque. Tout cela etait juste, et rien de tout cela ne faisait peur.
#
# Ce qu'on demande a cette bete n'est pas d'etre reconnaissable, c'est de faire
# reculer. Les deux ne demandent pas la meme silhouette. Une forme RONDE,
# LISSE et SYMETRIQUE n'inquiete personne, qu'elle soit zoologiquement
# correcte ou non. Ce qui inquiete, c'est ce qui pointe et ce qui manque.
#
# LES TROIS CHANGEMENTS QUI ONT PAYE, dans l'ordre de ce qui se voit :
#
#   1. LES CRETES DE L'ECHINE. Sept pointes plantees dans le dos, dans leur
#      propre famille et a rigidite 3,6. C'est le seul element de toute la
#      sculpture qui ne cherche pas a imiter quelque chose de reel, et c'est
#      celui qui change tout : des metaballs ne savent faire que du rond, et
#      une crete est la seule facon d'obtenir des ANGLES. Elles survivent a la
#      reduction — a 115 pixels de large, la ligne du dos est brisee au lieu
#      d'etre lisse, et c'est ce qui se lit de loin.
#   2. LA TETE BASSE. Elle avait ete remontee au niveau du garrot parce qu'un
#      chien qui court porte la tete haute. C'etait le bon reglage pour faire
#      un chien. La ligne qui MENACE est l'inverse : tete basse, epaules
#      hautes — le predateur qui charge. Une tete haute regarde l'horizon, une
#      tete basse regarde une proie.
#   3. LA GUEULE OUVERTE. La machoire etait collee au museau : la bete
#      arrivait bouche fermee, l'expression d'un animal qui trotte. Le vide
#      entre les deux est un trou noir dans une silhouette noire — on ne le
#      voit pas, on le devine.
#
# DEUX PIEGES DE NIVEAU, chacun trouve par le calcul plutot qu'a l'oeil, et
# chacun donnant le meme symptome — un morceau qui flotte :
#   — une crete ne depasse que si `hauteur + rayon` passe au-dessus du dos
#     (0,885 a 0,895 selon l'endroit). La premiere version les posait toutes
#     AU-DESSUS de la peau : sept billes suspendues. La seconde en laissait
#     trois enterrees.
#   — une gueule ouverte reste attachee a sa charniere. Un pivot de dix
#     centimetres en bout detachait la machoire du museau.
#
# CE QUI RESTE, ET CE N'EST PLUS L'URGENCE : l'epaule et la hanche ne
# ressortent toujours pas du flanc ; la queue est molle ; les quatre pattes
# ont la meme allure, la ou une demarche CASSEE — une patte qui retombe mal,
# une cadence irreguliere — ferait plus peur que n'importe quelle forme.
#
# Aucune image de ce script n'entre dans le jeu : le tracé à la main de
# game/halloween-molosse.js reste ce qui joue, et il faudra comparer les deux
# a l'ecran avant de trancher.
