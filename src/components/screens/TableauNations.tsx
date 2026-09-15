import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { Drapeau, COULEURS_MEDAILLE } from '@/components/Insignes';
import { tableauNations, type TableauNations as Tableau } from '@/game/championnats';
import { paysDe } from '@/game/identity';
import { getSavedName } from '@/game/leaderboard';

/**
 * LE TABLEAU DES MEDAILLES PAR NATION.
 *
 * Le jeu savait deja qui avait gagne quoi et sous quel drapeau ; il ne savait
 * pas l'additionner. C'est pourtant la seule vue qui fasse regarder un
 * championnat en se demandant ou en est SON pays plutot que ou en est son
 * pseudo — un classement individuel ne fabrique pas de clan.
 *
 * IL VIT DANS LE TOP 500, comme une quatrieme facon de classer les memes gens.
 * C'est sa place : les trois autres categories repondent « qui est le plus
 * rapide », celle-ci repond « qui a gagne », et les quatre se lisent au meme
 * endroit avec le meme selecteur de distance. Un bouton separe sur l'accueil
 * en aurait fait un ecran de plus a decouvrir, pour une reponse qu'on vient
 * chercher au meme moment que les autres.
 *
 * La DISTANCE vient donc du parent — c'est la rangee 100/200/400 du TOP 500,
 * et non un second selecteur. L'ECHELON reste ici : il n'a de sens que pour ce
 * tableau, et l'imposer aux trois autres categories aurait ajoute une ligne
 * qu'elles ne savent pas lire.
 *
 * Deux details qui ne se devinent pas :
 *
 * 1. LE RANG VIENT DU SERVEUR. Numeroter les lignes a l'ecran donnerait un 4e
 *    et un 5e a deux pays strictement egaux.
 *
 * 2. MON PAYS EST EPINGLE QUAND IL EST HORS DE VUE. Un tableau de deux cents
 *    lignes ou l'on doit chercher son drapeau ne sert a rien : c'est la ligne
 *    qu'on est venu lire.
 */

const [OR, ARGENT, BRONZE] = COULEURS_MEDAILLE;

const ECHELONS = [
  { cle: '', texte: 'nations_tous' },
  { cle: 'national', texte: 'nations_national' },
  { cle: 'continental', texte: 'nations_continental' },
  { cle: 'mondial', texte: 'nations_mondial' },
];

/**
 * Une ligne du tableau.
 *
 * `epingle` colle la ligne au bas du cadre qui defile. Le collant est pose sur
 * les CELLULES et non sur la rangee : un `position: sticky` sur un `<tr>` n'est
 * pas tenu par tous les moteurs, sur un `<td>` il l'est partout.
 */
function Ligne({ n, moi, epingle = false }: {
  n: Tableau['nations'][number]; moi: boolean; epingle?: boolean;
}) {
  const { N } = SprinterApp;
  const colle = epingle
    ? 'sticky bottom-0 bg-[#11151f] border-t border-primary/30'
    : '';
  return (
    <tr className={`border-t border-white/6 ${moi && !epingle ? 'bg-primary/8' : ''}`}>
      <td className={`py-2 pl-2 pr-1 text-right font-mono text-[11px] tabular-nums
                      text-muted-foreground w-10 ${colle}`}>
        {n.rang}
      </td>
      <td className={`py-2 px-1 ${colle}`}>
        <span className="flex items-center gap-2 min-w-0">
          <Drapeau pays={n.pays} className="text-base" />
          <span className={`font-bold text-[12px] tracking-wide truncate
                            ${moi ? 'text-primary' : 'text-foreground'}`}>
            {n.pays}
          </span>
          {moi && (
            <span className="text-[8px] tracking-widest text-primary/70 uppercase shrink-0">
              {N.t('nations_moi')}
            </span>
          )}
        </span>
        <span className="sr-only">
          {N.t(n.athletes > 1 ? 'nations_athletes_pl' : 'nations_athletes',
               { n: String(n.athletes) })}
        </span>
      </td>
      {([[n.or, OR], [n.argent, ARGENT], [n.bronze, BRONZE]] as const).map(([v, c], i) => (
        <td key={i} className={`py-2 px-1 text-center font-mono text-[12px] tabular-nums ${colle}`}
            style={{ color: v ? c : 'rgba(255,255,255,0.2)' }}>
          {v}
        </td>
      ))}
      {/* Le total est separe par un filet, et non par une couleur.
          L'argent est presque blanc — c'est ce qu'est l'argent — et le total
          l'etait aussi : deux colonnes claires collees l'une a l'autre qu'on
          lisait comme une seule. Le filet les separe sans avoir a fausser la
          couleur d'une medaille. */}
      <td className={`py-2 pl-2 pr-2 text-center font-mono text-[12px] tabular-nums font-bold
                      border-l border-white/10 ${colle}`}>
        {n.total}
      </td>
    </tr>
  );
}

/** Combien de lignes on voit sans derouler. Au-dela, mon pays s'epingle. */
const VISIBLES = 12;

export function PanneauNations({ epreuve }: { epreuve: string }) {
  const { N } = SprinterApp;
  const [echelon, setEchelon] = useState('');
  const [t, setT] = useState<Tableau | null>(null);
  const [chargement, setChargement] = useState(true);
  const [monPays, setMonPays] = useState<string | null>(null);

  // Mon pays, une fois. Il ne change pas pendant qu'on lit un tableau, et le
  // redemander a chaque filtre ferait un appel de plus par clic.
  useEffect(() => {
    let annule = false;
    const nom = getSavedName();
    if (!nom) return;
    paysDe(nom).then(r => { if (!annule) setMonPays((r.pays || '').toUpperCase() || null); })
               .catch(() => {});
    return () => { annule = true; };
  }, []);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    tableauNations({ echelon: echelon || undefined, epreuve: epreuve || undefined })
      .then(r => { if (!annule) { setT(r); setChargement(false); } })
      .catch(() => { if (!annule) { setT(null); setChargement(false); } });
    return () => { annule = true; };
  }, [echelon, epreuve]);

  const nations = t?.nations || [];
  // Mon pays n'est epingle que s'il est HORS des lignes qu'on voit sans
  // derouler. Au-dessus de la barre, la ligne est deja la — l'epingler ferait
  // doublon, et un doublon dans un tableau de medailles se lit comme une
  // erreur de comptage.
  const iMoi = monPays ? nations.findIndex(n => n.pays === monPays) : -1;
  const aEpingler = iMoi >= VISIBLES ? nations[iMoi] : null;

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap justify-center"
           role="group" aria-label={N.t('cat_nations_sub')}>
        {ECHELONS.map(e => {
          const on = e.cle === echelon;
          return (
            <button key={e.cle || 'tous'} onClick={() => setEchelon(e.cle)} aria-pressed={on}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest border
                          transition-colors
                ${on ? 'bg-primary/20 text-primary border-primary/50'
                     : 'text-muted-foreground/60 border-white/10 hover:bg-white/5'}`}>
              {N.t(e.texte)}
            </button>
          );
        })}
      </div>

      <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl">
        {chargement && !t && (
          <p className="text-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground inline" />
          </p>
        )}

        {/* Vide et EN PANNE se disent de la meme facon, a dessein.
            `json` rend `null` aussi bien sur un 404 que sur un reseau coupe :
            l'ecran ne peut pas distinguer les deux, et inventer « erreur
            serveur » sur une reponse qu'on n'a pas lue serait affirmer plus
            qu'on ne sait. Ce qui est vrai dans les deux cas : il n'y a rien a
            montrer. Ce qu'il ne faut surtout pas faire, et que cet ecran
            faisait, c'est ne rien afficher du tout. */}
        {!chargement && !nations.length && (
          <p className="text-center text-sm text-muted-foreground py-6">
            {N.t('nations_vide')}
          </p>
        )}

        {!!nations.length && (
          <>
            <div className="flex items-baseline justify-between px-1 pb-2 mb-1 border-b border-white/10">
              <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground">
                {N.t(nations.length > 1 ? 'nations_compte_pl' : 'nations_compte',
                     { n: String(nations.length) })}
              </span>
              <span className="text-[9px] md:text-[10px] text-muted-foreground/70">
                {epreuve ? `${epreuve} m` : N.t('nations_tous')}
              </span>
            </div>

            <div className="max-h-[calc(100dvh-24rem)] min-h-[40vh] overflow-y-auto
                            overscroll-contain pr-1">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-[8px] tracking-widest uppercase text-muted-foreground/60">
                    <th scope="col" className="py-2 pl-2 pr-1 text-right font-medium">#</th>
                    <th scope="col" className="py-2 px-1 text-left font-medium" />
                    <th scope="col" className="py-2 px-1 font-medium" style={{ color: OR }}>
                      {N.t('nations_or')}
                    </th>
                    <th scope="col" className="py-2 px-1 font-medium" style={{ color: ARGENT }}>
                      {N.t('nations_argent')}
                    </th>
                    <th scope="col" className="py-2 px-1 font-medium" style={{ color: BRONZE }}>
                      {N.t('nations_bronze')}
                    </th>
                    <th scope="col" className="py-2 pl-2 pr-2 font-medium border-l border-white/10">
                      {N.t('nations_total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nations.map(n => (
                    <Ligne key={n.pays} n={n} moi={n.pays === monPays} />
                  ))}
                  {aEpingler && <Ligne n={aEpingler} moi epingle />}
                </tbody>
              </table>
            </div>

            {!!t?.sansPays && (
              <p className="text-[9px] md:text-[10px] text-muted-foreground/70 leading-snug
                            mt-3 pt-2 border-t border-white/10">
                {N.t(t.sansPays > 1 ? 'nations_sans_pays_pl' : 'nations_sans_pays',
                     { n: String(t.sansPays) })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
