/**
 * Les cartons : titres, legendes et signature, en PNG a fond transparent.
 *
 * Pourquoi un navigateur plutot que `drawtext` : la charte demande une
 * « typographie display grasse en capitales tres espacees, chiffres a chasse
 * fixe ». `drawtext` ne sait pas espacer les lettres, ne sait pas melanger
 * deux fontes dans une ligne, et ne sait pas poser un liseré. Le navigateur
 * sait tout cela, et il tient DEJA la vraie fonte du jeu — Outfit — puisque
 * c'est celle que le jeu charge. Les cartons sortent donc dans la meme
 * typographie que l'ecran qu'ils commentent, ce qu'aucun reglage de ffmpeg
 * n'aurait donne.
 *
 * Le fond est transparent : un carton se POSE sur le plan, il ne le remplace
 * pas. Seule la signature de fin est pleine.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const OR = '#F8CD4A';
export const NUIT = '#060913';

const GABARIT = (corps, plein) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;background:${plein ? NUIT : 'transparent'};
            font-family:'Outfit',sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
  .cadre{position:absolute;inset:0;display:flex;flex-direction:column;
         align-items:center;justify-content:center;padding:0 88px}

  /* L'accroche : ce qui doit faire rester deux secondes de plus. Une ligne
     par idee, jamais plus de deux, et le chiffre — quand il y en a un —
     seul sur sa ligne : la charte le veut avant l'adjectif. */
  .accroche{font-weight:900;font-size:132px;line-height:0.94;letter-spacing:-0.02em;
            text-transform:uppercase;text-align:center;
            text-shadow:0 12px 60px rgba(0,0,0,.85)}
  .accroche .or{color:${OR}}
  .accroche .fin{display:block;color:${OR}}

  /* La legende de mouvement : trois a cinq mots, en bas, sur une plaque
     sombre — sans plaque, un texte blanc sur une piste claire disparait. */
  .legende{position:absolute;left:0;right:0;display:flex;justify-content:center;padding:0 60px}
  .legende span{display:inline-block;background:rgba(6,9,19,.86);
                border:2px solid rgba(248,205,74,.5);border-radius:22px;
                padding:26px 40px;font-weight:800;font-size:62px;line-height:1.02;
                letter-spacing:0.08em;text-transform:uppercase;text-align:center;
                box-shadow:0 18px 60px rgba(0,0,0,.6)}
  .legende .or{color:${OR}}
  .legende .mono{font-family:'Space Mono',monospace;font-weight:700;letter-spacing:0}

  /* Le chiffre qui porte le plan. Il ne commente pas, il constate. */
  .chiffre{position:absolute;left:0;right:0;text-align:center}
  .chiffre b{font-family:'Space Mono',monospace;font-weight:700;font-size:190px;
             color:${OR};letter-spacing:-0.02em;
             text-shadow:0 0 70px rgba(248,205,74,.45),0 14px 50px rgba(0,0,0,.9);display:block}
  .chiffre i{font-style:normal;font-weight:800;font-size:46px;letter-spacing:0.22em;
             text-transform:uppercase;color:#fff;opacity:.92;
             text-shadow:0 6px 30px rgba(0,0,0,.9)}

  /* La fleche du classement : le seul ornement du lot, parce que c'est le
     geste que le reel raconte. */
  .fleche{position:absolute;left:0;right:0;text-align:center;color:#34d399;
          font-weight:900;font-size:150px;line-height:1;
          text-shadow:0 0 60px rgba(52,211,153,.5)}

  /* La signature. Elle ne demande rien : elle constate qu'une place est
     libre — charte §1.4. */
  .sign{display:flex;flex-direction:column;align-items:center;gap:34px;text-align:center}
  .sign .marque{font-weight:900;font-size:150px;letter-spacing:0.12em;color:${OR};
                text-shadow:0 0 80px rgba(248,205,74,.35)}
  .sign .phrase{font-weight:800;font-size:60px;line-height:1.18;letter-spacing:0.02em;
                text-transform:uppercase;max-width:880px}
  .sign .adresse{font-family:'Space Mono',monospace;font-weight:700;font-size:44px;
                 letter-spacing:0.1em;color:#fff;opacity:.75;margin-top:12px}
  .filet{width:220px;height:6px;background:${OR};border-radius:3px}
</style></head><body>${corps}</body></html>`;

/** Un carton, rendu une fois, ecrit en PNG. */
export async function rendre(cartons, dossier) {
  mkdirSync(dossier, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await b.newContext({
    viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1,
  })).newPage();
  const faits = [];
  for (const c of cartons) {
    await page.setContent(GABARIT(c.html, !!c.plein), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(180);
    const chemin = join(dossier, `${c.nom}.png`);
    await page.screenshot({ path: chemin, omitBackground: !c.plein });
    faits.push(chemin);
  }
  await b.close();
  return faits;
}

/* ------------------------------------------------------------- raccourcis */
export const accroche = (nom, html) =>
  ({ nom, html: `<div class="cadre"><div class="accroche">${html}</div></div>` });

export const legende = (nom, html, y = 1430) =>
  ({ nom, html: `<div class="legende" style="top:${y}px"><span>${html}</span></div>` });

export const chiffre = (nom, gros, dessous, y = 700) =>
  ({ nom, html: `<div class="chiffre" style="top:${y}px"><b>${gros}</b><i>${dessous}</i></div>` });

export const fleche = (nom, html, y = 640) =>
  ({ nom, html: `<div class="fleche" style="top:${y}px">${html}</div>` });

export const signature = (nom, phrase) =>
  ({ nom, plein: true, html: `<div class="cadre"><div class="sign">
       <div class="marque">SPRINTER</div><div class="filet"></div>
       <div class="phrase">${phrase}</div>
       <div class="adresse">sprinter-game.com</div></div></div>` });
