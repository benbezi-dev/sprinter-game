// Le pont entre le jeu (JavaScript) et la scene Unity.
//
// Le jeu ecrit a chaque image un Float32Array dans window.__jumperEtat
// (src/game/sauts-unity.js) ; la scene le recopie ici dans sa memoire. Pas de
// SendMessage ni de JSON a chaque image : une simple copie de quelques
// centaines d'octets.
mergeInto(LibraryManager.library, {
  JumperLire: function (ptr, n) {
    var s = window.__jumperEtat;
    if (!s) return 0;
    var m = Math.min(n, s.length);
    HEAPF32.set(s.subarray(0, m), ptr >> 2);
    return m;
  },
  JumperPret: function () {
    if (typeof window.__jumperPret === 'function') window.__jumperPret();
  },
});
