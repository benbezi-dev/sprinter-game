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

SORTIE = os.path.join(ICI, '..', '..', 'public', 'molosse')

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
COLONNE = [
    (+0.86, 0.50, 0.13),   # la gorge
    (+0.72, 0.58, 0.18),   # l'encolure
    (+0.54, 0.66, 0.24),   # le garrot
    (+0.34, 0.66, 0.25),   # le poitrail, le plus profond
    (+0.14, 0.64, 0.21),   # le dos
    (-0.08, 0.62, 0.17),   # le rein, pince
    (-0.30, 0.62, 0.19),   # la croupe
    (-0.50, 0.60, 0.15),   # la naissance de la queue
]

# La tete : (avancement, hauteur, rayon). Le crane large, le museau fin et
# long — un museau court donne un chien de salon.
TETE = [
    (+0.97, 0.47, 0.15),   # le crane
    (+1.07, 0.44, 0.12),   # le front
    (+1.18, 0.41, 0.085),  # le chanfrein
    (+1.28, 0.395, 0.065), # le museau
    (+1.35, 0.385, 0.050), # la truffe
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
            masse(x * 0.925, 0.0, h * GARROT + bond + cambre * poids, r)
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

    # La machoire, une masse sous le museau : sans elle le profil s'affine en
    # pointe et la bete a un bec.
    masse(1.16 * 0.925, 0.0, 0.355 * GARROT + bond * 0.7, 0.060)

    # Les oreilles, plaquees en arriere. Deux petites masses suffisent : a
    # cette echelle une oreille est une bosse, pas une feuille.
    for cote in (-1, 1):
        masse(0.88 * 0.925, cote * 0.075, 0.60 * GARROT + bond * 0.7, 0.050)

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
        for j in range(24):
            t = j / 23.0
            r = 0.098 - 0.058 * t
            if t <= 0.55:
                a = t / 0.55
                x, z = hx + (cx - hx) * a, hz + (cz - hz) * a
            else:
                a = (t - 0.55) / 0.45
                x, z = cx + (fx - cx) * a, cz + (fz - cz) * a
            masse(x, y, z, r, 1.1)
        # Le pied, pose a plat.
        masse(fx + 0.040, y, fz + 0.020, 0.052, 1.1)

    # La queue, tendue en balancier vers l'arriere.
    bat = math.sin(phase * 2 * math.pi * 1.5) * 0.10
    for j in range(16):
        t = j / 15.0
        masse(-0.50 * 0.925 - t * 0.66, bat * t * 0.5,
              0.60 * GARROT + bond - t * 0.10 + bat * t, 0.072 - 0.034 * t, 1.0)

    return obj


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
    ramp.color_ramp.elements[0].position = 0.10
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.95
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    # Les deux teintes du trace qu'on remplace : le noir bleute du poil, et
    # l'eclaircissement du dos. Un noir pur ferait un trou dans l'image.
    melange.inputs['Color1'].default_value = (0.055, 0.045, 0.075, 1)
    melange.inputs['Color2'].default_value = (0.200, 0.170, 0.250, 1)
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
