// LA DUREE ECRITE DANS LE MP4 DU REPLAY.
//
// L'auteur, 25/10 : « la qualite de partage de la video apres la course est
// degradee… ou ecourtee sur WhatsApp ». Le MP4 que sort MediaRecorder (Chrome,
// Android) est FRAGMENTE : un en-tete vide (`moov` sans echantillons, durees a
// zero, pas de `mehd`), puis des fragments (`moof` + `mdat`) d'une seconde ou
// trois. Un lecteur qui parcourt tout le fichier retrouve la duree ; un
// reencodeur qui se fie a l'en-tete, lui, peut lire zero, ou s'arreter au
// premier fragment — c'est le film « ecourte ».
//
// On n'y touche qu'apres l'enregistrement, et sans rien reencoder : on additionne
// les durees des fragments, piste par piste, et on les ecrit dans l'en-tete
// (mvhd, tkhd, mdhd), plus un `mehd` (la duree totale d'un film fragmente) quand
// on peut l'inserer sans deplacer de reference absolue. Un fichier qu'on ne sait
// pas lire est rendu tel quel : mieux vaut un replay sans duree que pas de replay.

type Boite = { type: string; debut: number; taille: number; corps: number };

function boites(v: DataView, debut: number, fin: number): Boite[] {
  const out: Boite[] = [];
  let p = debut;
  while (p + 8 <= fin) {
    let taille = v.getUint32(p), corps = 8;
    const type = String.fromCharCode(v.getUint8(p + 4), v.getUint8(p + 5), v.getUint8(p + 6), v.getUint8(p + 7));
    if (taille === 1) { taille = Number(v.getBigUint64(p + 8)); corps = 16; }
    else if (taille === 0) taille = fin - p;
    if (taille < corps || p + taille > fin) break;
    out.push({ type, debut: p, taille, corps: p + corps });
    p += taille;
  }
  return out;
}
const enfant = (v: DataView, b: Boite, t: string) => boites(v, b.corps, b.debut + b.taille).find(x => x.type === t) || null;
const enfants = (v: DataView, b: Boite, t: string) => boites(v, b.corps, b.debut + b.taille).filter(x => x.type === t);

/** Rend le fichier avec sa duree ecrite dans l'en-tete ; ou tel quel s'il n'est pas un MP4 fragmente lisible. */
export function ecrireLaDuree(entree: ArrayBuffer): ArrayBuffer {
  try {
    const v = new DataView(entree);
    const haut = boites(v, 0, entree.byteLength);
    const moov = haut.find(b => b.type === 'moov');
    const moofs = haut.filter(b => b.type === 'moof');
    if (!moov || !moofs.length) return entree;
    const mvhd = enfant(v, moov, 'mvhd'); if (!mvhd) return entree;
    const mvhdV = v.getUint8(mvhd.corps), echelleFilm = v.getUint32(mvhd.corps + (mvhdV ? 20 : 12));

    // les pistes : leur echelle, leur duree par defaut (trex)
    const pistes = new Map<number, { tkhd: Boite; mdhd: Boite; echelle: number; defaut: number; fin: number }>();
    const mvex = enfant(v, moov, 'mvex');
    const trex = mvex ? enfants(v, mvex, 'trex') : [];
    for (const trak of enfants(v, moov, 'trak')) {
      const tkhd = enfant(v, trak, 'tkhd'), mdia = enfant(v, trak, 'mdia');
      const mdhd = mdia && enfant(v, mdia, 'mdhd');
      if (!tkhd || !mdhd) continue;
      const id = v.getUint32(tkhd.corps + (v.getUint8(tkhd.corps) ? 20 : 12));
      const echelle = v.getUint32(mdhd.corps + (v.getUint8(mdhd.corps) ? 20 : 12));
      const tx = trex.find(t => v.getUint32(t.corps + 4) === id);
      pistes.set(id, { tkhd, mdhd, echelle, defaut: tx ? v.getUint32(tx.corps + 12) : 0, fin: 0 });
    }
    if (!pistes.size) return entree;

    // les fragments : la fin de chacun, piste par piste (tfdt + somme des durees du trun)
    let referenceAbsolue = false;
    for (const moof of moofs) for (const traf of enfants(v, moof, 'traf')) {
      const tfhd = enfant(v, traf, 'tfhd'); if (!tfhd) continue;
      const fl = v.getUint32(tfhd.corps) & 0xffffff, id = v.getUint32(tfhd.corps + 4);
      const p = pistes.get(id); if (!p) continue;
      if (fl & 0x1) referenceAbsolue = true;
      let q = tfhd.corps + 8;
      if (fl & 0x1) q += 8; if (fl & 0x2) q += 4;
      const defaut = fl & 0x8 ? v.getUint32(q) : p.defaut;
      const tfdt = enfant(v, traf, 'tfdt');
      let t = tfdt ? (v.getUint8(tfdt.corps) ? Number(v.getBigUint64(tfdt.corps + 4)) : v.getUint32(tfdt.corps + 4)) : p.fin;
      for (const trun of enfants(v, traf, 'trun')) {
        const tf = v.getUint32(trun.corps) & 0xffffff, n = v.getUint32(trun.corps + 4);
        let r = trun.corps + 8;
        if (tf & 0x1) r += 4; if (tf & 0x4) r += 4;
        const pas = (tf & 0x100 ? 4 : 0) + (tf & 0x200 ? 4 : 0) + (tf & 0x400 ? 4 : 0) + (tf & 0x800 ? 4 : 0);
        for (let i = 0; i < n; i++) { t += tf & 0x100 ? v.getUint32(r + i * pas) : defaut; }
      }
      p.fin = Math.max(p.fin, t);
    }

    // les durees, ecrites a leur place (taille du fichier inchangee)
    const sortie = entree.slice(0), w = new DataView(sortie);
    let film = 0;
    const ecrire = (b: Boite, deCalage0: number, deCalage1: number, d: number) => {
      if (v.getUint8(b.corps)) w.setBigUint64(b.corps + deCalage1, BigInt(Math.round(d)));
      else w.setUint32(b.corps + deCalage0, Math.min(0xffffffff, Math.round(d)));
    };
    for (const p of pistes.values()) {
      if (!p.fin || !p.echelle) continue;
      ecrire(p.mdhd, 16, 24, p.fin);
      const d = p.fin / p.echelle * echelleFilm;
      ecrire(p.tkhd, 20, 28, d);
      film = Math.max(film, d);
    }
    if (!film) return entree;
    ecrire(mvhd, 16, 24, film);

    // le `mehd` : la duree totale d'un film fragmente. L'inserer grandit le `moov` et
    // decale tout ce qui suit ; on ne le fait que si les fragments se referent a eux-memes
    // (pas de base-data-offset absolu) et qu'il n'y en a pas deja un.
    if (!mvex || referenceAbsolue || enfant(v, mvex, 'mehd')) return sortie;
    const mehd = new Uint8Array(16), m = new DataView(mehd.buffer);
    m.setUint32(0, 16); mehd.set([0x6d, 0x65, 0x68, 0x64], 4); m.setUint32(8, 0); m.setUint32(12, Math.min(0xffffffff, Math.round(film)));
    const a = new Uint8Array(sortie), o = new Uint8Array(sortie.byteLength + 16);
    o.set(a.subarray(0, mvex.corps), 0);
    o.set(mehd, mvex.corps);
    o.set(a.subarray(mvex.corps), mvex.corps + 16);
    const ov = new DataView(o.buffer);
    // les deux tailles qui contiennent le mehd : mvex et moov (tailles sur 32 bits ici)
    if (v.getUint32(mvex.debut) === 1 || v.getUint32(moov.debut) === 1) return sortie;
    ov.setUint32(mvex.debut, mvex.taille + 16);
    ov.setUint32(moov.debut, moov.taille + 16);
    return o.buffer;
  } catch {
    return entree;
  }
}
