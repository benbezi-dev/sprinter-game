// Les panneaux vendus, cote jeu : la liste vient du serveur
// (worker/src/panneaux.js). Sans reseau, sans campagne ou tant que l'image n'est
// pas la, personne n'est sponsor : le stade garde le logo BENBEZI.
//
// crossOrigin : dans l'appli, l'image vient d'une autre origine. Sans lui, elle
// salirait la toile du jeu (enregistreur du replay) et la texture de la 3D.

import { getDeviceId } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

type Affiche = { id: string; img: HTMLImageElement };
let affiches: Affiche[] = [];

fetch(`${API_BASE}/panneaux`)
  .then(r => (r.ok ? r.json() : null))
  .then(d => {
    affiches = (d?.panneaux ?? []).map((p: { id: string; image: string }) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.src = p.image;
      return { id: p.id, img };
    });
  })
  .catch(() => {});

let piste: unknown = null, choisie: Affiche | null = null, comptee = false;

/**
 * L'affiche de cette course, la meme pour la 2D et la 3D (`G.track` change a
 * chaque course). Appelee la ou un panneau se dessine, elle compte la course une
 * fois, quand elle part vraiment : ni le menu, ni le compte a rebours, ni le rejeu.
 */
export function sponsorDeLaCourse(G: any): HTMLImageElement | null {
  if (!G) return null;
  if (G.track !== piste) { piste = G.track; choisie = null; comptee = false; }
  if (!choisie) {
    const prets = affiches.filter(a => a.img.complete && a.img.naturalWidth > 0);
    if (!prets.length) return null;
    choisie = prets[Math.floor(Math.random() * prets.length)];
  }
  if (!comptee && G.state === 'race' && !G.rejeu) {
    comptee = true;
    fetch(`${API_BASE}/panneaux/vu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: choisie.id, device_id: getDeviceId() }),
    }).catch(() => {});
  }
  return choisie.img;
}
