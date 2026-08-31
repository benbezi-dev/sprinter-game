import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'motion/react';
import { VOILE, PANNEAU } from '@/lib/mouvement';
import { Swords, ChevronRight } from 'lucide-react';
import { fetchMesDuels, marquerDuelsVus, DUELS_OUVERTS, type MonDuel } from '@/game/duels';
import { DuelRanking } from './DuelRanking';
import { pique } from '@/game/piques';
import { LaisserUnMot, LireLeMot } from './MotDuel';
import { useSondageAuRepos, estAuCalme } from '@/hooks/use-sondage';

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

  // Toutes les dix secondes, et au retour dans le jeu.
  //
  // C'est le resultat d'un defi qu'ON A LANCE : quand il arrive, le joueur est
  // le plus souvent devant son ecran a l'attendre. Quarante-cinq secondes de
  // minuterie faisaient mettre plus d'une minute a une nouvelle qu'il fallait
  // annoncer tout de suite — mesure a soixante-cinq secondes.
  const relever = useRef(() => {});
  relever.current = () => {
    if (!DUELS_OUVERTS || !estAuCalme()) return;
    const t = Date.now();
    if (t - dernier.current < 4000) return;      // pas de rafale
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
    annule.current = false;
    return () => { annule.current = true; };
  }, []);

  useSondageAuRepos(() => relever.current(), 10000);
  // Le changement d'etat reste un reveil a lui seul : on sort d'une course,
  // et le resultat peut attendre depuis qu'on y est entre.
  useEffect(() => { relever.current(); }, [state]);

  const duel = file[0];
  const montrable = DUELS_OUVERTS && estAuCalme() && !!duel;

  // La phrase de resultat accompagne l'annonce, une fois par duel.
  useEffect(() => {
    if (!montrable || !duel || sonne.current === duel.id) return;
    sonne.current = duel.id;
    SprinterApp.Audio_.cue(
      duel.issue === 'challenger' ? 'fanfare' : duel.issue === 'draw' ? 'win' : 'dirge'
    );
  }, [montrable, duel]);

  if (!montrable || !duel) return null;

  // Qui a gagne, vu de MA place. La fenetre servait au seul lanceur ; elle
  // sert desormais aussi a celui qui a releve, quand le vainqueur lui a laisse
  // un mot. Lire l'issue sans savoir de quel cote on etait annoncerait une
  // victoire a celui qui vient de perdre.
  const gagne = duel.issue === (duel.role || 'challenger');
  const nul = duel.issue === 'draw';
  const perdu = !gagne && !nul;
  const jeRecoisUnMot = perdu && !!(duel.mot || duel.voix);

  const suivant = () => {
    marquerDuelsVus([duel.id]);
    setFile(f => f.slice(1));
  };

  /**
   * Repartir sur la meme epreuve, le defi arme pour le meme adversaire.
   *
   * On ne rejoue pas la course perdue — un defi se court une fois, et le
   * rejouer laisserait tenter sa chance jusqu'a tomber sur un bon jour. C'est
   * un nouveau duel qui se lance, dans l'autre sens : cette fois c'est nous qui
   * posons le chrono, et l'ecran de fin sait deja a qui l'envoyer.
   */
  const revanche = () => {
    marquerDuelsVus([duel.id]);
    SprinterApp.G.revanche = duel.adversaire;
    SprinterApp.startOneShot(duel.races, { levelIdx: 4 });
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
          initial={VOILE.initial}
          animate={VOILE.animate}
          transition={VOILE.transition}
          className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center
                     pointer-events-auto overflow-y-auto
                     px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                     pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <motion.div
            {...PANNEAU}
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
              {duel.lp > 0 ? '+' : ''}{duel.lp}
              <span className="text-xs font-normal ml-1 text-muted-foreground">{N.t('duel_lp')}</span>
            </span>

            {/* Gagne ou nul : les deux chronos face a face, c'est la seule
                chose que le lanceur n'a pas vue de ses yeux.

                Perdu : le mot de l'adversaire a la place. Deux nombres et un
                ecart, c'est exact et c'est froid — on lit, on hausse les
                epaules, on passe. Ce qui donne envie de rejouer n'est pas le
                nombre, c'est la phrase qui pique. Le chrono reste lisible
                ailleurs pour qui le cherche. */}
            {perdu ? (
              // Le mot de l'adversaire s'il en a laisse un, la pique sinon.
              // Une phrase ecrite par le jeu vaut mieux que rien, mais elle
              // n'a jamais valu la vraie voix de celui qui vient de gagner.
              jeRecoisUnMot ? (
                <LireLeMot texte={duel.mot} voix={duel.voix}
                           voixType={duel.voix_type} auteur={duel.adversaire} />
              ) : (
                <div className="w-full rounded-xl border border-destructive/30 bg-destructive/[0.07]
                                px-4 py-3 flex flex-col items-center gap-1.5">
                  <p className="text-sm md:text-base text-foreground text-center leading-snug">
                    « {pique(duel.id, duel.adversaire)} »
                  </p>
                  <span className="text-[10px] md:text-xs font-bold tracking-widest text-cyan-300
                                   truncate max-w-full">
                    {duel.adversaire}
                  </span>
                </div>
              )
            ) : (
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
                  <span className="font-mono font-bold text-sm md:text-base text-foreground">
                    {fmt(duel.son_ms)}
                  </span>
                </div>
              </div>
            )}

            <span className="text-[10px] md:text-xs text-muted-foreground text-center">
              {duel.races.map(r => (RACES as any)[r]?.label || `${r} m`).join(' + ')}
              {file.length > 1 &&
                ` · ${N.t(file.length > 2 ? 'duel_mores' : 'duel_more', { n: file.length - 1 })}`}
            </span>

            {/* Le vainqueur qui apprend sa victoire ici n'etait pas la quand
                l'autre a couru : c'est son seul moment pour lui repondre. */}
            {gagne && <LaisserUnMot duel={duel.id} adversaire={duel.adversaire} />}

            <div className="w-full flex flex-col gap-2 mt-1">
              {/* La revanche est offerte a la defaite, et seulement la.
                  La proposer au vainqueur serait lui demander de remettre en
                  jeu ce qu'il vient de gagner ; c'est au perdant de rappeler
                  l'autre sur la piste. */}
              {perdu && (
                <button
                  onClick={revanche}
                  className="w-full py-3 rounded-xl font-black font-display tracking-widest
                             text-background bg-primary hover:bg-primary/90 transition-colors
                             flex flex-col items-center leading-tight"
                >
                  {N.t('duel_revanche')}
                  <span className="font-sans font-normal text-[9px] tracking-normal opacity-70">
                    {N.t('duel_revanche_sub', { n: duel.adversaire })}
                  </span>
                </button>
              )}
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
