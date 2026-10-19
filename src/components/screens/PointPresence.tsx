import { SprinterApp } from '@/game/engine';
import type { Present } from '@/game/presence';

/**
 * Le point de presence, a cote d'un nom.
 *
 * Vert : au menu, disponible tout de suite. Ambre : la, mais occupe — en
 * course, en duel, en direct. Rien quand le joueur n'a pas le jeu ouvert : un
 * point gris ne dirait rien, et l'absence se lit d'elle-meme a cote de ceux qui
 * brillent.
 *
 * Extrait de DuelRanking pour servir aussi au tchat et a la meute.
 */
export function PointPresence({ p }: { p: Present | undefined }) {
  const { N } = SprinterApp;
  if (!p) return null;
  const dispo = p.quoi === 'menu';
  return (
    <span className="relative inline-flex w-2 h-2 shrink-0" title={N.t('pres_' + p.quoi)}>
      {dispo && <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping motion-reduce:hidden" />}
      <span className={`relative inline-flex w-2 h-2 rounded-full ${dispo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="sr-only">{N.t('pres_a11y')} — {N.t('pres_' + p.quoi)}</span>
    </span>
  );
}
