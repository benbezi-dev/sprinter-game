// La liaison permanente : ce que le jeu apprend sans avoir a demander.
//
// Tout arrivait par sondage — un defi recu au bout de vingt secondes, un
// resultat de duel au bout de dix, et seulement sur un ecran calme. Entre deux
// personnes qui jouent l'une en face de l'autre, ces secondes-la se voient :
// on se defie, il ne se passe rien pendant une demi-minute, et l'echange
// s'eteint avant d'avoir commence.
//
// Une WebSocket ouverte vers sa propre boite change cela sans rien changer
// d'autre : LE SIGNAL NE PORTE PAS LE COURRIER. Il dit qu'il y a quelque chose
// — un defi, un duel tranche, un mot — et le jeu va le chercher par les routes
// qu'il utilisait deja. Aucune regle n'est recopiee ici, et le sondage reste
// derriere : si la liaison tombe, on retombe simplement sur le rythme d'avant.

import { getDeviceId } from './leaderboard';
import { avecAcces, codeAcces, EST_TEST } from './canal';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

/** Ce que la boite annonce. Le genre suffit : le jeu sait ou aller ensuite. */
export type Courrier = 'defi' | 'duel' | 'mot' | 'ouverte';

const ecouteurs = new Set<(quoi: Courrier) => void>();
let ws: WebSocket | null = null;
let battement: any = null;
let reprise: any = null;
/** Combien d'echecs d'affilee : sert a espacer les tentatives. */
let echecs = 0;
let voulue = false;

/** Vingt-cinq secondes : sous la minute que la plupart des relais tolerent. */
const BATTEMENT_MS = 25000;

function prevenir(quoi: Courrier) {
  for (const f of [...ecouteurs]) {
    try { f(quoi); } catch { /* un ecouteur casse n'empeche pas les autres */ }
  }
}

function fermer() {
  clearInterval(battement); battement = null;
  const s = ws; ws = null;
  try { s?.close(); } catch { /* deja fermee */ }
}

/**
 * Retente, de plus en plus espace.
 *
 * Un serveur qui refuse ne doit pas etre harcele : une seconde, deux, quatre,
 * jusqu'a trente. C'est aussi ce qui protege la batterie d'un telephone dont
 * le reseau est simplement coupe.
 */
function replanifier() {
  if (!voulue || reprise) return;
  const delai = Math.min(30000, 1000 * Math.pow(2, Math.min(echecs, 5)));
  reprise = setTimeout(() => { reprise = null; brancher(); }, delai);
}

function brancher() {
  if (!voulue || ws) return;
  // Sur le canal de test, sans code d'acces, la boite n'existe pas : on
  // n'ouvre rien plutot que d'aller frapper a la porte de la production.
  if (EST_TEST && !codeAcces()) return;

  const appareil = getDeviceId();
  if (!appareil) return;

  let s: WebSocket;
  try {
    s = new WebSocket(avecAcces(`${WS_BASE}/boite/${encodeURIComponent(appareil)}`));
  } catch {
    echecs++; replanifier(); return;
  }
  ws = s;

  s.onopen = () => {
    echecs = 0;
    clearInterval(battement);
    // Le battement sert a garder la liaison en vie a travers les relais qui
    // coupent ce qui se tait. Le serveur y repond sans meme se reveiller.
    battement = setInterval(() => {
      try { s.send('{"t":"ping"}'); } catch { /* la fermeture suivra */ }
    }, BATTEMENT_MS);
  };

  s.onmessage = ev => {
    let m: any;
    try { m = JSON.parse(String(ev.data)); } catch { return; }
    if (!m || !m.t || m.t === 'pong') return;
    prevenir(m.t as Courrier);
  };

  s.onerror = () => { /* le close suit toujours : tout se fait la */ };

  s.onclose = () => {
    if (ws === s) ws = null;
    clearInterval(battement); battement = null;
    echecs++;
    replanifier();
  };
}

/**
 * Ouvre la liaison, et la garde ouverte.
 *
 * Le retour au premier plan rebranche tout de suite plutot que d'attendre le
 * prochain palier : c'est le moment exact ou une nouvelle attend, et c'est
 * aussi celui ou le systeme vient de couper la socket en veille.
 */
export function ouvrirBoite() {
  if (voulue) return;
  voulue = true;
  brancher();
  const reveiller = () => {
    if (document.visibilityState === 'hidden') return;
    echecs = 0;
    if (reprise) { clearTimeout(reprise); reprise = null; }
    brancher();
  };
  document.addEventListener('visibilitychange', reveiller);
  window.addEventListener('focus', reveiller);
  window.addEventListener('online', reveiller);
}

/** Referme tout. Sert aux essais ; le jeu, lui, garde sa boite ouverte. */
export function fermerBoite() {
  voulue = false;
  if (reprise) { clearTimeout(reprise); reprise = null; }
  fermer();
}

/** S'abonner au courrier. Rend de quoi se desabonner. */
export function surCourrier(f: (quoi: Courrier) => void): () => void {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

/** La liaison tient-elle ? Sert a l'affichage, jamais a une decision. */
export function boiteOuverte(): boolean {
  return !!ws && ws.readyState === WebSocket.OPEN;
}
