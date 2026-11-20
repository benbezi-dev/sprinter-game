/**
 * L'achat « Sans pubs » (non consommable, 2,99 € fixe dans les stores) :
 * la 2e chance de carriere se prend sans regarder de video, a vie.
 *
 * Pas de serveur de validation : ce sont Google Play et l'App Store qui
 * disent ce que le joueur possede. On garde leur reponse en memoire pour que
 * l'avantage marche aussi hors ligne, et on la relit a chaque lancement — un
 * achat rembourse disparait alors de la liste et l'avantage avec.
 * shortcut: sans validation serveur des recus, un appareil trafique peut se l'offrir ; a 2,99 € on l'accepte, ajouter une verification cote worker si les fraudes se voient.
 *
 * Le site n'a pas de boutique : tout ici ne fait rien hors de l'appli.
 */
import { EST_NATIF } from './canal';

export const ID_SANS_PUBS = 'sans_pubs';
/** Evenement leve quand l'etat de l'achat change (acheté, restauré, retiré). */
export const SANS_PUBS_CHANGE = 'sprinter:sans-pubs';
const CLE = 'sprinter_sans_pubs';

export function sansPubs(): boolean {
  try { return localStorage.getItem(CLE) === '1'; } catch { return false; }
}
function poser(on: boolean) {
  if (on === sansPubs()) return;
  try { localStorage.setItem(CLE, on ? '1' : '0'); } catch { /* sans memoire : l'avantage revient au prochain lancement */ }
  window.dispatchEvent(new Event(SANS_PUBS_CHANGE));
}

export const boutiquePossible = () => EST_NATIF;

const greffon = () => import('@capgo/native-purchases');

/** Relit chez le store ce que le joueur possede. Garde la memoire si le store ne repond pas. */
export async function verifierAchats(): Promise<void> {
  if (!EST_NATIF) return;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await greffon();
    const { purchases } = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP,
      // iOS : seulement les droits en cours du compte Apple connecte (pas les remboursés, pas un autre compte)
      onlyCurrentEntitlements: true,
    });
    // Android : "1" = payé ; "0" = paiement en attente, pas encore valable. iOS : pas d'état, la présence suffit.
    poser(purchases.some(p => p.productIdentifier === ID_SANS_PUBS &&
      (p.purchaseState === undefined || p.purchaseState === '1')));
  } catch { /* store injoignable : on garde ce qu'on savait */ }
}

/** Le prix affiché par le store, dans la monnaie du joueur (null si inconnu). */
export async function prixSansPubs(): Promise<string | null> {
  if (!EST_NATIF) return null;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await greffon();
    const { product } = await NativePurchases.getProduct({ productIdentifier: ID_SANS_PUBS, productType: PURCHASE_TYPE.INAPP });
    return product.priceString || null;
  } catch { return null; }
}

/** Lance l'achat. Rend vrai si, au retour, le joueur possède bien l'offre. */
export async function acheterSansPubs(): Promise<boolean> {
  if (!EST_NATIF) return false;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await greffon();
    await NativePurchases.purchaseProduct({
      productIdentifier: ID_SANS_PUBS, productType: PURCHASE_TYPE.INAPP,
      // acquitté tout de suite : sinon Google rembourse l'achat au bout de 3 jours
      autoAcknowledgePurchases: true,
    });
  } catch { /* annulé ou refusé : on relit quand même, un achat peut avoir abouti */ }
  await verifierAchats();
  return sansPubs();
}

/** « Restaurer mes achats » (exigé par Apple) : nouveau téléphone, réinstallation. */
export async function restaurerAchats(): Promise<boolean> {
  if (!EST_NATIF) return false;
  try {
    const { NativePurchases } = await greffon();
    await NativePurchases.restorePurchases();
  } catch { /* on relit quand même */ }
  await verifierAchats();
  return sansPubs();
}
