/* -------------------------------------------------- LES VERSIONS DES STORES
   GET /app/version — ce que l'application installee compare a sa propre
   version au lancement (src/game/mise-a-jour/).

   Par plateforme :
     latestVersion        la derniere version EN LIGNE sur le store ;
     minSupportedVersion  en dessous, la partie est bloquee jusqu'a la mise a
                          jour (modale non fermable) ;
     storeUrl             la fiche du store.

   Les valeurs vivent dans les [vars] de wrangler.toml (APP_IOS_LATEST,
   APP_IOS_MIN, APP_ANDROID_LATEST, APP_ANDROID_MIN) : un seuil se change par un
   deploiement du worker, sans soumettre l'application.

   DEUX REGLES A NE PAS OUBLIER EN LES CHANGEANT :
   1. `latestVersion` ne monte qu'une fois la version VALIDEE ET EN LIGNE sur
      le store concerne. Annoncer une version encore en relecture enverrait le
      joueur sur une fiche qui ne la propose pas.
   2. `minSupportedVersion` ne depasse JAMAIS la version soumise a la relecture
      d'Apple : le relecteur ouvrirait l'application sur la modale bloquante,
      et c'est un refus assure.

   Une valeur absente ou mal formee retombe sur la valeur par defaut : une
   faute de frappe dans wrangler.toml ne doit pas bloquer tous les joueurs.
   Aucune base, aucun canal, aucun secret : la reponse est la meme pour tous,
   et se met en cache cinq minutes. */

export const ID_APPLE = '6829487830';
export const PAQUET_ANDROID = 'dev.benbezi.sprinter';

const DEFAUTS = {
  ios: { latest: '1.0.18', min: '1.0.0' },
  android: { latest: '1.0.19', min: '1.0.0' },
};

const FORME = /^\d+(\.\d+){0,2}$/;

function valeur(brute, defaut) {
  const v = String(brute ?? '').trim();
  return FORME.test(v) ? v : defaut;
}

export function versionsDesStores(env = {}) {
  return {
    ios: {
      latestVersion: valeur(env.APP_IOS_LATEST, DEFAUTS.ios.latest),
      minSupportedVersion: valeur(env.APP_IOS_MIN, DEFAUTS.ios.min),
      storeUrl: `https://apps.apple.com/app/id${ID_APPLE}`,
    },
    android: {
      latestVersion: valeur(env.APP_ANDROID_LATEST, DEFAUTS.android.latest),
      minSupportedVersion: valeur(env.APP_ANDROID_MIN, DEFAUTS.android.min),
      storeUrl: `https://play.google.com/store/apps/details?id=${PAQUET_ANDROID}`,
    },
  };
}
