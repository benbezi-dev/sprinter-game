/* ===========================================================================
   Les cartes du Meeting de l'Eure (30/01/2027, salle Jesse Owens, Val-de-Reuil).

     node tools/meeting-eure/cartes.mjs            # toutes les cartes
     node tools/meeting-eure/cartes.mjs teaser     # une seule

   Sort communication/meeting-eure/cartes/<nom>-feed.png (1440x1800, 4:5)
   et <nom>-story.png (1440x2560, 9:16) : du 2K, qu'Instagram ramene a 1080
   sans perte visible.

   Les fonds sont de VRAIES images du jeu : les photogrammes 2K du tournage
   (communication/meeting-eure/images/, tires par tourner.mjs). Rien n'est
   maquette.

   AUCUN LOGO DU MEETING NI DE SES PARTENAIRES. Les cartes publiques parlent
   de la salle et de la date, pas de l'evenement : son nom et ses logos
   attendent l'accord ecrit des organisateurs (communication/offre-panneaux.md).
   La carte « proposition » nomme le meeting : elle se joint au message prive,
   elle ne se publie pas.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from './pw.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../..');
const KIT = path.join(RACINE, 'communication/meeting-eure');
const IMAGES = path.join(KIT, 'images');
const SORTIE = path.join(KIT, 'cartes');
const POLICES = pathToFileURL(path.join(RACINE, 'public/fonts')).href;

const FORMATS = { feed: [1440, 1800], story: [1440, 2560] };

const CARTES = {
  // L'ACCROCHE : « le public prend le depart » (celle du commentaire sous l'affiche, 28/11/2026)
  teaser: {
    fond: 'salle-survol.jpg',
    kicker: 'Val-de-Reuil · salle Jesse Owens',
    titre: 'Cette année,<br>le public prend<br><em>le départ.</em>',
    sous: 'La salle Jesse Owens, reconstruite en 3D : le 60 m sur la ligne droite, le 200 et le 400 sur l’anneau relevé.',
    badge: '30.01.2027',
  },
  depart: {
    fond: 'salle-depart.jpg',
    kicker: '60 m en salle',
    titre: 'Tu ne regardes plus.<br><em>Tu cours.</em>',
    sous: 'Réagis au coup de pistolet, alterne gauche-droite : le départ se joue au centième.',
  },
  anneau: {
    fond: 'salle-anneau.jpg',
    kicker: '200 m · 400 m',
    titre: 'Des tribunes<br><em>aux couloirs.</em>',
    sous: 'L’anneau relevé de la salle de Val-de-Reuil, comme en vrai.',
  },
  'rendez-vous': {
    fond: 'salle-course.jpg',
    kicker: 'Samedi 30 janvier 2027',
    titre: 'Le 30 janvier,<br>et si c’était toi<br><em>au départ ?</em>',
    sous: 'En attendant, entraîne-toi dans la salle Jesse Owens.',
    badge: 'J-?',
  },
  proposition: {
    fond: 'salle-survol.jpg',
    prive: true,
    kicker: 'Proposition · document privé',
    titre: 'Le public du Meeting<br><em>prend le départ.</em>',
    sous: 'La salle Jesse Owens existe déjà dans Sprinter, en 3D. Une idée pour rendre le public acteur du meeting :',
    points: [
      ['Le défi', 'Courir sur la piste du meeting, avant ou pendant l’événement, avec un classement des meilleurs chronos.'],
      ['Les duels', 'Les spectateurs se défient entre eux, chacun sur son téléphone.'],
      ['Partenaires', 'Vos logos sur les panneaux de la piste virtuelle, en 2D et en 3D, avec un bilan chiffré à la fin.'],
      ['Réseaux', 'Une animation à partager pour faire monter l’attente avant le jour J.'],
    ],
  },
};

/** Le J-x se calcule le jour ou l'on fabrique la carte : jamais ecrit d'avance. */
function joursAvant() {
  const jour = new Date(2027, 0, 30), auj = new Date(); auj.setHours(0, 0, 0, 0);
  const n = Math.round((jour - auj) / 86400000);
  return n > 0 ? `J-${n}` : n === 0 ? 'C’est ce soir' : null;
}

function html(c, fmt) {
  const [L, H] = FORMATS[fmt];
  const story = fmt === 'story';
  const k = L / 1080;
  const fond = pathToFileURL(path.join(IMAGES, c.fond)).href;
  const badge = c.badge === 'J-?' ? joursAvant() : c.badge;
  const points = (c.points || []).map(([t, d]) => `<div class="pt"><b>${t}</b><span>${d}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:Outfit;font-weight:900;src:url(${POLICES}/Outfit-900-latin.woff2)}
  @font-face{font-family:Outfit;font-weight:700;src:url(${POLICES}/Outfit-700-latin.woff2)}
  @font-face{font-family:Outfit;font-weight:500;src:url(${POLICES}/Outfit-500-latin.woff2)}
  @font-face{font-family:Jakarta;font-weight:600;src:url(${POLICES}/PlusJakartaSans-600-latin.woff2)}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${L}px;height:${H}px;overflow:hidden;background:#0b1222}
  .fond{position:absolute;inset:0;background:url(${fond}) center ${story ? '30%' : '35%'}/cover}
  .voile{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,13,28,.55) 0%,rgba(8,13,28,0) 22%,rgba(8,13,28,0) ${c.points ? 18 : 38}%,rgba(8,13,28,.82) ${c.points ? 40 : 62}%,#080d1c 100%)}
  .haut{position:absolute;left:${80 * k}px;right:${80 * k}px;top:${(story ? 120 : 70) * k}px;display:flex;justify-content:space-between;align-items:center}
  .marque{font:900 ${44 * k}px/1 Outfit;color:#FFD23F;letter-spacing:.04em}
  .badge{font:900 ${36 * k}px/1 Outfit;color:#0b1222;background:#FFD23F;padding:${16 * k}px ${26 * k}px;border-radius:${14 * k}px;letter-spacing:.02em}
  .bas{position:absolute;left:${80 * k}px;right:${80 * k}px;bottom:${(story ? 230 : 90) * k}px}
  .kicker{font:600 ${28 * k}px/1.2 Jakarta;color:#c9d3e6;letter-spacing:.22em;text-transform:uppercase;margin-bottom:${26 * k}px;display:flex;align-items:center;gap:${18 * k}px}
  .kicker:before{content:"";width:${48 * k}px;height:${6 * k}px;background:#FFD23F;border-radius:3px}
  h1{font:900 ${(c.points ? (story ? 92 : 72) : story ? 118 : 108) * k}px/0.98 Outfit;color:#fff;text-transform:uppercase;letter-spacing:-.01em;text-shadow:0 ${4 * k}px ${30 * k}px rgba(0,0,0,.45)}
  h1 em{font-style:normal;color:#FFD23F}
  .sous{font:500 ${(c.points && !story ? 30 : 36) * k}px/1.35 Outfit;color:#dbe3f1;margin-top:${(c.points && !story ? 20 : 30) * k}px;max-width:${880 * k}px}
  .pts{margin-top:${(story ? 34 : 24) * k}px;display:grid;gap:${(story ? 18 : 12) * k}px}
  .pt{display:grid;grid-template-columns:${210 * k}px 1fr;gap:${20 * k}px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:${18 * k}px;padding:${(story ? 22 : 16) * k}px ${26 * k}px}
  .pt b{font:900 ${30 * k}px/1.2 Outfit;color:#FFD23F;text-transform:uppercase}
  .pt span{font:500 ${28 * k}px/1.35 Outfit;color:#e7edf7}
  .pied{margin-top:${(c.points && !story ? 28 : 44) * k}px;padding-top:${28 * k}px;border-top:1px solid rgba(255,255,255,.16);display:flex;justify-content:space-between;font:600 ${26 * k}px/1.2 Jakarta;color:#9fb0cb;letter-spacing:.06em}
  .pied b{color:#fff;font-weight:600}
  </style></head><body>
  <div class="fond"></div><div class="voile"></div>
  <div class="haut"><div class="marque">SPRINTER</div>${badge ? `<div class="badge">${badge}</div>` : ''}</div>
  <div class="bas">
    <div class="kicker">${c.kicker}</div>
    <h1>${c.titre}</h1>
    <div class="sous">${c.sous}</div>
    ${points ? `<div class="pts">${points}</div>` : ''}
    <div class="pied"><span><b>Sprinter</b> · gratuit · App Store · Google Play</span><span>sprinter-game.com</span></div>
  </div>
  </body></html>`;
}

const voulues = process.argv.slice(2).filter(a => !a.startsWith('--'));
const noms = voulues.length ? voulues : Object.keys(CARTES);
fs.mkdirSync(SORTIE, { recursive: true });
const b = await chromium.launch();
for (const nom of noms) {
  const c = CARTES[nom];
  if (!c) { console.error(`carte inconnue : ${nom}`); continue; }
  if (!fs.existsSync(path.join(IMAGES, c.fond))) { console.error(`fond manquant : images/${c.fond} (lancer tourner.mjs d'abord)`); continue; }
  for (const fmt of Object.keys(FORMATS)) {
    const [L, H] = FORMATS[fmt];
    const p = await b.newPage({ viewport: { width: L, height: H } });
    const f = path.join(SORTIE, `.${nom}-${fmt}.html`);
    fs.writeFileSync(f, html(c, fmt));
    await p.goto(pathToFileURL(f).href);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SORTIE, `${nom}-${fmt}.png`) });
    fs.rmSync(f);
    await p.close();
    console.log(`  ✓ cartes/${nom}-${fmt}.png`);
  }
}
await b.close();
