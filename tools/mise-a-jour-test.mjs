// LA MISE A JOUR AU LANCEMENT — les regles et chaque chemin, sans telephone.
//
//   1. la comparaison des versions est numerique (1.10.0 > 1.9.0) ;
//   2. les trois etats : a jour, optionnelle (et son « Plus tard » de 24 h),
//      obligatoire ;
//   3. iOS montre la modale ; Android passe par Google Play In-App Updates et
//      retombe sur la modale quand l'API echoue ;
//   4. hors ligne, serveur muet, reponse abimee : le jeu se lance, rien ne
//      s'affiche, et la verification ne depasse jamais son delai.
//
//   node tools/mise-a-jour-test.mjs

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const dir = mkdtempSync(join(tmpdir(), 'maj-'));
const entree = join(dir, 'entree.ts');
const src = n => join(process.cwd(), 'src/game/mise-a-jour', n);
writeFileSync(entree, `export * from '${src('semver.ts')}';
export * from '${src('decision.ts')}';
export * from '${src('service.ts')}';`);
const sortie = join(dir, 'maj.mjs');
await build({ entryPoints: [entree], bundle: true, format: 'esm', platform: 'node', outfile: sortie, logLevel: 'silent' });
const M = await import(sortie);

const H = 60 * 60 * 1000;
const OPTS = { delaiMs: 300, reportMs: 24 * H };
const CFG = { latestVersion: '1.0.21', minSupportedVersion: '1.0.20', storeUrl: 'https://apps.apple.com/app/id6829487830' };
const reponse = (ios = CFG, android = { ...CFG, storeUrl: 'https://play.google.com/store/apps/details?id=dev.benbezi.sprinter' }) => ({ ios, android });

/** Des ports factices ; chaque appel est note dans `journal`. */
function ports({ plateforme = 'ios', version = '1.0.20', config = reponse(), report = null, t = 1_000_000,
  play = { disponible: 'oui', immediate: true, flexible: true }, immediate = 'ok', flexible = 'ok' } = {}) {
  const journal = [];
  const p = {
    journal, report, t,
    plateforme: () => plateforme,
    versionLocale: async () => (typeof version === 'function' ? version() : version),
    chargerConfig: async signal => {
      journal.push('config');
      if (typeof config === 'function') return config(signal);
      return config;
    },
    lireReport: () => p.report,
    ecrireReport: r => { journal.push('report'); p.report = r; },
    maintenant: () => p.t,
    infoPlay: async () => { journal.push('infoPlay'); if (play instanceof Error) throw play; return play; },
    miseAJourImmediate: async () => { journal.push('immediate'); if (immediate instanceof Error) throw immediate; return immediate; },
    miseAJourFlexible: async prete => { journal.push('flexible'); if (flexible === 'ok') prete(); return flexible; },
    ouvrirStore: async cfg => { journal.push('store:' + cfg.storeUrl); },
  };
  return p;
}

titre('la comparaison des versions');
{
  const c = M.comparerVersions;
  ok('1.10.0 > 1.9.0 (deux chiffres)', c('1.10.0', '1.9.0') === 1);
  ok('1.9.0 < 1.10.0', c('1.9.0', '1.10.0') === -1);
  ok('1.10.0 > 1.2.0', c('1.10.0', '1.2.0') === 1);
  ok('2.0.0 > 1.99.99', c('2.0.0', '1.99.99') === 1);
  ok('1.0.19 < 1.0.20', c('1.0.19', '1.0.20') === -1);
  ok('egales', c('1.0.19', '1.0.19') === 0);
  ok('partie manquante : 1.2 = 1.2.0', c('1.2', '1.2.0') === 0);
  ok('un « v » devant est tolere', c('v1.3.0', '1.3.0') === 0);
  ok('suffixe ignore : « 1.0.19 (38) »', c('1.0.19 (38)', '1.0.19') === 0);
  ok('suffixe ignore : « 1.0.19-beta »', c('1.0.19-beta', '1.0.19') === 0);
  ok('du bruit rend null', c('abc', '1.0.0') === null && c(null, '1.0.0') === null && c('1..2', '1') === null);
  ok('jamais une comparaison de chaines', ('1.10.0' < '1.9.0') && c('1.10.0', '1.9.0') === 1);
}

titre('les trois etats');
{
  const etat = v => M.etatDeVersion(v, CFG);
  ok('a jour : egale a la derniere', etat('1.0.21') === 'a-jour');
  ok('a jour : plus recente (build de test)', etat('1.0.22') === 'a-jour');
  ok('optionnelle : entre minimale et derniere', etat('1.0.20') === 'optionnelle');
  ok('obligatoire : sous la minimale', etat('1.0.19') === 'obligatoire');
  ok('obligatoire : 1.9.0 sous 1.10.0', M.etatDeVersion('1.9.0', { ...CFG, latestVersion: '1.10.0', minSupportedVersion: '1.10.0' }) === 'obligatoire');
  ok('version locale illisible : a jour, on ne bloque pas', etat(null) === 'a-jour' && etat('') === 'a-jour');
  ok('config valide lue', !!M.configDe(reponse(), 'ios'));
  ok('config sans storeUrl https refusee', M.configDe({ ios: { ...CFG, storeUrl: 'http://x' } }, 'ios') === null);
  ok('config a version abimee refusee', M.configDe({ ios: { ...CFG, minSupportedVersion: 'x' } }, 'ios') === null);
  ok('plateforme absente refusee', M.configDe({ ios: CFG }, 'android') === null);
}

titre('le « Plus tard » et son delai');
{
  const t0 = 5_000_000;
  const r = M.reporter(CFG, t0, 24 * H);
  ok('optionnelle sans report : proposee', M.doitProposer('optionnelle', CFG, null, t0));
  ok('juste apres « Plus tard » : rien', !M.doitProposer('optionnelle', CFG, r, t0 + H));
  ok('23 h 59 apres : toujours rien', !M.doitProposer('optionnelle', CFG, r, t0 + 24 * H - 1));
  ok('24 h apres : proposee a nouveau', M.doitProposer('optionnelle', CFG, r, t0 + 24 * H));
  ok('une version plus recente passe outre le report', M.doitProposer('optionnelle', { ...CFG, latestVersion: '1.0.22' }, r, t0 + H));
  ok('le report ne retient jamais l\'obligatoire', M.doitProposer('obligatoire', CFG, r, t0 + H));
  ok('un report abime est ignore', M.reportValide({ version: 1 }) === null && M.reportValide('x') === null);

  const p = ports({ version: '1.0.20' });
  let i = await M.verifierMiseAJour(p, OPTS);
  ok('iOS optionnelle : la modale', i.type === 'modale' && i.etat === 'optionnelle');
  M.plusTard(p, i.cfg, OPTS.reportMs);
  ok('« Plus tard » ecrit le report de cette version', p.report?.version === '1.0.21' && p.report.jusqua === p.t + 24 * H);
  p.t += 2 * H;
  i = await M.verifierMiseAJour(p, OPTS);
  ok('relance 2 h apres : rien (reporte)', i.type === 'rien' && i.raison === 'reporte');
  p.t += 23 * H;
  i = await M.verifierMiseAJour(p, OPTS);
  ok('relance 25 h apres : la modale revient', i.type === 'modale');
}

titre('le routage, iOS');
{
  let i = await M.verifierMiseAJour(ports({ version: '1.0.21' }), OPTS);
  ok('a jour : rien', i.type === 'rien' && i.raison === 'a-jour');
  i = await M.verifierMiseAJour(ports({ version: '1.0.19' }), OPTS);
  ok('obligatoire : modale bloquante', i.type === 'modale' && i.etat === 'obligatoire');
  const p = ports({ version: '1.0.19' });
  await M.lancerMiseAJour(p, CFG, 'obligatoire');
  ok('iOS : jamais d\'API Play, le bouton ouvre l\'App Store', !p.journal.includes('infoPlay')
    && p.journal.includes('store:' + CFG.storeUrl));
  i = await M.verifierMiseAJour(ports({ plateforme: 'web' }), OPTS);
  ok('web : rien, sans meme appeler le serveur', i.type === 'rien' && i.raison === 'web');
}

titre('le routage, Android et Google Play');
{
  let p = ports({ plateforme: 'android', version: '1.0.19' });
  let i = await M.verifierMiseAJour(p, OPTS);
  ok('obligatoire : mise a jour IMMEDIATE lancee', i.type === 'play' && i.mode === 'immediate' && p.journal.includes('immediate'));

  p = ports({ plateforme: 'android', version: '1.0.20' });
  let prete = false;
  i = await M.verifierMiseAJour(p, { ...OPTS, surTelechargee: () => { prete = true; } });
  ok('optionnelle : mise a jour FLEXIBLE lancee', i.type === 'play' && i.mode === 'flexible' && p.journal.includes('flexible'));
  ok('telechargement fini : proposition de redemarrer', prete);

  p = ports({ plateforme: 'android', version: '1.0.20', flexible: 'annule' });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('« Non merci » de Play : vaut un « Plus tard »', i.type === 'rien' && p.report?.version === '1.0.21');

  p = ports({ plateforme: 'android', version: '1.0.19', immediate: 'annule' });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('IMMEDIATE annulee : la modale bloquante prend le relais', i.type === 'modale' && i.etat === 'obligatoire');

  p = ports({ plateforme: 'android', version: '1.0.19', play: new Error('Play absent') });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('API Play en echec (obligatoire) : repli sur la modale', i.type === 'modale' && i.etat === 'obligatoire');

  p = ports({ plateforme: 'android', version: '1.0.20', play: new Error('Play absent') });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('API Play en echec (optionnelle) : repli sur la modale', i.type === 'modale' && i.etat === 'optionnelle');

  p = ports({ plateforme: 'android', version: '1.0.20', immediate: new Error('x'), flexible: 'echec' });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('FLEXIBLE ratee : repli sur la modale', i.type === 'modale');

  p = ports({ plateforme: 'android', version: '1.0.20', play: { disponible: 'inconnu', immediate: false, flexible: false } });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('Play ne sait pas (appli hors Play Store) : la modale', i.type === 'modale');

  p = ports({ plateforme: 'android', version: '1.0.19', play: { disponible: 'oui', immediate: false, flexible: true } });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('IMMEDIATE non permise : la modale bloquante', i.type === 'modale' && !p.journal.includes('immediate'));

  p = ports({ plateforme: 'android', version: '1.0.20', play: { disponible: 'non', immediate: false, flexible: false } });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('Play ne propose rien a ce joueur (optionnelle) : rien', i.type === 'rien');

  p = ports({ plateforme: 'android', version: '1.0.19', play: { disponible: 'non', immediate: false, flexible: false } });
  i = await M.verifierMiseAJour(p, OPTS);
  ok('… mais l\'obligatoire tient quand meme', i.type === 'modale' && i.etat === 'obligatoire');

  p = ports({ plateforme: 'android', version: '1.0.20', play: new Promise(() => {}) });
  p.infoPlay = () => new Promise(() => {});
  const t0 = Date.now();
  i = await M.verifierMiseAJour(p, OPTS);
  ok('Play qui ne repond jamais : modale apres le delai', i.type === 'modale' && Date.now() - t0 < OPTS.delaiMs * 3);

  p = ports({ plateforme: 'android', version: '1.0.19', immediate: 'echec' });
  await M.lancerMiseAJour(p, CFG, 'obligatoire');
  ok('bouton, IMMEDIATE en echec : ouvre la fiche du store', p.journal.includes('immediate') && p.journal.some(j => j.startsWith('store:')));
}

titre('le lancement n\'est jamais bloque');
{
  const muet = () => new Promise(() => {});
  let t0 = Date.now();
  let i = await M.verifierMiseAJour(ports({ config: muet }), OPTS);
  const duree = Date.now() - t0;
  ok('serveur muet : rien, dans le delai', i.type === 'rien' && i.raison === 'delai-ou-reseau', `${duree} ms`);
  ok('… et sans le depasser (≈300 ms)', duree >= OPTS.delaiMs - 20 && duree < OPTS.delaiMs + 200, `${duree} ms`);

  let abandonne = false;
  await M.verifierMiseAJour(ports({ config: signal => new Promise((_, rej) => {
    signal.addEventListener('abort', () => { abandonne = true; rej(new Error('abort')); });
  }) }), OPTS);
  ok('la requete est abandonnee au delai (AbortController)', abandonne);

  i = await M.verifierMiseAJour(ports({ config: () => { throw new TypeError('Failed to fetch'); } }), OPTS);
  ok('hors ligne (fetch leve) : rien', i.type === 'rien');
  i = await M.verifierMiseAJour(ports({ config: async () => { throw new Error('HTTP 500'); } }), OPTS);
  ok('erreur serveur : rien', i.type === 'rien');
  i = await M.verifierMiseAJour(ports({ config: '<html>' }), OPTS);
  ok('reponse abimee : rien', i.type === 'rien' && i.raison === 'config-invalide');
  i = await M.verifierMiseAJour(ports({ version: () => { throw new Error('getInfo'); } }), OPTS);
  ok('version locale illisible : rien', i.type === 'rien');
  const casse = ports();
  casse.plateforme = () => { throw new Error('Capacitor absent'); };
  i = await M.verifierMiseAJour(casse, OPTS);
  ok('n\'importe quelle exception : rien, jamais levee', i.type === 'rien');
}

titre('le drapeau de developpement');
{
  const p = ports({ version: '1.0.19' });
  let i = await M.verifierMiseAJour(p, { ...OPTS, simulation: 'off' });
  ok('off : rien, sans appel reseau', i.type === 'rien' && !p.journal.includes('config'));
  i = await M.verifierMiseAJour(ports({ plateforme: 'web' }), { ...OPTS, simulation: 'optionnelle' });
  ok('simuler l\'optionnelle, meme sur le web', i.type === 'modale' && i.etat === 'optionnelle');
  i = await M.verifierMiseAJour(ports({ plateforme: 'web' }), { ...OPTS, simulation: 'obligatoire' });
  ok('simuler l\'obligatoire', i.type === 'modale' && i.etat === 'obligatoire');
}

console.log(e ? `\n${e} echec(s)` : '\ntout est vert');
process.exit(e ? 1 : 0);
