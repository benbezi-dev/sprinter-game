/* ---------------------------------------------------------------------------
   ESSAYER L'ENVOI INSTAGRAM, SANS RIEN PUBLIER
   ---------------------------------------------------------------------------
   `instagram-verifier.mjs` interroge Meta avec le jeton lui-meme. Celui-ci
   passe par le WORKER deploye, comme le bouton du calendrier, et fait tout le
   chemin d'un reel sauf la derniere marche :

     1. le worker est-il pret, et que sait-il envoyer ?
     2. Meta accepte-t-il d'ouvrir un conteneur ?  (jeton, permission, compte)
     3. la video traverse-t-elle le worker jusqu'a Meta ?
     4. Meta accepte-t-il NOTRE MP4 ?               (le vrai inconnu)

   Il n'appelle JAMAIS /reseaux/publier. Un conteneur jamais publie expire
   seul au bout de 24 heures, et rien n'apparait sur le compte.

       node tools/instagram-essai.mjs [video.mp4] [--story]

   Sans fichier, il prend le reel relais du 9 septembre. La cle
   d'administration est demandee sans echo — jamais en argument, qui resterait
   dans l'historique du shell et dans `ps`. `ADMIN_CLE` en variable
   d'environnement reste accepte.
--------------------------------------------------------------------------- */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API || 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const ici = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const story = args.includes('--story');
const fichier = path.resolve(args.find(a => !a.startsWith('--'))
  || path.join(ici, '../suivi/publications/2026-09-09-reel-relais/reel-relais-temoin.mp4'));

const ok    = (t, d) => console.log(`   \x1b[32m✓\x1b[0m ${t}${d ? ' — ' + d : ''}`);
const rate  = (t, d) => console.log(`   \x1b[31m✗\x1b[0m ${t}${d ? ' — ' + d : ''}`);
const titre = t => console.log(`\n\x1b[1m${t}\x1b[0m`);
const fin = code => { console.log(''); process.exit(code); };

/** La meme saisie muette que instagram-verifier.mjs, et pour les memes raisons. */
async function demanderMuet(invite) {
  process.stdout.write(invite);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  let tampon = '';
  return new Promise(res => {
    const finir = v => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', surDonnee);
      process.stdout.write('\n');
      res(v);
    };
    const surDonnee = brut => {
      for (const ch of String(brut).replace(/\u001b\[20[01]~/g, '')) {
        if (ch === '\r' || ch === '\n') return finir(tampon.trim());
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }  // Ctrl-C
        if (ch === '\u0004') return finir(tampon.trim());                        // Ctrl-D
        if (ch === '\u007f' || ch === '\b') { tampon = tampon.slice(0, -1); continue; }
        if (ch >= ' ') tampon += ch;
      }
    };
    process.stdin.on('data', surDonnee);
  });
}

if (!fs.existsSync(fichier)) { console.error(`\nFichier introuvable : ${fichier}\n`); process.exit(2); }

let cle = (process.env.ADMIN_CLE || '').trim();
if (!cle) {
  if (!process.stdin.isTTY) {
    console.error('\nIl faut la cle d\'administration, et il n\'y a pas de terminal pour la demander.\n');
    process.exit(2);
  }
  console.log('\nLa cle d\'administration du worker (ADMIN_CLE). Elle ne s\'affiche pas pendant la frappe.');
  cle = await demanderMuet('  Colle-la puis Entree : ');
  if (!cle) { console.error('\nRien recu. Rien fait.\n'); process.exit(2); }
}

async function appel(chemin, { corps, brut, type } = {}) {
  const r = await fetch(API + chemin, {
    method: corps === undefined && brut === undefined ? 'GET' : 'POST',
    headers: {
      'X-Sprinter-Admin': cle,
      ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(brut !== undefined ? { 'Content-Type': type } : {}),
    },
    body: corps !== undefined ? JSON.stringify(corps) : brut,
  });
  const d = await r.json().catch(() => ({}));
  return { http: r.status, d };
}

const octets = fs.readFileSync(fichier);
const format = story ? 'story' : 'reel';
console.log(`\nEssai d'envoi — RIEN NE SERA PUBLIE.`);
console.log(`\x1b[2m   ${path.basename(fichier)} · ${(octets.length / 1048576).toFixed(2)} Mo · ${format} · ${API}\x1b[0m`);

/* ------------------------------------------------------------ 1. le worker */
titre('1. Le worker');
const e = await appel('/reseaux/envoi');
if (e.http === 404) { rate('Cle d\'administration refusee'); fin(1); }
if (!e.d.pret) { rate('Le worker n\'est pas pret', 'IG_JETON ou IG_COMPTE absent'); fin(1); }
ok('Pret', `formats : ${(e.d.formats || ['fil (worker d\'avant la video)']).join(', ')}`);
if (!(e.d.formats || []).includes(story ? 'story-video' : 'reel')) { rate('Ce worker ne sait pas envoyer de video'); fin(1); }

/* ------------------------------------- 1 bis. ce qui est pose, sans le montrer */
titre('1 bis. Les secrets poses sur le worker');
const g = await appel('/reseaux/diagnostic');
if (g.http !== 200) {
  console.log(`   \x1b[2mPas de diagnostic sur ce worker (HTTP ${g.http}) — il date d'avant le 10/09 apres-midi.\x1b[0m`);
} else {
  const j = g.d.jeton, c = g.d.compte, m = g.d.meta;
  const forme = `${j.longueur} caracteres, commence par « ${j.debut} » — famille ${j.famille}`;
  if (j.longueur < 50) rate('IG_JETON beaucoup trop court', forme + ' : collage tronque, ou ce n\'est pas un jeton');
  else if (j.famille === 'inconnue') rate('IG_JETON d\'une forme inconnue', forme);
  else ok('IG_JETON', forme);
  if (j.entoure) console.log('   \x1b[33m!\x1b[0m des blancs ou des guillemets entouraient le jeton — le worker les retire desormais');
  if (j.blancsDedans) rate('IG_JETON contient des espaces ou des retours a la ligne EN SON MILIEU', 'recoller le jeton d\'un seul tenant');
  if (!c.numerique) rate('IG_COMPTE n\'est pas un nombre', `${c.longueur} caracteres — c'est l'identifiant numerique, pas le pseudonyme`);
  else ok('IG_COMPTE numerique', `${c.longueur} chiffres`);
  if (m && m.ok) {
    ok('Meta reconnait le jeton', `${m.nom ? '@' + m.nom + ' · ' : ''}id ${m.id} · via ${g.d.hote.replace('https://', '')}`);
    if (m.compte && !m.compte.ok) rate('Meta ne voit pas IG_COMPTE avec ce jeton', m.compte.erreur);
    else if (m.compte) ok('IG_COMPTE joignable', m.compte.username ? '@' + m.compte.username : '');
  } else if (m) {
    rate('Meta ne reconnait pas le jeton', `${m.erreur} · via ${g.d.hote.replace('https://', '')}`);
  }
}

/* --------------------------------------------------------- 2. le conteneur */
titre('2. Le conteneur chez Meta');
const o = await appel('/reseaux/video/ouvrir', {
  corps: { format, legende: 'essai — jamais publie', partagerAuFil: false },
});
if (!o.d.ok) {
  rate('Meta refuse d\'ouvrir le conteneur', `${o.d.etape || ''} ${o.d.error || 'HTTP ' + o.http}`);
  console.log(`\n   Jeton expire, permission instagram_content_publish absente, ou IG_COMPTE
   faux : node tools/instagram-verifier.mjs dit lequel.`);
  fin(1);
}
ok('Conteneur ouvert', `id ${o.d.creation}`);

/* ---------------------------------------------------------- 3. la video */
titre('3. La video, a travers le worker');
const debut = Date.now();
const c = await appel(`/reseaux/video/charger?creation=${encodeURIComponent(o.d.creation)}`
                    + `&uri=${encodeURIComponent(o.d.uri)}`, { brut: octets, type: 'video/mp4' });
if (!c.d.ok) { rate('Meta n\'a pas pris la video', `${c.d.etape || ''} ${c.d.error || 'HTTP ' + c.http}`); fin(1); }
ok('Recue par Meta', `${((Date.now() - debut) / 1000).toFixed(1)} s`);

/* ------------------------------------------------------- 4. le verdict */
titre('4. Meta accepte-t-il ce MP4 ?');
const t0 = Date.now();
let dernier = '';
while (Date.now() - t0 < 5 * 60 * 1000) {
  const s = await appel(`/reseaux/conteneur?creation=${encodeURIComponent(o.d.creation)}`);
  const etat = s.d.etat || `erreur ${s.http}`;
  if (etat !== dernier) { console.log(`   … ${etat}${s.d.detail ? ' — ' + s.d.detail : ''} (${Math.round((Date.now() - t0) / 1000)} s)`); dernier = etat; }
  if (etat === 'FINISHED') {
    ok('Meta a accepte la video', 'le bouton du calendrier publiera ce fichier');
    console.log(`\n   Rien n'a ete publie. Le conteneur ${o.d.creation} expirera seul dans 24 h.`);
    fin(0);
  }
  if (etat === 'ERROR' || etat === 'EXPIRED' || !s.d.etat) {
    rate('Meta refuse la video', s.d.detail || s.d.error || etat);
    console.log(`\n   Rien n'a ete publie. Le code 2207xxx dans le detail dit pourquoi — edit list,
   piste audio absente, codec. C'est ce fichier qu'il faut reencoder, pas le worker.`);
    fin(1);
  }
  await new Promise(r => setTimeout(r, 3000));
}
rate('Meta n\'a pas tranche en cinq minutes', `dernier etat : ${dernier}`);
fin(1);
