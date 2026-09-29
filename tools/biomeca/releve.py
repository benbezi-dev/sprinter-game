#!/usr/bin/env python3
# LA BIOMECANIQUE D'UN ATHLETE, RELEVEE SUR SES VIDEOS.
#
#   python releve.py VIDEO.mp4 --de 0.0 --a 4.0 --sortie releve.json [--vue vue.jpg]
#
# (dans un Python 3.12 avec mediapipe 0.10.14 et opencv : la 1.0 plante sur
#  macOS — « graph_service: Service is unavailable » — et n'embarque plus son
#  modele ; la 0.10 a le sien, `solutions.pose`, complexite 2)
#
# MediaPipe suit les 33 points du corps image par image ; on en tire, pour
# chaque image, les angles du coureur dans la CONVENTION DU MOTEUR (pose(),
# sprinter-core.js) : un angle absolu dans le plan de course, 0 le membre vers
# le bas, positif vers l'avant du coureur. Le buste : 0 droit, negatif penche
# en avant (le `lean` du jeu).
#
# On ne garde que les images ou il est vu de profil (les deux epaules presque
# confondues a l'ecran) et bien detecte : de face ou de dos, un angle dans le
# plan de l'image ne veut plus rien dire.

import argparse, json, math, os, sys

import cv2
import mediapipe as mp

P = {  # indices MediaPipe
    'nez': 0, 'epaule_g': 11, 'epaule_d': 12, 'coude_g': 13, 'coude_d': 14,
    'poignet_g': 15, 'poignet_d': 16, 'hanche_g': 23, 'hanche_d': 24,
    'genou_g': 25, 'genou_d': 26, 'cheville_g': 27, 'cheville_d': 28,
    'talon_g': 29, 'talon_d': 30, 'pied_g': 31, 'pied_d': 32,
}


def angle(a, b, avant):
    """L'angle du segment a->b : 0 vers le bas, positif vers l'avant."""
    dx, dy = (b[0] - a[0]) * avant, b[1] - a[1]      # y image vers le bas
    return math.atan2(dx, dy)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('--de', type=float, default=0.0)
    ap.add_argument('--a', type=float, default=1e9); ap.add_argument('--sortie', required=True)
    ap.add_argument('--vue')
    A = ap.parse_args()

    det = mp.solutions.pose.Pose(static_image_mode=False, model_complexity=2,
                                 smooth_landmarks=True, min_detection_confidence=0.5,
                                 min_tracking_confidence=0.5)
    cap = cv2.VideoCapture(A.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    cap.set(cv2.CAP_PROP_POS_MSEC, A.de * 1000)
    images, vues = [], []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if t > A.a:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = det.process(rgb)
        if not res.pose_landmarks:
            continue
        lm = res.pose_landmarks.landmark
        pt = {k: (lm[i].x * W, lm[i].y * H, lm[i].visibility) for k, i in P.items()}
        # de profil ? les epaules et les hanches presque confondues en x,
        # rapportees a la hauteur du buste
        buste = abs((pt['hanche_g'][1] + pt['hanche_d'][1]) / 2 - (pt['epaule_g'][1] + pt['epaule_d'][1]) / 2) + 1e-6
        ecart = (abs(pt['epaule_g'][0] - pt['epaule_d'][0]) + abs(pt['hanche_g'][0] - pt['hanche_d'][0])) / 2
        profil = ecart / buste
        # le sens de course : le nez devant le milieu des epaules
        me = ((pt['epaule_g'][0] + pt['epaule_d'][0]) / 2)
        avant = 1 if pt['nez'][0] > me else -1
        mh = ((pt['hanche_g'][0] + pt['hanche_d'][0]) / 2, (pt['hanche_g'][1] + pt['hanche_d'][1]) / 2)
        ms = ((pt['epaule_g'][0] + pt['epaule_d'][0]) / 2, (pt['epaule_g'][1] + pt['epaule_d'][1]) / 2)
        rec = {'t': round(t, 4), 'profil': round(profil, 3), 'avant': avant,
               'buste': round(-angle(mh, ms, avant) - math.pi if angle(mh, ms, avant) > 0 else -angle(mh, ms, avant) - math.pi, 4),
               'vis': round(min(pt[k][2] for k in ('hanche_g', 'genou_g', 'cheville_g', 'hanche_d', 'genou_d', 'cheville_d')), 3)}
        # le buste : 0 droit, negatif en avant
        dx, dy = (ms[0] - mh[0]) * avant, ms[1] - mh[1]
        rec['buste'] = round(-math.atan2(dx, -dy), 4)
        for c in ('g', 'd'):
            rec['cuisse_' + c] = round(angle(pt['hanche_' + c], pt['genou_' + c], avant), 4)
            rec['jambe_' + c] = round(angle(pt['genou_' + c], pt['cheville_' + c], avant), 4)
            rec['pied_' + c] = round(angle(pt['talon_' + c], pt['pied_' + c], avant), 4)
            rec['bras_' + c] = round(angle(pt['epaule_' + c], pt['coude_' + c], avant), 4)
            rec['avbras_' + c] = round(angle(pt['coude_' + c], pt['poignet_' + c], avant), 4)
            rec['pts_' + c] = [[round(pt[k + '_' + c][0]), round(pt[k + '_' + c][1])]
                               for k in ('epaule', 'coude', 'poignet', 'hanche', 'genou', 'cheville', 'pied')]
        images.append(rec)
        if A.vue and len(vues) < 12 and len(images) % max(1, int(fps // 3)) == 0:
            f = frame.copy()
            for c, col in (('g', (40, 220, 255)), ('d', (255, 120, 40))):
                q = rec['pts_' + c]
                for i, j in ((0, 1), (1, 2), (3, 4), (4, 5), (5, 6), (0, 3)):
                    cv2.line(f, tuple(q[i]), tuple(q[j]), col, 3)
            cv2.putText(f, f"t={t:.2f} profil={profil:.2f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            vues.append(cv2.resize(f, (int(W * 320 / H), 320)))
    json.dump({'video': os.path.basename(A.video), 'fps': fps, 'images': images}, open(A.sortie, 'w'))
    if A.vue and vues:
        rangs = [cv2.hconcat(vues[i:i + 4]) for i in range(0, len(vues) - len(vues) % 4 or len(vues), 4) if len(vues[i:i + 4]) == 4]
        if rangs:
            cv2.imwrite(A.vue, cv2.vconcat(rangs))
    print(f"{len(images)} images retenues sur {A.video}, fps {fps:.1f}")


if __name__ == '__main__':
    main()
