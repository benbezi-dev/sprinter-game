// La pub, cote jeu : la video recompensee « 2e chance » de la carriere.
//
// DECISION DU 3 NOVEMBRE 2026 : le faux depart elimine aussi en carriere, et
// l'ecran de defaite offre trois sorties — payer des pieces, regarder une pub,
// ou repartir de la premiere etape. La pub reprend l'etape perdue comme un
// Continue, sans pieces, une fois par carriere (PUBS_PAR_CARRIERE).
//
// SEULE L'APPLI A DES PUBS. AdMob n'existe qu'en natif
// (@capacitor-community/admob) ; sur le site le bouton ne se montre pas. Le
// canal de test du site simule une pub pour que le parcours se verifie dans
// un navigateur.
//
// IDENTIFIANTS : les vrais (compte AdMob pub-7083823357804732, 6/11/2026,
// bloc « Video 2e chance ») en production ; ceux de TEST de Google sur le
// canal de test et en dev, pour ne jamais cliquer ses propres pubs.
// APPLICATION_ID vit dans AndroidManifest.xml / Info.plist.
//
// CE MODULE NE CASSE JAMAIS LE JEU : pub absente, refusee ou en panne = false,
// et l'ecran garde ses deux autres sorties.

import { EST_NATIF, EST_TEST } from './canal';

export const PUBS_PAR_CARRIERE = 1;

const DE_TEST = EST_TEST || import.meta.env.DEV;
const UNITE_ANDROID = DE_TEST ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-7083823357804732/2214909768';
const UNITE_IOS = DE_TEST ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-7083823357804732/7275664750';

/** Une pub peut-elle se montrer ici ? */
export function pubPossible(): boolean {
  return EST_NATIF || EST_TEST;
}

let pret: Promise<any> | null = null;

/** Charge le greffon, l'initialise et passe le consentement (UMP) une fois. */
function admob(): Promise<any> {
  if (!pret) {
    pret = (async () => {
      const m = await import('@capacitor-community/admob');
      await m.AdMob.initialize({ initializeForTesting: DE_TEST });
      try {
        const info = await m.AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === m.AdmobConsentStatus.REQUIRED) {
          await m.AdMob.showConsentForm();
        }
      } catch { /* formulaire indisponible : AdMob sert alors des pubs non personnalisees */ }
      return m;
    })();
    pret.catch(() => { pret = null; });
  }
  return pret;
}

/** Montre la video recompensee. Rend true seulement si elle a ete regardee jusqu'a la recompense. */
export async function regarderUnePub(): Promise<boolean> {
  if (!EST_NATIF) {
    // shortcut: pub simulee (1,5 s) pour le canal de test du site, a retirer si le web recoit un jour de vraies pubs
    if (!EST_TEST) return false;
    await new Promise(r => setTimeout(r, 1500));
    return true;
  }
  try {
    const m = await admob();
    const ios = (window as any).Capacitor?.getPlatform?.() === 'ios';
    const E = m.RewardAdPluginEvents;
    await m.AdMob.prepareRewardVideoAd({ adId: ios ? UNITE_IOS : UNITE_ANDROID, isTesting: DE_TEST });
    // showRewardVideoAd ne se resout qu'a la recompense : fermee avant, la
    // pub ne rendrait jamais la main. C'est la fermeture qui conclut.
    let recompense = false;
    let fin: () => void = () => {};
    const fermee = new Promise<void>(r => { fin = r; });
    const ecoutes = await Promise.all([
      m.AdMob.addListener(E.Rewarded, () => { recompense = true; }),
      m.AdMob.addListener(E.Dismissed, () => fin()),
      m.AdMob.addListener(E.FailedToShow, () => fin()),
    ]);
    try {
      m.AdMob.showRewardVideoAd().catch(() => fin());
      await fermee;
    } finally {
      ecoutes.forEach((e: any) => e.remove());
    }
    return recompense;
  } catch {
    return false;
  }
}
