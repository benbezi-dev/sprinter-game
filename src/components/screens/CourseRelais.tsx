import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Eye } from 'lucide-react';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { SalleRelais, TAILLE, type EtatRelais } from '@/game/salle-relais';
import { Marque, Couloir, BoutonTemoin, Fin, Vestiaire, couleurDe } from './relais-pieces';

/**
 * La course de relais d'une equipe, cote joueur.
 *
 * Quatre ecrans qui n'en font qu'un, parce qu'ils se suivent sans qu'on ait le
 * temps de naviguer : l'attente en zone, la tape du temoin, la vue spectateur
 * pendant les portions des autres, et la fin.
 *
 * Le client n'arbitre rien. Il annonce sa marque, sa position, sa tape et son
 * chrono ; c'est la salle qui date les deux tapes sur son horloge, verifie la
 * geometrie et tranche. Un passage rate elimine toute l'equipe — laisser ce
 * jugement a l'un des deux telephones serait laisser une equipe se faire
 * eliminer par la latence de son coequipier.
 *
 * Cet ecran se pose PAR-DESSUS la piste, et non dans l'onglet du vestiaire :
 * le temoin se passe pendant la course, et l'onglet, lui, disparait au coup de
 * pistolet avec tout l'ecran-titre.
 */

export function CourseRelais({ equipe, onQuitter }: {
  equipe: string; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const [e, setE] = useState<EtatRelais | null>(null);
  const [pret, setPret] = useState(false);
  const [marque, setMarque] = useState(0);
  const [erreur, setErreur] = useState('');
  /**
   * Ou est le temoin, en direct.
   *
   * Il ne peut pas venir de `e.temoin_d` : les messages d'etat complets
   * n'arrivent qu'aux passages et aux entrees, si bien que le temoin y reste
   * fige entre deux transmissions. Un receveur ne verrait jamais son porteur
   * approcher, et son bouton ne s'armerait pas — la seule chose qu'il ait a
   * faire de toute la course.
   */
  const [temoinD, setTemoinD] = useState(0);
  const salle = useRef<SalleRelais | null>(null);
  const porteur = useRef(1);

  useEffect(() => {
    const s = new SalleRelais(equipe, {
      onEtat: (etat) => {
        porteur.current = etat.porteur;
        setTemoinD(etat.temoin_d);
        setE(etat);
      },
      // Le porteur ne recoit pas ses propres positions en echo : les siennes
      // lui viennent du moteur, celles des autres de la salle.
      onPos: (relais, d) => { if (relais === porteur.current) setTemoinD(d); },
      onDepart: (dansMs) => {
        // Le coup de pistolet est celui de TOUT LE MONDE, pas seulement du
        // premier relayeur. Les quatre entrent en course a la meme seconde :
        // les trois autres sont debout dans leur zone, libres de s'elancer
        // quand ils jugent le temoin assez proche. C'est exactement le sport —
        // partir trop tot fait sortir de la zone, partir trop tard laisse le
        // porteur depasser — et cela ne demande aucun bouton : s'elancer,
        // c'est se mettre a courir.
        SprinterApp.startRelais({ relais: s.monRelais, marque: s.marque, autres: [] });
        SprinterApp.liveDepart(dansMs);
        brancherSalle({
          position: (d) => {
            s.avancer(d);
            if (s.monRelais === porteur.current) setTemoinD(d);
          },
          fini: () => s.terminer(),
        });
      },
      onPasse: (p, etat) => {
        // Le temoin est parti de mes mains : ma course est finie, et il n'y a
        // plus de raison d'annoncer ou je vais.
        if (p.de === s.monRelais) brancherSalle(null);
        // Il arrive dans les miennes : c'est la salle qui a mesure l'ecart
        // entre les deux tapes, sur la seule horloge commune aux deux
        // telephones. Le jeu n'a plus qu'a en tirer la vitesse gardee.
        if (p.vers === s.monRelais) {
          const derniere = etat.passes?.[etat.passes.length - 1] as any;
          SprinterApp.recevoirTemoin(derniere?.ecart ?? 0);
        }
      },
      onElimine: (raison) => { brancherSalle(null); setErreur(raison); },
      onFini: () => brancherSalle(null),
      onFerme: (r) => { if (r !== 'fermee') setErreur(r); },
    });
    salle.current = s;
    s.connecter();
    return () => { brancherSalle(null); s.fermer(); };
  }, [equipe]);

  // La marque part de l'entree de la zone : c'est le placement le plus sur, et
  // c'est celui qu'on veut par defaut pour qui ne touche a rien.
  useEffect(() => {
    const z = salle.current?.maZone;
    if (z && marque === 0) setMarque(z.debut);
  }, [e]);

  if (!e) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#05070d]/80">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mon = salle.current?.monRelais || 0;
  const zone = salle.current?.maZone || null;
  const partie = !!e.depart_a;
  const fini = e.total != null || !!e.elimine;
  const jeRecois = partie && mon === e.porteur + 1;
  const jeDonne = partie && mon === e.porteur && mon < TAILLE;
  // La tape ne s'offre au receveur que quand le porteur approche : douze
  // metres avant l'entree de zone, il est deja dans le champ de vision.
  const aPortee = !!(jeRecois && zone && temoinD >= zone.debut - 12);

  if (fini) {
    return (
      <AnimatePresence>
        <Fin
          rate={!!e.elimine}
          titre={N.t(e.elimine ? 'relais_elimine' : 'relais_arrivee')}
          detail={e.elimine ? N.t('relais_elimine_pourquoi', {
            r: String(e.elimine.relais), c: e.elimine.raison,
          }) : ''}
          temps={e.total}
          passes={e.passes}
          onFermer={onQuitter}
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
          <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 p-2">
            <Couloir nom={e.equipe} code={String(mon)} d={temoinD}
                     porteur={e.porteur} couleur={couleurDe(0)} moi />
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
                {Math.round(temoinD)} m
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------- avant le pistolet */

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8
                    overflow-y-auto bg-[#05070d]/90 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card/80 backdrop-blur-xl border border-emerald-400/30
                   rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400">
            {e.equipe}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {N.t('relais_mon_rang', { n: String(mon) })}
          </span>
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

        <Vestiaire joueurs={e.joueurs} monRelais={mon} />

        <button
          onClick={() => { const v = !pret; setPret(v); salle.current?.pret(v); }}
          disabled={e.joueurs.length < TAILLE}
          className={`w-full py-3 rounded-xl font-black font-display tracking-widest
            disabled:opacity-40 disabled:pointer-events-none
            ${pret ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                   : 'bg-emerald-400 text-background'}`}>
          {N.t(pret ? 'live_unready' : 'live_go')}
        </button>
        {e.joueurs.length < TAILLE && (
          <p className="text-[10px] text-center text-muted-foreground">
            {N.t('relais_attend_equipe', { n: String(TAILLE - e.joueurs.length) })}
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
