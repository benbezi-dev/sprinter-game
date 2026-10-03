import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, RotateCcw, Check } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { MONTEE } from '@/lib/mouvement';
import { etatSalle } from '@/game/live';
import { useSalonDirect, voterRevanche } from '@/game/salon-direct';

/** Toutes les combien on demande a une piste refermee si quelqu'un y attend. */
const SONDE_MS = 5000;
/** Et pendant combien de temps : au-dela, plus personne ne reviendra. */
const SONDE_MAX = 36;

/**
 * LA REVANCHE, SUR L'ECRAN DE FIN D'UNE COURSE EN DIRECT.
 *
 * La salle permettait deja de recourir : elle reste ouverte apres le verdict
 * pour ca. Mais il fallait le savoir — rentrer a l'accueil, retrouver l'onglet,
 * rappuyer sur PRET — et cela tournait mal de deux facons. Ou bien le premier
 * revenu relancait la piste a lui seul, tous les autres etant encore « prets »
 * de la course d'avant ; ou bien la salle s'etait refermee entre-temps, et le
 * salon n'etait plus qu'une image : il fallait le quitter et ouvrir une autre
 * piste, sous un autre code, pour courir contre les memes personnes.
 *
 * La revanche se demande donc ici, la ou l'on vient de lire le resultat, et
 * elle ne part que si TOUT LE MONDE l'a acceptee : la salle remet chacun a
 * « pas pret » a chaque verdict, et repart quand le dernier a dit oui. D'ici,
 * on voit qui l'a deja demandee.
 *
 * Une piste refermee se rouvre sous le meme code, et l'on y revient deja
 * partant. Ceux qui ne l'ont pas encore rouverte voient qui les y attend : la
 * piste est interrogee de loin, sans s'y connecter — une connexion la
 * tiendrait eveillee, et c'est justement ce que sa fermeture evite.
 */
export function RevancheDirecte() {
  const s = useSalonDirect();
  const { N } = SprinterApp;

  const coupee = !!s && s.coupee && !s.enVie();
  /** Ceux qui attendent sur la piste rouverte, vus de l'exterieur. */
  const [attendent, setAttendent] = useState<string[]>([]);

  useEffect(() => {
    setAttendent([]);
    if (!s || !coupee) return;
    let fini = false;
    let n = 0;
    const sonder = async () => {
      if (fini || n++ >= SONDE_MAX) return;
      const e = await etatSalle(s.code);
      if (fini) return;
      setAttendent((e?.joueurs || []).map(j => j.nom));
      timer = setTimeout(sonder, SONDE_MS);
    };
    let timer: ReturnType<typeof setTimeout> = setTimeout(sonder, 0);
    return () => { fini = true; clearTimeout(timer); };
  }, [s, coupee]);

  if (!s) return null;

  const etat = s.dernierEtat;
  const joueurs = coupee ? [] : (etat?.joueurs || []);
  const autres = joueurs.filter(j => j.id !== s.moi);
  const max = etat?.max || 2;
  const complet = joueurs.length >= max;
  const moiPret = s.pretMoi;
  const prets = autres.filter(j => j.pret).map(j => j.nom);
  const attendus = autres.filter(j => !j.pret).map(j => j.nom);
  // En train de se connecter : on a appuye, la salle n'a pas encore repondu.
  const enRoute = !coupee && !s.moi;
  const tous = complet && moiPret && attendus.length === 0;

  const noms = (l: string[]) => l.join(', ');

  // Ce que la ligne sous le titre raconte, du plus urgent au plus banal.
  const phrase = coupee
    ? (attendent.length
        ? N.t(attendent.length > 1 ? 'live_rev_attendent' : 'live_rev_attend', { n: noms(attendent) })
        : N.t('live_rev_coupee'))
    : enRoute ? N.t('live_rev_connexion')
    : tous ? N.t('live_rev_tous')
    : !complet ? N.t('live_rev_place', { n: max - joueurs.length })
    : moiPret ? N.t('live_rev_attente', { n: noms(attendus) })
    : prets.length
      ? N.t(prets.length > 1 ? 'live_rev_veulent' : 'live_rev_veut', { n: noms(prets) })
      : N.t('live_rev_sub');

  // Le bouton : demander, accepter, retirer sa demande, ou rouvrir la piste.
  const veutQuelquun = coupee ? attendent.length > 0 : prets.length > 0;
  const libelle = moiPret && !coupee ? N.t('live_rev_retirer')
    : veutQuelquun ? N.t('live_rev_accepter')
    : coupee ? N.t('live_rev_rouvrir')
    : N.t('live_revanche');

  return (
    <motion.div
      {...MONTEE}
      className={`w-full rounded-2xl border px-4 py-3 court:px-3 court:py-2 flex flex-col items-center gap-2 court:gap-1.5 shadow-2xl
        ${moiPret || veutQuelquun ? 'border-emerald-400/50 bg-emerald-400/[0.08]' : 'border-white/15 bg-card/60'}`}
    >
      <div className="flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-emerald-400" />
        <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-emerald-300">
          {N.t('live_rev_titre')}
        </span>
      </div>

      {/* Qui est partant, couloir par couloir : c'est ce qu'on attend de
          savoir avant d'appuyer. Pas sur une piste refermee — il n'y a plus
          personne dessus, la phrase dit qui y attend. */}
      {joueurs.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {joueurs.map(j => (
            <span key={j.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] md:text-xs font-bold tracking-wide
                    ${j.pret ? 'border-emerald-400/50 text-emerald-300 bg-emerald-400/10'
                             : 'border-white/10 text-muted-foreground'}`}>
              {j.pret && <Check className="w-3 h-3" />}
              <span className="truncate max-w-[9rem]">
                {j.id === s.moi ? N.t('duel_you') : j.nom}
              </span>
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
        {phrase}
      </p>

      <button
        onClick={() => voterRevanche(coupee || !moiPret)}
        // Une piste incomplete accepte quand meme le oui : il attend le
        // couloir libre, et la revanche part des que quelqu'un l'a pris et
        // l'a dit a son tour.
        disabled={enRoute || tous}
        className={`w-full py-2.5 court:py-2 rounded-xl font-black font-display tracking-widest text-xs md:text-sm
          transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2
          ${moiPret && !coupee
            ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
            : 'bg-emerald-400 text-background hover:bg-emerald-400/90'}`}
      >
        {(enRoute || tous) && <Loader2 className="w-4 h-4 animate-spin" />}
        {libelle}
      </button>
    </motion.div>
  );
}
