# -----------------------------------------------------------------------
# SPRINTER — anatomie des coureurs, cote Blender.
#
# Ce fichier ne contient que des chiffres : ou se trouvent les masses
# musculaires d'un sprinter, et quel rayon elles font. Le sculptage et la
# mesure sont dans coureur.py.
#
# LE REPERE EST CELUI DU JEU, PAS CELUI D'UN MANNEQUIN QUELCONQUE. Le rig du
# moteur pose la hanche a z = 0,87, l'epaule a z = 1,34, le genou a z = 0,458,
# la cheville a z = 0,078 (voir pose() dans sprinter-core.js). Tout est
# construit a ces cotes-la : les longueurs de segment ne bougent pas d'un
# millimetre, sinon la foulee, la camera et la piste ne tombent plus juste.
# Ce qu'on va chercher dans Blender, ce sont les EPAISSEURS — le galbe d'un
# quadriceps, le ventre d'un mollet, la taille qui se pince sous les cotes —
# la ou le modele d'origine posait deux troncs de cone par membre.
#
# x = profondeur (le coureur avance vers +x), y = largeur, z = hauteur.
# -----------------------------------------------------------------------

# Reperes du rig, en metres. Repris tels quels de pose().
HIP_Z      = 0.87      # origine du bassin
SHOULDER_Z = 1.34      # pivot de l'epaule (hip + 0,470)
ELBOW_Z    = 1.09      # pivot du coude   (epaule - 0,250)
HAND_Z     = 0.816     # bout de la main  (coude - 0,274)
LEGHIP_Z   = 0.85      # pivot de la cuisse (hip - 0,02)
KNEE_Z     = 0.458     # pivot du genou   (cuisse - 0,392)
ANKLE_Z    = 0.078     # pivot de la cheville (genou - 0,380)


# Largeur d'epaule et de bassin du rig : les membres ne sont pas centres,
# leur axe est decale de ces valeurs. Elles dependent du gabarit.
def ecarts(fem):
    return {
        'sh':  0.130 if fem else 0.154,   # demi-ecart des epaules
        'hip': 0.094 if fem else 0.082,   # demi-ecart des hanches
    }


# -----------------------------------------------------------------------
# LES MASSES MUSCULAIRES
# -----------------------------------------------------------------------
# Chaque entree : (x, y, z, rayon vise). Le rayon est celui de la SURFACE
# FINIE, pas celui de la metaball — le sculpteur calibre les metaballs pour
# atteindre ces rayons-la, parce que deux metaballs voisines se fondent et
# gonflent l'une l'autre de facon impossible a predire a la main.
#
# Les groupes sont mesures separement (une metaball par groupe) : sans cela,
# un rayon lance depuis l'axe d'une cuisse traverserait l'entrejambe et
# mesurerait l'autre cuisse. Le corps entier, lui, est refondu d'un bloc
# pour le rendu.
#
# Les valeurs decrivent un sprinter entraine : epaules et dorsaux larges,
# taille pincee, fessier et quadriceps epais, mollet haut et court, cheville
# fine. C'est ce contraste-la qui se lit de loin, bien plus que le detail.

def masses(fem=False, morph=None):
    """Les masses du sculpteur, par groupe, pour un gabarit donne.

    Chaque entree : (x, z, rayon moyen vise, ecart en profondeur, ecart en
    largeur). Les ecarts dedoublent la masse de part et d'autre de l'axe :
    deux billes voisines se fondent en un ovale, et c'est ainsi qu'on
    obtient un torse large et plat ou une cuisse plus profonde que large,
    sans jamais sculpter autre chose que des spheres. Le rayon vise, lui,
    est la MOYENNE des deux demi-axes — exactement la grandeur dont le
    moteur se sert pour epaissir un tronc de cone.
    """
    M = morph or {}
    ksh  = M.get('sh', 1.0)     # carrure
    khip = M.get('hip', 1.0)    # bassin
    karm = M.get('arm', 1.0)    # bras
    kleg = M.get('leg', 1.0)    # jambes

    E = ecarts(fem)
    sy, hy = E['sh'], E['hip']

    # Gabarit feminin : epaules moins larges, bassin plus large, masses
    # musculaires plus fines mais jambes a peine moins fortes — une
    # sprinteuse n'est pas un homme reduit.
    if fem:
        f_torse, f_epaule, f_bras, f_cuisse, f_mollet = 0.90, 0.88, 0.87, 0.94, 0.92
        f_bassin = 1.08
    else:
        f_torse, f_epaule, f_bras, f_cuisse, f_mollet = 1.00, 1.00, 1.00, 1.00, 1.00
        f_bassin = 1.00

    G = {}

    # --- bassin ---------------------------------------------------------
    # Large de hanche, et le fessier qui ressort vers l'arriere (x negatif).
    kb = f_bassin * khip
    G['pelvis'] = [
        (0.000, 0.960, 0.100 * kb, 0.000, 0.026 * kb),
        (-0.010, 0.912, 0.110 * kb, 0.000, 0.032 * kb),
        (-0.026, 0.868, 0.112 * kb, 0.016, 0.030 * kb),   # fessier
        (0.000, 0.812, 0.102 * kb, 0.000, 0.026 * kb),
        (0.004, 0.772, 0.092 * kb, 0.000, 0.020 * kb),
    ]

    # --- torse ----------------------------------------------------------
    # Deux choses se jouent ici, et l'ancien modele n'avait ni l'une ni
    # l'autre : la taille se pince sous les cotes, et le buste s'aplatit en
    # s'elargissant vers les epaules. Un dos de sprinter est un triangle,
    # pas une colonne.
    kt = f_torse * ksh
    G['torso'] = [
        # Le maillot descend un peu plus bas que la ceinture du short et la
        # recouvre. Sans ce recouvrement, le buste bascule vers l'avant en
        # course et decouvre le haut du short par l'arriere : un disque
        # sombre apparait alors en travers des hanches.
        (0.000, 0.928, 0.107 * kt, 0.000, 0.028 * kt),
        (0.000, 0.948, 0.110 * kt, 0.000, 0.030 * kt),
        (0.000, 0.995, 0.102 * kt, 0.000, 0.028 * kt),   # taille pincee
        (0.004, 1.048, 0.113 * kt, 0.000, 0.036 * kt),
        (0.008, 1.108, 0.129 * kt, 0.000, 0.046 * kt),   # bas des cotes
        (0.010, 1.172, 0.143 * kt, 0.000, 0.056 * kt),
        (0.008, 1.238, 0.151 * kt, 0.000, 0.062 * kt),   # pectoraux, dorsaux
        (0.000, 1.300, 0.142 * kt, 0.000, 0.056 * kt),
        (-0.004, 1.352, 0.104 * kt, 0.000, 0.032 * kt),  # trapeze
    ]

    # --- cou et tete -----------------------------------------------------
    G['neck'] = [
        (0.000, 1.372, 0.058, 0.000, 0.008),
        (0.002, 1.420, 0.050, 0.000, 0.006),
        (0.004, 1.462, 0.052, 0.000, 0.006),
    ]
    # Un crane est plus profond que large, la machoire se retrecit, le
    # menton avance : d'ou les ecarts en profondeur plutot qu'en largeur.
    G['head'] = [
        (0.004, 1.470, 0.068, 0.010, 0.000),   # machoire
        (0.008, 1.512, 0.078, 0.014, 0.000),
        (0.004, 1.552, 0.084, 0.016, 0.000),   # crane
        (-0.004, 1.592, 0.078, 0.012, 0.000),
        (-0.010, 1.622, 0.056, 0.006, 0.000),  # sommet
    ]

    # --- deltoide --------------------------------------------------------
    ke = f_epaule * ksh
    G['deltoid'] = [
        (0.000, 1.296, 0.052 * ke, 0.000, 0.004),
        (0.000, 1.330, 0.062 * ke, 0.004, 0.006),
        (0.000, 1.366, 0.056 * ke, 0.000, 0.004),
    ]

    # --- bras ------------------------------------------------------------
    # Le ventre du biceps est au tiers superieur, pas au milieu, et le
    # coude est un os : il se resserre nettement.
    ka = f_bras * karm
    G['upperarm'] = [
        (0.000, 1.352, 0.056 * ka, 0.004, 0.000),
        (0.000, 1.296, 0.058 * ka, 0.006, 0.000),
        (0.002, 1.236, 0.054 * ka, 0.006, 0.000),   # biceps
        (0.002, 1.170, 0.046 * ka, 0.004, 0.000),
        (0.000, 1.112, 0.040 * ka, 0.000, 0.000),
        (0.000, 1.076, 0.038 * ka, 0.000, 0.000),   # coude
    ]
    # Masse haute juste sous le coude, poignet tres fin, puis la main.
    G['forearm'] = [
        (0.000, 1.106, 0.042 * ka, 0.004, 0.000),
        (0.002, 1.048, 0.045 * ka, 0.006, 0.000),   # brachio-radial
        (0.004, 0.986, 0.038 * ka, 0.004, 0.000),
        (0.004, 0.930, 0.031 * ka, 0.000, 0.000),
        (0.004, 0.884, 0.026 * ka, 0.000, 0.002),   # poignet
        (0.010, 0.848, 0.032 * ka, 0.008, 0.000),   # main
        (0.012, 0.812, 0.026 * ka, 0.006, 0.000),
    ]

    # --- cuisse -----------------------------------------------------------
    # Quadriceps devant, ischios derriere : une cuisse de sprinter est
    # nettement plus profonde que large.
    kc = f_cuisse * kleg
    G['thigh'] = [
        (-0.006, 0.872, 0.104 * kc, 0.020, 0.000),
        (-0.008, 0.812, 0.102 * kc, 0.024, 0.000),  # haut de cuisse
        (-0.002, 0.740, 0.094 * kc, 0.022, 0.000),
        (0.000, 0.668, 0.084 * kc, 0.018, 0.000),
        (0.002, 0.598, 0.073 * kc, 0.014, 0.000),
        (0.002, 0.532, 0.064 * kc, 0.010, 0.000),
        (0.000, 0.478, 0.058 * kc, 0.006, 0.000),   # au-dessus du genou
        (0.000, 0.446, 0.056 * kc, 0.004, 0.000),
    ]

    # --- jambe ------------------------------------------------------------
    # Mollet haut et court, cheville fine : la signature d'un sprinter.
    km = f_mollet * kleg
    G['shank'] = [
        (0.000, 0.470, 0.057 * km, 0.004, 0.000),
        (-0.004, 0.428, 0.056 * km, 0.006, 0.000),  # genou
        (-0.010, 0.376, 0.066 * km, 0.016, 0.000),  # ventre du mollet
        (-0.010, 0.322, 0.064 * km, 0.016, 0.000),
        (-0.004, 0.262, 0.052 * km, 0.010, 0.000),
        (0.000, 0.196, 0.040 * km, 0.006, 0.000),
        (0.002, 0.134, 0.032 * km, 0.002, 0.000),
        (0.004, 0.086, 0.029 * km, 0.000, 0.000),   # cheville
    ]

    # Les membres ne sont pas au milieu du corps : on les pose sur leur axe.
    for g in ('deltoid', 'upperarm', 'forearm'):
        G[g] = [(x, sy, z, r, dx, dy) for (x, z, r, dx, dy) in G[g]]
    for g in ('thigh', 'shank'):
        G[g] = [(x, hy, z, r, dx, dy) for (x, z, r, dx, dy) in G[g]]
    for g in ('pelvis', 'torso', 'neck', 'head'):
        G[g] = [(x, 0.0, z, r, dx, dy) for (x, z, r, dx, dy) in G[g]]

    return fermer(G, fem)


# -----------------------------------------------------------------------
# FERMER LES VOLUMES AU-DELA DE CE QU'ON MESURE
# -----------------------------------------------------------------------
# Une masse posee au bout d'un groupe joue deux roles incompatibles : elle
# decrit une section, et elle referme le volume en dome. La calibration ne
# peut pas l'ajuster — un sommet de crane n'a pas d'epaisseur a regler — et
# elle reste donc au rayon brut, plus epais que voulu. Tant que la chaine
# ne mesurait pas jusque-la, cela ne se voyait pas. Mais elle y allait : le
# haut du bassin ressortait alors de seize millimetres au-dessus de la
# taille, et son disque tranchait a travers le maillot.
#
# On ajoute donc, de part et d'autre de chaque plage mesuree, une masse qui
# ne sert qu'a fermer. Elle est hors de portee des rayons, la calibration
# l'ignore comme avant, et tout ce qui est MESURE se trouve desormais dans
# la zone que la calibration tient vraiment.
MARGE = 0.018


def fermer(G, fem):
    """Coiffer chaque groupe au-dela de ce que sa chaine va mesurer."""
    plages = {nom: zw for _n, nom, zw, _zl, _ax, _ns in
              [(c[0], c[1], c[2], c[3], c[4], c[5]) for c in chaines(fem)]}
    for g, masses in G.items():
        zw = plages.get(g)
        if not zw:
            continue
        masses.sort(key=lambda m: m[2])
        for bord, voisine in ((zw[0] - MARGE, masses[0]), (zw[1] + MARGE, masses[-1])):
            x, y, _z, r, dx, dy = voisine
            # Un peu plus fine que sa voisine : le volume se referme en
            # s'arrondissant, il ne se termine pas a plat.
            masses.append((x, y, bord, r * 0.78, dx * 0.6, dy * 0.6))
        masses.sort(key=lambda m: m[2])
    return G


# -----------------------------------------------------------------------
# LES CHAINES A MESURER
# -----------------------------------------------------------------------
# Une chaine remplace un groupe de segments de pose() par une suite de
# troncs de cone mesures. Elle dit sur quelle tranche de hauteur mesurer,
# et comment retomber dans le repere local du rig.
#
#   groupe  : quelle metaball interroger
#   zw      : (bas, haut) en hauteur reelle
#   zl      : hauteur locale correspondant a zw[0], dans le repere du pivot
#   axe     : (x, y) de l'axe de mesure — un bras n'est pas au milieu du corps
#   n       : nombre de troncs aux trois niveaux de detail (pres, moyen, loin)
#
# Les niveaux de detail existent parce que huit coureurs a l'ecran ne
# peuvent pas tous payer soixante troncs de cone. Ils sont mesures sur le
# MEME maillage : un coureur lointain est le meme corps, echantillonne plus
# grossierement, pas un autre personnage.

def chaines(fem=False):
    E = ecarts(fem)
    sy, hy = E['sh'], E['hip']
    return [
        # nom,        groupe,     zw,                 zl,      axe,        n
        ('pelvis',   'pelvis',   (0.772, 0.968),   -0.098,  (0.0, 0.0),  (4, 2, 1)),
        ('torso',    'torso',    (0.930, 1.350),    0.060,  (0.0, 0.0),  (7, 4, 2)),
        ('neck',     'neck',     (1.380, 1.464),    0.510,  (0.0, 0.0),  (2, 1, 1)),
        ('head',     'head',     (1.456, 1.628),    0.586,  (0.0, 0.0),  (3, 2, 1)),
        ('deltoid',  'deltoid',  (1.282, 1.382),    0.412,  (0.0, sy),   (2, 1, 1)),
        ('upperarm', 'upperarm', (1.090, 1.340),   -0.250,  (0.0, sy),   (5, 3, 2)),
        ('forearm',  'forearm',  (0.816, 1.090),   -0.274,  (0.0, sy),   (5, 3, 2)),
        ('thigh',    'thigh',    (0.470, 0.850),   -0.380,  (0.0, hy),   (6, 4, 2)),
        ('shank',    'shank',    (0.078, 0.458),   -0.380,  (0.0, hy),   (6, 4, 2)),
    ]
