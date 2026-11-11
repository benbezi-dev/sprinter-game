// LA COURSE EN VRAIE 3D — les plans de camera, le survol et le soleil qui suit la camera (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { OCCULTANTS } from '../amsalem-3d';
import { creuserTapis, zSol, auBordDeLaPiste, SURVOL_SALLE } from '../salle-3d';
import { Q, DOS, RECUL, COTE, HAUT, P_DEBUT, P_FIN, P_ARRIERE, P_LOIN, LANE_W, P_HAUT, SURVOL, R_CORDE } from './reglages';
import { camera, _a, _b, renderer, champBase, soleil } from './scene';
import { ouCourt, capIci, virageApres, ici, sx, salleActive } from './repere';
import { presente, finCam, presenteOu, finVise } from './salle-noire';
import { profilBas, finaleVue, toitsStade, cameraSalle, blocsSalle, amsalemActif } from './stade';
import { nCouloirs } from '../course-3d';

// LES PLANS DE CAMERA (« plusieurs plans de camera sur les courses, choisis au hasard » ;
// « garde cette vue aussi », « alterne entre les vues », l'auteur, 23/10) : la camera 3D (a la
// nuit du molosse, sa poursuite) et celle du jeu 2D. Tire a chaque decompte, jamais deux fois
// le meme de suite ; ?plan=3d, ?plan=2d ou ?plan=rail l'impose.
const PLANS = ['3d', '2d', 'rail'] as const;
export let planCam: typeof PLANS[number] = PLANS[Math.floor(Math.random() * PLANS.length)], planPour: unknown = null;
// le rail : ou il centre le peloton (metres devant le joueur) et de combien il recule
let railPret = false, railC = 0, railD = 10;
// l'etirement horizontal de la vue 2D (voir LE PIXEL DU 2D N'EST PAS CARRE)
let etire2D = 1;
// le champ du plan 2D : etroit, pour tenir l'echelle fixe de l'axonometrie
const CHAMP_2D = 28;
// une entree de boss a eu lieu dans ce decompte : pas de survol (voir rendre)
let entreeVue = false;
const camPos = new THREE.Vector3(), camVise = new THREE.Vector3();
const BORD_CADRE = 0.82, _joueur = new THREE.Vector3(), _viseCadre = new THREE.Vector3(), _ndc = new THREE.Vector3();
const _rayon = new THREE.Ray(), _touche = new THREE.Vector3();
let corrCadre = 0;
let camPret = false;
export function lacherLaCamera() { camPret = false; }
let secousse = 0, etatVu = '';
export const soleilDecal = new THREE.Vector3(-10, -18, 30), solCam = new THREE.Vector3(), _solVoulu = new THREE.Vector3();
let solPret = false;
// LE SURVOL d'avant-course (voir rendre) : ou il en est, et ou il plonge
let volLance = false, volT = 0, volPlonge = -1;
const volDepart = new THREE.Vector3(), volVise0 = new THREE.Vector3();
let profilDecal = 0, profilEcart = 0, profilPret = false, profilB = 0;
const _c3 = new THREE.Vector3(), _d3 = new THREE.Vector3();

let finActive = false;
let creuxVu = false;   // (le tapis du 60 m, creuserTapis)
/** La camera de l'image : ou elle se tient, ce qu'elle vise, le soleil qui la suit. Rend le coureur suivi. */
export function cadrer(G: any, T: any, dt: number, nuitDuMolosse: boolean) {
  // LA CAMERA, derriere le joueur dans l'axe de son couloir, un peu en hauteur
  // (en meute, un mordu regarde la poursuite : la camera suit sa proie, `G.suivi`, comme le 2D)
  const pl = G.spectateur && G.suivi ? G.suivi : G.player;
  // un plan par course : la piste est neuve a chaque depart (le moteur 3D ne voit pas les ecrans d'entre deux)
  if ((G.state === 'count' || G.state === 'race') && planPour !== G.track) {
    planPour = G.track;
    const force = Q.get('plan') as any;
    // la ruelle du molosse est bordee de murs : pas de rail. ET LE RAIL VEUT UN ECRAN LARGE (« garde ce
    // plan pour le smartphone en paysage, la tablette ou le pc portable », l'auteur, 24/10) : un
    // telephone tenu droit ne le tire plus (?plan=rail l'impose encore)
    const large = camera.aspect >= 1 || Math.min(innerWidth, innerHeight) >= 600;
    const autres = PLANS.filter(k => k !== planCam && !(k === 'rail' && (nuitDuMolosse || !large)));
    planCam = PLANS.includes(force) ? force : autres[Math.floor(Math.random() * autres.length)];
  }
  const plan2D = !DOS && planCam === '2d', rail = !DOS && planCam === 'rail' && !nuitDuMolosse;
  if (pl) {
    const p = ouCourt(T, pl);
    // Centree sur le couloir du joueur, decalee vers la corde (couloir 1), la tribune en face :
    // il est au milieu de l'image, ses voisins des deux cotes. Dans un virage, elle tourne
    // avec lui. Y retourne : voir `monde`.
    const h = capIci(T.heading(pl.d, pl.lane)) - virageApres(T, pl.lane, pl.d);
    const ax = Math.cos(h), ay = Math.sin(h), ix = Math.sin(h), iy = -Math.cos(h);   // devant, vers la corde
    const voulu = _a.set(p[0] - RECUL * ax + COTE * ix, -(p[1] - RECUL * ay + COTE * iy), HAUT);
    // le point vise prolonge la droite camera -> joueur : il reste au centre de l'image
    const loin = DOS ? 14 : 7, kc = COTE * loin / RECUL;
    const vise = _b.set(p[0] + loin * ax - kc * ix, -(p[1] + loin * ay - kc * iy), DOS ? 0.9 : 0.6);
    // LE PROFIL (l'auteur, 22/10 : « le depart part comme actuellement et au fur et a
    // mesure de la course passe en vue de profil pour qu'on voie l'ecart entre les
    // joueurs »). Le depart garde notre camera ; de 8 a 92 % de la course (« trop
    // rapide » sur 6-31 %, puis « se bloque trop tot » a 60 % — l'auteur, 22/10), elle
    // glisse cote pelouse, face aux couloirs, la tribune derriere eux — le plan de la
    // camera sur rail des retransmissions. Elle cadre ses voisins, sept metres devant
    // et derriere lui au plus — au-dela, en portrait, les coureurs deviendraient des
    // points : l'ecart au premier, lui, reste ecrit dans le bandeau.
    const total = T.total || 100;
    // SUR UN TOUR (200, 400 m), LE PROFIL SUIT LA PISTE : entier dans les lignes droites,
    // a moitie dans les virages — de profil, un virage sort du cadre —, et la camera
    // pivote doucement de l'un a l'autre (« sur les lignes droites, pas assez de profil »,
    // l'auteur, 22/10). Le 100 m garde sa lente glissade.
    let cible: number;
    if (T.curved) {
      const v = Math.min(1, Math.max(0, (pl.d - 0.03 * total) / (0.08 * total)));
      cible = v * v * (3 - 2 * v) * (T.lean(pl.d, pl.lane, 1) ? 0.5 : 1);
    } else {
      const u = Math.min(1, Math.max(0, (pl.d - P_DEBUT * total) / ((P_FIN - P_DEBUT) * total)));
      cible = u * u * (3 - 2 * u);
    }
    if (pl.d < 0.5 || !T.curved) profilB = cible;
    else profilB += (cible - profilB) * Math.min(1, (dt || 0.016) * 0.7);
    const b = profilB;
    if (b <= 0) profilPret = false;
    if (b > 0 && !DOS && !plan2D && !rail && !nuitDuMolosse) {
      let dMin = pl.d, dMax = pl.d;
      for (const r of G.runners) if (r && r.look && !r.retour) { dMin = Math.min(dMin, r.d); dMax = Math.max(dMax, r.d); }
      dMin = Math.max(dMin, pl.d - 7); dMax = Math.min(dMax, pl.d + 7);
      // le joueur d'abord : le cadre ne va qu'a mi-chemin vers le milieu de ses voisins
      // le recentrage et le recul se font lentement : un voisin qui entre dans le cadre
      // ou en sort ne fait plus sauter le plan
      const k = Math.min(1, (dt || 0.016) * 1.1);
      const decalVoulu = 1.5 + ((dMin + dMax) / 2 - pl.d) * 0.5, ecartVoulu = dMax - dMin + 4;
      if (!profilPret) { profilDecal = decalVoulu; profilEcart = ecartVoulu; profilPret = true; }
      profilDecal += (decalVoulu - profilDecal) * k; profilEcart += (ecartVoulu - profilEcart) * k;
      const centre = pl.d + profilDecal, ecart = profilEcart;
      const milieu = (nCouloirs - 1) / 2;
      const f = ici(T.pos(centre, milieu)), hf = capIci(T.heading(centre, milieu));
      const fx = Math.sin(hf), fy = -Math.cos(hf);                 // vers la pelouse
      // EN PORTRAIT, UN PROFIL DE TROIS QUARTS. Le champ horizontal d'un telephone tenu
      // droit ne fait qu'une trentaine de degres : de profil pur, la piste n'etait plus
      // qu'une bande au milieu de l'ecran et les coureurs des points (mesure du 22/10,
      // 375 x 812). Un peu en arriere et plus haute, la camera range l'ecart dans la
      // profondeur — le premier en haut, les suivants plus bas. Ecran large : profil pur.
      // plus de profil et plus haut que le premier essai (0,55 et 5,4 m : « manque de
      // hauteur ou plus une vue de profil ») : de haut, la piste garde sa place a l'image
      const arriere = camera.aspect >= 1 ? 0 : P_ARRIERE;
      const demiChamp = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      // « trop loin » a 11-22 m (l'auteur, 22/10) : 8 a 14 m en portrait, 8 a 18 m en large
      const D = P_LOIN * (arriere ? Math.min(14, Math.max(8, 5 + ecart * 0.5))
        : Math.min(18, Math.max(8, ecart / (2 * Math.tan(demiChamp)) + nCouloirs * LANE_W / 2)));
      const ax2 = Math.cos(hf), ay2 = Math.sin(hf);
      const lat = Math.sqrt(1 - arriere * arriere);
      voulu.lerp(_c3.set(f[0] + (fx * lat - ax2 * arriere) * D, -(f[1] + (fy * lat - ay2 * arriere) * D), camera.aspect >= 1 ? 4.2 : profilBas ? 3.4 : P_HAUT), b);
      // visant sous les coureurs : ils montent dans l'image, au-dessus des touches
      vise.lerp(_d3.set(f[0] + ax2 * arriere * 3, -(f[1] + ay2 * arriere * 3), camera.aspect >= 1 ? -0.6 : profilBas ? 1.3 : 0), b);
    }
    // LE PLAN DU JEU 2D (« garde le plan de camera du jeu 2D et integre-le dans la version 3D »,
    // l'auteur, 23/10 ; les nuits du molosse le gardent toujours). La projection du 2D
    // (sprinter-app.js, ground) regarde le monde en diagonale, de l'angle de `C.ISO_*` (26,6° au
    // sprint, celui de la nuit au molosse), a l'echelle de scaleM : la camera se tient dans la
    // diagonale du monde 2D (tourne de 14° sur un tour, comme lui), vise comme lui le couloir 3 a
    // la hauteur du coureur, au centre de l'image, et un champ etroit de loin tient l'echelle
    // a peu pres fixe, comme l'axonometrie.
    if (plan2D) {
      const Cj = (globalThis as any).SprinterApp?.C;
      const deg = Cj ? Math.atan2(Cj.ISO_SIN, Cj.ISO_COS) : Math.atan(0.5);
      // LA HAUTEUR EXACTE DE LA VUE 2D (tools/blender/decors/vue.py) : une orthographique qui
      // regarde le long de (1, 1, -2 sin) — tan(hauteur) = racine2 . sin(angle), 32,3° au sprint.
      // L'ancienne formule, asin(tan), tombait juste au sprint (30°) mais a 7° la nuit au lieu
      // de 9,8° : le plan 2D du molosse se couchait au ras du sol, comme la camera de depart
      // (« elle n'a pas recupere le plan de la 2D », l'auteur, 23/10). Voir aussi `etire2D`.
      const elev = Math.atan(Math.SQRT2 * Math.sin(deg));
      etire2D = Math.cos(deg) * Math.SQRT2 / Math.sqrt(2 * Math.sin(deg) ** 2 + 1);
      const VW = renderer!.domElement.clientWidth || 375, VH = renderer!.domElement.clientHeight || 812;
      const ui = Math.max(0.62, Math.min(1.7, Math.min(VW / 430, VH / 660)));
      const haut = VH / (ui * (G.race && G.race.arc > 0 ? 44 : 30) * (G.zoomMode || 1));
      const D = haut / (2 * Math.tan(CHAMP_2D * Math.PI / 360));
      // vers la camera : (-1, -1) dans le repere tourne du 2D, ramene au monde, puis en 3D
      const rot = T.curved ? -14 * Math.PI / 180 : 0, wc = Math.cos(rot), ws = Math.sin(rot);
      const dx = sx * (-wc - ws) / Math.SQRT2, dy = sx * (ws - wc) / Math.SQRT2;
      const c = ici(T.pos(pl.d, pl.lane));
      voulu.set(c[0] + dx * D * Math.cos(elev), -(c[1] + dy * D * Math.cos(elev)), D * Math.sin(elev));
      vise.set(c[0], -c[1], 0);
    }
    // LA CAMERA SUR RAIL des finales olympiques (« ajoute ce type de plan de camera », l'auteur,
    // 23/10, d'apres la vue de cote des 100 m de 2008-2016) : cote pelouse, a hauteur d'homme,
    // elle roule avec le joueur, un peu devant lui — il vient vers elle, de trois quarts —, au
    // teleobjectif, la tribune en fond ; les couloirs interieurs passent devant elle.
    // TOUT LE PELOTON DANS LE CADRE (« un cadrage qui permet de voir tout le monde dans la course
    // en direct », l'auteur, 23/10) : elle mesure le peloton le long de la piste, du dernier au
    // premier — le decalage des couloirs en virage compris —, se tient au milieu et recule juste
    // assez pour qu'il tienne dans l'image ; recul et centre glissent, sans a-coup.
    if (rail) {
      const axe = (nCouloirs - 1) / 2, s0 = Math.max(0, pl.d);
      const f0 = ici(T.pos(s0, axe)), hf = capIci(T.heading(s0, axe));
      const tx = Math.cos(hf), ty = Math.sin(hf), nx = Math.sin(hf), ny = -Math.cos(hf);
      const qj = ouCourt(T, pl), sj = (qj[0] - f0[0]) * tx + (qj[1] - f0[1]) * ty;
      let sMin = sj, sMax = sj;
      for (const r of G.runners) if (r && r.look && !r.retour) {
        const q = ouCourt(T, r), s = (q[0] - f0[0]) * tx + (q[1] - f0[1]) * ty;
        sMin = Math.min(sMin, s); sMax = Math.max(sMax, s);
      }
      // UNE FENETRE DE 24 M AUTOUR DU JOUEUR (« meme probleme et pire », l'auteur, 24/10, sur un 400 m
      // couche avec 90 m d'avance) : le peloton entier tant qu'il est groupe ; etale, la camera reculait
      // jusqu'a 60 m et les coureurs n'etaient plus que des points
      sMin = Math.max(sMin, sj - 12); sMax = Math.min(sMax, sj + 12);
      // EN PORTRAIT, DE TROIS QUARTS ARRIERE ET PLUS HAUT : de pur profil, un peloton etale ne
      // tenait dans un telephone tenu droit qu'a 60 m, les coureurs en points ; de biais, l'ecart
      // passe dans la profondeur (le premier en haut). Ecran large : profil pur.
      const portrait = camera.aspect < 1, biais = portrait ? 0.6 : 0, cb = Math.cos(biais), sb = Math.sin(biais);
      // ecran large : un champ plus ouvert et plus de marge (« agrandis la zone de la camera », 24/10)
      const demiH = Math.atan(Math.tan((portrait ? 40 : 32) * Math.PI / 360) * camera.aspect);
      // EN PAYSAGE, LE CLASSEMENT COUVRE LE TIERS GAUCHE (24/10 : le joueur y passait dessous). Au rail,
      // on court vers la gauche de l'image : la camera vise un peu devant, et la course tient dans les
      // sept dixiemes de droite.
      const utile = portrait ? 1 : 0.7, devant = portrait ? 0 : 0.13;
      const Dv = Math.min(portrait ? 40 : 60, Math.max(portrait ? 8 : 10, ((sMax - sMin) * cb + (portrait ? 6 : 10)) / (2 * Math.tan(demiH) * utile)));
      const cv = (sMin + sMax) / 2 + 0.8 + devant * 2 * Dv * Math.tan(demiH);
      if (!railPret) { railC = cv; railD = Dv; railPret = true; }
      const k = Math.min(1, (dt || 0.016) * 1.5);
      railC += (cv - railC) * k; railD += (Dv - railD) * k;
      const cx = f0[0] + tx * railC, cy = f0[1] + ty * railC;
      // de plus loin, un peu plus haut : les couloirs interieurs ne cachent pas tout le reste
      const vx = nx * cb - tx * sb, vy = ny * cb - ty * sb;
      // ecran large : plus haut et visant plus bas — a hauteur d'homme, les tribunes prenaient les deux
      // tiers de l'image et la piste n'etait qu'une bande derriere les touches
      voulu.set(cx + vx * railD, -(cy + vy * railD), portrait ? 2 + railD * 0.22 : 1.6 + railD * 0.14);
      vise.set(cx, -cy, portrait ? 1.0 : 0.5);
    } else railPret = false;
    // LA NUIT DU MOLOSSE, L'AUTRE PLAN : UNE CAMERA DE POURSUITE (« recree l'evenement le molosse
    // en full 3D », l'auteur, 23/10). De face, le coureur vient vers nous et la bete grandit dans
    // son dos, les yeux dans la brume. Le depart garde notre camera, la bascule se fait sur les
    // six premiers metres ; plus la bete est loin, plus la camera recule et vise derriere.
    if (nuitDuMolosse && !DOS && !plan2D && !rail) {
      const ch = G.obstacles && G.obstacles.molosse ? G.obstacles.chasse : null;
      const e = ch ? Math.min(22, Math.max(0, pl.d - ch.d)) : 12;
      const v = Math.min(1, Math.max(0, pl.d / 6)), nb = v * v * (3 - 2 * v);
      const av = 6.2 + e * 0.12, cote = 1.8;
      voulu.lerp(_c3.set(p[0] + av * ax + cote * ix, -(p[1] + av * ay + cote * iy), 3.1 + e * 0.04), nb);
      vise.lerp(_d3.set(p[0] - e * 0.3 * ax, -(p[1] - e * 0.3 * ay), 0.8), nb);
    }
    // LE GENERIQUE DANS LA SALLE (scene-generique.ts, poserLeTourDHonneur) : le champion trotte a rebours, la camera
    // le precede, de face, un peu cote pelouse et en hauteur — un salut se regarde de face. Elle y glisse depuis le sacre.
    if (G.state === 'cut' && G.cut && G.cut.kind === 'ending') {
      // posee SUR la piste, deux couloirs et demi plus a l'interieur : sur la tangente, l'anneau la sortait au virage et le
      // muret la ramenait contre lui
      const D = camera.aspect < 1 ? 7 : 6, q = ici(T.pos(Math.max(0, pl.d - D), Math.max(0, (pl.lane | 0) - 2.5)));
      voulu.set(q[0], -q[1], 2.6);
      vise.set(p[0], -p[1], 1.1);
    }
    // LE SURVOL D'AVANT-COURSE (« avant chaque course, un tour de stade pour le presenter
    // pendant qu'on presente l'adversaire ; une camera plongeante qui part du ciel vers le
    // point de depart en douceur », l'auteur, 22/10). Pendant la presentation (cinematique
    // `intro`), la camera tourne lentement au-dessus du stade ; quand le decompte commence
    // — ou tout de suite s'il n'y a pas de presentation —, elle plonge en 1,8 s sur la
    // camera de depart, qu'elle rejoint exactement, avant le coup de pistolet.
    // L'ENTREE DU BOSS, LE CRI DE MEBA (engine.ts, viserLEntree, applaudir) : le moteur pose
    // `viseCamera` et `zoomPres` — un plan serre, a hauteur d'homme, face a lui, cote pelouse.
    // Pas de survol ce decompte-la : de son entree, la camera glisse droit sur celle du depart.
    // (24/10) la presentation de celui qui crie commence avec sa sequence d'avant-depart, pas au
    // moment ou le moteur pose sa camera (0,6 s plus tard) : on le voit plus longtemps
    const criEnCours = G.state === 'count' && !!(G.avantDepart && G.avantDepart.cri && G.avantDepart.reste > 0);
    const entree = G.state === 'count' && (typeof G.viseCamera === 'function' || criEnCours) && !nuitDuMolosse;
    if (entree) {
      entreeVue = true;
      // le cri arrive pendant le survol deja lance : le survol cede, la camera glisse vers lui
      if (volLance) volPlonge = -2;
      const z = Math.max(1, G.zoomPres || 1.6);
      const nom = G.avantDepart && G.avantDepart.entree && G.avantDepart.entree.coureur;
      // CELUI QUI CRIE (engine.ts, applaudir : la camera du cri porte `.cri`) : celui qui applaudit et
      // n'est pas le joueur. Sans cela la camera retombait sur notre coureur, en plan serre (« la
      // presentation, on ne le voit pas assez », l'auteur, 24/10)
      const crieur = ((G.viseCamera as any)?.cri || criEnCours) ? (G.runners || []).find((r: any) => r.look && r.look.clap && !r.isPlayer) : null;
      const lui = (nom && (G.runners || []).find((r: any) => r.name === nom)) || crieur || G.presente || pl;
      // lui, au centre : le moteur vise en 2D un point de son couloir ; en 3D, c'est son corps
      const c = ouCourt(T, lui), h = capIci(T.heading(Math.max(0, lui.d || 0), lui.lane | 0)) - virageApres(T, lui.lane | 0, Math.max(0, lui.d || 0));
      const ex = Math.sin(h), ey = -Math.cos(h), axe = Math.cos(h), aye = Math.sin(h);
      if (crieur && lui === crieur) {
        // SA PRESENTATION : dans son couloir, devant lui et face a lui — ses voisins restent sur les
        // cotes au lieu de passer devant —, assez loin pour le voir en pied, poings au ciel compris,
        // et un lent travelling qui tourne autour de lui pendant qu'il crie et applaudit
        const tt = (G.avantDepart && G.avantDepart.t) || 0, D = camera.aspect < 1 ? 4.8 : 4.0;
        const tour = 0.32 + 0.3 * Math.sin(tt * 0.55 - 0.6), dx = axe * Math.cos(tour) + ex * Math.sin(tour), dy = aye * Math.cos(tour) + ey * Math.sin(tour);
        voulu.set(c[0] + dx * D, -(c[1] + dy * D), 1.45 + 0.15 * Math.sin(tt * 0.4));
        vise.set(c[0], -c[1], 1.15);
      } else {
        const D = 11 / z;
        voulu.set(c[0] + ex * D + axe * D * 0.3, -(c[1] + ey * D + aye * D * 0.3), 1.6);
        vise.set(c[0], -c[1], 1.0);
      }
    }
    // LA FINALE : pendant la presentation, la camera cadre le nom qui s'ecrit dans le couloir, de haut et
    // de cote (la tribune), comme les plans de Doha — mais au ras de la salle
    if (finaleVue && presente >= 0 && (G.state === 'count' || (G.state === 'cut' && G.cut && G.cut.kind === 'intro'))) {
      const h = capIci(T.heading(7, presente)), ex = Math.sin(h), ey = -Math.cos(h), ax = Math.cos(h), ay = Math.sin(h);
      // en portrait le champ est etroit : plus loin, plus haut, plus en arriere, sinon le nom (9 m) sort du cadre
      const recul = camera.aspect < 1 ? 9 : 5, cote = camera.aspect < 1 ? 12 : 9, haut = camera.aspect < 1 ? 10 : 6.5;
      finCam.set(presenteOu.x - ax * recul + ex * cote, -(presenteOu.y - ay * recul + ey * cote), haut);
      finVise.set(presenteOu.x + ax * 1, -(presenteOu.y + ay * 1), 0);
      finActive = true;
    } else finActive = false;
    // (le tapis du 60 m s'enfonce sous ceux qui le frappent)
    const auTapis = G.ghost && (G.runners || []).indexOf(G.ghost.runner) < 0 ? (G.runners || []).concat([G.ghost.runner]) : G.runners || [];
    if (salleActive && auTapis.some((r: any) => r.creuxTapis != null)) {
      const creux = auTapis.filter((r: any) => r.creuxTapis > 0).map((r: any) => ({ y: ouCourt(T, r)[1], p: r.creuxTapis }));
      if (creux.length || creuxVu) creuserTapis(creux);
      creuxVu = creux.length > 0;
    }
    // dans la salle, la camera monte avec le relevement du virage (vise et voulu : _b et _a, y retourne)
    if (salleActive) {
      // (la camera de course ne passe pas le muret : derriere, les gradins et la coursive)
      if (!(G.state === 'cut' && G.cut && G.cut.kind === 'intro')) { const q = auBordDeLaPiste(_a.x, -_a.y); _a.x = q[0]; _a.y = -q[1]; }
      // CHACUN SUR LE SOL SOUS LUI (« on ne ressent pas les montees et descentes sur l'anneau », l'auteur,
      // 27/10) : montes d'une meme hauteur, camera et visee glissaient sans s'incliner — la pente ne se
      // voyait pas. La camera reste a sa place (plateau ou releve), le coureur monte devant elle.
      _a.z += zSol(_a.x, -_a.y); _b.z += zSol(_b.x, -_b.y);
    }
    if (G.state !== 'count' && G.state !== 'race' && G.state !== 'falseout') entreeVue = false;
    const intro = G.state === 'cut' && G.cut && G.cut.kind === 'intro';
    // pas de survol pour la nuit du molosse (« pas de vue aerienne de presentation », l'auteur, 23/10)
    const avant = (intro || G.state === 'count') && !nuitDuMolosse && !entreeVue && !(finaleVue && presente >= 0);
    if (!avant && G.state !== 'race' && G.state !== 'falseout') { volLance = false; volPlonge = -1; }
    if (avant && !volLance) { volLance = true; volT = 0; volPlonge = -1; }
    let survol = false;
    // volPlonge : -1 avant la plongee, son instant pendant, -2 une fois finie
    if (volLance && !SURVOL && volPlonge !== -2) {
      volT += dt || 0.016;
      const cx = salleActive ? SURVOL_SALLE.cx : 44, cy = salleActive ? -SURVOL_SALLE.cy : R_CORDE;   // le centre du stade (y retourne : voir monde)
      const tourne = (t: number) => -2.3 + t * 0.32;        // un lent tour de piste, vu de haut
      // dans la salle, sous le toit : un tour du plateau a hauteur de coursive haute
      const orbite = (t: number) => salleActive
        ? _c3.set(cx + Math.cos(tourne(t)) * SURVOL_SALLE.rx, cy + Math.sin(tourne(t)) * SURVOL_SALLE.ry, SURVOL_SALLE.z)
        : _c3.set(cx + Math.cos(tourne(t)) * 125, cy + Math.sin(tourne(t)) * 95, 62 - Math.min(12, t * 1.5));
      if (!intro && volPlonge === -1) {
        // la presentation est finie (ou n'existe pas) : la plongee commence, d'ou l'on est
        volPlonge = volT;
        volDepart.copy(orbite(volT)); volVise0.set(cx, cy, 0);
      }
      const DUREE = 1.8;   // finie avant « prets » : le decompte est court
      const u = volPlonge === -1 ? 0 : Math.min(1, (volT - volPlonge) / DUREE);
      if (u < 1) {
        const e = u * u * u * (u * (u * 6 - 15) + 10);       // tres doux aux deux bouts
        if (volPlonge === -1) { camPos.copy(orbite(volT)); camVise.set(cx, cy, 0); }
        else {
          camPos.lerpVectors(volDepart, voulu, e);
          camPos.z += Math.sin(u * Math.PI) * (salleActive ? SURVOL_SALLE.bosse : 6);   // la plongee s'arrondit (sous le toit, a peine)
          camVise.lerpVectors(volVise0, vise, e);
        }
        camPret = true;
        survol = true;
      } else volPlonge = -2;                                // fini : la camera de course reprend
    }
    if (!survol) {
      // le rail roule avec le peloton, ses cibles glissent deja (railC, railD) : lisse en plus, il trainait d'un metre et demi
      const lisse = camPret && !(rail && G.state === 'race') ? 1 - Math.exp(-(dt || 0.016) * 6) : 1;
      camPos.lerp(voulu, lisse); camVise.lerp(vise, lisse);
      camPret = true;
    }
    // LE TOURNAGE (28/10, la video du club de Val-de-Reuil) : un harnais peut poser sa propre camera
    // (globalThis.__tournage.camera(camPos, camVise, vise, G, dt, p) ; reperes du monde, y retourne ; p : le joueur, repere 2D). Rien sans lui.
    const tournage = (globalThis as any).__tournage;
    // (la finale : ce cadrage passe avant la cinematique de presentation)
    if (finActive) { camPos.copy(finCam); camVise.copy(finVise); }
    if (tournage?.camera) { tournage.camera(camPos, camVise, vise, G, dt || 0.016, p); survol = survol || !!tournage.survol; }
    camera.position.copy(camPos);
    // le toit des tribunes s'efface quand la camera le survole (vue 2D), jamais pendant le survol d'avant-course
    if (toitsStade.length) for (const t of toitsStade) t.obj.visible = survol || camera.position.z < t.zTop - 0.3;
    // (y retourne : voir monde) — l'exterieur ne se montre qu'au survol, camera dehors
    if (salleActive && cameraSalle) cameraSalle(camera.position.x, -camera.position.y, camera.position.z, survol, camera, camVise);
    if (salleActive && blocsSalle.length) {
      const partis = !!T.salle && G.state !== 'count' && G.state !== 'cut' && (G.runners || []).every((r: any) => (r.d || 0) > 3);
      for (const b of blocsSalle) b.visible = !partis;
    }
    // LA CAMERA VIT (l'auteur, 22/10 : « cinematique et dynamique ») : au coup de
    // pistolet elle tremble un instant, et son champ s'ouvre avec la vitesse.
    if (G.state === 'race' && etatVu !== 'race') secousse = 0.28;
    etatVu = G.state;
    if (secousse > 0) {
      secousse = Math.max(0, secousse - (dt || 0.016));
      const f = secousse * 0.22;
      camera.position.x += (Math.random() - 0.5) * f; camera.position.z += (Math.random() - 0.5) * f;
    }
    // AU FAUX DEPART, LE JOUEUR DESCEND SOUS LE TEXTE de la cinematique (voir originY, sprinter-app.js) :
    // la camera leve les yeux, en glissant
    const fo = G.state === 'falseout' ? Math.min(1, (G.falseOutT || 0) / 0.8) : 0;
    if (fo > 0) camera.lookAt(camVise.x, camVise.y, camVise.z + fo * fo * (3 - 2 * fo) * 0.2 * camera.position.distanceTo(camVise));
    else camera.lookAt(camVise);
    const fov = plan2D ? CHAMP_2D : rail ? (camera.aspect < 1 ? 40 : 32) : champBase + Math.min(1, Math.max(0, (pl.v || 0) / 11)) * 7;
    if (Math.abs(camera.fov - fov) > 0.05) camera.fov += (fov - camera.fov) * Math.min(1, (dt || 0.016) * 3);
    // LE PIXEL DU 2D N'EST PAS CARRE (vue.py) : un metre en largeur y vaut cos.racine2/racine(2 sin2+1)
    // fois un metre en hauteur — 1,07 au sprint, 1,38 a la nuit du molosse a 7°. Le plan 2D etire
    // donc l'image d'autant ; les autres plans gardent un pixel carre.
    camera.updateProjectionMatrix();
    if (plan2D && etire2D !== 1) {
      camera.projectionMatrix.elements[0] *= etire2D;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    // LE JOUEUR RESTE DANS L'IMAGE (« sur certains plans le joueur n'est plus dans la camera a Jesse Owens et au stade
    // Bernard Amsalem », l'auteur, 28/10 ; mesure : .playwright-mcp/cadre*.js). Deux garde-fous, tous plans, tous stades :
    // 1. s'il s'approche du bord (le rail de la salle, en sortie de virage), la camera tourne vers lui, en douceur ;
    // 2. un mat, un arbre ou une cage d'Amsalem entre la camera et lui est masque le temps de passer.
    // (en course seulement : pendant le decompte, la presentation d'une vedette vise un autre coureur, voir viseCamera.cri)
    if (fo === 0 && G.state === 'race') {
      _joueur.set(p[0], -p[1], 1);
      camera.updateMatrixWorld();
      let voulu = 0;
      for (let k = 0; k <= 4; k++) {
        const a = k / 4;
        if (a > 0) { _viseCadre.lerpVectors(camVise, _joueur, a); camera.lookAt(_viseCadre); camera.updateMatrixWorld(); }
        _ndc.copy(_joueur).project(camera);
        voulu = a;
        if (Math.abs(_ndc.x) <= BORD_CADRE && Math.abs(_ndc.y) <= BORD_CADRE) break;
      }
      corrCadre += (voulu - corrCadre) * Math.min(1, (dt || 0.016) * 6);
      _viseCadre.lerpVectors(camVise, _joueur, corrCadre); camera.lookAt(_viseCadre); camera.updateMatrixWorld();
    } else corrCadre = 0;
    if (OCCULTANTS.length && amsalemActif) {
      const vers = _joueur.set(p[0], -p[1], 1).sub(camera.position), loin = vers.length();
      _rayon.set(camera.position, vers.normalize());
      for (const o of OCCULTANTS) {
        if (!o.parent) continue;
        const b = (o.userData.boite ||= new THREE.Box3().setFromObject(o)) as THREE.Box3;
        const t = _rayon.intersectBox(b, _touche);
        o.visible = !(t && t.distanceTo(camera.position) < loin - 0.6);
      }
    }
    // LA ZONE D'OMBRE AVANCE PAR PAS D'UN TEXEL : collee au joueur au pixel pres, ses bords
    // « nageaient » a chaque image — le sable de la Plage Paradis clignotait sous les panneaux
    const texel = 28 / Math.max(256, soleil.shadow.mapSize.x);
    const ox = Math.round((p[0] + 6) / texel) * texel - 6, sy = Math.round(p[1] / texel) * texel;
    // LE SOLEIL DU COTE DE LA CAMERA, un peu de biais pour le modele (« les personnages sont trop
    // sombres », l'auteur, 23/10) : face a lui, les coureurs n'etaient que des silhouettes noires.
    // Chaque stade garde la hauteur de son soleil ; il tourne avec la camera, sans a-coup.
    // Le repere du soleil est celui du 2D (y non retourne), celui de la camera est retourne.
    const vx = camPos.x - camVise.x, vy = camVise.y - camPos.y, vn = Math.hypot(vx, vy) || 1;
    const sh = Math.hypot(soleilDecal.x, soleilDecal.y);
    // au rail, au ras du sol, un soleil haut n'eclairait que le dessus des tetes (« ca manque de
    // lumiere », 24/10) : il descend vers la camera et prend les coureurs de face
    _solVoulu.set((vx * 0.87 - vy * 0.5) / vn * sh, (vx * 0.5 + vy * 0.87) / vn * sh, soleilDecal.z * (rail ? 0.45 : 1));
    if (solPret) solCam.lerp(_solVoulu, 1 - Math.exp(-(dt || 0.016) * 2)); else solCam.copy(_solVoulu);
    solPret = true;
    const sd = nuitDuMolosse ? soleilDecal : solCam;
    soleil.position.set(ox + sd.x, sy + sd.y, sd.z);
    soleil.target.position.set(ox + 6, sy, 0);
  }
  if (SURVOL) {
    camera.position.set(-40, R_CORDE + 75, 95);     // y retourne : voir `monde` ; au-dessus des tours proches
    camera.lookAt(46, R_CORDE, 0);
  }
  return pl;
}
