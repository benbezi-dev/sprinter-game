// LE TOURNAGE DE LA MASCOTTE — images exactes a 60 i/s, fond transparent, pour reels et stories.
// La page dessine chaque image sur une horloge manuelle (aucune image sautee, quelle que soit la
// machine) et l'envoie au recepteur de tools/mascotte-tournage.mjs, qui monte les videos.
// Parametres d'adresse (pour lancer sans cliquer) : ?p=heros-hilare&g=rire&e=idle&f=story&c=pied
// &l=0.32&s=1&tourner=1
import { MASCOTTES, vueMascotte, type Personnage, type Vue } from '../../src/game/mascotte-3d';

const RECEPTEUR = 'http://127.0.0.1:8770';
const FPS = 60;
const FORMATS: Record<string, [number, number]> = { story: [1080, 1920], carre: [1080, 1080], large: [1920, 1080] };
const ECHELLE = 4;   // la toile s'affiche au quart, dessine en plein

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const selP = $<HTMLSelectElement>('p'), selG = $<HTMLSelectElement>('g'), selE = $<HTMLSelectElement>('e');
const selF = $<HTMLSelectElement>('f'), selC = $<HTMLSelectElement>('c');
const inL = $<HTMLInputElement>('l'), inS = $<HTMLInputElement>('s');
const toile = $<HTMLCanvasElement>('toile'), etat = $<HTMLDivElement>('etat');

for (const p of Object.keys(MASCOTTES)) selP.add(new Option(p, p));
function gestes() {
  const liste = MASCOTTES[selP.value as Personnage];
  selG.innerHTML = ''; selE.innerHTML = '';
  selE.add(new Option('(rien : le geste en boucle)', ''));
  for (const g of liste) { selG.add(new Option(g, g)); selE.add(new Option(g, g)); }
  selE.value = 'idle';
}
selP.onchange = gestes;

const q = new URLSearchParams(location.search);
if (q.get('p')) selP.value = q.get('p')!;
gestes();
for (const [k, el] of [['g', selG], ['e', selE], ['f', selF], ['c', selC], ['l', inL], ['s', inS]] as const) {
  const v = q.get(k); if (v != null) (el as HTMLInputElement).value = v;
}

let vue: Vue | null = null;
function ouvrir(manuelle: boolean) {
  vue?.liberer();
  const [w, h] = FORMATS[selF.value];
  // une toile neuve : un contexte WebGL ne se recree pas sur l'ancienne apres dispose()
  const neuve = document.createElement('canvas');
  neuve.id = 'toile';
  neuve.style.width = w / ECHELLE + 'px'; neuve.style.height = h / ECHELLE + 'px';
  $('plateau').replaceChildren(neuve);
  vue = vueMascotte({ toile: neuve, pixels: ECHELLE, lacet: +inL.value, cadrage: selC.value as any, manuelle });
  return neuve;
}

async function voir() {
  ouvrir(false);
  await vue!.jouer(selP.value as Personnage, selG.value, selE.value || null);
}

async function tourner() {
  const cv = ouvrir(true);
  const p = selP.value as Personnage, g = selG.value, e = selE.value || null;
  if (!(await vue!.jouer(p, g, e))) { etat.textContent = 'mascotte non chargee'; return; }
  const d = vue!.duree() + (e ? Math.max(0, +inS.value) : 0);
  const n = Math.round(d * FPS);
  const prise = `${p}-${g}-${selF.value}`;
  etat.textContent = `${prise} : ${n} images…`;
  const r0 = await fetch(`${RECEPTEUR}/debut?prise=${prise}`, { method: 'POST' }).catch(() => null);
  if (!r0?.ok) { etat.textContent = 'recepteur absent : node tools/mascotte-tournage.mjs'; return; }
  for (let i = 0; i < n; i++) {
    vue!.avancer(i === 0 ? 0 : 1 / FPS);
    const b = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
    if (!b) { etat.textContent = `image ${i} vide`; return; }
    const r = await fetch(`${RECEPTEUR}/image?prise=${prise}&n=${i}`, { method: 'POST', body: b }).catch(() => null);
    if (!r?.ok) { etat.textContent = `image ${i} refusee par le recepteur`; return; }
    if (i % 30 === 0) etat.textContent = `${prise} : ${i}/${n}`;
  }
  const fin = await fetch(`${RECEPTEUR}/fin?prise=${prise}&fps=${FPS}`, { method: 'POST' });
  etat.textContent = `${prise} : ${n} images, ${(n / FPS).toFixed(2)} s\n${await fin.text()}`;
  (window as any).__fini = prise;
}

// UN LOT : ?lot=heros:salut,heros-hilare:rire,... — chaque prise a la suite, memes reglages
async function lot(liste: string) {
  const prises = liste.split(',').map((s) => s.split(':')).filter((x) => x.length === 2);
  const faites: string[] = [];
  for (const [p, g] of prises) {
    selP.value = p; gestes(); selG.value = g;
    const e = q.get('e'); if (e != null) selE.value = e;
    (window as any).__fini = null;
    await tourner();
    faites.push((window as any).__fini || `${p}-${g} : RATEE`);
  }
  etat.textContent = `LOT FINI (${faites.length})\n` + faites.join('\n');
  (window as any).__lotFini = faites;
}

$('voir').onclick = voir;
$('tourner').onclick = tourner;
(window as any).__tourner = tourner;
if (q.get('lot')) lot(q.get('lot')!);
else if (q.get('tourner')) tourner(); else voir();
