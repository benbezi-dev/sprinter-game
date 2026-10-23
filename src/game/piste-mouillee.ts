// LA PISTE MOUILLEE DU STADE NEON (23/10, « je veux des reflets de lumiere sur la piste mouillee ») :
// un vrai miroir. A chaque image, la scene est rendue une seconde fois vue d'en dessous de la
// piste (le Reflector de three), en petit ; la laque de la piste lit cette image, la ride au gre
// de l'eau et l'etire vers la camera comme le fait un sol mouille. Panneaux LED, bords en neon,
// enseignes de la ville, coureurs : tout ce qui brille s'y mire, et bouge avec.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

const NOIR = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
NOIR.needsUpdate = true;

/** Pose le miroir dans `stade` (plan z = 0 du repere du stade, centre `cx, cy`) et branche les
 *  materiaux de la piste dessus. `finesse` : part de la definition de l'ecran (0.25 a 0.5). */
export function pisteMouillee(stade: THREE.Group, renderer: THREE.WebGLRenderer, mats: THREE.MeshStandardMaterial[],
  cx: number, cy: number, finesse: number, force = 1) {
  const ecran = renderer.getDrawingBufferSize(new THREE.Vector2());
  const miroir = new Reflector(new THREE.PlaneGeometry(1, 1), {
    textureWidth: Math.max(128, Math.round(ecran.x * finesse)),
    textureHeight: Math.max(128, Math.round(ecran.y * finesse)),
    clipBias: 0.003, multisample: 0,
  });
  // le miroir lui-meme ne dessine rien : il ne sert qu'a remplir son image, avant la piste
  const mm = miroir.material as THREE.ShaderMaterial;
  mm.colorWrite = false; mm.depthWrite = false;
  miroir.renderOrder = -100;
  miroir.frustumCulled = false;
  miroir.position.set(cx, cy, 0);
  stade.add(miroir);

  const image = miroir.getRenderTarget().texture;
  const tRefl = { value: image as THREE.Texture }, mRefl = { value: new THREE.Matrix4() };
  const uTemps = { value: 0 }, uForce = { value: force };
  const _inv = new THREE.Matrix4();
  // la foule (marquee `sansReflet`) ne se mire pas : un fourmillement sur toute la piste, et le
  // plus gros du cout de la seconde passe ; restent les lumieres, la ville et les coureurs
  let caches: THREE.Object3D[] | null = null;
  const avant = miroir.onBeforeRender.bind(miroir);
  miroir.onBeforeRender = (r, sc, cam, ...reste) => {
    // pendant le rendu du reflet : la piste ne lit pas l'image qu'on est en train d'ecrire,
    // et les ombres de cette image sont deja faites
    tRefl.value = NOIR;
    if (!caches) { caches = []; stade.traverse(o => { if (o.userData.sansReflet) caches!.push(o); }); }
    for (const o of caches) o.visible = false;
    const ombres = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    avant(r, sc, cam, ...reste);
    r.shadowMap.autoUpdate = ombres;
    for (const o of caches) o.visible = true;
    tRefl.value = image;
    // la matrice du Reflector part du repere du miroir : on la ramene au monde
    mRefl.value.copy((mm.uniforms.textureMatrix.value as THREE.Matrix4)).multiply(_inv.copy(miroir.matrixWorld).invert());
  };

  for (const m of mats) {
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { tRefl, mRefl, uTemps, uForce });
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMonde;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMonde;\nuniform sampler2D tRefl;\nuniform mat4 mRefl;\nuniform float uTemps, uForce;')
        .replace('#include <opaque_fragment>', `{
          vec4 pr = mRefl * vec4(vMonde, 1.0);
          vec2 uv = pr.xy / pr.w;
          // l'eau : des rides lentes, qui font trembler le reflet
          uv += vec2(sin(vMonde.x * 2.1 + uTemps * 1.3) + sin(vMonde.z * 3.3 - uTemps * 0.8),
                     sin(vMonde.z * 2.7 + uTemps * 1.1) + sin(vMonde.x * 4.1 - uTemps * 1.6)) * 0.0022;
          // le sol mouille etire chaque lumiere vers celui qui regarde : des prises le long de la verticale
          vec3 refl = vec3(0.0); float tot = 0.0;
          for (int i = -3; i <= 7; i++) {
            float k = float(i), w = exp(-abs(k) * 0.32);
            refl += texture2D(tRefl, uv + vec2(0.0, k * 0.0045)).rgb * w; tot += w;
          }
          refl /= tot;
          // ce sont les lumieres qui se mirent : le sombre s'efface dans la laque, le vif ressort
          refl *= smoothstep(0.02, 0.3, dot(refl, vec3(0.3, 0.59, 0.11))) * 2.2;
          // Fresnel : rasant, la piste devient miroir ; de haut, on voit surtout la laque
          float fr = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0);
          outgoingLight += refl * mix(0.3, 1.0, fr) * uForce;
        }
        #include <opaque_fragment>`);
    };
    m.needsUpdate = true;
  }
  return { miroir, animer: (t: number) => { uTemps.value = t; } };
}
