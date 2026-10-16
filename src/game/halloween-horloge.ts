// L'HORLOGE DU MODE — aller chercher l'heure du serveur, et la ranger.
//
// `game/halloween-calendrier.ts` sait CALCULER avec un instant, mais il ne sait
// pas d'où l'instant vient : il n'importe rien, parce que son harnais le charge
// nu sous node. Ce fichier-ci est l'autre moitié — celui qui a le droit de
// parler au réseau et au stockage, et qui n'a donc aucune règle à lui.
//
// La séparation n'est pas de la coquetterie : tout ce qui décide est dans le
// module éprouvé, tout ce qui branche est ici, et rien de ce qui est ici ne
// peut changer une date.

import {
  horlogeRetenue, poserHorloge, horlogeReglee, maintenant, sourceDuTemps,
  type Horloge, type Memoire, MEMOIRE_MUETTE,
} from './halloween-calendrier';

/* L'ADRESSE EST ÉCRITE EN DUR, COMME DANS LES QUINZE AUTRES FICHIERS DE
   src/game, et c'est voulu : une constante partagée serait un endroit de plus
   où se tromper de canal. C'est aussi ce qui permet au greffon `API_LOCALE` de
   vite.config.ts de la remplacer partout à la fois quand on développe contre un
   `wrangler dev` — il cherche cette chaîne exacte. */
const API = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

const CLE_CLIQUET = 'halloween2026.cliquet';

/** Combien de temps on attend le serveur avant de passer hors ligne. */
const DELAI_MS = 4000;

/** Le cliquet, rangé dans le navigateur. Muet si le stockage refuse. */
function memoire(): Memoire {
  try {
    // On touche le stockage tout de suite : en navigation privée, l'accès jette
    // au premier appel et non à la déclaration.
    localStorage.getItem(CLE_CLIQUET);
    return {
      lire: () => { try { return localStorage.getItem(CLE_CLIQUET); } catch { return null; } },
      ecrire: v => { try { localStorage.setItem(CLE_CLIQUET, v); } catch { /* refusé */ } },
    };
  } catch { return MEMOIRE_MUETTE; }
}

/**
 * Demander l'heure au serveur.
 *
 * DEUX SOURCES, ET LA SECONDE NE COÛTE RIEN. La route `/now` répond un nombre ;
 * mais TOUTE réponse HTTP porte déjà un en-tête `Date`, posé par le serveur et
 * hors de portée du joueur. Si la route tombe, l'en-tête d'une requête
 * quelconque fait le même travail à la seconde près — ce qui suffit largement
 * pour des journées de vingt-quatre heures.
 *
 * On rend `null` quand les deux échouent : c'est le mode hors ligne, et c'est
 * `horlogeRetenue` qui décide alors quoi faire.
 */
export async function tempsDuServeur(): Promise<number | null> {
  // UN DELAI, SANS QUOI LE HORS-LIGNE N'ARRIVE JAMAIS. Sur un reseau qui ne
  // repond pas — portail captif, paquets jetes — une requete peut pendre des
  // minutes, et pendant ce temps l'ecran ne savait que l'horloge de
  // l'appareil. Passe quatre secondes, on tranche : c'est le hors-ligne, et
  // le cliquet decide.
  const arret = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const minuterie = arret ? setTimeout(() => arret.abort(), DELAI_MS) : 0;
  try {
    const r = await fetch(`${API}/now`, { cache: 'no-store', signal: arret?.signal });
    if (r.ok) {
      const d = await r.json();
      if (typeof d.ms === 'number' && isFinite(d.ms) && d.ms > 0) return d.ms;
    }
    // La route a répondu autre chose que ce qu'on attendait : l'en-tête reste.
    const entete = r.headers.get('Date');
    if (entete) { const t = Date.parse(entete); if (!isNaN(t)) return t; }
  } catch { /* hors ligne, route injoignable, ou delai depasse */ }
  finally { if (minuterie) clearTimeout(minuterie); }
  return null;
}

/**
 * Régler l'horloge du mode, une fois, au moment d'entrer.
 *
 * Rend ce qui a été retenu, pour que l'écran puisse le dire au testeur — un
 * bandeau qui annonce « heure du serveur » ou « hors ligne » évite des retours
 * de bogue qui n'en sont pas.
 *
 * ON NE BLOQUE PAS L'ENTRÉE DU MODE SUR CET APPEL. Un joueur dans le métro doit
 * pouvoir ouvrir le Calendrier : `horlogeRetenue` lui rendra son dernier jour
 * validé, ce qui est exactement ce qu'il faut lui montrer.
 */
export async function reglerLHorloge(): Promise<Horloge> {
  const h = horlogeRetenue(await tempsDuServeur(), Date.now(), memoire());
  poserHorloge(h);
  return h;
}

/**
 * Le même travail, sans attendre le réseau.
 *
 * Sert au tout premier rendu : on pose immédiatement ce que le cliquet sait,
 * puis `reglerLHorloge` corrige quand le serveur répond. Sans cela, le
 * Calendrier s'afficherait avec `Date.now()` — et sur la machine d'un joueur
 * qui a avancé sa montre, il montrerait treize cartes ouvertes, assez
 * longtemps pour en lancer une.
 *
 * IL DOIT PASSER AVANT LE RENDU, PAS APRÈS. Il était appelé dans un
 * `useEffect`, donc une fois le panneau déjà dessiné sur l'horloge de
 * l'appareil — et rien ne redessinait avant la réponse du serveur. Il est
 * maintenant appelé à l'ouverture du panneau, avant tout calcul.
 *
 * Une horloge déjà réglée par le serveur n'est pas remplacée : elle vaut
 * mieux que le cliquet, et elle avance d'elle-même.
 */
export function horlogeImmediate(): Horloge {
  if (horlogeReglee() && sourceDuTemps() === 'serveur') {
    return { ms: maintenant(), source: 'serveur' };
  }
  const h = horlogeRetenue(null, Date.now(), memoire());
  poserHorloge(h);
  return h;
}
