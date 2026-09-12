// Socle de capture : un telephone simule, une camera qui ecrit des images.
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export const URL_JEU = process.env.URL_JEU || 'http://localhost:5174/';
export const L = 1080, H = 1920;          // le cadre livre
export const PTS_L = 405, PTS_H = 720;    // les points de l'appareil simule
export const DSF = L / PTS_L;             // 2.6667

/** Le navigateur, une fois pour toutes. */
export async function navigateur() {
  return chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'],
  });
}

/**
 * Un telephone : un contexte isole, avec son identite propre. `nom` et
 * `device` separent les localStorage — deux joueurs ne peuvent pas partager un
 * device_id sans que le serveur les prenne pour le meme appareil.
 *
 * `langue` vaut 'fr' ou 'en'. Elle etait cablee sur le francais, ce qui
 * suffisait tant qu'on ne livrait que des reels francais ; une version
 * anglaise a besoin des DEUX portes, et pas d'une seule : `sprinter_web_v1`
 * porte le choix explicite du joueur, et `locale` decide de ce que
 * `N.detect()` repondrait s'il n'y en avait pas. Les poser toutes les deux
 * evite qu'un jour de bascule du stockage rende une capture a moitie traduite.
 * Le fuseau suit la langue : une capture anglaise qui afficherait des heures
 * de Paris se contredirait a l'ecran.
 */
export async function telephone(b, { nom = null, device = null, bienvenue = false,
                                     langue = 'fr' } = {}) {
  const en = langue === 'en';
  const ctx = await b.newContext({
    viewport: { width: PTS_L, height: PTS_H },
    deviceScaleFactor: DSF,
    isMobile: true, hasTouch: true,
    locale: en ? 'en-GB' : 'fr-FR',
    timezoneId: en ? 'Europe/London' : 'Europe/Paris',
    permissions: [], colorScheme: 'dark',
  });
  await ctx.addInitScript(([nom, device, bienvenue, langue]) => {
    try {
      localStorage.setItem('sprinter_web_v1', JSON.stringify({ lang: langue }));
      if (device) localStorage.setItem('sprinter_device_id', device);
      if (nom) localStorage.setItem('sprinter_player_name', nom);
      // Les didacticiels une fois vus ne reviennent pas s'asseoir devant la camera.
      localStorage.setItem('sprinter_tuto_vu', '1');
      localStorage.setItem('sprinter_tour_vu', '1');
      if (!bienvenue) localStorage.setItem('sprinter_bienvenue_vue', '1');
    } catch (e) {}
  }, [nom, device, bienvenue, langue]);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  ! page:', String(e).slice(0, 160)));

  const cdp = await ctx.newCDPSession(p);
  return { ctx, page: p, cdp };
}

/**
 * La camera.
 *
 * Ni `recordVideo`, ni `Page.startScreencast`, et chacun pour une raison
 * mesuree ici :
 *
 *   · `recordVideo` rend des WebM SANS INDEX DE RECHERCHE. Dans un
 *     navigateur, `video.currentTime = 32` ne fait rien, `seeked` arrive avec
 *     la video a zero, et le montage affiche l'ecran-titre en croyant filmer
 *     la course. Deux montages faux sont partis comme ca en septembre.
 *   · `Page.startScreencast` rend les images a la taille CSS de l'appareil
 *     simule — 405 x 720 — et ignore le facteur d'echelle. Un 405 de large
 *     agrandi a 1080 est mou, et la livraison demande 1080 x 1920 vrais.
 *
 * Reste `Page.captureScreenshot`, mais pas n'importe comment : lui passer un
 * `clip` qui porte l'echelle rend bien une image de 1080 x 1920 — et le jeu
 * n'y occupe que le tiers superieur gauche, dessine a la resolution CSS dans
 * un cadre trois fois trop grand. L'erreur ne se voit pas sur la taille du
 * fichier, seulement en ouvrant l'image ; elle a coute un montage entier.
 *
 * Ce qui marche : REPOSER l'emulation d'appareil sur la session CDP
 * (`Emulation.setDeviceMetricsOverride`), puis capturer SANS clip. Le
 * compositeur rend alors la page a 2,667x et l'image sort pleine, en
 * 1080 x 1920 vrais, a une vingtaine d'images par seconde.
 *
 * Les images sont numerotees et ecrites a cadence FIXE : la derniere image
 * recue est posee a chaque battement. C'est ce qui donne au montage une duree
 * exacte, la ou un flux a debit variable en donne une approximative.
 */
export class Camera {
  constructor(page, dossier, ips = 30, cdp = null) {
    this.page = page; this.dossier = dossier; this.ips = ips; this.cdpPose = cdp;
    this.n = 0; this.derniere = null; this.marques = []; this.tourne = false;
    this.largeurAttendue = L;
  }
  async demarrer() {
    // UN RUSH FINI NE S'EFFACE PAS, IL SE RANGE DE COTE.
    //
    // Cette ligne effacait le dossier, et elle a coute le rush du
    // 6 septembre 2026 : relancer f5 pour changer les noms des joueurs a
    // supprime 1 444 images qui ne se refont pas a l'identique — les reels
    // livres qui en sortaient ne peuvent plus etre remontes, seulement
    // rejoues. Un dossier qui porte un `marques.json` est un rush TERMINE ; on
    // le deplace donc, et c'est a un humain de decider de le jeter.
    //
    // Les dossiers sans `marques.json` sont des captures interrompues : ceux-la
    // s'effacent, sans quoi chaque essai rate laisserait un tas derriere lui.
    if (existsSync(join(this.dossier, 'marques.json'))) {
      const quand = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      renameSync(this.dossier, `${this.dossier}.remplace-${quand}`);
      console.log(`    · rush precedent range : ${this.dossier}.remplace-${quand}`);
    } else {
      rmSync(this.dossier, { recursive: true, force: true });
    }
    mkdirSync(this.dossier, { recursive: true });
    // La session est celle posee par `telephone()` : en ouvrir une seconde
    // pour y reposer l'emulation remettrait la page a l'ecran-titre.
    this.cdp = this.cdpPose || await this.page.context().newCDPSession(this.page);
    const opt = { format: 'jpeg', quality: 82, optimizeForSpeed: true,
                  fromSurface: true, captureBeyondViewport: false };
    this.tourne = true;
    // Deux demandes en vol : une seule plafonne a 21 images par seconde, deux
    // montent a 40 — la marge qui garantit qu'a chaque battement de l'horloge
    // il existe une image FRAICHE, et non la precedente reecrite.
    this.relancer = () => [0, 1].map(async () => {
      while (this.tourne) {
        try { this.derniere = (await this.cdp.send('Page.captureScreenshot', opt)).data; }
        catch (e) { if (this.tourne) await dormir(60); }
        await dormir(8);
      }
    });
    this.fils = this.relancer();
    this.horloge = setInterval(() => {
      if (!this.derniere) return;
      writeFileSync(join(this.dossier, `f${String(this.n).padStart(6, '0')}.jpg`),
                    Buffer.from(this.derniere, 'base64'));
      this.n++;
    }, 1000 / this.ips);
  }
  /** L'image k occupe-t-elle bien tout le cadre ? */
  async pleine(k) {
    try {
      const { execFileSync } = await import('node:child_process');
      const f = join(this.dossier, `f${String(k).padStart(6, '0')}.jpg`);
      const r = execFileSync('python3', ['-c',
        `from PIL import Image
im = Image.open(${JSON.stringify(f)}).convert('L'); w, h = im.size; px = im.load()
print(max((x for x in range(0, w, 10) for y in range(0, h, 40) if px[x, y] > 18), default=0))`],
        { encoding: 'utf8' });
      return Number(r.trim()) > this.largeurAttendue * 0.75;
    } catch (e) { return true; }
  }

  /**
   * Se taire le temps d'un appui, puis reprendre.
   *
   * `Page.captureScreenshot` en boucle et les evenements de POINTEUR ne
   * cohabitent pas : mesure faite, un appui sur un bouton est perdu a
   * n'importe quelle cadence de capture — 37 images par seconde comme 11 —
   * alors que les evenements de CLAVIER, eux, passent sans faute (une course
   * courue camera allumee rend le meme chrono qu'a l'arret). C'est donc au
   * pointeur seul qu'il faut ceder la place.
   *
   * L'horloge, elle, continue d'ecrire : le film garde la derniere image
   * pendant les deux ou trois dixiemes que dure l'appui. Une immobilite de
   * six images au moment ou un panneau s'ouvre ne se voit pas ; une capture
   * qui s'arrete, si.
   */
  async suspendre() {
    if (!this.tourne) return;
    this.tourne = false;
    await Promise.all(this.fils).catch(() => {});
  }
  reprendre() {
    if (this.tourne || !this.relancer) return;
    this.tourne = true;
    this.fils = this.relancer();
  }

  /** Note l'instant present sous un nom : le montage y coupera. */
  marque(nom) {
    this.marques.push({ nom, image: this.n, t: +(this.n / this.ips).toFixed(2) });
    console.log(`    · ${nom} @ ${(this.n / this.ips).toFixed(2)} s`);
    return this.n / this.ips;
  }
  async arreter() {
    clearInterval(this.horloge);
    this.tourne = false;
    // Une demande de capture peut rester en l'air quand quatre contextes
    // tournent en meme temps : on n'attend pas les fils indefiniment, sinon le
    // harnais se fige APRES avoir tout filme et n'ecrit jamais ses reperes.
    await Promise.race([
      Promise.all(this.fils).catch(() => {}),
      dormir(5000),
    ]);
    // On ne detache pas : la session porte l'emulation d'appareil, et la
    // rendre couperait le cadre du telephone pour la suite du scenario.
    // CONTROLE. `page.screenshot()` de Playwright repose sa propre emulation
    // d'appareil et efface la notre : toutes les images prises APRES un seul
    // appel reviennent au tiers superieur gauche, a la resolution CSS, dans
    // un cadre de 1080 x 1920. La taille du fichier ne bouge pas, rien
    // n'echoue — et un rush entier part a la poubelle sans qu'on le sache.
    // D'ou cette verification, et d'ou la regle : PENDANT une capture, aucune
    // capture d'ecran Playwright. Les vues fixes se tirent du rush apres coup.
    const abime = this.n > 60 && !(await this.pleine(this.n - 30));
    if (abime) console.log('    ⚠  RUSH ABIME : les dernieres images ne sont ' +
      'pas pleines. Un `page.screenshot()` a du passer pendant la capture.');
    writeFileSync(join(this.dossier, 'marques.json'),
      JSON.stringify({ ips: this.ips, images: this.n,
                       duree: +(this.n / this.ips).toFixed(2), marques: this.marques }, null, 2));
    console.log(`    ${this.n} images · ${(this.n / this.ips).toFixed(1)} s → ${this.dossier}`);
    return this.marques;
  }
}

/** Attendre un texte a l'ecran (insensible a la casse et aux accents). */
export async function attendre(page, texte, ms = 15000) {
  await page.waitForFunction(
    (t) => document.body.innerText.toLowerCase()
             .normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t),
    texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    { timeout: ms });
}

/**
 * Appuyer.
 *
 * L'appui part DE LA PAGE (`element.click()`), pas du pointeur du navigateur.
 * Ce n'est pas un raccourci, c'est la seule chose qui marche pendant que la
 * camera tourne : mesure faite, un `tap()` ou un `click()` de Playwright est
 * perdu des que `Page.captureScreenshot` boucle — a 37 images par seconde
 * comme a 11, et meme en arretant la capture le temps de l'appui. Les
 * evenements de CLAVIER, eux, passent sans faute : une course courue camera
 * allumee rend le meme chrono qu'a l'arret. C'est donc le pointeur seul qui
 * ne cohabite pas, et le contourner coute une chose sans importance ici — le
 * bouton ne s'allume pas sous le doigt.
 *
 * Deux autres precautions, chacune payee une fois :
 *   · ON NE VISE QUE DU VISIBLE. Le jeu garde l'ecran-titre en place pendant
 *     que l'accueil se monte : le meme libelle existe alors deux fois, et
 *     `.first()` tombe sur celui qui n'est plus a l'ecran.
 *   · ON VERIFIE, ET ON RECOMMENCE. `attendu` est le selecteur qui doit
 *     apparaitre ; sans lui on ne saurait pas qu'un appui s'est perdu.
 */
async function frapper(cible) {
  await cible.waitFor({ state: 'visible', timeout: 8000 });
  await cible.evaluate(el => {
    const b = el.closest('button,a,[role="button"]') || el;
    // Un `click()` seul ne suffit pas partout : le bouton du temoin, au
    // relais, ecoute `onPointerDown` — il faut que la passe parte au moment
    // du contact, pas au relachement, et c'est aussi ce qu'attend le jeu du
    // doigt. On envoie donc la sequence entiere.
    const ev = t => b.dispatchEvent(new PointerEvent(t,
      { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown'); ev('pointerup');
    b.click();
  });
}

export async function appuyer(page, texte, { exact = false, attendu = null, essais = 4 } = {}) {
  for (let i = 0; i < essais; i++) {
    try { await frapper(page.getByText(texte, { exact }).locator('visible=true').first()); }
    catch (e) { await dormir(600); continue; }
    if (!attendu) return true;
    try { await page.waitForSelector(attendu, { timeout: 5000 }); return true; }
    catch (e) { await dormir(500); }
  }
  throw new Error(`appui sans effet : « ${texte} »`);
}

/** Le meme service, pour un selecteur precis. */
export async function appuyerSur(page, selecteur, { attendu = null, essais = 4 } = {}) {
  for (let i = 0; i < essais; i++) {
    try {
      const cible = page.locator(selecteur).first();
      await cible.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await frapper(cible);
    } catch (e) { await dormir(600); continue; }
    if (!attendu) return true;
    try { await page.waitForSelector(attendu, { timeout: 5000 }); return true; }
    catch (e) { await dormir(500); }
  }
  throw new Error(`appui sans effet : ${selecteur}`);
}

/**
 * Ouvrir un panneau repliable — mais seulement s'il est ferme.
 *
 * Les panneaux du mode DEFI s'ouvrent tout seuls quand ils ont quelque chose
 * a dire : une invitation de relais recue ouvre le panneau du relais. Taper
 * dessus sans regarder le REFERME, et le harnais cherche ensuite une
 * invitation qu'il vient lui-meme de cacher.
 */
export async function ouvrirPanneau(page, titre, marqueur) {
  const dedans = async () => (await page.innerText('body')).includes(marqueur);
  if (await dedans()) return true;
  await appuyer(page, titre);
  await dormir(1200);
  if (await dedans()) return true;
  // Ferme au lieu d'ouvrir : on retape une fois.
  await appuyer(page, titre);
  await dormir(1200);
  return dedans();
}

/** Attendre qu'un ecran soit vraiment monte avant d'agir dessus. */
export async function attendreEcran(page, texte, ms = 20000) {
  await attendre(page, texte, ms);
  await dormir(400);
}

export const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Pose l'emulation d'appareil sur la session CDP du telephone.
 *
 * Elle doit etre posee, sinon `Page.captureScreenshot` rend le jeu a la
 * resolution CSS dans un cadre trois fois trop grand — l'image fait bien
 * 1080 x 1920, et le jeu n'occupe que le tiers superieur gauche. L'erreur ne
 * se voit pas sur la taille du fichier, seulement en ouvrant l'image.
 *
 * Elle doit etre posee APRES la premiere navigation, parce que Playwright
 * repose sa propre emulation en chargeant la page et effacerait la notre.
 * Et elle doit etre posee AVANT le premier geste, parce qu'elle remet
 * l'affichage a zero : appelee sur une page ou l'on vient d'ouvrir un
 * classement, elle le referme — le harnais cherche alors un bouton qui n'est
 * plus la, et la capture est perdue sans qu'aucune erreur ne le dise.
 *
 * Donc : goto, puis ceci, puis le scenario.
 */
export async function cadrer(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: PTS_L, height: PTS_H, deviceScaleFactor: DSF, mobile: true });
  await dormir(500);
}
