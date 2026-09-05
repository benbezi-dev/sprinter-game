// Les notifications, et les deux chemins qu'elles empruntent.
//
// Ce module s'occupe de trois choses :
//   1. Demander la permission (une seule fois, au moment ou ca a du sens)
//   2. Obtenir de quoi joindre ce telephone, et l'envoyer au serveur
//   3. Rendre au jeu ce qui arrive quand on touche une notification
//
// DEUX TRANSPORTS, PARCE QUE DEUX MONDES. Sur le web, Web Push et une cle
// VAPID : le navigateur donne un abonnement, le serveur y depose une sonnerie,
// le service worker l'affiche. Cela marche sur Android dans Chrome, et sur
// iPhone a condition que le jeu ait ete ajoute a l'ecran d'accueil depuis
// Safari.
//
// Cela ne marche pas du tout dans l'application des magasins. Une WebView n'a
// pas d'API Push — ni WKWebView sur iOS, ni celle d'Android — et `PushManager`
// y est simplement absent. Le code web ci-dessous sortait donc immediatement,
// sans erreur et sans rien faire : tous ceux qui ont installe Sprinter depuis
// l'App Store ou le Play Store etaient injoignables, et rien ne le disait.
//
// D'ou le second chemin : Firebase Cloud Messaging, par le greffon natif.
// Le telephone rend un jeton, le serveur s'en sert, et le systeme affiche la
// notification meme jeu ferme. Les deux transports ne se croisent jamais —
// `EST_NATIF` tranche une fois pour toutes, au premier appel.
//
// LA PERMISSION N'EST PAS DEMANDEE AU CHARGEMENT. Une demande immediate est
// refusee par reflexe, et un refus sur iOS est definitif : on ne peut plus la
// reposer, jamais. Elle se pose apres une action qui en montre le sens — un
// premier resultat de course — et c'est App.tsx qui choisit le moment.

import { getDeviceId } from './leaderboard';
import { EST_NATIF } from './canal';
import { signalerCourrier, type Courrier } from './boite';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

// Cle publique VAPID (safe a exposer cote client).
const VAPID_PUBLIC_KEY = 'BAMcLBM4VSChNqcxJz6HMuByOxuFPUaHda7yHdEiHv4-6YIaksMxDYEVNHyjyQhsRUS20dCwi0d9p4flbKp9QM0';

/** La langue a laquelle ce joueur repond. Le serveur ecrit dedans. */
function langue(): string {
  try {
    const l = document.documentElement.lang || '';
    return l.toLowerCase().startsWith('en') ? 'en' : 'fr';
  } catch { return 'fr'; }
}

/** 'ios', 'android' — jamais 'web' ici, ce chemin ne s'ouvre que si EST_NATIF. */
function plateforme(): string {
  try {
    const c = (window as any).Capacitor;
    return (c && typeof c.getPlatform === 'function' ? c.getPlatform() : '') || 'inconnu';
  } catch { return 'inconnu'; }
}

/* -------------------------------------------------------------------------
   LE CHEMIN NATIF — Firebase Cloud Messaging
   ------------------------------------------------------------------------- */

/**
 * Le greffon n'est charge que sur un telephone.
 *
 * L'import est dynamique et garde par `EST_NATIF`, qui vaut `false` en dur
 * dans un build web : le morceau existe dans le paquet mais n'est jamais
 * demande, et le navigateur ne telecharge rien de Firebase.
 */
async function greffon() {
  const m = await import('@capacitor-firebase/messaging');
  return m.FirebaseMessaging;
}

let ecouteursPoses = false;

/**
 * Ce que devient une notification touchee, et une notification recue.
 *
 * Elle rentre dans le jeu par la meme porte que la boite WebSocket : un coup
 * de sonnette qui dit le GENRE de la nouvelle, jamais son contenu. L'ecran
 * concerne va chercher le reste par les routes ordinaires. C'est ce qui evite
 * d'avoir deux verites — une dans la notification, une sur le serveur — et de
 * devoir les reconcilier le jour ou elles divergent.
 *
 * Sans cela, toucher la notification ouvrait le jeu sur l'ecran d'accueil, et
 * le defi n'apparaissait qu'au sondage suivant : on est prevenu, on ouvre, et
 * il n'y a rien.
 */
async function poserEcouteurs(FM: Awaited<ReturnType<typeof greffon>>) {
  if (ecouteursPoses) return;
  ecouteursPoses = true;

  // Le jeton tourne : Firebase le renouvelle de lui-meme, et un jeton perime
  // ne dit rien quand on l'utilise — le push part, et personne ne le recoit.
  FM.addListener('tokenReceived', e => {
    if (e && e.token) enregistrerJeton(e.token).catch(() => { /* au prochain lancement */ });
  }).catch(() => { /* greffon indisponible */ });

  const relayer = (n: any) => {
    const t = n && n.data && (n.data as any).t;
    if (t) signalerCourrier(String(t) as Courrier);
  };

  FM.addListener('notificationActionPerformed', e => relayer(e.notification))
    .catch(() => { /* rien a faire de plus */ });
  // Jeu ouvert : aucune banniere ne s'affiche (voir capacitor.config.ts), mais
  // la nouvelle doit quand meme arriver a l'ecran qui l'attend.
  FM.addListener('notificationReceived', e => relayer(e.notification))
    .catch(() => { /* rien a faire de plus */ });
}

async function enregistrerJeton(jeton: string): Promise<void> {
  const device = getDeviceId();
  if (!device || !jeton) return;
  await fetch(`${API_BASE}/push/natif/abonner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: device, jeton, plateforme: plateforme(), langue: langue(),
    }),
  });
}

async function activerNatif(): Promise<void> {
  const FM = await greffon();

  let etat = await FM.checkPermissions();
  if (etat.receive !== 'granted' && etat.receive !== 'denied') {
    etat = await FM.requestPermissions();
  }
  if (etat.receive !== 'granted') return;

  await poserEcouteurs(FM);

  // Sur iOS, ce jeton n'arrive qu'apres l'aller-retour avec APNs, et cet
  // aller-retour n'aboutit que si AppDelegate.swift reposte ce que le systeme
  // lui donne. Si la promesse ne rend jamais rien, c'est la qu'il faut
  // regarder — pas ici.
  const { token } = await FM.getToken();
  await enregistrerJeton(token);
}

async function desactiverNatif(): Promise<void> {
  const device = getDeviceId();
  if (device) {
    await fetch(`${API_BASE}/push/natif/desabonner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: device }),
    }).catch(() => { /* non bloquant */ });
  }
  try {
    const FM = await greffon();
    await FM.deleteToken();
  } catch { /* rien a supprimer */ }
}

async function natifActif(): Promise<boolean> {
  try {
    const FM = await greffon();
    const etat = await FM.checkPermissions();
    return etat.receive === 'granted';
  } catch { return false; }
}

/* -------------------------------------------------------------------------
   LE CHEMIN WEB — Web Push et VAPID
   ------------------------------------------------------------------------- */

// Rend un `ArrayBuffer` et non un `Uint8Array` : `applicationServerKey`
// attend un `BufferSource` adosse a un vrai `ArrayBuffer`, quand
// `Uint8Array.from` rend une vue dont le tampon peut aussi bien etre partage.
// Les deux se ressemblent a l'execution ; seul le second passe la compilation.
function cleEnOctets(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const octets = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) octets[i] = raw.charCodeAt(i);
  return octets.buffer;
}

async function enregistrerAbonnement(sub: PushSubscription): Promise<void> {
  const device = getDeviceId();
  if (!device) return;
  await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: device, subscription: sub.toJSON(), langue: langue(),
    }),
  });
}

async function activerWeb(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  let permission: NotificationPermission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await enregistrerAbonnement(existing);
    return;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cleEnOctets(VAPID_PUBLIC_KEY),
  });
  await enregistrerAbonnement(sub);
}

async function desactiverWeb(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const device = getDeviceId();
  if (device) {
    await fetch(`${API_BASE}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: device }),
    }).catch(() => { /* non bloquant */ });
  }
  await sub.unsubscribe();
}

/**
 * Redit au serveur ou joindre ce navigateur, sans jamais rien demander.
 *
 * Un abonnement Web Push n'est pas acquis une fois pour toutes, contrairement
 * a ce que le code d'avant supposait : il n'etait porte au serveur qu'une
 * fois, apres la premiere course d'une session, et plus jamais ensuite.
 *
 * Or deux choses arrivent, et arrivent surtout aux installations anciennes :
 *
 * - le navigateur remplace l'abonnement (mise a jour de Chrome, menage du
 *   service de push). Le service worker le repare de son cote, quand il est
 *   reveille ; ici on repare meme s'il ne l'a pas ete ;
 * - la permission reste accordee mais L'ABONNEMENT A DISPARU. C'est l'etat le
 *   plus traitre : `Notification.permission` vaut toujours `granted`, le jeu
 *   se croit joignable, l'ecran des reglages dit que tout va bien, et rien
 *   n'arrive jamais. On le refait alors — sans rien demander, la permission
 *   est deja la.
 *
 * Silencieuse de bout en bout : sans permission deja accordee, elle sort tout
 * de suite, et ne montre donc jamais de fenetre au lancement.
 */
async function rafraichirWeb(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  const existant = await reg.pushManager.getSubscription();
  if (existant) { await enregistrerAbonnement(existant); return; }

  const neuf = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cleEnOctets(VAPID_PUBLIC_KEY),
  });
  await enregistrerAbonnement(neuf);
}

let ecouteWebPosee = false;

/**
 * Ce que devient une notification web touchee.
 *
 * Elle rentre dans le jeu par la meme porte que la boite WebSocket — un coup
 * de sonnette qui dit le genre de la nouvelle, jamais son contenu — et l'ecran
 * concerne va chercher le reste par les routes ordinaires. Exactement ce que
 * fait le chemin natif, par un autre tuyau.
 *
 * Deux tuyaux, parce qu'il y a deux situations. Fenetre deja ouverte : le
 * service worker lui parle directement. Fenetre a ouvrir : le genre voyage
 * dans l'adresse, parce qu'au moment ou la page demarre elle n'a pas encore
 * de service worker a qui parler. On efface alors le parametre — sans quoi un
 * rechargement, ou un retour en arriere, refait sonner une nouvelle vieille
 * d'une heure.
 */
function ecouterWeb() {
  if (ecouteWebPosee) return;
  ecouteWebPosee = true;

  try {
    const url = new URL(window.location.href);
    const genre = url.searchParams.get('sonnerie');
    if (genre) {
      url.searchParams.delete('sonnerie');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      signalerCourrier(genre as Courrier);
    }
  } catch { /* adresse illisible : rien a relayer */ }

  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', ev => {
    const m = ev.data;
    if (m && m.sprinter === 'courrier' && m.t) signalerCourrier(String(m.t) as Courrier);
  });
}

async function webActif(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/* -------------------------------------------------------------------------
   CE QUE LE JEU APPELLE
   ------------------------------------------------------------------------- */

/**
 * Demande la permission, puis fait savoir au serveur ou joindre ce telephone.
 *
 * Sans effet si le joueur a deja refuse, ou si rien de tout cela n'existe la
 * ou le jeu tourne. Ne leve jamais : une notification est un confort, et un
 * confort ne casse pas une partie.
 */
export async function activerPush(): Promise<void> {
  try { await (EST_NATIF ? activerNatif() : activerWeb()); }
  catch { /* un telephone injoignable reste un telephone qui joue */ }
}

/**
 * Redit au serveur ou joindre ce telephone, sans jamais rien demander.
 *
 * Un jeton Firebase n'est pas acquis une fois pour toutes : il tourne. Il
 * change a une reinstallation, a une restauration de sauvegarde, quand
 * l'application reste des mois sans etre ouverte — et le serveur ne l'apprend
 * pas : il continue d'envoyer vers un jeton mort, Google accepte, et personne
 * ne recoit rien. Rien dans les journaux ne le dit non plus.
 *
 * D'ou cet appel au lancement. Il ne montre aucune fenetre et ne demande
 * aucune permission : sans permission deja accordee, il ne fait rien du tout.
 * C'est `activerPush` qui demande, au moment choisi par App.tsx.
 *
 * Sur le web, la meme chose pour les memes raisons. On a longtemps cru le
 * contraire — « un abonnement Web Push ne se perime pas » — et c'etait faux :
 * il est remplace, il disparait pendant que la permission reste accordee, et
 * rien a l'ecran ne le dit. `rafraichirWeb` s'en charge. L'appel branche aussi
 * l'ecoute du service worker, pour qu'une notification touchee ouvre le bon
 * ecran.
 */
export async function reprendrePush(): Promise<void> {
  if (!EST_NATIF) {
    ecouterWeb();
    // Et on redit au serveur ou joindre ce navigateur — voir `rafraichirWeb`
    // pour les deux facons dont un abonnement web se perd en silence.
    await rafraichirWeb().catch(() => { /* on retentera au prochain lancement */ });
    return;
  }
  try {
    const FM = await greffon();
    const etat = await FM.checkPermissions();
    if (etat.receive !== 'granted') return;
    await poserEcouteurs(FM);
    const { token } = await FM.getToken();
    await enregistrerJeton(token);
  } catch { /* on retentera au prochain lancement */ }
}

/** Coupe les notifications pour cet appareil. */
export async function desactiverPush(): Promise<void> {
  try { await (EST_NATIF ? desactiverNatif() : desactiverWeb()); }
  catch { /* rien a couper, ou deja coupe */ }
}

/** Ce telephone est-il joignable ? Sert a l'affichage, jamais a une decision. */
export async function pushActif(): Promise<boolean> {
  return EST_NATIF ? natifActif() : webActif();
}
