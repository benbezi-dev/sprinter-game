// La video de la course : par ou elle sort de l'application.
//
// Ce fichier existe a cause d'iOS. Dans une WKWebView, `<a download>` est un
// clic dans le vide — pas d'erreur, pas de fichier, rien. Le bouton s'allumait,
// le compte a rebours s'ecoulait, et le joueur n'obtenait jamais sa video. On
// passe donc par la feuille de partage quand elle existe, et le telechargement
// ne sert plus que la ou elle n'existe pas : l'ordinateur.
//
// Le piege qu'on garde ici est ailleurs, et il a failli passer : `morceaux` est
// VIDE des la fin de l'enregistrement — les donnees ne vivent plus qu'a travers
// l'URL d'objet. Un partage qui rebatirait le fichier depuis `morceaux`
// enverrait zero octet, sans lever la moindre erreur. La feuille s'ouvrirait,
// le joueur choisirait « Enregistrer », et il rangerait un fichier vide.
// D'ou le premier test, qui compte les octets et pas les intentions.

const OCTETS = 4096;
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

/* ------------------------------------------------------- le faux telephone */

let liens = [];            // les <a> que le module a fabriques
let partages = [];         // ce qui est passe par la feuille de partage
let reponsePartage = null; // ce que la feuille repond : null = accepte

class FauxMediaRecorder {
  static isTypeSupported(t) { return t === 'video/mp4;codecs=avc1'; }
  constructor(_flux, opts) { this.state = 'inactive'; this.mimeType = opts?.mimeType; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(OCTETS)]) });
    this.onstop?.();
  }
}

function poserLeTelephone({ partageDispo }) {
  liens = []; partages = []; reponsePartage = null;

  globalThis.MediaRecorder = FauxMediaRecorder;
  globalThis.HTMLCanvasElement = class { };
  globalThis.HTMLCanvasElement.prototype.captureStream = () => ({});

  let n = 0;
  globalThis.URL.createObjectURL = () => `blob:faux/${++n}`;
  globalThis.URL.revokeObjectURL = () => { };

  globalThis.document = {
    createElement: () => {
      const a = { href: '', download: '', rel: '', remove() { } , click() { this.clique = true; } };
      liens.push(a);
      return a;
    },
    body: { appendChild() { } },
  };

  const nav = {
    userAgent: 'harnais',
    ...(partageDispo ? {
      canShare: o => !!o?.files?.length,
      share: async o => {
        partages.push(o);
        if (reponsePartage) throw reponsePartage;
      },
    } : {}),
  };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
}

/** Une course filmee, jusqu'au fichier pret. */
async function filmer(Review) {
  const etats = [];
  const film = new Review(s => etats.push({ ...s }));
  film.demarrer({ captureStream: () => ({}) });
  await film.arreter();
  return { film, dernier: etats[etats.length - 1] };
}

/* ------------------------------------------------------------------ essais */

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA VIDEO DE LA COURSE — par ou elle sort                    ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

poserLeTelephone({ partageDispo: true });
const { Review } = await import('../src/game/review.ts');

titre('SUR TELEPHONE, ELLE PASSE PAR LA FEUILLE DE PARTAGE');
{
  const { film, dernier } = await filmer(Review);
  ok('le fichier est pret', dernier.phase === 'prete', dernier.phase);
  const sortie = await film.partager();
  ok('la feuille s est ouverte', partages.length === 1, `${partages.length} appel(s)`);
  ok('elle rend « partage »', sortie === 'partage', sortie);
  ok('aucun telechargement en douce', liens.length === 0, `${liens.length} lien(s)`);

  // Le test qui compte : des OCTETS, pas une intention.
  const f = partages[0]?.files?.[0];
  ok('un fichier a bien ete joint', !!f);
  ok(`il pese ses ${OCTETS} octets`, f?.size === OCTETS, `${f?.size} octet(s)`);
  ok('il porte le nom du jour', /^sprinter-\d{4}-\d{2}-\d{2}\.mp4$/.test(f?.name || ''), f?.name);
  ok('il est etiquete video/mp4', (f?.type || '').startsWith('video/mp4'), f?.type);
  ok('rien d autre que le fichier — pas d URL a cote', !partages[0].url);
  film.jeter();
}

titre('REFERMER LA FEUILLE N EST PAS UN ECHEC');
{
  const { film } = await filmer(Review);
  reponsePartage = Object.assign(new Error('Abort due to cancellation of share.'), { name: 'AbortError' });
  const sortie = await film.partager();
  ok('elle rend « annule »', sortie === 'annule', sortie);
  ok('et ne retombe pas sur le telechargement', liens.length === 0, `${liens.length} lien(s)`);
  film.jeter();
}

titre('UN VRAI ECHEC DE PARTAGE REND QUAND MEME LE FICHIER');
{
  const { film } = await filmer(Review);
  reponsePartage = Object.assign(new Error('rien ne va'), { name: 'DataError' });
  const sortie = await film.partager();
  ok('elle rend « telechargement »', sortie === 'telechargement', sortie);
  ok('un lien a ete clique', liens.length === 1 && liens[0].clique === true);
  film.jeter();
}

titre('SUR ORDINATEUR, LE TELECHARGEMENT RESTE LE BON CHEMIN');
{
  poserLeTelephone({ partageDispo: false });
  const { film } = await filmer(Review);
  const sortie = await film.partager();
  ok('elle rend « telechargement »', sortie === 'telechargement', sortie);
  ok('un seul lien, clique une fois', liens.length === 1 && liens[0].clique === true);
  ok('le lien porte le nom du fichier', /^sprinter-.*\.mp4$/.test(liens[0].download), liens[0].download);
  film.jeter();
}

titre('APRES L EXPIRATION, IL N Y A PLUS RIEN A SORTIR');
{
  poserLeTelephone({ partageDispo: true });
  const { film } = await filmer(Review);
  film.jeter();                       // ce que fait l expiration : tout lacher
  const sortie = await film.partager();
  ok('elle rend « echec »', sortie === 'echec', sortie);
  ok('la feuille ne s ouvre pas', partages.length === 0, `${partages.length} appel(s)`);
  ok('aucun lien fabrique', liens.length === 0, `${liens.length} lien(s)`);
}

console.log(e ? `\n✗ ${e} echec(s)\n` : '\n✓ tout passe\n');
process.exit(e ? 1 : 0);
