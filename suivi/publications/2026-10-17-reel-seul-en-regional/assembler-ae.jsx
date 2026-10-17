/* ---------------------------------------------------------------------------
   REEL « UN SEUL COUREUR EN REGIONAL. » — l'assemblage dans After Effects
   ---------------------------------------------------------------------------
   After Effects ne dessine rien ici : chaque image vient de la page de montage
   (bouton « Séquence PNG pour After Effects »), avec les vraies fontes et le
   vrai langage visuel de src/game/trace-affiche.js. AE ne fait que ce qu'il
   fait mieux que le navigateur : encoder une cadence parfaitement constante,
   au debit qu'on lui donne.

   Fichier → Scripts → Exécuter le fichier de script…, puis choisir le dossier
   sequence-png/ que la page a ecrit. Le script refuse de monter une sequence
   incomplete : 660 images, ni plus ni moins (11,0 s a 60 i/s).

   Sortie : video.mp4 a cote du dossier sequence-png/, en H.264 si le modele
   de sortie natif existe (AE 2023 et suivants), sinon un .mov en
   « High Quality » — le dire alors dans le LISEZMOI.
--------------------------------------------------------------------------- */
(function () {
  var IMAGES = 660, IPS = 60, L = 1440, H = 2560, DUREE = 11;

  var dossier = Folder.selectDialog('Le dossier sequence-png/ écrit par la page de montage');
  if (!dossier) return;
  var fichiers = dossier.getFiles(function (f) {
    return f instanceof File && /^seul-en-regional_\d{4}\.png$/i.test(decodeURI(f.name));
  });
  if (fichiers.length !== IMAGES) {
    alert('Attendu ' + IMAGES + ' images, trouvé ' + fichiers.length + '. Rien n\'est monté.');
    return;
  }
  fichiers.sort(function (a, b) { return a.name < b.name ? -1 : 1; });

  app.beginUndoGroup('Reel seul en Régional');
  var options = new ImportOptions(fichiers[0]);
  options.sequence = true;
  options.forceAlphabetical = true;
  var sequence = app.project.importFile(options);
  sequence.mainSource.conformFrameRate = IPS;
  sequence.name = 'seul-en-regional · séquence 60 i/s';

  var comp = app.project.items.addComp('reel-seul-en-regional', L, H, 1, DUREE, IPS);
  comp.bgColor = [6 / 255, 9 / 255, 19 / 255];          // #060913, la nuit du jeu
  var calque = comp.layers.add(sequence);
  calque.startTime = 0;

  if (Math.abs(sequence.duration - DUREE) > 1 / IPS / 2) {
    app.endUndoGroup();
    alert('La séquence dure ' + sequence.duration + ' s au lieu de ' + DUREE + ' s. Rien n\'est mis en file.');
    return;
  }

  var rendu = app.project.renderQueue.items.add(comp);
  try { rendu.applyTemplate('Best Settings'); } catch (e) {}
  var sortie = rendu.outputModule(1);
  var modeles = ['H.264 - Match Render Settings - 40 Mbps', 'H.264 - Match Render Settings - 15 Mbps', 'H.264'];
  var retenu = null;
  for (var i = 0; i < modeles.length && !retenu; i++) {
    try { sortie.applyTemplate(modeles[i]); retenu = modeles[i]; } catch (e) {}
  }
  var extension = 'mp4';
  if (!retenu) {
    try { sortie.applyTemplate('High Quality'); retenu = 'High Quality'; extension = 'mov'; } catch (e) {}
  }
  sortie.file = new File(dossier.parent.fsName + '/video.' + extension);
  app.endUndoGroup();

  alert('Composition 1440 × 2560 · 60 i/s · 11,0 s prête.\n'
      + 'Modèle de sortie : ' + (retenu || 'aucun — à choisir à la main') + '\n'
      + 'Fichier : ' + sortie.file.fsName + '\n\nLancer le rendu depuis la file d\'attente.');
})();
