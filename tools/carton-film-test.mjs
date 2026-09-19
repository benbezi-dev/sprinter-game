// LE CARTON DE FIN — est-il vraiment dans le fichier ?
//
// Ce fichier existe a cause d'une seule ligne de `useFilmerLeOneShot` :
//
//     if (state === 'result') f.pause();
//
// Un one shot s'arrete sur l'ecran de resultat de sa derniere epreuve, et
// l'enregistreur y est donc EN PAUSE quand `winall` demande l'arret. Un
// enregistreur en pause n'ecrit rien. Le carton se peignait consciencieusement,
// image apres image, sur un montage que plus personne n'enregistrait — et il ne
// manquait rien nulle part : pas d'erreur, pas de trou, un fichier valide, une
// video qui se termine sur la ligne d'arrivee comme avant. Le seul symptome
// etait l'absence de ce qu'on venait d'ajouter.
//
// D'ou le premier essai, qui ne regarde pas si le carton a ete PEINT mais si
// l'enregistreur tournait pendant qu'on le peignait.
//
// LE SECOND PIEGE est ailleurs : le canvas du jeu ne montre plus la course au
// moment de l'arret — l'ecran de fin se monte, le moteur passe a la suite.
// Recopier la source pendant le carton ferait defiler n'importe quoi dessous.
// C'est ce que verifie l'essai du gel : on regarde QUELLE image le montage
// recoit, pas seulement qu'il en recoit une.

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

/* --------------------------------------------------------- le faux appareil */

/** Ce qu'un contexte 2D a recu. On lit son journal, pas son image. */
class FauxContexte {
  constructor(nom) {
    this.nom = nom;
    this.dessine = [];      // les noms des canvas recopies, dans l'ordre
    this.profondeur = 0;    // save() moins restore() — voir l'essai de l'echelle
    this.echelles = [];
  }
  drawImage(src) { this.dessine.push(src?.nom || '?'); }
  save() { this.profondeur++; }
  restore() { this.profondeur--; }
  scale(k) { this.echelles.push(k); }
  fillRect() { } fillText() { } beginPath() { } moveTo() { } lineTo() { }
  stroke() { } fill() { } arc() { } arcTo() { } closePath() { }
  measureText() { return { width: 10 }; }
  createLinearGradient() { return { addColorStop() { } }; }
}

let canvasCrees = [];

function fauxCanvas(nom, l = 0, h = 0, clientL = 0) {
  const cv = {
    nom, width: l, height: h, clientWidth: clientL,
    _ctx: null,
    getContext() { return (cv._ctx ||= new FauxContexte(nom)); },
    captureStream: () => ({
      addTrack() { }, removeTrack() { },
      getAudioTracks: () => [], getVideoTracks: () => [{ stop() { } }],
    }),
  };
  return cv;
}

/** Un enregistreur qui tient son journal : c'est lui le temoin. */
class FauxMediaRecorder {
  static isTypeSupported(t) { return t === 'video/mp4;codecs=avc1'; }
  constructor(_flux, opts) {
    this.state = 'inactive'; this.mimeType = opts?.mimeType;
    this.journal = [];
    FauxMediaRecorder.dernier = this;
  }
  start() { this.state = 'recording'; this.journal.push('start'); }
  pause() { this.state = 'paused'; this.journal.push('pause'); }
  resume() { this.state = 'recording'; this.journal.push('resume'); }
  stop() {
    this.journal.push(`stop(${this.state})`);
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)]) });
    this.onstop?.();
  }
}

function poserLAppareil() {
  canvasCrees = [];
  globalThis.MediaRecorder = FauxMediaRecorder;
  globalThis.HTMLCanvasElement = class { };
  globalThis.HTMLCanvasElement.prototype.captureStream = () => ({});
  globalThis.URL.createObjectURL = () => 'blob:faux/1';
  globalThis.URL.revokeObjectURL = () => { };
  // La boucle de trace est un vrai `requestAnimationFrame` cote navigateur.
  // Soixante images par seconde suffisent a la reproduire ici.
  let n = 0;
  const minuteurs = new Map();
  globalThis.requestAnimationFrame = fn => {
    const id = ++n;
    minuteurs.set(id, setTimeout(() => { minuteurs.delete(id); fn(); }, 16));
    return id;
  };
  globalThis.cancelAnimationFrame = id => {
    const t = minuteurs.get(id);
    if (t) { clearTimeout(t); minuteurs.delete(id); }
  };
  globalThis.document = {
    createElement: (tag) => {
      if (tag !== 'canvas') return { remove() { }, click() { } };
      const cv = fauxCanvas(`cree#${canvasCrees.length + 1}`);
      canvasCrees.push(cv);
      return cv;
    },
    body: { appendChild() { } },
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'harnais' }, configurable: true, writable: true,
  });
}

poserLAppareil();
const { Review, CARTON_MS } = await import('../src/game/review.ts');

/**
 * Une course filmee, arretee comme le one shot l'arrete.
 *
 * `enPause` reproduit l'ecran de resultat : c'est le cas qui compte.
 */
async function filmer({ carton, enPause = true, surcouche = () => { } }) {
  const jeu = fauxCanvas('jeu', 810, 1440, 405);
  const vus = [];
  const film = new Review(() => { });
  film.demarrer(jeu, [], surcouche);
  const rec = FauxMediaRecorder.dernier;
  await new Promise(r => setTimeout(r, 50));
  if (enPause) film.pause();
  // Le canvas du jeu montre deja autre chose : l'ecran de fin se monte.
  jeu.nom = 'ecran-de-fin';
  const t0 = Date.now();
  await film.arreter(carton ? ((ctx, l, h, a) => { vus.push({ l, h, a }); carton?.(ctx, l, h, a); }) : undefined);
  return { film, rec, vus, duree: Date.now() - t0, jeu, montage: canvasCrees[0] };
}

/* ------------------------------------------------------------------ essais */

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE CARTON DE FIN — est-il dans le fichier ?                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

titre('UN ENREGISTREUR EN PAUSE EST RELANCE POUR LE CARTON');
{
  const { film, rec, vus, duree } = await filmer({ carton: () => { } });
  ok('le carton a ete peint', vus.length > 0, `${vus.length} image(s)`);
  // LE TEST QUI COMPTE : l'ordre du journal. Un « resume » apres le « pause »
  // et avant le « stop », sans quoi le carton s est peint pour personne.
  ok('l enregistreur a ete relance', rec.journal.includes('resume'), rec.journal.join(' → '));
  ok('il tournait encore a l arret',
     rec.journal[rec.journal.length - 1] === 'stop(recording)', rec.journal.join(' → '));
  ok('l arret a bien attendu le carton', duree >= CARTON_MS - 60, `${duree} ms`);
  film.jeter();
}

titre('LE CARTON SE POSE SUR L IMAGE GELEE, PAS SUR LE JEU');
{
  const { film, montage } = await filmer({ carton: () => { } });
  const recopies = montage._ctx.dessine;
  const gel = canvasCrees[1];
  ok('un gel a ete fabrique', !!gel, `${canvasCrees.length} canvas cree(s)`);
  // Apres l'arret, le montage ne doit plus JAMAIS recopier le canvas du jeu —
  // qui montre l'ecran de fin. Les dernieres recopies sont donc celles du gel.
  const apres = recopies.slice(recopies.lastIndexOf('jeu') + 1);
  ok('les dernieres images viennent du gel',
     apres.length > 0 && apres.every(n => n === gel.nom), apres.slice(0, 4).join(', '));
  ok('l ecran de fin n est jamais entre dans le film',
     !recopies.includes('ecran-de-fin'));
  film.jeter();
}

titre('LE PINCEAU EST RENDU EN POINTS CSS, ET REMIS D APLOMB');
{
  const { film, vus, montage } = await filmer({ carton: () => { } });
  // Le montage fait 810 x 1440 pixels pour 405 points CSS de large : le carton
  // doit raisonner en points, comme la feuille de style.
  ok('le carton mesure en points CSS', vus[0]?.l === 405 && vus[0]?.h === 720,
     `${vus[0]?.l} x ${vus[0]?.h}`);
  ok('l echelle de l appareil est appliquee', montage._ctx.echelles.includes(2),
     montage._ctx.echelles.slice(0, 3).join(', '));
  // Une echelle qui fuit se remultiplie a chaque image : le carton finirait en
  // un pixel. Voir le `finally` de `tracerLeCarton`.
  ok('le pinceau est remis d aplomb a chaque image', montage._ctx.profondeur === 0,
     `profondeur ${montage._ctx.profondeur}`);
  film.jeter();
}

titre('L AVANCEMENT VA BIEN DE 0 A 1');
{
  const { film, vus } = await filmer({ carton: () => { } });
  const premier = vus[0].a, dernier = vus[vus.length - 1].a;
  ok('il part de zero', premier < 0.2, String(premier));
  ok('il arrive a un', dernier > 0.9, String(dernier));
  ok('il ne recule jamais', vus.every((v, i) => i === 0 || v.a >= vus[i - 1].a));
  ok('il ne depasse jamais un', vus.every(v => v.a <= 1));
  film.jeter();
}

titre('UN CARTON QUI ECHOUE NE COUTE PAS LE FILM');
{
  const { film, rec, vus } = await filmer({ carton: () => { throw new Error('pinceau casse'); } });
  ok('on a quand meme essaye a chaque image', vus.length > 0, `${vus.length} image(s)`);
  ok('le fichier est sorti', film.lireEtat().phase === 'prete', film.lireEtat().phase);
  ok('l enregistreur s est arrete proprement',
     rec.journal[rec.journal.length - 1] === 'stop(recording)', rec.journal.join(' → '));
  film.jeter();
}

titre('SANS CARTON, RIEN NE CHANGE — ET PERSONNE N ATTEND');
{
  const { film, duree, rec } = await filmer({ carton: null });
  ok('l arret est immediat', duree < 200, `${duree} ms`);
  ok('l enregistreur n a pas ete relance pour rien', !rec.journal.includes('resume'),
     rec.journal.join(' → '));
  ok('le fichier est pret', film.lireEtat().phase === 'prete', film.lireEtat().phase);
  film.jeter();
}

titre('SANS MONTAGE, LE CARTON SE TAIT AU LIEU DE FAIRE ATTENDRE');
{
  // Pas de surcouche : `review.ts` filme le canvas du jeu directement, il n'y a
  // donc aucun montage sur lequel peindre. Faire patienter le joueur une
  // seconde et demie devant un bouton eteint serait pire que pas de carton.
  const { film, vus, duree } = await filmer({ carton: () => { }, surcouche: null });
  ok('le carton n a pas ete appele', vus.length === 0, `${vus.length} image(s)`);
  ok('et l arret est immediat', duree < 200, `${duree} ms`);
  ok('le fichier est pret quand meme', film.lireEtat().phase === 'prete', film.lireEtat().phase);
  film.jeter();
}

titre('UNE PRISE JETEE PENDANT LE CARTON NE LAISSE RIEN DERRIERE');
{
  const jeu = fauxCanvas('jeu', 810, 1440, 405);
  const film = new Review(() => { });
  film.demarrer(jeu, [], () => { });
  await new Promise(r => setTimeout(r, 50));
  let images = 0;
  const arret = film.arreter(() => { images++; });
  await new Promise(r => setTimeout(r, 200));
  const vues = images;
  film.jeter();                       // le joueur revient a l'ecran-titre
  await new Promise(r => setTimeout(r, 120));
  ok('le carton etait bien en train de se peindre', vues > 0, `${vues} image(s)`);
  ok('il s arrete net', images <= vues + 1, `${images} contre ${vues}`);
  await arret;
  ok('l arret rend la main sans se plaindre', true);
  ok('il ne reste rien', film.lireEtat().phase === 'inactif', film.lireEtat().phase);
}

console.log(e ? `\n✗ ${e} essai(s) en echec` : '\n✓ tout passe');
process.exit(e ? 1 : 0);
