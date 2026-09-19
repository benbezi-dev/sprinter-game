// LE CLASSEMENT DES NATIONS — la guerre des drapeaux
//
// Ce tableau est fait pour etre POSTE. C'est ce qui le rend different des
// autres classements du jeu : une erreur ici ne se corrige pas d'un
// rafraichissement, elle part dans un fil et y reste. Tout ce fichier tient
// aux cinq facons de lui faire raconter le contraire de ce qu'il mesure.
//
//   1. CLASSER AU RECORD ET NON A LA MEDIANE. Un seul joueur rapide placerait
//      son pays premier, et le tableau raconterait l'histoire d'un individu
//      sous un drapeau. C'est le piege principal, et il est sournois : la
//      version au record marche, elle est meme plus simple, elle ne se plaint
//      jamais. Elle raconte juste autre chose.
//   2. LAISSER LA QUEUE PESER. Un grand pays a des centaines de joueurs, dont
//      beaucoup de lents. Sans la coupe aux cinquante meilleurs, la PROFONDEUR
//      deviendrait un HANDICAP — exactement l'inverse de ce qu'on veut
//      recompenser — et la France serait derriere Nauru pour avoir plus de
//      joueurs.
//   3. COMPTER LES APPAREILS. Quelqu'un qui joue sur un telephone et une
//      tablette pese deux fois dans la mediane de son pays.
//   4. FAIRE PARAITRE UN PAYS DE DEUX JOUEURS. Sa « mediane » est un chrono
//      individuel deguise en statistique nationale.
//   5. SORTIR UN NOM. La charte interdit de publier le pseudonyme de quelqu'un
//      sans son accord, capture de classement comprise (§5.4), et c'est
//      l'erreur n° 5 du plan de lancement. Un tableau fait pour etre poste ne
//      doit contenir aucun nom, meme par accident, meme dans un champ que
//      personne n'affiche.
//
// ON PEUPLE LA BASE PAR WRANGLER, JAMAIS PAR UNE ROUTE. Une route d'essai est
// une porte de plus a tenir fermee en production ; le harnais n'existe que sur
// cette machine. Et on range derriere soi : les lignes posees portent toutes
// une marque, et on les retire a la fin.
//
// LES PAYS DU BANC D'ESSAI SONT MINUSCULES — Nauru, Tuvalu, Palau, Kiribati,
// les iles Marshall. Aucun d'eux n'a de joueur dans une base de developpement,
// ce qui laisse au test un tableau dont il connait chaque ligne. Le harnais le
// verifie avant de commencer plutot que de le supposer : si l'un d'eux est
// occupe, il le dit et on en change.
//
//     cd worker && npx wrangler dev --local --port 8788
//     node tools/nations-test.mjs

import { execFileSync } from 'node:child_process';
import { lundiDe, MIN_JOUEURS, TOP_PAR_PAYS } from '../worker/src/nations.js';
import { nomZone, listeNations } from '../worker/src/championnats.js';

const B = process.env.BASE || 'http://127.0.0.1:8788';

/**
 * Lire, en supportant que le serveur se recharge sous nos pieds.
 *
 * `wrangler d1 execute --local` ecrit dans le meme dossier d'etat que
 * `wrangler dev`, qui le surveille et redemarre. La requete qui tombe pile
 * pendant ce redemarrage se fait couper — « other side closed » — et le test
 * entier s'arretait la, sur un defaut du harnais et non du code. On reessaie,
 * plutot que de piquer une attente fixe apres chaque ecriture : le rechargement
 * dure ce qu'il dure, et une attente trop courte revient au meme defaut en
 * moins reproductible.
 */
async function lire(u, essais = 6) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(B + u);
      return { statut: r.status, texte: await r.text() };
    } catch (err) {
      if (i >= essais) return { statut: 0, texte: JSON.stringify({ error: String(err.message || err) }) };
      await new Promise(r => setTimeout(r, 400));
    }
  }
}
const json = async u => { const r = await lire(u); try { return JSON.parse(r.texte); } catch { return {}; } };

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const sql = commande => execFileSync('npx',
  ['wrangler', 'd1', 'execute', 'sprinter-leaderboard', '--local', '--json', '--command', commande],
  { cwd: 'worker', maxBuffer: 32 * 1024 * 1024 }).toString();

const M = 'nt' + Math.random().toString(36).slice(2, 7);
const PRODIGE = 'NR', PROFOND = 'TV', PETIT = 'PW', QUEUE = 'KI', DOUBLE = 'MH';
const BANC = [PRODIGE, PROFOND, PETIT, QUEUE, DOUBLE];

/**
 * Le nom d'un joueur du banc, EN MINUSCULES.
 *
 * `player_pays` se joint a `lower(trim(scores.name))` : une cle posee avec un
 * code de pays en capitales ne rejoint rien, et le tableau sort vide sans que
 * personne ne se plaigne. C'est le harnais qui s'est fait avoir en premier.
 */
const joueur = (pays, prefixe, i) => `${M}-${pays.toLowerCase()}${prefixe}-${i}`;

/** Les lignes SQL d'un pays : un joueur par chrono, tous marques. */
function peupler(pays, chronos, prefixe = '') {
  const t = Date.now();
  const scores = chronos.map((ms, i) =>
    `('d-${joueur(pays, prefixe, i)}','100','${joueur(pays, prefixe, i)}',${ms},${t},${ms})`);
  const drapeaux = chronos.map((_, i) =>
    `('${joueur(pays, prefixe, i)}','${pays}','OC','essai',${t})`);
  return `INSERT INTO scores (device_id,race_key,name,time_ms,updated_at,best_split_ms)
            VALUES ${scores.join(',')};
          INSERT OR REPLACE INTO player_pays (name_key,pays,continent,source,vu_le)
            VALUES ${drapeaux.join(',')};`;
}

function ranger() {
  sql(`DELETE FROM scores WHERE name LIKE '${M}-%';
       DELETE FROM player_pays WHERE name_key LIKE '${M}-%';
       DELETE FROM nations_semaine WHERE pays IN ('${BANC.join("','")}');`);
}

const suite = t => (t.classement || []).find(l => l.pays === PROFOND);
const ligne = (t, p) => (t.classement || []).find(l => l.pays === p) || null;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE CLASSEMENT DES NATIONS — la profondeur, pas le prodige   ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/* --------------------------------------------------------- le banc est-il libre ? */
{
  const t0 = await json('/nations');
  if (t0.error) {
    console.log(`\n   Le serveur ne repond pas : ${t0.error}`);
    console.log('   (cd worker && npx wrangler dev --local --port 8788)\n');
    process.exit(1);
  }
  const occupes = BANC.filter(p => ligne(t0, p));
  if (occupes.length) {
    console.log(`\n   Le banc d'essai est occupe : ${occupes.join(', ')} ont deja des joueurs.`);
    console.log('   Choisis d autres codes de pays en haut de ce fichier.\n');
    process.exit(1);
  }
}

ranger();

titre('LA MEDIANE, ET NON LE RECORD');
{
  // Nauru tient LE chrono le plus rapide du banc et quatre joueurs lents
  // derriere. Tuvalu n'a aucun exploit et cinq joueurs reguliers. Un
  // classement au record mettrait Nauru premier ; un classement a la mediane
  // dit la verite : Tuvalu court plus vite, collectivement.
  sql(peupler(PRODIGE, [8500, 11000, 11100, 11200, 11300]) +
      peupler(PROFOND, [10000, 10100, 10200, 10300, 10400]));

  const t = await json('/nations');
  const pr = ligne(t, PRODIGE), pf = ligne(t, PROFOND);
  ok('les deux pays paraissent', !!pr && !!pf);
  ok('la mediane du prodige est celle du 3e', pr && pr.median === 11100, pr && String(pr.median));
  ok('celle du pays profond aussi', pf && pf.median === 10200, pf && String(pf.median));
  ok('le pays profond passe devant', pr && pf && pf.rang < pr.rang,
     pr && pf && `${pf.rang} contre ${pr.rang}`);
  // Le record reste LISIBLE — il a sa place sur la carte — mais il ne classe
  // pas. Les deux chiffres dans la meme ligne, c'est ce qui rend le tableau
  // discutable, donc partageable.
  ok('le record du pays reste donne', pr && pr.meilleur === 8500, pr && String(pr.meilleur));
  ok('et il ne classe pas', pr && pr.meilleur < (pf && pf.meilleur));
  ok('l ecart a la tete est pose', pf && typeof pf.ecart === 'number' && pf.ecart >= 0);
}

titre('LA PROFONDEUR N EST PAS UN HANDICAP');
{
  // Cinquante joueurs rapides, puis cinq trainards. Sans la coupe aux
  // cinquante meilleurs, ces cinq-la feraient glisser la mediane vers le bas
  // du tableau — et un pays serait puni d'avoir des joueurs.
  const rapides = Array.from({ length: TOP_PAR_PAYS }, (_, i) => 9000 + i);
  sql(peupler(QUEUE, rapides));
  const avant = ligne(await json('/nations'), QUEUE);
  ok('le pays plein paraît', !!avant, 'aucune ligne');
  ok(`il compte ses ${TOP_PAR_PAYS} meilleurs`, avant && avant.joueurs === TOP_PAR_PAYS,
     avant && String(avant.joueurs));

  sql(peupler(QUEUE, [30000, 30100, 30200, 30300, 30400], 'q'));
  const apres = ligne(await json('/nations'), QUEUE);
  ok('cinq trainards de plus ne bougent pas la mediane',
     avant && apres && apres.median === avant.median,
     avant && apres && `${avant.median} puis ${apres.median}`);
  ok('ni le nombre de joueurs comptes',
     apres && apres.joueurs === TOP_PAR_PAYS, apres && String(apres.joueurs));
  ok('ni le rang', avant && apres && apres.rang === avant.rang);
}

titre('UN JOUEUR, PAS UN APPAREIL');
{
  // Le meme nom sur deux appareils, avec deux chronos. Le classement mondial
  // compte ce joueur une fois ; la mediane de son pays doit faire pareil,
  // sinon quelqu'un qui possede une tablette pese double pour son drapeau.
  const t = Date.now();
  const noms = [0, 1, 2, 3, 4].map(i => joueur(DOUBLE, '', i));
  sql(`INSERT INTO scores (device_id,race_key,name,time_ms,updated_at,best_split_ms)
         VALUES ${noms.map((n, i) => `('d-${n}-a','100','${n}',${10000 + i * 100},${t},${10000 + i * 100})`).join(',')},
                ('d-${noms[0]}-b','100','${noms[0]}',9000,${t},9000);
       INSERT OR REPLACE INTO player_pays (name_key,pays,continent,source,vu_le)
         VALUES ${noms.map(n => `('${n}','${DOUBLE}','OC','essai',${t})`).join(',')};`);

  const l = ligne(await json('/nations'), DOUBLE);
  ok('le pays a cinq joueurs, pas six', l && l.joueurs === 5, l && String(l.joueurs));
  // Ses deux chronos comptent pour le meilleur des deux : 9000 et non 10000.
  ok('c est son meilleur chrono qui compte', l && l.meilleur === 9000, l && String(l.meilleur));
  // Les cinq chronos retenus : 9000, 10100, 10200, 10300, 10400 → mediane 10200.
  ok('la mediane suit', l && l.median === 10200, l && String(l.median));
}

titre('UN PAYS DE QUATRE NE PARAIT PAS');
{
  sql(peupler(PETIT, [9500, 9600, 9700, 9800]));
  const t = await json('/nations');
  ok(`sous ${MIN_JOUEURS} joueurs, pas de ligne`, !ligne(t, PETIT));

  /* MAIS ON LUI DIT COMBIEN IL LUI MANQUE. Un joueur qui ouvre l'ecran et n'y
     trouve pas son drapeau en conclut que le tableau ne le concerne pas. Lui
     ecrire « il manque un joueur » est exactement le message qui fait envoyer
     un code — c'est le tableau qui devient un levier de recrutement. */
  const seul = await json(`/nations?pays=${PETIT}`);
  ok('mais il a sa ligne « moi »', !!seul.moi);
  ok('avec son effectif', seul.moi && seul.moi.joueurs === 4, seul.moi && String(seul.moi.joueurs));
  ok('et ce qui lui manque', seul.moi && seul.moi.manque === MIN_JOUEURS - 4,
     seul.moi && String(seul.moi.manque));
  ok('sans rang, puisqu il n est pas classe', seul.moi && seul.moi.rang === null);
  /* UN PAYS QUE LE SERVEUR NE SAIT PAS NOMMER GARDE SON CODE, et c'est
     volontaire. Cloudflare donne le code de n'importe quel pays ; la table des
     noms n'en porte qu'une partie. L'alternative — ne classer que les pays
     nommes — ecarterait des joueurs reels sans rien dire, ce qui est pire
     qu'une ligne « PW ». Et le drapeau, lui, se dessine a partir du code seul :
     la carte reste lisible en attendant qu'on ajoute le nom.

     C'est d'ailleurs ce classement qui a fait remarquer que la Jamaique
     manquait a la table. */
  ok('un pays que le serveur ne nomme pas garde son code', seul.moi && seul.moi.nom === PETIT,
     seul.moi && seul.moi.nom);

  const dedans = await json(`/nations?pays=${PROFOND}`);
  ok('un pays classe a son rang dans « moi »', dedans.moi && dedans.moi.rang > 0,
     dedans.moi && String(dedans.moi.rang));
  ok('et rien ne lui manque', dedans.moi && dedans.moi.manque === 0);
}

titre('LES NATIONS D ATHLETISME SONT NOMMEES');
{
  /* LA GUERRE DES DRAPEAUX SE JOUE ENTRE PAYS QU'ON PEUT CITER. Une carte qui
     affiche « JM · 9,84 » a cote de « France · 10,20 » n'est pas une carte
     qu'on poste — et la Jamaique est justement le pays que ce format cite en
     premier. Ces noms-la ne sont pas decoratifs : ils sont la condition pour
     que le chantier serve a quelque chose. */
  const attendus = {
    JM: 'Jamaïque', ET: 'Éthiopie', TT: 'Trinité-et-Tobago', CU: 'Cuba',
    GH: 'Ghana', KE: 'Kenya', US: 'États-Unis', ZA: 'Afrique du Sud',
  };
  for (const [code, nom] of Object.entries(attendus)) {
    ok(`${code} se dit « ${nom} »`, nomZone(code, 'national').nom === nom,
       nomZone(code, 'national').nom);
  }
  // La preposition sert au titre d'un championnat — « Champion de Jamaique ».
  // Un nom ajoute sans elle donnerait « Champion de le Ghana ».
  const sansPreposition = listeNations().filter(n => {
    const z = nomZone(n.code, 'national');
    return !z.avec || z.avec === 'de ' + n.code;
  });
  ok('chaque nation a sa preposition', sansPreposition.length === 0,
     sansPreposition.map(n => n.code).join(','));
  // Et son nom anglais, sans quoi un joueur anglophone lit un titre francais
  // au milieu d'une interface traduite.
  const sansAnglais = listeNations().filter(n => !nomZone(n.code, 'national').nomEn);
  ok('et son nom anglais', sansAnglais.length === 0, sansAnglais.map(n => n.code).join(','));
  ok('le tableau des nations en compte plus de soixante', listeNations().length >= 60,
     String(listeNations().length));
}

titre('LE MOUVEMENT SE COMPTE SUR LUNDI DERNIER');
{
  // La fleche EST la nouvelle. « La France est 7e » ne se poste qu'une fois ;
  // « la France passe 7e, +2 » se poste chaque semaine. On la compare donc a
  // la semaine figee d'avant, jamais a celle d'aujourd'hui — sans quoi le
  // tableau se comparerait a lui-meme et toutes les fleches vaudraient zero.
  const t0 = await json('/nations');
  const pf = ligne(t0, PROFOND);
  ok('sans semaine figee, pas de fleche inventee', pf && pf.mouvement === null,
     pf && String(pf.mouvement));

  const passee = lundiDe(Date.now() - 7 * 24 * 3600 * 1000);
  sql(`INSERT OR REPLACE INTO nations_semaine
         (semaine,epreuve,pays,median,joueurs,rang,fige_le)
       VALUES ('${passee}','100','${PROFOND}',10900,5,${pf.rang + 3},${Date.now()});`);

  const t1 = await json('/nations');
  const apres = ligne(t1, PROFOND);
  ok('la semaine comparee est bien lundi dernier', t1.precedente === passee,
     `${t1.precedente} contre ${passee}`);
  ok('le rang d avant est retrouve', apres && apres.rangPrecedent === pf.rang + 3);
  // On remonte en BAISSANT de rang : la fleche doit etre positive quand on
  // gagne des places, pas quand la soustraction est positive.
  ok('monter de trois places fait +3', apres && apres.mouvement === 3,
     apres && String(apres.mouvement));
  ok('la mediane d avant suit aussi', apres && apres.medianPrecedent === 10900);
}

titre('PAS UN SEUL NOM NE SORT');
{
  // La regle est une regle de publication, pas de presentation : un nom dans
  // un champ que personne n'affiche aujourd'hui est un nom qu'on postera un
  // jour sans y penser. On relit donc le corps brut, pas les champs connus.
  const r = await lire('/nations?pays=' + PROFOND);
  ok('le corps ne contient aucun nom de joueur', !r.texte.includes(M),
     r.texte.slice(0, 120));
  const t = await json('/nations');
  const champs = new Set();
  for (const l of t.classement || []) for (const k of Object.keys(l)) champs.add(k);
  ok('aucun champ ne s appelle name', !champs.has('name') && !champs.has('nom_joueur'),
     [...champs].join(','));
}

titre('LA SEMAINE COMMENCE UN LUNDI');
{
  // Une date de lundi et non un numero de semaine ISO : les semaines 52, 53 et
  // 1 se chevauchent selon l'annee, et une cle qui se repete ou qui saute fait
  // disparaitre une comparaison sans que rien ne le dise.
  ok('samedi appartient a son lundi', lundiDe(Date.parse('2026-09-19T12:00:00Z')) === '2026-09-14');
  ok('dimanche aussi — la semaine finit dimanche soir',
     lundiDe(Date.parse('2026-09-20T23:59:59Z')) === '2026-09-14');
  ok('lundi ouvre la suivante', lundiDe(Date.parse('2026-09-21T00:00:00Z')) === '2026-09-21');
  ok('lundi a minuit pile est a lui-meme', lundiDe(Date.parse('2026-09-14T00:00:00Z')) === '2026-09-14');
  // Le 1er janvier 2027 est un vendredi : sa semaine a commence en 2026.
  ok('une semaine a cheval sur deux annees tient',
     lundiDe(Date.parse('2027-01-01T12:00:00Z')) === '2026-12-28');
}

ranger();
console.log(e ? `\n✗ ${e} essai(s) en echec\n` : '\n✓ tout passe\n');
process.exit(e ? 1 : 0);
