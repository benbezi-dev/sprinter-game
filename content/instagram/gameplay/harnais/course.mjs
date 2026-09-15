// Courir pour de vrai. Trois choses que le harnais du 5 septembre n'avait pas,
// et sans lesquelles le coureur n'atteint jamais une vraie cadence :
//
//   1. LE DEPART. On attend le coup de pistolet — la disparition du decompte —
//      et on repart 130 ms plus tard. REACT_BEST vaut 0,12 s et le plancher
//      legal 0,10 : sous 100 ms c'est un faux depart, au-dessus de 320 ms le
//      bonus est nul.
//   2. LA MONTEE EN FREQUENCE. La note de transition compare les MEDIANES des
//      deux moities de la poussee (0 → 15 m). Un ratio >= 1,20 vaut la note
//      parfaite, a condition que la seconde moitie descende sous 125 ms.
//      On part donc a 145 ms et on descend a 100 ms.
//   3. L'ALTERNANCE STRICTE. Deux fois la meme touche = risque de chute.
import { dormir } from './base.mjs';

const CODES = {
  ArrowLeft:  { code: 'ArrowLeft',  key: 'ArrowLeft',  vk: 37 },
  ArrowRight: { code: 'ArrowRight', key: 'ArrowRight', vk: 39 },
};

async function appui(cdp, t) {
  const k = CODES[t];
  await cdp.send('Input.dispatchKeyEvent',
    { type: 'rawKeyDown', windowsVirtualKeyCode: k.vk, code: k.code, key: k.key });
  await cdp.send('Input.dispatchKeyEvent',
    { type: 'keyUp', windowsVirtualKeyCode: k.vk, code: k.code, key: k.key });
}

/**
 * Attendre le coup de pistolet.
 *
 * En DEUX temps, et le premier n'est pas facultatif : on attend d'abord que le
 * decompte APPARAISSE, et seulement ensuite qu'il disparaisse. Guetter
 * directement sa disparition rend la main dans la milliseconde qui suit
 * l'appui — le decompte n'est pas encore affiche, donc « absent » — et le
 * coureur part avant le signal. Le jeu appelle cela un faux depart, et il a
 * raison.
 */
export async function attendrePistolet(page, ms = 25000) {
  // Deux decomptes possibles. Le canal de test ecrit la commande en toutes
  // lettres (« À VOS MARQUES », « PRÊTS ») ; le jeu publie ne montre plus que
  // le chiffre dans son cercle (RaceHUD.tsx, « LE DECOMPTE, ET RIEN QUE LUI »).
  // Guetter le seul texte faisait attendre le jeu publie pour rien : le coureur
  // ne partait jamais. On reconnait donc aussi le voile du decompte lui-meme.
  const decompte = () => {
    const t = document.body.innerText.toUpperCase();
    if (t.includes('VOS MARQUES') || t.includes('PRÊTS') || t.includes('PRETS')) return true;
    return [...document.querySelectorAll('div')].some(d =>
      typeof d.className === 'string' && d.className.includes('backdrop-blur-[2px]')
      && d.className.includes('z-20') && d.querySelector('.rounded-full.border-4'));
  };
  await page.waitForFunction(decompte, null, { timeout: ms, polling: 16 });
  await page.waitForFunction(`!(${decompte.toString()})()`, null, { timeout: ms, polling: 16 });
}

/**
 * Une course entiere, du pistolet a l'arrivee.
 *
 * `niveau` regle la qualite : 'fort' pour le coureur qu'on filme, 'moyen'
 * pour un adversaire qu'on veut battre de peu — une course gagnee de vingt
 * metres ne raconte rien.
 *
 * `relache` — { apres, pendant }, en millisecondes depuis le premier appui —
 * fait lever les doigts au coureur un instant, puis reprendre. C'est la faute
 * que met en scene le reel de l'arrivee serree (f6) : le jeu ralentit un
 * coureur qui n'appuie plus, et c'est tout ce qu'on lui demande. `quand`
 * recoit deux rappels facultatifs, `depart` et `relache`, pour que la camera
 * marque ces instants au lieu qu'on les devine au montage.
 */
export async function courir(page, { niveau = 'fort', duree = 13000, reaction = 130,
                                     relache = null, quand = {} } = {}) {
  const P = {
    fort:  { depart: 145, poussee: 98,  train: 91,  jitter: 0.05 },
    bon:    { depart: 150, poussee: 105, train: 100, jitter: 0.07 },
    solide: { depart: 158, poussee: 113, train: 109, jitter: 0.08 },
    moyen: { depart: 165, poussee: 122, train: 118, jitter: 0.10 },
    lent:  { depart: 190, poussee: 150, train: 152, jitter: 0.14 },
  }[niveau];

  const cdp = await page.context().newCDPSession(page);
  await attendrePistolet(page);
  if (quand.depart) quand.depart();
  await dormir(reaction);

  const t0 = Date.now(), fin = t0 + duree;
  let touche = 'ArrowLeft', prochain = Date.now(), i = 0, relachee = false;
  const MONTEE = 14;                      // les appuis de la poussee
  while (Date.now() < fin) {
    if (relache && !relachee && Date.now() - t0 >= relache.apres) {
      relachee = true;
      if (quand.relache) quand.relache();
      if (relache.tant) {
        // Relachement PILOTE : on ne reprend que lorsque `tant()` repond non
        // — en pratique, quand le panneau d'ecart du jeu est descendu a un
        // seuil. `pendant` n'est alors qu'un plafond.
        const fin = Date.now() + (relache.pendant || 1500);
        while (Date.now() < fin && await relache.tant()) await dormir(12);
      } else {
        await dormir(relache.pendant);
      }
      prochain = Date.now();
    }
    await appui(cdp, touche);
    touche = touche === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    // Pendant la poussee l'ecart se resserre ; ensuite il tient.
    const a = Math.min(1, i / MONTEE);
    const base = i < MONTEE ? P.depart + (P.poussee - P.depart) * a : P.train;
    i++;
    prochain += base * (1 + (Math.random() - 0.5) * 2 * P.jitter);
    const attente = prochain - Date.now();
    if (attente > 0) await dormir(attente); else prochain = Date.now();
  }
  await cdp.detach().catch(() => {});
}


/**
 * Taper, sans attendre de pistolet.
 *
 * Au relais, les quatre coureurs tapent en continu pendant toute la course :
 * le jeu n'ecoute que celui dont c'est le tour, et le receveur DOIT courir
 * dans sa zone de lancement — un temoin pris a l'arret coute plus d'une
 * seconde a l'equipe.
 */
export async function taper(page, { cadence = 10.2, duree = 40000, jitter = 0.06 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const pas = 1000 / cadence;
  const fin = Date.now() + duree;
  let touche = 'ArrowLeft', prochain = Date.now();
  while (Date.now() < fin) {
    await appui(cdp, touche);
    touche = touche === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    prochain += pas * (1 + (Math.random() - 0.5) * 2 * jitter);
    const attente = prochain - Date.now();
    if (attente > 0) await dormir(attente); else prochain = Date.now();
  }
  await cdp.detach().catch(() => {});
}
