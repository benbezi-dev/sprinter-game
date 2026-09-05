import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { RESSORT, useAnimationsReduites } from '@/lib/mouvement';
import { Swords, ChevronUp, ChevronDown, Loader2, Radio, Check } from 'lucide-react';
import { fetchDuels, defierDepuisClassement, type DuelBoard, type DuelRow } from '@/game/duels';
import { getSavedName } from '@/game/leaderboard';
import { Drapeau, Medaille, Ecusson, nomDuRang } from '@/components/Insignes';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Les trois epreuves, dans l'ordre d'un programme d'athletisme. */
const RACE_KEYS = ['100', '200', '400'];

/**
 * Fleche de deplacement depuis la derniere visite.
 *
 * La fleche et la couleur ne suffisent pas : un lecteur d'ecran ne voit ni
 * l'une ni l'autre, et « 2 » tout seul ne veut rien dire. Le texte lu est donc
 * ecrit a cote, invisible a l'oeil.
 */
function Mouvement({ move, reduit }: { move: number; reduit: boolean }) {
  const { N } = SprinterApp;
  if (!move) return <span className="w-8 shrink-0" />;
  const monte = move > 0;
  return (
    <motion.span
      initial={reduit ? false : { opacity: 0, y: monte ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-8 shrink-0 flex items-center justify-center gap-0.5 text-[10px] font-bold
        ${monte ? 'text-emerald-400' : 'text-destructive'}`}
    >
      {monte ? <ChevronUp className="w-3 h-3" aria-hidden />
             : <ChevronDown className="w-3 h-3" aria-hidden />}
      <span aria-hidden>{Math.abs(move)}</span>
      <span className="sr-only">
        {N.t(monte ? 'duel_monte_a11y' : 'duel_descend_a11y', { n: String(Math.abs(move)) })}
      </span>
    </motion.span>
  );
}

/**
 * Le classement des duels, et l'endroit d'ou l'on repart au combat.
 *
 * On y prend quelqu'un en duel comme au TOP 500 : une epreuve en haut, une
 * epee sur chaque ligne. C'est la meme mecanique parce que c'est le meme
 * geste, et la difference entre les deux ecrans n'a jamais ete la — le TOP 500
 * classe la vitesse, celui-ci l'engagement.
 *
 * `epreuves` sont celles qu'on vient de courir, quand on arrive d'une course.
 * Elles ne commandent plus le bouton, elles le PREREGLENT : sortir d'un 400 m
 * et defier quelqu'un dessus reste ce qu'on veut faire neuf fois sur dix, mais
 * ne pas en sortir n'est plus une raison de ne rien pouvoir faire. C'etait le
 * defaut de cet ecran : ouvert depuis l'accueil, il n'etait qu'une page qu'on
 * lit, sans un seul moyen d'entrer dans un duel.
 */
export function DuelRanking({ onClose, epreuves, surInviter }: {
  onClose: () => void;
  epreuves?: string[];
  /**
   * Quand elle est fournie, l'ecran ne sert plus a defier mais a CHOISIR des
   * adversaires pour une course en direct.
   *
   * Une prop plutot qu'un drapeau `mode` : ce qui change n'est pas un
   * affichage, c'est ce que fait le bouton de chaque ligne — et le passer
   * directement evite d'avoir a deviner, depuis ici, ce que le parent veut
   * faire du nom. Le classement ne connait pas les salles, et c'est bien.
   *
   * Rend `true` si le choix a ete pris en compte, `false` sinon : la ligne
   * s'allume ou pas selon la reponse, sans que cet ecran ait a savoir
   * pourquoi.
   */
  surInviter?: (nom: string) => Promise<boolean>;
}) {
  /** Ceux qu'on vient de convier, pour que la ligne le montre. */
  const [convies, setConvies] = useState<string[]>([]);
  const [invitEnCours, setInvitEnCours] = useState<string | null>(null);

  const inviter = async (nom: string) => {
    if (!surInviter || invitEnCours || convies.includes(nom)) return;
    setInvitEnCours(nom);
    const ok = await surInviter(nom);
    setInvitEnCours(null);
    if (ok) setConvies(c => [...c, nom]);
  };
  const [defiEnCours, setDefiEnCours] = useState<string | null>(null);

  /**
   * L'epreuve du duel a venir.
   *
   * On garde un tableau, et pas une seule cle : quand on arrive d'un one shot
   * a plusieurs epreuves, le defi rejoue la meme combinaison — c'est ce qui
   * existait, et le perdre ferait d'un 100 + 200 un simple 100. Toucher un
   * bouton ramene a une epreuve unique, ce qui est la lecture normale d'un
   * selecteur.
   */
  const [choix, setChoix] = useState<string[]>(() => {
    const e = (epreuves || []).filter(k => RACE_KEYS.includes(k));
    return e.length ? e : ['100'];
  });

  const defier = async (nom: string) => {
    if (!choix.length || defiEnCours) return;
    setDefiEnCours(nom);
    try {
      const { cible } = await defierDepuisClassement(nom, choix);
      // Sans cible retrouvee, la course part quand meme et finira sur un code
      // a envoyer soi-meme. On le retient pour que l'ecran d'arrivee le dise.
      SprinterApp.G.defiSansCible = !cible ? nom : null;
      onClose();
    } catch {
      setDefiEnCours(null);
    }
  };

  const { N } = SprinterApp;
  const [board, setBoard] = useState<DuelBoard | null>(null);
  const [chargement, setChargement] = useState(true);
  const moiKey = (getSavedName() || '').trim().toLowerCase();

  useEffect(() => {
    let annule = false;
    fetchDuels().then(b => { if (!annule) { setBoard(b); setChargement(false); } });
    // Le classement bouge pendant qu'on le regarde : on rafraichit sans
    // remettre le repere de visite, sinon les fleches s'effaceraient seules.
    const id = setInterval(() => {
      fetchDuels(false).then(b => { if (!annule && b) setBoard(b); });
    }, 20000);
    return () => { annule = true; clearInterval(id); };
  }, []);

  const rows = board?.classement || [];
  const bareme = board?.bareme;
  const reduit = useAnimationsReduites();

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center
                    pointer-events-auto overflow-y-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="w-full max-w-lg mx-auto flex flex-col items-center py-6 md:py-8 gap-4">

        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <div className="flex flex-col">
              <h2 className="font-black font-display tracking-tight text-primary text-xl md:text-2xl leading-tight">
                {N.t('duel_title')}
              </h2>
              <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
                {N.t('duel_sub')}
              </span>
            </div>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {/* La regle, en une phrase.
            Les chiffres du bareme ne sont plus affiches, et pas par pudeur :
            ils ne veulent plus rien dire pris seuls. Ce qu'un duel rapporte
            depend d'ou l'on se situe par rapport a sa division — annoncer
            « +25 » a quelqu'un qui en recevra quarante serait faux. Ce qui
            reste vrai, et suffit a jouer, c'est le sens de l'asymetrie. */}
        {bareme && (
          <p className="w-full text-[9px] md:text-[10px] text-muted-foreground/80
                        text-center leading-snug px-2">
            {N.t('duel_regle')}
          </p>
        )}

        {/* Sur quoi se court le duel.
            Meme selecteur qu'au TOP 500, au meme endroit de l'ecran : c'est le
            meme choix, et deux presentations differentes du meme choix se
            paient a chaque fois qu'on passe de l'un a l'autre.
            Il est PREREGLE sur ce qu'on vient de courir quand on arrive d'une
            course, et sur le 100 m sinon — jamais vide : un ecran ou il faut
            choisir avant de pouvoir agir demande deux gestes la ou il en
            fallait un. */}
        <div className="w-full flex flex-col gap-1.5">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest
                           text-muted-foreground text-center">
            {N.t('duel_sur')}
          </span>
          <div className="flex gap-2">
            {RACE_KEYS.map(k => (
              <button
                key={k}
                onClick={() => setChoix([k])}
                aria-pressed={choix.includes(k)}
                className={`flex-1 py-2 rounded-xl font-bold tracking-wider transition-all
                            border-b-2 text-sm md:text-base
                  ${choix.includes(k)
                    ? 'bg-primary/20 text-primary border-primary'
                    : 'bg-card/80 text-muted-foreground border-transparent hover:bg-white/10'}`}
              >
                {k} M
              </button>
            ))}
          </div>
        </div>

        {/* Ma position, mise en avant.
            Le rang general reste, mais ce n'est plus lui qu'on vient chercher :
            a mille joueurs, « 347e » ne raconte rien. La division, si — et la
            barre dit combien il reste avant la suivante, ce qu'un total de
            points ne disait pas. */}
        {board?.moi && (
          <div className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3
                          flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-black text-primary text-lg shrink-0">
                  {N.ord(board.moi.rank)}
                </span>
                <span className="font-bold text-primary truncate">{N.t('duel_you')}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Mouvement move={board.moi.move || 0} reduit={reduit} />
              </div>
            </div>
            {/* Le rang en entier, sur sa propre ligne : c'est la seule ligne
                de l'ecran ou il a la place de s'ecrire, et c'est celle qu'on
                vient lire. */}
            <Ecusson etage={board.moi.etage} division={board.moi.division}
                     className="self-start" />
            {board.echelle && board.moi.etage !== 'legende' && (
              <div className="flex flex-col gap-1">
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden"
                     role="progressbar" aria-valuemin={0}
                     aria-valuemax={board.echelle.lp_par_palier}
                     aria-valuenow={board.moi.lp}
                     aria-label={nomDuRang(board.moi.etage, board.moi.division)}>
                  <motion.span className="block h-full bg-primary rounded-full"
                    initial={false}
                    animate={{ width: `${Math.min(100, (board.moi.lp / board.echelle.lp_par_palier) * 100)}%` }}
                    transition={reduit ? { duration: 0 } : RESSORT.jauge} />
                </div>
                <span className="text-[9px] text-primary/80 tabular-nums text-right">
                  {N.t('duel_reste', {
                    n: `${Math.max(0, board.echelle.lp_par_palier - board.moi.lp)} ${N.t('duel_lp')}`,
                  })}
                </span>
              </div>
            )}
            {board.moi.etage === 'legende' && (
              <span className="text-[9px] text-primary/80 tabular-nums text-right">
                {board.moi.lp} {N.t('duel_lp')}
              </span>
            )}
          </div>
        )}
        {!chargement && !board?.moi && (
          <div className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-center">
            <span className="text-[10px] md:text-xs text-muted-foreground">{N.t('duel_unranked')}</span>
          </div>
        )}

        <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl">
          {chargement && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> {N.t('loading_ranks')}
            </p>
          )}
          {!chargement && rows.length === 0 && (
            <div className="py-8 flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground text-center">{N.t('duel_empty')}</p>
              <p className="text-[10px] text-muted-foreground/70 text-center">{N.t('duel_must')}</p>
            </div>
          )}
          {!chargement && rows.length > 0 && (
            <>
              <div className="flex items-baseline justify-between px-1 pb-2 mb-1 border-b border-white/10">
                <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground">
                  {rows.length} {rows.length > 1 ? 'joueurs' : 'joueur'}
                </span>
                <span className="text-[9px] md:text-[10px] text-muted-foreground/70">
                  {N.t('duel_since')}
                </span>
              </div>
              {/* layout anime : une ligne qui change de rang glisse a sa place */}
              <div className="flex flex-col gap-1.5 max-h-[calc(100dvh-24rem)] min-h-[36vh] overflow-y-auto overscroll-contain pr-1">
                <AnimatePresence initial={false}>
                  {rows.map((r: DuelRow) => {
                    const moi = r.name.trim().toLowerCase() === moiKey;
                    return (
                      <motion.div
                        key={r.name.toLowerCase()}
                        layout={reduit ? false : true}
                        transition={reduit ? { duration: 0 } : RESSORT.rang}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border
                          ${moi ? 'bg-primary/15 border-primary/40' : 'border-white/5 bg-black/20'}`}
                      >
                        <span className={`font-bold w-6 md:w-8 shrink-0 text-xs md:text-sm
                          ${r.rank === 1 ? 'text-primary' : r.rank === 2 ? 'text-slate-300'
                            : r.rank === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {r.rank}.
                        </span>
                        <Mouvement move={r.move || 0} reduit={reduit} />
                        {/* Le pseudo occupe sa ligne entiere. La medaille est
                            passee en dessous, avec le bilan : mise a cote du
                            nom elle le faisait tronquer, et c'est le nom qu'on
                            vient lire. */}
                        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Drapeau pays={r.pays} className="text-[13px]" />
                            <span className={`font-bold tracking-wide truncate text-xs md:text-sm
                              ${moi ? 'text-primary' : 'text-foreground'}`}>
                              {r.name}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Medaille m={r.medaille} />
                            <Ecusson etage={r.etage} division={r.division} lp={r.lp} compact />
                            <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
                              {N.t('duel_record', { v: r.wins, d: r.losses, n: r.draws })}
                            </span>
                          </span>
                        </div>
                        {/* Prendre cette personne en duel, sur l'epreuve
                            choisie au-dessus. Sur toutes les lignes sauf la
                            sienne, et depuis n'importe ou — l'accueil compris,
                            ou le classement n'ouvrait sur rien. */}
                        {!moi && !surInviter && (
                          <button
                            onClick={() => defier(r.name)}
                            disabled={!!defiEnCours}
                            title={`${N.t('challenge_them')} — ${r.name}`}
                            aria-label={`${N.t('challenge_them')} ${r.name}`}
                            className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center
                                       text-primary/70 border border-primary/30 hover:bg-primary/15
                                       hover:text-primary disabled:opacity-30 transition-colors"
                          >
                            {defiEnCours === r.name
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Swords className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                          </button>
                        )}
                        {/* Le meme geste, mais pour une course en direct : on
                            convie au lieu de defier. Une ligne deja conviee
                            reste allumee et ne se reclique pas — sans quoi on
                            enverrait trois invitations a la meme personne sans
                            s'en apercevoir. */}
                        {!moi && surInviter && (
                          <button
                            onClick={() => inviter(r.name)}
                            disabled={!!invitEnCours || convies.includes(r.name)}
                            title={`${N.t('live_inviter')} — ${r.name}`}
                            aria-label={`${N.t('live_inviter')} ${r.name}`}
                            className={`shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center
                                       border transition-colors ${
                              convies.includes(r.name)
                                ? 'text-background bg-emerald-400 border-emerald-400'
                                : 'text-primary/70 border-primary/30 hover:bg-primary/15 hover:text-primary'
                            } disabled:opacity-100`}
                          >
                            {invitEnCours === r.name
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : convies.includes(r.name)
                                ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                : <Radio className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
