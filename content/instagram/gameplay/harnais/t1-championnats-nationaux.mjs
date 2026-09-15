/**
 * Le teaser des championnats nationaux, en francais et en anglais. 9:16, ~18 s.
 *
 *     node t1-championnats-nationaux.mjs           # francais
 *     LANGUE=en node t1-championnats-nationaux.mjs # anglais
 *
 * CE QUI LE SEPARE DU REEL 5. Le reel des championnats explique une
 * fonctionnalite a qui ne la connait pas : voila ce qu'est une competition,
 * voila ses etages. Ce teaser-ci ne l'explique pas, il CONVOQUE — il y a une
 * date, il y a trente-deux places, et l'une d'elles est peut-etre la tienne.
 *
 *   · Il OUVRE et il FERME sur la barre. « 32 partants, un seul titre » est la
 *     premiere chose lue et « chaque place se gagne » la derniere, parce que
 *     ce sont les deux seules qui parlent de l'enjeu au lieu de decrire un
 *     produit. Premiere image et derniere image : les deux places qu'un fil ne
 *     fait pas defiler. Et la derniere CONSTATE, elle ne demande rien (v4).
 *   · Il porte une DATE. C'est ce qui fait un teaser plutot qu'une vitrine :
 *     sans echeance il n'y a rien a attendre. La cloture y figure aussi —
 *     trois jours avant le depart (`CLOTURE_JOURS_AVANT`), et c'est la vraie
 *     echeance du spectateur : apres, la grille est gelee et il n'y a plus
 *     rien a y faire.
 *   · Il ALTERNE les ecrans, un sur deux clair, un sur deux presque noir.
 *     Voir la note sur les six plans : c'est la seule facon de donner du
 *     rythme a ce rush.
 *   · Il a UN SPEAKER. Voir `T.voix` et `voix.py` : une annonce de stade, qui
 *     dit les cartons a l'oreille de qui fait defiler sans regarder. Le film
 *     est livre avec et sans.
 *
 * IL N'Y A PAS UNE IMAGE FABRIQUEE ICI. Les rushes sont ceux du 9 septembre
 * (`_travail/05-championnats` et `…-en`, 1 296 images chacun, 43,2 s) : deux
 * vrais weekends de championnat de France courus par le serveur — series,
 * revelation des repeches, demi-finales, finale, sacre. Les chronos affiches
 * sont ceux de ces courses-la : VOLT sacre en 9,255 s devant PLAYER 001
 * (9,359 s) et MACH (9,384 s). Seuls la date, la bande-son et les cartons
 * sont fabriques.
 *
 * LES DEUX LANGUES ONT CHACUNE LEUR RUSH, et c'est necessaire : les mots sont
 * DANS L'IMAGE — « LES REPÊCHÉS » contre « THE FASTEST LOSERS », « TU Y ES »
 * contre « YOU ARE IN ». Un carton anglais sur un rush francais ne serait pas
 * une traduction, ce serait un sous-titre qui contredit l'ecran.
 */
import { rendre, accroche, legende, chiffre, signature } from './cartons.mjs';
import { monter, photo } from './monter.mjs';
import { marques, bornes } from './commun.mjs';
import { CLOTURE_JOURS_AVANT } from '../../../../worker/src/championnats-config.js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LANGUE = process.env.LANGUE === 'en' ? 'en' : 'fr';
const EN = LANGUE === 'en';

/**
 * v3, 15 septembre : le carton de la date donne les DEUX dates en clair, et le
 * film sort sans voix. L'image change, donc la version change — la v2 reste
 * dans le dossier, telle qu'elle a ete relue.
 *
 * La voix se rend encore sur demande (`VOIX=oui`), mais sa partition n'a pas
 * ete reprise pour la v3 : la ligne du carton de la date ne dit que le depart.
 *
 * v4, 15 septembre : la signature ne pose plus de question. « Es-tu dans les
 * 32 ? » interpellait le spectateur ; « Chaque place se gagne. » constate
 * l'enjeu et le laisse venir. C'est la seule difference avec la v3 : meme
 * rush, memes plans, memes cartons jusqu'a la signature.
 */
const VERSION = 'v4';
const AVEC_VOIX = process.env.VOIX === 'oui';
const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const RUSH    = `${TRAVAIL}/05-championnats${EN ? '-en' : ''}`;
const LIVRE   = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/annonces';
const IPS = 30;
const M = marques(RUSH);
const F = JSON.parse(readFileSync(`${RUSH}/faits.json`, 'utf8'));

/**
 * LE CHRONO DE LA FINALE, ECRIT ET DIT AU MEME ENDROIT.
 *
 * `ecrit` est ce que porte le carton, `dit` ce que prononce le speaker. Les
 * deux doivent etre lus ensemble : un chrono corrige a l'ecran et laisse tel
 * quel a l'oreille donnerait un film qui se contredit dans la meme seconde,
 * et c'est le genre de defaut que personne ne relit.
 *
 * `ecrit` recopie CE QUE MONTRE LE JEU — 9.255, point compris. Le podium du
 * championnat formate son chrono chez lui (`Championnat.tsx`, `chrono()`) au
 * lieu de passer par `s2()`, qui pose la virgule : le point est donc un
 * defaut du jeu, pas du teaser, et le carton a raison de le recopier. Le
 * changer ici ferait mentir le carton sur l'ecran qu'il couvre.
 */
const CHRONO = {
  ecrit: '9.255 s',
  dit: { fr: 'neuf secondes deux cent cinquante-cinq',
         en: 'nine point two five five' }[LANGUE],
};

/**
 * Les deux dates, au seul endroit ou elles s'ecrivent.
 *
 * La cloture n'est pas une deuxieme date libre : c'est le depart moins
 * `CLOTURE_JOURS_AVANT` jours, LU chez le serveur et non plus recopie ici.
 * Deux dates saisies independamment finissent toujours par se contredire, et
 * c'est la contradiction qu'un spectateur retient.
 *
 * Le carton les donne toutes les deux, en toutes lettres (v3). La fin de la
 * selection n'etait qu'une ligne en petit sous le depart ; or c'est elle
 * l'echeance du spectateur, la seule sur laquelle il peut encore agir — et
 * c'est elle qui doit faire jouer des duels cette semaine.
 *
 * ATTENTION A L'HEURE. Par defaut le serveur ferme a J-3 00:00 UTC, soit le
 * mercredi a 2 h du matin a Paris : un joueur qui lit « mercredi 23 » et joue
 * le mercredi soir serait deja hors delai. Pour que le carton dise vrai,
 * l'edition doit etre annoncee avec une `cloture` explicite au mercredi
 * 23 h 59, heure de Paris — la commande est dans le LISEZMOI des annonces.
 */
const DEPART = Date.UTC(2026, 8, 26);                          // un samedi, minuit UTC
const CLOTURE = DEPART - CLOTURE_JOURS_AVANT * 24 * 3600 * 1000;
const enLettres = (t) => {
  const l = EN ? 'en-GB' : 'fr-FR';
  const jour = new Intl.DateTimeFormat(l, { weekday: 'long', timeZone: 'Europe/Paris' }).format(t);
  return { jour: jour[0].toUpperCase() + jour.slice(1),
           date: new Intl.DateTimeFormat(l, { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(t) };
};
const DATE = {
  cloture: { ...enLettres(CLOTURE), etiquette: EN ? 'Selection closes' : 'Fin de la sélection' },
  depart:  { ...enLettres(DEPART),  etiquette: EN ? 'Championship starts' : 'Début du championnat' },
};

/**
 * LES MOTS, et ils ne sont pas de moi.
 *
 * L'anglais est celui du jeu (`src/game/sprinter-i18n.js`) et non ma
 * traduction : « THE FASTEST LOSERS » pour les repeches, « HEATS » pour les
 * series, « YOU ARE IN » pour la barre franchie, « the top {n} are selected »
 * pour la selection. Un teaser qui traduirait autrement que l'application
 * apprendrait au spectateur des mots qu'il ne retrouverait pas en ouvrant le
 * jeu — et c'est le premier endroit ou une promesse se casse.
 */
const T = {
  fr: {
    accroche: `32 partants.<span class="fin">Un seul titre.</span>`,
    barre:    `Les 32 premiers du pays sont pris`,
    repeches: `Les repêchés sortent du chrono`,
    etages:   `Séries <span class="or">·</span> demies <span class="or">·</span> finale`,
    finale:   `la finale`,
    echelon:  `Championnat national`,
    fin:      `Chaque place<br>se gagne.`,
    // LE SPEAKER, ET SA PARTITION.
    //
    // Chaque ligne est accrochee au CARTON qu'elle accompagne, et non a une
    // seconde : `apres` compte depuis l'entree de ce carton, et peut etre
    // NEGATIF — une voix qui precede l'image de deux dixiemes est du montage
    // ordinaire, c'est l'image qui vient confirmer ce qu'on vient d'entendre.
    // Le montage a deja bouge une fois sous des reperes absolus, et une voix
    // calee en dur se serait decalee de la meme facon, en silence.
    //
    // LES MARQUES ENTRE DOUBLES CROCHETS SONT DE L'INTONATION, et c'est la
    // correction du 10 septembre : la premiere version se disait « trop
    // robotique », et elle l'etait — une seule hauteur et un seul debit du
    // premier au dernier mot. `say` accepte trois commandes embarquees, et
    // elles fonctionnent AU MILIEU d'une phrase (mesure : 150 → 118 Hz sur
    // une chute, 127 → 181 Hz sur la question) :
    //
    //     [[pbas n]]   la hauteur. Plage utile mesuree : 40 a 50 pour Thomas
    //                  (105 → 152 Hz) et 45 a 57 pour Daniel (131 → 193 Hz,
    //                  et a 61 il redescend a 178 : la voix replie). En
    //                  dessous de 40 elle fabrique des octaves.
    //
    // CE QUI EST VERIFIE, ET CE QUI NE L'EST PAS. Que `pbas` porte bien la
    // hauteur, et dans le sens ecrit, est mesure sur un A/B propre :
    // « [[pbas 47]]…[[pbas 41]] » rend 150 → 118 Hz et l'ordre inverse
    // 112 → 150 Hz. En revanche RELIRE le contour dans le fichier fini n'est
    // pas fiable — un detecteur de fondamental double d'octave sur la
    // consonne finale, et trois fenetres de mesure ont donne trois reponses.
    // La forme des phrases se juge donc a l'oreille, pas au chiffre.
    //     [[rate n]]   le debit, mot a mot
    //     [[slnc n]]   un silence, en millisecondes
    //
    // `[[pmod]]` — la modulation de hauteur — est ignoree par ces deux voix :
    // essayee de 0 a 250, elle rend un fichier identique a l'octet. C'est
    // donc `pbas` qui porte toute l'intonation, ecrite a la main.
    //
    // LA FORME DE CHAQUE PHRASE. Une annonce MONTE sur ce qu'elle appelle et
    // DESCEND sur ce qu'elle acte : d'ou 47 → 41 sur l'accroche, 48 → 42 sur
    // le sacre. La liste des etages monte d'un cran au milieu (44 → 46) puis
    // retombe plus bas qu'elle n'avait commence (40), ce qui la fait atterrir
    // au lieu de s'arreter. La phrase finale DESCEND comme les autres
    // (46 → 40) : depuis la v4 elle constate au lieu de questionner, et une
    // voix qui monte en finissant redemanderait ce que le carton ne demande
    // plus. Ligne recrite a la v4 et JAMAIS RENDUE : le film sort sans voix.
    //
    // IL DIT LES CARTONS, mot pour mot, et c'est voulu. Un speaker qui
    // paraphrase le texte a l'ecran apprend deux formulations pour une seule
    // idee ; et ces mots-la viennent du dictionnaire du jeu, pas d'ici. Les
    // seules choses qu'il ajoute sont le nom du champion — que le podium
    // montre mais qu'aucun carton ne nomme — et le chrono, dit en francais.
    //
    // LE PLAN 3 N'A PAS DE LIGNE. Les repeches gardent leur carton et rien a
    // l'oreille. Les six lignes font deja 13,2 s de parole sur 17,5 ; une
    // septieme les porterait a 14,9 s, et une annonce qui ne s'arrete jamais
    // ne se retient pas. C'est aussi le seul silence assez long pour que la
    // musique reprenne le film a son compte entre deux phrases.
    voix: [
      { carton: 'a1',  apres:  0.30, texte:
        `[[rate 165]][[pbas 47]]Trente-deux partants.[[slnc 240]][[pbas 41]]Un seul titre.` },
      { carton: 'l1',  apres:  0.40, texte:
        `[[rate 180]][[pbas 44]]Les trente-deux premiers du pays[[slnc 120]][[pbas 41]]sont pris.` },
      { carton: 'l3',  apres: -0.05, texte:
        `[[rate 172]][[pbas 44]]Séries,[[slnc 140]][[pbas 46]]demies,[[slnc 140]][[pbas 40]]finale.` },
      // Elle entre AVANT son carton : le nom du champion se dit sur le podium,
      // et le chiffre arrive a l'image pendant qu'on prononce « est sacre ».
      // Le carton se pose donc sous la phrase, et le chrono est dit quand il
      // est lisible.
      { carton: 'c1',  apres: -0.15, texte:
        `[[rate 175]][[pbas 48]]{champion} est sacré[[slnc 130]][[rate 162]][[pbas 42]]en {chrono}.` },
      { carton: 'a2',  apres:  0.80, texte:
        `[[rate 158]][[pbas 46]]Samedi[[slnc 110]][[pbas 40]]vingt-six septembre.` },
      { carton: 'fin', apres:  0.70, texte:
        `[[rate 150]][[pbas 46]]Chaque place[[slnc 120]][[pbas 40]]se gagne.` },
    ],
  },
  en: {
    accroche: `32 starters.<span class="fin">One title.</span>`,
    barre:    `The top 32 of your country are selected`,
    repeches: `The fastest losers come from the clock`,
    etages:   `Heats <span class="or">·</span> semis <span class="or">·</span> final`,
    finale:   `the final`,
    echelon:  `National Championship`,
    fin:      `Every place<br>is earned.`,
    // L'ANGLAIS EST PLUS LONG, ET IL FAUT LE PAYER EN DEBIT. A la meme
    // partition que le francais, « The top thirty-two of your country are
    // selected » durait 2,62 s et finissait 0,7 s APRES l'arrivee du carton
    // des repeches — le speaker aurait annonce la selection par-dessus un
    // ecran qui parle des repeches. Les deux premieres lignes montent donc a
    // 208 et 212 de debit pour tenir dans leur fenetre, et les hauteurs sont
    // decalees d'environ trois crans vers le haut, la voix de Daniel etant
    // plus haute que celle de Thomas (159 Hz contre 127 au repos).
    voix: [
      { carton: 'a1',  apres:  0.30, texte:
        `[[rate 208]][[pbas 51]]Thirty-two starters.[[slnc 180]][[pbas 43]]One title.` },
      { carton: 'l1',  apres:  0.40, texte:
        `[[rate 212]][[pbas 47]]The top thirty-two of your country[[slnc 110]][[pbas 44]]are selected.` },
      { carton: 'l3',  apres: -0.05, texte:
        `[[rate 185]][[pbas 47]]Heats,[[slnc 140]][[pbas 49]]semis,[[slnc 140]][[pbas 43]]final.` },
      { carton: 'c1',  apres: -0.15, texte:
        `[[rate 175]][[pbas 50]]{champion} takes the title[[slnc 130]][[rate 162]][[pbas 45]]in {chrono}.` },
      { carton: 'a2',  apres:  0.80, texte:
        `[[rate 200]][[pbas 48]]Saturday,[[slnc 110]][[pbas 45]]twenty-six September.` },
      { carton: 'fin', apres:  0.80, texte:
        `[[rate 165]][[pbas 50]]Every place[[slnc 110]][[pbas 43]]is earned.` },
    ],
  },
}[LANGUE];

/**
 * LA VOIX DE SYNTHESE, ET POURQUOI CELLE-LA.
 *
 * Ce sont les voix du systeme (`say`) : les seules disponibles hors ligne, et
 * les seules qui n'envoient pas le texte du teaser chez un tiers. Thomas en
 * francais et Daniel en anglais sont les deux voix masculines de leur langue
 * installees sur cette machine — un speaker de stade, et non une lectrice de
 * notice. `debit` n'est ici qu'un repli : le debit reel de chaque phrase est
 * ecrit dans sa partition (`[[rate n]]`), a cote des mots qu'il sert.
 *
 * Elles s'entendent pour ce qu'elles sont, brutes. `voix.py` les passe dans
 * une sono de stade, ce qui est exactement le traitement qui efface le timbre
 * de synthese : un speaker n'est jamais entendu autrement qu'a travers un
 * pavillon. C'est aussi ce qui rend la version SANS VOIX necessaire, et elle
 * est livree a cote — le jour ou une vraie voix sera enregistree, c'est sur
 * elle qu'on la posera.
 */
const SPEAKER = { fr: { nom: 'Thomas', debit: 175 },
                  en: { nom: 'Daniel', debit: 190 } }[LANGUE];

// Une date du carton plein : l'etiquette en petites capitales, le jour en
// blanc, la date en or. Les deux blocs ont la meme taille ; la cloture passe
// en premier parce qu'elle arrive en premier — et parce que c'est elle qu'on
// vise.
const blocDate = (d, haut = 0) => `<div style="display:flex;flex-direction:column;
      align-items:center;gap:12px;margin-top:${haut}px">
      <div style="font-weight:800;font-size:40px;letter-spacing:0.2em;
                  text-transform:uppercase;opacity:.72">${d.etiquette}</div>
      <div style="font-weight:900;font-size:100px;line-height:0.96;
                  text-transform:uppercase;letter-spacing:-0.01em">${d.jour}<span
           style="display:block;color:#F8CD4A">${d.date}</span></div>
    </div>`;

console.log(`── teaser · championnats nationaux · ${LANGUE.toUpperCase()} · ${VERSION}` +
            `${AVEC_VOIX ? ' · avec voix' : ' · sans voix'} ─────────────`);
const png = await rendre([
  accroche('a1', T.accroche),
  legende('l1', T.barre, 1500),
  legende('l2', T.repeches, 1560),
  legende('l3', T.etages, 1500),
  // Le chiffre se pose BAS, sous les marches du podium : c'est le seul endroit
  // du rush ou 190 px de dore tiennent. Pose sur le plan du sacre, ou il etait
  // d'abord, il tombait sur la piste rouge et verte — du dore sur du rouge,
  // sans plaque, ne se lit pas — et le mot venait heurter le « COURSE EN
  // DIRECT » de l'ecran.
  chiffre('c1', CHRONO.ecrit, T.finale, 1480),
  // Le carton de la date, sur FOND PLEIN — et c'est la seule decision de ce
  // conducteur qui ne soit pas cosmetique.
  //
  // Pose en transparence sur le panneau, comme les autres, il produisait deux
  // contradictions lisibles a l'image : « samedi 26 septembre » se lisait a
  // cote d'un « PROCHAINE COURSE 56 min », c'est-a-dire d'un championnat deja
  // en train de se courir, et l'intitule de la carte doublait celui du
  // panneau en le disant autrement. Une date est la seule information du film
  // qu'un spectateur doit pouvoir recopier sans hesiter : elle ne peut pas
  // partager le cadre avec du direct qui la dement.
  //
  // Le fond plein tranche les deux d'un coup. Le fondu de `monter()` fait
  // alors un enchaine — le panneau se dissout dans la carte — au lieu d'une
  // surimpression, ce qui donne au passage la seule respiration du montage,
  // celle que la bande-son accompagne en laissant tomber la batterie.
  { nom: 'a2', plein: true, html: `<div class="cadre"><div class="sign">
      <div style="font-weight:800;font-size:44px;letter-spacing:0.22em;
                  text-transform:uppercase;opacity:.85">${T.echelon}</div>
      <div class="filet"></div>
      ${blocDate(DATE.cloture)}
      ${blocDate(DATE.depart, 22)}
    </div></div>` },
  signature('fin', T.fin),
], `${TRAVAIL}/_cartons/t1-${LANGUE}-${VERSION}`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png', ''), p]));

/**
 * Cinq plans, cinq ECRANS DIFFERENTS — et c'est une correction, pas un choix
 * de depart.
 *
 * LA CARTOGRAPHIE DU RUSH, mesuree et non supposee. Le montage precedent
 * reprenait des fenetres relevees sur le rush du 6 septembre, et le rush du
 * 9 ne se deroule pas dans le meme ordre : il OUVRE sur la carte de selection
 * (« TU Y ES »), la ou l'ancien ouvrait sur le panneau d'accueil. Trois plans
 * sur six tombaient donc sur le meme ecran sans que rien ne le signale — les
 * fenetres etaient valides, elles ne montraient simplement plus ce qu'elles
 * avaient montre. Les ecrans se separent a la SATURATION du tiers superieur :
 * le panneau porte une piste rouge et verte, tous les autres sont presque
 * noirs, et la luminosite seule ne les distinguait pas.
 *
 *     0,2 – 7,9    la carte de selection      « TU Y ES · SÉRIE 2 »
 *     8,0 – 10,1   les repeches des series    PLAYER 006, 010, 009
 *    10,2 – 15,3   les repeches des demies    PLAYER 005, 002, 001, 011
 *    15,3 – 17,7   le panneau                 Finale · ZEPHYR 1er
 *    17,7 – 22,2   le podium (premiere fois)
 *    22,2 – 27,3   le panneau                 « VOLT est sacré »
 *    27,4 – 34,9   le podium (seconde fois)
 *    36,3 – 43,2   le classement des duels
 *
 * POURQUOI LE RECADRAGE NE SAUVE PAS UN ECRAN REPETE. On pourrait croire
 * qu'une poussee serree sur un autre bloc en ferait un plan distinct. Elle ne
 * le peut pas : la source fait DEJA 1080 x 1920, c'est l'ecran entier du
 * telephone, et la fenetre 9:16 rogne autant en largeur qu'en hauteur. A 1,30
 * elle mange 124 px de chaque bord — de quoi couper le « 1er » des lignes de
 * depart et transformer « NATIONAL II » en « NATIONAL I ». La poussee est donc
 * plafonnee a 1,16, ce qui laisse a peine 200 px de debattement vertical.
 * Seul le CHOIX DE L'ECRAN fait un plan.
 *
 * LE PODIUM DURE CINQ SECONDES HUIT, ET C'EST LA FIN DU FILM. Il y avait
 * apres lui un sixieme plan — le panneau, en recul — qui n'existait que pour
 * donner une image sous le carton de la date. Il coutait deux coupes seches
 * dans les trois dernieres secondes, et le carton, en s'ouvrant et en se
 * fermant a l'interieur de ce plan, laissait reapparaitre le jeu de part et
 * d'autre : on lisait podium → panneau → date → panneau → signature, deux
 * allers-retours que l'oeil prend pour une erreur. Le plan est supprime et le
 * podium prolonge d'autant : la date s'y dissout, puis se dissout dans la
 * signature. Plus une seule coupe dans les huit dernieres secondes.
 */
const plans = [
  // 1 · le panneau : le nom du championnat, ses etages, la banderole de
  //     selection. Le seul plan qui montre le jeu entier — c'est l'etabli.
  { de: 15.45, a: 17.65, zoom: [1.04, 1.14], ancre: [0.5, 0.62] },
  // 2 · LA CARTE DE SELECTION — « TU Y ES · SÉRIE 2 · la grille est gelée ».
  //     Le plan qui porte l'angle : c'est le jeu lui-meme qui dit au joueur
  //     qu'il en est.
  { de: 4.45,  a: 7.05,  zoom: [1.02, 1.10], ancre: [0.5, 0.48] },
  // 3 · les repeches des series, pendant que la liste tombe ligne a ligne.
  { de: 8.05,  a: 10.05, zoom: [1.02, 1.12], ancre: [0.5, 0.42] },
  // 4 · le sacre. En RECUL, pour decouvrir les trois pastilles que la legende
  //     nomme — et elles sont traduites depuis le 9 septembre.
  { de: 24.57, a: 26.77, zoom: [1.12, 1.02], ancre: [0.5, 0.80] },
  // 5 · le podium, et tout ce qui reste du film. Le seul fond du rush qui
  //     tienne un chiffre de 190 px, et le seul assez beau pour qu'on s'y
  //     attarde six secondes.
  //     v3 : six dixiemes de plus (34,20 → 34,80, le podium du rush tient
  //     jusqu'a 34,9). Ils vont au carton de la date, qui porte maintenant deux
  //     dates au lieu d'une et a besoin de ce temps pour se lire. Ces images-la
  //     sont sous le carton plein : on ne les voit pas, on gagne leur duree.
  { de: 28.40, a: 34.80, zoom: [1.02, 1.16], ancre: [0.5, 0.46] },
];

const B = bornes(plans);
// Le carton de la date entre 3,30 s apres le debut du dernier plan : le temps
// que le chiffre de la finale ait fini de partir.
const DATE_DE = B[4].de + 3.30;
const DATE_FERM = 0.60;

// `nom` n'est pas lu par `monter()` : il sert a la voix, qui s'accroche aux
// cartons par leur nom plutot qu'a des secondes (voir `T.voix`).
const cartons = [
  { nom: 'a1', png: C.a1, de: B[0].de + 0.10, duree: 2.00, entree: 'fondu' },
  { nom: 'l1', png: C.l1, de: B[1].de + 0.30, duree: 2.10, entree: 'bas'   },
  { nom: 'l2', png: C.l2, de: B[2].de + 0.30, duree: 1.60, entree: 'bas'   },
  { nom: 'l3', png: C.l3, de: B[3].de + 0.30, duree: 1.80, entree: 'bas'   },
  { nom: 'c1', png: C.c1, de: B[4].de + 0.55, duree: 2.40, entree: 'bas'   },
  // Sa fermeture tombe PILE a l'entree de la signature (`B[4].a`), si bien
  // qu'il se dissout dans elle au lieu de rendre la main au podium.
  { nom: 'a2', png: C.a2, de: DATE_DE, duree: (B[4].a - DATE_DE) + DATE_FERM,
    entree: 'fondu', ouverture: 0.55, fermeture: DATE_FERM },
];

/* ------------------------------------------------------------------- la voix
   LE SPEAKER SE REND AVANT LA MUSIQUE, et ce n'est pas un detail d'ordre : la
   musique BAISSE sous la parole (`attenuation()` de musique.py), donc elle a
   besoin de la voix finie pour savoir ou baisser. L'inverse — poser une voix
   sur une musique deja mixee — donnerait deux choses fortes qui se battent.

   `apres` compte depuis l'entree du carton nomme ; la signature n'est pas un
   carton pose mais le dernier plan, d'ou son entree prise sur les bornes. */
const FIN_SIGNATURE = 2.7;
const dureeFilm = B[B.length - 1].a + FIN_SIGNATURE;
// Un dossier par version : la v2 garde ses WAV et ses releves, que son
// LISEZMOI donne a relire.
const DOSSIER = `${TRAVAIL}/_montage/t1-${LANGUE}-${VERSION}`;
mkdirSync(DOSSIER, { recursive: true });

const VOIX = `${DOSSIER}/voix.wav`;
if (AVEC_VOIX) {
  const POSE = Object.fromEntries(cartons.filter(c => c.nom).map(c => [c.nom, c.de]));
  POSE.fin = B[B.length - 1].a;
  const specVoix = `${DOSSIER}/voix.json`;
  writeFileSync(specVoix, JSON.stringify({
    sortie: VOIX,
    duree: Number(dureeFilm.toFixed(3)),
    voix: SPEAKER.nom,
    debit: SPEAKER.debit,
    lignes: T.voix.map(v => {
      if (POSE[v.carton] === undefined) {
        // Un carton renomme et une ligne restee sur l'ancien nom donneraient une
        // voix posee a `NaN` — c'est-a-dire nulle part, sans un mot d'erreur.
        throw new Error(`T.voix renvoie au carton « ${v.carton} », qui n'existe pas`);
      }
      return {
        t: Number((POSE[v.carton] + v.apres).toFixed(3)),
        texte: v.texte.replace('{champion}', F.champion)
                      .replace('{chrono}', CHRONO.dit),
        ...(v.debit ? { debit: v.debit } : {}),
      };
    }),
  }, null, 1));
  console.log('   voix off…');
  const rapportVoix = JSON.parse(execFileSync('python3',
    [new URL('./voix.py', import.meta.url).pathname, specVoix],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim());
  // Le releve est GARDE a cote du WAV. C'est lui qui dit ou chaque phrase tombe
  // dans le film, et c'est la seule trace consultable une fois le WAV rendu :
  // une voix mal calee ne se voit pas dans un fichier son.
  writeFileSync(`${DOSSIER}/voix-rapport.json`, JSON.stringify(rapportVoix, null, 1));
  for (const l of rapportVoix.lignes) {
    console.log(`     ${l.de.toFixed(2)} → ${l.a.toFixed(2)} s  « ${l.texte} »`);
  }
}

/* -------------------------------------------------------------- la bande-son
   Elle est ECRITE A PARTIR DU MONTAGE : les coupes deviennent des impacts, la
   basse change de note a chaque plan, et la montee vise le carton de la date —
   ou tout tombe sauf la basse. Voir musique.py pour le detail des voix et pour
   la raison de la fabriquer plutot que de la choisir.

   ELLE SE REND DEUX FOIS, et la seconde n'est pas un doublon : la version sans
   voix n'est pas la meme musique amputee de la parole, c'est la meme musique
   SANS SES ATTENUATIONS. Reutiliser la piste attenuee sans la voix laisserait
   six trous inexpliques dans le mixage. */
const WAV = `${DOSSIER}/bande-son.wav`;
const WAV_SANS = `${DOSSIER}/bande-son-sansvoix.wav`;
const communMusique = {
  duree: Number(dureeFilm.toFixed(3)),
  // Les coupes du film, hors la premiere : il n'y a pas d'impact a l'image 0,
  // le coup de pistolet y est deja.
  coupes: B.slice(1).map(b => Number(b.de.toFixed(3))),
  // La respiration ne tombe plus sur une coupe — il n'y en a plus a la fin.
  // Elle tombe sur l'APPARITION du carton de la date, qui est le vrai
  // evenement du dernier tiers.
  date: Number(DATE_DE.toFixed(3)),
  // Et la signature recoit son propre accent, plus doux : sans lui, cinq
  // secondes s'ecouleraient sans un evenement, et la fin s'affaisserait.
  signature: Number(B[B.length - 1].a.toFixed(3)),
};
// CHAQUE VERSION GARDE SA SPEC. Ecrire les deux dans le meme fichier laissait
// derriere soi celle de la seconde — la version sans voix — et donnait a
// relire une spec qui ne decrit pas ce qu'on ecoute.
const musique = new URL('./musique.py', import.meta.url).pathname;
const versions = [['sans voix', 'sansvoix', WAV_SANS, null]];
if (AVEC_VOIX) versions.unshift(['avec voix', 'voix', WAV, VOIX]);
for (const [nom, suffixe, sortie, voix] of versions) {
  console.log(`   bande-son, ${nom}…`);
  const spec = `${DOSSIER}/musique-${suffixe}.json`;
  writeFileSync(spec, JSON.stringify({ ...communMusique, sortie, voix }, null, 1));
  execFileSync('python3', [musique, spec], { stdio: ['ignore', 'ignore', 'inherit'] });
}

/* UNE SEULE IMAGE, UNE PISTE PAR VERSION SONORE, ET UN MUET.
   La v2 avait trois sorties sur la meme image — avec voix, musique seule,
   muet. La v3 change l'IMAGE (le carton de la date) : elle prend donc un
   numero a elle, et la v2 reste telle quelle a cote. Sans `VOIX=oui`, il n'y
   a que la musique seule et le muet. */
const { muet, sonores, duree } = monter({
  nom: `sprinter_championnats-nationaux_teaser_${LANGUE}_${VERSION}`,
  rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: FIN_SIGNATURE }, fonduFin: 0.35,
  pistes: AVEC_VOIX ? [{ suffixe: '_voix', wav: WAV }, { suffixe: '', wav: WAV_SANS }]
                    : [{ suffixe: '', wav: WAV_SANS }],
  travail: DOSSIER, sortie: LIVRE,
});
for (const f of sonores) {
  console.log(`   ${f.split('/').pop()}  ·  ${f.includes('_voix') ? `speaker ${SPEAKER.nom}` : 'musique seule'}`);
}
console.log(`   ${muet.split('/').pop()}  ·  muet  ·  ${duree.toFixed(1)} s  ·  champion ${F.champion}`);

// La vignette : le podium, drapeaux et chrono compris. C'est l'image qui doit
// tenir seule dans un fil, avant qu'une seule seconde ait ete jouee.
const COVER = `${LIVRE}/sprinter_championnats-nationaux_cover_${LANGUE}_${VERSION}.jpg`;
photo(RUSH, IPS, M['podium'] + 3.2, COVER, { zoom: 1.14, ancre: [0.5, 0.46] });

// L'AFFICHE. Le meme texte que `a2`, mais sur PLAQUE et non sur fond plein :
// elle se pose sur le podium pour donner une image fixe qui porte la date. La
// vignette montre le podium seul — belle, et muette sur la date ; or une
// annonce se republie en story et en fil, ou rien ne se lit en mouvement.
//
// DEUX PIEGES, tous deux vus a la composition.
// · Les lignes internes sont des `div`, pas des `span` : la regle
//   `.legende span` du gabarit vise les DESCENDANTS, si bien que trois spans
//   imbriques rendaient trois plaques emboitees — un formulaire, pas une
//   affiche.
// · Les etiquettes disent « Fin de la sélection » et « Début du championnat »
//   et non le nom du championnat : le podium le nomme deja a l'image, et deux
//   facons de nommer la meme chose a 300 px d'ecart, c'est le defaut que le
//   carton plein a servi a supprimer.
// · La date en or est un `b` et non un `span`, pour la meme raison que
//   ci-dessus.
const ligneAffiche = (d, haut = 0) => `
      <div style="font-size:32px;letter-spacing:0.2em;opacity:.8;margin-top:${haut}px">${d.etiquette}</div>
      <div style="font-size:52px;line-height:1.0;margin-top:10px">${d.jour} <b
           style="color:#F8CD4A;font-weight:inherit">${d.date}</b></div>`;
const [affiche] = await rendre([
  { nom: 'affiche', html: `<div class="legende" style="top:1210px"><span style="padding:38px 52px">
      ${ligneAffiche(DATE.cloture)}
      ${ligneAffiche(DATE.depart, 30)}
    </span></div>` },
], `${TRAVAIL}/_cartons/t1-${LANGUE}-${VERSION}`);
const AFFICHE = `${LIVRE}/sprinter_championnats-nationaux_affiche_${LANGUE}_${VERSION}.jpg`;
execFileSync('python3', ['-c', `
from PIL import Image
fond = Image.open(${JSON.stringify(COVER)}).convert('RGBA')
fond.alpha_composite(Image.open(${JSON.stringify(affiche)}).convert('RGBA'))
fond.convert('RGB').save(${JSON.stringify(AFFICHE)}, quality=94, subsampling=0)
`]);
console.log('   vignette et affiche ecrites');
