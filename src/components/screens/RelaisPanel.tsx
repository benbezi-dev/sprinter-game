import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Confrontation } from './Confrontation';
import { Fantomes } from './Fantomes';
import { entrerSurLaPiste } from '@/game/piste';
import { Users, Loader2, Check, X, ArrowUpDown, Trophy } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  mesEquipes, creerEquipe, repondre, ordonner, classementRelais,
  titulaires, ceQuiManque,
  type EquipeRelais, type LigneRelais,
} from '@/game/relais';

/**
 * Le vestiaire du relais.
 *
 * Une equipe EST sa composition : quatre noms, quel que soit l'ordre, forment
 * toujours la meme equipe. Deux consequences visibles ici — on ne peut pas
 * changer un coequipier sans changer d'equipe, et le nom se choisit une fois.
 *
 * Les invitations passent avant tout le reste a l'ecran. Quelqu'un qui ouvre le
 * jeu et decouvre qu'on l'a inscrit dans une equipe doit pouvoir dire oui ou
 * non tout de suite, pas le chercher sous trois panneaux.
 */

const chrono = (ms: number) => (ms / 1000).toFixed(2) + ' s';

function Membre({ m, position, surMoi, onMonter }: {
  m: { nom: string; cle: string; relais: number | null; etat: string };
  position: number;
  surMoi: boolean;
  onMonter?: () => void;
}) {
  const { N } = SprinterApp;
  const attend = m.etat === 'invited';
  const dehors = m.etat === 'out';
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border
      ${dehors ? 'border-destructive/30 bg-destructive/5'
        : attend ? 'border-white/10 bg-black/20 border-dashed'
        : surMoi ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
        : 'border-white/10 bg-black/25'}`}>
      <span className="font-mono text-[11px] w-4 shrink-0 text-muted-foreground tabular-nums">
        {m.relais ?? position}
      </span>
      <span className={`flex-1 text-xs font-bold tracking-wide truncate
        ${dehors ? 'text-destructive/70 line-through' : 'text-foreground'}`}>
        {m.nom}
      </span>
      <span className="text-[9px] tracking-widest shrink-0
                       text-muted-foreground">
        {N.t(attend ? 'relais_attend' : dehors ? 'relais_refuse' : 'relais_ok')}
      </span>
      {onMonter && (
        <button onClick={onMonter} aria-label="monter d'un rang"
                className="shrink-0 text-muted-foreground hover:text-emerald-300">
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function Equipe({ e, onChange, onCourir }: {
  e: EquipeRelais; onChange: () => void; onCourir: (id: string) => void;
}) {
  const { N } = SprinterApp;
  const moi = (getSavedName() || '').trim().toLowerCase();
  const [ordre, setOrdre] = useState<string[]>(() => titulaires(e).map(m => m.cle));
  const [occupe, setOccupe] = useState(false);
  const manque = ceQuiManque(e);

  const monter = (i: number) => {
    if (i === 0) return;
    const o = [...ordre];
    [o[i - 1], o[i]] = [o[i], o[i - 1]];
    setOrdre(o);
  };

  const enregistrer = async () => {
    setOccupe(true);
    await ordonner(e.id, ordre);
    setOccupe(false);
    onChange();
  };

  // Une equipe complete porte deja un ordre — celui des acceptations. On le
  // montre donc toujours, et on le laisse changer : c'est la seule decision
  // tactique du relais, qui part et qui finit.
  const prete = manque === null;
  const parCle = new Map(e.membres.map(m => [m.cle, m]));
  const lignes = prete ? ordre.map(c => parCle.get(c)!).filter(Boolean) : e.membres;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl border border-white/10 bg-black/20">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold tracking-wide text-sm truncate text-foreground">{e.nom}</span>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">{e.id}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {lignes.map((m, i) => (
          <Membre key={m.cle} m={m} position={i + 1}
                  surMoi={m.cle === moi}
                  onMonter={prete ? () => monter(i) : undefined} />
        ))}
      </div>

      {/* On dit ce qui manque plutot que de griser un bouton sans rien
          expliquer : « pas encore prete » n'aide personne a agir. */}
      {prete ? (
        <>
        <button onClick={() => onCourir(e.id)}
          className="w-full py-3 rounded-xl font-black font-display tracking-widest text-sm
                     text-background bg-emerald-400 hover:bg-emerald-400/90">
          {N.t('relais_courir')}
        </button>
        <button onClick={enregistrer} disabled={occupe}
          className="w-full py-2 rounded-xl font-bold tracking-widest text-xs text-background
                     bg-emerald-400 hover:bg-emerald-400/90 disabled:opacity-40
                     flex items-center justify-center gap-2">
          {occupe && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {N.t('relais_fixer_ordre')}
        </button>
        </>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground leading-snug">
          {N.t(manque === 'attente' ? 'relais_manque_reponses' : 'relais_manque_refus')}
        </p>
      )}
    </div>
  );
}

export function RelaisPanel() {
  const { N } = SprinterApp;
  const [equipes, setEquipes] = useState<EquipeRelais[]>([]);
  const [invitations, setInvitations] = useState<EquipeRelais[]>([]);
  const [classement, setClassement] = useState<LigneRelais[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState('');
  const [coequipiers, setCoequipiers] = useState(['', '', '']);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const recharger = async () => {
    const [m, c] = await Promise.all([mesEquipes(), classementRelais()]);
    if (m) { setEquipes(m.equipes || []); setInvitations(m.invitations || []); }
    if (c) setClassement(c.classement || []);
    setChargement(false);
  };

  useEffect(() => { recharger(); }, []);

  /** Seules les equipes au complet peuvent entrer sur une piste. */
  const pretes = equipes.filter(e => ceQuiManque(e) === null);

  const creer = async () => {
    const autres = coequipiers.map(s => s.trim()).filter(Boolean);
    if (!nom.trim() || autres.length !== 3) { setErreur(N.t('relais_incomplet')); return; }
    setOccupe(true); setErreur('');
    const r: any = await creerEquipe(nom.trim(), autres);
    setOccupe(false);
    if (r && r.error) { setErreur(r.error); return; }
    setNom(''); setCoequipiers(['', '', '']);
    recharger();
  };

  const repondreA = async (id: string, oui: boolean) => {
    await repondre(id, oui);
    recharger();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-5
                 shadow-2xl flex flex-col gap-4"
    >
      <div className="flex items-center gap-2 justify-center">
        <Users className="w-4 h-4 text-emerald-400" />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-emerald-400">
          {N.t('relais_titre')}
        </h3>
      </div>
      <p className="text-[10px] text-muted-foreground text-center leading-snug">
        {N.t('relais_desc')}
      </p>

      {chargement && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Les invitations d'abord : elles attendent une reponse. */}
      {invitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[9px] tracking-widest text-emerald-400">
            {N.t('relais_invitations')}
          </span>
          {invitations.map(e => (
            <div key={e.id} className="flex items-center gap-2 p-3 rounded-2xl
                                       border border-emerald-400/30 bg-emerald-400/[0.06]">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs tracking-wide truncate text-foreground">{e.nom}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {e.membres.map(m => m.nom).join(' · ')}
                </p>
              </div>
              <button onClick={() => repondreA(e.id, true)} aria-label="accepter"
                      className="shrink-0 p-2 rounded-xl bg-emerald-400 text-background">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => repondreA(e.id, false)} aria-label="refuser"
                      className="shrink-0 p-2 rounded-xl bg-white/5 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {equipes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[9px] tracking-widest text-muted-foreground">
            {N.t('relais_mes_equipes')}
          </span>
          {equipes.map(e => <Equipe key={e.id} e={e} onChange={recharger}
                                    onCourir={id => entrerSurLaPiste(
                                      { genre: 'relais', equipe: id })} />)}
        </div>
      )}

      {/* Les deux facons de courir contre quelqu'un plutot que contre le
          chrono : d'autres equipes maintenant, ou les meilleures courses deja
          enregistrees. Elles ne s'excluent pas — une confrontation peut
          melanger les deux. */}
      {pretes.length > 0 && <Confrontation equipes={pretes} />}
      {pretes.length > 0 && <Fantomes equipes={pretes} />}

      {/* Creer une equipe. Le nom se choisit une fois : la composition le
          possede, et changer un coequipier change d'equipe. */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/8">
        <span className="text-[9px] tracking-widest text-muted-foreground">
          {N.t('relais_creer')}
        </span>
        <input
          value={nom} onChange={e => setNom(e.target.value)} maxLength={24}
          placeholder={N.t('relais_nom_equipe')}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm
                     text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-emerald-400/50"
        />
        {coequipiers.map((c, i) => (
          <input
            key={i} value={c} maxLength={20}
            onChange={e => setCoequipiers(v => v.map((x, j) => j === i ? e.target.value : x))}
            placeholder={N.t('relais_coequipier', { n: i + 2 })}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm
                       text-foreground placeholder:text-muted-foreground
                       focus:outline-none focus:border-emerald-400/50"
          />
        ))}
        <button onClick={creer} disabled={occupe}
          className="w-full py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background bg-emerald-400 hover:bg-emerald-400/90
                     disabled:opacity-40 flex items-center justify-center gap-2">
          {occupe && <Loader2 className="w-4 h-4 animate-spin" />}
          {N.t('relais_inviter')}
        </button>
        {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
      </div>

      {classement.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/8">
          <span className="flex items-center gap-1.5 text-[9px] tracking-widest text-muted-foreground">
            <Trophy className="w-3 h-3" /> {N.t('relais_classement')}
          </span>
          {classement.slice(0, 10).map(l => (
            <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                                        border border-white/6 bg-black/20">
              <span className="font-mono text-[10px] w-5 text-muted-foreground tabular-nums">
                {l.rang}.
              </span>
              <span className="flex-1 text-[11px] font-bold tracking-wide truncate text-foreground">
                {l.nom}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {chrono(l.meilleur_ms)}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
