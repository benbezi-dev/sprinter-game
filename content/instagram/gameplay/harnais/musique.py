#!/usr/bin/env python3
"""
LA BANDE-SON — composee ici, synthetisee echantillon par echantillon.

POURQUOI ON LA FABRIQUE PLUTOT QUE DE LA CHOISIR. Un teaser publie avec un
morceau qu'on ne possede pas se fait couper le son par la plateforme, quand il
n'est pas retire ; et il n'y a, sur cette machine, aucune musique sous licence
a poser dessus. Une piste synthetisee est donc le seul choix qui laisse la
video utilisable partout — et elle a un avantage qu'aucun morceau achete n'a :
elle est CALEE SUR LES COUPES du montage, parce qu'elle est ecrite a partir
d'elles. Les bornes des plans arrivent en argument.

CE QU'ELLE CHERCHE A FAIRE. « Une atmosphere et une musique de competition qui
donne envie de participer » : d'ou un stade avant l'appel, un coup de
pistolet, une pulsation qui ne lache pas, et une seule respiration — celle du
carton de la date, ou tout tombe sauf la basse. La montee ne s'arrete pas a la
fin : le dernier accord reste ouvert, parce qu'un teaser ne conclut pas, il
convoque.

AUCUNE DEPENDANCE. numpy n'est pas installe sur cette machine et l'installer
pour trois filtres serait payer cher un import ; tout est en bibliotheque
standard (`array`, `wave`, `math`). Il faut compter quelques secondes de
calcul pour vingt secondes de son, ce qui est sans importance : la piste ne se
recalcule qu'a chaque remontage.

LA VOIX, QUAND IL Y EN A UNE. `voix.py` rend un WAV deja cale sur le film ;
il arrive ici par la cle `voix` et devient un TROISIEME bus. Il n'est pas
melange a la musique : il la fait BAISSER. Une annonce de stade passe parce
que la sono baisse la musique sous elle, pas parce qu'on l'a montee plus fort
— monter la voix sur une piste qui ne bouge pas donne deux choses fortes qui
se battent, et c'est la voix qui perd, parce que c'est elle qui porte les
consonnes. Voir `attenuation()`.

    python3 musique.py spec.json
    { "sortie": "...wav", "duree": 18.3, "coupes": [...], "date": 15.9,
      "signature": 14.8, "voix": "...wav" }
"""
import array, json, math, sys, wave

TE = 48000            # taux d'echantillonnage
BPM = 132             # la pulsation. Assez haut pour courir, pas assez pour paniquer.
BAT = 60.0 / BPM      # une croche noire

# --------------------------------------------------------------------- outils

class Bruit:
    """Un generateur reproductible : deux rendus de la meme spec sont identiques.

    `random` de la bibliotheque standard ferait l'affaire, mais un LCG tenu ici
    garantit que la piste ne bouge pas d'un octet d'une version de Python a
    l'autre — ce qui compte pour une video qu'on remonte et republie.
    """
    def __init__(self, graine=20260909):
        self.e = graine
    def __call__(self):
        self.e = (self.e * 1103515245 + 12345) & 0x7fffffff
        return self.e / 0x3fffffff - 1.0


def passe_bas(x, f, q=0.7071):
    """Filtre biquad passe-bas (Audio EQ Cookbook, Robert Bristow-Johnson).

    Un filtre a un pole suffirait pour du bruit, pas pour une nappe : sa pente
    de 6 dB/octave laisse passer assez d'aigu pour que la basse « chante » et
    se batte avec la charleston. Douze dB/octave separent les deux.
    """
    w = 2 * math.pi * f / TE
    a = math.sin(w) / (2 * q)
    c = math.cos(w)
    b0, b1, b2 = (1 - c) / 2, 1 - c, (1 - c) / 2
    a0, a1, a2 = 1 + a, -2 * c, 1 - a
    return _biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def passe_haut(x, f, q=0.7071):
    w = 2 * math.pi * f / TE
    a = math.sin(w) / (2 * q)
    c = math.cos(w)
    b0, b1, b2 = (1 + c) / 2, -(1 + c), (1 + c) / 2
    a0, a1, a2 = 1 + a, -2 * c, 1 - a
    return _biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def passe_bande(x, f, q=2.0):
    w = 2 * math.pi * f / TE
    a = math.sin(w) / (2 * q)
    c = math.cos(w)
    b0, b1, b2 = a, 0.0, -a
    a0, a1, a2 = 1 + a, -2 * c, 1 - a
    return _biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def _biquad(x, b0, b1, b2, a1, a2):
    y = array.array('d', bytes(8 * len(x)))
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, x[i]
        y2, y1 = y1, v
        y[i] = v
    return y


def vide(n):
    return array.array('d', bytes(8 * n))


def lire_wav(chemin, n):
    """Lit un WAV 48 kHz en un bus de `n` echantillons (canal gauche).

    La voix est monophonique par construction — une sono de stade n'a pas de
    stereo — et les deux canaux du fichier sont identiques : en lire un seul
    n'est donc pas une perte, c'est ce qui a ete ecrit.
    """
    with wave.open(chemin) as w:
        if w.getframerate() != TE or w.getsampwidth() != 2:
            raise SystemExit(f'musique.py : {chemin} est en {w.getframerate()} Hz '
                             f'{8 * w.getsampwidth()} bits, attendu {TE} Hz 16 bits')
        ch, m = w.getnchannels(), w.getnframes()
        crus = array.array('h'); crus.frombytes(w.readframes(m))
    x = vide(n)
    for i in range(min(n, m)):
        x[i] = crus[i * ch] / 32768.0
    return x


def attenuation(voix, profondeur, attaque=0.025, relachement=0.28):
    """L'enveloppe par laquelle la voix fait baisser un autre bus.

    C'est un suiveur de crete, pas une porte : il descend en 25 ms — assez vite
    pour que le premier mot ne soit pas mange — et il remonte en 280 ms, assez
    lentement pour ne pas pomper entre deux mots d'une meme phrase. Une remontee
    rapide s'entend davantage que l'attenuation elle-meme.

    LA REFERENCE EST UN CENTILE, PAS LE MAXIMUM. Prise sur le maximum du
    suiveur — le premier choix, et le plus evident —, l'attenuation
    n'atteignait sa pleine profondeur nulle part : le maximum est une pointe
    (une plosive, deux queues de reverberation qui se croisent), il est 2,6 dB
    au-dessus du niveau de parole ordinaire, et la musique ne baissait donc que
    de 4,9 dB la ou 5,7 etaient demandes. Le 75e centile des echantillons
    ACTIFS — ceux au-dessus de 5 % de la pointe, pour ne pas compter les
    silences — est le niveau de parole lui-meme. Un seuil en dur, lui, se
    decalerait a chaque changement de voix de synthese.
    """
    ka = math.exp(-1.0 / (attaque * TE))
    kr = math.exp(-1.0 / (relachement * TE))
    e = 0.0
    suiv = vide(len(voix))
    for i in range(len(voix)):
        a = abs(voix[i])
        e = a + (ka if a > e else kr) * (e - a)
        suiv[i] = e
    pointe = max(suiv)
    actifs = sorted(v for v in suiv if v > pointe * 0.05)
    ref = (actifs[int(0.75 * len(actifs))] if actifs else pointe) or 1.0
    for i in range(len(suiv)):
        suiv[i] = 1.0 - profondeur * min(1.0, suiv[i] / ref)
    return suiv


def poser(piste, debut, son, gain=1.0):
    """Ajoute `son` dans `piste` a partir de la seconde `debut`."""
    i = int(debut * TE)
    n = len(piste)
    for k in range(len(son)):
        j = i + k
        if 0 <= j < n:
            piste[j] += son[k] * gain


def env(n, attaque, chute, tenue=0.0, fin=None):
    """Une enveloppe attaque / tenue / chute, en echantillons."""
    e = array.array('d', bytes(8 * n))
    a = max(1, int(attaque * TE))
    t = int(tenue * TE)
    for i in range(n):
        if i < a:
            e[i] = i / a
        elif i < a + t:
            e[i] = 1.0
        else:
            d = (i - a - t) / max(1, int(chute * TE))
            e[i] = math.exp(-3.2 * d) if fin is None else max(fin, math.exp(-3.2 * d))
    return e


# ------------------------------------------------------------------ les voix

def grosse_caisse(f0=115.0, f1=42.0, duree=0.30):
    """Le coup de pied : une sinusoide qui plonge, et un claquement au debut.

    La plongee de hauteur est ce qui fait le grave d'une grosse caisse ; sans
    elle on entend un bourdon. Le claquement (une pointe tres courte) est ce
    qui la rend audible sur un haut-parleur de telephone, ou le 42 Hz n'existe
    tout simplement pas.
    """
    n = int(duree * TE)
    s = vide(n)
    ph = 0.0
    for i in range(n):
        a = i / n
        f = f1 + (f0 - f1) * math.exp(-7.0 * a)
        ph += 2 * math.pi * f / TE
        s[i] = math.sin(ph) * math.exp(-4.5 * a)
    clac = vide(int(0.006 * TE))
    b = Bruit(4242)
    for i in range(len(clac)):
        clac[i] = b() * (1 - i / len(clac))
    poser(s, 0.0, passe_haut(clac, 1800), 0.5)
    return s


def claquement(duree=0.20):
    """Le contretemps : trois bouffees de bruit tres serrees, puis une queue.

    Une seule bouffee donne un « tac » sec de boite a rythmes. Trois, espacees
    de quelques millisemes, donnent le grain d'un claquement de mains — c'est
    ce decalage, et rien d'autre, qui fait la difference.
    """
    n = int(duree * TE)
    b = Bruit(777)
    s = vide(n)
    for i in range(n):
        s[i] = b()
    s = passe_bande(s, 1500, q=1.1)
    e = env(n, 0.001, 0.055)
    for d in (0.000, 0.009, 0.017):
        k = int(d * TE)
        for i in range(n - k):
            s[i + k] += s[i] * 0.5 * math.exp(-40 * d)
    for i in range(n):
        s[i] *= e[i]
    return s


def charleston(duree=0.055, ouverte=False):
    n = int(duree * (2.6 if ouverte else 1.0) * TE)
    b = Bruit(31337)
    s = vide(n)
    for i in range(n):
        s[i] = b()
    s = passe_haut(s, 7200, q=0.8)
    e = env(n, 0.0006, 0.020 if not ouverte else 0.090)
    for i in range(n):
        s[i] *= e[i]
    return s


def stab(freqs, duree, attaque=0.008, detune=0.004):
    """Un accord de cuivres synthetiques : des dents de scie desaccordees.

    Trois scies par note, legerement desaccordees : c'est le desaccord qui
    donne la largeur, et c'est ce que cherche un hymne de stade. Filtre a
    2,4 kHz, sinon les harmoniques hautes d'une scie sifflent au telephone.
    """
    n = int(duree * TE)
    s = vide(n)
    for f in freqs:
        for k, d in enumerate((-detune, 0.0, detune)):
            ph = 0.0
            inc = f * (1 + d) / TE
            for i in range(n):
                ph = (ph + inc) % 1.0
                s[i] += (2 * ph - 1) * 0.30
    s = passe_bas(s, 2400, q=0.8)
    e = env(n, attaque, duree * 0.7, tenue=duree * 0.18)
    for i in range(n):
        s[i] *= e[i]
    return s


def basse(f, duree):
    """La basse : une sinusoide et sa quinte douce, tenues.

    Elle porte la piste quand tout le reste tombe — sur le carton de la date,
    c'est elle qui reste seule.
    """
    n = int(duree * TE)
    s = vide(n)
    ph = ph2 = 0.0
    for i in range(n):
        ph += 2 * math.pi * f / TE
        ph2 += 2 * math.pi * f * 1.5 / TE
        s[i] = math.sin(ph) + 0.12 * math.sin(ph2)
    e = env(n, 0.012, duree * 0.9, tenue=duree * 0.55)
    for i in range(n):
        s[i] *= e[i]
    return s


def impact(duree=1.5):
    """Le coup sur une coupe : une pointe grave, un eclat metallique, une queue.

    C'est la piece qui CALE le son sur l'image. Un impact place a la seconde
    exacte d'une coupe fait lire la coupe comme voulue ; place a cote, il fait
    lire le montage comme rate.
    """
    n = int(duree * TE)
    s = vide(n)
    ph = 0.0
    for i in range(n):
        a = i / n
        f = 38 + 90 * math.exp(-16 * a)
        ph += 2 * math.pi * f / TE
        s[i] = math.sin(ph) * math.exp(-3.4 * a) * 1.1
    b = Bruit(9091)
    ec = vide(int(0.6 * TE))
    for i in range(len(ec)):
        ec[i] = b()
    ec = passe_bande(ec, 3400, q=0.7)
    for i in range(len(ec)):
        ec[i] *= math.exp(-9.0 * i / len(ec))
    poser(s, 0.0, ec, 0.32)
    return s


def pistolet():
    """Le coup de pistolet. Le geste du jeu, et l'ouverture du film.

    Deux couches : le claquement (large bande, tres court) et la reverberation
    du stade (bruit filtre qui decroit sur une seconde et demie). Sans la
    seconde, on entend un clic dans une piece ; avec, un stade.
    """
    b = Bruit(1861)
    n = int(1.8 * TE)
    s = vide(n)
    clac = int(0.004 * TE)
    for i in range(clac):
        s[i] = b() * (1 - i / clac)
    queue = vide(n)
    for i in range(n):
        queue[i] = b()
    queue = passe_bande(queue, 900, q=0.35)
    for i in range(n):
        queue[i] *= math.exp(-4.2 * i / n)
    for i in range(n):
        s[i] = s[i] * 0.9 + queue[i] * 0.28
    return passe_haut(s, 180)


def stade(duree, cycle=None, b=None):
    """La foule : du bruit filtre, module lentement, plus des houles.

    Une bande plate ne s'entend pas comme une foule mais comme du souffle. Ce
    qui fait la foule, c'est la MODULATION — trois oscillations lentes qui ne
    retombent jamais ensemble, si bien que la nappe ne se repete pas a
    l'oreille sur la duree d'un teaser.

    `cycle` REND CETTE MODULATION PERIODIQUE SUR LA DUREE DU FILM, et c'est ce
    qui la fait traverser le bouclage. Les periodes valaient 3,7 / 1,3 /
    0,61 s, choisies pour ne pas se repeter — et elles tombaient donc a un
    endroit quelconque de leur course a la derniere image. Mesure : le stade
    rendait 0,048 a l'ouverture et 0,022 a la fermeture, non parce qu'on le
    baissait, mais parce qu'il se trouvait dans un creux de houle. Le reel
    boucle, et l'oreille entend ce marchepied a chaque tour.
    
    Cycle/5, cycle/13, cycle/29 : trois periodes qui tiennent un nombre ENTIER
    de fois dans le film — donc identiques a la premiere et a la derniere
    image — et dont les rapports restent assez irreguliers pour qu'aucune
    pulsation ne s'entende. Le bruit lui-meme n'a pas besoin de boucler : il
    n'a pas de phase, seulement un niveau.

    LA MISE EN FORME, ET C'EST UNE CORRECTION : CA GRESILLAIT.
    Le filtre etait un `passe_bande(1100, q=0.28)`, et un Q de 0,28 a des
    pentes de 6 dB/octave — trop douces pour renverser la pente du bruit
    BLANC, qui monte de 3 dB par octave des qu'on le mesure par bandes. Mesure
    en bandes d'octave, par rapport au 500 Hz : le 2 kHz sortait a +5,3 dB et
    le 4 kHz a +5,6 dB. Une foule ne fait pas ca. Ce que ca fait, c'est du
    souffle — et l'attenuation de la musique sous la voix off, en creusant le
    lit de 8 dB, a mis ce souffle a nu.

    Une foule lointaine dans un bol est PLATE de 250 a 1000 Hz puis TOMBE.
    Passe-haut a 150 Hz (pas de grondement) et DEUX passe-bas a 1000 Hz en
    cascade : 24 dB/octave, dont 3 sont rendus au bruit blanc, soit une chute
    nette de 7 dB par octave au-dessus du kilohertz. Mesure apres : 4 kHz a
    −15,6 dB du 500 Hz au lieu de +5,6 — vingt et un decibels de souffle en
    moins, et le 250–1000 Hz intact, qui est la bande ou une foule s'entend
    comme des gens.

    Le NIVEAU EST NORMALISE en sortie, et il le faut : deux passe-bas en
    cascade emportent l'essentiel de l'energie d'un bruit blanc, et sans cette
    normalisation la foule aurait disparu du melange au lieu de changer de
    couleur. Le facteur est un scalaire — il ne touche donc pas la periodicite
    des houles, donc pas le point de bouclage.
    """
    n = int(duree * TE)
    c = cycle or duree
    b = b or Bruit(5150)
    s = vide(n)
    for i in range(n):
        s[i] = b()
    s = passe_haut(s, 150.0, q=0.7)
    s = passe_bas(s, 1000.0, q=0.7)
    s = passe_bas(s, 1000.0, q=0.7)
    # 0,130 est cale pour que la foule rende le MEME RMS qu'avant (0,1399
    # mesure) : elle garde exactement le niveau qu'elle avait, elle n'a que
    # change de timbre. La valeur tient compte des houles, appliquees apres.
    r = math.sqrt(sum(v * v for v in s) / n) or 1.0
    k = 0.130 / r
    for i in range(n):
        t = i / TE
        m = (1.0
             + 0.32 * math.sin(2 * math.pi * 5 * t / c)
             + 0.20 * math.sin(2 * math.pi * 13 * t / c + 1.1)
             + 0.12 * math.sin(2 * math.pi * 29 * t / c + 2.4))
        s[i] *= max(0.15, m) * k
    return s


def montee(duree):
    """La montee vers le carton de la date : du bruit qui grimpe, et un balayage.

    Le passe-bande fixe ne monterait pas ; c'est la FREQUENCE qui doit grimper.
    Faute de filtre variable ici, on somme trois bandes dont les enveloppes se
    relaient — grave d'abord, aigu a la fin. Le resultat monte a l'oreille.
    """
    n = int(duree * TE)
    b = Bruit(6262)
    brut = vide(n)
    for i in range(n):
        brut[i] = b()
    s = vide(n)
    for f, (d0, d1) in ((700, (0.00, 0.55)), (2200, (0.30, 0.85)), (6000, (0.60, 1.00))):
        bande = passe_bande(brut, f, q=0.9)
        for i in range(n):
            a = i / n
            g = 0.0
            if d0 <= a <= d1:
                x = (a - d0) / (d1 - d0)
                g = math.sin(math.pi * x) ** 1.4
            s[i] += bande[i] * g * 0.55
    # le balayage : une sinusoide qui monte de deux octaves
    ph = 0.0
    for i in range(n):
        a = i / n
        f = 220 * (2 ** (2.2 * a))
        ph += 2 * math.pi * f / TE
        s[i] += math.sin(ph) * 0.16 * (a ** 2)
    return s


# ------------------------------------------------------------------ le mixage

# La gamme : la mineur. Elle porte le dore sur nuit du jeu sans le rendre
# triste — un mineur qui monte se lit comme de la tension, pas comme du deuil.
LA = 110.0
def note(demi):
    return LA * (2 ** (demi / 12.0))

MINEUR = [0, 3, 7, 10, 12, 15, 19, 22, 24]     # la, do, mi, sol, la, do, mi, sol, la

# Le niveau de la voix dans le melange, et il est REGLE PAR MESURE.
#
# A 0,72 — la premiere valeur essayee, choisie a l'oreille de l'esprit — la
# voix ressortait 6,4 dB SOUS la musique en moyenne et jusqu'a 8,4 dB sous
# elle : enterree. A 1,55 elle passe a +3,1 dB au-dessus du lit, et la pire
# de ses six lignes reste a +0,4 dB, donc jamais sous la musique. La crete du
# melange ne bouge pas (−2,57 dB) : c'est la normalisation de `ecrire()` qui
# l'absorbe, et le monter encore ne rendrait pas la voix plus claire, il
# ecraserait la musique.
VOIX = 1.55

# La sonie visee, en RMS lineaire : −14,5 dB, la cible d'Instagram. C'est la
# valeur que rendait la version musique seule du 9 septembre, et les versions
# avec voix doivent tomber dessus aussi — sans quoi l'une s'entend plus fort
# que l'autre dans un fil qui les enchaine.
CIBLE_RMS = 10 ** (-14.5 / 20.0)


def composer(spec):
    duree = float(spec['duree'])
    coupes = [float(c) for c in spec.get('coupes', [])]
    tDate = float(spec.get('date', duree))
    # L'entree de la signature. Elle recoit un accent plus doux que la date :
    # sans lui, la respiration qui suit le carton durerait cinq secondes sans
    # un evenement, et une fin sans evenement s'affaisse au lieu de se poser.
    tSign = spec.get('signature')
    tSign = float(tSign) if tSign is not None else None
    n = int((duree + 1.2) * TE)          # une queue, pour que rien ne soit coupe net
    piste = vide(n)                      # la musique : elle se ferme a la fin
    fond = vide(n)                       # le stade : il ne se ferme PAS

    # 1 · LE STADE, ET IL TRAVERSE LE POINT DE BOUCLAGE.
    #
    # Un reel boucle, et la nappe de foule est la seule voix qui puisse le
    # traverser sans se trahir : c'est du bruit, il n'a pas de phase a
    # raccorder, seulement un NIVEAU. Elle etait pourtant traitee comme le
    # reste — elle descendait a un quart sous le carton de la date, puis le
    # fondu de sortie general l'emmenait a zero. Mesure au point de bouclage :
    # 0,018 contre 0,181 a la reprise, un facteur DIX. Le stade disparaissait
    # et revenait d'un coup a chaque tour, et c'est ce trou qu'on entend.
    #
    # Elle dessine donc un V : elle se retire pour laisser la respiration du
    # carton de la date, puis REMONTE a son niveau d'ouverture sur la derniere
    # seconde et demie. Le film rejoue a l'interieur d'un stade qui, lui, ne
    # s'arrete jamais.
    OUVERTURE, CREUX = 0.30, 0.11
    # `cycle=duree` : la houle boucle sur la DUREE DU FILM, pas sur celle du
    # tableau — la queue de 1,2 s n'est jamais jouee, elle sert au limiteur.
    amb = stade(duree + 1.2, cycle=duree)
    for i in range(len(amb)):
        t = i / TE
        if t < tDate:
            g = OUVERTURE
        elif t < tDate + 0.9:
            g = OUVERTURE + (CREUX - OUVERTURE) * ((t - tDate) / 0.9)
        else:
            # la remontee vise la DERNIERE image, pas la queue de la piste
            a2 = min(1.0, max(0.0, (t - (duree - 1.5)) / 1.5))
            g = CREUX + (OUVERTURE - CREUX) * (a2 ** 0.7)
        fond[i] += amb[i] * g

    # 2 · le coup de pistolet ouvre, sur l'image du panneau.
    poser(piste, 0.02, pistolet(), 0.42)

    # 3 · la pulsation. Elle entre au deuxieme temps, pas au premier : le
    #     pistolet a besoin d'un demi-battement de silence pour exister.
    gc, cl = grosse_caisse(), claquement()
    ht, ho = charleston(), charleston(ouverte=True)
    t = BAT
    bat = 0
    while t < tDate - 0.05:
        poser(piste, t, gc, 0.62)
        if bat % 4 in (1, 3):
            poser(piste, t, cl, 0.30)
        for k in (0.5, 0.25, 0.75):
            tt = t + k * BAT
            if tt < tDate:
                poser(piste, tt, ho if (bat % 8 == 7 and k == 0.75) else ht,
                      0.16 if k == 0.5 else 0.10)
        t += BAT
        bat += 1

    # 4 · la basse suit les plans : une note par plan, qui monte dans la gamme.
    #     C'est ce qui donne au film une direction plutot qu'une boucle.
    bornes = [0.0] + coupes + [tDate]
    for k in range(len(bornes) - 1):
        d0, d1 = bornes[k], bornes[k + 1]
        if d1 - d0 < 0.2:
            continue
        f = note(MINEUR[min(k, len(MINEUR) - 1)] - 12)
        poser(piste, d0, basse(f, d1 - d0 + 0.25), 0.42)

    # 5 · un impact sur chaque coupe, et un accord montant avec.
    for k, c in enumerate(coupes):
        poser(piste, c, impact(), 0.50)
        deg = MINEUR[min(k + 2, len(MINEUR) - 1)]
        poser(piste, c, stab([note(deg), note(deg + 3), note(deg + 7)], 0.55), 0.20)

    # 6 · la montee vers la date, puis la respiration : tout tombe, il ne reste
    #     que la basse tenue et le dernier accord, ouvert.
    poser(piste, max(0.0, tDate - 1.7), montee(1.7), 0.34)
    poser(piste, tDate, impact(2.2), 0.60)
    poser(piste, tDate, basse(note(-12), duree - tDate + 1.0), 0.46)
    poser(piste, tDate + 0.02,
          stab([note(0), note(3), note(7), note(12)], duree - tDate + 0.9,
               attaque=0.05), 0.17)

    # 7 · la signature : un accent doux, et l'accord se REVOICE vers le haut.
    #     Le meme accord tenu jusqu'au bout donnerait une fin qui s'eteint ;
    #     monter la voix superieure d'une quarte le fait se poser sans conclure
    #     — ce qu'un teaser doit faire, puisqu'il convoque au lieu d'achever.
    if tSign is not None and tSign < duree:
        poser(piste, tSign, impact(1.8), 0.30)
        poser(piste, tSign + 0.03,
              stab([note(0), note(7), note(12), note(15)], duree - tSign + 0.9,
                   attaque=0.14), 0.19)

    # 8 · LA VOIX, et les deux attenuations qu'elle commande.
    #
    # La musique baisse de 8,4 dB sous la parole, le stade de 3,1 dB seulement :
    # le stade est du bruit large, il ne masque pas les consonnes, et le faire
    # plonger avec la musique ferait respirer la foule au rythme des phrases —
    # un defaut qu'on entend tout de suite dans un lieu qu'on sait continu.
    voix = vide(n)
    if spec.get('voix'):
        voix = lire_wav(spec['voix'], n)
        aM = attenuation(voix, 0.62)
        aS = attenuation(voix, 0.30)
        for i in range(n):
            piste[i] *= aM[i]
            fond[i] *= aS[i]

    return piste, fond, voix, n


def ecrire(piste, fond, voix, n, chemin, duree):
    """Ecrit la piste en WAV stereo 16 bits, avec un limiteur doux.

    Le limiteur n'est pas une precaution de confort : la somme de dix voix
    depasse largement 1,0 par endroits, et un depassement en 16 bits ne sature
    pas, il ENROULE — un craquement a chaque coup de grosse caisse. `tanh`
    arrondit les cretes au lieu de les couper.
    """
    fin = int(duree * TE)
    # LA VOIX ENTRE DANS LE CALCUL DE LA CRETE. Normaliser sur la musique
    # seule, puis ajouter la voix par-dessus, c'est deplacer la saturation
    # dans le limiteur : `tanh` arrondirait alors chaque syllabe accentuee.
    crete = max(abs(piste[i] + fond[i] + VOIX * voix[i]) for i in range(fin)) or 1.0
    g = 0.86 / crete if crete > 0.86 else 1.0

    # Le fondu de sortie ne porte QUE sur la musique.
    #
    # Il valait 250 ms puis 450, et il emportait tout — le stade avec. Or
    # l'accord doit se poser quand l'image s'eteint, tandis que la foule doit
    # rester : c'est elle qui fait le raccord d'un tour a l'autre. Les deux
    # bus se ferment donc differemment, et seules les 25 dernieres
    # millisecondes du melange sont adoucies, contre le clic — pas contre le
    # silence, qu'on ne cherche plus.
    dFondu = int(0.45 * TE)
    dClic = int(0.025 * TE)
    # Le fondu de sortie ne porte pas non plus sur la voix : sa derniere
    # phrase est finie bien avant la fin du film (`voix.py` le verifie), et
    # ce qui reste a fondre serait la queue de reverberation du stade — celle
    # que le bus du stade a justement pour role de laisser passer.
    melange = array.array('d', bytes(8 * fin))
    for i in range(fin):
        m = piste[i]
        if i > fin - dFondu:
            m *= (fin - i) / dFondu
        v = math.tanh((m + fond[i] + VOIX * voix[i]) * g * 1.25) * 0.94
        if i > fin - dClic:
            v *= (fin - i) / dClic
        melange[i] = v

    # LA SONIE FINALE EST CALEE, ET LA CRETE NE SUFFIT PAS A LA CALER.
    #
    # `g` plus haut normalise la CRETE, ce qui protege le limiteur mais rend
    # la sonie du film otage d'un seul transitoire : mesure sur les deux
    # langues, la version anglaise sortait a −15,78 dB de RMS contre −14,46 a
    # la francaise, 1,3 dB d'ecart pour la meme musique — un coup de grosse
    # caisse tombant sous une syllabe d'un cote et pas de l'autre. Deux
    # versions du meme film ne peuvent pas avoir deux sonies.
    #
    # On mesure donc le melange FINI et on lui applique un gain de rattrapage
    # vers CIBLE_RMS, plafonne pour que la crete reste sous −1 dB. Le
    # rattrapage ne repasse pas dans le limiteur : il ne fait que translater.
    r = math.sqrt(sum(v * v for v in melange) / fin) or 1.0
    c = max(abs(v) for v in melange) or 1.0
    rattrapage = min(CIBLE_RMS / r, 0.89 / c)
    sortie = array.array('h', bytes(4 * fin))
    for i in range(fin):
        e = int(max(-1.0, min(1.0, melange[i] * rattrapage)) * 32000)
        sortie[2 * i] = e
        sortie[2 * i + 1] = e
    with wave.open(chemin, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(TE)
        f.writeframes(sortie.tobytes())


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    piste, fond, voix, n = composer(spec)
    ecrire(piste, fond, voix, n, spec['sortie'], float(spec['duree']))
    print(json.dumps({'wav': spec['sortie'], 'duree': spec['duree'],
                      'voix': bool(spec.get('voix'))}))
