/// <reference types="@capacitor-firebase/messaging" />

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
  webDir: 'dist',

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
    /**
     * Le clavier, et la place qu'il prend.
     *
     * Sur Android, la WebView se retrecit quand le clavier monte : ce qui etait
     * en bas d'un panneau remonte, et reste atteignable. Une WKWebView ne fait
     * rien de tel — elle garde sa taille, le clavier se pose par-dessus, et le
     * bas de l'ecran disparait dessous. Sur la fenetre de bienvenue, cela
     * cachait « CONTINUER » derriere la barre du clavier et « PLUS TARD »
     * entierement : on tapait son nom, et le bouton pour valider n'etait plus
     * la.
     *
     * `native` rend a iOS le comportement d'Android : la vue se redimensionne,
     * `window.innerHeight` diminue, et la variable --app-height que pose
     * App.tsx suit toute seule. Le correctif vaut donc pour TOUS les champs du
     * jeu — le nom, le code d'acces, le code d'un defi, le mot de cent
     * quarante caracteres — et pas seulement pour celui ou on l'a remarque.
     */
    Keyboard: {
      resize: 'native' as any,
      resizeOnFullScreen: true,
    },

    /**
     * Ce que devient une notification qui arrive alors que le jeu est ouvert.
     *
     * Rien. La liste est vide, et c'est delibere : quand l'application est au
     * premier plan, la boite WebSocket a deja porte la nouvelle et l'ecran
     * concerne s'est deja mis a jour. Une banniere par-dessus repeterait ce
     * qu'on est en train de regarder — et pendant une course, elle passerait
     * devant la piste au pire moment.
     *
     * Le reglage ne vaut que pour iOS ; sur Android le comportement au premier
     * plan est le meme par defaut.
     */
    FirebaseMessaging: {
      presentationOptions: [],
    },
  },

  /**
   * Deux paquets Swift declarent le meme produit Firebase, et SwiftPM refuse
   * de resoudre le graphe : le lien symbolique fait tomber la collision.
   * Sans cette ligne, `npx cap sync ios` produit un projet qui ne compile pas.
   * Voir capawesome-team/capacitor-firebase#959.
   */
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
};

export default config;
