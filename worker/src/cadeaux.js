/* ---------------------------------------------------------------------------
   LES CADEAUX — ce que l'auteur offre a un joueur nomme.
   ---------------------------------------------------------------------------

   Un skin se gagne, un stade aussi (src/game/vedettes.ts) : on bat l'athlete
   qui les tient. Mais l'auteur peut aussi les OFFRIR, a un joueur qu'il
   designe par son nom. La liste vit ici, dans le code, et pas dans une table :
   elle est courte, elle se relit dans l'historique des commits, et la changer
   ne demande ni cle d'administration ni requete a la main.

   UN CADEAU VA A UN NOM RESERVE, ET SEULEMENT DEPUIS SES APPAREILS. Un nom
   libre se tape par n'importe qui : offrir quelque chose a « Choppa » sans
   cette condition, ce serait l'offrir a tous ceux qui ecrivent « Choppa » dans
   la puce du nom. La route `/cadeaux` (index.js) ne rend donc la liste qu'a un
   appareil relie au nom (player_devices) — la meme preuve que partout ailleurs.

   CE QUE LE JEU EN FAIT. Il les recoit au lancement et a chaque changement de
   nom (src/game/cadeaux.ts), et les range sur l'appareil comme s'il les avait
   gagnes : le skin dans le vestiaire, le stade parmi les lieux ouverts. Rien
   ne se reprend : un cadeau retire d'ici reste chez qui l'a deja recu.

   Les clefs : `skins`, celles de SKINS (src/game/vestiaire.ts) ; `stades`,
   les `cle` de STADES_HORS_SERIE (src/game/sprinter-core.js).
--------------------------------------------------------------------------- */

const CADEAUX = {
  // 03/10, a la demande de l'auteur : le skin de Meba-Mickael Zeze et le
  // Stade de la Riviera, sans avoir a le battre au 100 m et au 200 m.
  choppa: { skins: ['meba'], stades: ['riviera'] },
};

const AUCUN = Object.freeze({ skins: [], stades: [] });

/** Ce qui est offert a ce nom (sa clef : le nom en minuscules), ou rien. */
export function cadeauxDe(nameKey) {
  const c = Object.prototype.hasOwnProperty.call(CADEAUX, nameKey) ? CADEAUX[nameKey] : null;
  return c ? { skins: [...(c.skins || [])], stades: [...(c.stades || [])] } : { ...AUCUN };
}

/** Ce nom a-t-il quelque chose a recevoir ? Evite une lecture de base pour tous les autres. */
export function aDesCadeaux(nameKey) {
  const c = cadeauxDe(nameKey);
  return c.skins.length > 0 || c.stades.length > 0;
}
