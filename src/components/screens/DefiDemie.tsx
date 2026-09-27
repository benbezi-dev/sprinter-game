import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, Play, RotateCcw, Timer } from 'lucide-react';
import { MONTEE } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import { Drapeau } from '@/components/Insignes';
import { EST_TEST } from '@/game/canal';
import { etatEdition, recapMondial, type Edition } from '@/game/championnats';
import {
  defiOuvert, placer, courirLeDefi, conclureLeDefi, recourir, quitterLeDefi,
  encoreOuvert, monMeilleur, useDefiDemie, cleDuDefi, venuPourLeDefi,
  type Defi, type ResultatDefi,
} from '@/game/defi-demie';

/**
 * LE DEFI DE LA DEMI, VU DE L'ECRAN (27/09).
 *
 * Trois morceaux, parce qu'ils ne vivent pas au meme endroit :
 *
 * - la CARTE, dans le panneau du championnat (et, pour qui n'y court pas,
 *   seule a sa place) : elle n'existe qu'entre la demie 1 courue et la demie 2
 *   appelee ;
 * - le BANDEAU du depart, au-dessus de la piste : ton couloir, et a la place
 *   de qui — il s'efface au coup de pistolet, la course n'a besoin de rien ;
 * - l'ARRIVEE, a la place de l'ecran de fin du one shot : ta place dans la
 *   demie, le tableau, ton meilleur, et de quoi recourir tout de suite.
 *
 * La regle du jeu est dans game/defi-demie.ts.
 */

const OR = '#F8CD4A';

// Virgule en francais, point en anglais — comme le reste du championnat.
const chrono = (ms: number | null) => ms == null ? '—'
  : (ms / 1000).toFixed(3).replace('.', SprinterApp.N.getLang() === 'en' ? '.' : ',') + ' s';
const ecart = (ms: number) =>
  (Math.abs(ms) / 1000).toFixed(2).replace('.', SprinterApp.N.getLang() === 'en' ? '.' : ',') + ' s';

/** « 1 h 52 min » a partir d'un delai en millisecondes. */
function delai(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}

function useMaintenant(pas = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), pas);
    return () => clearInterval(id);
  }, [pas]);
  return t;
}

/* ------------------------------------------------------------- la carte */

/**
 * La carte du defi, pour une edition deja lue. Ne rend rien hors de la
 * fenetre, ou a un partant de la demie 2.
 */
export function CarteDefiDemie({ e }: { e: Edition }) {
  const maintenant = useMaintenant();
  const d = defiOuvert(e, maintenant);
  if (!d) return null;
  return <Carte d={d} maintenant={maintenant} />;
}

/**
 * Venu par le lien des cartes (`?championnat`), on amene la carte sous les
 * yeux : une fois par chargement, pas a chaque rendu.
 */
let defileFait = false;

function Carte({ d, maintenant }: { d: Defi; maintenant: number }) {
  const { N } = SprinterApp;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (defileFait || !venuPourLeDefi()) return;
    defileFait = true;
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 600);
    return () => clearTimeout(t);
  }, []);
  const p = placer(d);
  if (!p.adversaires.length) return null;
  const moi = p.moi && p.moi.ms != null ? p.moi : null;
  const m = monMeilleur(cleDuDefi(d));
  const finale = d.genre === 'finale';
  return (
    <motion.div {...MONTEE} ref={ref}
      className="flex flex-col gap-2.5 rounded-xl border px-3 py-3"
      style={{ borderColor: 'rgba(248,205,74,0.45)', backgroundColor: 'rgba(248,205,74,0.07)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0 text-[9px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          <Gamepad2 className="w-3.5 h-3.5 shrink-0" style={{ color: OR }} />
          <span className="truncate">{N.t('defi_attente', { c: d.attendue.toUpperCase() })}</span>
        </span>
        {d.departAttendue != null && d.departAttendue > maintenant && (
          <span className="flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums shrink-0"
                style={{ color: OR }}>
            <Timer className="w-3 h-3" />
            {delai(d.departAttendue - maintenant)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-display font-black tracking-wide text-base leading-none" style={{ color: OR }}>
          {N.t(finale ? 'defi_titre_finale' : 'defi_titre')}
        </span>
        <span className="text-[11px] leading-snug text-foreground/75">
          {finale ? N.t('defi_texte_finale')
            : moi ? N.t('defi_texte_moi', { c: d.titre.toLowerCase(), t: chrono(moi.ms) })
            : N.t('defi_texte', { c: d.titre.toLowerCase() })}
        </span>
      </div>
      {/* Les huit qu'on va affronter, dans leurs couloirs : on sait contre qui
          on court avant d'y aller. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {p.adversaires.slice().sort((a, b) => a.couloir - b.couloir).map(c => (
          <span key={c.cle} className="flex items-center gap-1 text-[10px] text-foreground/60 min-w-0">
            <span className="font-mono text-[9px] text-muted-foreground/70">{c.couloir}</span>
            <Drapeau pays={c.pays} className="text-[10px]" />
            <span className="truncate max-w-[7.5rem]">{c.nom}</span>
            <span className="font-mono tabular-nums text-foreground/45">{chrono(c.ms)}</span>
          </span>
        ))}
      </div>
      {m && m.meilleur != null && (
        <span className="text-[10px] tracking-wide text-foreground/70">
          {N.t('defi_meilleur', { t: chrono(m.meilleur), p: m.place ? N.ord(m.place) : '—' })}
          {' · '}
          {m.essais > 1 ? N.t('defi_essais', { n: String(m.essais) }) : N.t('defi_essai')}
        </span>
      )}
      <button onClick={() => courirLeDefi(d)}
        className="self-center flex items-center gap-1.5 px-4 py-2 rounded-full border
                   text-[11px] font-black tracking-widest active:scale-95 transition"
        style={{ borderColor: 'rgba(248,205,74,0.7)', backgroundColor: 'rgba(248,205,74,0.18)', color: OR }}>
        <Play className="w-3.5 h-3.5" />
        {N.t(moi ? 'defi_courir_moi' : 'defi_courir', { c: d.titre.toUpperCase() })}
      </button>
    </motion.div>
  );
}

/* --------------------------------------------- pour qui n'est pas engage */

/**
 * La carte seule, pour qui ne court pas le championnat : le panneau du
 * championnat ne s'ouvre qu'aux partants (voir ChampPanel), et ce sont
 * justement ceux-la que le defi doit aussi occuper.
 *
 * L'edition se cherche parmi celles en cours, en demi-finales. En
 * production, seulement le dimanche (UTC) : les demies y tombent toujours,
 * et l'accueil de la semaine n'a pas a interroger le serveur pour rien.
 */
let cache: { at: number; edition: Edition | null } | null = null;
const CACHE_MS = 60_000;

async function editionEnDemies(): Promise<Edition | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.edition;
  const monde = await recapMondial();
  // Les demies, puis la finale : les trois fenetres du defi (defi-demie.ts).
  const ligne = (monde?.encours || []).find(l => l.phase === 'demies' || l.phase === 'finale') || null;
  const edition = ligne ? await etatEdition(ligne.edition) : null;
  cache = { at: Date.now(), edition };
  return edition;
}

export function DefiDemieSpectateur() {
  const [e, setE] = useState<Edition | null>(null);
  useEffect(() => {
    if (!EST_TEST && new Date().getUTCDay() !== 0) return;
    let vivant = true;
    const lire = () => editionEnDemies().then(x => { if (vivant) setE(x); });
    lire();
    // La fenetre se ferme a la demie 2 : on relit de temps en temps.
    const t = setInterval(lire, CACHE_MS);
    return () => { vivant = false; clearInterval(t); };
  }, []);
  if (!e) return null;
  return (
    <div className="bg-card/70 backdrop-blur-xl border rounded-2xl p-3 shadow-2xl"
         style={{ borderColor: 'rgba(248,205,74,0.28)' }}>
      <CarteDefiDemie e={e} />
    </div>
  );
}

/* ------------------------------------------------------------ le depart */

/**
 * Au depart : ton couloir, et a la place de qui. Seulement pendant le
 * decompte — une fois partie, la course n'a besoin de rien par-dessus.
 */
export function BandeauDefi() {
  const { N } = SprinterApp;
  const { state } = useGameStore();
  const { defi, placement } = useDefiDemie();
  if (state !== 'count' || !defi || !placement || !SprinterApp.G.defiDemie) return null;
  return (
    // Couche, le haut de l'ecran est au compte a rebours : le bandeau descend
    // juste au-dessus des touches.
    <motion.div {...MONTEE}
      className="absolute left-0 right-0 z-40 flex justify-center pointer-events-none
                 px-[max(env(safe-area-inset-left),1rem)]
                 top-[calc(max(env(safe-area-inset-top),0.5rem)+3.2rem)]
                 court:landscape:top-auto court:landscape:bottom-[7.4rem]">
      <div className="flex items-center gap-2 rounded-full border bg-black/80 px-4 py-1.5 max-w-full"
           style={{ borderColor: 'rgba(248,205,74,0.55)' }}>
        <span className="text-[10px] font-black tracking-widest shrink-0" style={{ color: OR }}>
          {defi.titre.toUpperCase()}
        </span>
        <span className="text-[10px] font-bold tracking-widest text-white/85 truncate">
          {N.t('defi_couloir', { c: String(placement.couloir) })}
          {placement.remplace ? ' · ' + N.t('defi_remplace', { n: placement.remplace.nom }) : ''}
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------- l'arrivee */

/**
 * L'ecran de fin du defi, a la place de celui du one shot : il ne propose ni
 * TOP 500 ni defi a un ami — seulement la place qu'on aurait eue, et le
 * bouton pour recourir.
 */
export function FinDuDefi() {
  const { N } = SprinterApp;
  const maintenant = useMaintenant();
  const { defi, placement } = useDefiDemie();
  const [r, setR] = useState<ResultatDefi | null>(null);
  useEffect(() => { setR(conclureLeDefi()); }, []);
  if (!defi || !placement || !r) return null;
  const ouvert = encoreOuvert(defi, maintenant);
  const vrai = placement.moi && placement.moi.ms != null ? placement.moi.ms : null;

  let verdict = '';
  if (r.fauxDepart) verdict = N.t(defi.genre === 'finale' ? 'defi_fd_finale' : 'defi_fd');
  else if (r.ms == null) verdict = N.t('defi_sans_chrono');
  else if (defi.genre === 'finale') {
    // La finale ne qualifie pour rien : elle donne trois medailles.
    verdict = N.t(r.place === 1 ? 'defi_or' : r.place === 2 ? 'defi_argent'
      : r.place === 3 ? 'defi_bronze' : 'defi_hors_podium');
  }
  else if (r.place != null && r.place <= defi.directs) verdict = N.t('defi_qualifie');
  else verdict = N.t('defi_pas_qualifie', { n: String(defi.directs) });

  let contreSoi = '';
  if (vrai != null && r.ms != null) {
    const dt = r.ms - vrai;
    contreSoi = dt < 0 ? N.t('defi_vrai_mieux', { e: ecart(dt), t: chrono(vrai) })
      : dt > 0 ? N.t('defi_vrai_moins', { e: ecart(dt), t: chrono(vrai) })
      : N.t('defi_vrai_egal', { t: chrono(vrai) });
  }

  return (
    <motion.div {...MONTEE}
      className="absolute inset-0 z-40 overflow-y-auto overscroll-contain
                 bg-gradient-to-b from-black/85 via-black/75 to-black/90
                 px-[max(env(safe-area-inset-left),1rem)] pointer-events-auto">
      <div className="min-h-full flex pt-[max(env(safe-area-inset-top),1rem)]
                      pb-[max(env(safe-area-inset-bottom),1rem)] court:pt-[max(env(safe-area-inset-top),0.5rem)]
                      court:pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      {/* COUCHE, EN DEUX COLONNES : le verdict et les boutons a gauche, le
          tableau a droite. En une colonne, les huit lignes poussaient REJOUER
          sous le bord de l'ecran. */}
      <div className="m-auto w-full max-w-[420px] flex flex-col gap-3 court:gap-2
                      court:landscape:max-w-[800px] court:landscape:grid court:landscape:grid-cols-2
                      court:landscape:gap-x-6 court:landscape:items-center">
        <div className="text-center flex flex-col items-center gap-1
                        court:landscape:col-start-1 court:landscape:row-start-1 court:landscape:self-end">
          <div className="text-[9px] font-bold tracking-[0.35em] text-white/45 uppercase">
            {defi.genre === 'finale' ? N.t('defi_titre_finale') : `${N.t('defi_titre')} · ${defi.titre}`}
          </div>
          <div className="font-display font-black text-4xl court:text-3xl tracking-wider leading-none"
               style={{ color: r.fauxDepart ? '#EF4444' : OR }}>
            {r.fauxDepart ? N.t('champ_fd') : r.place != null ? N.ord(r.place) : '—'}
          </div>
          {r.ms != null && (
            <div className="font-mono text-lg court:text-base font-bold tabular-nums text-white">
              {chrono(r.ms)}
            </div>
          )}
          <div className="text-[12px] font-bold tracking-wide text-white/85">{verdict}</div>
          {contreSoi && <div className="text-[11px] tracking-wide text-white/65">{contreSoi}</div>}
          {placement.remplace && (
            <div className="text-[10px] tracking-wide text-white/50">
              {N.t('defi_remplace_fin', { n: placement.remplace.nom, t: chrono(placement.remplace.ms) })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1
                        court:landscape:col-start-2 court:landscape:row-start-1 court:landscape:row-span-2">
          {r.classement.map((l, i) => (
            <motion.div key={(l.moi ? 'moi' : l.nom) + l.couloir}
              initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.22 }}
              className={`flex items-center gap-3 px-3 py-1.5 court:py-1 rounded-xl border
                ${l.moi ? 'border-primary/60 bg-primary/15' : 'border-white/8 bg-black/30'}`}>
              <span className="font-display font-black text-base w-5 shrink-0 tabular-nums"
                    style={{ color: l.ms != null && i === 0 ? OR : 'rgba(255,255,255,0.55)' }}>
                {l.ms != null ? i + 1 : '—'}
              </span>
              <span className="font-mono text-[10px] w-5 h-5 shrink-0 grid place-items-center
                               rounded border border-white/15 bg-white/[0.04] text-white/50">
                {l.couloir}
              </span>
              <span className={`flex-1 min-w-0 truncate text-[12px] tracking-wide
                ${l.moi ? 'font-black text-primary' : 'font-bold'}`}>{l.nom}</span>
              <span className="font-mono text-[12px] tabular-nums shrink-0 font-bold text-white/80">
                {l.moi && r.fauxDepart ? N.t('champ_dq') : chrono(l.ms)}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col gap-3 court:gap-2
                        court:landscape:col-start-1 court:landscape:row-start-2 court:landscape:self-start">
        <div className="text-center text-[10px] tracking-wide text-white/60 flex flex-col gap-0.5">
          {r.nouveauMeilleur && (
            <span className="font-black tracking-widest" style={{ color: OR }}>{N.t('defi_nouveau')}</span>
          )}
          {r.meilleur != null && (
            <span>
              {N.t('defi_meilleur', { t: chrono(r.meilleur), p: r.meilleurePlace ? N.ord(r.meilleurePlace) : '—' })}
              {' · '}
              {r.essais > 1 ? N.t('defi_essais', { n: String(r.essais) }) : N.t('defi_essai')}
            </span>
          )}
          {ouvert && defi.departAttendue != null && defi.departAttendue > maintenant && (
            <span>{N.t('defi_dans', { c: defi.attendue, d: delai(defi.departAttendue - maintenant) })}</span>
          )}
          {!ouvert && <span className="font-bold" style={{ color: OR }}>{N.t('defi_ferme', { c: defi.attendue })}</span>}
        </div>

        <div className="flex items-center justify-center gap-2">
          {ouvert && (
            <button onClick={() => recourir()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border text-[11px] font-black
                         tracking-widest active:scale-95 transition"
              style={{ borderColor: 'rgba(248,205,74,0.7)', backgroundColor: 'rgba(248,205,74,0.18)', color: OR }}>
              <RotateCcw className="w-3.5 h-3.5" />
              {N.t('defi_rejouer')}
            </button>
          )}
          <button onClick={() => quitterLeDefi()}
            className="px-4 py-2 rounded-full border border-white/20 bg-white/5 text-white/80
                       text-[11px] font-bold tracking-widest active:scale-95 transition">
            {N.t('defi_retour')}
          </button>
        </div>
        </div>
      </div>
      </div>
    </motion.div>
  );
}
