import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CalendarClock, Globe2, Flag, Timer, PlayCircle, CheckSquare } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { estOrganisateur } from '@/game/canal';
import { Drapeau } from '@/components/Insignes';
import {
  previsionSalon, ouvrirCycle, ouvrirZone, cloturerPhase, saisirCourse,
  etatEdition,
  type Salon, type Prevision, type Edition,
} from '@/game/championnats';

/**
 * Le salon des championnats.
 *
 * Un ecran d'exploitation, pas un ecran de jeu : il repond a « qui peut courir
 * ce weekend, et qu'est-ce que ca donnerait », puis permet de le declencher.
 * Il est reserve aux organisateurs — le serveur refuse ces routes a tout le
 * monde d'autre, et cette porte-ci n'est que l'affichage de cette regle-la.
 *
 * Tout ce qu'on y lit vient d'une seule route, `/champ/salon`, qui simule
 * l'ouverture de chaque zone sans rien ecrire. C'est la difference qui compte :
 * on peut regarder avant de decider, et une edition ouverte ne se referme pas.
 */

const OR = '#F8CD4A';
const CADENCE_MS = 10000;

/**
 * Le prochain samedi a minuit UTC.
 *
 * Tout le calendrier des championnats part de cet instant : c'est ce qui fait
 * que trente pays courent « le meme weekend » a la meme seconde. Le calcul est
 * pur et ne persiste rien — le compte a rebours d'un salon n'est pas une
 * donnee, c'est une soustraction.
 */
export function prochainSamedi(maintenant = Date.now()): number {
  const d = new Date(maintenant);
  // 0 = dimanche … 6 = samedi. Jamais aujourd'hui : un cycle s'ouvre pour le
  // weekend qui vient, pas pour celui qui a commence ce matin.
  const dans = ((6 - d.getUTCDay() + 7) % 7) || 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dans);
}

function delai(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (j > 0) return `${j} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

/* --------------------------------------------------------------- une zone */

function Ligne({ p, onOuvrir, onCloturer, onSaisir, occupe }: {
  p: Prevision;
  onOuvrir: (p: Prevision) => void;
  onCloturer: (edition: string) => void;
  onSaisir: (edition: string) => void;
  occupe: boolean;
}) {
  const { N } = SprinterApp;
  return (
    <div className={`flex flex-col gap-1.5 px-3 py-2 rounded-xl border
      ${p.edition ? 'border-primary/35 bg-primary/[0.07]'
        : p.ouvrable ? 'border-white/12 bg-black/25'
        : 'border-white/6 bg-black/15 opacity-60'}`}>
      <div className="flex items-center gap-2">
        {p.echelon === 'national'
          ? <Drapeau pays={p.zone} className="text-[12px]" />
          : <Globe2 className="w-3 h-3 text-muted-foreground" />}
        <span className="text-[11px] font-bold tracking-wide text-foreground flex-1 truncate">
          {p.zoneNom}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
          {N.t('salon_partants', { n: p.partants != null ? p.partants : p.joueurs })}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {p.reduit && (
          <span className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded
                           border border-amber-400/40 text-amber-300">
            {N.t('salon_reduit')}
          </span>
        )}
        {p.courses ? (
          <span className="text-[9px] text-muted-foreground">
            {N.t('salon_courses', { n: p.courses })}
          </span>
        ) : null}
        {!p.ouvrable && p.raison && !p.edition && (
          <span className="text-[9px] text-muted-foreground/70">{p.raison}</span>
        )}

        <span className="flex-1" />

        {p.edition ? (
          <>
            <button onClick={() => onSaisir(p.edition!)} disabled={occupe}
              className="text-[9px] font-bold tracking-widest px-2 py-1 rounded-lg
                         border border-white/12 text-muted-foreground hover:text-foreground
                         disabled:opacity-40">
              {N.t('salon_saisir')}
            </button>
            <button onClick={() => onCloturer(p.edition!)} disabled={occupe}
              className="text-[9px] font-bold tracking-widest px-2 py-1 rounded-lg
                         border border-primary/40 text-primary hover:bg-primary/10
                         disabled:opacity-40">
              {N.t('salon_cloturer')}
            </button>
          </>
        ) : (
          <button onClick={() => onOuvrir(p)} disabled={occupe || !p.ouvrable}
            className="text-[9px] font-bold tracking-widest px-2 py-1 rounded-lg
                       border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10
                       disabled:opacity-30 disabled:pointer-events-none">
            {N.t('salon_ouvrir_zone')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------- la saisie manuelle d'une course

   Le filet de securite, et il a une raison precise d'exister : un partant qui
   ne se presente pas laisse sa course sans chrono, et une phase dont une course
   manque ne peut pas se clore. Sans cette saisie, l'edition entiere resterait
   bloquee sur l'absence d'une seule personne. */

function Saisie({ edition, onFini }: { edition: string; onFini: () => void }) {
  const { N } = SprinterApp;
  const [e, setE] = useState<Edition | null>(null);
  const [course, setCourse] = useState(1);
  const [temps, setTemps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true;
    etatEdition(edition).then(x => { if (vivant && x) setE(x); });
    return () => { vivant = false; };
  }, [edition]);

  if (!e) {
    return <div className="flex justify-center py-3">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>;
  }

  const partants = e.partants.filter(p => p.phase === e.phase && p.course === course);
  const courses = Array.from({ length: Math.max(1, e.courses) }, (_, i) => i + 1);

  const envoyer = async () => {
    setOccupe(true); setErreur('');
    // Un champ vide vaut abandon : sans chrono il n'y a rien a comparer, et
    // c'est exactement ce que le moteur attend d'un partant qui n'a pas couru.
    const chronos = partants.map(p => {
      const brut = (temps[p.name_key] || '').replace(',', '.').trim();
      const s = Number(brut);
      return {
        cle: p.name_key,
        ms: brut && Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : null,
      };
    });
    const r = await saisirCourse(e.id, e.phase, course, chronos);
    setOccupe(false);
    if (r.error) { setErreur(r.error); return; }
    onFini();
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-white/12 bg-black/30">
      <div className="flex items-center gap-2">
        <Timer className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground flex-1">
          {e.phaseNom} · {e.zoneNom}
        </span>
        <button onClick={onFini} className="text-[9px] tracking-widest text-muted-foreground hover:text-foreground">
          {N.t('salon_fermer')}
        </button>
      </div>

      {courses.length > 1 && (
        <div className="flex gap-1">
          {courses.map(c => (
            <button key={c} onClick={() => setCourse(c)}
              className={`flex-1 py-1 rounded-lg font-mono text-[10px] border
                ${course === c ? 'border-primary/50 text-primary bg-primary/10'
                               : 'border-white/10 text-muted-foreground'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {partants.map(p => (
          <div key={p.name_key} className="flex items-center gap-2">
            <span className="text-[10px] flex-1 truncate text-foreground">{p.nom}</span>
            <input
              value={temps[p.name_key] || ''}
              onChange={ev => setTemps(t => ({ ...t, [p.name_key]: ev.target.value }))}
              placeholder={N.t('salon_chrono_vide')}
              inputMode="decimal"
              className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1
                         font-mono text-[11px] text-center text-foreground
                         placeholder:text-muted-foreground/50 placeholder:font-sans
                         focus:outline-none focus:border-primary/50"
            />
          </div>
        ))}
        {!partants.length && (
          <p className="text-[10px] text-muted-foreground text-center py-2">
            {N.t('salon_course_vide')}
          </p>
        )}
      </div>

      {erreur && <p className="text-[10px] text-destructive text-center">{erreur}</p>}

      <button onClick={envoyer} disabled={occupe || !partants.length}
        className="w-full py-2 rounded-xl font-bold tracking-widest text-[10px]
                   text-background bg-primary disabled:opacity-40 flex items-center justify-center gap-2">
        {occupe && <Loader2 className="w-3 h-3 animate-spin" />}
        {N.t('salon_enregistrer')}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ l'ecran */

export function SalonChampionnats() {
  const { N } = SprinterApp;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [maintenant, setMaintenant] = useState(Date.now());
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState('');
  const [saisie, setSaisie] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const samedi = useMemo(() => prochainSamedi(maintenant), [Math.floor(maintenant / 60000)]);

  const recharger = async () => {
    const s = await previsionSalon();
    if (s) setSalon(s);
  };

  useEffect(() => {
    if (!estOrganisateur()) return;
    let vivant = true;
    const battre = () => { if (vivant) recharger(); };
    battre();
    const t = setInterval(battre, CADENCE_MS);
    const h = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => { vivant = false; clearInterval(t); clearInterval(h); };
  }, []);

  // Le role est verifie par le serveur a chaque requete ; ceci ne fait que
  // ranger l'ecran pour ceux a qui il ne servirait a rien.
  if (!estOrganisateur()) return null;

  const agir = async (quoi: () => Promise<{ error?: string }>, succes: string) => {
    setOccupe(true); setMessage('');
    const r = await quoi();
    setOccupe(false);
    setMessage(r.error ? r.error : succes);
    await recharger();
  };

  const cycle = () => agir(
    async () => await ouvrirCycle(samedi, 'national'),
    N.t('salon_cycle_ouvert'));

  const zone = (p: Prevision) => agir(
    async () => await ouvrirZone(p.echelon, p.zone, samedi),
    N.t('salon_zone_ouverte', { z: p.zoneNom }));

  const clore = (edition: string) => agir(
    async () => await cloturerPhase(edition),
    N.t('salon_phase_close'));

  const tout: Prevision[] = salon
    ? [...salon.nations, ...salon.continents, salon.monde] : [];
  const enCours = tout.filter(p => p.edition);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card/70 backdrop-blur-xl border rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-3"
      style={{ borderColor: 'rgba(248,205,74,0.28)' }}
    >
      <button onClick={() => setOuvert(o => !o)} className="flex items-center gap-2 justify-center">
        <CalendarClock className="w-3.5 h-3.5" style={{ color: OR }} />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest" style={{ color: OR }}>
          {N.t('salon_titre')}
        </h3>
      </button>

      {/* Le compte a rebours. Il n'est pas decoratif : c'est la seule chose qui
          dit quand le cycle qu'on s'apprete a ouvrir sera couru. */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl
                      bg-black/30 border border-white/8">
        <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
          <Timer className="w-3.5 h-3.5" />
          {N.t('salon_prochain_samedi')}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums" style={{ color: OR }}>
          {delai(samedi - maintenant)}
        </span>
      </div>

      {!ouvert ? (
        <button onClick={() => setOuvert(true)}
          className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground">
          {N.t('salon_deplier', { n: salon ? salon.ouvrables : 0 })}
        </button>
      ) : !salon ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <button onClick={cycle} disabled={occupe || !salon.ouvrables}
            className="w-full py-2.5 rounded-xl font-black font-display tracking-widest text-sm
                       text-background disabled:opacity-40 disabled:pointer-events-none
                       flex items-center justify-center gap-2"
            style={{ backgroundColor: OR }}>
            {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {N.t('salon_ouvrir_cycle', { n: salon.ouvrables })}
          </button>

          {message && (
            <p className="text-center text-[10px] text-muted-foreground">{message}</p>
          )}

          {saisie && <Saisie edition={saisie} onFini={() => { setSaisie(null); recharger(); }} />}

          {enCours.length > 0 && (
            <Section titre={N.t('salon_en_cours')} icone={<CheckSquare className="w-3 h-3" />}>
              {enCours.map(p => (
                <Ligne key={p.echelon + p.zone} p={p} occupe={occupe}
                       onOuvrir={zone} onCloturer={clore} onSaisir={setSaisie} />
              ))}
            </Section>
          )}

          <Section titre={N.t('salon_nations')} icone={<Flag className="w-3 h-3" />}>
            {salon.nations.filter(p => !p.edition).map(p => (
              <Ligne key={p.zone} p={p} occupe={occupe}
                     onOuvrir={zone} onCloturer={clore} onSaisir={setSaisie} />
            ))}
            {!salon.nations.length && (
              <p className="text-[10px] text-muted-foreground text-center py-1">
                {N.t('salon_aucune_nation')}
              </p>
            )}
          </Section>

          <Section titre={N.t('salon_continents')} icone={<Globe2 className="w-3 h-3" />}>
            {salon.continents.filter(p => !p.edition).map(p => (
              <Ligne key={p.zone} p={p} occupe={occupe}
                     onOuvrir={zone} onCloturer={clore} onSaisir={setSaisie} />
            ))}
          </Section>

          <Section titre={N.t('salon_monde')} icone={<Globe2 className="w-3 h-3" />}>
            {!salon.monde.edition && (
              <Ligne p={salon.monde} occupe={occupe}
                     onOuvrir={zone} onCloturer={clore} onSaisir={setSaisie} />
            )}
          </Section>

          <button onClick={() => setOuvert(false)}
            className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground">
            {N.t('salon_replier')}
          </button>
        </>
      )}
    </motion.div>
  );
}

function Section({ titre, icone, children }: {
  titre: string; icone: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-muted-foreground">{icone}</span>
        <span className="text-[9px] font-bold tracking-widest text-muted-foreground">
          {titre}
        </span>
      </div>
      {children}
    </div>
  );
}
