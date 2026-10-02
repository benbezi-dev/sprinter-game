# La musique du défi Méba-Mickaël Zézé — fiche FL Studio

Le morceau de course de l'événement spécial du sprint. Il remplace, pour ce
défi seulement, la city pop du Stade de la Riviera (112 BPM, trop posée).
Tant qu'il n'est pas livré, la course joue la musique de la finale des ZEZE
(`race3`, 150 BPM).

**Livré le 02/10/2026, calculé** : `node tools/musique/defi-meba.mjs` écrit
`public/vedettes/defi-meba.mp3` sur ce scénario (tout est synthétisé, rien
n'est échantillonné). Une version produite dans FL Studio, sur ce même
calage, pourra le remplacer : poser le WAV, encoder par-dessus.

## Ce que le jeu impose

| | |
|---|---|
| Tempo | **150 BPM**, fixe : celui des ZEZE. |
| Départ du morceau | au premier chiffre du 3-2-1 (la musique de course part avec le décompte). |
| Pistolet | **3,000 s** après ce départ. |
| Boucle | **16 mesures = 25,6 s**, qui repartent sur le pistolet. L'intro (le décompte) ne se rejoue pas. |
| Fichier livré | **WAV 24 bits, 44,1 kHz, stéréo**. Je fais moi-même l'encodage et les points de boucle : un MP3 ajoute un silence d'encodeur qui casserait la boucle. |
| Niveau | **≈ −12 LUFS intégré**, crête vraie ≤ −1 dBTP. Le morceau d'Aurel Manga est à −11,7 LUFS : les deux défis doivent sonner aussi fort. |

### Le calage dans FL Studio

À 150 BPM, 3,0 s font 7,5 temps : le pistolet ne tombe sur un premier temps
que si le morceau part une croche plus tôt. Dans FL :

- **mesure 1, temps 1** : 0,2 s avant le décompte (une croche de levée) ;
- **mesure 3, temps 1** : le pistolet, c'est le drop ;
- **mesures 3 à 18** : la boucle de 16 mesures ;
- export de la mesure 1 à la fin de la mesure 18, avec **« Wrap remainder »**
  (la queue des derniers sons revient au début de la boucle au lieu d'être
  coupée).

À l'intégration, je retire la croche de levée : le fichier du jeu fait 28,6 s,
et la boucle va de 3,0 à 28,6 s.

La piste guide `guide-150bpm-decompte-pistolet.wav` (écrite par
`tools/musique/guide-defi-meba.mjs`) contient exactement ce calage : le clic à
150 BPM, les trois bips du jeu, le « go » du pistolet et deux repères graves.
Pose-la sur une piste muette en fin de projet.

## Ce que la course raconte, seconde par seconde

Les repères sont comptés depuis le pistolet (mesure 3 = 0 s).

| Mesures | Temps | Dans la course | Idée |
|---|---|---|---|
| 1–2 | −3,2 → 0 s | le décompte : le rituel dans les blocs (V renversé, deux balancements), puis « à vos marques », « prêts » | montée retenue, pas de grosse caisse ; laisser la place aux trois bips (0, 1, 2 s) et au « go ». Un silence net juste avant le pistolet vaut mieux qu'un riser qui couvre le coup. |
| 3–6 | 0 → 6,4 s | **le départ canon** : il pointe à plus de 14 m/s dès 15 m, personne ne le suit | l'impact au pistolet, puis l'énergie maximale. C'est son départ qui doit s'entendre. |
| 7–8 | 6,4 → 9,6 s | au 100 m, il perd de la vitesse, le joueur revient ; **ligne du 100 m à 8,39 s** (repère grave) | une relance, un fill ou une montée qui culmine autour de 8,4–9,6 s : l'arrivée du 100 m doit tomber sur un sommet. |
| 9–12 | 9,6 → 16 s | au 200 m, la sortie du virage | deuxième souffle, groove plus dense. |
| 13–14 | 16 → 19,2 s | **ligne du 200 m à 17,30 s** (repère grave) | le climax du morceau. |
| 15–18 | 19,2 → 25,6 s | l'écran de verdict | redescente qui retombe sur la mesure 3 (le drop) : la boucle doit s'enchaîner sans couture. |

### Sa signature : les claps

Méba-Mickaël frappe dans ses mains au-dessus de la tête pour faire lever le
public : c'est son geste d'après-course, et le jeu le lui fait faire
à **2,5 claps par seconde, soit exactement une noire à 150 BPM**. Des claps
de stade sur chaque temps, qui s'ouvrent au drop, sont donc le fil rouge
naturel du morceau.

## Livraison

Déposer le WAV dans `~/Desktop/musique-defi-meba/` (ou le transmettre).
J'encode, je pose `public/vedettes/defi-meba.mp3`, je règle les points de
boucle dans `src/game/musique-defi-meba.ts` et je l'écoute dans une vraie
course au 100 m et au 200 m.
