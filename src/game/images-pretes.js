/* -----------------------------------------------------------------------
   SPRINTER — LES IMAGES DES DECORS, PRETES AVANT D'ETRE DESSINEES.

   Chaque module de decor allait chercher ses images au moment de les
   dessiner, et rendait `null` tant qu'elles n'etaient pas la : la piece
   n'etait pas dessinee. C'etait sans danger, et c'etait visible. Une piece
   demandee au premier passage dans le cadre arrivait quelques images plus
   tard — en pleine course, sous les yeux du joueur. Mesure le 3/10/2026 sur
   un 400 m des Jeux mondiaux, ecran a trois pixels par point, processeur
   bride comme celui d'un telephone : dix images de decor arrivees PENDANT la
   course (les blocs des couloirs decales, demandes quand la camera les
   rattrape).

   Ce registre tient les images de tous les decors en un seul endroit, pour
   deux raisons.

   - UNE IMAGE N'EST RENDUE QUE DECODEE. Telechargee ne suffit pas : son
     premier drawImage la decompresse, et c'est une image de course qui
     accroche. `decode()` fait ce travail hors de la boucle d'image.
   - LE JEU SAIT CE QUI MANQUE ENCORE. `enAttente()` compte les images
     demandees qui ne sont pas pretes : c'est ce que le decompte attend avant
     de partir (voir stadeEnPreparation, chargement.ts).
   ----------------------------------------------------------------------- */
(function (root) {
  'use strict';

  const images = new Map();
  let enVol = 0;

  /**
   * L'image a l'adresse `url`, une fois telechargee et decodee ; `null`
   * jusque-la. Le premier appel la demande.
   */
  function image(url) {
    let e = images.get(url);
    if (!e) {
      const im = new Image();
      im.decoding = 'async';
      e = { im, pret: false };
      images.set(url, e);
      enVol++;
      im.onload = () => {
        // un decodage refuse (image trop grande, onglet en arriere-plan) ne
        // la perd pas : elle se decodera au premier dessin, comme avant
        const d = im.decode ? im.decode().catch(() => {}) : Promise.resolve();
        d.then(() => { e.pret = true; enVol--; });
      };
      // Une image absente ne bloque rien : elle sort du compte, et on la
      // redemande deux secondes plus tard — un reseau qui a hoquete.
      im.onerror = () => {
        enVol--;
        setTimeout(() => { if (images.get(url) === e) images.delete(url); }, 2000);
      };
      im.src = url;
    }
    return e.pret ? e.im : null;
  }

  root.SprinterImages = { image, enAttente: () => enVol };
})(typeof globalThis !== 'undefined' ? globalThis : this);
