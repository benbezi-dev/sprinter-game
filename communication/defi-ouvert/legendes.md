# Défi ouvert — les légendes, prêtes à coller

Comptes : Instagram **@SPRINTERGAME** · X **@SprinterGameFR** · TikTok **@sprinter_game**
Lien (bio, et X) : **sprinter-game.com**

Remplace partout `CODE` par ton code (`ZEZE42`…), `CHRONO` par ton temps
(`8,64 s`) et `DISTANCE` par la distance (`100 m`).
Hashtags : `#sprint #athletisme #100m #defi #SprinterGame`

**La règle d'or : un seul chiffre par post.** Deux chiffres dans une légende,
et on n'en retient aucun. Le chiffre, c'est le chrono — ou le compteur, jamais
les deux.

---

## 1 · X — le lien marche, le post est court

Image : `cartes/CODE-affiche-x.png`

**Variante A — le chrono posé**
> J'ai posé CHRONO sur DISTANCE.
> Code du défi : **CODE**
> Tu ne cours pas contre le chrono : mon fantôme part dans le couloir d'à côté, et tu vois l'écart se creuser en direct.
> https://sprinter-game.com/?defi=CODE

**Variante B — la provocation courte** (celle qui marche en réponse)
> Deux touches. Dix secondes. CHRONO.
> Si c'était si simple, tu serais déjà devant.
> https://sprinter-game.com/?defi=CODE

**Variante C — l'enjeu**
> Celui qui bat ce code me prend des points au classement. Pour de vrai : chaque défi relevé est un duel compté.
> CHRONO sur DISTANCE, code **CODE**.
> https://sprinter-game.com/?defi=CODE

---

## 2 · Instagram — le code remplace le lien

Image : `cartes/CODE-affiche-feed.png` (fil) · `cartes/CODE-affiche-story.png` (story)

**La première ligne est tout ce qu'on lit** avant le « … plus ». Elle doit
contenir l'accroche, pas le contexte.

**Légende du fil**
> Tout le monde se croit rapide jusqu'à la première course.
>
> CHRONO sur DISTANCE. Le code du défi : **CODE**
>
> Tu ouvres le jeu, onglet DÉFI, tu tapes le code. Tu cours contre mon fantôme — pas contre un nombre affiché : sa course rejoue à côté de toi, et tu vois si tu es devant ou derrière à chaque foulée.
>
> Celui qui me bat prend des points au classement des duels. C'est tout l'intérêt.
>
> 🔗 Lien en bio · code **CODE**
>
> #sprint #athletisme #100m #defi #SprinterGame

**Story** (deux écrans)
1. La carte `-story` + le sticker « LIEN » pointé sur `sprinter-game.com/?defi=CODE`.
2. Un sondage : **« Tu passes sous CHRONO ? » — Facile / Aucune chance.**
   Le sondage est là pour l'engagement, pas pour la réponse : les deux options
   donnent envie d'aller vérifier.

---

## 3 · TikTok — le code se dit à voix haute

Montage : l'écran de course, sans commentaire, avec le son du jeu.
Format : `cartes/CODE-affiche-story.png` en dernière image (1080×1920).

**Script, 12 secondes**

| Temps | Image | Texte à l'écran |
|---|---|---|
| 0–1 s | écran noir | **Tu te crois rapide ?** |
| 1–4 s | le départ, les appuis | *(rien — on laisse le son)* |
| 4–7 s | la ligne d'arrivée, le chrono qui se fige | **CHRONO** |
| 7–10 s | la carte du défi | **CODE** (gros, centré) |
| 10–12 s | idem | **Lien en bio. Tu tiens combien ?** |

Dis le code à voix haute pendant les trois dernières secondes : c'est écrit
sans 0, sans O, sans 1, sans I et sans L, exprès pour qu'on l'entende bien.

**Légende**
> CHRONO sur DISTANCE. Code **CODE** — tu cours contre mon fantôme, pas contre un chrono affiché. Lien en bio. #sprint #athletisme #defi

---

## 4 · Les accroches, à faire tourner

Une par post. Elles marchent en première ligne d'Instagram, en texte d'ouverture
de TikTok, et en première phrase sur X.

1. Tout le monde se croit rapide jusqu'à la première course.
2. CHRONO. Tu peux regarder le chiffre, ou tu peux le battre.
3. Je te laisse mon fantôme dans le couloir d'à côté.
4. Deux touches. Si c'était si simple, tu serais déjà devant.
5. Dix secondes à perdre, un ego à défendre.
6. Celui qui me bat me prend ma place. Littéralement, c'est un classement.
7. Personne ne l'a encore relevé.
8. Le code est ouvert. Le chrono, non.
9. Tu as le temps de scroller, tu as le temps de courir.
10. Poste ton chrono ou admets que tu n'as pas essayé.

---

## 5 · La relance à J+2 — le compteur fait le post

Relance l'outil sur le même code : la carte porte maintenant le nombre de
tentatives, lu sur le serveur.

```bash
node tools/carte-defi-ouvert.mjs --code CODE
```

> 23 ont essayé. 3 ont fait mieux.
> Le code est toujours ouvert : **CODE**
> https://sprinter-game.com/?defi=CODE

Si personne n'a battu le chrono, c'est encore mieux :

> N ont essayé. Zéro a fait mieux.
> **CODE**

---

## 6 · Les réponses aux commentaires

Elles comptent autant que le post : un commentaire répondu ramène la personne,
et la réponse est lue par tous les autres.

| On te dit | Tu réponds |
|---|---|
| « facile » | « Le code est **CODE**. Poste ta capture. » |
| « c'est quoi ce jeu » | « Un 100 m. Deux touches, en alternance. Le chrono compte au classement mondial. » |
| un chrono meilleur que le tien | « Bien joué. Relance-moi : tu ne peux le faire qu'en ayant battu mon temps, donc tu peux. » |
| « ça marche sur iPhone ? » | « Oui, dans le navigateur, et ça s'installe sur l'écran d'accueil. » |

---

## 7 · Où ça se joue vraiment

Poster sur son compte ne suffit pas quand le compte est petit — c'est ce que
dit déjà `../riposte-danube/legendes.md`, et ça n'a pas changé. Ce qui rapporte :

- **répondre** sous un gros post d'athlétisme avec la carte et le code ;
- poster **le jour d'une finale** (les gens ont le téléphone en main) ;
- répondre à **chaque** chrono posté en commentaire, sans exception.

Une fois par soirée, sur la course la plus regardée. Répondre partout, c'est du
spam, et ça se voit.
