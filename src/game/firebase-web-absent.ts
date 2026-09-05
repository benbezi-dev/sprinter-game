// Le SDK web de Firebase, volontairement absent.
//
// Le greffon `@capacitor-firebase/messaging` embarque, a cote de son code iOS
// et Android, une implementation web qui importe `firebase/messaging`. Le jeu
// ne s'en sert jamais : sur le web, les notifications passent par Web Push et
// une cle VAPID — c'est ce que fait `push.ts`, c'est ce que recoit le service
// worker, et cela marche sans compte Google. Le greffon n'est appele que
// lorsque `Capacitor.isNativePlatform()` est vrai, et la c'est le code natif
// qui repond, pas ce fichier-ci.
//
// Vite doit pourtant resoudre cet import pour construire le paquet. Sans ce
// faux module, il faudrait installer `firebase` en entier — plusieurs
// megaoctets — pour un morceau de code que rien ne charge jamais. Avec lui,
// l'import se resout, Vite produit un morceau que personne ne va chercher, et
// le paquet reste ce qu'il etait.
//
// Les fonctions levent plutot que de rendre une valeur vide : si ce morceau
// finit un jour par etre charge pour de bon, on veut l'apprendre a la premiere
// seconde, et pas decouvrir six mois plus tard que le web croyait s'abonner a
// quelque chose.

const absent = (nom: string) => (..._args: unknown[]): never => {
  throw new Error(
    `firebase/messaging n'est pas embarque dans Sprinter (appel a ${nom}). ` +
    `Sur le web, les notifications passent par Web Push — voir src/game/push.ts.`,
  );
};

export const getMessaging = absent('getMessaging');
export const getToken     = absent('getToken');
export const deleteToken  = absent('deleteToken');
export const onMessage    = absent('onMessage');

/** Le seul appel qui ne leve pas : « non, pas ici » est une reponse valable. */
export const isSupported = async (): Promise<boolean> => false;
