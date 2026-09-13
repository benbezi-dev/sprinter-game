/* ---------------------------------------------------------------------------
   LE CALENDRIER DE L'ATHLETISME REEL — la page, la fiche, et le rappel
   ---------------------------------------------------------------------------
   Trois sorties, une seule source (content/athletisme/calendrier.mjs) :

     node tools/calendrier-athletisme.mjs              les prochains, au terminal
     node tools/calendrier-athletisme.mjs html         la page, sur la sortie
     node tools/calendrier-athletisme.mjs html --ecrire  la page, dans suivi/
     node tools/calendrier-athletisme.mjs md           la fiche Markdown
     node tools/calendrier-athletisme.mjs md --ecrire    la fiche, dans content/

   `--ecrire` pose `suivi/calendrier-athletisme.html` a cote de
   `suivi/calendrier-instagram.html` : le tableau de bord sert ce dossier en
   statique, donc la page est visible sans toucher au tableau — `npm run tableau`
   puis http://localhost:4178/calendrier-athletisme.html. Pour lui donner un
   onglet a cote de « Calendrier », il suffit d'un lien de plus dans la barre du
   tableau, qui vit sur le Mac (suivi/ n'est pas dans le depot, .gitignore).

   La page se rend sans reseau, sans police distante et sans script tiers : elle
   doit s'ouvrir dans six mois depuis un fichier local, dans un avion, et rester
   juste. Le decompte « dans 42 jours » est donc calcule a l'ouverture par la
   page elle-meme, jamais fige au moment du rendu — une page qui annonce
   « demain » trois semaines apres coup est pire qu'une page sans decompte.
--------------------------------------------------------------------------- */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPETITIONS, FENETRE, RANGS, TROUS,
  aVenir, compte, epreuves, etat, mois, parDate, periode,
} from '../content/athletisme/calendrier.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* -------------------------------------------------------------------------- */
/* La page                                                                     */
/* -------------------------------------------------------------------------- */

const echapper = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Les donnees telles que la page les relira. `</script>` dans une chaine
 *  fermerait la balise et casserait la page : on le neutralise. */
const injecter = (valeur) => JSON.stringify(valeur).replace(/</g, '\\u003c');

function carte(c) {
  const rang = RANGS[c.rang];
  const sprint = c.sprint.length ? epreuves(c) : 'pas de sprint';
  return `
      <article class="carte" data-cle="${echapper(c.cle)}"
               data-debut="${c.debut}" data-fin="${c.fin}"
               data-rang="${c.rang}" data-statut="${c.statut}"
               data-sprint="${c.sprint.length ? 'oui' : 'non'}"
               data-salle="${c.salle ? 'oui' : 'non'}"
               data-pays="${echapper(c.pays)}">
        <div class="entete">
          <div>
            <p class="quand">${echapper(periode(c))}</p>
            <h3>${echapper(c.nom)}</h3>
            <p class="ou">${echapper(c.lieu)} · ${echapper(c.pays)}${c.salle ? ' · en salle' : ''}</p>
          </div>
          <p class="decompte" data-decompte>&nbsp;</p>
        </div>
        <p class="etiquettes">
          <span class="etiquette" style="--teinte:${rang.teinte}">${echapper(rang.nom)}</span>
          <span class="etiquette ${c.sprint.length ? 'sprint' : 'creux'}">${echapper(sprint)}</span>
          ${c.statut === 'a-confirmer'
            ? '<span class="etiquette doute">date à confirmer</span>'
            : ''}
        </p>
        <p class="quoi">${echapper(c.quoi)}</p>
        ${c.jeu ? `<p class="jeu">${echapper(c.jeu)}</p>` : ''}
        <p class="source"><a href="${echapper(c.source)}" target="_blank" rel="noreferrer">la source de cette date</a></p>
      </article>`;
}

function groupes() {
  const parMois = new Map();
  for (const c of parDate()) {
    const m = mois(c);
    if (!parMois.has(m)) parMois.set(m, []);
    parMois.get(m).push(c);
  }
  return [...parMois].map(([m, liste]) => `
      <section class="mois" data-mois="${echapper(m)}">
        <h2>${echapper(m)}</h2>
        ${liste.map(carte).join('\n')}
      </section>`).join('\n');
}

export function rendreHTML() {
  const c = compte();
  const debut = periode({ debut: FENETRE.debut, fin: FENETRE.debut });
  const fin = periode({ debut: FENETRE.fin, fin: FENETRE.fin });

  return `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le calendrier World Athletics — Sprinter</title>
<style>
  :root {
    --fond: #0b0f17; --carte: #121826; --bord: #1f2937;
    --texte: #e8eaed; --pale: #9aa3b2; --or: #f5c33b; --vert: #6ee7a8;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px 64px; background: var(--fond); color: var(--texte);
    font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .page { max-width: 820px; margin: 0 auto; }
  h1 { font-size: clamp(30px, 7vw, 44px); line-height: 1.1; margin: 0 0 8px; letter-spacing: -0.02em; }
  h1 em { color: var(--or); font-style: normal; }
  .chapeau { color: var(--pale); margin: 0 0 24px; }
  details {
    background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
    padding: 14px 16px; margin: 0 0 12px;
  }
  details summary { cursor: pointer; font-weight: 600; }
  details p, details li { color: var(--pale); }
  .filtres { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 12px; }
  .filtres button {
    background: transparent; color: var(--texte); border: 1px solid var(--bord);
    border-radius: 999px; padding: 9px 16px; font: inherit; font-weight: 600; cursor: pointer;
  }
  .filtres button[aria-pressed="true"] { background: var(--or); color: #10131a; border-color: var(--or); }
  .compte { color: var(--pale); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; margin: 0 0 4px; }
  .compte .vert { color: var(--vert); }
  .mois > h2 {
    font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pale);
    margin: 32px 0 12px; border-bottom: 1px solid var(--bord); padding-bottom: 8px;
  }
  .carte {
    background: var(--carte); border: 1px solid var(--bord); border-radius: 16px;
    padding: 16px; margin: 0 0 12px;
  }
  .carte.passee { opacity: 0.45; }
  .carte.en-cours { border-color: var(--or); }
  .entete { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
  .entete h3 { margin: 2px 0 4px; font-size: 19px; line-height: 1.25; }
  .quand { margin: 0; color: var(--or); font-weight: 600; font-size: 14px; }
  .ou, .source { margin: 0; color: var(--pale); font-size: 14px; }
  .decompte {
    margin: 0; flex: 0 0 auto; text-align: right; color: var(--pale);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; white-space: nowrap;
  }
  .decompte.proche { color: var(--or); }
  .etiquettes { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
  .etiquette {
    font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--teinte, var(--bord)); color: var(--teinte, var(--pale));
  }
  .etiquette.sprint { --teinte: var(--vert); }
  .etiquette.creux { --teinte: #6b7280; }
  .etiquette.doute { --teinte: #fca5a5; }
  .quoi { margin: 0 0 8px; }
  .jeu {
    margin: 0 0 10px; padding-left: 12px; border-left: 2px solid var(--or);
    color: var(--pale);
  }
  .trous { margin-top: 40px; }
  .trous li { color: var(--pale); margin-bottom: 10px; }
  .trous strong { color: var(--texte); }
  footer { margin-top: 40px; color: var(--pale); font-size: 14px; border-top: 1px solid var(--bord); padding-top: 16px; }
  a { color: var(--or); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
  @media (max-width: 420px) { .entete { flex-direction: column; } .decompte { text-align: left; } }
</style>
<div class="page">
  <h1>Le calendrier <em>World Athletics</em></h1>
  <p class="chapeau">ce qui se court dehors — du ${echapper(debut)} au ${echapper(fin)}</p>

  <details>
    <summary>Ce que ce calendrier est, et ce qu’il ne sera jamais — à lire une fois</summary>
    <p>Il liste des <strong>faits extérieurs</strong> : des dates tenues par World
    Athletics, European Athletics et la FFA, pas par nous. Chaque ligne porte le
    lien d’où sa date vient, et celles qu’un circuit a annoncées un an à
    l’avance sont marquées <em>à confirmer</em> — une date d’athlétisme se
    déplace.</p>
    <p>Il ne promet rien du jeu. La charte est nette : on ne publie pas une date
    que le code ne tient pas. Le championnat du jeu s’ouvre quand son moteur
    l’ouvre, jamais parce qu’un mondial tombe cette semaine-là. Ce qui est écrit
    en retrait sous chaque compétition est une <strong>fenêtre d’attention</strong>,
    c’est-à-dire une matière — pas un rendez-vous.</p>
    <p>Le périmètre est le sprint : 100, 200, 400 et les relais, les trois
    épreuves du jeu. Les rendez-vous sans sprint y figurent quand même quand ils
    occupent tout l’espace — pour savoir qu’on y publierait dans le vide.</p>
  </details>

  <div class="filtres" role="group" aria-label="Filtres">
    <button type="button" data-filtre="tout" aria-pressed="true">Tout</button>
    <button type="button" data-filtre="sprint" aria-pressed="false">Sprint</button>
    <button type="button" data-filtre="majeurs" aria-pressed="false">Majeurs</button>
    <button type="button" data-filtre="france" aria-pressed="false">France</button>
    <button type="button" data-filtre="salle" aria-pressed="false">Salle</button>
    <button type="button" data-filtre="a-venir" aria-pressed="false">À venir</button>
    <button type="button" data-filtre="a-confirmer" aria-pressed="false">À confirmer</button>
  </div>
  <p class="compte" data-compte>${c.total} rendez-vous — ${c.sprint} avec du sprint · ${c.aConfirmer} à confirmer</p>
  <p class="compte"><span class="vert" data-prochain>&nbsp;</span></p>

${groupes()}

  <section class="trous">
    <h2>Ce que ce calendrier ne sait pas encore</h2>
    <ul>
      ${TROUS.map((t) => `<li><strong>${echapper(t.quoi)}</strong> — ${echapper(t.pourquoi)}
        <a href="${echapper(t.ou)}" target="_blank" rel="noreferrer">où regarder</a></li>`).join('\n      ')}
    </ul>
  </section>

  <footer>
    <p>Relevé le ${echapper(periode({ debut: FENETRE.releve, fin: FENETRE.releve }))}.
    Les dates vivent dans <code>content/athletisme/calendrier.mjs</code> ; cette page
    se refait par <code>npm run calendrier</code>.</p>
    <p data-fraicheur></p>
  </footer>
</div>
<script>
  // Le decompte se calcule ICI, a l'ouverture, et non au rendu : cette page
  // peut trainer des mois dans suivi/ sans devenir fausse.
  var RELEVE = ${injecter(FENETRE.releve)};

  function minuit(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function jours(a, b) { return Math.round((a - b) / 86400000); }

  var maintenant = minuit(new Date());
  var cartes = Array.prototype.slice.call(document.querySelectorAll('.carte'));
  var prochaine = null;

  cartes.forEach(function (carte) {
    var debut = Date.parse(carte.dataset.debut + 'T00:00:00Z');
    var fin = Date.parse(carte.dataset.fin + 'T00:00:00Z');
    var sortie = carte.querySelector('[data-decompte]');
    if (maintenant > fin) {
      carte.classList.add('passee');
      carte.dataset.etat = 'passe';
      sortie.textContent = 'passé';
    } else if (maintenant >= debut) {
      carte.classList.add('en-cours');
      carte.dataset.etat = 'en-cours';
      sortie.textContent = "c'est maintenant";
      sortie.classList.add('proche');
      if (!prochaine) prochaine = carte;
    } else {
      var d = jours(debut, maintenant);
      carte.dataset.etat = 'a-venir';
      sortie.textContent = d === 1 ? 'demain' : 'dans ' + d + ' jours';
      if (d <= 14) sortie.classList.add('proche');
      if (!prochaine) prochaine = carte;
    }
  });

  var ligne = document.querySelector('[data-prochain]');
  if (prochaine) {
    var titre = prochaine.querySelector('h3').textContent;
    var quand = prochaine.querySelector('[data-decompte]').textContent;
    ligne.textContent = 'prochain rendez-vous : ' + titre + ' — ' + quand;
  } else {
    ligne.textContent = 'plus rien dans la fenêtre de ce calendrier — il est à prolonger.';
  }

  // Passe six mois, une liste de dates d'athletisme a forcement bouge.
  var age = jours(maintenant, Date.parse(RELEVE + 'T00:00:00Z'));
  if (age > 180) {
    document.querySelector('[data-fraicheur]').textContent =
      'Ce relevé a ' + age + ' jours. À cet âge-là, une date a bougé quelque part : ' +
      'rouvrir les sources avant de publier quoi que ce soit dessus.';
  }

  // Les filtres. Un seul actif a la fois : superposer « France » et « Salle »
  // donnerait un ensemble vide sans qu'on comprenne pourquoi.
  var regles = {
    tout: function () { return true; },
    sprint: function (c) { return c.dataset.sprint === 'oui'; },
    majeurs: function (c) { return c.dataset.rang === 'mondial' || c.dataset.rang === 'continental'; },
    france: function (c) { return c.dataset.pays === 'France'; },
    salle: function (c) { return c.dataset.salle === 'oui'; },
    'a-venir': function (c) { return c.dataset.etat !== 'passe'; },
    'a-confirmer': function (c) { return c.dataset.statut === 'a-confirmer'; }
  };

  var boutons = Array.prototype.slice.call(document.querySelectorAll('[data-filtre]'));
  boutons.forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      boutons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === bouton)); });
      var garde = regles[bouton.dataset.filtre];
      var vus = 0;
      cartes.forEach(function (c) {
        var montrer = garde(c);
        c.hidden = !montrer;
        if (montrer) vus++;
      });
      // Un mois dont toutes les cartes sont cachees ne doit pas garder son titre.
      Array.prototype.forEach.call(document.querySelectorAll('.mois'), function (m) {
        m.hidden = !m.querySelector('.carte:not([hidden])');
      });
      document.querySelector('[data-compte]').textContent =
        vus + (vus > 1 ? ' rendez-vous affichés' : ' rendez-vous affiché');
    });
  });
</script>
</html>
`;
}

/* -------------------------------------------------------------------------- */
/* La fiche Markdown — celle qui se lit sur un telephone, ou dans le Drive     */
/* -------------------------------------------------------------------------- */

export function rendreMarkdown(maintenant = new Date()) {
  const c = compte(COMPETITIONS, maintenant);
  const lignes = [];

  lignes.push('# Le calendrier World Athletics — ce qui se court dehors');
  lignes.push('');
  lignes.push(`**${c.total} rendez-vous** entre le ${periode({ debut: FENETRE.debut, fin: FENETRE.debut })}`
    + ` et le ${periode({ debut: FENETRE.fin, fin: FENETRE.fin })} — ${c.sprint} avec du sprint,`
    + ` ${c.aConfirmer} dont la date reste à confirmer.`);
  lignes.push('');
  lignes.push(`> Relevé le ${periode({ debut: FENETRE.releve, fin: FENETRE.releve })}. Les dates vivent dans`
    + ' `content/athletisme/calendrier.mjs` ; cette fiche et la page du tableau de bord'
    + ' en sortent toutes les deux (`npm run calendrier`). Une date d’athlétisme se'
    + ' déplace : rouvrir la source avant de publier quoi que ce soit dessus.');
  lignes.push('');
  lignes.push('**Ce calendrier ne promet rien du jeu.** Ce sont des dates tenues par World');
  lignes.push('Athletics, European Athletics et la FFA. Le championnat du jeu s’ouvre quand son');
  lignes.push('moteur l’ouvre — jamais parce qu’un mondial tombe cette semaine-là (charte §5.3).');
  lignes.push('');

  let moisCourant = '';
  for (const comp of parDate()) {
    const m = mois(comp);
    if (m !== moisCourant) {
      moisCourant = m;
      lignes.push('---');
      lignes.push('');
      lignes.push(`## ${m.charAt(0).toUpperCase()}${m.slice(1)}`);
      lignes.push('');
    }
    // Aucun decompte ici, a la difference de la page et du terminal : cette
    // fiche est un fichier qu'on committe et qu'on relit dans six mois. Un
    // « dans 167 jours » fige au moment du rendu serait faux des le lendemain,
    // et faux SANS LE DIRE — le lecteur n'a aucun moyen de s'en apercevoir.
    lignes.push(`### ${comp.nom}`);
    lignes.push('');
    lignes.push(`**${periode(comp)}** — ${comp.lieu}, ${comp.pays}${comp.salle ? ', en salle' : ''}`
      + ` · ${RANGS[comp.rang].nom}`
      + ` · ${comp.sprint.length ? epreuves(comp) : 'pas de sprint'}`
      + `${comp.statut === 'a-confirmer' ? ' · **date à confirmer**' : ''}`);
    lignes.push('');
    lignes.push(comp.quoi);
    if (comp.jeu) {
      lignes.push('');
      lignes.push(`> ${comp.jeu}`);
    }
    lignes.push('');
    lignes.push(`[La source de cette date](${comp.source})`);
    lignes.push('');
  }

  lignes.push('---');
  lignes.push('');
  lignes.push('## Ce que ce calendrier ne sait pas encore');
  lignes.push('');
  for (const t of TROUS) lignes.push(`- **${t.quoi}** — ${t.pourquoi} ([où regarder](${t.ou}))`);
  lignes.push('');

  return lignes.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Le rappel, au terminal                                                      */
/* -------------------------------------------------------------------------- */

function rendreTerminal(maintenant = new Date()) {
  const restantes = aVenir(maintenant);
  const c = compte(COMPETITIONS, maintenant);
  const lignes = [
    '',
    '  CE QUI SE COURT DEHORS',
    `  ${c.aVenir} rendez-vous a venir sur ${c.total} — ${c.aConfirmer} dates a confirmer`,
    '',
  ];
  if (!restantes.length) {
    lignes.push('  Plus rien dans la fenetre de ce calendrier : il est a prolonger.', '');
    return lignes.join('\n');
  }
  for (const comp of restantes) {
    const e = etat(comp, maintenant);
    const quand = e.etat === 'en-cours' ? "c'est maintenant"
      : e.jours === 1 ? 'demain' : `dans ${e.jours} j`;
    lignes.push(`  ${quand.padEnd(16)} ${periode(comp)}`);
    // Une etape de circuit porte deja sa ville dans son nom (« ... — Doha ») :
    // la repeter donnerait « Doha — Doha ».
    const ou = comp.nom.includes(comp.lieu) ? '' : ` — ${comp.lieu}`;
    lignes.push(`  ${' '.repeat(16)} ${comp.nom}${ou}`
      + `${comp.statut === 'a-confirmer' ? '  (date a confirmer)' : ''}`);
    lignes.push(`  ${' '.repeat(16)} ${comp.sprint.length ? epreuves(comp) : 'pas de sprint'}`);
    lignes.push('');
  }
  return lignes.join('\n');
}

/* -------------------------------------------------------------------------- */

function poser(chemin, contenu) {
  const cible = resolve(RACINE, chemin);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
  console.log(`  ecrit : ${chemin}  (${(contenu.length / 1024).toFixed(1)} ko)`);
}

// Ce fichier est aussi un module : le tableau de bord importe `rendreHTML` pour
// servir la page a chaud. Sans cette garde, un `import` declencherait la sortie
// en ligne de commande — et ecrirait des fichiers au passage.
const appeleDirectement = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const [sortie = 'prochains', ...options] = appeleDirectement ? process.argv.slice(2) : ['module'];
const ecrire = options.includes('--ecrire');

if (!appeleDirectement) {
  // rien : on n'est qu'un module
} else if (sortie === 'html') {
  const page = rendreHTML();
  if (ecrire) poser('suivi/calendrier-athletisme.html', page);
  else process.stdout.write(page);
} else if (sortie === 'md') {
  const fiche = rendreMarkdown();
  if (ecrire) poser('content/athletisme/calendrier-athletisme.md', fiche);
  else process.stdout.write(fiche);
} else if (sortie === 'prochains') {
  process.stdout.write(rendreTerminal());
} else {
  console.error(`  sortie inconnue : ${sortie}\n`
    + '  usage : node tools/calendrier-athletisme.mjs [prochains|html|md] [--ecrire]');
  process.exit(1);
}
