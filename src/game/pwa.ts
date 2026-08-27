// Le jeu tourne-t-il dans l'application installee, ou dans le navigateur ?
//
// Sert a une seule chose pour l'instant : un lien de defi ouvert dans le
// navigateur alors que le jeu est installe sur le telephone. Sur Android et
// sur ordinateur, un manifeste correctement porte (scope + handle_links)
// suffit — le systeme ouvre l'application et on ne passe jamais par ici.
// Safari sur iOS n'implemente rien de tel : le lien s'ouvre dans Safari, et
// il n'existe aucun moyen depuis une page web d'ouvrir l'application posee
// sur l'ecran d'accueil. Tout ce qu'on peut faire, c'est ne pas laisser le
// code se perdre.

/** Vrai quand la page tourne en mode application, pas dans un onglet. */
export function estInstallee(): boolean {
  try {
    if ((navigator as any).standalone) return true;          // iOS
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches;
  } catch {
    return false;
  }
}

export function estIOS(): boolean {
  try {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}
