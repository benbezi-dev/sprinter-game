# Les bancs de tools/ — état au 16/11/2026

`npm test` lance `tools/bancs.mjs` : les 50 bancs qui tournent sans serveur. La CI les lance
avant chaque déploiement.

## Bancs qui demandent le worker local

```bash
cd worker && npx wrangler dev --local --port 8788
```

puis créer le code d'accès que les bancs attendent (`ADMIN` = la clé de `worker/.dev.vars`) :

```bash
curl -X POST -H 'Content-Type: application/json' -H "X-Sprinter-Admin: $ADMIN" http://127.0.0.1:8788/test/admin/creer -d '{"nom":"banc","code":"ECRAN1"}'
```

Sans ce code, les bancs tombent sous la limite de débit et échouent tous (« trop de tentatives »).
Les lancer UN PAR UN : enchaînés, `relais-client-test` et `nations-test` échouent une fois sur deux.

Mis a jour le 17/11, apres la reprise du lot du 21/10 (9fbde050).

Passent (25) : correctifs-21-10-soir (a lancer depuis la racine), classement-integration,
championnat-epreuve, direct-couloirs, defi-plusieurs, defi-camera, direct-revanche-duel,
direct-revanche-accord, direct-huit, direct-presentation, haies-integration, direct-tournoi,
identite, mot-direct, relais-client, relais-confrontation, relais-salle, relais-vestiaire,
reseaux, recruteurs, profil, serie, revanche, nations, acces.

Echouent, attentes perimees (a mettre a jour) : duels-disciplines (ne connait pas 60hf/60h),
et non relances depuis : championnat-cycle, championnat-double, championnat-france,
championnat-tenant, championnat-cloture, mot, relais-defis.

Enchaines, direct-tournoi et reseaux echouent parfois ; seuls, ils passent.

Non lances (autre port ou cle) : championnat-direct, championnat-fiches, championnat-fictifs,
fictifs-faux-depart, tchat-rapide (8791), correctifs-21-10 (8794), reponse-perdant (8795),
refus (8787), submit-preuve.

## Bancs sans serveur encore casses

| Banc | Ce qui casse |
|---|---|
| performance-test | `tenirLaCadence` deplace dans course-3d/paliers |
| piste-salle-test | « le tapis ne vaut qu'au 60 m » |
| edition-danube-test, haies-canal-test | attentes perimees (stades, nombre d'epreuves) |
| longueur-canal-test, molosse-canal-test | cherchent des chaines dans le paquet public |
| carton-film-test, review-partage-test | import sans extension (`mp4-duree`) sous node |
| direct-revanche-moteur-test | `import` hors module |
| limites-test | demande `wrangler` a la racine |
