/* ===========================================================================
   LA LISTE DU CHARGEMENT, EN DOUBLURE POUR LES HARNAIS ESBUILD.

   game/chargement.ts importe `virtual:precharge`, un module que Vite fabrique
   a la compilation (listeDuChargement, dans vite.config.ts) : les images des
   decors et des pubs que l'ouverture demande d'avance. Les harnais qui
   compilent le moteur avec esbuild ne passent pas par Vite, et le module
   n'existait donc pas pour eux — la compilation s'arretait la, avant la
   premiere verification.

   Ils recoivent ici une liste VIDE. Aucun d'eux ne mesure le chargement, et
   une liste vide est ce que Vite rendrait sans dossier public : le moteur ne
   precharge rien, et c'est tout ce qui change.

     import { doublurePrecharge } from './doublure-precharge.mjs';
     await build({ ..., plugins: [doublurePrecharge] });
   =========================================================================== */

export const doublurePrecharge = {
  name: 'doublure-precharge',
  setup(b) {
    b.onResolve({ filter: /^virtual:precharge$/ }, a => ({ path: a.path, namespace: 'doublure-precharge' }));
    b.onLoad({ filter: /.*/, namespace: 'doublure-precharge' }, () => ({
      contents: 'export default { ordinaire: [], ultra: [] };', loader: 'js',
    }));
  },
};
