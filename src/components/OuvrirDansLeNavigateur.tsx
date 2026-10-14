import { SprinterApp } from '@/game/engine';
import { UA_INTEGRE } from '@/game/navigateur';

/**
 * LE NAVIGATEUR INTEGRE D'UNE APPLI (Instagram, Facebook, TikTok, Snapchat…).
 *
 * Le lien « Regarder » circule surtout par Instagram, qui l'ouvre dans son
 * propre navigateur : ni feuille de partage de fichiers, ni telechargement.
 * Videos, photo-finish et images de resultat ne pouvaient donc pas en sortir,
 * sans un mot (26/09). Rien a corriger dans le jeu : il faut sortir de l'appli.
 * Ce bandeau le dit, et ouvre la meme page dans le vrai navigateur — Chrome
 * sur Android (lien `intent:`), Safari sur iPhone (`x-safari-https:`, iOS 17
 * et suivants ; sinon, la consigne du menu suffit).
 *
 * La liste des applis vit dans game/navigateur.ts, que le tunnel des premiers
 * pas lit aussi : une seule detection pour les deux.
 */
export const DANS_UNE_APPLI = typeof navigator !== 'undefined'
  && UA_INTEGRE.test(navigator.userAgent || '');

function lienVersLeNavigateur(): string {
  const { host, pathname, search, hash } = window.location;
  const ici = `${host}${pathname}${search}${hash}`;
  if (/Android/i.test(navigator.userAgent)) {
    return `intent://${ici}#Intent;scheme=https;package=com.android.chrome;`
      + `S.browser_fallback_url=${encodeURIComponent('https://' + ici)};end`;
  }
  return `x-safari-https://${ici}`;
}

export function OuvrirDansLeNavigateur({ compact = false }: { compact?: boolean }) {
  if (!DANS_UNE_APPLI) return null;
  const { N } = SprinterApp;
  return (
    <div className={`w-full rounded-xl border border-amber-400/50 bg-amber-400/10 text-center
                     flex flex-col items-center gap-2 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <p className="text-[11px] leading-snug text-foreground/90">{N.t('iab_texte')}</p>
      <a href={lienVersLeNavigateur()} target="_blank" rel="noopener"
         className="px-4 py-1.5 rounded-full bg-amber-400 text-black text-[11px] font-bold tracking-widest">
        {N.t('iab_bouton')}
      </a>
      <p className="text-[9px] text-muted-foreground">{N.t('iab_menu')}</p>
    </div>
  );
}
