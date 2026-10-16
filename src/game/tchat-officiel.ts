// LE COMPTE SPRINTERGAME DANS LE TCHAT DU DUEL (16/10/2026) — la voix du jeu,
// qui ne roule ni pour adidas ni pour Nike. Voir worker/src/tchat-marques.js
// (`posterOfficiel`) et TchatMarques.tsx.
//
// Le telephone de l'auteur garde la cle (le secret TCHAT_CLE du worker). Elle
// s'y pose une fois en ouvrant le jeu par une adresse qui la porte apres le
// diese :
//
//     https://sprinter-game.com/#tchat-officiel=<la cle>
//
// Apres le diese, elle ne part jamais vers un serveur, ni dans les mesures de
// frequentation (`?src=`) ; et elle est retiree de l'adresse aussitot lue.
// `#tchat-officiel=off` l'oublie.
//
// Pas d'import ici : main.tsx le charge au demarrage, avant l'ecran du duel.

const CLE_STOCKAGE = 'sprinter_tchat_officiel';

/**
 * Les comptes qui parlent aussi en SprinterGame sans cle (16/10) : celui de
 * l'auteur, « •BENBEZI• ». Le serveur decide (worker/src/tchat-marques.js,
 * AUTEURS_OFFICIELS, meme liste) : ici, on ne fait qu'afficher la bascule.
 */
export const AUTEURS_OFFICIELS = ['\u2022benbezi\u2022'];
export function estAuteurOfficiel(nom: string): boolean {
  return AUTEURS_OFFICIELS.includes(nom.trim().toLowerCase());
}

/** La cle posee sur ce telephone, ou ''. */
export function cleOfficielle(): string {
  try { return localStorage.getItem(CLE_STOCKAGE) || ''; } catch { return ''; }
}

/** Oublier la cle : le serveur l'a refusee, ou l'auteur l'a demande. */
export function oublierCleOfficielle() {
  try { localStorage.removeItem(CLE_STOCKAGE); } catch { /* stockage refuse */ }
}

/** Au demarrage : prendre la cle dans l'adresse, puis l'en retirer. */
export function prendreCleOfficielleDepuisUrl() {
  try {
    const m = /[#&]tchat-officiel=([^&]+)/.exec(window.location.hash);
    if (!m) return;
    const v = decodeURIComponent(m[1]).trim();
    if (v === 'off') oublierCleOfficielle();
    else if (v) localStorage.setItem(CLE_STOCKAGE, v);
    const url = new URL(window.location.href);
    url.hash = url.hash.replace(/[#&]?tchat-officiel=[^&]*/, '').replace(/^#$/, '');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch { /* pas de stockage ou d'History API : rien a faire */ }
}
