/**
 * TEST DU RELAIS 4 × 100 — CANAL DE TEST, FILME PAR LE JEU
 *
 * Quatre joueurs neufs, une equipe, un relais complet — et la video sort de
 * L'ENREGISTREUR DU JEU (`src/game/review.ts`), pas d'une camera exterieure.
 *
 * POURQUOI PAS LA CAMERA DU HARNAIS. `base.mjs` sait filmer un telephone en
 * 1080 × 1920 avec `Page.captureScreenshot` en boucle. Sur le relais, cette
 * boucle rend le jeu injouable pour un automate : le controle
 * d'accessibilite de Playwright — `waitFor({state:'visible'})`,
 * `scrollIntoViewIfNeeded` — doit interroger le moteur de rendu, et la
 * capture ne lui en laisse pas le temps. « FIXER L'ORDRE » et « ENTRER SUR
 * LA PISTE » etaient declares absents alors qu'ils etaient a l'ecran ; pire,
 * une capture lancee pendant un rechargement ne rend jamais la main et
 * `Camera.suspendre()`, qui l'attend sans borne, fige le harnais entier.
 *
 * Le jeu, lui, filme deja : `programmerLeFilm('relais', …)` part au coup de
 * pistolet et `arreterLeFilm('relais')` s'arrete au chrono de l'equipe. Le
 * montage recopie le stade ET repeint le HUD par-dessus (`hud-film.ts`), avec
 * le son du stade. C'est la vraie video du jeu, celle que le joueur partage.
 *
 * On la recupere en enveloppant `MediaRecorder` avant la premiere navigation :
 * les morceaux sont gardes de notre cote, et survivent donc a
 * `jeterLeFilm()`, que la piste appelle en se demontant.
 *
 * Le reste — la porte du canal de test, les quatre identites, le pistolet lu
 * dans le moteur et non dans la salle, les passes pilotees sur l'etat du
 * serveur — est explique a chaque etape ci-dessous.
 */
import { navigateur, telephone, dormir, appuyer, appuyerSur, URL_JEU } from './base.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const CODE_ACCES = process.env.CODE_ACCES || 'RELAIS4';
const API = process.env.API || 'http://127.0.0.1:8788';
const SORTIE = process.env.SORTIE ||
  '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail/03t-relais-test';

const SUF = Date.now().toString(36).slice(-3).toUpperCase();
const NOMS = [1, 2, 3, 4].map(i => `COUREUR${i}${SUF}`);
const EQUIPE = `RELAIS ${SUF}`;
const APP = Object.fromEntries(NOMS.map((n, i) => [n, `tst-${SUF.toLowerCase()}-relais-${i + 1}`]));
/* Le telephone qu'on filme : le DEUXIEME relayeur. C'est le seul ecran qui
   montre DEUX transmissions — celle qu'il recoit du premier, celle qu'il
   donne au troisieme — et le depart du premier est dans son champ. */
const FILME = process.env.FILME || NOMS[1];

mkdirSync(SORTIE, { recursive: true });
const T0 = Date.now();
const brut = console.log;
console.log = (...a) => brut(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const CHIEN = Number(process.env.CHIEN_MS || 12 * 60 * 1000);
setTimeout(() => { brut('\n!! CHIEN DE GARDE — on coupe.'); process.exit(3); }, CHIEN).unref();

console.log('── TEST · RELAIS 4 × 100 · CANAL DE TEST ─────────────────');
console.log(`   equipe « ${EQUIPE} » · ${NOMS.join(', ')}`);

const entete = { 'X-Sprinter-Test': CODE_ACCES };
const equipeDe = async (nom) => {
  const d = await (await fetch(`${API}/relay/mine?name=${encodeURIComponent(nom)}`, { headers: entete })).json();
  return [...(d.equipes || []), ...(d.invitations || [])].find(e => e.nom === EQUIPE) || null;
};
const dedans = async () => {
  const e = await equipeDe(NOMS[0]);
  if (!e) return { n: 0, etats: {} };
  return { n: e.membres.filter(m => m.etat === 'in').length,
           etats: Object.fromEntries(e.membres.map(m => [m.nom, m.etat])), id: e.id };
};

const b = await navigateur();
const tel = {};
const voit = (page, mot) => page.innerText('body').then(t => t.includes(mot));

/** Passer l'ecran d'ouverture — en ne tapant QUE sur lui. */
async function reveiller(page, essais = 20) {
  for (let i = 0; i < essais; i++) {
    const t = (await page.innerText('body')).toUpperCase();
    if (t.includes('CARRIÈRE') && t.includes('ONE SHOT')) { await dormir(300); return true; }
    // Un tap de trop depuis l'accueil tombe sur COMMENCER et lance une course
    // de carriere : le telephone part courir seul et n'accepte jamais son
    // invitation. On revient donc en arriere plutot que de la jouer.
    if (t.includes('ALTERNE LES DEUX TOUCHES') || t.includes('ATTENDS LE SIGNAL')) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await dormir(2500); continue;
    }
    if (/SPRINTER|TAP TO START|SIX STAGES/.test(t)) {
      await page.tap('body', { position: { x: 200, y: 600 } }).catch(() => {});
      await page.waitForFunction(() => /CARRIÈRE/.test(document.body.innerText),
                                 null, { timeout: 15000 }).catch(() => {});
      continue;
    }
    await dormir(800);
  }
  return false;
}

/**
 * DEFI, puis le panneau du relais deplie — et verifie deplie.
 *
 * `ouvrirPanneau()` de base.mjs tape, dort 1 200 ms, regarde, et RETAPE : sur
 * une machine chargee le premier appui ouvre, le controle arrive trop tot, et
 * le second REFERME. On attend donc le marqueur apres chaque appui.
 */
/**
 * L'EN-TETE DU PANNEAU SE VISE PAR `aria-expanded`, PAS PAR SON TEXTE.
 *
 * `appuyer(page, 'RELAIS 4 × 100')` cherchait le libelle et prenait le
 * premier element visible qui le contient. Panneau OUVERT, ce libelle
 * apparait aussi dans le corps : l'appui tombait a cote, le panneau ne se
 * repliait pas — et `ouvrirRelais`, le voyant deja ouvert, rendait `true`
 * sans avoir rien rafraichi. Un invite ne voyait donc jamais son invitation,
 * et rien ne le signalait.
 *
 * `Repliable` rend un seul `<button aria-expanded>` par panneau : c'est une
 * poignee sans ambiguite. Rend l'etat apres l'appui, ou null.
 */
const basculerPanneau = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('button[aria-expanded]')]
    .find(x => /RELAIS 4/i.test(x.innerText));
  if (!b) return null;
  const ev = t => b.dispatchEvent(new PointerEvent(t,
    { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown'); ev('pointerup'); b.click();
  return true;
});

/** Le panneau du relais est-il deplie ? */
const panneauOuvert = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('button[aria-expanded]')]
    .find(x => /RELAIS 4/i.test(x.innerText));
  return b ? b.getAttribute('aria-expanded') === 'true' : null;
});

async function ouvrirRelais(page) {
  // 1 · l'onglet DEFI, ou vit le panneau
  for (let i = 0; i < 5 && (await panneauOuvert(page)) === null; i++) {
    await appuyer(page, 'DÉFI', { exact: true, essais: 2 }).catch(() => {});
    await page.waitForFunction(() => document.body.innerText.includes('RELAIS 4 × 100'),
                               null, { timeout: 14000 }).catch(() => {});
  }
  // 2 · deplie, et verifie deplie
  for (let i = 0; i < 5; i++) {
    if (await panneauOuvert(page)) { await dormir(500); return true; }
    if (!await basculerPanneau(page)) { await dormir(800); continue; }
    await page.waitForFunction(
      () => document.body.innerText.includes('CLASSEMENT DES ÉQUIPES'),
      null, { timeout: 15000 }).catch(() => {});
  }
  return false;
}

/**
 * UN SEUL TELEPHONE FILME.
 *
 * Le jeu enregistre la course sur CHAQUE ecran : quatre montages, quatre
 * encodeurs H.264, quatre flux de canvas. Sur une machine qui pagine deja —
 * sept gigaoctets de swap sur huit — c'est ce qui fait tomber le jeu a un
 * metre par seconde, et un relais de quarante secondes prend alors sept
 * minutes. Les trois autres n'ont aucune raison de filmer : leur video ne
 * servira pas. On leur retire donc l'enregistreur, ce qui suffit a ce que
 * `Review.estPossible()` reponde non et qu'aucune camera ne parte.
 */
async function entrer(nom, filme) {
  const { ctx, page, cdp } = await telephone(b, { nom, device: APP[nom] });
  await ctx.addInitScript(([code, filme]) => {
    try { localStorage.setItem('sprinter_acces_test', code); } catch (e) {}
    if (!filme) { try { delete window.MediaRecorder; } catch (e) { window.MediaRecorder = undefined; } return; }

    /* L'ENREGISTREUR DU JEU, SUR ECOUTE.
       `Review` garde ses morceaux dans une variable privee, construit un Blob
       a l'arret, en fait une URL d'objet — puis la piste du relais appelle
       `jeterLeFilm()` en se demontant et l'URL ne vaut plus rien. En gardant
       une copie des morceaux ici, le film survit a ce menage et se relit
       apres coup, quoi que fasse l'ecran. */
    const Vrai = window.MediaRecorder;
    if (!Vrai) return;
    window.__morceaux = [];
    window.__type = '';
    function Espion(flux, opts) {
      const r = new Vrai(flux, opts);
      window.__type = (opts && opts.mimeType) || '';
      r.addEventListener('dataavailable', e => {
        if (e.data && e.data.size) window.__morceaux.push(e.data);
      });
      r.addEventListener('stop', () => { window.__filmFini = true; });
      return r;
    }
    Espion.isTypeSupported = (...a) => Vrai.isTypeSupported(...a);
    Espion.prototype = Vrai.prototype;
    window.MediaRecorder = Espion;

    /* Pourquoi le film ne part pas, le cas echeant. `Review.demarrer()` avale
       ses echecs dans un `phase: 'impossible'` qu'aucun ecran ne montre
       pendant la course : sans ces temoins, un rush vide ne dit pas s'il a
       manque le canvas, le format, ou le flux. */
    window.__diag = { captures: 0, flux: null, erreur: null };
    const vraiCapture = HTMLCanvasElement.prototype.captureStream;
    if (vraiCapture) {
      HTMLCanvasElement.prototype.captureStream = function (...a) {
        window.__diag.captures++;
        try {
          const f = vraiCapture.apply(this, a);
          window.__diag.flux = `${this.width}x${this.height} · ${f.getTracks().length} piste(s)`;
          return f;
        } catch (e) { window.__diag.erreur = 'captureStream: ' + String(e).slice(0, 120); throw e; }
      };
    }
  }, [CODE_ACCES, filme]);

  page.on('dialog', async d => { await d.accept(); });
  await page.goto(URL_JEU, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /VERSION DE TEST/i.test(document.body.innerText),
                             null, { timeout: 60000 });
  await dormir(1200);
  try {
    if (!await reveiller(page)) throw new Error("l'accueil n'est jamais venu");
    if (!await ouvrirRelais(page)) throw new Error("le panneau du relais ne s'ouvre pas");
  } catch (err) {
    // Un contexte abandonne en route est un Chrome de plus sur une machine
    // deja saturee — et c'est ce qui fait echouer l'essai suivant.
    await ctx.close().catch(() => {});
    throw new Error(`${nom} : ${err.message}`);
  }
  return { nom, ctx, page, cdp };
}

/**
 * REMETTRE LE PANNEAU DU RELAIS A JOUR — SANS RECHARGER LA PAGE.
 *
 * `RelaisPanel` interroge le serveur dans un `useEffect(..., [])` : une seule
 * fois, au montage. Un panneau ouvert avant l'envoi des invitations ne les
 * verra donc jamais. D'ou, au depart, un `page.reload()` par etape — et c'est
 * lui qui rendait le harnais impraticable : trois navigations par acceptation
 * sur une machine a charge 100, et l'une d'elles rate toujours.
 *
 * `Repliable` rend son contenu avec `{ouvert && children}` : le replier le
 * DEMONTE, le rouvrir le remonte, et le remontage refait la requete. Meme
 * effet qu'un rechargement, sans navigation, sans relancer le jeu.
 *
 * Le rechargement reste en filet, pour le cas ou la page aurait derive hors
 * de l'onglet DEFI.
 */
async function rafraichirRelais(n) {
  const p = tel[n].page;
  for (let i = 0; i < 4 && (await panneauOuvert(p)) === true; i++) {
    await basculerPanneau(p);
    await p.waitForFunction(
      () => {
        const b = [...document.querySelectorAll('button[aria-expanded]')]
          .find(x => /RELAIS 4/i.test(x.innerText));
        return !b || b.getAttribute('aria-expanded') !== 'true';
      }, null, { timeout: 10000 }).catch(() => {});
  }
  // Replie pour de bon ? Sinon le remontage n'a pas eu lieu et le panneau
  // rendra les memes donnees qu'il y a deux minutes : on recharge alors.
  if ((await panneauOuvert(p)) === true) return revenirAuRelais(n);
  await dormir(400);
  if (await ouvrirRelais(p)) return true;
  return revenirAuRelais(n);
}

/** Le filet : on repart de la page, quand le panneau ne suffit plus. */
async function revenirAuRelais(n) {
  const p = tel[n].page;
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await dormir(1600);
  if (!await reveiller(p)) return false;
  return ouvrirRelais(p);
}

/** Taper le temoin, depuis la page (le bouton ecoute `pointerdown`). */
const taperTemoin = (page, quoi) => page.evaluate(mot => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.innerText.toUpperCase().includes(mot) && !x.disabled);
  if (!b) return false;
  const ev = t => b.dispatchEvent(new PointerEvent(t,
    { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown'); ev('pointerup');
  return true;
}, quoi);

const dire = async (n, page, ou) => {
  const t = (await page.innerText('body')).replace(/\s+/g, ' ');
  console.log(`   [${ou}] ${n} : ${t.slice(0, 500)}`);
};

try {
  // ------------------------------------------------------------ l'equipe
  //
  // LE VESTIAIRE SE MONTE PAR L'API, LA COURSE SE JOUE DANS LE JEU.
  //
  // Monter l'equipe en cliquant demandait une quinzaine de gestes — remplir
  // quatre champs, rafraichir trois panneaux, accepter trois invitations,
  // fixer l'ordre — et sur cette machine (charge 100, Android Studio et deux
  // serveurs de dev) l'un d'eux rate a chaque passage. Ce n'est pas ce qu'on
  // teste : ce qu'on teste, c'est LA TRANSMISSION DU TEMOIN, et elle se joue
  // entierement dans les quatre navigateurs.
  //
  // Ces trois routes sont exactement celles que les boutons appellent
  // (`/relay/team`, `/relay/answer`, `/relay/order` — voir RelaisPanel.tsx) :
  // meme code serveur, meme base, meme resultat. L'equipe est donc complete
  // AVANT que les telephones n'ouvrent leur panneau, et chacun y trouve du
  // premier coup le bouton « ENTRER SUR LA PISTE ».
  const poster = async (route, corps) => {
    const r = await fetch(`${API}${route}`, {
      method: 'POST',
      headers: { ...entete, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    return r.json();
  };

  const cree = await poster('/relay/team',
    { name: EQUIPE, creator: NOMS[0], members: NOMS.slice(1) });
  if (cree.error) throw new Error(`equipe refusee : ${cree.error}`);
  const ID = cree.equipe.id;
  /** L'etat de la salle de course : qui y est, et ou il en est. */
  const salle = async () => (await fetch(`${API}/relay/room/${ID}/etat`, { headers: entete })).json();
  for (const n of NOMS.slice(1)) {
    const r = await poster('/relay/answer', { id: ID, name: n, accept: true });
    if (r.error) throw new Error(`${n} n'a pas pu accepter : ${r.error}`);
  }
  const ordonne = await poster('/relay/order',
    { id: ID, order: NOMS.map(n => n.toLowerCase()) });
  if (ordonne.error) throw new Error(`ordre refuse : ${ordonne.error}`);

  const etat = await dedans();
  console.log(`   equipe ${ID} : ${etat.n}/4 ·`, JSON.stringify(etat.etats));
  if (etat.n < 4) throw new Error(`equipe restee a ${etat.n}/4`);

  /* ENTRER EST REESSAYABLE.
     Sous charge, n'importe laquelle des trois etapes — la porte, l'accueil,
     le panneau — rate au hasard sur l'un des quatre telephones. Rallonger les
     delais ne suffit pas : ce n'est pas un manque de temps, c'est un appui
     perdu. On repart donc d'un contexte neuf plutot que de tomber. */
  for (const n of NOMS) {
    for (let essai = 1; essai <= 3; essai++) {
      try { tel[n] = await entrer(n, FILME === 'tous' || n === FILME); break; }
      catch (err) {
        console.log(`   ${n} : essai ${essai} — ${String(err.message).slice(0, 80)}`);
        if (tel[n]) { await tel[n].ctx.close().catch(() => {}); delete tel[n]; }
        if (essai === 3) throw err;
        await dormir(1500);
      }
    }
    console.log(`   ${n} est entre`);
  }

  // -------------------------------------------------------- sur la piste
  /* SUR LA PISTE — ET ON DEMANDE A LA SALLE, PAS A L'ECRAN.
     Le bouton « JE SUIS PRÊT » est DESACTIVE tant que les quatre ne sont pas
     dans la salle. Si un seul telephone rate son entree, les trois autres
     voient un bouton gris, le harnais lit « aucun », et il croit que le
     vestiaire n'existe pas — alors qu'il attend simplement le quatrieme. */
  for (let tour = 1; tour <= 4; tour++) {
    const v = await salle().catch(() => ({}));
    const surLaPiste = new Set((v.joueurs || []).map(j => j.relais));
    if (surLaPiste.size >= 4) { console.log('   les quatre sont sur la piste'); break; }
    if (tour > 1) console.log(`   piste : ${surLaPiste.size}/4 — tour ${tour}`);
    for (let rang = 1; rang <= 4; rang++) {
      if (surLaPiste.has(rang)) continue;
      const n = NOMS[rang - 1];
      const bouton = await tel[n].page
        .waitForSelector('button:has-text("ENTRER SUR LA PISTE")', { timeout: 20000 })
        .catch(() => null);
      if (!bouton) { console.log(`   ${n} : pas de bouton piste`); await rafraichirRelais(n); continue; }
      await appuyerSur(tel[n].page, 'button:has-text("ENTRER SUR LA PISTE")', { essais: 3 })
        .catch(() => console.log(`   ${n} : la piste refuse l'appui`));
    }
    await dormir(2500);
  }

  /* « JE SUIS PRÊT » existe deux fois dans la page — le vestiaire du relais
     et le salon du direct. On prend le DERNIER, celui de la couche posee
     par-dessus. */
  const direPret = (page) => page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')]
      .filter(b => /JE SUIS PR/i.test(b.innerText) && !b.disabled);
    const b = bs[bs.length - 1];
    if (!b) return 'aucun';
    const ev = t => b.dispatchEvent(new PointerEvent(t,
      { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown'); ev('pointerup'); b.click();
    return 'pret';
  });
  for (const n of NOMS) {
    /* LE VESTIAIRE MET UN TEMPS A SE MONTER. Un `dormir(2500)` suffisait
       machine au repos ; sous charge, les quatre ecrans repondaient encore
       « aucun » — aucun bouton « JE SUIS PRÊT » — et le harnais attendait
       ensuite un pistolet qui ne pouvait pas partir. On attend donc le
       bouton lui-meme. */
    await tel[n].page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some(b => /JE SUIS PR/i.test(b.innerText) && !b.disabled),
      null, { timeout: 40000 }).catch(() => {});
    console.log(`   ${n} : ${await direPret(tel[n].page)}`);
  }

  // ------------------------------------------------------------ la course
  /* LE PISTOLET SE LIT DANS LE MOTEUR, PAS DANS LA SALLE.
     La salle annonce une date, mais `dessinerLeDepart()` borne la sequence du
     starter a [3 s, 10 s] : quand la salle tire un depart court, le client
     l'ETIRE et son pistolet tombe APRES celui du serveur. Partir sur
     `depart_a` etait donc partir avant le coup — faux depart du premier
     relayeur, equipe entiere eliminee. `countT` monte jusqu'a 3, et 3 EST le
     coup de pistolet. */
  const v0 = await salle().catch(() => ({}));
  if (v0.depart_a) console.log(`   salle : pistolet dans ${Math.round(v0.depart_a - v0.horloge)} ms`);
  await tel[NOMS[0]].page.waitForFunction(() => {
    const G = window.SprinterApp && window.SprinterApp.G;
    return !!G && (G.state === 'race' || G.countT >= 3);
  }, null, { timeout: 45000, polling: 'raf' });
  console.log('   PISTOLET');

  const TOUCHES = { ArrowLeft: { code: 'ArrowLeft', key: 'ArrowLeft', vk: 37 },
                    ArrowRight: { code: 'ArrowRight', key: 'ArrowRight', vk: 39 } };
  async function cadencer(page, ctrl, { cadence = 10.2, jitter = 0.06 } = {}) {
    const cdp = await page.context().newCDPSession(page);
    const pas = 1000 / cadence;
    let touche = 'ArrowLeft', prochain = Date.now();
    while (ctrl.court) {
      if (ctrl.actif) {
        const k = TOUCHES[touche];
        await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown',
          windowsVirtualKeyCode: k.vk, code: k.code, key: k.key }).catch(() => {});
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp',
          windowsVirtualKeyCode: k.vk, code: k.code, key: k.key }).catch(() => {});
        touche = touche === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      }
      prochain += pas * (1 + (Math.random() - 0.5) * 2 * jitter);
      const a = prochain - Date.now();
      if (a > 0) await dormir(a); else prochain = Date.now();
    }
    await cdp.detach().catch(() => {});
  }

  const ctrl = {}, fils = [];
  for (let r = 1; r <= 4; r++) {
    ctrl[r] = { court: true, actif: false };
    fils.push(cadencer(tel[NOMS[r - 1]].page, ctrl[r]).catch(() => {}));
  }
  await dormir(150);           // une reaction humaine : sous 100 ms, faux depart
  ctrl[1].actif = true;

  /* LA REGLE DU TEMOIN (worker/src/relais-course.js). Le relayeur k part de
     (k−1) × 100 m et sa zone fait trente metres. Au moment de la passe, LE
     DONNEUR ET LE RECEVEUR doivent y etre tous les deux ; le receveur qui
     depasse le bout de sa zone sans le temoin elimine l'equipe. On pilote
     donc sur l'etat du serveur, qui donne la position des quatre — l'ecran du
     donneur, lui, ne dit rien de celle du receveur. */
  const LEG = 100, ZONE = 30;
  const journal = [];
  let porteurVu = 1, elimine = null, total = null;
  const vues = {};   // une seule serie d'images par transmission
  let dernierDit = 0; const depart0 = Date.now();
  /* LA FENETRE DE COURSE SE COMPTE EN TEMPS REEL, ET LE JEU PEUT RAMER.
     Soixante-quinze secondes suffisent a un relais joue a vitesse normale —
     il en dure quarante. Mais sur une machine chargee, le moteur tourne au
     ralenti : la premiere transmission a demande 51,8 s de temps reel pour
     119 m, et la fenetre s'est refermee avant les deux autres. Le film
     montrait alors une seule passe sur trois, ce qui ressemble a une regle
     defaillante alors que c'est le harnais qui a raccroche. */
  const finCourse = Date.now() + Number(process.env.FENETRE_MS || 300000);

  while (Date.now() < finCourse) {
    const v = await salle().catch(() => null);
    if (!v) { await dormir(100); continue; }
    const d = Object.fromEntries((v.joueurs || []).map(j => [j.relais, j.d]));
    const porteur = v.porteur || 1;

    if (porteur !== porteurVu) {
      porteurVu = porteur;
      const p = (v.passes || [])[(v.passes || []).length - 1];
      if (p) {
        journal.push(p);
        console.log(`   PASSE ${v.passes.length} : relais ${p.de} → ${p.vers} a ${p.a} m ` +
                    `· dans la zone ${p.dans_zone} m · CONTACT ${p.bras} m ` +
                    `· ecart ${p.ecart} ms · note ${p.note}/2`);
      }
    }
    if (v.elimine) { elimine = v.elimine; break; }
    if (v.total != null) { total = v.total; break; }

    // Le film de la course, en chiffres : sans lui, un relais qui n'avance
    // plus ne dit pas QUI s'est arrete ni ou.
    if (Date.now() - dernierDit > 4000) {
      dernierDit = Date.now();
      console.log(`   t+${((Date.now() - depart0) / 1000).toFixed(0)}s porteur ${porteur} · ` +
        [1, 2, 3, 4].map(r => `${r}:${(d[r] ?? 0).toFixed(1)}`).join(' ') +
        ` · actifs ${[1,2,3,4].filter(r => ctrl[r].actif).join(',') || '—'}`);
    }

    for (let r = 1; r <= 4; r++) ctrl[r].actif = (r === porteur);

    if (porteur < 4) {
      const rec = porteur + 1;
      const zD = (rec - 1) * LEG, zF = zD + ZONE;
      const dP = d[porteur] ?? 0, dR = d[rec] ?? zD;
      const dansZone = dR - zD;
      // La distance entre les DEUX CORPS. C'est elle que le serveur arbitre
      // depuis qu'une transmission exige un contact : deux coureurs chacun
      // dans la zone mais a vingt metres l'un de l'autre ne se passent plus
      // rien (`PORTEE`, worker/src/relais-course.js).
      // L'ECART, COMPTE DANS LE BON SENS : le receveur commence DEVANT son
      // porteur — a sa marque, cent metres plus loin — et c'est le porteur
      // qui le rattrape. Compte a l'envers, la garde « ne prends pas trop
      // d'avance » empechait le receveur de partir : il etait deja a quatorze
      // metres devant au moment ou on lui demandait de s'elancer, donc il ne
      // s'elancait jamais, et le porteur filait au-dela de la zone — equipe
      // eliminee pour « le temoin a depasse la zone », sans qu'aucune tape
      // n'ait eu lieu.
      const ecart = dR - dP;         // positif : le receveur est devant

      // Il part DIX metres avant, pas quatorze : le porteur arrive a dix
      // metres par seconde, le receveur demarre a l'arret. Trop tot, il prend
      // une avance que le porteur ne rattrape plus avant le bout de la zone.
      // Et il coupe sa cadence a vingt metres dans la zone : au-dela il en
      // sortirait sans le temoin, ce qui elimine l'equipe.
      /* IL PART SIX METRES AVANT, PAS DIX.
         Le donneur est desormais retenu au bout de sa zone : s'il arrive au
         mur pendant que le receveur s'est arrete trois metres devant, les
         deux restent plantes et la course ne finit jamais — c'est ce qui a
         rendu un passage a 0/3. Le receveur part donc plus tard, ce qui
         laisse le porteur le rejoindre bien avant le bout. */
      /* IL PART DIX-SEPT METRES AVANT SA MARQUE.
         Six ne suffisent pas : le porteur arrive a dix metres par seconde,
         le receveur demarre a l'arret. Parti trop tard, il se fait doubler
         avant d'avoir pris sa vitesse, puis court derriere un porteur retenu
         au bout de sa zone — et sort de la sienne sans le temoin, ce qui
         elimine l'equipe. */
      const lance = dP >= zD - 17;
      /* Et s'il s'est quand meme laisse depasser, il va le CHERCHER jusqu'au
         bord de sa zone : vingt-neuf metres, un metre avant l'elimination
         pour sortie sans le temoin. */
      ctrl[rec].actif = lance && (dansZone < 18 || (ecart < 0 && dansZone < 29));

      /* L'APPROCHE, EN IMAGES.
         La video du jeu demande quatre encodeurs en parallele, ce que cette
         machine ne tient pas ; une capture d'ecran, si. On tire donc la
         transmission depuis LES DEUX telephones — c'est la preuve que les
         deux coureurs sont bien cote a cote, et c'est ce qu'on veut voir. */
      if (false && !vues[rec] && Math.abs(ecart) <= 7) {
        vues[rec] = true;
        await Promise.all([
          tel[NOMS[porteur - 1]].page.screenshot({ path: `${SORTIE}/passe${porteur}-a-approche-donneur.png` }).catch(() => {}),
          tel[NOMS[rec - 1]].page.screenshot({ path: `${SORTIE}/passe${porteur}-b-approche-receveur.png` }).catch(() => {}),
        ]);
      }

      // LA PASSE, AU CONTACT — la regle nouvelle. Sous un metre et demi, les
      // deux corps sont cote a cote et le temoin passe de main en main.
      /* La condition est celle du SERVEUR, et rien de plus : les deux dans
         la zone, et a portee de bras. Le garde « le receveur a deja fait un
         demi-metre » que j'avais ajoute bloquait le cas le plus frequent —
         le porteur rejoint un receveur encore a l'arret sur sa marque, donc
         a zero metre dans la zone, et la transmission etait refusee par le
         harnais alors que le jeu l'acceptait. */
      const tousDeuxDansLaZone = dP >= zD && dP <= zF && dR >= zD && dR <= zF;
      if (tousDeuxDansLaZone && Math.abs(ecart) <= 2.0) {
        await Promise.all([
          tel[NOMS[porteur - 1]].page.screenshot({ path: `${SORTIE}/passe${porteur}-c-contact-donneur.png` }).catch(() => {}),
          tel[NOMS[rec - 1]].page.screenshot({ path: `${SORTIE}/passe${porteur}-d-contact-receveur.png` }).catch(() => {}),
        ]);
        const [donne, prend] = await Promise.all([
          taperTemoin(tel[NOMS[porteur - 1]].page, 'DONNE'),
          taperTemoin(tel[NOMS[rec - 1]].page, 'PRENDS'),
        ]);
        /* Le bouton n'est arme qu'au contact depuis la nouvelle regle. S'il
           reste gris alors que le serveur voit les deux a portee, c'est
           l'ECRAN qui se trompe, et il faut le savoir plutot que de taper
           dans le vide jusqu'a l'elimination. */
        if (!donne || !prend) {
          console.log(`   tape refusee a ${dP.toFixed(1)}/${dR.toFixed(1)} ` +
            `(ecart ${ecart.toFixed(1)} m)${donne ? '' : ' · DONNE gris'}${prend ? '' : ' · PRENDS gris'}`);
        }
        await dormir(250);
        await tel[NOMS[rec - 1]].page
          .screenshot({ path: `${SORTIE}/passe${porteur}-e-apres-receveur.png` }).catch(() => {});
        continue;
      }
    }
    await dormir(60);
  }
  for (let r = 1; r <= 4; r++) ctrl[r].court = false;
  await Promise.all(fils);

  const dernier = await salle().catch(() => ({}));
  const passes = (dernier.passes || []).length;
  elimine = dernier.elimine || elimine;
  total = dernier.total ?? total;
  console.log(`   ARRIVEE · passes ${passes}/3` +
    (total != null ? ` · TOTAL ${(total / 1000).toFixed(2)} s` : '') +
    (elimine ? ` · ELIMINE : ${elimine.raison} (relais ${elimine.relais})` : ''));

  // ------------------------------------------------- le film, tel que le jeu l'a tourne
  await dormir(3500);          // le temps que `arreterLeFilm` publie le dernier morceau
  for (const n of (FILME === 'tous' ? NOMS : [FILME])) {
    const p = tel[n].page;
    const info = await p.evaluate(() => ({
      morceaux: (window.__morceaux || []).length,
      octets: (window.__morceaux || []).reduce((s, m) => s + m.size, 0),
      type: window.__type || '', fini: !!window.__filmFini,
      diag: window.__diag,
      canvas: !!(window.SprinterApp && window.SprinterApp.G && window.SprinterApp.G.cv),
      formats: (() => {
        const l = ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs=avc1',
                   'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
        try { return l.filter(f => window.MediaRecorder.isTypeSupported(f)); }
        catch (e) { return ['erreur ' + String(e).slice(0, 60)]; }
      })(),
    }));
    console.log(`   film ${n} : ${info.morceaux} morceaux · ${(info.octets / 1e6).toFixed(1)} Mo · ${info.type || '—'}${info.fini ? ' · arrete' : ''}`);
    if (!info.octets) console.log(`      diag : canvas=${info.canvas} · ${JSON.stringify(info.diag)} · formats=${JSON.stringify(info.formats)}`);
    if (!info.octets) continue;

    // On sort le fichier par tranches : une chaine base64 de vingt megaoctets
    // d'un seul tenant traverse mal le pont CDP.
    const TRANCHE = 3_000_000;
    const morceaux = [];
    for (let de = 0; de < info.octets; de += TRANCHE) {
      const part = await p.evaluate(async ([de, n]) => {
        const blob = new Blob(window.__morceaux, { type: window.__type || 'video/mp4' });
        const buf = await blob.slice(de, de + n).arrayBuffer();
        const u8 = new Uint8Array(buf);
        let s = ''; const CH = 0x8000;
        for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
        return btoa(s);
      }, [de, TRANCHE]);
      morceaux.push(Buffer.from(part, 'base64'));
    }
    const ext = info.type.includes('mp4') ? 'mp4' : 'webm';
    const chemin = `${SORTIE}/relais-4x100-${SUF}-${n}.${ext}`;
    writeFileSync(chemin, Buffer.concat(morceaux));
    console.log(`   → ${chemin}`);
  }

  writeFileSync(`${SORTIE}/faits.json`, JSON.stringify({
    canal: 'test', equipe: EQUIPE, id: ID, suffixe: SUF, joueurs: NOMS, appareils: APP,
    passes, total, elimine, journal, salleFinale: dernier,
  }, null, 1));
} finally {
  await b.close().catch(() => {});
}
