// LES MORCEAUX DU CHAMPIONNAT, MIS EN PLANCHE POUR LE JEU.
//
// La livraison (le-stade-bangers-2) donne, par tour, seize fichiers WAV de
// 48 kHz en 24 bits : pres de dix-sept mega-octets par tour. C'est ce qu'il faut
// pour les reprendre dans FL ou dans Logic, et beaucoup trop pour un telephone
// qui entre dans une serie. Ce script les range bout a bout dans UN SEUL MP3
// par tour — une requete, un decodage — et ecrit a cote la table qui dit ou
// commence chaque bloc (src/game/musique-championnat.json).
//
// TROIS PRECAUTIONS, ET ELLES FONT TOUT.
//
// 1. LE MARQUEUR. Un decodeur MP3 peut laisser, ou non, le silence que
//    l'encodeur pose en tete (une vingtaine de millisecondes) : Chrome le
//    retire, d'autres pas. Sans le savoir, chaque bloc partirait a cote de son
//    temps, et le « HEY! » tomberait apres le bip. On pose donc un bref coup de
//    sinus a 0,1 s : le jeu le cherche apres decodage, et le decalage qu'il
//    mesure vaut pour toute la planche. Il n'est jamais joue.
//
// 2. LES BOUCLES SONT ENVELOPPEES. Un MP3 coupe net au bord d'un bloc bave un
//    peu de part et d'autre, et une boucle lue exactement entre ses bords
//    claquerait a chaque tour. Chaque boucle est donc posee entre sa propre fin
//    (avant) et son propre debut (apres) : le jeu boucle a l'interieur, sur une
//    matiere continue, et la jointure est celle du fichier d'origine.
//
// 3. LA PRESENTATION RESTE D'UN SEUL TENANT. L'appel, les huit athletes et le
//    silence se suivent dans le morceau ; ils se suivent aussi dans la planche.
//    Le jeu y saute quand il y a moins de huit presents, et nulle part ailleurs.
//
//   node tools/musique/championnat-planche.mjs <dossier le-stade-bangers-2>

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SR = 48000;
const ENVELOPPE = 0.5;   // secondes de boucle posees de chaque cote
const ECART = 0.25;      // silence entre deux blocs
const MARQUEUR_A = 0.1;  // le coup de sinus
const TOURS = ['series', 'demies', 'finale'];

const racine = process.argv[2];
if (!racine) { console.error('usage : node championnat-planche.mjs <le-stade-bangers-2/>'); process.exit(2); }
const depot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

/** Un WAV du jeu, en deux canaux flottants a 48 kHz. */
function lire(fichier) {
  const brut = execFileSync('ffmpeg', ['-v', 'error', '-i', fichier, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'],
    { maxBuffer: 1 << 30 });
  const f = new Float32Array(brut.buffer, brut.byteOffset, brut.byteLength / 4);
  const n = f.length / 2, g = new Float32Array(n), d = new Float32Array(n);
  for (let i = 0; i < n; i++) { g[i] = f[2 * i]; d[i] = f[2 * i + 1]; }
  return [g, d];
}
const longueur = b => b[0].length;
const joindre = (...bs) => [0, 1].map(c => {
  const out = new Float32Array(bs.reduce((s, b) => s + longueur(b), 0));
  let o = 0; for (const b of bs) { out.set(b[c], o); o += longueur(b); }
  return out;
});
const silence = s => [new Float32Array(Math.round(s * SR)), new Float32Array(Math.round(s * SR))];
const tranche = (b, a, z) => b.map(c => c.slice(a, z));

const table = { sr: SR, tours: {} };
for (const tour of TOURS) {
  const J = nom => lire(path.join(racine, tour, 'jeu', nom + '.wav'));
  const blocs = [];          // [nom, audio, { boucle }]
  const pres = joindre(J('01 appel'), ...Array.from({ length: 8 }, (_, k) => J(`${String(k + 2).padStart(2, '0')} athlete ${k + 1}`)), J('10 silence 3-2-1'));
  blocs.push(['presentation', pres]);
  blocs.push(['boucle', J('11 course boucle'), true]);
  if (tour === 'finale') blocs.push(['boucleMontee', J('11b course boucle montee'), true]);
  blocs.push(['depart', J('12 course depart (foule)')]);
  blocs.push(['ligne', J('13 ligne')]);
  blocs.push(['fin', J('14 fin')]);
  if (tour === 'finale') blocs.push(['finMontee', J('14b fin montee')]);

  // Le marqueur : 10 ms de sinus a 1 kHz, a mi-hauteur.
  const tete = silence(0.5);
  const i0 = Math.round(MARQUEUR_A * SR);
  for (let i = 0; i < 0.01 * SR; i++) tete[0][i0 + i] = tete[1][i0 + i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / SR);
  let marqueur = -1;
  for (let i = 0; i < tete[0].length; i++) if (Math.abs(tete[0][i]) > 0.25) { marqueur = i; break; }

  const morceaux = [tete];
  let pos = longueur(tete);
  const segments = {};
  for (const [nom, audio, boucle] of blocs) {
    morceaux.push(silence(ECART)); pos += Math.round(ECART * SR);
    const n = longueur(audio);
    if (boucle) {
      const w = Math.round(ENVELOPPE * SR);
      morceaux.push(tranche(audio, n - w, n), audio, tranche(audio, 0, w));
      segments[nom] = { debut: (pos + w) / SR, duree: n / SR, boucle: true };
      pos += n + 2 * w;
    } else {
      morceaux.push(audio);
      segments[nom] = { debut: pos / SR, duree: n / SR };
      pos += n;
    }
  }
  morceaux.push(silence(ECART));
  const planche = joindre(...morceaux);

  const tmp = path.join(os.tmpdir(), `planche-${tour}.f32`);
  const inter = new Float32Array(planche[0].length * 2);
  for (let i = 0; i < planche[0].length; i++) { inter[2 * i] = planche[0][i]; inter[2 * i + 1] = planche[1][i]; }
  fs.writeFileSync(tmp, Buffer.from(inter.buffer));
  const sortie = path.join(depot, 'src/assets/championnat', `${tour}.mp3`);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', tmp,
    '-c:a', 'libmp3lame', '-q:a', '2', sortie]);
  fs.unlinkSync(tmp);
  const arrondi = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, debut: +v.debut.toFixed(6), duree: +v.duree.toFixed(6) }]));
  table.tours[tour] = { marqueur: marqueur / SR, segments: arrondi(segments) };
  console.log(tour, (planche[0].length / SR).toFixed(1) + ' s', (fs.statSync(sortie).size / 1e6).toFixed(2) + ' Mo');
}
fs.writeFileSync(path.join(depot, 'src/game/musique-championnat.json'), JSON.stringify(table, null, 2) + '\n');
