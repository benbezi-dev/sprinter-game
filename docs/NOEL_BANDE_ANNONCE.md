# La Course de l'Étoile — bande-annonce (75 s)

Bande-annonce de l'événement de Noël 2026 (calendrier de l'Avent, histoire dans
`docs/NOEL_HISTOIRE.md`). Format 1920 × 1080, 30 images/s, son stéréo à
−15 LUFS.

## Sources

| Élément | Origine |
|---|---|
| Gameplay | Le jeu lui-même, stade **Village de l'Étoile** (`levelIdx` de la clé `noel`), 100 m et 200 m. Capturé image par image dans Chromium avec une horloge virtuelle (30 i/s exactes), interface masquée, sans aucune retouche du rendu. |
| Voix du narrateur | ElevenLabs, voix « Florian – Le Narrateur », modèle eleven_v4 |
| Voix de Marthe | ElevenLabs, voix « Grandma Clo – Warm Storyteller », modèle eleven_v4 |
| Musique | ElevenLabs Music v2.5, 75 s, instrumentale (vérifié : la transcription ne contient aucun mot) |
| Grelot | ElevenLabs Sound Effects v2 |
| Illustrations (Givre, Marthe, l'étoile) | ElevenLabs, modèle d'image gpt-image-2.5-sunburst |
| Titres | Polices Cinzel et Cormorant Garamond (licence OFL, via @fontsource) |
| Montage | Python (Pillow) et ffmpeg. After Effects n'a pas été utilisé : le connecteur Adobe ne répondait pas dans cette session. |

## Découpage

| Temps | Image | Son |
|---|---|---|
| 0 – 6 s | Le stade sous la neige, vu du ciel | **Narrateur** : « La première neige est tombée… et quelque chose s'est mis à courir derrière toi. » |
| 6 – 14 s | Givre sous le réverbère (illustration) | « Ce n'était pas une bête. C'était un petit renne. Blanc comme la neige. » / « À son cou, un grelot… qui ne sonne plus. » |
| 14 – 21,7 s | Marthe à sa fenêtre (illustration) | **Marthe** : « Autrefois, chaque soir de Noël, quelqu'un courait. Et l'étoile s'allumait… pour toute la ville. » |
| 21,8 s | Battement au noir, sur le silence de la musique | |
| 22 – 33 s | Gameplay : la ligne de départ, puis la course | **Marthe** : « Un renne ne vole que derrière quelqu'un qui court. » Titre : *Du 1er au 24 décembre* |
| 33 – 37 s | Gameplay : le 200 m, les arches lumineuses | **Narrateur** : « Vingt-quatre nuits. Vingt-quatre courses. Une étoile à rallumer. » |
| 37 – 45 s | Le calendrier : les 24 cases s'allument une à une | La musique monte |
| 45 – 50 s | Marthe, en gros plan | **Marthe** : « Allume-la. S'il te plaît. » |
| 50 s | | Le grelot sonne, pour la première fois |
| 50 – 58,5 s | L'étoile s'allume, Givre s'envole (illustration) | Sommet de la musique à 55 s |
| 58,5 – 65 s | Gameplay : l'arrivée, le sapin et son étoile allumée | Titre : *Le Village de l'Étoile — un stade rien que pour Noël* |
| 65 – 75 s | Titre final | **Narrateur** : « La Course de l'Étoile. Le calendrier de l'Avent de Sprinter. Dès le premier décembre. » Dernier grelot. |

## Ce que la bande-annonce montre et que le jeu n'a pas encore

Les illustrations (Givre, Marthe, l'étoile qui s'allume, le renne qui
s'envole) montrent l'histoire, pas le jeu. Aujourd'hui, aucune de ces scènes
n'existe en 3D, et le calendrier de 24 cases n'est pas encore construit (voir
« Suggestions pour l'intégration » dans `docs/NOEL_HISTOIRE.md`). Le stade,
lui, est dans le jeu.

## Refaire le montage

Les scripts sont dans le dossier de travail de la session et ne sont pas
versionnés :
`frames.cjs` (capture image par image), `audio/mixer.sh` (mixage) et
`monter.py` (montage). Dans l'ordre :

1. `npx vite build && npx vite preview --port 4173`
2. Capture du 100 m et du 200 m au Village de l'Étoile
3. Mixage
4. Montage
5. Multiplexage de l'image et du son
