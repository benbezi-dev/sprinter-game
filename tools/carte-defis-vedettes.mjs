/* ===========================================================================
   LA STORY DES DEFIS DES VEDETTES — l'annonce du soir de l'ouverture.

   Meba-Mickael Zeze (Sprinter, 100 m et 200 m) et Aurel Manga (Hurdlers,
   110 m haies) s'ouvrent ensemble le samedi 3 octobre 2026 a 21 h 30, pour
   une semaine (vite.config.ts, LANCEMENT_DEFI_MEBA). Quatre ecrans de story,
   1080 x 1920, a poster dans l'ordre :

     1-ce-soir      les deux, l'heure d'ouverture
     2-meba         son chrono dans le jeu au 100 m et au 200 m, ce qu'on gagne
     3-aurel        son chrono au 110 m haies, ce qu'on gagne
     4-une-semaine  la fermeture, et la place du sticker « Lien »

     node tools/carte-defis-vedettes.mjs
     node tools/carte-defis-vedettes.mjs --photo-meba ~/meba.jpg --photo-manga ~/aurel.jpg
     node tools/carte-defis-vedettes.mjs --photo-duo ~/eux-deux.jpg --cadre-duo 0.52,0.40,1240,760

   LES IMAGES. Sans rien, ce sont leurs portraits 3D (public/vedettes/), les
   memes que la banniere et la fiche du jeu : detoures, poses tels quels. Avec
   --photo-meba / --photo-manga, une vraie photo prend leur place, recadree
   pour remplir le haut de l'ecran et fondue dans le fond par le bas — il
   n'est pas besoin qu'elle soit detouree.

   UNE PHOTO D'EUX DEUX (--photo-duo) passe l'ecran d'ouverture en plein
   cadre : la photo derriere, le texte sur un degrade sombre en bas. Son
   cadrage, --cadre-duo fx,fy,largeur,y : le point (fx, fy) de la photo — en
   fractions de sa largeur et de sa hauteur, a prendre entre leurs deux
   visages — tombe a la hauteur y de l'ecran, la photo affichee sur `largeur`
   pixels. Une photo de telephone en portrait est bien plus haute que la
   story : c'est ce point, pas un recadrage centre, qui garde les tetes hors
   de la bande que mange Instagram.

   LES CHRONOS NE SONT PAS RECOPIES. Ils sont lus dans les `cibles` de leurs
   stades (src/game/sprinter-core.js) : quand l'un change — celui d'Aurel est
   passe de 12,45 a 11,80 le jour meme —, la carte suit au prochain rendu.
   Le palmares, lui, est celui de la fiche (src/game/vedettes.ts), deja
   verifie sur deux sources.

   Le tiers bas du dernier ecran est laisse vide : c'est la que se pose le
   sticker « Lien » d'Instagram. Instagram mange 250 px en haut et en bas de
   la story ; rien d'important n'y est ecrit.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { capturer, trouverChrome } from './chrome.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'communication/defis-vedettes');
const L = 1080, H = 1920;

function lireArgs(argv) {
  const a = { meba: null, manga: null, duo: null, cadreDuo: [0.5, 0.4, 1240, 760] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--photo-meba') a.meba = path.resolve(String(argv[++i] || ''));
    else if (argv[i] === '--photo-manga') a.manga = path.resolve(String(argv[++i] || ''));
    else if (argv[i] === '--photo-duo') a.duo = path.resolve(String(argv[++i] || ''));
    else if (argv[i] === '--cadre-duo') {
      const v = String(argv[++i] || '').split(',').map(Number);
      if (v.length !== 4 || v.some(n => !Number.isFinite(n))) {
        console.error('--cadre-duo attend fx,fy,largeur,y — par exemple 0.52,0.40,1240,760');
        process.exit(1);
      }
      a.cadreDuo = v;
    }
  }
  for (const f of [a.meba, a.manga, a.duo]) {
    if (f && !fs.existsSync(f)) { console.error(`Photo introuvable : ${f}`); process.exit(1); }
  }
  return a;
}
const args = lireArgs(process.argv.slice(2));

/* Les chronos fixes, lus dans les `cibles` du moteur plutot que recopies. Un
   chrono introuvable arrete tout : une carte sans son chiffre ne se poste pas. */
function chronos() {
  const source = fs.readFileSync(path.join(RACINE, 'src/game/sprinter-core.js'), 'utf8');
  const lire = (cle, epreuve, coureur) => {
    const m = source.match(new RegExp(`'${epreuve}':\\s*\\{\\s*'${coureur}':\\s*([0-9.]+)`));
    if (!m) { console.error(`Chrono introuvable : ${cle} ${epreuve}`); process.exit(1); }
    return Number(m[1]);
  };
  return {
    meba100: lire('meba', '100', 'Méba-Mickaël ZÉZÉ'),
    meba200: lire('meba', '200', 'Méba-Mickaël ZÉZÉ'),
    manga110h: lire('manga', '110h', 'Aurel MANGA'),
  };
}
const C = chronos();
const virgule = t => t.toFixed(2).replace('.', ',');

const OR = '#F8CD4A';
const MEBA = { vive: '#2F5BE0', fonce: '#0B1638', pale: '#A9C1FF', halo: '#1C3070' };
const MANGA = { vive: '#8B5CF6', fonce: '#2A1650', pale: '#C4B5FD', halo: '#3B2470' };

const image = (photo, buste) => photo
  ? { src: `file://${photo}`, photo: true }
  : { src: `file://${path.join(RACINE, 'public/vedettes', buste)}`, photo: false };
const IMG_MEBA = image(args.meba, 'meba-buste.webp');
const IMG_MANGA = image(args.manga, 'manga-buste.webp');

/* ------------------------------------------------------------------ le style */
// Les polices du jeu. Sans reseau — ou quand Chrome ne passe pas par le
// proxy de la machine —, SPRINTER_POLICES designe un dossier de woff2 et son
// polices.css (voir chrome.mjs) ; le 800 du surtitre doit y etre.
const POLICES = process.env.SPRINTER_POLICES
  ? `file://${process.env.SPRINTER_POLICES}/polices.css`
  : 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=Space+Mono:wght@700&display=block';
const STYLE = `
@import url('${POLICES}');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${L}px; height: ${H}px; overflow: hidden; }
body { position: relative; background: #060913; color: #fff;
       font-family: Outfit, sans-serif; -webkit-font-smoothing: antialiased; }
.fond { position: absolute; inset: 0;
  background: radial-gradient(ellipse ${L * 0.85}px ${L * 0.85}px at 50% 8%,
              rgba(248,205,74,0.20), rgba(248,205,74,0) 100%); }
.trait { position: absolute; left: 0; right: 0; height: 2px; opacity: 0.14;
  background: linear-gradient(90deg, rgba(248,205,74,0), ${OR}, rgba(248,205,74,0)); }
.halo { position: absolute; border-radius: 50%; filter: blur(30px); }
.fig { position: absolute; object-fit: contain; object-position: bottom center;
  -webkit-mask-image: linear-gradient(180deg, #000 66%, transparent 96%); }
.fig.photo { object-fit: cover; object-position: center 22%;
  -webkit-mask-image: linear-gradient(180deg, #000 60%, transparent 97%); }
.kicker { position: absolute; top: 262px; left: 0; right: 0; text-align: center;
  font-weight: 800; font-size: 30px; letter-spacing: 7px; color: ${OR}; }
.bloc { position: absolute; left: 80px; right: 80px; text-align: center; }
.titre { font-weight: 900; line-height: 0.94; letter-spacing: -1px; text-shadow: 0 4px 28px rgba(0,0,0,0.35); }
.sous { font-weight: 600; font-size: 38px; line-height: 1.32; color: rgba(255,255,255,0.78); }
.sous b { color: #fff; font-weight: 800; }
.doux { font-weight: 500; font-size: 28px; line-height: 1.4; color: rgba(255,255,255,0.46); }
.chrono { font-family: 'Space Mono', monospace; font-weight: 700; letter-spacing: -2px; }
.filet { height: 1px; background: rgba(255,255,255,0.12); }
.compte { position: absolute; top: 1498px; left: 0; right: 0; text-align: center;
  font-weight: 600; font-size: 28px; letter-spacing: 4px; color: rgba(255,255,255,0.30); }
.pied { position: absolute; top: 1536px; left: 80px; right: 80px; height: 64px;
  border-top: 1px solid rgba(255,255,255,0.10); display: flex; justify-content: space-between;
  align-items: center; font-weight: 700; font-size: 22px; letter-spacing: 6.5px; }
.pied span:first-child { color: rgba(255,255,255,0.46); }
.pied span:last-child { color: rgba(255,255,255,0.30); }
`;

const decor = () => `<div class="fond"></div>` +
  [0.62, 0.73, 0.84].map(f => `<div class="trait" style="top:${Math.round(H * f)}px"></div>`).join('');
const signature = (compte = true) =>
  (compte ? `<div class="compte">@sprintergame</div>` : '') +
  `<div class="pied"><span>SPRINTER</span><span>JEU DE SPRINT</span></div>`;
const halo = (x, y, d, couleur, op = 0.75) =>
  `<div class="halo" style="left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px;` +
  `background:radial-gradient(circle, ${couleur} 0%, transparent 68%);opacity:${op}"></div>`;
const figure = (img, { x, y, w, h }) =>
  `<img class="fig${img.photo ? ' photo' : ''}" src="${img.src}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">`;
/* Une photo en plein cadre, et les deux voiles qui rendent le texte lisible :
   en haut pour le surtitre, en bas — plus long et plus dense — pour le titre
   et la liste. */
const pleinCadre = (fichier, [fx, fy, largeur, y]) =>
  `<img src="file://${fichier}" style="position:absolute;left:${L / 2}px;top:${y}px;width:${largeur}px;` +
  `transform:translate(${-fx * 100}%, ${-fy * 100}%)">` +
  `<div style="position:absolute;left:0;right:0;top:0;height:460px;` +
  `background:linear-gradient(180deg, rgba(6,9,19,0.82), rgba(6,9,19,0))"></div>` +
  `<div style="position:absolute;left:0;right:0;top:820px;bottom:0;` +
  `background:linear-gradient(180deg, rgba(6,9,19,0) 0px, rgba(6,9,19,0.78) 260px, #060913 470px)"></div>`;
const page = corps => `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head>` +
  `<body>${decor()}${corps}</body></html>`;

/* Une ligne « pastille · nom · epreuve », pour l'ecran d'ouverture. */
const ligneVedette = (couleur, nom, epreuve, jeu) => `
  <div style="display:flex;align-items:center;gap:22px;padding:16px 0;text-align:left">
    <div style="width:18px;height:18px;border-radius:50%;background:${couleur};box-shadow:0 0 18px ${couleur}"></div>
    <div style="flex:1;font-weight:800;font-size:40px">${nom}</div>
    <div style="text-align:right;line-height:1.15">
      <div style="font-weight:700;font-size:32px;color:#fff">${epreuve}</div>
      <div style="font-weight:600;font-size:22px;letter-spacing:4px;color:rgba(255,255,255,0.42)">${jeu}</div>
    </div>
  </div>`;

/* Un chrono du jeu, en colonne : l'epreuve au-dessus, le temps en Space Mono. */
const colonneChrono = (epreuve, t, couleur, taille = 120) => `
  <div style="flex:1;text-align:center">
    <div style="font-weight:800;font-size:28px;letter-spacing:6px;color:${couleur}">${epreuve}</div>
    <div class="chrono" style="font-size:${taille}px;line-height:1.05">${virgule(t)}<span style="font-size:${Math.round(taille * 0.4)}px;letter-spacing:0;margin-left:8px;color:rgba(255,255,255,0.5)">s</span></div>
  </div>`;

/* --------------------------------------------------------------- les ecrans */
const deuxFigures = (y, h) => IMG_MEBA.photo || IMG_MANGA.photo
  // Avec de vraies photos : deux moities qui se touchent au centre.
  ? figure(IMG_MEBA, { x: 0, y, w: L / 2, h }) + figure(IMG_MANGA, { x: L / 2, y, w: L / 2, h }) +
    `<div style="position:absolute;left:${L / 2 - 1}px;top:${y + 40}px;width:2px;height:${h - 200}px;` +
    `background:linear-gradient(180deg, transparent, ${OR}, transparent);opacity:0.6"></div>`
  // Les portraits 3D : detoures, ils se chevauchent un peu, chacun dans son halo.
  : halo(330, y + h * 0.45, 640, MEBA.vive, 0.55) + halo(760, y + h * 0.45, 640, MANGA.vive, 0.55) +
    figure(IMG_MANGA, { x: 470, y: y + 30, w: 620, h: h - 30 }) +
    figure(IMG_MEBA, { x: -20, y, w: 640, h });

const ECRANS = [
  { cle: '1-ce-soir', html: page(`
    ${args.duo ? pleinCadre(args.duo, args.cadreDuo) : deuxFigures(318, 760)}
    <div class="kicker">CE SOIR · 21 H 30</div>
    <div class="bloc" style="top:1010px">
      <div class="titre" style="font-size:112px">ILS ENTRENT<br>DANS LE JEU</div>
      <div class="sous" style="margin-top:22px">Bats-les : <b>leurs skins sont à toi.</b></div>
    </div>
    <div class="bloc" style="top:1318px">
      <div class="filet"></div>
      ${ligneVedette(MEBA.vive, 'Méba-Mickaël Zézé', '100 m · 200 m', 'SPRINTER')}
      ${ligneVedette(MANGA.vive, 'Aurel Manga', '110 m haies', 'HURDLERS')}
    </div>
    ${signature(false)}`) },

  { cle: '2-meba', html: page(`
    <div class="kicker" style="color:${MEBA.pale}">ÉVÉNEMENT SPÉCIAL · SPRINT</div>
    ${IMG_MEBA.photo ? figure(IMG_MEBA, { x: 0, y: 300, w: L, h: 740 })
      : halo(540, 700, 860, MEBA.vive, 0.6) + figure(IMG_MEBA, { x: 170, y: 310, w: 740, h: 720 })}
    <div class="bloc" style="top:1000px">
      <div style="font-weight:800;font-size:46px;letter-spacing:3px;color:${MEBA.pale}">MÉBA-MICKAËL</div>
      <div class="titre" style="font-size:150px">ZÉZÉ</div>
    </div>
    <div class="bloc" style="top:1218px">
      <div class="doux" style="font-size:24px;letter-spacing:5px;font-weight:700">SON CHRONO DANS LE JEU</div>
      <div style="display:flex;margin-top:10px">
        ${colonneChrono('100 M', C.meba100, MEBA.pale)}
        <div style="width:1px;background:rgba(255,255,255,0.12)"></div>
        ${colonneChrono('200 M', C.meba200, MEBA.pale)}
      </div>
      <div class="sous" style="font-size:32px;margin-top:20px">Bats-le sur les deux : <b>son skin premium<br>et le Stade de la Riviera</b></div>
    </div>
    ${signature(false)}`) },

  { cle: '3-aurel', html: page(`
    <div class="kicker" style="color:${MANGA.pale}">NOUVEAU · HURDLERS</div>
    ${IMG_MANGA.photo ? figure(IMG_MANGA, { x: 0, y: 300, w: L, h: 740 })
      : halo(540, 700, 860, MANGA.vive, 0.6) + figure(IMG_MANGA, { x: 170, y: 290, w: 740, h: 740 })}
    <div class="bloc" style="top:1000px">
      <div style="font-weight:800;font-size:46px;letter-spacing:3px;color:${MANGA.pale}">AUREL</div>
      <div class="titre" style="font-size:150px">MANGA</div>
    </div>
    <div class="bloc" style="top:1218px">
      <div class="doux" style="font-size:24px;letter-spacing:5px;font-weight:700">SON CHRONO DANS LE JEU</div>
      <div style="display:flex;margin-top:10px">
        ${colonneChrono('110 M HAIES', C.manga110h, MANGA.pale)}
      </div>
      <div class="sous" style="font-size:32px;margin-top:20px">Bats-le : <b>son skin<br>et le Stade Jean-Delbert</b></div>
    </div>
    ${signature(false)}`) },

  { cle: '4-une-semaine', html: page(`
    <div class="kicker">DÉFIS DES VEDETTES</div>
    <div class="bloc" style="top:420px">
      <div class="titre" style="font-size:210px;color:${OR}">7 JOURS</div>
      <div class="titre" style="font-size:84px;margin-top:6px">PAS UN DE PLUS</div>
    </div>
    <div class="bloc" style="top:820px">
      <div class="filet"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:26px 0">
        <span style="font-weight:700;font-size:34px;color:rgba(255,255,255,0.6)">Ouverture</span>
        <span style="font-weight:800;font-size:40px">ce soir · 21 h 30</span>
      </div>
      <div class="filet"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:26px 0">
        <span style="font-weight:700;font-size:34px;color:rgba(255,255,255,0.6)">Fermeture</span>
        <span style="font-weight:800;font-size:40px">sam. 10 oct. · 21 h 30</span>
      </div>
      <div class="filet"></div>
      <div class="sous" style="margin-top:44px">Après, ils repartent.<br><b>Qui les a battus garde son skin à vie.</b></div>
    </div>
    <div class="bloc" style="top:1250px">
      <div class="chrono" style="font-size:52px;letter-spacing:0;color:#fff">sprinter-game.com</div>
    </div>
    ${signature()}`) },
];

/* ----------------------------------------------------------------- le rendu */
const chrome = trouverChrome();
fs.mkdirSync(SORTIE, { recursive: true });
for (const e of ECRANS) {
  const sortie = path.join(SORTIE, `${e.cle}-story.png`);
  await capturer({ html: e.html, w: L, h: H, sortie, chrome, attente: 300 });
  console.log(`  ${path.relative(RACINE, sortie)}`);
}
console.log(`\n  ${ECRANS.length} écrans de story (1080 x 1920)` +
  `${args.meba || args.manga || args.duo ? ', avec photos' : ', portraits 3D'} · ` +
  `chronos : ${virgule(C.meba100)} / ${virgule(C.meba200)} / ${virgule(C.manga110h)}\n`);
