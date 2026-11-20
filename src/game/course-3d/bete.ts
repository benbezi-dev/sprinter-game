// LA COURSE EN VRAIE 3D — la bete de la nuit du molosse (decoupe de course-3d.ts, 11/11/2026).

import * as THREE from 'three';
import { chargeurGLTF } from '../chargeur-gltf';
import { Q } from './reglages';
import { texteCanvas, monde, camera, renderer } from './scene';
import { ici, capIci } from './repere';
import { lisere, corps } from './corps';
import { planCam } from './camera';

// --- LA BETE (la nuit du molosse) ----------------------------------------------
//
// Le maillage TRELLIS de halloween-molosse-3d.ts (molosse.glb, 1,60 m au garrot, son
// galop d'une seconde), mais pose DANS la ruelle, au milieu des coureurs : la 2D le
// rendait de profil dans une toile a part et le couchait sur la piste. Sa position est
// celle de la regle (etatDeLaChasse : la distance de la bete, calee sur le chrono),
// dans le couloir du joueur (ou de celui qu'un mordu regarde, en meute) ; sa foulee
// suit la distance, comme le trace (FOULEE 0,45). Les yeux : deux braises rouges.
// La chasse est lue sur G.obstacles (molosseDe la porte) : la 3D n'importe pas le mode.
const FICHIER_BETE = import.meta.glob('/src/assets/molosse.glb', { query: '?url', import: 'default' }) as
  Record<string, () => Promise<string>>;
type Bete = { racine: THREE.Group; melangeur: THREE.AnimationMixer; duree: number; foulee: number };
let bete: Bete | null = null, beteDemandee = false;
export function chargerLaBete() {
  if (beteDemandee) return;
  beteDemandee = true;
  const f = Object.values(FICHIER_BETE)[0];
  if (!f) return;
  // LA BETE EN HAUTE DEFINITION (23/10, « les decors du molosse avec la qualite la plus haute ») :
  // 60 000 faces de la source TRELLIS au lieu de 9 000, sa texture d'origine en PNG
  // (molosse_trellis.py --plein), la legere si elle manque
  const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/?$/, '/');
  f().then((u) => {
    const l = chargeurGLTF();
    const leger = () => new Promise<any>((ok, ko) => l.load(u, ok, undefined, ko));
    // LE GALOP DE CHIEN (molosse_trellis.py --chien) : une foulee tous les 3,5 m. La pleine, puis sa
    // version legere (test3d ne publie pas boss-plein : sans elle, la bete en ligne gardait le
    // galop du trace), puis la legere du trace 2D, tous les 2,22 m.
    const chien = (g: any) => ({ ...g, foulee: 0.285 });
    l.loadAsync(base + 'modeles/boss-plein/molosse.glb').then(chien)
      .catch(() => l.loadAsync(base + 'modeles/molosse-chien.glb').then(chien)).catch(leger).then((gltf: any) => {
      const racine = new THREE.Group(), corps = gltf.scene;
      corps.rotation.x = Math.PI / 2;      // le glTF a y en haut, le stade z
      racine.add(corps);
      const yeux: THREE.Object3D[] = [];
      corps.traverse((o: any) => {
        if (o.isBone && /^oeil_/.test(o.name)) yeux.push(o);
        if (o.isMesh) {
          o.frustumCulled = false; o.castShadow = true;
          const m = o.material as THREE.MeshStandardMaterial;
          if (m.color) m.color.multiplyScalar(0.6);     // une bete noire, la nuit
          lisere(m);
        }
      });
      const matOeil = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
      const matLueur = new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, map: texteCanvas((c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,80,40,1)'); g.addColorStop(0.3, 'rgba(255,30,10,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }, 64, 64) });
      for (const y of yeux) {
        const s = new THREE.Vector3(); y.getWorldScale(s);
        const k = 1 / Math.max(1e-3, s.x);        // en metres, quelle que soit l'echelle de l'os
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.035 * k, 10, 8), matOeil); y.add(b);
        const h = new THREE.Sprite(matLueur); h.scale.setScalar(0.5 * k); y.add(h);
      }
      const clip = gltf.animations.find((a: THREE.AnimationClip) => a.name === 'galop') || gltf.animations[0];
      const melangeur = new THREE.AnimationMixer(corps);
      if (clip) melangeur.clipAction(clip).play();
      racine.visible = false;
      monde.add(racine);
      bete = { racine, melangeur, duree: clip ? clip.duration : 1, foulee: gltf.foulee || 0.45 };
    }).catch(() => { beteDemandee = false; });
  }).catch(() => { beteDemandee = false; });
}
// ?sonde : la bete et la chasse, lisibles depuis la console (verifier sans jouer la nuit)
if (Q.get('sonde') !== null) (globalThis as any).__course3d = { get bete() { return bete; }, get chasse() { const o = (globalThis as any).SprinterApp?.G?.obstacles; return o && o.molosse ? o.chasse : null; }, get monde() { return monde; }, get camera() { return camera; }, get rendu() { return renderer; }, get plan() { return planCam; }, get corps() { return corps; } };
export function poserLaBete(G: any, T: any, nuit: boolean) {
  if (!bete) return;
  // la chasse, portee par l'obstacle que la nuit pose (molosseDe) : pas d'import du mode,
  // qui resterait sinon dans le paquet de la 3D (et, en dev, en serait une seconde copie)
  const c = nuit && G.obstacles && G.obstacles.molosse ? G.obstacles.chasse : null;
  if (!c) { bete.racine.visible = false; return; }
  const suivi = G.spectateur && G.suivi ? G.suivi : G.player;
  const lane = suivi ? suivi.lane : 0, d = Math.min(c.d, T.total + 24);
  const p = ici(T.pos(d, lane));
  bete.racine.position.set(p[0], p[1], 0);
  bete.racine.rotation.z = capIci(T.heading(d, lane));
  bete.racine.visible = d > -14;          // elle sort de l'ombre, derriere la ligne
  bete.melangeur.setTime(((((d * bete.foulee) % 1) + 1) % 1) * bete.duree);
}
