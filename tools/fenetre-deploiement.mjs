/* ===========================================================================
   LA FENETRE DE DEPLOIEMENT DU WORKER : jamais pendant une course.

     node tools/fenetre-deploiement.mjs             peut-on deployer maintenant ?
     node tools/fenetre-deploiement.mjs --attendre  attend la fin de la course

   Deployer le worker redemarre ses objets durables, et une salle redemarree a
   perdu sa memoire : qui est la, qui est pret, qui a vole le depart. Une serie
   de championnat coupee en pleine chambre d'appel ne se rattrape pas — les
   huit partants sont renvoyes a l'accueil a l'heure du pistolet. Or chaque
   poussee sur `main` deploie, et rien n'empechait qu'elle tombe un dimanche a
   12:29.

   Ce script est la marche que `worker.yml` monte avant `wrangler deploy`. Il
   lit le calendrier en production — les editions en cours (`/champ/monde`),
   puis celui de chacune (`/champ/edition/<id>`, courses hors calendrier
   comprises) — et refuse la fenetre qui entoure chaque course :
   - 20 minutes avant : la salle ouvre un quart d'heure avant le pistolet, et
     la chambre d'appel est deja une salle ;
   - 15 minutes apres : le retard tolere, les abandons, puis le resultat.
   Des fenetres qui se chevauchent (les trois repechages du 26/09, a vingt
   minutes d'ecart) n'en font qu'une.

   RIEN N'EST RECOPIE ICI, et c'est voulu : les heures viennent du serveur, qui
   est le seul a savoir qu'on a ajoute un repechage a 19:50.

   Avec --attendre, une course en cours ne fait pas echouer le deploiement :
   on attend la fin de sa fenetre, puis on laisse passer. Trois heures au
   plus ; au-dela, on echoue en le disant.

   DEUX SORTIES DE SECOURS, et elles laissent deployer :
   - le calendrier illisible (serveur en panne, route absente). Un worker
     casse doit pouvoir etre repare, meme un dimanche a midi ;
   - FORCER=true, pose par un lancement a la main (« forcer » dans l'onglet
     Actions). C'est le geste de qui sait qu'il corrige la salle elle-meme.

   Le canal de test n'est pas regarde : ses courses ne sont celles de personne.
   =========================================================================== */
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const API = process.env.API || 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
export const AVANT_MS = 20 * 60e3;
export const APRES_MS = 15 * 60e3;
const ATTENTE_MAX_MS = 3 * 3600e3;
const RELIRE_MS = 5 * 60e3;
const JOUR = 24 * 3600e3;

/** « dim. 27/09 12:30 », a l'heure de Paris : celle du calendrier annonce. */
export const heure = ms => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  timeZone: 'Europe/Paris',
}).format(new Date(ms));

/**
 * Les courses d'une liste d'editions, telles que `/champ/edition` les rend.
 * Seuls les rendez-vous qui portent une course comptent : une revelation ou
 * une ceremonie ne tient aucune salle ouverte.
 */
export function coursesDe(editions) {
  const out = [];
  for (const ed of editions) {
    for (const r of ed.calendrier || []) {
      if (r.course == null || !Number.isFinite(r.at)) continue;
      out.push({ edition: ed.id, zone: ed.zoneNom || ed.zone || '', cle: r.cle, at: r.at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * La fenetre qui contient `maintenant`, ou null.
 *
 * Rend la course qui l'ouvre et la fin de la fenetre, prolongee tant qu'une
 * autre fenetre commence avant qu'elle ne finisse.
 */
export function fenetreEnCours(courses, maintenant, avant = AVANT_MS, apres = APRES_MS) {
  const triees = [...courses].sort((a, b) => a.at - b.at);
  const i = triees.findIndex(c => c.at - avant <= maintenant && maintenant < c.at + apres);
  if (i < 0) return null;
  let fin = triees[i].at + apres;
  for (const c of triees.slice(i + 1)) {
    if (c.at - avant >= fin) break;
    fin = Math.max(fin, c.at + apres);
  }
  return { course: triees[i], fin };
}

/** La prochaine course a venir, pour le dire quand on laisse passer. */
export function prochaine(courses, maintenant) {
  return [...courses].sort((a, b) => a.at - b.at).find(c => c.at > maintenant) || null;
}

async function lire(chemin) {
  const entetes = process.env.ACCES ? { 'X-Sprinter-Test': process.env.ACCES } : {};
  const r = await fetch(API + chemin, { headers: entetes, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${chemin} → ${r.status}`);
  return r.json();
}

/**
 * Les courses des editions qui courent autour de maintenant.
 *
 * Une edition annoncee compte aussi, si son weekend est la : elle passe
 * « ouverte » a la cloture, et la grille peut partir le jour meme.
 */
async function coursesAutourDe(maintenant) {
  const monde = await lire('/champ/monde');
  const candidates = [...(monde.encours || []), ...(monde.annoncees || [])]
    .filter(e => Number.isFinite(e.debut) && e.debut - JOUR <= maintenant && maintenant <= e.debut + 3 * JOUR);
  const editions = [];
  for (const e of candidates) editions.push(await lire('/champ/edition/' + e.edition));
  return coursesDe(editions);
}

function resume(texte) {
  console.log(texte);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, texte + '\n\n'); } catch { /* sans resume */ }
  }
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function principal() {
  const attendre = process.argv.includes('--attendre');
  // Pour les essais : un instant impose, et le script ne dort pas.
  const impose = Number(process.env.MAINTENANT);
  const horloge = () => (Number.isFinite(impose) && impose > 0 ? impose : Date.now());

  if (process.env.FORCER === 'true') {
    resume('⚠️ Deploiement force a la main : la fenetre des courses n\'est pas regardee.');
    return 0;
  }

  const debut = horloge();
  for (;;) {
    const maintenant = horloge();
    let courses;
    try {
      courses = await coursesAutourDe(maintenant);
    } catch (e) {
      resume(`⚠️ Calendrier illisible (${e.message}) : on deploie quand meme — un worker casse doit pouvoir etre repare.`);
      return 0;
    }
    const f = fenetreEnCours(courses, maintenant);
    if (!f) {
      const p = prochaine(courses, maintenant);
      resume(p
        ? `✅ Aucune course en cours. Prochaine : ${p.zone} ${p.cle}, ${heure(p.at)} (heure de Paris).`
        : '✅ Aucune course de championnat autour de maintenant.');
      return 0;
    }
    const quoi = `${f.course.zone} ${f.course.cle}, ${heure(f.course.at)}`;
    if (!attendre) {
      resume(`⛔ Course en cours ou imminente (${quoi}). Deploiement possible apres ${heure(f.fin)} (heure de Paris).`);
      return 1;
    }
    if (f.fin - debut > ATTENTE_MAX_MS) {
      resume(`⛔ Des courses s'enchainent jusqu'a ${heure(f.fin)} : plus de trois heures d'attente. ` +
             'Relancer le deploiement plus tard, ou le forcer a la main si c\'est une correction urgente.');
      return 1;
    }
    if (Number.isFinite(impose) && impose > 0) {
      resume(`⏳ Attendrait jusqu'a ${heure(f.fin)} (${quoi}).`);
      return 2;
    }
    console.log(`⏳ ${quoi} : le deploiement attend la fin de la fenetre, ${heure(f.fin)} (heure de Paris).`);
    await dormir(Math.min(RELIRE_MS, Math.max(1000, f.fin - Date.now())));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await principal());
}
