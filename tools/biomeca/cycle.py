#!/usr/bin/env python3
# DU RELEVE IMAGE PAR IMAGE A UN CYCLE DE FOULEE, DANS LA CONVENTION DU JEU.
#
#   python3 cycle.py releve.json [--de T] [--a T]
#
# Les appuis : une cheville au plus bas de sa trajectoire (le plus haut y a
# l'ecran), un pied pose. Deux appuis successifs du meme pied font un cycle ;
# on le ramene a une phase de 0 a 2 pi, la meme que celle des tables de
# foulee (GAITS, sprinter-core.js) : la cuisse au plus haut devant tombe vers
# 4,85 rad, comme dans leurs tables. On moyenne les cycles et on rend, pour
# chaque table, huit points (catmull) :
#
#   thigh  la cuisse, absolue            knee  jambe - cuisse (flexion < 0)
#   ankle  pied - jambe - pi/2           arm   le bras, absolu
#   elbow  avant-bras - bras             et le buste moyen (lean)

import json, math, sys, statistics as st

TAU = 2 * math.pi


def lisse(v, k=2):
    out = []
    for i in range(len(v)):
        a, b = max(0, i - k), min(len(v), i + k + 1)
        out.append(sum(v[a:b]) / (b - a))
    return out


def main():
    d = json.load(open(sys.argv[1]))
    de = float(sys.argv[sys.argv.index('--de') + 1]) if '--de' in sys.argv else -1
    a = float(sys.argv[sys.argv.index('--a') + 1]) if '--a' in sys.argv else 1e9
    im = [x for x in d['images'] if de <= x['t'] <= a and x['profil'] < 0.6 and x['vis'] > 0.4]
    if len(im) < 20:
        print('trop peu d images de profil'); return
    # LES JAMBES (ET LES BRAS) INTERVERTIS. De profil, MediaPipe confond
    # parfois la gauche et la droite le temps d'une image : la cuisse gauche
    # saute de +1,3 a -0,4 et revient. On garde, image par image, l'etiquetage
    # qui change le moins par rapport a l'image d'avant.
    CLES_JAMBE = ('cuisse', 'jambe', 'pied')
    CLES_BRAS = ('bras', 'avbras')
    for groupe, idx in ((CLES_JAMBE, (3, 4, 5, 6)), (CLES_BRAS, (0, 1, 2))):
        for i in range(1, len(im)):
            av, b = im[i - 1], im[i]
            garde = sum(abs(b[k + '_g'] - av[k + '_g']) + abs(b[k + '_d'] - av[k + '_d']) for k in groupe)
            croise = sum(abs(b[k + '_d'] - av[k + '_g']) + abs(b[k + '_g'] - av[k + '_d']) for k in groupe)
            if croise < garde * 0.6:
                for k in groupe:
                    b[k + '_g'], b[k + '_d'] = b[k + '_d'], b[k + '_g']
                for j in idx:
                    b['pts_g'][j], b['pts_d'][j] = b['pts_d'][j], b['pts_g'][j]
    t = [x['t'] for x in im]
    out = {}
    for c in ('g', 'd'):
        # la cheville la plus basse a l'ecran = appui
        y = lisse([x['pts_' + c][5][1] for x in im], 1)
        cont = [i for i in range(2, len(y) - 2)
                if y[i] >= max(y[i - 2:i + 3]) and y[i] > st.median(y)]
        # un appui par passage bas : on fusionne les detections voisines
        appuis = []
        for i in cont:
            if not appuis or t[i] - t[appuis[-1]] > 0.18:
                appuis.append(i)
        out[c] = appuis
    # LA CADENCE, par le genou au plus haut devant : a trente images par
    # seconde, le point bas d'une cheville est flou d'une image, le sommet de la
    # cuisse beaucoup moins. Deux sommets du meme cote font une foulee, donc
    # deux appuis.
    periodes = []
    for c in ('g', 'd'):
        th = lisse([x['cuisse_' + c] for x in im], 1)
        som = [i for i in range(1, len(th) - 1) if th[i] >= th[i - 1] and th[i] >= th[i + 1] and th[i] > 0.8]
        periodes += [t[b] - t[a] for a, b in zip(som, som[1:]) if 0.3 < t[b] - t[a] < 0.8]
    cad = 2 / st.median(periodes) if periodes else float('nan')
    buste = st.median(x['buste'] for x in im)
    print(f"{d['video']} [{de},{a}] : {len(im)} images, cadence {cad:.2f} appuis/s, buste {buste:+.3f} rad")
    # les cycles, jambe gauche puis droite, remis sur une phase commune
    tables = {k: [[] for _ in range(24)] for k in ('thigh', 'knee', 'ankle', 'arm', 'elbow')}
    for c in ('g', 'd'):
        th = lisse([x['cuisse_' + c] for x in im], 1)
        ap = [i for i in range(1, len(th) - 1) if th[i] >= th[i - 1] and th[i] >= th[i + 1] and th[i] > 0.8]
        for i0, i1 in zip(ap, ap[1:]):
            if not (0.30 < t[i1] - t[i0] < 0.80):
                continue
            seg = im[i0:i1 + 1]
            th = [x['cuisse_' + c] for x in seg]
            # le max de la cuisse devant a 4,85 rad, comme dans les tables
            k = th.index(max(th))
            f = (k / (len(seg) - 1))
            decal = 4.85 / TAU - f
            for j, x in enumerate(seg):
                q = ((j / (len(seg) - 1)) + decal) % 1.0
                b = int(q * 24) % 24
                cu, ja, pi_ = x['cuisse_' + c], x['jambe_' + c], x['pied_' + c]
                br, ab = x['bras_' + c], x['avbras_' + c]
                tables['thigh'][b].append(cu)
                tables['knee'][b].append(ja - cu)
                tables['ankle'][b].append(pi_ - math.pi / 2 - ja)
                tables['arm'][b].append(br)
                tables['elbow'][b].append(ab - br)
    res = {'video': d['video'], 'cadence': cad, 'buste': buste}
    for k, bins in tables.items():
        moy = [st.median(v) if v else None for v in bins]
        if any(m is None for m in moy):
            # combler les cases vides par voisinage
            for i in range(24):
                if moy[i] is None:
                    for s in range(1, 12):
                        v = moy[(i - s) % 24] if moy[(i - s) % 24] is not None else moy[(i + s) % 24]
                        if v is not None:
                            moy[i] = v; break
        moy = lisse(moy + moy + moy, 1)[24:48]
        pts = [[round(TAU * i / 8, 2), round(moy[i * 3], 2)] for i in range(8)]
        res[k] = pts
        print(f"  {k:6s} min {min(moy):+.2f} max {max(moy):+.2f}  {pts}")
    json.dump(res, open(sys.argv[1].replace('.json', '-cycle.json'), 'w'))


if __name__ == '__main__':
    main()
