/// <reference types="vite/client" />

// Le canal de publication, fixe a la compilation. Absent en production,
// « test » sur la version de test. Voir src/game/canal.ts.
interface ImportMetaEnv {
  readonly VITE_CANAL?: 'test';
  // « native » dans le build de l'application installee, absent sur le site.
  readonly VITE_ENVELOPPE?: 'native';
  // Mise a jour au lancement, pour le developpement : couper ou simuler
  // (src/game/mise-a-jour/config.ts).
  readonly VITE_MAJ?: 'off' | 'optionnelle' | 'obligatoire';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Les images que l'ecran d'ouverture charge avant que le jeu ne parte, listees
// au build depuis public/ (voir listeDuChargement dans vite.config.ts).
declare module 'virtual:precharge' {
  const liste: { ordinaire: string[]; ultra: string[] };
  export default liste;
}
