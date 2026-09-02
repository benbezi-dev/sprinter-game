import type { CapacitorConfig } from '@capacitor/cli';

/**
 * L'enveloppe native, pour l'App Store et le Play Store.
 *
 * Un choix commande tout le reste : l'application embarque ses fichiers et ne
 * charge aucune adresse distante. C'est ce que dit `webDir` et l'absence
 * volontaire de `server.url`.
 *
 * Ce n'est pas un detail technique. La regle 4.2 d'Apple refuse ce qui « ne se
 * distingue pas d'un site web reconditionne », et une application qui se
 * contente d'ouvrir une adresse dans une vue web tombe exactement dessous. En
 * embarquant le jeu, il demarre sans reseau, se lance instantanement, et se
 * comporte comme un jeu installe — ce qu'il est.
 *
 * Consequence a ne pas oublier : le contenu ne se met plus a jour tout seul
 * comme sur le site. Chaque nouvelle version passe par une soumission.
 */
const config: CapacitorConfig = {
  appId: 'dev.benbezi.sprinter',
  appName: 'Sprinter',
  // Le build web, construit avec une base a la racine : dans l'application les
  // fichiers sont servis depuis le paquet, pas depuis un sous-repertoire.
  //
  // Android se publie avec le jeu entier et se batit donc a part, dans
  // `dist-app` (script `build:app`). Le repertoire est passe par
  // l'environnement plutot qu'ecrit ici, et c'est ce qui garantit que
  // l'ouverture des duels ne concerne qu'Android : iOS, qui n'a pas encore de
  // build a lui, retombe sur `dist` — le jeu tel que le site le montre.
  webDir: process.env.SPRINTER_WEBDIR || 'dist',

  ios: {
    // Le jeu dessine son propre fond ; sans cette couleur, un eclair blanc
    // traverse l'ecran entre le lancement et la premiere image.
    backgroundColor: '#05070d',
    // Les rebonds de defilement n'ont aucun sens sur un canvas plein ecran.
    scrollEnabled: false,
    contentInset: 'never',
  },

  android: {
    backgroundColor: '#05070d',
    // Sans cela, une page servie depuis le paquet n'est pas un contexte
    // securise, et le micro comme la capture video restent inaccessibles.
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#05070d',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#05070d',
      overlaysWebView: true,
    },
  },
};

export default config;
