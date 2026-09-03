// De quoi remplir une grille de depart, en local, pour pouvoir enfin regarder
// un championnat courir.
//
// Les deux harnais de championnat convoquent des joueurs deja classes et n'en
// creent aucun. Sur la base de test locale il y en avait UN — d'ou le
// « pays trop petit » qui a fait croire pendant des semaines a une panne alors
// que c'etait une base vide. Ce script est la piece qui manquait entre les
// deux : il fabrique une population plausible, avec des noms lisibles et des
// niveaux etales, et il ne touche QUE la base de test locale.
//
//   node tools/championnat-peupler.mjs                   peuple
//   node tools/championnat-peupler.mjs --vider-editions  rejoue le meme weekend
//   node tools/championnat-peupler.mjs --effacer         retire ce qu'il a pose
//
// Tout ce qu'il pose est marque `source = 'harnais'` dans `player_pays`, ce qui
// rend le retrait exact : aucun joueur reel ne peut etre pris dans l'effacement.
//
// Ce marqueur remplace un prefixe sur la cle, essaye d'abord et faux : la cle
// d'un joueur n'est pas libre, c'est son nom en minuscules. Avec des cles
// inventees le championnat courait tres bien cote serveur, mais l'ecran du jeu
// — qui cherche « mon championnat » par le nom du joueur — ne trouvait jamais
// rien, et la fonctionnalite paraissait morte alors qu'elle tournait.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const WORKER = join(RACINE, 'worker');
const BASE = 'sprinter-leaderboard-test';
const MARQUE = 'harnais';

// Huit pays sur trois continents, et ce n'est pas decoratif : un continental
// exige deux champions nationaux (MIN_DOFFICE), un mondial deux champions
// continentaux. Trois continents a deux pays au moins, c'est le plus petit
// monde ou le cycle entier — national, continental, mondial — a le droit
// d'exister. Avec un seul pays par continent, le cycle s'arrete au national et
// on croit que le moteur refuse.
//
// Les six premiers ne sont pas choisis au hasard non plus : FR, DE, ES, MA, SN
// et CI sont exactement ceux que `championnat-cycle-test.mjs` verifie nommement
// (« les six pays semes ouvrent leur championnat »). Ce harnais-la a ete ecrit
// pour un peuplement qui n'existait pas encore ; en changer un seul le fait
// echouer sur un monde pourtant valide. US et CA s'ajoutent pour qu'un
// troisieme continent ouvre lui aussi.
const PAYS = [
  { code: 'FR', continent: 'EU', prenoms: ['Léo','Hugo','Jules','Adam','Louis','Raphaël','Arthur','Gabriel','Nino','Sacha','Timéo','Ethan'],
                                  noms: ['Marchand','Lefèvre','Bonnet','Girard','Fournier','Mercier','Dupuis','Lambert','Rousseau','Blanchard','Perrin','Chevalier'] },
  { code: 'ES', continent: 'EU', prenoms: ['Álvaro','Mateo','Hugo','Pablo','Diego','Iker','Bruno','Marco','Nico','Adrián','Javier','Rubén'],
                                  noms: ['García','Fernández','Moreno','Navarro','Iglesias','Ortega','Serrano','Ramos','Vidal','Castro','Peña','Cortés'] },
  { code: 'DE', continent: 'EU', prenoms: ['Jonas','Lukas','Finn','Noah','Elias','Paul','Felix','Moritz','Jannik','Tim','Luis','Erik'],
                                  noms: ['Müller','Schneider','Fischer','Weber','Wagner','Becker','Hoffmann','Schäfer','Koch','Richter','Klein','Wolf'] },
  { code: 'US', continent: 'AM', prenoms: ['Jayden','Marcus','Tyler','Isaiah','Devin','Trey','Malik','Cole','Brandon','Elijah','Xavier','Jordan'],
                                  noms: ['Carter','Brooks','Hayes','Coleman','Bryant','Foster','Reeves','Sanders','Barnes','Ellis','Turner','Ward'] },
  { code: 'CA', continent: 'AM', prenoms: ['Liam','Owen','Félix','Nathan','Émile','Cody','Zachary','Olivier','Antoine','Xavier','Samuel','Thomas'],
                                  noms: ['Tremblay','Gagnon','Roy','Côté','Bergeron','Pelletier','Caron','Fortin','Lavoie','Bélanger','Poirier','Gauthier'] },
  { code: 'MA', continent: 'AF', prenoms: ['Youssef','Amine','Reda','Bilal','Mehdi','Anas','Ayoub','Zakaria','Ilyas','Othmane','Hamza','Nabil'],
                                  noms: ['Benali','El Amrani','Tazi','Bouazza','Chakir','Idrissi','Naciri','Berrada','Ouazzani','Sabri','Lahlou','Fassi'] },
  { code: 'CI', continent: 'AF', prenoms: ['Kouassi','Yao','Konan','Aboubacar','Serge','Franck','Didier','Arsène','Ismaël','Cédric','Brice','Wilfried'],
                                  noms: ['Koffi','Kouamé','Traoré','Bamba','Touré','Yapi','Gnahoré','Dosso','Konaté','Diomandé','Assamoi','Zadi'] },
  { code: 'SN', continent: 'AF', prenoms: ['Moussa','Ibrahima','Cheikh','Ousmane','Modou','Babacar','Alioune','Mamadou','Serigne','Pape','Lamine','Abdou'],
                                  noms: ['Diop','Ndiaye','Sarr','Faye','Gueye','Sow','Ba','Diallo','Sylla','Cissé','Thiam','Camara'] },
];

// 36 par pays plutot que 32 : au minimum exact, la grille prend tout le monde
// et la selection ne se voit pas. Quatre de trop suffisent pour que le
// classement des duels tranche vraiment, et que le dernier qualifie ait une
// raison d'y etre.
const PAR_PAYS = 36;

let graine = 7013;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const effacer = process.argv.includes('--effacer');
// Une edition ouverte bloque la suivante (« edition deja ouverte »), et un
// harnais interrompu en laisse une a mi-parcours. Pouvoir rejouer le meme
// weekend autant de fois qu'on veut est la condition pour repeter une
// repetition generale.
const vider = process.argv.includes('--vider-editions');
const echapper = s => String(s).replace(/'/g, "''");

const lignes = [];
if (vider) {
  for (const t of ['champ_resultats', 'champ_partants', 'champ_annonces',
                   'champ_medailles', 'champ_titres', 'champ_editions']) {
    lignes.push(`DELETE FROM ${t};`);
  }
  console.log('   Editions, resultats, titres et annonces remis a zero.');
}
if (effacer) {
  lignes.push(`DELETE FROM duel_players WHERE name_key IN (SELECT name_key FROM player_pays WHERE source = '${MARQUE}');`);
  lignes.push(`DELETE FROM player_pays  WHERE source = '${MARQUE}';`);
} else if (!vider) {
  const maintenant = Date.now();
  let n = 0;
  for (const p of PAYS) {
    for (let i = 0; i < PAR_PAYS; i++) {
      // Les 36 noms d'un pays doivent etre distincts, sinon le championnat
      // affiche trois « Leo G. » dans la meme serie et plus personne ne suit
      // sa course. Douze prenoms et douze noms donnent 144 combinaisons ; le
      // decalage d'un cran a chaque tour en prend 36 sans jamais repasser sur
      // la meme.
      const nom = `${p.prenoms[i % p.prenoms.length]} ${p.noms[(i + Math.floor(i / p.prenoms.length)) % p.noms.length]}`;

      // Le serveur derive la cle du nom : `cleanName(nom).trim().toLowerCase()`.
      // La recopier ici plutot que d'inventer une cle est ce qui permet au jeu
      // de reconnaitre le joueur.
      //
      // Elle s'echappe comme le nom, et pour la meme raison : aucun des noms
      // ci-dessus ne porte d'apostrophe aujourd'hui, mais « N'Diaye » ou
      // « M'Bappe » sont exactement le genre de nom qu'on ajoutera aux listes
      // senegalaise ou ivoirienne — et une apostrophe non echappee ne rend pas
      // une erreur lisible, elle coupe l'INSERT en deux instructions.
      const cle = nom.trim().toLowerCase();

      // Le MMR est ce qui seme la grille : plat, toutes les series se
      // ressemblent et le serpentin n'a rien a repartir. On etale donc de 950
      // a 1750, avec du bruit, pour que les tetes de serie veuillent dire
      // quelque chose et que les repechages soient disputes.
      const mmr = Math.round(1750 - (i / (PAR_PAYS - 1)) * 800 + (hasard() - 0.5) * 90);
      const duels = 3 + Math.floor(hasard() * 22);
      const wins = Math.round(duels * (0.25 + 0.5 * (1 - i / (PAR_PAYS - 1))));
      const losses = duels - wins;

      lignes.push(
        `INSERT OR REPLACE INTO duel_players (name_key, name, points, wins, losses, draws, launched, last_delta, updated_at, received, mmr, lp, palier, bouclier) ` +
        `VALUES ('${echapper(cle)}', '${echapper(nom)}', ${wins * 12}, ${wins}, ${losses}, 0, ${duels}, 0, ${maintenant - Math.floor(hasard() * 20 * 86400000)}, 0, ${mmr}, ${wins * 7 % 100}, ${Math.min(4, Math.floor(mmr / 400))}, 0);`);
      lignes.push(
        `INSERT OR REPLACE INTO player_pays (name_key, pays, continent, source, vu_le) ` +
        `VALUES ('${echapper(cle)}', '${p.code}', '${p.continent}', '${MARQUE}', ${maintenant});`);
      n++;
    }
  }
  console.log(`   ${n} joueurs sur ${PAYS.length} pays, ${PAR_PAYS} chacun.`);
}

const fichier = join(mkdtempSync(join(tmpdir(), 'champ-peupler-')), 'peupler.sql');
writeFileSync(fichier, lignes.join('\n'));

// `--local` n'est pas une option ici : ce script fabrique des joueurs qui
// n'existent pas, et la base distante porte de vrais classements.
execFileSync('npx', ['wrangler', 'd1', 'execute', BASE, '--local', '--file', fichier],
  { cwd: WORKER, stdio: ['ignore', 'ignore', 'inherit'] });

console.log(effacer
  ? `   Retire : tout ce que le harnais avait pose.`
  : `   Base de test locale prete. Courir :  node tools/championnat-france-test.mjs`);
