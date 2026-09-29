import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MONTEE, VOILE, PANNEAU } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import {
  VEDETTES, defiPossible, defiEnCours, lancerLeDefi, rangerLeDefi, conclureLeDefi,
  meilleurDuDefi, epreuveDuDefi, chronoDeLaVedette, type Vedette, type Verdict,
} from '@/game/vedettes';
import { useVestiaire, porterSkin } from '@/game/vestiaire';
import { mot, chrono, ligne } from '@/game/vedettes-mots';
import { useRetour } from '@/hooks/use-retour';
import { tutoHaiesVu, marquerTutoHaiesVu } from './TutorialHaies';
import { ouvrirLeTuto } from '@/game/haies-tuto.js';
import { chargerLaMusiqueDuDefi as musiqueAurel } from '@/game/musique-defi-aurel';
import { chargerLaMusiqueDuDefi as musiqueMeba } from '@/game/musique-defi-meba';

/* ---------------------------------------------------------------------------
   LE DEFI DES VEDETTES — la banniere, la fiche, le verdict
   ---------------------------------------------------------------------------
   Trois ecrans, et un seul fichier : ils ne vivent que sur le canal ou le defi
   est ouvert (canal.ts, DEFI_VEDETTE_OUVERT), et App.tsx comme TitleScreen.tsx
   les chargent a la demande. Fermes, ils ne partent pas dans le paquet public.

   LA COULEUR EST CELLE DE SA TENUE (`couleurs`, game/vedettes.ts). Le violet
   d'Aurel Manga, avec le blanc de son bandeau ; le bleu et le blanc de l'equipe
   de France pour Meba-Mickael Zeze : la banniere doit se lire comme la sienne
   avant meme qu'on lise son nom — et se distinguer de l'or de Sprinter.

   UNE BANNIERE PAR DEFI, et chacune dans les jeux qui sont les siens (`jeux`) :
   Aurel sur les deux accueils — il annonce Hurdlers —, Meba-Mickael sur celui
   de Sprinter.
--------------------------------------------------------------------------- */

/** Chaque defi charge son morceau quand sa fiche s'ouvre. */
const MUSIQUES: Record<string, () => Promise<boolean>> = {
  manga: musiqueAurel,
  meba: musiqueMeba,
};
const chargerLaMusique = (v: Vedette) => { const f = MUSIQUES[v.cle]; if (f) void f(); };

/** Le defi se court-il avec des haies ? (le tutoriel de la haie ne sert qu'a lui) */
const avecHaies = (v: Vedette) => v.epreuves.some(e => /h$/.test(e));

/** Une epreuve comme la fiche l'ecrit : « 100 M », « 110 M HAIES ». */
const nomEpreuve = (e: string) => `${e.replace(/h$/, '')} M`;

/** Le chemin d'une image de public/, sous la base du deploiement (/ ou /test/). */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * SON PORTRAIT 3D — l'image rendue dans Blender, pas le coureur du jeu.
 *
 * Le coureur de la piste est fait de troncs de cone : il se reconnait a sa
 * silhouette, pas a son visage. De pres, on montre donc l'athlete modele et
 * eclaire dans Blender (tools/blender/portrait_vedette.py). `cadre` dit quoi
 * garder de l'image : le visage seul, le buste, ou le corps entier.
 */
function Portrait({ v, cadre, largeur, hauteur }: {
  v: Vedette; cadre: 'visage' | 'buste' | 'pied'; largeur: number; hauteur: number;
}) {
  const src = `${BASE}/${cadre === 'pied' ? v.portraits.pied : v.portraits.buste}`;
  // Le visage : le haut du buste, agrandi. Le buste : l'image entiere.
  const style: React.CSSProperties = cadre === 'visage'
    ? { width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 4%', transform: 'scale(1.9)', transformOrigin: '50% 12%' }
    : { width: '100%', height: '100%', objectFit: cadre === 'pied' ? 'contain' : 'cover', objectPosition: '50% 0%' };
  return (
    <span className="block overflow-hidden" style={{ width: largeur, height: hauteur }}>
      <img src={src} alt={`${v.prenom} ${v.nom}`} draggable={false} style={style}
           onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
    </span>
  );
}

/* ---------------------------------------------------------------------------
   LA BANNIERE DE L'ACCUEIL
--------------------------------------------------------------------------- */

export function BanderoleVedette({ haies }: { haies: boolean }) {
  const jeu = haies ? 'haies' : 'sprint';
  const defis = Object.values(VEDETTES).filter(v => v.jeux.includes(jeu) && defiPossible(v));
  if (!defis.length) return null;
  return <>{defis.map(v => <Banderole key={v.cle} v={v} haies={haies} />)}</>;
}

function Banderole({ v, haies }: { v: Vedette; haies: boolean }) {
  const vest = useVestiaire();
  const [fiche, setFiche] = useState(false);
  const gagne = vest.gagnes.includes(v.skin);
  const porte = vest.porte === v.skin;
  // Le meilleur des epreuves du defi : pour Meba-Mickael, celui du 100 m ou
  // du 200 m, ecrit avec son epreuve.
  const meilleurs = v.epreuves.map(e => [e, meilleurDuDefi(v, e)] as const).filter(([, t]) => t !== null);
  const meilleur = meilleurs.length
    ? meilleurs.map(([e, t]) => (v.epreuves.length > 1 ? `${nomEpreuve(e)} ` : '') + chrono(t)).join(' · ')
    : null;
  const nom = `${v.prenom} ${v.nom}`;
  const { vive: VIVE, fonce: FONCE, halo } = v.couleurs;

  return (
    <motion.div {...MONTEE}>
      <div className="w-full rounded-2xl border-2 overflow-hidden flex items-stretch"
           style={{ borderColor: `${VIVE}B0`, background: `linear-gradient(100deg, ${FONCE}F0, #0E0A1ACC)` }}>
        <button onClick={() => setFiche(true)}
                className="flex-1 min-w-0 flex items-center gap-2 pl-1 pr-3 py-2 text-left hover:bg-white/5 transition-colors">
          <span className="shrink-0 rounded-xl overflow-hidden border border-white/15"
                style={{ background: `radial-gradient(circle at 50% 35%, ${halo}, #0A0C18)` }}>
            <Portrait v={v} cadre="visage" largeur={58} hauteur={64} />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-white/90">
              {haies ? mot('vd_sur_haies', undefined, v.cle) : mot('vd_sur', undefined, v.cle)}
            </span>
            <span className="font-bold text-sm md:text-base leading-tight text-foreground">
              {mot('vd_titre', { nom }, v.cle)}
            </span>
            <span className="text-[10px] md:text-xs text-foreground/65 leading-snug">
              {gagne && meilleur ? mot('vd_meilleur', { s: meilleur }) : mot('vd_sous', undefined, v.cle)}
            </span>
          </span>
          {!gagne && (
            <span className="shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest bg-white">
              {mot('vd_courir')}
            </span>
          )}
        </button>
        {/* LE SKIN GAGNE SE PORTE D'ICI : c'est la ou le joueur revient, et le
            seul endroit ou il voit le skin a cote de son proprietaire. */}
        {gagne && (
          <button onClick={() => porterSkin(porte ? null : v.skin)}
                  className="shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 border-l border-white/10 hover:bg-white/5 transition-colors">
            <span className="text-[8px] font-bold tracking-[0.18em] text-white/60">{mot('vd_gagne')}</span>
            <span className="px-2 py-1 rounded-lg text-[10px] font-black tracking-widest"
                  style={porte ? { background: VIVE, color: '#fff' } : { background: '#fff', color: '#000' }}>
              {porte ? mot('vd_porte') : mot('vd_porter')}
            </span>
          </button>
        )}
      </div>
      <AnimatePresence>
        {fiche && <FicheVedette v={v} onFermer={() => setFiche(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   LA FICHE, AVANT LA COURSE
   ---------------------------------------------------------------------------
   Qui il est, ce qu'il a gagne, la regle, ce qu'on gagne. C'est l'annonce de
   Hurdlers autant qu'un ecran de jeu : la premiere fois qu'on y arrive, on
   doit comprendre en cinq secondes contre qui on court et pourquoi.
--------------------------------------------------------------------------- */

function FicheVedette({ v, onFermer }: { v: Vedette; onFermer: () => void }) {
  useRetour(onFermer, true);
  // LA MUSIQUE DU DEFI SE CHARGE ICI, quelques secondes avant la course. Si
  // le contexte audio n'etait pas encore ouvert, le geste de « courir » le
  // trouve ouvert et relance le chargement ; arrivee en retard, elle prend le
  // relais en pleine course (musique-defi-aurel.ts, relayer).
  React.useEffect(() => { chargerLaMusique(v); }, [v]);
  const apprendre = avecHaies(v) && !tutoHaiesVu();
  const courir = (e: string) => { chargerLaMusique(v); onFermer(); lancerLeDefi(v, e); };
  const tuto = () => { onFermer(); marquerTutoHaiesVu(); ouvrirLeTuto(); };
  const { vive: VIVE, fonce: FONCE, pale, halo } = v.couleurs;

  return (
    <motion.div {...VOILE} onClick={onFermer}
                className="fixed inset-0 z-[59] flex items-center justify-center bg-black/85 pointer-events-auto
                           px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} onClick={e => e.stopPropagation()}
                  className="w-full max-w-md rounded-2xl border-2 p-5 flex flex-col gap-3 max-h-[88dvh] overflow-y-auto"
                  style={{ borderColor: `${VIVE}90`, background: `linear-gradient(170deg, ${FONCE}, #09060F 70%)` }}>
        <div className="flex items-end gap-3">
          <div className="shrink-0 rounded-xl overflow-hidden border border-white/10"
               style={{ background: `radial-gradient(circle at 50% 35%, ${halo}, #0A0C18)` }}>
            <Portrait v={v} cadre="buste" largeur={132} hauteur={160} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1 pb-2">
            <span className="text-[10px] font-bold tracking-[0.24em] text-white/70">{mot('vd_fiche_sur')}</span>
            <h2 className="font-black font-display text-3xl leading-[0.9] tracking-tight text-white">
              {v.prenom}<br />{v.nom}
            </h2>
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: pale }}>
              {mot('vd_pays', undefined, v.cle)} · {mot('vd_epreuve', undefined, v.cle)}
            </span>
            <span className="text-[10px] text-white/55">{mot('vd_lieu', undefined, v.cle)}</span>
          </div>
        </div>

        <ul className="flex flex-col gap-1">
          {v.palmares.map((p, i) => (
            <li key={i} className="text-[12px] text-white/85 flex gap-2">
              <span style={{ color: VIVE }}>▸</span>{ligne(p)}
            </li>
          ))}
        </ul>

        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-1">
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/60">{mot('vd_regle_titre')}</span>
          <p className="text-[12px] leading-snug text-white/85">{mot('vd_regle', undefined, v.cle)}</p>
        </div>

        <div className="rounded-xl p-3 flex flex-col gap-0.5" style={{ background: `${VIVE}22`, border: `1px solid ${VIVE}55` }}>
          <span className="text-[10px] font-bold tracking-[0.2em]" style={{ color: pale }}>{mot('vd_recompense')}</span>
          <span className="text-[12px] text-white/85">{mot('vd_recompense_sous', undefined, v.cle)}</span>
        </div>

        {/* UNE EPREUVE, UN BOUTON. Avec plusieurs, chaque bouton dit son chrono
            a battre et le meilleur du joueur : c'est le choix qu'on fait ici. */}
        {v.epreuves.length === 1 ? (
          <button onClick={() => courir(v.epreuves[0])}
                  className="w-full py-3 rounded-xl font-black font-display text-xl tracking-widest text-black bg-white hover:bg-white/90 transition-colors">
            {mot('vd_partir')}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {v.epreuves.map(e => {
              const cible = chronoDeLaVedette(v, e);
              const moi = meilleurDuDefi(v, e);
              return (
                <button key={e} onClick={() => courir(e)}
                        className="py-2.5 rounded-xl bg-white hover:bg-white/90 transition-colors text-black flex flex-col items-center gap-0.5">
                  <span className="font-black font-display text-lg tracking-widest leading-none">
                    {mot('vd_courir_sur', { e: nomEpreuve(e) })}
                  </span>
                  <span className="text-[10px] font-bold tracking-wide tabular-nums opacity-70">
                    {mot('vd_a_battre', { s: chrono(cible) })}
                  </span>
                  {moi !== null && (
                    <span className="text-[10px] tracking-wide tabular-nums opacity-60">
                      {mot('vd_meilleur', { s: chrono(moi) })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {/* La premiere course de haies se joue avec un geste qu'on n'a jamais
            fait. On le propose sans l'imposer : le defi reste a un toucher. */}
        {apprendre && (
          <button onClick={tuto} className="text-[11px] tracking-wide text-white/70 hover:text-white underline underline-offset-4">
            {mot('vd_apprendre')}
          </button>
        )}
        <button onClick={onFermer} className="text-[11px] tracking-widest text-white/45 hover:text-white/80">
          {mot('vd_fermer')}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   LE VERDICT
   ---------------------------------------------------------------------------
   Il remplace le recapitulatif du one shot : apres un duel contre un seul
   homme, la seule question est de savoir si on l'a battu — et, si oui, ce
   qu'on vient de gagner.
--------------------------------------------------------------------------- */

export function defiVedetteEnCours(): boolean { return defiEnCours() !== null; }

export function FinDuDefiVedette() {
  const state = useGameStore(s => s.state);
  const vest = useVestiaire();
  // LE VERDICT SE RANGE UNE SEULE FOIS, au montage : React ne monte cet ecran
  // qu'une fois par course, et c'est la que le skin se gagne.
  const [res] = useState<{ v: Vedette; epreuve: string; verdict: Verdict } | null>(() => {
    const v = defiEnCours();
    const epreuve = epreuveDuDefi() || (v ? v.epreuves[0] : '');
    return v ? { v, epreuve, verdict: conclureLeDefi(v) } : null;
  });
  if (state !== 'winall' || !res) return null;
  const { v, epreuve, verdict } = res;
  const { vive: VIVE, fonce: FONCE, pale } = v.couleurs;
  const nom = `${v.prenom} ${v.nom}`.toUpperCase();
  const gagne = vest.gagnes.includes(v.skin);
  const porte = vest.porte === v.skin;
  const titre = verdict.moi === null ? mot('vd_faux')
              : verdict.battu ? mot('vd_battu', { nom }) : mot('vd_perdu', { nom });
  const accueil = () => { rangerLeDefi(); (SprinterApp as any).goHome(); };
  const rejouer = () => lancerLeDefi(v, epreuve);

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center
                    bg-[rgba(8,5,16,0.88)] px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} className="w-full max-w-md flex flex-col items-center gap-3 text-center">
        <span className={`font-black font-display text-3xl sm:text-4xl uppercase tracking-tight leading-[0.95]
                          ${verdict.battu ? 'text-white' : 'text-destructive'}`}>
          {titre}
        </span>

        <div className="w-full grid grid-cols-2 gap-2 font-mono tabular-nums">
          <div className="rounded-xl bg-white/5 border border-white/10 py-2">
            <div className="text-[10px] tracking-widest text-white/55">{mot('vd_toi')}</div>
            <div className="text-xl font-bold text-white">{chrono(verdict.moi)}</div>
          </div>
          <div className="rounded-xl border py-2" style={{ background: `${VIVE}22`, borderColor: `${VIVE}55` }}>
            <div className="text-[10px] tracking-widest" style={{ color: pale }}>{nom}</div>
            <div className="text-xl font-bold text-white">{chrono(verdict.lui)}</div>
          </div>
        </div>
        {verdict.ecart !== null && (
          <span className="text-sm text-white/75">
            {verdict.battu ? mot('vd_avance', { s: chrono(verdict.ecart) })
                           : mot('vd_retard', { s: chrono(-verdict.ecart) })}
          </span>
        )}

        {/* LE SKIN, quand il vient d'etre gagne : le coureur leve les bras, et
            le bouton pour le porter est la, sous le pouce. */}
        {verdict.nouveauSkin && (
          <div className="w-full rounded-2xl border-2 p-3 flex items-center gap-3 text-left"
               style={{ borderColor: `${VIVE}B0`, background: `linear-gradient(100deg, ${FONCE}, #0E0A1A)` }}>
            <Portrait v={v} cadre="pied" largeur={90} hauteur={120} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-[0.22em]" style={{ color: pale }}>{mot('vd_debloque')}</span>
              <span className="font-black font-display text-xl leading-none text-white">{v.prenom} {v.nom}</span>
              <span className="text-[11px] text-white/65">{mot('vd_debloque_sous', undefined, v.cle)}</span>
              {gagne && (
                <button onClick={() => porterSkin(porte ? null : v.skin)}
                        className="self-start mt-1 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-widest"
                        style={porte ? { background: VIVE, color: '#fff' } : { background: '#fff', color: '#000' }}>
                  {porte ? mot('vd_porte') : mot('vd_porter')}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="w-full flex gap-2 mt-1">
          <button onClick={rejouer}
                  className="flex-1 py-3 rounded-xl font-black tracking-widest text-sm text-black bg-white hover:bg-white/90 transition-colors">
            {verdict.battu ? mot('vd_rejouer') : mot('vd_revanche')}
          </button>
          <button onClick={accueil}
                  className="flex-1 py-3 rounded-xl font-bold tracking-widest text-sm text-white border border-white/25 hover:bg-white/10 transition-colors">
            {mot('vd_accueil')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
