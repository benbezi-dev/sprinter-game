// Une campagne de defis adresses : un defi par joueur du TOP 500, pour faire
// entrer du monde au classement des duels.
//
// POURQUOI CE SCRIPT EXISTE. Le classement des duels ne compte que les duels
// TRANCHES — `duelBoard` filtre sur `wins + losses + draws > 0`. Recevoir un
// defi n'y fait entrer personne ; il faut l'avoir couru. Et un championnat
// national demande trente-deux joueurs classes et actifs dans un pays
// (`championnats-config.js`). Entre les deux il manque le geste qui invite en
// nombre, et le jeu ne l'a pas : on ne peut defier qu'une ligne a la fois,
// depuis l'ecran du classement.
//
// CE QU'IL FAIT, EXACTEMENT. Il rejoue ce geste-la, une fois par joueur, par
// les memes routes publiques que le jeu : `GET /leaderboard` pour la liste,
// `GET /challenge` pour reprendre une course reelle, `POST /challenge` avec
// `target_score_id` pour l'adresser. Rien d'administratif, rien qui contourne
// une regle du serveur.
//
// CE QU'IL N'INVENTE PAS. Le defi porte une COURSE QUI A EU LIEU — celle d'un
// defi deja enregistre, avec sa trace, son chrono et son niveau. On ne
// fabrique pas un fantome : celui qui releve court contre quelque chose de
// vrai.
//
// A BLANC PAR DEFAUT. Sans `--envoyer`, il n'ecrit rien et se contente de dire
// ce qui partirait. C'est voulu : la cible est une population reelle, et un
// defi envoye ne se reprend pas.
//
// DEUX NOTIONS QU'ON NE CONFOND PAS : l'AUDIENCE et la COURSE.
//
// L'audience est la liste des gens a qui l'on ecrit ; elle se lit dans un ou
// plusieurs classements. La course est ce qu'ils auront a battre, et c'est
// ELLE qui decide de la discipline ou le duel comptera — pas le classement ou
// on est alle chercher la personne. Envoyer un 100 m a quelqu'un croise au
// classement du 400 m est donc parfaitement legitime : on le touche la ou il
// figure, et son duel ira au classement du 100 m.
//
//   node tools/defis-campagne.mjs --defi CJKP2P --de <device_id>
//   node tools/defis-campagne.mjs --defi CJKP2P --de <device_id> --envoyer
//
// Options :
//   --audience 100,200,400  les classements ou lire les cibles.
//                           Defaut : la distance de la course.
//   --defi CODE       le defi dont on reprend la course. Obligatoire.
//   --de DEVICE       l'appareil qui lance. Obligatoire (ou SPRINTER_DEVICE).
//   --tous            ne pas ecarter ceux qui sont deja classes en duel.
//   --max N           plafonner le nombre d'envois.
//   --par-minute N    cadence. Defaut 25, sous la limite du serveur (30/min).
//   --journal F       le fichier de suivi. Defaut tools/.defis-campagne.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/* ------------------------------------------------------------- les options */

const argv = process.argv.slice(2);
const drapeau = n => argv.includes(`--${n}`);
const valeur = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const AUDIENCE = (valeur('audience', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const SOURCE = (valeur('defi') || '').toUpperCase();
const DE = valeur('de') || process.env.SPRINTER_DEVICE || '';
const ENVOYER = drapeau('envoyer');
const TOUS = drapeau('tous');
const MAX = Number(valeur('max', '0')) || 0;
const PAR_MINUTE = Number(valeur('par-minute', '25')) || 25;
const JOURNAL = valeur('journal',
  fileURLToPath(new URL('.defis-campagne.json', import.meta.url)));

if (AUDIENCE.some(e => !['100', '200', '400'].includes(e))) {
  console.error('--audience prend des distances parmi 100, 200, 400'); process.exit(1);
}
if (!/^[A-Z0-9]{4,10}$/.test(SOURCE)) {
  console.error('--defi <CODE> est obligatoire : le defi dont on reprend la course'); process.exit(1);
}
if (!/^[0-9a-f]{32}$/i.test(DE)) {
  console.error('--de <device_id> est obligatoire (32 caracteres hexa), ou SPRINTER_DEVICE'); process.exit(1);
}

/* ------------------------------------------------------------- le journal
   Il tient QUI a deja recu, pour que relancer le script ne serve pas un
   second defi aux memes. Une campagne interrompue — reseau, 429, Ctrl-C — se
   reprend donc la ou elle s'est arretee, ce qui est la seule facon de ne pas
   avoir a choisir entre tout renvoyer et tout abandonner. */

const journal = existsSync(JOURNAL)
  ? JSON.parse(readFileSync(JOURNAL, 'utf8'))
  : { envois: [] };
const dejaServi = new Set(journal.envois.map(e => `${e.epreuve}:${e.cible_id}`));
const noterEnvoi = e => {
  journal.envois.push(e);
  writeFileSync(JOURNAL, JSON.stringify(journal, null, 2));
};

/* ----------------------------------------------------------------- le reseau */

async function lire(chemin) {
  const r = await fetch(`${API}${chemin}`);
  if (!r.ok) throw new Error(`GET ${chemin} → ${r.status}`);
  return r.json();
}

const dors = ms => new Promise(r => setTimeout(r, ms));

/* -------------------------------------------------------------- la campagne */

const course = await lire(`/challenge?id=${SOURCE}`);
if (!course.found) { console.error(`le defi ${SOURCE} est introuvable`); process.exit(1); }

// La discipline d'un duel est celle de SA COURSE. C'est la cle sous laquelle
// le serveur rangera le resultat (`duel_players.epreuve`), et donc le
// classement que cette campagne fait grossir.
const DISCIPLINE = course.races.join('+');
// A defaut d'audience declaree, on va chercher les gens la ou la course les
// concerne : le classement de sa propre distance.
const DISTANCES = AUDIENCE.length ? AUDIENCE : [course.races[0]];

// L'ordre compte : quand quelqu'un figure dans plusieurs classements, on garde
// la ligne du premier ou on le rencontre. On commence donc par la distance de
// la course quand elle est dans l'audience — c'est la ligne que le joueur
// reconnaitra comme la sienne quand le defi s'affichera.
const ordre = [...new Set([
  ...DISTANCES.filter(d => course.races.includes(d)), ...DISTANCES,
])];

const duels = await lire(`/duels?epreuve=${DISCIPLINE}`);
const classesEnDuel = new Set(
  (duels.classement || []).map(d => String(d.name).trim().toLowerCase()));

// On ecarte le lanceur lui-meme : le serveur refuse un defi qu'on s'adresse,
// et le compter dans le total mentirait sur la portee de la campagne.
const moiCle = String(course.owner_name || '').trim().toLowerCase();

// Une personne, une invitation. Quelqu'un present sur les trois distances est
// UNE personne : lui envoyer trois fois le meme defi ne le classerait pas
// trois fois, cela le lasserait juste trois fois plus vite.
const parJoueur = new Map();
let lignesLues = 0;
for (const d of ordre) {
  const classement = await lire(`/leaderboard?race=${d}`);
  for (const e of classement.entries || []) {
    lignesLues++;
    const cle = String(e.name).trim().toLowerCase();
    if (!parJoueur.has(cle)) parJoueur.set(cle, { ...e, vu_sur: d });
  }
}

let cibles = [...parJoueur.entries()].filter(([cle, e]) => {
  if (cle === moiCle) return false;
  if (dejaServi.has(`${DISCIPLINE}:${e.id}`)) return false;
  // Le defaut vise ceux qui MANQUENT au classement des duels : ce sont eux
  // qui font le nombre, et ceux qui y sont deja n'ont pas besoin qu'on les
  // derange pour y rester.
  if (!TOUS && classesEnDuel.has(cle)) return false;
  return true;
}).map(([, e]) => e);
if (MAX > 0) cibles = cibles.slice(0, MAX);

const secondes = (course.total_ms / 1000).toFixed(3);
console.log(`Campagne — course ${SOURCE} de ${course.owner_name}, ` +
            `${secondes} s, niveau ${course.level_idx}, discipline ${DISCIPLINE}`);
console.log(`Audience : ${ordre.join(', ')} m — ${lignesLues} lignes lues, ` +
            `${parJoueur.size} joueurs distincts`);
console.log(`Deja classes en ${DISCIPLINE} : ${classesEnDuel.size} ; ` +
            `deja servis : ${dejaServi.size}`);
console.log(`Cibles retenues : ${cibles.length}` + (TOUS ? ' (--tous)' : ''));

if (!ENVOYER) {
  console.log('\n--- A BLANC : rien n\'est envoye. Ajouter --envoyer pour lancer. ---\n');
  for (const c of cibles.slice(0, 20)) {
    console.log(`  ${String(c.id).padStart(5)}  ${c.name}  ${(c.best_split_ms / 1000).toFixed(3)} s  (${c.vu_sur} m)`);
  }
  if (cibles.length > 20) console.log(`  … et ${cibles.length - 20} autres`);
  const minutes = Math.ceil(cibles.length / PAR_MINUTE);
  console.log(`\nDuree estimee a ${PAR_MINUTE}/min : ~${minutes} min.`);
  process.exit(0);
}

const attente = Math.ceil(60000 / PAR_MINUTE);
let ok = 0, echecs = 0;

for (const [i, c] of cibles.entries()) {
  const corps = {
    device_id: DE,
    name: course.owner_name,
    races: course.races,
    level_idx: course.level_idx,
    total_ms: course.total_ms,
    splits: course.splits,
    traces: course.traces,
    target_score_id: c.id,
  };
  try {
    const r = await fetch(`${API}/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const rep = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${rep.error || ''}`);
    // `target_name` vide veut dire que le serveur n'a PAS adresse le defi —
    // ligne disparue, ou cible identique au lanceur. Le defi existe alors
    // sans destinataire : on le compte comme un echec, sinon le bilan
    // annoncerait des invitations que personne n'a recues.
    if (!rep.target_name) throw new Error('defi cree mais non adresse');
    noterEnvoi({ epreuve: DISCIPLINE, cible_id: c.id, cible_nom: c.name,
                 defi: rep.id, source: SOURCE, le: Date.now() });
    ok++;
    console.log(`[${i + 1}/${cibles.length}] ${c.name} ← ${rep.id}`);
  } catch (e) {
    echecs++;
    console.error(`[${i + 1}/${cibles.length}] ${c.name} — echec : ${e.message}`);
  }
  if (i < cibles.length - 1) await dors(attente);
}

console.log(`\nEnvoyes : ${ok} — echecs : ${echecs} — journal : ${JOURNAL}`);
