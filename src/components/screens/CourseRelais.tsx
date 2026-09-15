import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { Loader2, Eye } from 'lucide-react';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { SalleRelais, TAILLE, PORTEE, type EtatRelais } from '@/game/salle-relais';
import { programmerLeFilm, arreterLeFilm, jeterLeFilm } from '@/game/film-course';
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
  /**
   * LA DISTANCE ENTRE MON PARTENAIRE ET MOI, en metres.
   *
   * C'est elle qui decide de la transmission depuis qu'un contact est exige
   * (`PORTEE` dans worker/src/relais-course.js). Avant, le bouton s'armait
   * sur la seule approche du temoin — « le porteur est a douze metres de ma
   * zone » — et le temoin sautait par-dessus vingt metres de piste.
   *
   * `null` tant qu'il n'y a personne a qui tendre la main.
   */
  const [bras, setBras] = useState<number | null>(null);
  /** Une main tendue dans le vide, a montrer une seconde. */
  const [rate, setRate] = useState(0);
  const salle = useRef<SalleRelais | null>(null);
  const porteur = useRef(1);
  /** Ou est chacun, par rang de relais — nourri par la salle, dix fois par seconde. */
  const ou = useRef<Record<number, number>>({});
  /**
   * Le dernier etat recu, en miroir.
   *
   * Les rappels de la salle sont poses UNE FOIS, au montage : ils capturent
   * le `e` de ce rendu-la, c'est-a-dire `null`. Lire l'etat depuis une ref
   * est ce qui leur donne acces a l'etat courant — la liste des joueurs, sans
   * laquelle on ne sait pas a quel identifiant appartient un rang de relais.
   */
  const etatRef = useRef<EtatRelais | null>(null);

  /**
   * Recalcule la distance qui me separe de mon partenaire de transmission.
   *
   * Mon partenaire n'est pas n'importe qui : c'est le porteur si je recois,
   * le relayeur suivant si je donne, et personne le reste du temps. Hors de
   * ces deux cas, le bouton n'a pas a s'armer.
   */
  const majBras = () => {
    const moi = salle.current?.monRelais || 0;
    const p = porteur.current;
    const partenaire = moi === p + 1 ? p : (moi === p && moi < TAILLE ? moi + 1 : 0);
    if (!partenaire || !moi) { setBras(null); return; }
    const a = ou.current[moi], b = ou.current[partenaire];
    if (a == null || b == null) { setBras(null); return; }
    setBras(Math.abs(a - b));
  };

  useEffect(() => {
    const s = new SalleRelais(equipe, {
      onEtat: (etat) => {
        porteur.current = etat.porteur;
        etatRef.current = etat;
        // Le temoin change de main : le dessin le lit sur le coureur, et
        // c'est la salle qui dit lequel l'a.
        SprinterApp.porteurDuTemoin(etat.porteur);
        setTemoinD(etat.temoin_d);
        setE(etat);
        majBras();
      },
      // Le porteur ne recoit pas ses propres positions en echo : les siennes
      // lui viennent du moteur, celles des autres de la salle.
      //
      // On ne s'en sert plus seulement pour suivre le temoin. Chaque position
      // recue fait DEUX choses de plus : elle fait avancer le coequipier sur
      // ma piste — sans quoi il n'y serait pas — et elle remet a jour la
      // distance qui nous separe, celle dont depend la transmission.
      onPos: (relais, d, c) => {
        ou.current[relais] = d;
        if (relais === porteur.current) setTemoinD(d);
        const j = (etatRef.current?.joueurs || []).find(x => x.relais === relais);
        // Avec l'instant de SA course, quand la salle le transmet : le
        // coequipier est dessine ou il en est a notre instant, et non ou il
        // etait quand le paquet est parti — la transmission se voit la ou
        // elle se joue. Voir recevoirPosition dans sprinter-app.js.
        if (j) SprinterApp.liveDistDe(j.id, d, c);
        majBras();
      },
      onDepart: (dansMs, departA) => {
        // Le coup de pistolet est celui de TOUT LE MONDE, pas seulement du
        // premier relayeur. Les quatre entrent en course a la meme seconde :
        // les trois autres sont debout dans leur zone, libres de s'elancer
        // quand ils jugent le temoin assez proche. C'est exactement le sport —
        // partir trop tot fait sortir de la zone, partir trop tard laisse le
        // porteur depasser — et cela ne demande aucun bouton : s'elancer,
        // c'est se mettre a courir.
        // LES TROIS AUTRES ENTRENT SUR MA PISTE, dans mon couloir.
        //
        // `autres: []` laissait l'ecran vide de tout coequipier : on voyait
        // un coureur seul, et le temoin changeait de main sans que rien ne se
        // croise a l'image. `equipiers` les pose a leur marque, decales d'un
        // tiers de couloir pour qu'on lise les deux corps au moment ou ils se
        // rejoignent.
        const mesEquipiers = (etatRef.current?.joueurs || [])
          .filter(j => j.relais !== s.monRelais)
          .map(j => ({ id: j.id, nom: j.nom, relais: j.relais }));
        SprinterApp.startRelais({
          relais: s.monRelais, marque: s.marque, autres: [], equipiers: mesEquipiers,
        });
        SprinterApp.liveDepart(dansMs, departA);
        // Au coup de pistolet, le temoin est dans la main du premier.
        SprinterApp.porteurDuTemoin(1);
        // L'HORLOGE DU RELAIS EST CELLE DE LA SALLE. Le temps de l'equipe se
        // compte sur elle, et c'est elle qui arbitre la distance entre deux
        // relayeurs : chaque position part donc datee sur elle, et les
        // coequipiers se dessinent sur elle. Le chronometre du moteur, lui,
        // prend du retard des qu'un telephone gele une seconde, et un
        // coequipier se dessinait alors cinq metres a cote de sa place. Voir
        // instantLive dans sprinter-app.js. APRES `startRelais`, qui remet
        // l'horloge par defaut.
        SprinterApp.G.horlogeLive = () => s.msCourse() / 1000;
        brancherSalle({
          position: (d) => {
            s.avancer(d, Math.max(0, s.msCourse()));
            ou.current[s.monRelais] = d;
            if (s.monRelais === porteur.current) setTemoinD(d);
            majBras();
          },
          fini: () => s.terminer(),
        });

        // ET LA CAMERA TOURNE, POUR LES QUATRE CENTS METRES ENTIERS.
        //
        // Pas seulement pour sa portion : un relais ne se raconte pas par un
        // quart de relais. Le film part du coup de pistolet et s'arrete au
        // chrono de l'equipe — on y voit donc son propre passage, mais aussi
        // les trois autres, la transmission qu'on a recue et celle qu'on a
        // donnee. C'est la seule course du jeu ou ce qu'on partage appartient
        // a quatre personnes.
        //
        // La date du pistolet vient de la salle, comme en direct : on prend
        // l'avance qu'il faut pour ne pas perdre la sortie des blocs.
        programmerLeFilm('relais', dansMs);
      },
      onPasse: (p, etat) => {
        SprinterApp.porteurDuTemoin(p.vers);
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
      // Hors de portee : on l'annonce, et la course continue. Sans ce retour,
      // les deux coureurs tapent dans le vide sans comprendre pourquoi le
      // temoin ne part pas — et le receveur finit par sortir de sa zone, ce
      // qui, lui, elimine l'equipe.
      onTropLoin: ({ de, vers }) => {
        if (de !== s.monRelais && vers !== s.monRelais) return;
        setRate(Date.now());
      },
      // La course s'arrete ici, et le film avec elle — dans les deux cas.
      //
      // Un relais elimine garde sa video : le passage rate est justement ce
      // qu'on veut revoir, et l'ecran d'arrivee est la pour le proposer. C'est
      // ce qui le distingue d'un faux depart en one shot, qui ne laisse aucune
      // course derriere lui.
      onElimine: (raison) => {
        brancherSalle(null); setErreur(raison);
        void arreterLeFilm('relais');
      },
      onFini: () => { brancherSalle(null); void arreterLeFilm('relais'); },
      onFerme: (r) => { if (r !== 'fermee') setErreur(r); },
    });
    salle.current = s;
    s.connecter();
    // En sortant de la piste, le film s'en va aussi : l'ecran d'arrivee est le
    // seul a le proposer, et un fichier que plus personne ne peut voir n'a
    // aucune raison d'occuper la memoire de l'onglet pendant deux heures.
    return () => {
      // L'horloge de la salle part avec elle : une course suivante reporterait
      // ses adversaires sur une salle fermee.
      SprinterApp.G.horlogeLive = null;
      brancherSalle(null); s.fermer(); jeterLeFilm('relais');
    };
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
  /**
   * LA TAPE NE S'OFFRE QU'AU CONTACT.
   *
   * Elle s'armait sur l'approche — « le porteur est a douze metres de ma
   * zone » — et le donneur, lui, l'avait des qu'il courait. Deux coureurs
   * separes de vingt metres se passaient donc le temoin, qui traversait la
   * piste tout seul. La regle exige maintenant un contact
   * (`PORTEE`, worker/src/relais-course.js) et le bouton dit la meme chose
   * que l'arbitre : il s'allume quand les deux corps sont a portee de bras,
   * pour le donneur comme pour le receveur.
   */
  const aPortee = !!((jeRecois || jeDonne) && bras != null && bras <= PORTEE);

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
                          arme={aPortee}
                          bras={bras} portee={PORTEE} rate={rate}
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
        {...MONTEE}
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
