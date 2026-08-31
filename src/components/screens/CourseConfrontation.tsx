import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Eye, Swords } from 'lucide-react';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { TAILLE } from '@/game/salle-relais';
import {
  SalleConfrontation,
  type EtatConfrontation, type EquipeEnCourse,
} from '@/game/salle-confrontation';
import {
  Marque, Couloir, BoutonTemoin, Fin, Vestiaire, couleurDe, chrono,
} from './relais-pieces';

/**
 * La confrontation : deux a huit equipes, un seul coup de pistolet.
 *
 * Ce qui la distingue d'un relais solitaire n'est pas le nombre, c'est le
 * regard. On voit le temoin d'a cote avancer, on sait qu'on est en retard bien
 * avant l'arrivee, et un passage rate se paie devant temoin. Deux endroits le
 * disent a l'ecran, et ils ne font pas double emploi :
 *
 * - la piste, ou les temoins adverses courent dans les couloirs voisins. C'est
 *   ce qu'on regarde en courant, sans lire.
 * - la bande des couloirs, qui donne les quatre cents metres d'un coup d'oeil.
 *   C'est ce qu'on lit quand on ne court pas — et dans un relais, on ne court
 *   qu'un quart du temps.
 *
 * Les fantomes n'y sont pas traites a part : le serveur annonce leurs positions
 * comme celles de n'importe quelle equipe. Un seul cas particulier subsiste,
 * l'etiquette qui dit que celle-ci a deja couru.
 */

/** Les autres equipes, dans un ordre stable — sans quoi les couleurs sautent. */
function autresQue(e: EtatConfrontation | null, moi: string): EquipeEnCourse[] {
  return (e?.equipes || []).filter(x => x.equipe !== moi);
}

export function CourseConfrontation({ code, equipe, max, fantomes, onQuitter }: {
  code: string; equipe: string; max: number; fantomes: number[];
  onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const [e, setE] = useState<EtatConfrontation | null>(null);
  const [pret, setPret] = useState(false);
  const [marque, setMarque] = useState(0);
  const [erreur, setErreur] = useState('');
  const [termine, setTermine] = useState(false);
  const salle = useRef<SalleConfrontation | null>(null);
  /** Le couloir attribue a chaque equipe, fixe une fois pour toutes. */
  const couloirs = useRef(new Map<string, number>());
  /** Leur nom, garde a part : les couloirs se figent, les noms arrivent. */
  const noms = useRef(new Map<string, string>());
  /**
   * Ou est chaque temoin, en direct.
   *
   * Les etats complets n'arrivent qu'aux passages : s'en contenter figerait
   * tous les temoins entre deux transmissions — chaque equipe se croirait seule
   * en piste, et le receveur ne verrait jamais son porteur approcher.
   */
  const [temoins, setTemoins] = useState<Record<string, number>>({});
  const porteurs = useRef(new Map<string, number>());

  useEffect(() => {
    const s = new SalleConfrontation(code, equipe, {
      onEtat: (etat) => {
        for (const x of etat.equipes) {
          if (!couloirs.current.has(x.equipe)) {
            couloirs.current.set(x.equipe, couloirs.current.size);
          }
          if (x.nom) noms.current.set(x.equipe, x.nom);
          porteurs.current.set(x.equipe, x.porteur);
        }
        setTemoins(Object.fromEntries(etat.equipes.map(x => [x.equipe, x.temoin_d])));
        setE(etat);
      },
      onDepart: (dansMs) => {
        // Les adversaires entrent dans la course comme des coureurs a part
        // entiere, un par couloir : tout le rendu, la camera et le classement
        // en course continuent de fonctionner sans savoir qu'ils viennent du
        // reseau. Leur identifiant est le code de leur equipe — un relais n'a
        // qu'un temoin, et c'est lui que l'on suit, pas ses quatre porteurs.
        const autres = [...couloirs.current.entries()]
          .filter(([id]) => id !== equipe)
          .map(([id, i]) => ({ id, nom: noms.current.get(id) || id, couloir: i + 1 }));
        SprinterApp.startRelais({ relais: s.monRelais, marque: s.marque, autres });
        SprinterApp.liveDepart(dansMs);
        brancherSalle({
          position: (d) => {
            s.avancer(d);
            // Mes propres positions ne me reviennent pas en echo : quand je
            // porte le temoin, c'est le moteur qui me dit ou il est.
            if (s.monRelais === porteurs.current.get(equipe)) {
              setTemoins(t => ({ ...t, [equipe]: d }));
            }
          },
          fini: () => s.terminer(),
        });
      },
      onPos: (eq, relais, d) => {
        if (relais === porteurs.current.get(eq)) {
          setTemoins(t => (t[eq] === d ? t : { ...t, [eq]: d }));
        }
        // Le temoin adverse avance dans le couloir d'a cote, aux memes metres
        // absolus que les miens : la piste du 4x100 fait le tour complet, et
        // les deux reperes sont le meme. Rien a traduire.
        if (eq !== equipe) SprinterApp.liveDistDe(eq, d);
      },
      onPasse: (eq, p) => {
        if (eq !== equipe) return;
        if (p.de === s.monRelais) brancherSalle(null);
        if (p.vers === s.monRelais) SprinterApp.recevoirTemoin(p.ecart);
      },
      onElimine: (eq, raison) => {
        if (eq !== equipe) return;
        brancherSalle(null);
        setErreur(raison);
      },
      onFini: (eq) => { if (eq === equipe) brancherSalle(null); },
      onTermine: () => setTermine(true),
      onFerme: (r) => { if (r !== 'fermee') setErreur(r); },
    });
    salle.current = s;
    s.connecter(max, fantomes);
    return () => { brancherSalle(null); s.fermer(); };
  }, [code, equipe]);

  useEffect(() => {
    const z = salle.current?.maZone;
    if (z && marque === 0) setMarque(z.debut);
  }, [e]);

  const mienne = useMemo(() => salle.current?.mienne(e) || null, [e]);
  const autres = useMemo(() => autresQue(e, equipe), [e, equipe]);

  if (!e || !mienne) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#05070d]/80">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mon = salle.current?.monRelais || 0;
  const zone = salle.current?.maZone || null;
  const partie = !!e.depart_a;
  const maCourseEstFinie = mienne.total != null || !!mienne.elimine;
  const jeRecois = partie && mon === mienne.porteur + 1 && !maCourseEstFinie;
  const jeDonne = partie && mon === mienne.porteur && mon < TAILLE && !maCourseEstFinie;
  const dTemoin = (id: string) => temoins[id] ?? 0;
  const aPortee = !!(jeRecois && zone && dTemoin(equipe) >= zone.debut - 12);

  const couleur = (id: string) => couleurDe(couloirs.current.get(id) ?? 0);
  const rangee = (x: EquipeEnCourse) => (
    <Couloir key={x.equipe} nom={x.nom || x.equipe} code={x.equipe}
             d={dTemoin(x.equipe)} porteur={x.porteur} couleur={couleur(x.equipe)}
             moi={x.equipe === equipe} elimine={!!x.elimine} total={x.total}
             fantome={x.equipe.startsWith('F') && x.presents === 0} />
  );

  /* ------------------------------------------------------------- la fin */

  // On n'attend la fin de TOUT LE MONDE que si l'on a soi-meme fini : un
  // classement partiel n'apprend rien, et rester devant la piste alors qu'on
  // est elimine depuis vingt secondes n'apprend rien non plus.
  if (termine || maCourseEstFinie) {
    const place = e.classement.find(p => p.equipe === equipe)?.place ?? null;
    return (
      <AnimatePresence>
        <Fin
          rate={!!mienne.elimine}
          titre={N.t(mienne.elimine ? 'relais_elimine' : 'relais_arrivee')}
          detail={mienne.elimine ? N.t('relais_elimine_pourquoi', {
            r: String(mienne.elimine.relais), c: mienne.elimine.raison,
          }) : ''}
          temps={mienne.total}
          place={place}
          passes={mienne.passes}
          onFermer={onQuitter}
          enfants={
            <div className="w-full flex flex-col gap-1.5 mt-1">
              <span className="text-[9px] tracking-widest text-muted-foreground text-center">
                {N.t('conf_classement')}
              </span>
              {e.classement.map((p, i) => (
                <div key={p.equipe}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border
                       ${p.equipe === equipe ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
                                             : 'border-white/8 bg-black/25'}`}>
                  <span className="font-mono text-[10px] w-5 tabular-nums text-muted-foreground">
                    {p.place != null ? p.place + '.' : '—'}
                  </span>
                  <span className="w-1.5 h-4 rounded-full shrink-0"
                        style={{ background: couleur(p.equipe) }} />
                  <span className="flex-1 text-[11px] font-bold truncate text-foreground">
                    {p.nom || p.equipe}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {p.total != null ? chrono(p.total) : N.t('relais_elimine_court')}
                  </span>
                </div>
              ))}
              {!termine && (
                <p className="text-[10px] text-center text-muted-foreground leading-snug">
                  {N.t('conf_encore')}
                </p>
              )}
            </div>
          }
        />
      </AnimatePresence>
    );
  }

  /* ------------------------------------------------- pendant la course */

  if (partie) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
                      flex flex-col gap-2 pointer-events-none">
        <div className="mx-auto w-full max-w-sm flex flex-col gap-2">
          <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10
                          p-2 flex flex-col gap-1 max-h-[38vh] overflow-y-auto">
            {rangee(mienne)}
            {autres.map(rangee)}
          </div>

          {jeRecois || jeDonne ? (
            <BoutonTemoin role={jeDonne ? 'donne' : 'recoit'}
                          arme={jeDonne || aPortee}
                          onTaper={() => salle.current?.temoin()} />
          ) : (
            <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10
                            px-3 py-2 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[10px] tracking-widest text-muted-foreground truncate">
                {N.t('relais_spectateur')}
              </span>
              <span className="flex-1" />
              <span className="font-mono text-xs tabular-nums text-emerald-300">
                {Math.round(dTemoin(equipe))} m
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------- avant le pistolet */

  const manque = mienne.presents < TAILLE;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8
                    overflow-y-auto bg-[#05070d]/90 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card/80 backdrop-blur-xl border border-primary/30
                   rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest
                           text-primary">
            <Swords className="w-3.5 h-3.5" /> {code}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {N.t('relais_mon_rang', { n: String(mon) })}
          </span>
        </div>

        {/* Qui est deja la. Le nombre d'equipes n'est pas un detail : on attend
            que chaque equipe presente soit au complet, et une equipe qui
            n'arrive jamais ne bloque personne. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] tracking-widest text-muted-foreground">
            {N.t('conf_engagees', { n: String(e.equipes.length), m: String(e.max) })}
          </span>
          {e.equipes.map(x => (
            <div key={x.equipe}
                 className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border
                   ${x.equipe === equipe ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
                                         : 'border-white/8 bg-black/25'}`}>
              <span className="w-1.5 h-4 rounded-full shrink-0"
                    style={{ background: couleur(x.equipe) }} />
              <span className="flex-1 text-[11px] font-bold truncate text-foreground">
                {x.nom || x.equipe}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {x.presents === 0 ? N.t('relais_fantome') : `${x.prets}/${x.presents}`}
              </span>
            </div>
          ))}
        </div>

        {zone && mon > 1 && (
          <Marque zone={zone} valeur={marque}
                  onChange={d => { setMarque(d); salle.current?.placer(d); }} />
        )}
        {mon === 1 && (
          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            {N.t('relais_premier')}
          </p>
        )}

        <Vestiaire joueurs={mienne.joueurs} monRelais={mon} />

        <button
          onClick={() => { const v = !pret; setPret(v); salle.current?.pret(v); }}
          disabled={manque}
          className={`w-full py-3 rounded-xl font-black font-display tracking-widest
            disabled:opacity-40 disabled:pointer-events-none
            ${pret ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                   : 'bg-emerald-400 text-background'}`}>
          {N.t(pret ? 'live_unready' : 'live_go')}
        </button>
        {manque && (
          <p className="text-[10px] text-center text-muted-foreground">
            {N.t('relais_attend_equipe', { n: String(TAILLE - mienne.presents) })}
          </p>
        )}
        {!manque && e.equipes.length < 2 && (
          <p className="text-[10px] text-center text-muted-foreground">
            {N.t('conf_attend_adversaire')}
          </p>
        )}

        {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
        <button onClick={onQuitter}
                className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground">
          {N.t('live_leave')}
        </button>
      </motion.div>
    </div>
  );
}
