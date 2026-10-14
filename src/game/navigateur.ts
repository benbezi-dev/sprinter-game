// Dans quel navigateur le jeu tourne, en une courte valeur.
//
// DEUX USAGES, UNE SEULE DETECTION.
//   - Le bandeau « Ouvrir dans le navigateur » (components/OuvrirDansLeNavigateur)
//     doit savoir si la page est dans le navigateur INTEGRE d'une appli.
//   - Le tunnel des premiers pas (game/tunnel.ts) range chaque appareil neuf
//     dans une classe, pour dire qui part pendant le chargement : un vrai
//     joueur sur Safari, ou l'apercu de lien qu'Instagram ouvre sans que
//     personne ne le regarde.
// Les deux lisaient la meme chose ; la table ci-dessous est donc l'unique
// endroit ou l'on dit ce qu'est Instagram, TikTok ou Facebook. Ce fichier
// n'importe rien : il se lit tel quel par node (tools/tunnel-test.mjs).
//
// RIEN DE NOMINATIF NE QUITTE L'APPAREIL. Seule la classe part au serveur,
// jamais la chaine `userAgent` : elle contient la version exacte du systeme et
// de l'appareil, qui suffirait a reconnaitre quelqu'un.
//
// LA LISTE EST AUSSI DANS worker/src/tunnel.js (NAVIGATEURS) : le serveur
// refuse toute valeur qui n'y figure pas. Un test verifie qu'elles concordent.

export type Navigateur =
  | 'instagram' | 'tiktok' | 'facebook' | 'snapchat' | 'autre-integre'
  | 'safari-ios' | 'chrome-android' | 'chrome' | 'firefox' | 'samsung' | 'edge'
  | 'appli' | 'robot' | 'autre';

export const NAVIGATEURS: readonly Navigateur[] = [
  'instagram', 'tiktok', 'facebook', 'snapchat', 'autre-integre',
  'safari-ios', 'chrome-android', 'chrome', 'firefox', 'samsung', 'edge',
  'appli', 'robot', 'autre',
];

/** Les navigateurs integres, du plus precis au plus vague. */
const INTEGRES: ReadonlyArray<readonly [Navigateur, RegExp]> = [
  ['instagram', /Instagram/i],
  ['tiktok', /musical_ly|TikTok|BytedanceWebview/i],
  ['facebook', /FBAN|FBAV|FB_IAB|FBIOS/i],
  ['snapchat', /Snapchat/i],
  ['autre-integre', /Line\//i],
];

/**
 * Le navigateur integre d'une appli (Instagram, Facebook, TikTok, Snapchat,
 * Line) : c'est la regle que le bandeau applique depuis le 26/09, inchangee.
 */
export const UA_INTEGRE = new RegExp(INTEGRES.map(([, r]) => r.source).join('|'), 'i');

/**
 * Les apercus de lien et les robots qui se declarent. `navigator.webdriver`
 * attrape ceux qui pilotent un vrai navigateur sans le dire.
 */
const UA_ROBOT = /\bbot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|discordbot|slackbot|skypeuri|preview|python-requests|curl\/|wget\//i;

export type Mesures = {
  ua: string;
  /** `navigator.webdriver` */
  webdriver?: boolean;
  /** `window.Capacitor?.isNativePlatform?.()` : l'appli, pas le site. */
  appli?: boolean;
  /** `navigator.maxTouchPoints` : un iPad se presente comme un Mac. */
  tactile?: number;
};

/** La classe d'un navigateur, d'apres ce qu'il dit de lui et ce qu'il montre. */
export function classerNavigateur({ ua, webdriver = false, appli = false, tactile = 0 }: Mesures): Navigateur {
  if (webdriver || UA_ROBOT.test(ua)) return 'robot';
  if (appli) return 'appli';
  for (const [nom, re] of INTEGRES) if (re.test(ua)) return nom;
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  // Opera et consorts derriere un moteur de Chrome : une classe a part serait
  // du bruit, et les ranger dans « chrome » fausserait celle-ci.
  if (/OPR\/|OPiOS|Opera/i.test(ua)) return 'autre';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactile > 1);
  if (iOS && /CriOS/.test(ua)) return 'chrome';
  if (iOS && /Safari/.test(ua)) return 'safari-ios';
  if (/Android/i.test(ua) && /Chrome/i.test(ua)) return 'chrome-android';
  if (/Chrome|Chromium/i.test(ua)) return 'chrome';
  return 'autre';
}

/** Celui de la page en cours, ou `autre` hors navigateur. */
export function navigateurActuel(): Navigateur {
  try {
    return classerNavigateur({
      ua: navigator.userAgent || '',
      webdriver: !!navigator.webdriver,
      appli: !!(window as any).Capacitor?.isNativePlatform?.(),
      tactile: navigator.maxTouchPoints || 0,
    });
  } catch { return 'autre'; }
}
