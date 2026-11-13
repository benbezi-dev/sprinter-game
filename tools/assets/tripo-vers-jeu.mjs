// UN CORPS RIGGE PAR TRIPO (squelette UE5 Mannequin) -> LE SQUELETTE ET LE REPOS DU JEU, sans Blender.
//
//   node tools/assets/tripo-vers-jeu.mjs <tripo-rig.glb> <reference coureur-homme.glb> <sortie.glb> [--normale 1024] [--couleur 2048] [--pied 0.06] [--bras 0]
//   puis : node tools/assets/optimiser-glb.mjs <sortie.glb> && node tools/assets/textures-ktx2.mjs <sortie.glb>
//
// POURQUOI (12-13/11/2026) : la chaine Blender (remaillage voxel) deformait les corps crees dans Tripo — l'auteur :
// « le haut du corps ne ressemble a rien », « c'est ceux-la que je veux dans le jeu ». Tripo sait retopologiser et
// rigger lui-meme son modele (Smart Mesh + Rigging auto UE5) : forme et texture restent celles du modele. Il ne
// manque que ce que le jeu attend (vedette-3d.ts, poser) :
//   - ses 57 os, memes noms, meme ordre : les os UE5 en trop (torsions, metacarpes, spine_04/05, neck_02, ball)
//     rendent leurs poids a leur premier ancetre garde ; les 6 os tissu_* sont ajoutes, sans poids ;
//   - SON REPOS : membres droits, bras le long du corps. poser() ecrit orientation(...) x repos, en repere monde :
//     un repos en pose A laisserait les bras ecartes dans toutes les poses. Les membres sont donc tournes vers la
//     direction qu'ils ont dans la reference, la peau suit (ses poids), et ce nouveau repos est ecrit dans le fichier ;
//   - les axes locaux des os de la reference (les doigts se plient autour de leur x local) : chaque os prend
//     l'orientation monde de son homologue ; la peau n'y voit rien (matrices de liaison inverses) ;
//   - l'echelle du jeu : la jambe (hanche-genou-cheville) a la longueur de celle de la reference, cheville a sa hauteur.
// Les tiges des chaussures de la reference sont recopiees : chausserTripo (corps.ts) y accroche les pointes.
// Matiere unique `Coureur_tripo` : la couleur et le relief du modele (le jeu ne la teint pas).
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';

const [src, ref, sortie] = process.argv.slice(2).filter((a, i, t) => !a.startsWith('--') && !t[i - 1]?.startsWith('--'));
const opt = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : Number(process.argv[i + 1]); };
const COTE_NORMALE = opt('normale', 1024), COTE_COULEUR = opt('couleur', 2048), PIED = opt('pied', 0.06), BRAS = opt('bras', 0);
if (!sortie) { console.error('usage : tripo-vers-jeu.mjs <tripo-rig.glb> <reference.glb> <sortie.glb>'); process.exit(1); }

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const T = (await io.read(src)).getRoot(), R = (await io.read(ref)).getRoot();
const parents = (racine) => { const p = new Map(); for (const n of racine.listNodes()) for (const c of n.listChildren()) p.set(c, n); return p; };
const m4 = (a) => new THREE.Matrix4().fromArray(a);
const pos = (n) => new THREE.Vector3().setFromMatrixPosition(m4(n.getWorldMatrix()));

// --- la reference : ordre des os, parents, positions et orientations monde au repos
const peauRef = R.listSkins()[0], osRef = peauRef.listJoints(), parRef = parents(R);
const noms = osRef.map((j) => j.getName()), rang = new Map(noms.map((n, i) => [n, i]));
const parentRef = noms.map((_, i) => { const p = parRef.get(osRef[i]); return p && rang.has(p.getName()) ? rang.get(p.getName()) : -1; });
const posRef = osRef.map(pos), rotRef = osRef.map((j) => new THREE.Quaternion().fromArray(j.getWorldRotation()));

// --- le corps Tripo : peau en repere monde, poids rendus aux os gardes
const peauT = T.listSkins()[0], osT = peauT.listJoints(), parT = parents(T);
const prim = T.listMeshes()[0].listPrimitives()[0];
const garde = osT.map((j) => { let n = j; while (n && !rang.has(n.getName())) n = parT.get(n); if (!n) throw new Error('os sans ancetre garde : ' + j.getName()); return rang.get(n.getName()); });
const absents = noms.filter((n) => !n.startsWith('tissu_') && !osT.some((j) => j.getName() === n));
if (absents.length) throw new Error('os du jeu absents du rig Tripo : ' + absents.join(' '));
const ibmT = peauT.getInverseBindMatrices();
const liaison = osT.map((j, i) => m4(j.getWorldMatrix()).multiply(m4(ibmT.getElement(i, []))));
const aP = prim.getAttribute('POSITION'), aN = prim.getAttribute('NORMAL'), aUV = prim.getAttribute('TEXCOORD_0'), aJ = prim.getAttribute('JOINTS_0'), aW = prim.getAttribute('WEIGHTS_0');
const N = aP.getCount();

// repere et echelle du jeu : l'avant vers +x, la gauche vers -z (Tripo : avant +z, gauche +x) ; jambe de la reference
const pT = new Map(osT.map((j) => [j.getName(), pos(j)]));
const jambe = (P, c) => P('thigh' + c).distanceTo(P('calf' + c)) + P('calf' + c).distanceTo(P('foot' + c));
const ech = (jambe((n) => posRef[rang.get(n)], '_l') + jambe((n) => posRef[rang.get(n)], '_r')) / (jambe((n) => pT.get(n), '_l') + jambe((n) => pT.get(n), '_r'));
if (pT.get('upperarm_l').x < 0) throw new Error('repere Tripo inattendu : la gauche n est pas en +x');
const G = new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(ech, ech, ech));
const centre = pT.get('pelvis').clone().applyMatrix4(G); centre.y = 0;
G.premultiply(new THREE.Matrix4().makeTranslation(-centre.x, 0, -centre.z));
const Gn = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));

const P0 = noms.map((n) => (pT.get(n) || new THREE.Vector3()).clone().applyMatrix4(G));   // (os gardes, avant recalage ; tissu_* : poses plus bas)
const V = new Float32Array(N * 3), NO = new Float32Array(N * 3), JO = new Uint8Array(N * 4), WE = new Float32Array(N * 4);
const v = new THREE.Vector3(), n3 = new THREE.Vector3(), acc = new THREE.Vector3(), accN = new THREE.Vector3(), el = [];
const V0 = new Float32Array(N * 3), N0 = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  const j = aJ.getElement(i, []), w = aW.getElement(i, []);
  acc.set(0, 0, 0); accN.set(0, 0, 0);
  const cumul = new Map();
  for (let k = 0; k < 4; k++) {
    if (!(w[k] > 0)) continue;
    acc.addScaledVector(v.fromArray(aP.getElement(i, el)).applyMatrix4(liaison[j[k]]), w[k]);
    accN.addScaledVector(n3.fromArray(aN.getElement(i, el)).transformDirection(liaison[j[k]]), w[k]);
    cumul.set(garde[j[k]], (cumul.get(garde[j[k]]) || 0) + w[k]);
  }
  acc.applyMatrix4(G).toArray(V0, i * 3); accN.applyMatrix3(Gn).normalize().toArray(N0, i * 3);
  const tri = [...cumul].sort((a, b) => b[1] - a[1]).slice(0, 4), somme = tri.reduce((s, t) => s + t[1], 0);
  tri.forEach(([os, p], k) => { JO[i * 4 + k] = os; WE[i * 4 + k] = p / somme; });
}

// --- le repos du jeu : chaque membre prend la direction qu'il a dans la reference, de la racine vers le bout
const VISE = { upperarm: 'lowerarm', lowerarm: 'hand', hand: 'middle_01', thigh: 'calf', calf: 'foot' };
const Rj = [], P1 = [];
for (let i = 0; i < noms.length; i++) {
  const p = parentRef[i], Rp = p < 0 ? new THREE.Quaternion() : Rj[p];
  P1[i] = p < 0 ? P0[i].clone() : P0[i].clone().sub(P0[p]).applyQuaternion(Rp).add(P1[p]);
  const [, base, cote] = noms[i].match(/^(.*)(_[lr])$/) || [];
  const fils = VISE[base] ? rang.get(VISE[base] + cote) : undefined;
  if (noms[i].startsWith('tissu_')) { P0[i] = P0[p].clone().add(posRef[i].clone().sub(posRef[p])); P1[i] = P1[p].clone().add(posRef[i].clone().sub(posRef[p])); Rj[i] = Rp; continue; }
  if (fils === undefined) { Rj[i] = Rp; continue; }
  const dir = P0[fils].clone().sub(P0[i]).applyQuaternion(Rp).normalize(), cible = posRef[fils].clone().sub(posRef[i]).normalize();
  // LES BRAS UN PEU ECARTES (--bras, degres ; 13/11, l'auteur : « les bras sont trop colles au corps ») : ces corps sont
  // plus larges du dos que la reference, sur laquelle les poses du jeu sont reglees. Le repos garde donc le bras ouvert
  // de quelques degres : poser() tourne a partir du repos, toutes les poses s'ouvrent d'autant.
  // (le HAUT du bras seulement : l'avant-bras reprend la direction de la reference et le bras plie au coude. Essaye sur
  // tout le bras le 13/11 — bras droit comme le modele Tripo —, l'auteur : « remets la cassure au niveau du coude »)
  if (base === 'upperarm' && BRAS) cible.setZ(cible.z + Math.sign(posRef[i].z) * Math.tan(BRAS * Math.PI / 180)).normalize();
  Rj[i] = new THREE.Quaternion().setFromUnitVectors(dir, cible).multiply(Rp);
}
// (la cheville a la hauteur de celle de la reference : la semelle des pointes est au sol)
const monte = (posRef[rang.get('foot_l')].y + posRef[rang.get('foot_r')].y) / 2 - (P1[rang.get('foot_l')].y + P1[rang.get('foot_r')].y) / 2;
for (const p of P1) p.y += monte;
let ecartMax = 0;
for (let i = 0; i < N; i++) {
  acc.set(0, 0, 0); accN.set(0, 0, 0);
  for (let k = 0; k < 4; k++) {
    const w = WE[i * 4 + k], o = JO[i * 4 + k]; if (!w) continue;
    acc.addScaledVector(v.fromArray(V0, i * 3).sub(P0[o]).applyQuaternion(Rj[o]).add(P1[o]), w);
    accN.addScaledVector(n3.fromArray(N0, i * 3).applyQuaternion(Rj[o]), w);
  }
  ecartMax = Math.max(ecartMax, acc.distanceTo(v.fromArray(V0, i * 3)));
  acc.toArray(V, i * 3); accN.normalize().toArray(NO, i * 3);
}

// --- le pied nu sous la cheville : la pointe le remplace (sinon les orteils la traversent)
const iT = prim.getIndices().getArray(), osPied = new Set([rang.get('foot_l'), rang.get('foot_r')]);
// (13/11) le cou-de-pied Tripo, pese surtout par le MOLLET, depassait au-dessus de la pointe : on juge sur l'os dominant,
// pied ou mollet, et on coupe jusqu'a la hauteur du col de la chaussure (--pied).
const osBas = new Set([...osPied, rang.get('calf_l'), rang.get('calf_r')]);
const dominant = (i) => { let k = 0; for (let c = 1; c < 4; c++) if (WE[i * 4 + c] > WE[i * 4 + k]) k = c; return JO[i * 4 + k]; };
const sousLaPointe = (i) => osBas.has(dominant(i)) && V[i * 3 + 1] < PIED;
const tris = [];
for (let t = 0; t < iT.length; t += 3) if (!(sousLaPointe(iT[t]) && sousLaPointe(iT[t + 1]) && sousLaPointe(iT[t + 2]))) tris.push(iT[t], iT[t + 1], iT[t + 2]);

// --- le fichier : squelette de la reference (noms, ordre, axes), positions du corps Tripo
const doc = new Document(), tampon = doc.createBuffer(), scene = doc.createScene('Scene');
const monde = noms.map((_, i) => new THREE.Matrix4().compose(P1[i], rotRef[i], new THREE.Vector3(1, 1, 1)));
const noeuds = noms.map((n, i) => {
  const loc = parentRef[i] < 0 ? monde[i] : monde[parentRef[i]].clone().invert().multiply(monde[i]);
  const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); loc.decompose(t, q, s);
  return doc.createNode(n).setTranslation(t.toArray()).setRotation(q.toArray());
});
noms.forEach((_, i) => { if (parentRef[i] >= 0) noeuds[parentRef[i]].addChild(noeuds[i]); });
const ibm = new Float32Array(noms.length * 16);
monde.forEach((m, i) => m.clone().invert().toArray(ibm, i * 16));
const peau = doc.createSkin('Coureur').setSkeleton(noeuds[0]).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(tampon));
noeuds.forEach((n) => peau.addJoint(n));
const racine = doc.createNode('Coureur').addChild(noeuds[0]); scene.addChild(racine);
const acces = (type, tab) => doc.createAccessor().setType(type).setArray(tab).setBuffer(tampon);

const image = async (tex, cote, jpg) => { const s = sharp(tex.getImage()).resize(cote, cote, { fit: 'fill' }); return new Uint8Array(await (jpg ? s.jpeg({ quality: 88 }) : s.png()).toBuffer()); };
const matT = prim.getMaterial();
// LE MASQUE DU TISSU, dans l'alpha de la couleur (13/11) : la tenue Tripo est GRISE, la peau coloree. Alpha bas = tissu,
// 255 = le reste (une texture sans alpha ne teint donc rien). Nettoye (mediane) et elargi de ~2 texels, pour avaler le
// trait sombre du bord du vetement ; le jeu (corps.ts, tenueTripo) y pose les couleurs du coureur, le maillot du club,
// le dossard. Cheveux noirs et blancs des yeux sont gris aussi : le jeu ne teint que le tronc et les cuisses.
const couleurMasquee = async (tex, cote) => {
  const { data } = await sharp(tex.getImage()).resize(cote, cote, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = Buffer.alloc(cote * cote);
  for (let i = 0; i < m.length; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2], hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    m[i] = hi - lo < 20 && (hi ? (hi - lo) / hi : 0) < 0.25 ? 255 : 0;
  }
  const brut = { raw: { width: cote, height: cote, channels: 1 } };
  // (extractChannel a chaque passe : sharp rend sinon trois canaux, relus comme un seul)
  const passe = (buf, f) => f(sharp(buf, brut)).extractChannel(0).raw().toBuffer();
  const propre = await passe(m, (i) => i.median(5).blur(1.2).threshold(128));
  const net = await passe(await passe(propre, (i) => i.blur(1.5).threshold(40)), (i) => i.blur(0.8).negate().linear(0.97, 8));   // (jamais 0 : un encodeur avec perte jette la couleur sous un alpha nul)
  return new Uint8Array(await sharp(data, { raw: { width: cote, height: cote, channels: 3 } }).joinChannel(net, brut).png().toBuffer());
};
const mat = doc.createMaterial('Coureur_tripo').setRoughnessFactor(0.6).setMetallicFactor(0)
  .setBaseColorTexture(doc.createTexture('couleur').setMimeType('image/png').setImage(await couleurMasquee(matT.getBaseColorTexture(), COTE_COULEUR)))
  .setNormalTexture(doc.createTexture('normale').setMimeType('image/png').setImage(await image(matT.getNormalTexture(), COTE_NORMALE, false)));
const uv = new Float32Array(N * 2); for (let i = 0; i < N; i++) aUV.getElement(i, el).forEach((x, k) => { uv[i * 2 + k] = x; });
const corps = doc.createMesh('Coureur').addPrimitive(doc.createPrimitive().setMaterial(mat)
  .setIndices(acces('SCALAR', new Uint32Array(tris))).setAttribute('POSITION', acces('VEC3', V)).setAttribute('NORMAL', acces('VEC3', NO))
  .setAttribute('TEXCOORD_0', acces('VEC2', uv)).setAttribute('JOINTS_0', acces('VEC4', JO)).setAttribute('WEIGHTS_0', acces('VEC4', WE)));
racine.addChild(doc.createNode('Coureur').setMesh(corps).setSkin(peau));

// les tiges des chaussures de la reference, glissees sous les chevilles du nouveau corps (memes os, meme ordre)
for (const c of ['l', 'r']) {
  const nd = R.listNodes().find((n) => n.getName() === 'Tige_foot_' + c); if (!nd) continue;
  const o = rang.get('foot_' + c), glisse = P1[o].clone().sub(posRef[o]);
  const mesh = doc.createMesh('Tige_foot_' + c);
  for (const p of nd.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION'), n = a.getCount(), X = new Float32Array(n * 3), J = new Uint8Array(n * 4), W = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      v.fromArray(a.getElement(i, el)).add(glisse).toArray(X, i * 3);
      p.getAttribute('JOINTS_0').getElement(i, el).forEach((x, k) => { J[i * 4 + k] = x; });
      p.getAttribute('WEIGHTS_0').getElement(i, el).forEach((x, k) => { W[i * 4 + k] = x; });
    }
    const nn = p.getAttribute('NORMAL');
    mesh.addPrimitive(doc.createPrimitive().setMaterial(doc.createMaterial(p.getMaterial().getName()).setBaseColorFactor(p.getMaterial().getBaseColorFactor()))
      .setIndices(acces('SCALAR', new Uint32Array(p.getIndices().getArray()))).setAttribute('POSITION', acces('VEC3', X))
      .setAttribute('NORMAL', acces('VEC3', new Float32Array(Array.from({ length: n * 3 }, (_, i) => nn.getElement(Math.floor(i / 3), el)[i % 3]))))
      .setAttribute('JOINTS_0', acces('VEC4', J)).setAttribute('WEIGHTS_0', acces('VEC4', W)));
  }
  racine.addChild(doc.createNode('Tige_foot_' + c).setMesh(mesh).setSkin(peau));
}
await io.write(sortie, doc);

// --- controle : ce que le jeu exige, sinon on ne livre pas
const sommes = []; for (let i = 0; i < N; i++) sommes.push(WE[i * 4] + WE[i * 4 + 1] + WE[i * 4 + 2] + WE[i * 4 + 3]);
const droit = (a, b, c) => { const d = P1[rang.get(b)].clone().sub(P1[rang.get(a)]).normalize(); return d.dot(posRef[rang.get(b)].clone().sub(posRef[rang.get(a)]).normalize()) > 0.9999 && c; };
console.assert(noeuds.length === 57 && noms.every((n, i) => peau.listJoints()[i].getName() === n), 'les 57 os du jeu, dans l ordre');
console.assert(Math.max(...sommes.map((s) => Math.abs(s - 1))) < 1e-5, 'poids normalises');
console.assert((BRAS || droit('upperarm_l', 'lowerarm_l', true)) && droit('thigh_r', 'calf_r', true), 'membres dans la direction de la reference');
let haut = 0; for (let i = 0; i < N; i++) haut = Math.max(haut, V[i * 3 + 1]);
console.log(`${sortie} : ${tris.length / 3} triangles (corps), ${N} sommets, 57 os, echelle x${ech.toFixed(4)}, sommet du crane ${haut.toFixed(3)} m, ` +
  `deplacement max de la peau pour le repos ${(ecartMax * 100).toFixed(1)} cm, pied nu retire : ${(iT.length - tris.length) / 3} triangles`);
