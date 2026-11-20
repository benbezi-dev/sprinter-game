// LE TEXTE DES VIDEOS DE LA MASCOTTE (reel-mascotte-duo.mjs, story-mascotte.mjs) : une image PNG
// transparente, blanche (ou de la couleur demandee), grasse, contour noir, centree, coupee en
// lignes de 18 caracteres au plus. Dessinee par sharp : ffmpeg de ce Mac n'a pas drawtext.
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(path.join(path.dirname(new URL(import.meta.url).pathname), '../package.json'));
const sharp = req('sharp');
const echapper = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export async function texte(fichier, txt, taille, couleur = '#FFFFFF', largeur = 1000) {
  // (combien de caracteres tiennent dans la largeur : une capitale d'Arial Black fait ~0,66 de sa taille ;
  //  18 fixes debordaient a 96 px, « QUI ME BAT SUR 100 M ? » sortait de l'image)
  const max = Math.max(6, Math.floor((largeur - 40) / (taille * 0.66)));
  // (« ?! » ne part jamais seul a la ligne : espace insecable devant la ponctuation haute)
  const mots = txt.replace(/ ([?!:;»])/g, ' $1').split(' '), lignes = [''];
  for (const m of mots) {
    const l = lignes[lignes.length - 1];
    if ((l + ' ' + m).trim().length > max && l) lignes.push(m); else lignes[lignes.length - 1] = (l + ' ' + m).trim();
  }
  const h = Math.round(lignes.length * taille * 1.15 + 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${h}">${lignes.map((l, i) =>
    `<text x="${largeur / 2}" y="${taille * (1 + i * 1.15)}" font-family="Arial Black, Arial" font-weight="900" font-size="${taille}" fill="${couleur}" stroke="#000" stroke-width="${taille / 9}" paint-order="stroke" text-anchor="middle">${echapper(l)}</text>`).join('')}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fichier);
  return h;   // (la hauteur de l'image : pour poser la ligne suivante dessous)
}

/** Une image fixe d'un rush, floutee et assombrie : le fond d'une story. */
export async function fondFlou(source, fichier) {
  await sharp(source).resize(1080, 1920, { fit: 'cover' }).blur(18).modulate({ brightness: 0.55 }).png().toFile(fichier);
}
