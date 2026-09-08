/* ---------------------------------------------------------------------------
   LE VERROU DE NATIONALITE
   ---------------------------------------------------------------------------
   Une nationalite se choisit une fois et ne se change plus : elle decide du
   championnat national ou l'on se presente, et sans verrou il suffirait de
   suivre la grille la plus faible pour collectionner les titres.

   Ce test tourne sur une base FACTICE, et c'est deliberе : la regle vit
   entierement dans `choisirPays` et `oublierPays`, deux fonctions qui lisent
   une ligne et decident. Les faire tourner contre D1 demanderait un joueur
   reel, un appareil reel, et laisserait des ecritures derriere — pour ne rien
   verifier de plus.

       node tools/nationalite-test.mjs
--------------------------------------------------------------------------- */
import { choisirPays, oublierPays, imposerPays } from '../worker/src/championnats.js';

function fausseBase(ligne) {
  const etat = { ligne, ecrit: [] };
  const db = {
    batch: async () => {},
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/SELECT pays, source FROM player_pays/.test(sql)) return etat.ligne;
              return null;
            },
            async run() { etat.ecrit.push({ sql: sql.trim().split('\n')[0], args }); return {}; },
            async all() { return { results: [] }; },
          };
        },
      };
    },
  };
  return { db, etat };
}

const cas = [];
const dire = (nom, ok, detail) => cas.push({ nom, ok, detail });

// 1 · aucune ligne : le choix passe
{
  const { db, etat } = fausseBase(null);
  const r = await choisirPays(db, 'toto', 'FR');
  dire('choix sur profil vierge', !r.erreur && etat.ecrit.length === 1, JSON.stringify(r));
}
// 2 · ligne 'geo' : le choix passe et remplace la detection
{
  const { db, etat } = fausseBase({ pays: 'BE', source: 'geo' });
  const r = await choisirPays(db, 'toto', 'MA');
  dire('choix par-dessus une detection', !r.erreur && etat.ecrit.length === 1, JSON.stringify(r));
}
// 3 · ligne 'choix' + AUTRE pays : refus, et rien n'est ecrit
{
  const { db, etat } = fausseBase({ pays: 'FR', source: 'choix' });
  const r = await choisirPays(db, 'toto', 'MA');
  dire('second choix refuse', r.erreur === 'nationalite deja choisie' && r.pays === 'FR' && etat.ecrit.length === 0, JSON.stringify(r));
}
// 4 · ligne 'choix' + MEME pays : accepte sans rien reecrire
{
  const { db, etat } = fausseBase({ pays: 'FR', source: 'choix' });
  const r = await choisirPays(db, 'toto', 'FR');
  dire('reposer le meme pays', r.ok === true && r.inchange === true && etat.ecrit.length === 0, JSON.stringify(r));
}
// 5 · retrait d'une nationalite choisie : refus
{
  const { db, etat } = fausseBase({ pays: 'FR', source: 'choix' });
  const r = await oublierPays(db, 'toto');
  dire('retrait refuse', r.ok === false && r.erreur === 'nationalite definitive' && etat.ecrit.length === 0, JSON.stringify(r));
}
// 6 · retrait d'une detection : accepte
{
  const { db, etat } = fausseBase({ pays: 'BE', source: 'geo' });
  const r = await oublierPays(db, 'toto');
  dire('retrait d une detection', r.ok === true && etat.ecrit.length === 1, JSON.stringify(r));
}
// 7 · code invalide
{
  const { db } = fausseBase(null);
  const r = await choisirPays(db, 'toto', 'ZZZ');
  dire('code invalide refuse', r.erreur === 'pays invalide', JSON.stringify(r));
}

// 8 · l'administration corrige : elle passe le verrou, et dit ce qu'elle efface
{
  const { db, etat } = fausseBase({ pays: 'FR', source: 'choix' });
  const r = await imposerPays(db, 'toto', 'MA');
  dire('correction admin', r.ok === true && r.avant === 'FR' && r.pays === 'MA' && etat.ecrit.length === 1, JSON.stringify(r));
}
// 9 · corriger vers le meme pays n'ecrit rien
{
  const { db, etat } = fausseBase({ pays: 'FR', source: 'choix' });
  const r = await imposerPays(db, 'toto', 'FR');
  dire('correction sans changement', r.ok === true && r.inchange === true && etat.ecrit.length === 0, JSON.stringify(r));
}
// 10 · elle ne CREE pas une nationalite : choisir a la place de quelqu'un est
//      exactement ce que le verrou empeche
{
  const { db, etat } = fausseBase(null);
  const r = await imposerPays(db, 'toto', 'MA');
  dire('correction sur profil vierge refusee',
       r.erreur === 'ce joueur n a pas declare de nationalite' && etat.ecrit.length === 0, JSON.stringify(r));
}
// 11 · elle ne remplace pas non plus une simple detection : une ligne 'geo'
//      n'est pas une declaration, et ecrire par-dessus serait choisir a la
//      place du joueur
{
  const { db, etat } = fausseBase({ pays: 'BE', source: 'geo' });
  const r = await imposerPays(db, 'toto', 'MA');
  dire('correction par-dessus une detection refusee',
       r.erreur === 'ce joueur n a pas declare de nationalite' && etat.ecrit.length === 0, JSON.stringify(r));
}

let mal = 0;
for (const c of cas) { if (!c.ok) mal++; console.log(`${c.ok ? '  ok' : 'ECHEC'}  ${c.nom}  ${c.ok ? '' : c.detail}`); }
console.log(`\n${cas.length - mal}/${cas.length}`);
process.exit(mal ? 1 : 0);
