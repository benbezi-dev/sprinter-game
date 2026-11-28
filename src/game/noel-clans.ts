// NOEL 2026 — LA TREVE DES QUATRE CLANS (l'histoire de l'evenement par equipes).
//
// Les quatre equipes de worker/src/noel-equipes.js (n = 0..3, Rouge, Vert, Or, Glace)
// deviennent quatre clans du Grand Nord, chacun avec son nom, son embleme, sa devise et
// sa banniere. L'histoire (docs/NOEL_CLANS.md) donne un recit a chaque regle du serveur,
// sans en changer aucune : le vote des chefs, l'equipe tiree au sort, l'elimination, la
// pause, la finale.
//
// AUCUN IMPORT ICI : des donnees et des chaines SVG, chargeables seules par un outil
// (tools/noel-bannieres.mjs ecrit les bannieres dans public/noel/bannieres/).

export type Ligne = [string, string];

export type Clan = {
  /** L'index de l'equipe cote serveur. */
  n: number;
  cle: 'braises' | 'sapins' | 'etoiles' | 'givres';
  nom: Ligne;
  /** « Clan des Braises » */
  clan: Ligne;
  couleur: string;
  /** La teinte sombre du fond de la banniere. */
  fonce: string;
  embleme: Ligne;
  devise: Ligne;
  /** Le titre de son champion (le chef d'equipe). */
  champion: Ligne;
  /** Ce que le clan apporte a la Treve, en une phrase. */
  vertu: Ligne;
  /** Le cri du clan, quand il marque. */
  cri: Ligne;
  /** Quand il est elimine : il eteint sa torche. */
  extinction: Ligne;
  /** Quand il gagne Noel. */
  sacre: Ligne;
};

export const CLANS: readonly Clan[] = [
  { n: 0, cle: 'braises', nom: ['Les Braises', 'The Embers'], clan: ['Clan des Braises', 'Ember Clan'],
    couleur: '#ff5a5a', fonce: '#5a0d12',
    embleme: ['la flamme', 'the flame'],
    devise: ['Le feu ne recule pas.', 'Fire never steps back.'],
    champion: ['Porte-Flamme', 'Flamebearer'],
    vertu: ['Les forgerons du foyer : ils partent les premiers et ne s’éteignent jamais.', 'Smiths of the hearth: first off the line, never burnt out.'],
    cri: ['Braises, debout !', 'Embers, rise!'],
    extinction: ['Les Braises éteignent leur torche. Leur feu passe dans les trois autres foyers.', 'The Embers put out their torch. Their fire lives on in the other three hearths.'],
    sacre: ['Les Braises allument l’Étoile. Leur feu réchauffe les quatre clans cette nuit.', 'The Embers light the Star. Their fire warms all four clans tonight.'] },
  { n: 1, cle: 'sapins', nom: ['Les Sapins', 'The Firs'], clan: ['Clan des Sapins', 'Fir Clan'],
    couleur: '#4ade80', fonce: '#0b3a1f',
    embleme: ['le sapin', 'the fir tree'],
    devise: ['Toujours debout, toujours vert.', 'Ever standing, ever green.'],
    champion: ['Gardien de la Forêt', 'Forest Warden'],
    vertu: ['Les enfants de la forêt : en plein hiver, ils ne perdent pas une aiguille.', 'Children of the forest: deep in winter, they never lose a needle.'],
    cri: ['Sapins, tenez !', 'Firs, hold fast!'],
    extinction: ['Les Sapins couchent leur bannière. Leurs racines courent désormais sous les trois autres clans.', 'The Firs lower their banner. Their roots now run beneath the other three clans.'],
    sacre: ['Les Sapins allument l’Étoile. Elle brille au sommet de leur arbre, pour tout le Nord.', 'The Firs light the Star. It shines atop their tree, for the whole North.'] },
  { n: 2, cle: 'etoiles', nom: ['Les Étoiles', 'The Stars'], clan: ['Clan des Étoiles', 'Star Clan'],
    couleur: '#ffd426', fonce: '#4a3504',
    embleme: ['l’étoile', 'the star'],
    devise: ['Nous montrons le chemin.', 'We show the way.'],
    champion: ['Guide', 'Guide'],
    vertu: ['Les guides du ciel : ils ont mené les voyageurs perdus à travers la neige.', 'Guides of the sky: they led lost travellers through the snow.'],
    cri: ['Étoiles, en avant !', 'Stars, lead on!'],
    extinction: ['Les Étoiles voilent leur lumière. Elles guideront désormais les trois autres clans.', 'The Stars veil their light. From now on they guide the other three clans.'],
    sacre: ['Les Étoiles allument l’Étoile. Le ciel et la terre brillent ensemble.', 'The Stars light the Star. Sky and earth shine together.'] },
  { n: 3, cle: 'givres', nom: ['Les Givres', 'The Frosts'], clan: ['Clan des Givres', 'Frost Clan'],
    couleur: '#bfe6ff', fonce: '#0d2c46',
    embleme: ['le flocon', 'the snowflake'],
    devise: ['Le froid nous rend vifs.', 'The cold makes us quick.'],
    champion: ['Lame de Givre', 'Frost Blade'],
    vertu: ['Le peuple du bout du monde : silencieux, et rapides comme le vent polaire.', 'The people of the world’s end: silent, and quick as the polar wind.'],
    cri: ['Givres, sur le vent !', 'Frosts, ride the wind!'],
    extinction: ['Les Givres fondent dans les trois autres clans, comme la neige au printemps.', 'The Frosts melt into the other three clans, like snow in spring.'],
    sacre: ['Les Givres allument l’Étoile. Sa lumière scintille sur chaque flocon du Nord.', 'The Frosts light the Star. Its light sparkles on every snowflake in the North.'] },
];

export function clanDe(n: number): Clan { return CLANS[((n % 4) + 4) % 4]; }

/* ---------------------------------------------------------------- la legende */

/** La legende de la Treve, en pages (lue depuis l'ecran de l'evenement). */
export const LEGENDE: { titre: Ligne; pages: Ligne[][] } = {
  titre: ['LA TRÊVE DES QUATRE CLANS', 'THE TRUCE OF THE FOUR CLANS'],
  pages: [[
    ['Il y a mille hivers, le Grand Nord appartenait à quatre clans.', 'A thousand winters ago, the Far North belonged to four clans.'],
    ['Les Braises, forgerons du feu. Les Sapins, enfants de la forêt.', 'The Embers, smiths of fire. The Firs, children of the forest.'],
    ['Les Étoiles, guides du ciel. Les Givres, peuple du bout du monde.', 'The Stars, guides of the sky. The Frosts, people of the world’s end.'],
    ['Et chaque hiver, ils se faisaient la guerre pour le dernier feu.', 'And every winter they waged war for the last fire.'],
  ], [
    ['Une année, la guerre dura jusqu’à la nuit la plus longue.', 'One year, the war lasted until the longest night.'],
    ['Il ne restait à chaque clan qu’une seule braise. Les enfants avaient froid.', 'Each clan had a single ember left. The children were freezing.'],
    ['Chaque clan envoya son coureur le plus rapide voler le feu des autres.', 'Each clan sent its fastest runner to steal the others’ fire.'],
    ['Les quatre coureurs se trouvèrent face à face, sur le lac gelé.', 'The four runners met face to face, on the frozen lake.'],
  ], [
    ['Quatre braises, presque mortes. Seule, chacune allait s’éteindre.', 'Four embers, nearly dead. Alone, each would go out.'],
    ['Alors ils les posèrent ensemble sur la glace. Et le feu prit.', 'So they laid them together on the ice. And the fire caught.'],
    ['Ils restèrent assis autour jusqu’à l’aube, sans un mot.', 'They sat around it until dawn, without a word.'],
    ['Un vieil homme à barbe blanche, vêtu de rouge, veillait avec eux.', 'An old man with a white beard, dressed in red, kept watch with them.'],
  ], [
    ['Au matin, le vieil homme leur dit : « Plus de guerre en hiver. »', 'In the morning the old man said: “No more war in winter.”'],
    ['« De la première neige jusqu’à Noël, vos clans s’affronteront en courant. »', '“From the first snow until Christmas, your clans will meet on the track.”'],
    ['« Le plus rapide allumera l’Étoile la nuit de Noël… »', '“The fastest will light the Star on Christmas night…”'],
    ['« …et son honneur sera d’en donner la flamme aux trois autres. »', '“…and their honour will be to give its flame to the other three.”'],
  ], [
    ['Il découpa quatre bannières et cousit dans chacune un fil de son manteau rouge.', 'He cut four banners and sewed a thread of his red coat into each.'],
    ['Ce jour-là, les clans s’échangèrent leurs enfants :', 'That day, the clans exchanged their children:'],
    ['chacun grandirait dans un clan qui n’était pas le sien,', 'each would grow up in a clan that was not their own,'],
    ['pour que plus jamais personne ne puisse haïr l’autre.', 'so that no one could ever hate the other again.'],
  ], [
    ['Depuis, chaque décembre, la Trêve revient.', 'Since then, every December, the Truce returns.'],
    ['Les clans élisent leurs champions. La neige tire au sort leurs coureurs.', 'The clans elect their champions. The snow draws their runners.'],
    ['On ne gagne pas Noël en écrasant les autres.', 'You don’t win Christmas by crushing the others.'],
    ['On le gagne pour avoir le droit de partager le feu.', 'You win it for the right to share the fire.'],
  ]],
};

/** Ce que l'histoire dit de chaque moment du calendrier. */
export const MOMENTS: Record<'avant' | 'vote' | 'departage' | 'tirage' | 'manche1' | 'manche2' | 'pause' | 'finale' | 'fini', { titre: Ligne; ligne: Ligne }> = {
  avant: { titre: ['La Trêve des Quatre Clans', 'The Truce of the Four Clans'],
    ligne: ['La première neige tombe. Les clans attendent l’Appel des Champions.', 'The first snow falls. The clans await the Call of Champions.'] },
  vote: { titre: ['L’Appel des Champions', 'The Call of Champions'],
    ligne: ['Les huit plus rapides se présentent. Le peuple en élit quatre : un par clan.', 'The eight fastest step forward. The people elect four: one per clan.'] },
  departage: { titre: ['Le Duel des Prétendants', 'The Contenders’ Duel'],
    ligne: ['Les voix sont égales. Le 200 m tranchera.', 'The votes are tied. The 200 m will decide.'] },
  tirage: { titre: ['Le Tirage de la Neige', 'The Drawing of the Snow'],
    ligne: ['Tu ne choisis pas ton clan : la neige le choisit pour toi, comme au premier jour de la Trêve.', 'You don’t choose your clan: the snow chooses for you, as on the first day of the Truce.'] },
  manche1: { titre: ['Le Feu des Premières Neiges', 'The Fire of the First Snow'],
    ligne: ['Première manche. Le clan le plus faible éteindra sa torche.', 'First round. The weakest clan will put out its torch.'] },
  manche2: { titre: ['La Longue Nuit', 'The Long Night'],
    ligne: ['Deuxième manche. Trois clans, une torche de trop.', 'Second round. Three clans, one torch too many.'] },
  pause: { titre: ['La Trêve du Solstice', 'The Solstice Truce'],
    ligne: ['La nuit la plus longue approche. Comme sur le lac gelé, plus personne ne court : rien ne compte.', 'The longest night draws near. As on the frozen lake, no one races: nothing counts.'] },
  finale: { titre: ['La Course de l’Étoile', 'The Star Race'],
    ligne: ['Deux clans. Le vainqueur allumera l’Étoile, et en donnera la flamme.', 'Two clans. The winner lights the Star, and gives away its flame.'] },
  fini: { titre: ['L’Étoile est allumée', 'The Star is lit'],
    ligne: ['La Trêve s’achève. Les quatre bannières flottent côte à côte jusqu’à l’an prochain.', 'The Truce ends. The four banners fly side by side until next year.'] },
};

/* ---------------------------------------------------------------- les bannieres */

/** L'embleme de chaque clan, dessine dans un carre 60 x 60 centre en (0, 0). */
function embleme(cle: Clan['cle'], c: string): string {
  switch (cle) {
    case 'braises':
      // une flamme a trois langues, et son coeur
      return `<path d="M2,-29 C6,-19 15,-14 16,-3 C17,4 13,9 13,9 C17,7 20,2 20,-4 C25,7 24,21 11,27 C4,30 -4,30 -11,27 C-23,21 -24,7 -18,-2 C-18,5 -15,9 -12,10 C-15,3 -12,-7 -6,-13 C-2,-17 1,-22 2,-29 Z" fill="${c}"/>`
        + `<path d="M1,-5 C5,2 10,7 9,14 C8,21 4,24 0,24 C-4,24 -8,21 -8,15 C-8,10 -4,7 -3,2 C-2,5 0,7 0,7 C2,2 2,-2 1,-5 Z" fill="#ff8a3d"/>`;
    case 'sapins':
      return `<polygon points="0,-28 13,-10 6,-10 19,7 9,7 23,24 -23,24 -9,7 -19,7 -6,-10 -13,-10" fill="${c}"/>`
        + `<rect x="-4" y="24" width="8" height="7" fill="#6b4423"/>`
        + `<circle cx="-7" cy="12" r="2" fill="#fff6dc"/><circle cx="8" cy="-2" r="2" fill="#fff6dc"/><circle cx="3" cy="18" r="2" fill="#fff6dc"/>`;
    case 'etoiles': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 28;
        pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${c}"/><circle r="5" fill="#fff6dc"/>`;
    }
    default: {
      let b = '';
      for (let i = 0; i < 6; i++) {
        const a = i * 30 * 2;
        b += `<g transform="rotate(${a})"><line x1="0" y1="0" x2="0" y2="-27" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`
          + `<line x1="0" y1="-16" x2="-8" y2="-24" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
          + `<line x1="0" y1="-16" x2="8" y2="-24" stroke="${c}" stroke-width="3" stroke-linecap="round"/></g>`;
      }
      return b + `<circle r="4" fill="#fff6dc"/>`;
    }
  }
}

/**
 * La banniere d'un clan, en SVG (120 x 180) : une hampe doree, un etendard a deux
 * pointes, l'embleme, le nom, et en bas LE FIL ROUGE du manteau du Gardien — le meme
 * sur les quatre bannieres (la legende, page 5).
 */
export function svgBanniere(n: number, fr = true): string {
  const k = clanDe(n);
  const nom = (fr ? k.nom[0] : k.nom[1]).toUpperCase();
  const taille = nom.length > 11 ? 10 : 11.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" width="120" height="180">`
    + `<defs><linearGradient id="g${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${k.couleur}"/><stop offset="1" stop-color="${k.fonce}"/></linearGradient>`
    + `<linearGradient id="o${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#b8862e"/></linearGradient></defs>`
    // la hampe et ses deux pommeaux
    + `<rect x="6" y="8" width="108" height="7" rx="3.5" fill="url(#o${n})"/>`
    + `<circle cx="6" cy="11.5" r="6" fill="url(#o${n})"/><circle cx="114" cy="11.5" r="6" fill="url(#o${n})"/>`
    // l'etendard a deux pointes
    + `<path d="M14,15 H106 V160 L60,142 L14,160 Z" fill="url(#g${n})" stroke="url(#o${n})" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M20,21 H100 V151 L60,135 L20,151 Z" fill="none" stroke="#fff6dc" stroke-opacity="0.35" stroke-width="1.2"/>`
    // l'embleme, dans un medaillon
    + `<circle cx="60" cy="68" r="36" fill="${k.fonce}" fill-opacity="0.55" stroke="url(#o${n})" stroke-width="2"/>`
    + `<g transform="translate(60,68)">${embleme(k.cle, k.cle === 'etoiles' ? '#fff1b8' : '#fff6dc')}</g>`
    // le nom
    + `<text x="60" y="123" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${taille}" letter-spacing="1" fill="#fff6dc">${nom}</text>`
    // le fil rouge du manteau du Gardien
    + `<path d="M14,146 L60,128 L106,146" fill="none" stroke="#c41e2a" stroke-width="3.5" stroke-linejoin="round"/>`
    // quelques flocons
    + `<g fill="#fff6dc" fill-opacity="0.7"><circle cx="26" cy="30" r="1.6"/><circle cx="94" cy="34" r="1.3"/><circle cx="30" cy="104" r="1.2"/><circle cx="92" cy="100" r="1.6"/></g>`
    + `</svg>`;
}

/** La meme banniere, en URL de donnees, pour une balise <img>. */
export function urlBanniere(n: number, fr = true): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgBanniere(n, fr))}`;
}
