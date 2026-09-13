#!/usr/bin/env python3
"""
LA VOIX OFF — un speaker de stade, synthetise ici, passe dans une sono.

POURQUOI CETTE CHAINE-LA. La seule synthese vocale disponible sur cette
machine est celle du systeme (`say`, voix compactes : Thomas et Jacques en
francais, Daniel en anglais). Brute, elle s'entend pour ce qu'elle est — une
machine qui lit. Mais un speaker de stade n'est JAMAIS entendu brut : sa voix
sort d'un pavillon, elle est coupee dans le grave et dans l'aigu, ecrasee par
la compression de la sono, et elle revient avec la reverberation du bol. Ce
traitement-la, qu'on doit de toute facon appliquer pour que la voix appartienne
a l'image, est exactement celui qui efface le timbre synthetique. Le defaut de
la source devient la couleur du lieu.

    passe-haut 190 Hz    on retire le corps : un pavillon n'en a pas
    passe-bas 5,2 kHz    et il n'a pas d'aigu non plus
    + presence 2,2 kHz   la bosse nasale qui fait porter une annonce
    compression 4:1      la sono d'un stade ne laisse rien respirer
    saturation douce     l'ampli en bout de course
    3 reflexions + queue  le bol, 0,9 s, sombre

CE QU'ELLE NE FAIT PAS. Elle n'ecrit pas le texte : les lignes arrivent dans
la spec, depuis le conducteur, a cote des cartons qu'elles accompagnent. Un
texte de voix pose ici serait un texte qui ne se traduit pas.

ELLE RECALE, ELLE NE DEVINE PAS. `say` pose du silence en tete et en queue de
chaque fichier, et pas la meme quantite d'une ligne a l'autre. Le silence est
donc COUPE, et `t` designe l'attaque du premier mot — pas le debut du fichier.
Sans cela une ligne posee a 9,65 s commence a 9,8 et rate le carton qu'elle
accompagne. Le rapport rendu donne, pour chaque ligne, l'attaque et la fin
mesurees : c'est avec lui qu'on regle le conducteur.

    python3 voix.py spec.json
    { "sortie": "...wav", "voix": "Thomas", "lignes": [...] }
"""
import array, json, math, re, subprocess, sys, tempfile, wave, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from musique import TE, passe_bas, passe_haut, passe_bande, vide, poser

# Le seuil sous lequel on considere que `say` n'a pas encore parle. Mesure sur
# les six lignes du teaser : le silence de tete est a -80 dB, le premier
# souffle consonantique a -30. Un seuil a -46 dB coupe l'un sans mordre l'autre.
SEUIL = 10 ** (-46 / 20.0)

# Les marques de prosodie, pour les retirer du rapport. Une ligne du releve
# doit se relire comme une phrase ; « [[rate 165]][[pbas 47]]Trente-deux »
# n'est pas une phrase, c'est une partition.
MARQUES = re.compile(r'\[\[[^\]]*\]\]')


def lisible(texte):
    """La ligne sans sa partition. Les marques collent aux mots (`pays[[slnc
    120]]sont`), donc les retirer sans rien mettre a la place recolle deux mots
    en un ; on met une espace, puis on la retire devant la ponctuation."""
    t = re.sub(r'\s+', ' ', MARQUES.sub(' ', texte)).strip()
    # Seuls la virgule et le point se collent au mot qui precede. Le francais
    # met une espace devant « ? ! ; : », et la retirer rendait le releve faux
    # dans la langue meme du film.
    return re.sub(r'\s+([,.])', r'\1', t)

# La sonie a laquelle chaque ligne est ramenee, en RMS sur la partie parlee.
# 0,16 est le RMS qu'atteignait une ligne francaise moyenne du temps ou les
# lignes etaient egalisees a la crete : la valeur ne change donc pas le niveau
# d'ensemble, elle le rend le meme pour toutes.
SONIE = 0.16

# Le gain de sortie de la chaine de sono. Il n'a aucun role de couleur : il
# rend a la voix traitee le RMS qu'elle avait avant que la chaine soit
# adoucie, pour que le calage du melange (`VOIX` dans musique.py, regle par
# mesure) reste valable : mesure, l'ancienne chaine rendait 0,1333 de RMS et
# la nouvelle 0,0920, d'ou 0,62 → 0,90. On change le timbre, on tient le
# niveau — et le RMS d'avant comptait de toute facon 17 dB de saleté a 12 kHz
# que la nouvelle ne fabrique plus.
SORTIE = 0.90


def dire(voix, debit, texte):
    """Rend une ligne par `say`, en mono 48 kHz, et la lit en flottants."""
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        chemin = f.name
    try:
        subprocess.run(['say', '-v', voix, '-r', str(debit),
                        '--data-format=LEI16@48000', '-o', chemin, texte],
                       check=True, capture_output=True, text=True)
        with wave.open(chemin) as w:
            if w.getframerate() != TE or w.getsampwidth() != 2:
                raise SystemExit(f'voix.py : {voix} rend du {w.getframerate()} Hz '
                                 f'{8 * w.getsampwidth()} bits, attendu {TE} Hz 16 bits')
            n, ch = w.getnframes(), w.getnchannels()
            crus = array.array('h'); crus.frombytes(w.readframes(n))
    finally:
        os.unlink(chemin)
    # Un canal suffit : la voix se pose au centre, comme une sono.
    x = array.array('d', bytes(8 * n))
    for i in range(n):
        x[i] = crus[i * ch] / 32768.0
    return x


def rogner(x, marge=0.012):
    """Coupe le silence de tete et de queue, en gardant une marge d'attaque."""
    d, f = 0, len(x) - 1
    while d < len(x) and abs(x[d]) < SEUIL:
        d += 1
    while f > d and abs(x[f]) < SEUIL:
        f -= 1
    if d >= f:
        raise SystemExit('voix.py : une ligne est muette — texte vide ?')
    d = max(0, d - int(marge * TE))
    f = min(len(x) - 1, f + int(0.10 * TE))   # on garde la chute du dernier mot
    return x[d:f + 1]


def compresser(x, seuil=0.25, ratio=4.0, attaque=0.004, relachement=0.09):
    """Compresseur a detection de crete, comme celui d'une sono de stade.

    Il ne sert pas a proteger le mixage — le limiteur de `musique.py` le fait —
    mais a APLATIR : une annonce de stade a le meme niveau du premier au
    dernier mot, et c'est ce qui la rend lisible sous une musique.
    """
    ka = math.exp(-1.0 / (attaque * TE))
    kr = math.exp(-1.0 / (relachement * TE))
    y = array.array('d', bytes(8 * len(x)))
    e = 0.0
    for i in range(len(x)):
        a = abs(x[i])
        e = a + (ka if a > e else kr) * (e - a)
        g = 1.0 if e <= seuil else (seuil + (e - seuil) / ratio) / e
        y[i] = x[i] * g
    return y


def sono(x):
    """Le pavillon et l'ampli — et L'ORDRE DES ETAGES EST LA CORRECTION.

    La premiere version placait la saturation APRES le passe-bas, en dernier.
    C'est une faute : `tanh` fabrique des harmoniques, et rien ne les
    rattrapait. Mesure en bandes d'octave, par rapport au 1 kHz : le 8 kHz ne
    descendait que de 1,3 dB malgre un passe-bas a 5,2 kHz — la saturation
    refabriquait tout le haut du spectre que le filtre venait d'enlever. C'est
    exactement ce qui rend une voix dure. Le passe-bas passe donc EN DERNIER,
    et c'est lui qui a le dernier mot sur la bande.

    Le reste est adouci du meme coup, parce que la plainte etait « trop
    robotique » et qu'un traitement de megaphone n'aide pas une voix de
    synthese a passer pour humaine — il la rend telephonique. Un speaker de
    stade doit s'entendre comme une voix DANS un stade, pas comme un
    haut-parleur de drive.

        passe-haut  190 → 150 Hz   on lui laisse un peu de corps
        presence    0,55 → 0,30    la bosse portait la durete avec elle
        saturation  2,3 → 1,4      l'ampli chauffe, il ne casse plus
        passe-bas   5,2 → 6,2 kHz  et il est passe en DERNIER
    """
    # 1 · le pavillon ne descend pas dans le grave.
    x = passe_haut(x, 150.0, q=0.7)
    # 2 · la presence : la bande ou l'oreille cherche la consonne. Deux fois
    #     plus discrete qu'avant — elle suffit a faire porter l'annonce.
    p = passe_bande(x, 2000.0, q=1.0)
    for i in range(len(x)):
        x[i] += 0.30 * p[i]
    # 3 · l'ecrasement de la sono, puis l'ampli qui chauffe.
    x = compresser(x, seuil=0.30, ratio=3.0)
    for i in range(len(x)):
        x[i] = math.tanh(x[i] * 1.4)
    # 4 · et LE PAVILLON EN DERNIER : il coupe les harmoniques de l'etage
    #     precedent au lieu de les laisser sortir.
    x = passe_bas(x, 6200.0, q=0.7)
    for i in range(len(x)):
        x[i] *= SORTIE
    return x


def bol(x, queue=0.90, niveau=0.19):
    """Le stade autour de la voix : trois reflexions, puis une queue sombre.

    Une vraie reverberation de stade dure deux secondes et plus. Ici elle est
    tenue a 0,9 s : au-dela, deux lignes separees par une seconde se
    superposent et l'annonce devient inintelligible. On garde donc l'INDICE du
    lieu, pas sa mesure.
    """
    n = len(x) + int((queue + 0.2) * TE)
    y = array.array('d', bytes(8 * n))
    for i in range(len(x)):
        y[i] = x[i]
    # Les premieres reflexions : les gradins d'en face, la toiture, le fond.
    for retard, gain in ((0.047, 0.30), (0.083, 0.22), (0.131, 0.16)):
        d = int(retard * TE)
        for i in range(len(x)):
            y[i + d] += x[i] * gain * niveau / 0.19
    # La queue : QUATRE peignes recursifs de longueurs premieres entre elles.
    # Deux suffisaient a faire une queue, pas a la rendre lisse : deux peignes
    # seuls laissent entendre leur propre periode, ce qui donne le « boing »
    # metallique qu'on prend pour de la mauvaise reverberation. Quatre
    # longueurs sans diviseur commun dispersent les echos. On ne garde que les
    # echos (`c[i] - y[i]`) : la voix directe est deja dans `y`, l'y rajouter
    # la doublerait.
    tail = array.array('d', bytes(8 * n))
    retards = (0.0297, 0.0371, 0.0411, 0.0533)
    for retard in retards:
        d = int(retard * TE)
        r = 10 ** (-3.0 * retard / queue)       # -60 dB au bout de `queue`
        c = array.array('d', bytes(8 * n))
        for i in range(n):
            c[i] = y[i] + (r * c[i - d] if i >= d else 0.0)
        for i in range(n):
            tail[i] += (c[i] - y[i]) / len(retards)
    tail = passe_bas(tail, 2800.0)               # un bol est sombre
    for i in range(n):
        y[i] += tail[i] * niveau
    return y


def composer(spec):
    duree = float(spec['duree'])
    voix = spec.get('voix', 'Thomas')
    defaut = int(spec.get('debit', 175))
    n = int((duree + 1.2) * TE)
    piste = vide(n)
    rapport = []
    for l in spec['lignes']:
        brut = dire(voix, int(l.get('debit', defaut)), l['texte'])
        sec = rogner(brut)
        # Chaque ligne est ramenee a LA MEME SONIE avant traitement, et c'est
        # une correction : ramenee a la meme CRETE — le premier choix —, la
        # ligne anglaise « Heats, semis, final. » sortait 6 dB sous son
        # equivalent francais et passait SOUS la musique. Une crete de parole
        # est une plosive ou une sifflante ; elle ne dit rien de ce que
        # l'oreille entend. Le RMS, lui, est la sonie, et une annonce de stade
        # ne change pas de volume d'une phrase a l'autre.
        #
        # Le plafond de crete reste, en second : il n'egalise rien, il empeche
        # seulement une ligne exceptionnellement pointue d'entrer saturee dans
        # le compresseur qui suit.
        r = math.sqrt(sum(v * v for v in sec) / len(sec)) or 1.0
        c = max(abs(v) for v in sec) or 1.0
        g = min(SONIE / r, 0.95 / c)
        for i in range(len(sec)):
            sec[i] *= g
        son = bol(sono(sec), niveau=float(l.get('bol', 0.19)))
        t = float(l['t'])
        poser(piste, t, son, float(l.get('gain', 1.0)))
        rapport.append({
            'texte': lisible(l['texte']),
            'partition': l['texte'], 'de': round(t, 3),
            'parle': round(len(sec) / TE, 3),
            'a': round(t + len(sec) / TE, 3),
            'queue': round(t + len(son) / TE, 3),
        })
    return piste, n, rapport


def ecrire(piste, n, chemin, duree):
    """WAV stereo 16 bits. AUCUN fondu de sortie : c'est `musique.py` qui
    ferme le melange, et une voix fondue deux fois perd son dernier mot."""
    fin = int((duree + 1.2) * TE)
    sortie = array.array('h', bytes(4 * fin))
    for i in range(min(fin, n)):
        e = int(max(-1.0, min(1.0, piste[i])) * 32000)
        sortie[2 * i] = e
        sortie[2 * i + 1] = e
    with wave.open(chemin, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(TE)
        f.writeframes(sortie.tobytes())


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    piste, n, rapport = composer(spec)
    ecrire(piste, n, spec['sortie'], float(spec['duree']))
    # LES CHEVAUCHEMENTS SONT UNE ERREUR, PAS UN AVERTISSEMENT. Deux lignes
    # qui se recouvrent donnent un speaker qui se parle par-dessus, et rien a
    # l'ecran ne le signale : c'est le genre de defaut qui part en publication.
    for a, b in zip(rapport, rapport[1:]):
        if b['de'] < a['a']:
            raise SystemExit(f"voix.py : « {a['texte']} » finit a {a['a']} s, "
                             f"« {b['texte']} » commence a {b['de']} s")
    if rapport and rapport[-1]['a'] > float(spec['duree']):
        raise SystemExit(f"voix.py : la derniere ligne finit a {rapport[-1]['a']} s, "
                         f"le film a {spec['duree']} s")
    print(json.dumps({'sortie': spec['sortie'], 'voix': spec.get('voix'),
                      'lignes': rapport}, ensure_ascii=False))
