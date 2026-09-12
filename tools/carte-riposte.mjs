#!/usr/bin/env node
// La carte de riposte : une image et des legendes, fabriquees en une commande
// pendant qu'une finale vient de se courir.
//
// POURQUOI CET OUTIL. Trois minutes apres l'arrivee, le clip de la chaine est
// en ligne et les premieres reponses sous ce clip sont les seules qu'on lit.
// Ecrire le post a ce moment-la, c'est arriver dixieme. Tout ce qui peut etre
// prepare l'est donc ici, et il ne reste au moment venu qu'un nom et un chrono
// a taper.
//
//   node tools/carte-riposte.mjs --epreuve 100 --vainqueur "Seville" --temps 9.82
//   node tools/carte-riposte.mjs --epreuve 100 --femmes --vainqueur "Alfred" --temps 10.71
//
// Sans --vainqueur, il n'imprime que l'etat des records du jeu : c'est la
// verification qu'on fait avant la soiree.
//
// LE CHIFFRE NE S'INVENTE PAS. Le record du jeu est lu sur le classement en
// direct, pas ecrit dans ce fichier. Un post qui annonce un record que le jeu
// n'affiche pas se retourne contre lui dans l'heure : il suffit d'un joueur
// qui ouvre l'application pour verifier.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';

// Un glob d'un seul caractere joker, juste ce qu'il faut pour retrouver le
// Chromium de Playwright, range sous un numero de version qui change.
function glob(motif) {
  const [avant, apres] = motif.split('*');
  const dossier = avant.slice(0, avant.lastIndexOf('/'));
  const prefixe = avant.slice(avant.lastIndexOf('/') + 1);
  try {
    return readdirSync(dossier).filter((n) => n.startsWith(prefixe))
      .map((n) => `${dossier}/${n}${apres}`).filter(existsSync);
  } catch { return []; }
}

const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const SORTIE = 'cartes';

// Les records du monde reels, avec l'annee — c'est l'annee qui porte la
// phrase, pas le chrono. « 9,58 s » ne dit rien ; « debout depuis 2009 » dit
// tout.
const MONDE = {
  '100': { h: { t: '9.58',  qui: 'Usain Bolt',              an: 2009 },
           f: { t: '10.49', qui: 'Florence Griffith-Joyner', an: 1988 } },
  '200': { h: { t: '19.19', qui: 'Usain Bolt',              an: 2009 },
           f: { t: '21.34', qui: 'Florence Griffith-Joyner', an: 1988 } },
  '400': { h: { t: '43.03', qui: 'Wayde van Niekerk',       an: 2016 },
           f: { t: '47.60', qui: 'Marita Koch',             an: 1985 } },
};

// Le dernier releve verifie en base, au cas ou le classement ne repond pas.
// Il sert de filet, jamais de source : s'il sert, l'outil le dit a l'ecran.
const FILET = {
  '100': { ms: 8246,  nom: 'Timooo & Nathan', le: '2026-08-27' },
  '200': { ms: 16629, nom: "971'gee",         le: '2026-08-29' },
  '400': { ms: 34888, nom: 'Timooo & Nathan', le: '2026-08-27' },
};

function args(argv) {
  const a = { epreuve: '100', femmes: false, vainqueur: null, temps: null, horsLigne: false };
  for (let i = 2; i < argv.length; i++) {
    const cle = argv[i];
    if (cle === '--femmes') a.femmes = true;
    else if (cle === '--hors-ligne') a.horsLigne = true;
    else if (cle === '--epreuve') a.epreuve = argv[++i];
    else if (cle === '--vainqueur') a.vainqueur = argv[++i];
    else if (cle === '--temps') a.temps = argv[++i];
  }
  return a;
}

const secondes = (ms) => (ms / 1000).toFixed(3).replace('.', ',');

// « il a deux semaines » vaut mieux que « 27 aout » : l'age se compare a
// « depuis 2009 », pas la date.
function age(isoOuMs) {
  const jours = Math.floor((Date.now() - new Date(isoOuMs).getTime()) / 86400000);
  if (jours <= 1) return "il date d'hier";
  if (jours < 14) return `il a ${jours} jours`;
  if (jours < 60) return `il a ${Math.round(jours / 7)} semaines`;
  return `il a ${Math.round(jours / 30)} mois`;
}

async function record(epreuve, horsLigne) {
  if (!horsLigne) {
    try {
      const r = await fetch(`${API}/leaderboard?race=${epreuve}&by=race`, { signal: AbortSignal.timeout(6000) });
      const { entries } = await r.json();
      const t = (entries || []).filter((e) => e.best_split_ms > 0)
        .sort((a, b) => a.best_split_ms - b.best_split_ms);
      if (t.length) {
        return { ms: t[0].best_split_ms, nom: t[0].name, le: new Date(t[0].updated_at).toISOString().slice(0, 10),
                 podium: t.slice(0, 3), direct: true };
      }
    } catch (e) {
      console.error(`  ! classement injoignable (${e.message}) — on retombe sur le dernier releve verifie`);
    }
  }
  return { ...FILET[epreuve], podium: null, direct: false };
}

function carte({ epreuve, femmes, vainqueur, temps, rec, wr, hauteur }) {
  const L = 1080, H = hauteur;
  const titre = `${epreuve} M ${femmes ? 'FEMMES' : 'HOMMES'}`;
  const ecart = (parseFloat(wr.t) - rec.ms / 1000).toFixed(2).replace('.', ',');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // La colonne se dessine a partir de zero et se centre ensuite d'un bloc.
  // Poser chaque ligne par rapport au milieu de l'image, c'est se condamner a
  // recalculer huit ordonnees des qu'on change un format — et c'est comme ca
  // qu'un libelle finit par chevaucher son chrono.
  // Hauteur du bloc de contenu et ou il commence. En feed, on centre. En
  // story, on vise le creux entre les deux bandes d'interface — et on s'arrete
  // assez haut pour laisser le sticker de lien respirer.
  const story = H >= 1700;
  const BLOC = story ? 1180 : 1080;
  const haut = story ? 300 : (H - BLOC) / 2;
  let y = 0;
  const ligne = (dy, contenu) => { y += dy; return contenu(y); };

  const corps = [
    ligne(40, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#7e8aa8" font-size="30" letter-spacing="9">BUDAPEST 2026  ·  ${esc(titre)}</text>`),
    vainqueur ? ligne(86, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#ffffff" font-size="54" font-weight="700">${esc(vainqueur)} — ${esc(temps)}</text>`) : (y += 20, ''),

    ligne(120, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#8794b3" font-size="33" letter-spacing="5">RECORD DU MONDE</text>`),
    ligne(150, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#ffffff" font-size="148" font-weight="800">${esc(wr.t.replace('.', ','))}</text>`),
    ligne(56, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#7e8aa8" font-size="31">${esc(wr.qui)} · debout depuis ${wr.an}</text>`),

    ligne(64, (y) => `<line x1="${L / 2 - 120}" y1="${y}" x2="${L / 2 + 120}" y2="${y}" stroke="#2b3550" stroke-width="3"/>`),

    ligne(74, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#ffb037" font-size="33" letter-spacing="5">RECORD SPRINTER GAME</text>`),
    ligne(172, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="url(#feu)" font-size="172" font-weight="800">${secondes(rec.ms)}</text>`),
    ligne(56, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#c6b48a" font-size="31">${esc(rec.nom)} · ${age(rec.le)}</text>`),

    ligne(story ? 140 : 120, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#ffffff" font-size="41" font-weight="700">${ecart} s plus vite que le monde réel</text>`),
    story
      // En story le lien est un sticker qu'Instagram pose par dessus : on
      // n'ecrit pas l'adresse, on montre ou regarder.
      ? ligne(92, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#ffb037" font-size="34" letter-spacing="4">LE RECORD T'ATTEND  ↓</text>`)
      : ligne(74, (y) => `<text x="${L / 2}" y="${y}" text-anchor="middle" fill="#6f7c9b" font-size="32" letter-spacing="3">sprinter-game.com</text>`),
  ].join('\n    ');

  // Les couloirs de la piste, derriere le bloc : assez pour qu'on lise un
  // stade, assez peu pour qu'on lise les chiffres.
  const basPiste = story ? haut + BLOC + 130 : H - 40;
  const couloirs = [...Array(9)].map((_, i) =>
    `<line x1="0" y1="${basPiste - i * 44}" x2="${L}" y2="${basPiste - i * 44}" stroke="#ffffff" stroke-opacity="${0.055 - i * 0.005}" stroke-width="2"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="nuit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0e1a"/><stop offset="55%" stop-color="#111a33"/><stop offset="100%" stop-color="#060810"/>
    </linearGradient>
    <linearGradient id="feu" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffd15c"/><stop offset="100%" stop-color="#ff7a18"/>
    </linearGradient>
  </defs>
  <rect width="${L}" height="${H}" fill="url(#nuit)"/>
  ${couloirs}
  <g transform="translate(0 ${haut})">
    ${corps}
  </g>
</svg>`;
}

// La conversion en PNG si un navigateur est la. Rien d'installe pour ca : les
// reseaux n'acceptent pas le SVG, et personne ne convertit une image a la main
// trois minutes apres une finale.
function png(svgChemin, pngChemin, L, H) {
  // Le SVG seul, ouvert dans un navigateur, herite de la marge de 8 px du
  // corps de page : l'image glisse et le bas se fait couper. On l'enveloppe
  // donc dans une page a marge nulle, qu'on efface ensuite.
  const cadre = svgChemin.replace(/\.svg$/, '-cadre.html');
  writeFileSync(cadre, `<!doctype html><meta charset="utf-8">`
    + `<style>html,body{margin:0;padding:0;background:#060810}img{display:block}</style>`
    + `<img src="${svgChemin.split('/').pop()}" width="${L}" height="${H}">`);
  const candidats = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ...glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'),
    'google-chrome', 'chromium', 'chromium-browser',
  ];
  // --no-sandbox n'est utile qu'a root, ou Chrome refuse de demarrer sans lui.
  // Sur un Mac d'utilisateur il ne sert a rien, et ne gene pas.
  const racine = typeof process.getuid === 'function' && process.getuid() === 0;
  for (const bin of candidats) {
    try {
      if (bin.startsWith('/') && !existsSync(bin)) continue;
      execFileSync(bin, ['--headless', ...(racine ? ['--no-sandbox'] : []),
        '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        `--screenshot=${pngChemin}`, `--window-size=${L},${H}`,
        `file://${process.cwd()}/${cadre}`],
        { stdio: 'ignore', timeout: 30000 });
      if (existsSync(pngChemin)) { rmSync(cadre, { force: true }); return pngChemin; }
    } catch { /* on essaie le suivant */ }
  }
  rmSync(cadre, { force: true });
  return null;
}

const a = args(process.argv);
// Saisi « 9.82 » au clavier, affiche « 9,82 » partout : la carte et les
// legendes melangeraient sinon les deux ecritures dans la meme phrase.
if (a.temps) a.temps = String(a.temps).replace('.', ',');
if (!MONDE[a.epreuve]) {
  console.error(`epreuve inconnue : ${a.epreuve} (attendu 100, 200 ou 400)`);
  process.exit(1);
}

const rec = await record(a.epreuve, a.horsLigne);
const wr = MONDE[a.epreuve][a.femmes ? 'f' : 'h'];
const genre = a.femmes ? 'f' : 'h';
mkdirSync(SORTIE, { recursive: true });

const base = `${SORTIE}/budapest-${a.epreuve}m-${genre}`;
const formats = [['feed', 1350], ['story', 1920]];
const faits = [];
for (const [nom, H] of formats) {
  const svg = carte({ ...a, rec, wr, hauteur: H });
  const cheminSvg = `${base}-${nom}.svg`;
  writeFileSync(cheminSvg, svg);
  const cheminPng = png(cheminSvg, `${base}-${nom}.png`, 1080, H);
  faits.push(cheminPng || cheminSvg);
}

const ageRec = age(rec.le);
const ans = new Date().getFullYear() - wr.an;
const ecart = (parseFloat(wr.t) - rec.ms / 1000).toFixed(2).replace('.', ',');

console.log(`\n  RECORD SPRINTER GAME ${a.epreuve} m : ${secondes(rec.ms)} s — ${rec.nom} — ${ageRec}`);
console.log(`  ${rec.direct ? 'lu sur le classement en direct' : '! DERNIER RELEVE VERIFIE — le classement n a pas repondu, verifie avant de poster'}`);
if (rec.podium) {
  const p = rec.podium;
  console.log(`  Podium : ${p.map((e) => `${e.name} ${secondes(e.best_split_ms)}`).join('  ·  ')}`);
  if (p.length === 3) {
    const serre = ((p[2].best_split_ms - p[0].best_split_ms) / 1000).toFixed(3).replace('.', ',');
    console.log(`  Le top 3 tient en ${serre} s.`);
  }
}
console.log(`\n  Cartes : ${faits.join('  ')}\n`);

if (!a.vainqueur) {
  console.log('  (Pas de --vainqueur : aucune legende. Relance avec --vainqueur "NOM" --temps 9.XX)\n');
  process.exit(0);
}

const sujet = a.femmes ? `${a.epreuve} m femmes` : `${a.epreuve} m hommes`;
console.log(`--- X / Twitter — a poster en premier ---------------------------------

${a.vainqueur} — ${a.temps}.

Record du monde : ${wr.t.replace('.', ',')}. Debout depuis ${wr.an}. ${ans} ans.

Record Sprinter Game : ${secondes(rec.ms)} s. ${ageRec.charAt(0).toUpperCase() + ageRec.slice(1)}.

${ecart} s separent les deux. sprinter-game.com

--- Reponse sous le clip de @lachainelequipe (2 lignes, pas plus) -----

Le record du monde tient depuis ${wr.an}. Dans notre jeu il est a ${secondes(rec.ms)} s, et ${ageRec}. sprinter-game.com

--- Instagram (story d'abord, post ensuite) ---------------------------

${a.vainqueur} vient de gagner le ${sujet} a Budapest en ${a.temps}.

Le record du monde n'a pas bouge. Il n'a pas bouge depuis ${wr.an} — ${ans} ans que personne n'y touche, et ce soir il y avait 150 000 $ pour celui qui le ferait tomber.

Dans Sprinter Game, le ${a.epreuve} m est a ${secondes(rec.ms)} s. ${ageRec.charAt(0).toUpperCase() + ageRec.slice(1)}.

Tu veux ton nom dessus ? Lien en bio.

#UltimateChampionship #Budapest26 #${a.epreuve}m #athletisme #SprinterGame

--- TikTok ------------------------------------------------------------

Budapest, ce soir. ${a.temps} pour ${a.vainqueur}. Le record du monde tient depuis ${wr.an}. Le notre ${ageRec}. #UltimateChampionship #sprint #jeuxmobile
`);
