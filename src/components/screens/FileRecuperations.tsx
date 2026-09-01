import React, { useState } from 'react';
import {
  LifeBuoy, Loader2, Check, X, Instagram, KeyRound, ChevronDown,
} from 'lucide-react';
import {
  lireRecuperations, trancherRecuperation, type DemandeRecup,
} from '@/game/stats';

/**
 * Les demandes de recuperation, et de quoi trancher.
 *
 * Le tableau de bord s'ouvre avec la cle de lecture ; cette section-ci demande
 * l'autre, celle d'administration. Accepter une demande donne a quelqu'un les
 * clefs d'un nom — ce n'est pas lire un compteur, et cela ne se fait pas avec
 * la meme cle.
 *
 * Elle n'est pas rangee dans le navigateur, contrairement a celle du tableau :
 * on la tape pour s'en servir, elle vit dans cet onglet, et elle repart avec
 * lui. Une cle qui ouvre `/duels/recalculer` et les acces au canal de test n'a
 * rien a faire dans un `localStorage` que la moindre faille d'affichage
 * donnerait au passage.
 *
 * Ce que la section montre pour chaque demande n'est pas decoratif : c'est
 * exactement ce qui permet de decider. Le compte Instagram attendu et le mot
 * de passage se lisent cote a cote — l'un dit d'ou le message doit venir,
 * l'autre ce qu'il doit contenir — et l'anciennete du nom, ses courses et sa
 * derniere apparition disent si le demandeur decrit une vie de joueur ou
 * recite ce que le TOP 500 affiche.
 */
export function FileRecuperations() {
  const [cle, setCle] = useState('');
  const [saisie, setSaisie] = useState('');
  const [demandes, setDemandes] = useState<DemandeRecup[] | null>(null);
  const [etat, setEtat] = useState<'ferme' | 'charge' | 'ouvert' | 'refuse' | 'panne'>('ferme');
  const [toutes, setToutes] = useState(false);
  const [occupe, setOccupe] = useState(0);

  const charger = async (c: string, tout = toutes) => {
    setEtat('charge');
    const r = await lireRecuperations(c, tout);
    if (r.etat === 'ok') { setDemandes(r.demandes); setCle(c); setEtat('ouvert'); }
    else setEtat(r.etat === 'refuse' ? 'refuse' : 'panne');
  };

  const trancher = async (id: number, accepte: boolean) => {
    setOccupe(id);
    const ok = await trancherRecuperation(cle, id, accepte);
    setOccupe(0);
    if (ok) await charger(cle);
  };

  const quand = (ms: number | null) =>
    ms ? new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';

  if (etat === 'ferme' || etat === 'refuse' || etat === 'panne') {
    return (
      <section className="border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[#f8cd4a]">
          <LifeBuoy className="w-4 h-4" />
          <h2 className="text-[10px] font-bold tracking-widest uppercase opacity-80">
            Récupérations de nom
          </h2>
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Accepter une demande donne à quelqu'un les clefs d'un nom. Cela demande
          la clé d'administration, pas celle du tableau — et elle n'est pas
          conservée : elle repart avec cet onglet.
        </p>
        <div className="flex gap-2">
          <input
            value={saisie}
            onChange={e => setSaisie(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') charger(saisie.trim()); }}
            placeholder="CLÉ D'ADMINISTRATION"
            type="password"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2
                       text-xs font-mono text-white placeholder:font-sans placeholder:text-white/25
                       focus:outline-none focus:border-white/30"
          />
          <button
            onClick={() => charger(saisie.trim())}
            disabled={!saisie.trim()}
            className="shrink-0 px-4 rounded-xl font-bold tracking-wide text-xs text-black
                       bg-white/90 hover:bg-white disabled:opacity-30 transition-colors
                       flex items-center gap-2"
          >
            <KeyRound className="w-3.5 h-3.5" /> OUVRIR
          </button>
        </div>
        {etat === 'refuse' && <p className="text-[11px] text-red-400">Cette clé n'ouvre pas la file.</p>}
        {etat === 'panne' && <p className="text-[11px] text-red-400">Serveur injoignable.</p>}
      </section>
    );
  }

  const enAttente = (demandes || []).filter(d => d.etat === 'attente');

  return (
    <section className="border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#f8cd4a]">
          <LifeBuoy className="w-4 h-4" />
          <h2 className="text-[10px] font-bold tracking-widest uppercase opacity-80">
            Récupérations de nom
          </h2>
          <span className="text-[10px] text-white/40 font-mono">
            {enAttente.length} en attente
          </span>
        </div>
        <button
          onClick={() => { const t = !toutes; setToutes(t); charger(cle, t); }}
          className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${toutes ? 'rotate-180' : ''}`} />
          {toutes ? 'seulement en attente' : 'voir les demandes tranchées'}
        </button>
      </div>

      {etat === 'charge' && <Loader2 className="w-4 h-4 animate-spin text-white/30 self-center my-4" />}

      {demandes && demandes.length === 0 && (
        <p className="text-[11px] text-white/40">Aucune demande.</p>
      )}

      <div className="flex flex-col gap-2">
        {(demandes || []).map(d => (
          <div key={d.id}
               className={`rounded-xl border p-3 flex flex-col gap-2 ${
                 d.etat === 'attente' ? 'border-white/15 bg-white/[0.04]' : 'border-white/5 bg-white/[0.015]'}`}>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-sm text-white">{d.nom}</span>
              <span className="text-[10px] font-mono text-white/35">
                appareil {d.appareil}… · demandé le {quand(d.cree_le)}
              </span>
            </div>

            {/* Les deux moities de la preuve, cote a cote. */}
            {d.insta && d.phrase && (
              <div className="rounded-lg bg-black/40 border border-[#f8cd4a]/25 p-2.5 flex flex-col gap-1">
                <span className="text-[9px] font-bold tracking-widest text-[#f8cd4a] flex items-center gap-1.5">
                  <Instagram className="w-3 h-3" /> UN MESSAGE PRIVÉ À @{d.compte}
                </span>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-white/70">
                    doit venir de <span className="font-bold text-white">@{d.insta}</span>
                  </span>
                  <span className="font-mono font-black text-sm tracking-[0.1em] text-[#f8cd4a]">
                    {d.phrase}
                  </span>
                </div>
              </div>
            )}
            {!d.insta && (
              <p className="text-[10px] text-white/35 leading-snug">
                Aucun compte Instagram lié à ce nom : rien ne prouve la demande, elle se
                tranche sur ce que le joueur raconte.
              </p>
            )}

            {d.indice && (
              <p className="text-[11px] text-white/60 italic leading-snug">« {d.indice} »</p>
            )}

            <div className="flex gap-3 text-[10px] text-white/35 font-mono flex-wrap">
              <span>nom créé le {quand(d.nom_cree_le)}</span>
              <span>{d.courses} courses</span>
              <span>{d.appareils} appareil{d.appareils > 1 ? 's' : ''}</span>
              <span>vu {quand(d.derniere_course)}</span>
            </div>

            {d.etat === 'attente' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => trancher(d.id, true)}
                  disabled={occupe === d.id}
                  className="flex-1 py-2 rounded-lg font-bold tracking-wide text-[11px] text-black
                             bg-[#f8cd4a] hover:bg-[#ffd75e] disabled:opacity-30 transition-colors
                             flex items-center justify-center gap-1.5"
                >
                  {occupe === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  ACCEPTER
                </button>
                <button
                  onClick={() => trancher(d.id, false)}
                  disabled={occupe === d.id}
                  className="flex-1 py-2 rounded-lg font-bold tracking-wide text-[11px] text-white/70
                             border border-white/15 hover:bg-white/5 disabled:opacity-30
                             transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-3 h-3" /> REFUSER
                </button>
              </div>
            ) : (
              <span className={`text-[10px] font-bold tracking-widest ${
                d.etat === 'accepte' ? 'text-[#f8cd4a]' : 'text-white/30'}`}>
                {d.etat === 'accepte' ? 'ACCEPTÉE' : 'REFUSÉE'} le {quand(d.tranche_le)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
