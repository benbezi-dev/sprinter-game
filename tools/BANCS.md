# Les bancs de tools/ — état au 16/11/2026

`npm test` lance `tools/bancs.mjs` : les 46 bancs qui tournent sans serveur (12 s). La CI les lance
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

Passent (20) : classement-integration, championnat-epreuve, direct-couloirs, defi-plusieurs,
defi-camera, direct-revanche-duel, direct-huit, direct-presentation, haies-integration,
direct-tournoi, identite, mot-direct, relais-client, relais-confrontation, reseaux, recruteurs,
profil, serie, revanche, nations.

Échouent, sur main comme après l'audit (12, à réparer ou à retirer) : acces, championnat-cycle,
championnat-double, championnat-france, championnat-tenant, championnat-cloture,
direct-revanche-accord, duels-disciplines, mot, relais-salle, relais-vestiaire, relais-defis.

Non lancés (autre port ou clé) : championnat-direct, championnat-fiches, championnat-fictifs,
fictifs-faux-depart, tchat-rapide (8791), correctifs-21-10 (8794), reponse-perdant (8795),
refus (8787), submit-preuve.

## Bancs sans serveur cassés (16 moins les 4 ci-dessus qui attendaient un serveur)

| Banc | Ce qui casse |
|---|---|
| nationalite-test | importe `oublierPays`, qui n'existe plus dans worker/src/championnats.js |
| performance-test | `tenirLaCadence` déplacé dans course-3d/paliers |
| rendu-ultra-test | 4 attentes sur le palier de départ |
| piste-salle-test | « le tapis ne vaut qu'au 60 m » |
| edition-danube-test | 19 noms de stades pour 22 attendus |
| longueur-canal-test, molosse-canal-test | cherchent des chaînes dans le paquet public |
| depart-test, haies-canal-test, poussee-canal-test | esbuild ne résout pas `virtual:precharge` |
| carton-film-test, review-partage-test | import sans extension (`mp4-duree`) sous node |
| direct-revanche-moteur-test | `import` hors module |
| limites-test | demande `wrangler` à la racine |
