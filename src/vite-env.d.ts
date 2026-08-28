/// <reference types="vite/client" />

// Le canal de publication, fixe a la compilation. Absent en production,
// « test » sur la version de test. Voir src/game/canal.ts.
interface ImportMetaEnv {
  readonly VITE_CANAL?: 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
