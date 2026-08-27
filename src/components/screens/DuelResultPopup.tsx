import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';
import { Swords, ChevronRight } from 'lucide-react';
import { fetchMesDuels, marquerDuelsVus, DUELS_OUVERTS, type MonDuel } from '@/game/duels';
import { DuelRanking } from './DuelRanking';

/** On n'annonce rien a quelqu'un qui court. */
const CALME = new Set(['title', 'result', 'winall', 'over']);

const fmt = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/**
 * « Ton defi a ete releve. »
 *
 * Celui qui repond a un defi connait son sort a l'arrivee, ecran de fin a
 * l'appui. Celui qui l'a lance, lui, etait parti : son duel se joue sans lui,
 * parfois des jours plus tard. Cette annonce est le seul endroit ou il
 * l'apprend — sinon il ne verrait que sa ligne bouger au classement, sans
 * savoir qui ni pourquoi.
 *
 * Les resultats sont annonces un par un, du plus ancien au plus recent : trois
 * duels tranches d'un coup meritent trois nouvelles, pas une liste.
 */
export function DuelResultPopup() {
  const { state } = useGameStore();
  const { N, RACES } = SprinterApp;

  const [file, setFile] = useState<MonDuel[]>([]);
  const [voirDuels, setVoirDuels] = useState(false);
  const sonne = useRef<string>('');

  const annule = useRef(false);
  const dernier = useRef(0);

  // On interroge des que le jeu est au calme, puis de loin en loin.
  //
  // Le declenchement sur l'etat compte autant que l'intervalle : au demarrage
  // on est sur l'ecran d'ouverture, qui n'est pas un moment calme, et sans ce
  // reveil le joueur attendrait le prochain tour de boucle pour apprendre un
  // resultat qui l'attend depuis la veille.
  const relever = useRef(() => {});
  relever.current = () => {
    if (!DUELS_OUVERTS || !CALME.has(SprinterApp.G.state)) return;
    const t = Date.now();
    if (t - dernier.current < 8000) return;      // pas de rafale
    dernier.current = t;
    fetchMesDuels().then(list => {
      if (annule.current || !list.length) return;
      // Une reponse arrivee entre-temps s'ajoute a la file sans doubler
      // celles qu'on est en train de montrer.
      setFile(f => {
        const vus = new Set(f.map(d => d.id));
        return f.concat(list.filter(d => !vus.has(d.id)));
      });
    });
  };

  useEffect(() => {
    if (!DUELS_OUVERTS) return;
    annule.current = false;
    const id = setInterval(() => relever.current(), 45000);
    return () => { annule.current = true; clearInterval(id); };
  }, []);

  useEffect(() => { relever.current(); }, [state]);

  const duel = file[0];
  const montrable = DUELS_OUVERTS && CALME.has(state) && !!duel;

  // La phrase de resultat accompagne l'annonce, une fois par duel.
  useEffect(() => {
    if (!montrable || !duel || sonne.current === duel.id) return;
    sonne.current = duel.id;
    SprinterApp.Audio_.cue(
      duel.issue === 'challenger' ? 'fanfare' : duel.issue === 'draw' ? 'win' : 'dirge'
    );
  }, [montrable, duel]);

  if (!montrable || !duel) return null;

  const gagne = duel.issue === 'challenger';
  const nul = duel.issue === 'draw';

  const suivant = () => {
    marquerDuelsVus([duel.id]);
    setFile(f => f.slice(1));
  };

  const ton = gagne ? 'text-primary' : nul ? 'text-foreground' : 'text-destructive';
  const cadre = gagne ? 'border-primary/50' : nul ? 'border-white/20' : 'border-destructive/50';

  return (
    <>
      {/* Un seul calque, remplace sur place. Une sortie animee laisserait un
          voile plein ecran de plus a chaque resultat tant que l'animation
          n'aboutit pas — et elle n'aboutit pas quand le telephone met la page
          en veille. Il n'y a de toute facon rien a regarder sortir : la carte
          suivante prend la place immediatement. */}
        <motion.div
          key={duel.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center
                     pointer-events-auto overflow-y-auto
                     px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                     pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`w-full max-w-sm bg-card/95 border ${cadre} rounded-2xl shadow-2xl
                        p-4 md:p-6 flex flex-col items-center gap-3`}
          >
            <div className="flex items-center gap-2">
              <Swords className={`w-4 h-4 ${ton}`} />
              <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-muted-foreground">
                {N.t('duel_answered')}
              </span>
            </div>

            <h2 className={`font-black font-display tracking-tight uppercase text-2xl md:text-3xl text-center ${ton}`}>
              {N.t(gagne ? 'duel_won' : nul ? 'duel_tie' : 'duel_lost')}
            </h2>

            <span className="font-mono font-black text-3xl md:text-4xl tabular-nums text-foreground leading-none">
              {duel.points > 0 ? '+' : ''}{duel.points}
              <span className="text-xs font-normal ml-1 text-muted-foreground">{N.t('duel_pts')}</span>
            </span>

            {/* Les deux chronos face a face : c'est la seule chose que le
                lanceur n'a pas vue de ses yeux. */}
            <div className="w-full rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs md:text-sm font-bold tracking-wide text-primary truncate">
                  {N.t('duel_you')}
                </span>
                <span className={`font-mono font-bold text-sm md:text-base ${gagne ? 'text-emerald-400' : 'text-foreground'}`}>
                  {fmt(duel.mon_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs md:text-sm font-bold tracking-wide text-cyan-300 truncate min-w-0">
                  {duel.adversaire}
                </span>
                <span className={`font-mono font-bold text-sm md:text-base ${gagne ? 'text-foreground' : 'text-destructive'}`}>
                  {fmt(duel.son_ms)}
                </span>
              </div>
            </div>

            <span className="text-[10px] md:text-xs text-muted-foreground text-center">
              {duel.races.map(r => (RACES as any)[r]?.label || `${r} m`).join(' + ')}
              {file.length > 1 &&
                ` · ${N.t(file.length > 2 ? 'duel_mores' : 'duel_more', { n: file.length - 1 })}`}
            </span>

            <div className="w-full flex flex-col gap-2 mt-1">
              <button
                onClick={() => { setVoirDuels(true); }}
                className="w-full py-2.5 rounded-xl font-bold tracking-widest text-[11px] md:text-xs
                           text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20
                           transition-colors flex items-center justify-center gap-2"
              >
                <Swords className="w-3.5 h-3.5" />
                {N.t('duel_see')}
              </button>
              <button
                onClick={suivant}
                className="w-full py-3 rounded-xl font-black font-display tracking-widest
                           text-background bg-primary hover:bg-primary/90 transition-colors
                           flex items-center justify-center gap-2"
              >
                {N.t(file.length > 1 ? 'duel_next' : 'duel_ok')}
                {file.length > 1 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        </motion.div>

      {voirDuels && <DuelRanking onClose={() => setVoirDuels(false)} />}
    </>
  );
}
