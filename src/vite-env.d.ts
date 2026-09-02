/// <reference types="vite/client" />

// Le canal de publication, fixe a la compilation. Absent en production,
// « test » sur la version de test. Voir src/game/canal.ts.
interface ImportMetaEnv {
  readonly VITE_CANAL?: 'test';
  // « native » dans le build de l'application installee, absent sur le site.
  readonly VITE_ENVELOPPE?: 'native';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
