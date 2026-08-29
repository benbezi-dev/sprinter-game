import React, { useState } from 'react';
import { Loader2, Swords, Copy, Check } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { ouvrirConfrontation, type EquipeRelais } from '@/game/relais';
import { entrerSurLaPiste } from '@/game/piste';

/**
 * Monter une confrontation.
 *
 * Une equipe seule court contre le chrono ; deux a huit courent l'une contre
 * l'autre. Le code s'ouvre puis se partage, comme une piste de duel — c'est la
 * seule facon de reunir huit equipes sans annuaire, sans invitation a stocker
 * et sans que personne ait a chercher qui est connecte.
 *
 * Le nombre de couloirs se fixe a l'ouverture et par le premier arrive. Le
 * laisser ouvert jusqu'au depart obligerait a decider, a chaque nouvelle
 * equipe, si elle rentre ou non — et une equipe refusee apres avoir tape le
 * bon code ne comprendrait pas pourquoi.
 */

const CHOIX = [2, 3, 4, 6, 8];

export function Confrontation({ equipes }: { equipes: EquipeRelais[] }) {
  const { N } = SprinterApp;
  const [equipe, setEquipe] = useState(equipes[0]?.id || '');
  const [places, setPlaces] = useState(4);
  const [saisie, setSaisie] = useState('');
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState('');

  const mienne = equipes.find(e => e.id === equipe) || equipes[0] || null;

  const ouvrir = async () => {
    if (!mienne) return;
    setOccupe(true); setErreur('');
    const r = await ouvrirConfrontation();
    setOccupe(false);
    if (!r || r.error || !r.id) { setErreur(N.t('challenge_net')); return; }
    setCode(r.id);
  };

  const entrer = (c: string) => {
    if (!mienne) return;
    entrerSurLaPiste({
      genre: 'confrontation', code: c, equipe: mienne.id,
      max: places, fantomes: [],
    });
  };

  const rejoindre = () => {
    const c = saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) { setErreur(N.t('conf_code_court')); return; }
    entrer(c);
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refuse : le code reste lisible */ }
  };

  if (!equipes.length) return null;

  return (
    <div className="flex flex-col gap-2.5 pt-1 border-t border-white/8">
      <span className="flex items-center gap-1.5 text-[9px] tracking-widest text-primary">
        <Swords className="w-3 h-3" /> {N.t('conf_titre')}
      </span>
      <p className="text-[10px] text-muted-foreground leading-snug">
        {N.t('conf_desc')}
      </p>

      {/* Avec quelle equipe. On ne le demande que s'il y a un choix a faire. */}
      {equipes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {equipes.map(e => (
            <button key={e.id} onClick={() => setEquipe(e.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide border
                ${e.id === (mienne?.id) ? 'border-primary/50 bg-primary/15 text-primary'
                                        : 'border-white/10 bg-black/25 text-muted-foreground'}`}>
              {e.nom}
            </button>
          ))}
        </div>
      )}

      {code ? (
        <div className="flex flex-col gap-2 p-3 rounded-2xl border border-primary/30
                        bg-primary/[0.06]">
          <span className="text-[9px] tracking-widest text-muted-foreground text-center">
            {N.t('conf_partage')}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex-1 font-mono font-black text-2xl tracking-[0.3em]
                             text-center text-primary tabular-nums">
              {code}
            </span>
            <button onClick={copier} aria-label={N.t('conf_partage')}
                    className="shrink-0 p-2 rounded-xl bg-white/5 text-muted-foreground">
              {copie ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => entrer(code)}
            className="w-full py-2.5 rounded-xl font-black font-display tracking-widest
                       text-background bg-primary text-sm">
            {N.t('relais_courir')}
          </button>
        </div>
      ) : (
        <>
          {/* Combien de couloirs. Le chiffre est une decision de format, pas un
              reglage : a deux on se surveille, a huit on ne voit plus que le
              temoin d'a cote. */}
          <div className="flex items-center gap-1.5">
            {CHOIX.map(n => (
              <button key={n} onClick={() => setPlaces(n)}
                className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold border
                  ${n === places ? 'border-primary/50 bg-primary/15 text-primary'
                                 : 'border-white/10 bg-black/25 text-muted-foreground'}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-center text-muted-foreground">
            {N.t('conf_places', { n: String(places) })}
          </p>
          <button onClick={ouvrir} disabled={occupe || !mienne}
            className="w-full py-2.5 rounded-xl font-black font-display tracking-widest
                       text-background bg-primary hover:bg-primary/90 disabled:opacity-40
                       flex items-center justify-center gap-2">
            {occupe && <Loader2 className="w-4 h-4 animate-spin" />}
            {N.t('conf_ouvrir')}
          </button>

          <div className="flex items-center gap-2">
            <input
              value={saisie} maxLength={10}
              onChange={ev => setSaisie(ev.target.value.toUpperCase())}
              placeholder={N.t('conf_code')}
              className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2
                         font-mono text-sm tracking-[0.2em] text-center text-foreground
                         placeholder:text-muted-foreground placeholder:tracking-normal
                         focus:outline-none focus:border-primary/50"
            />
            <button onClick={rejoindre}
              className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-widest text-xs
                         text-background bg-white/80">
              {N.t('conf_rejoindre')}
            </button>
          </div>
        </>
      )}

      {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
    </div>
  );
}
