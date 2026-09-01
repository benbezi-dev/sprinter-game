// Retrouver son nom : le transfert et la recuperation, contre le vrai serveur.
//
// Ce qui se verifie ici ne se voit pas a l'ecran. Un jeton qui servirait deux
// fois relierait un inconnu ; une demande de recuperation qui relierait au
// moment ou l'administrateur tranche relierait le mauvais appareil ; un code
// colle dans le champ du nom reserverait le code comme un pseudo. Les trois
// sont arrives, ou ont failli.
//
//   npx wrangler dev --local --port 8788      (depuis worker/)
//   node tools/identite-test.mjs

const B = 'http://127.0.0.1:8788';
const CLE = 'cle-de-test-locale-uniquement';

const post = (u, b, h = {}) => fetch(B + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
  body: JSON.stringify(b || {}),
}).then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const get = (u, h = {}) => fetch(B + u, { headers: h })
  .then(async r => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));

const admin = { 'X-Sprinter-Admin': CLE };
let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

// Chaque execution part sur des noms neufs : la base locale survit d'un essai
// a l'autre, et un test qui ne passe que la premiere fois ne teste rien.
const marque = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const appareil = (s) => `dev-${marque}-${s}`;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  RETROUVER SON NOM                                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ------------------------------------------------------ un nom et son code
console.log('\n── LE NOM ───────────────────────────────────────────────────');
const NOM = `Testeur ${marque}`;
const tel1 = appareil('tel1');
const reserve = await post('/claim', { device_id: tel1, name: NOM });
ok('le nom se reserve', reserve.corps.ok === true, JSON.stringify(reserve.corps));
const CODE = reserve.corps.code;
ok('un code est rendu', /^[A-Z0-9]{6}$/.test(CODE || ''), String(CODE));

// ------------------------------------- le code colle dans le champ du nom
console.log('\n── LE CODE PRIS POUR UN NOM ─────────────────────────────────');
const telPerdu = appareil('perdu');
const colle = await post('/claim', { device_id: telPerdu, name: CODE });
ok('le code n est pas reserve comme un nom', colle.corps.est_un_code === true,
   JSON.stringify(colle.corps));
ok('le nom de son proprietaire est rendu', colle.corps.nom === NOM, String(colle.corps.nom));
const fantome = await post('/claim', { device_id: telPerdu, name: CODE });
ok('deux fois de suite, toujours refuse', fantome.corps.est_un_code === true);

// Un pseudo qui ressemble a un code reste un pseudo : on ne devine pas sur la
// forme, on regarde si la chaine EST un code en base.
const FORME_CODE = Array.from({ length: 6 },
  () => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 31)]).join('');
const sosie = await post('/claim', { device_id: appareil('sosie'), name: FORME_CODE });
ok('un pseudo en forme de code passe quand meme', sosie.corps.ok === true,
   JSON.stringify(sosie.corps));

// ------------------------------------------------------------- le transfert
console.log('\n── LE TRANSFERT ─────────────────────────────────────────────');
const inconnu = await post('/transfert/nouveau', { device_id: appareil('intrus'), name: NOM });
ok('un appareil etranger ne tire pas de jeton', inconnu.statut === 403, `HTTP ${inconnu.statut}`);

const jetonRep = await post('/transfert/nouveau', { device_id: tel1, name: NOM });
ok('l appareil relie tire un jeton', jetonRep.corps.ok === true, JSON.stringify(jetonRep.corps));
const JETON = jetonRep.corps.jeton;
ok('le jeton est court et lisible', /^[A-Z0-9]{8}$/.test(JETON || ''), String(JETON));
ok('le jeton perime en dix minutes',
   Math.abs(jetonRep.corps.vie_ms - 600000) < 1000, String(jetonRep.corps.vie_ms));

const tel2 = appareil('tel2');
const liaison = await post('/transfert/utiliser', { device_id: tel2, jeton: JETON });
ok('le second appareil est relie', liaison.corps.ok === true, JSON.stringify(liaison.corps));
ok('il recoit le nom', liaison.corps.name === NOM, String(liaison.corps.name));
ok('il recoit le code', liaison.corps.code === CODE, String(liaison.corps.code));

const rejoue = await post('/transfert/utiliser', { device_id: appareil('tel3'), jeton: JETON });
ok('le jeton ne sert pas deux fois', rejoue.corps.deja_utilise === true,
   JSON.stringify(rejoue.corps));

const bidon = await post('/transfert/utiliser', { device_id: appareil('tel4'), jeton: 'ZZZZZZZZ' });
ok('un jeton invente ne relie rien', bidon.corps.inconnu === true, JSON.stringify(bidon.corps));

// L'appareil relie par transfert peut a son tour en relier un autre : c'est ce
// qui rend le troisieme telephone possible sans ressortir le code.
const jeton2 = await post('/transfert/nouveau', { device_id: tel2, name: NOM });
ok('un appareil relie par transfert peut relier a son tour', jeton2.corps.ok === true);

// ----------------------------------------------------------- la recuperation
console.log('\n── LA RECUPERATION ──────────────────────────────────────────');

// Cas facile : l'appareil est encore relie, seul le code est perdu. Rien a
// arbitrer — on rend le code.
const direct = await post('/recuperation', { device_id: tel1, name: NOM });
ok('un appareil relie recupere son code tout seul', direct.corps.direct === true,
   JSON.stringify(direct.corps));
ok('et c est le bon code', direct.corps.code === CODE, String(direct.corps.code));

// Cas reel : plus rien. La demande entre dans la file.
const demande = await post('/recuperation', {
  device_id: telPerdu, name: NOM, indice: 'je jouais sur le telephone rouge',
});
ok('la demande est deposee', demande.corps.etat === 'attente', JSON.stringify(demande.corps));
ok('sans Instagram lie, pas de mot de passage', demande.corps.phrase == null,
   String(demande.corps.phrase));
const ID = demande.corps.id;

const encore = await post('/recuperation', { device_id: telPerdu, name: NOM });
ok('reappuyer ne remplit pas la file', encore.corps.id === ID && encore.corps.deja === true,
   JSON.stringify(encore.corps));

const attente = await get(`/recuperation?device_id=${telPerdu}&name=${encodeURIComponent(NOM)}`);
ok('le demandeur voit son attente', attente.corps.etat === 'attente', JSON.stringify(attente.corps));

const nomInconnu = await post('/recuperation', { device_id: telPerdu, name: 'personne ici ' + marque });
ok('on ne recupere pas un nom qui n existe pas', nomInconnu.corps.inconnu === true);

// -------------------------------------------------- Instagram comme preuve
console.log('\n── INSTAGRAM COMME PREUVE ───────────────────────────────────');
const NOM_IG = `Insta ${marque}`;
const telIg = appareil('ig1');
const claimIg = await post('/claim', { device_id: telIg, name: NOM_IG });
const CODE_IG = claimIg.corps.code;
const profil = await post('/profil', { device_id: telIg, name: NOM_IG, insta: '@le_compte_du_joueur' });
ok('le compte Instagram se lie', profil.corps.ok === true, JSON.stringify(profil.corps));

const telIgPerdu = appareil('ig2');
const demandeIg = await post('/recuperation', { device_id: telIgPerdu, name: NOM_IG });
ok('un mot de passage est tire', /^SPRINTER-[A-Z0-9]{6}$/.test(demandeIg.corps.phrase || ''),
   String(demandeIg.corps.phrase));
ok('il dit de quel compte ecrire', demandeIg.corps.insta === 'le_compte_du_joueur',
   String(demandeIg.corps.insta));
ok('il dit a qui ecrire', demandeIg.corps.compte === 'sprintergame', String(demandeIg.corps.compte));

const relu = await get(`/recuperation?device_id=${telIgPerdu}&name=${encodeURIComponent(NOM_IG)}`);
ok('le mot de passage se retrouve apres avoir ferme le jeu',
   relu.corps.phrase === demandeIg.corps.phrase, String(relu.corps.phrase));

// ---------------------------------------------------------------- la file
console.log('\n── LA FILE, COTE ADMINISTRATEUR ─────────────────────────────');
const ferme = await get('/recuperations');
ok('la file est fermee sans la cle', ferme.statut === 404, `HTTP ${ferme.statut}`);

const file = await get('/recuperations', admin);
ok('la file s ouvre avec la cle', file.statut === 200, `HTTP ${file.statut}`);
const mienne = (file.corps.demandes || []).find(d => d.id === ID);
ok('la demande y figure', !!mienne, JSON.stringify(file.corps.demandes || []).slice(0, 200));
ok('avec de quoi decider', mienne && mienne.courses != null && mienne.nom_cree_le != null);
ok('et l indice du joueur', mienne && /telephone rouge/.test(mienne.indice || ''));
const igEnFile = (file.corps.demandes || []).find(d => d.nom === NOM_IG);
ok('la demande Instagram porte les deux moities de la preuve',
   igEnFile && igEnFile.insta === 'le_compte_du_joueur'
   && igEnFile.phrase === demandeIg.corps.phrase,
   JSON.stringify(igEnFile || {}));

const sansCle = await post('/recuperation/trancher', { id: ID, accepte: true });
ok('on ne tranche pas sans la cle', sansCle.statut === 403, `HTTP ${sansCle.statut}`);

// ------------------------------------------------------------- la decision
console.log('\n── LA DECISION ──────────────────────────────────────────────');
const accepte = await post('/recuperation/trancher', { id: ID, accepte: true }, admin);
ok('la demande est acceptee', accepte.corps.ok === true, JSON.stringify(accepte.corps));

const deuxFois = await post('/recuperation/trancher', { id: ID, accepte: false }, admin);
ok('on ne revient pas sur une demande tranchee', deuxFois.statut === 404, `HTTP ${deuxFois.statut}`);

const rendu = await get(`/recuperation?device_id=${telPerdu}&name=${encodeURIComponent(NOM)}`);
ok('le demandeur recupere son code', rendu.corps.etat === 'accepte' && rendu.corps.code === CODE,
   JSON.stringify(rendu.corps));

// La liaison ne se fait qu'a la reprise, et seulement pour l'appareil qui
// demandait : un « oui » ne doit pas ouvrir le nom a tous les appareils du
// monde qui auraient demande la meme chose.
const autreDemandeur = appareil('autre');
const pasMoi = await get(`/recuperation?device_id=${autreDemandeur}&name=${encodeURIComponent(NOM)}`);
ok('un autre appareil ne profite pas de ce oui', pasMoi.corps.etat === 'aucune',
   JSON.stringify(pasMoi.corps));

// Le nom repond de nouveau a cet appareil : c'est la seule preuve qui compte.
const reclaim = await post('/claim', { device_id: telPerdu, name: NOM });
ok('le nom est de nouveau le sien', reclaim.corps.ok === true && reclaim.corps.code === CODE,
   JSON.stringify(reclaim.corps));

// ---------------------------------------------------------------- le refus
console.log('\n── LE REFUS ─────────────────────────────────────────────────');
const intrus = appareil('intrus2');
const demandeIntrus = await post('/recuperation', { device_id: intrus, name: NOM });
const refus = await post('/recuperation/trancher', { id: demandeIntrus.corps.id, accepte: false }, admin);
ok('la demande est refusee', refus.corps.etat === 'refuse', JSON.stringify(refus.corps));
const vuRefus = await get(`/recuperation?device_id=${intrus}&name=${encodeURIComponent(NOM)}`);
ok('le demandeur le voit', vuRefus.corps.etat === 'refuse', JSON.stringify(vuRefus.corps));
ok('et n obtient pas le code', vuRefus.corps.code == null, String(vuRefus.corps.code));

const claimIntrus = await post('/claim', { device_id: intrus, name: NOM });
ok('le nom lui reste ferme', claimIntrus.corps.pris === true, JSON.stringify(claimIntrus.corps));

console.log(`\n${echecs === 0 ? '✓ tout passe' : `✗ ${echecs} echec(s)`}\n`);
process.exit(echecs === 0 ? 0 : 1);
