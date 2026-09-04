import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore, setLang, languesDisponibles } from '@/game/engine';
import { Globe } from 'lucide-react';

/* Le selecteur de langue de l'accueil. Deux langues tenaient dans un
   bouton bascule ; seize demandent une liste. Le bouton garde la place et
   l'allure de l'ancien, et n'ouvre le panneau qu'au clic. */
export function LanguePicker() {
  // Le changement de langue passe par gameStore : on s'y abonne pour que le
  // code affiche sur le bouton suive la langue reellement en place.
  useGameStore();
  const N = SprinterApp.N;
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  // Un clic ailleurs referme. Le panneau recouvre le titre : le laisser
  // ouvert derriere un doigt qui vise autre chose serait une gene.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  const langues = languesDisponibles();
  const courante = N.getLang();

  return (
    <div ref={boite} className="relative">
      <button
        onClick={() => setOuvert(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={N.nomLangue(courante)}
        className="bg-card/80 backdrop-blur-md border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-1.5 md:gap-2 hover:bg-white/10 transition-colors"
      >
        <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
        <span className="font-bold text-xs md:text-sm text-foreground/90">
          {courante.toUpperCase()}
        </span>
      </button>

      {ouvert && (
        <div
          role="listbox"
          className="absolute z-50 mt-2 start-0 w-56 max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-card/95 backdrop-blur-md p-1 shadow-xl"
        >
          {langues.map((l: { code: string; nom: string }) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === courante}
              onClick={() => { setOuvert(false); void setLang(l.code); }}
              className={`w-full text-start px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 hover:bg-white/10 transition-colors ${
                l.code === courante ? 'text-primary font-bold' : 'text-foreground/90'
              }`}
            >
              <span>{l.nom}</span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {l.code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
