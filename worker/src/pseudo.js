/* ---------------------------------------------------------------------------
   LE FILTRE DES PSEUDOS
   ---------------------------------------------------------------------------
   Un pseudo s'affiche partout : liste « en ligne », TOP 500, classement des
   duels, couloirs du direct. Il est lu par des inconnus, souvent des mineurs,
   et il n'a pas de contexte autour de lui. Il se juge donc plus durement que
   le mot du vainqueur (`mot.js`) : « pedale » y passe parce que « je pedale
   dans la semoule » est une phrase, mais « Elise la pedale » n'est pas une
   phrase, c'est une etiquette collee a quelqu'un.

   La normalisation est celle de `mot.js` — casse, largeurs, ligatures, sosies
   cyrilliques et grecs, accents, caracteres invisibles — completee ici par ce
   que les pseudos font et que les messages font peu :
   - les chiffres et symboles lus de plusieurs facons (« 1 » vaut i OU l,
     « ! » vaut i, l ou rien du tout) : on essaie chaque lecture ;
   - les lettres separees une par une (« p.u.t.e », « s_e_x_e ») : les lettres
     isolees qui se suivent sont recollees en un mot ;
   - les mots colles (« elisepedale ») : les `morceaux` sont cherches dans le
     pseudo sans separateurs, sauf la ou un mot de `BLANCHE` les couvre ;
   - les lettres doublees (« puute », « saloppe ») : une seconde lecture les
     ecrase toutes, contre des listes ecrasees de la meme facon.

   Les langues : celle du pays du joueur, plus le francais et l'anglais
   toujours (voir `pseudo-listes.js`). Le serveur seul tranche ; le jeu garde
   une copie du filtre pour repondre sans attendre (src/game/pseudo.ts).

   Ce que le filtre ne fait pas : il ne comprend pas. Un pseudo assez inventif
   passera — c'est a cela que servent le signalement et la moderation.
--------------------------------------------------------------------------- */

import { forme, reduire } from './mot.js';
import { LISTES, LANGUES_TOUJOURS, PAYS_LANGUE, BLANCHE } from './pseudo-listes.js';

/** Code d'erreur d'un pseudo refuse a la reservation ou au changement. */
export const PSEUDO_INTERDIT = 'INVALID_USERNAME_PROFANITY';
/** Code d'erreur d'un joueur qui porte deja un pseudo interdit. */
export const PSEUDO_A_CHANGER = 'USERNAME_CHANGE_REQUIRED';
/** Ce que les classements montrent a la place d'un pseudo interdit. */
export const NOM_MASQUE = 'Joueur masqué';

/** Toutes les lettres doublees ecrasees : « connard » → « conard ». */
const ecraser = (s) => s.replace(/([a-z0-9])\1+/g, '$1');

/** Les trois lectures des chiffres et symboles. */
const BASE = { '0': 'o', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't',
  '€': 'e', '+': 't', '|': 'l' };
const LECTURES = [
  { ...BASE, '1': 'i', '!': 'i' },
  { ...BASE, '1': 'l', '!': 'l' },
  { ...BASE, '1': 'i', '!': ' ' },
];
const SYMBOLES = /[013457@$€+|!]/g;

/** Les langues a appliquer pour ce pays. */
export function languesDe(pays) {
  const l = PAYS_LANGUE[String(pays || '').trim().toUpperCase()];
  return [...new Set([...(l ? [l] : []), ...LANGUES_TOUJOURS])];
}

/** Les listes d'un ensemble de langues, compilees une fois. */
const compilees = new Map();
function listesPour(langues) {
  const cle = langues.join(',');
  let c = compilees.get(cle);
  if (c) return c;
  const mots = new Set();
  const motsEcrases = new Set();
  const morceaux = new Set();
  for (const l of langues) {
    const L = LISTES[l];
    if (!L) continue;
    for (const m of L.mots) {
      mots.add(m);
      // Ecrasee, une entree courte deviendrait un mot ordinaire (« conne » →
      // « cone ») : on ne garde la forme ecrasee qu'au-dela de quatre lettres.
      const e = ecraser(m);
      if (e.length >= 5) motsEcrases.add(e);
    }
    for (const m of L.morceaux) morceaux.add(m);
  }
  c = {
    mots, motsEcrases,
    morceaux: [...morceaux],
    // Meme prudence pour les morceaux : « xxx » ecrase ne vaut plus que « x ».
    morceauxEcrases: [...new Set([...morceaux].map(ecraser))].filter(m => m.length >= 4),
    blancheSet: new Set(BLANCHE),
    blanche: BLANCHE,
    blancheEcrasee: BLANCHE.map(ecraser),
  };
  compilees.set(cle, c);
  return c;
}

/** Les lectures d'un pseudo : lettres et separateurs, symboles traduits. */
function lire(nom) {
  const f = forme(String(nom)).replace(/ß/g, 'ss');
  return [...new Set(LECTURES.map(t => reduire(f.replace(SYMBOLES, c => t[c]))))];
}

/** Les mots d'une lecture, lettres isolees recollees (« p u t e » → « pute »). */
function motsDe(lecture, blanche) {
  const bruts = lecture.split(/[^a-z0-9]+/).filter(Boolean);
  // Un mot innocent coupe par un TIRET (« pique-niquer ») n'est pas deux mots.
  // Le tiret seul : « fils de pute » ne devient pas « depute » pour autant.
  const tirets = new Set();
  for (const groupe of lecture.match(/[a-z0-9]+(?:-[a-z0-9]+)+/g) || []) {
    const parts = groupe.split('-');
    if (blanche.has(parts.join(''))) parts.forEach(x => tirets.add(x));
  }
  const mots = bruts.filter(m => !tirets.has(m));
  let suite = '';
  for (const m of bruts) {
    if (m.length === 1) { suite += m; continue; }
    if (suite.length >= 2) mots.push(suite);
    suite = '';
  }
  if (suite.length >= 2) mots.push(suite);
  return mots;
}

function motInterdit(m, L) {
  const formes = m.length > 2 && m.endsWith('s') ? [m, m.slice(0, -1)] : [m];
  return formes.some(f => L.mots.has(f) || L.motsEcrases.has(ecraser(f)));
}

/** Le texte, les endroits couverts par un mot innocent remplaces par « # ». */
function masquerBlanche(texte, blanche) {
  let t = texte;
  for (const b of blanche) {
    if (b && t.includes(b)) t = t.split(b).join('#'.repeat(b.length));
  }
  return t;
}

function morceauInterdit(lecture, L) {
  const colle = lecture.replace(/[^a-z0-9]+/g, '');
  if (!colle) return false;
  const brut = masquerBlanche(colle, L.blanche);
  if (L.morceaux.some(m => brut.includes(m))) return true;
  const ecrase = masquerBlanche(ecraser(colle), L.blancheEcrasee);
  return L.morceauxEcrases.some(m => ecrase.includes(m));
}

/**
 * Ce pseudo peut-il etre porte ?
 *
 * `pays` : code ISO du pays du joueur (`player_pays`), ou rien. Rend
 * `{ ok: true }` ou `{ ok: false, raison: 'grossier' }` — jamais le mot
 * trouve : le dire apprendrait a le contourner.
 */
export function pseudoRecevable(nom, pays, { toutes = false } = {}) {
  const brut = String(nom || '').trim();
  if (!brut || brut.toLowerCase() === 'anonyme') return { ok: true };
  const L = listesPour(toutes ? Object.keys(LISTES) : languesDe(pays));
  for (const lecture of lire(brut)) {
    if (motsDe(lecture, L.blancheSet).some(m => motInterdit(m, L))) return { ok: false, raison: 'grossier' };
    if (morceauInterdit(lecture, L)) return { ok: false, raison: 'grossier' };
  }
  return { ok: true };
}

/** Raccourci : ce pseudo est-il interdit ? */
export function pseudoInterdit(nom, pays, options) {
  return !pseudoRecevable(nom, pays, options).ok;
}

/**
 * Le nom tel qu'un classement peut le montrer. Un classement est lu par tout
 * le monde : on le juge avec toutes les langues des listes.
 */
export function nomAffichable(nom) {
  return pseudoInterdit(nom, null, { toutes: true }) ? NOM_MASQUE : nom;
}
