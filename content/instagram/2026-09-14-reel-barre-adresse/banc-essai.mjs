/* ---------------------------------------------------------------------------
   LE BANC D'ESSAI DU MONTEUR

   Le reel « la barre d'adresse » se TOURNE : il demande une camera, un
   telephone et une main. Tant que la prise n'existe pas, la chaine de montage,
   elle, peut deja etre prouvee — et elle doit l'etre avant le jour du tournage,
   parce qu'un defaut decouvert la camera a la main coute une prise.

   Ce module fabrique donc une PRISE DE SUBSTITUTION et la passe dans la chaine
   entiere. La substitution est un WebM sorti de MediaRecorder, c'est-a-dire
   exactement le fichier que la chaine redoute : un flux sans index, dont
   `duration` vaut l'infini et dont `currentTime = 12` ne fait rien. Si
   `avancer()` a un defaut, il sort ici et pas devant la camera.

   Ce qu'on releve, et pourquoi chaque ligne compte :

     polices        un chrono rendu en police de repli est un chrono a refaire ;
     index          le piege doit etre DETECTE, pas subi ;
     calage         l'ecart entre le point demande et le point atteint ;
     chrono final   le chronometre incruste suit-il la prise, ou derive-t-il ?
     piste audio    le son de la prise est garde : il doit etre dans le flux ;
     format         MP4 d'abord — le seul qu'un appareil Apple relit ;
     duree reelle   celle du FICHIER, relue apres coup, et non celle annoncee.

   Rien de ce qui sort d'ici n'entre dans le film. Ce n'est pas une prise,
   c'est une mire.
--------------------------------------------------------------------------- */
let charte;
try { charte = await import('/src/game/trace-affiche.js'); }
catch { charte = await import('../../../src/game/trace-affiche.js'); }
const { poserFond, s2 } = charte;

const L = 1080, H = 1920;

/** Une prise de substitution : `secondes` de mire, 1080 x 1920, avec le temps
 *  de la source ecrit dessus et un bip par seconde. Enregistree en temps reel —
 *  une mire assemblee hors du temps reel ne prouverait rien de la chaine. */
async function fabriquer(secondes) {
  const src = document.createElement('canvas');
  src.width = L; src.height = H;
  const c = src.getContext('2d');

  const actx = new AudioContext();
  if (actx.state === 'suspended') await actx.resume();
  const dest = actx.createMediaStreamDestination();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'square'; osc.frequency.value = 880;
  gain.gain.value = 0;
  osc.connect(gain); gain.connect(dest);
  osc.start();

  const flux = new MediaStream([
    ...src.captureStream(30).getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(f => MediaRecorder.isTypeSupported(f));
  const morceaux = [];
  const rec = new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  rec.ondataavailable = e => { if (e.data.size) morceaux.push(e.data); };
  const fini = new Promise(ok => { rec.onstop = ok; });

  const t0 = performance.now();
  rec.start(250);
  await new Promise(ok => {
    let bip = -1;
    const tic = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= secondes) return ok();

      poserFond(c, L, H);
      // Le temps de la SOURCE, en grand : c'est lui qu'on relit dans l'image
      // finale pour savoir si le chronometre incruste a suivi.
      c.fillStyle = '#EEF0F8';
      c.font = "700 130px 'Space Mono', monospace";
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(s2(t * 1000), L / 2, 1150);
      c.font = '500 34px Outfit, sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.46)';
      c.fillText('MIRE — PRISE DE SUBSTITUTION', L / 2, 1290);
      // Un mobile, pour que l'encodeur ait du mouvement a coder.
      c.fillStyle = '#F8CD4A';
      c.fillRect((t / secondes) * (L - 120), 1400, 120, 18);

      const s = Math.floor(t);
      if (s !== bip) {
        bip = s;
        gain.gain.setValueAtTime(0.06, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.07);
      }
      requestAnimationFrame(tic);
    };
    requestAnimationFrame(tic);
  });
  rec.stop();
  await fini;
  osc.stop();
  return { blob: new Blob(morceaux, { type: mime }), mime, mur: (performance.now() - t0) / 1000 };
}

/** La duree REELLE d'un fichier, et non celle qu'il annonce.
 *  Un WebM sorti de MediaRecorder annonce l'infini : on le force a parcourir
 *  son flux jusqu'au bout, et c'est la position finale qui dit la verite. */
async function dureeReelle(blob) {
  const v = document.createElement('video');
  v.preload = 'auto';
  v.src = URL.createObjectURL(blob);
  await new Promise(ok => {
    v.addEventListener('loadedmetadata', ok, { once: true });
    setTimeout(ok, 4000);
  });
  if (isFinite(v.duration) && v.duration > 0) return { duree: v.duration, annoncee: true };
  v.currentTime = 1e7;
  await new Promise(ok => {
    v.addEventListener('seeked', ok, { once: true });
    setTimeout(ok, 6000);
  });
  const d = isFinite(v.duration) && v.duration > 0 ? v.duration : v.currentTime;
  return { duree: d, annoncee: false };
}

export async function lancer(m) {
  const bilan = { etapes: [] };
  const note = (quoi, valeur) => { bilan.etapes.push([quoi, valeur]); bilan[quoi] = valeur; };

  note('polices', m.policesOk ? 'Outfit + Space Mono' : 'REPLI — a refaire');

  const SECONDES = +(new URLSearchParams(location.search).get('mire') || 22);
  const mire = await fabriquer(SECONDES);
  note('mire_format', mire.mime);
  note('mire_poids_Mo', +(mire.blob.size / 1048576).toFixed(2));

  await m.charger(URL.createObjectURL(mire.blob));
  note('prise_duree_s', +m.prise.duration.toFixed(3));
  note('index', m.etat.seekFiable ? 'indexe' : 'sans index — piege detecte, lecture a 16x');

  /* Deux reperes connus : le chronometre doit afficher exactement leur ecart a
     la derniere image. Tout autre resultat est une derive, et une derive rend
     le chronometre faux — donc le reel entier. */
  const A = 1.5, B = Math.max(A + 1, m.prise.duration - 1.5);
  m.etat.A = A; m.etat.B = B; m.majReperes();
  note('reperes_s', `A ${A.toFixed(2)} · B ${B.toFixed(2)}`);

  /* LE CHEMIN DE REPLI NE DOIT PAS DORMIR NON TESTE.
     Une prise chargee depuis un blob se laisse atteindre : le piege des WebM
     sans index ne se declenche donc pas ici de lui-meme. Or c'est ce chemin-la
     qui sauve un montage le jour ou le fichier refuse de se deplacer. On le
     force, et on regarde s'il atterrit. */
  const vraiMode = m.etat.seekFiable;
  m.etat.seekFiable = false;
  const cible = Math.min(5, m.prise.duration - 1);
  const ecartRepli = await m.avancer(m.prise, cible, false);
  m.etat.seekFiable = vraiMode;
  note('repli_16x_vise_s', +cible.toFixed(3));
  note('repli_16x_ecart_s', +ecartRepli.toFixed(3));
  // Deux images a 25 i/s : la limite physique d'une lecture surveillee a
  // l'image, et bien en deca de ce qu'un oeil releve sur un reperage.
  note('repli_16x_atterrit', ecartRepli < 0.08);
  note('total_attendu_s', s2((B - A) * 1000));

  const r = await m.filmer();
  if (!r) { note('ERREUR', 'le montage a refuse de filmer'); window.__bilan = bilan; return bilan; }

  note('chrono_final_affiche', m.etat.dernierChrono);
  note('chrono_conforme', m.etat.dernierChrono === s2((B - A) * 1000));
  note('calage_max_s', +m.etat.calageMax.toFixed(4));
  note('format_retenu', r.mime);
  note('poids_Mo', +(r.poids / 1048576).toFixed(2));
  note('temps_au_mur_s', +r.murBoucle.toFixed(2));
  note('cadence_x_temps_reel', +r.cadence.toFixed(3));

  const d = await dureeReelle(r.blob);
  note('duree_reelle_s', +d.duree.toFixed(3));
  note('duree_annoncee_par_le_fichier', d.annoncee);
  note('ecart_mur_fichier_s', +Math.abs(d.duree - r.murBoucle).toFixed(3));

  const couv = await m.couverture();
  note('couverture_ko', Math.round(couv.size / 1024));

  /* Une image du PLAN, pas de la couverture : c'est elle qui montre ce que le
     spectateur verra pendant le film — le chronometre en place, le carton a sa
     hauteur, la zone sure respectee. Un montage se refuse pour un plan qui
     montre autre chose que ce que le conducteur annonce ; on regarde donc. */
  await m.avancer(m.prise, A + 4, false);
  m.dessiner(A + 4);
  const apercu = await new Promise(ok => m.cv.toBlob(ok, 'image/png'));
  window.__apercu = await new Promise(ok => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.readAsDataURL(apercu);
  });
  note('apercu_plan_ko', Math.round(apercu.size / 1024));

  // Et une image PENDANT le premier carton : c'est la moitie du texte du reel,
  // et sa hauteur est le seul reglage qui puisse le faire sortir de la zone sure.
  await m.avancer(m.prise, 1.2, false);
  m.dessiner(1.2);
  window.__carton = await new Promise(ok => {
    const fr = new FileReader();
    m.cv.toBlob(b => { fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(b); }, 'image/png');
  });

  bilan.srt = m.srt();
  bilan.legende = m.legende();

  /* Le fichier, pour que le pilote le pose sur le disque et qu'un outil
     exterieur puisse le relire : une mesure faite dans la page qui l'a
     produite ne se verifie pas toute seule. */
  const b64 = await new Promise(ok => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.readAsDataURL(r.blob);
  });
  window.__fichier = b64;
  window.__couverture = await new Promise(ok => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.readAsDataURL(couv);
  });
  note('octets_a_transferer', b64.length);

  window.__bilan = bilan;
  return bilan;
}
