import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { empiler } from '@/game/retour';
import {
  verifierMiseAJour, lancerMiseAJour, plusTard, type Issue,
} from '@/game/mise-a-jour/service';
import { portsCapacitor, installerLaMiseAJourTelechargee } from '@/game/mise-a-jour/capacitor';
import { DELAI_MS, REPORT_MS, REVERIFIER_MS, SIMULATION } from '@/game/mise-a-jour/config';

/**
 * La mise a jour au lancement (et au retour au premier plan).
 *
 * Rien ne bloque le demarrage : la verification part en tache de fond, bornee
 * a quelques secondes, et le jeu tourne pendant ce temps. Elle ne montre
 * quelque chose que si le serveur repond qu'une version plus recente existe.
 *
 * - optionnelle : « Mettre a jour » ou « Plus tard » (24 h de repit pour cette
 *   version) ;
 * - obligatoire : ni croix, ni clic a cote, ni retour Android ; le seul bouton
 *   ouvre le store ou lance la mise a jour Play.
 *
 * Jamais par-dessus une course : si la reponse arrive en pleine course, la
 * modale attend la ligne d'arrivee.
 *
 * Charge a la demande, et seulement dans l'application installee (ou en
 * developpement) : voir App.tsx. Le site n'en embarque pas une ligne.
 */
const EN_COURSE = new Set(['cut', 'count', 'race']);
const enCourse = () => EN_COURSE.has(SprinterApp.G?.state);

type Affiche = Extract<Issue, { type: 'modale' }> | { type: 'telechargee' } | null;

export default function MiseAJour() {
  const { N } = SprinterApp;
  const [enAttente, setEnAttente] = useState<Affiche>(null);
  const [affiche, setAffiche] = useState<Affiche>(null);
  const derniere = useRef(0);
  const enCoursDeVerif = useRef(false);

  // Verifier au lancement, puis au retour au premier plan (au plus toutes les 30 min).
  useEffect(() => {
    let vivant = true;
    const verifier = async () => {
      if (enCoursDeVerif.current) return;
      enCoursDeVerif.current = true;
      derniere.current = Date.now();
      const issue = await verifierMiseAJour(portsCapacitor, {
        delaiMs: DELAI_MS,
        reportMs: REPORT_MS,
        simulation: SIMULATION,
        surTelechargee: () => { if (vivant) setEnAttente({ type: 'telechargee' }); },
      });
      enCoursDeVerif.current = false;
      if (vivant && issue.type === 'modale') setEnAttente(issue);
    };
    void verifier();

    let retirer: (() => void) | null = null;
    if (portsCapacitor.plateforme() !== 'web') {
      import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && Date.now() - derniere.current >= REVERIFIER_MS) void verifier();
      })).then(h => { if (vivant) retirer = () => void h.remove(); else void h.remove(); })
        .catch(() => { /* sans l'ecoute, la verification du lancement suffit */ });
    }
    return () => { vivant = false; retirer?.(); };
  }, []);

  // Ce qui attend ne passe a l'ecran qu'en dehors d'une course.
  useEffect(() => {
    if (!enAttente) return;
    const poser = () => { if (!enCourse()) { setAffiche(enAttente); setEnAttente(null); return true; } return false; };
    if (poser()) return;
    const t = setInterval(() => { if (poser()) clearInterval(t); }, 1500);
    return () => clearInterval(t);
  }, [enAttente]);

  const bloquante = affiche?.type === 'modale' && affiche.etat === 'obligatoire';

  // Bloquante : le retour du systeme (bouton Android, geste de bord iOS) ne la ferme pas.
  useEffect(() => {
    if (!bloquante) return;
    let retirerPile = () => {};
    const garder = () => { retirerPile = empiler(garder); };
    garder();
    let retirerBouton: (() => void) | null = null;
    let vivant = true;
    if (portsCapacitor.plateforme() === 'android') {
      // Une ecoute de backButton suffit a remplacer le comportement par defaut
      // (revenir ou quitter) : on n'y fait rien.
      import('@capacitor/app').then(({ App }) => App.addListener('backButton', () => {}))
        .then(h => { if (vivant) retirerBouton = () => void h.remove(); else void h.remove(); })
        .catch(() => {});
    }
    return () => { vivant = false; retirerPile(); retirerBouton?.(); };
  }, [bloquante]);

  if (!affiche) return null;

  if (affiche.type === 'telechargee') {
    return (
      <Cadre titre={N.t('maj_prete_titre')} texte={N.t('maj_prete_texte')} icone={<RefreshCw className="w-5 h-5 text-primary" />}>
        <Bouton principal onClick={() => { void installerLaMiseAJourTelechargee().catch(() => setAffiche(null)); }}>
          {N.t('maj_redemarrer')}
        </Bouton>
        <Bouton onClick={() => setAffiche(null)}>{N.t('maj_plus_tard')}</Bouton>
      </Cadre>
    );
  }

  const { cfg, etat } = affiche;
  return (
    <Cadre
      titre={N.t(bloquante ? 'maj_obligatoire_titre' : 'maj_titre')}
      texte={N.t(bloquante ? 'maj_obligatoire_texte' : 'maj_texte')}
      icone={<Download className="w-5 h-5 text-primary" />}
    >
      <Bouton principal onClick={() => { void lancerMiseAJour(portsCapacitor, cfg, etat); }}>
        {N.t('maj_bouton')}
      </Bouton>
      {!bloquante && (
        <Bouton onClick={() => { plusTard(portsCapacitor, cfg, REPORT_MS); setAffiche(null); }}>
          {N.t('maj_plus_tard')}
        </Bouton>
      )}
    </Cadre>
  );
}

function Cadre({ titre, texte, icone, children }: {
  titre: string; texte: string; icone: ReactNode; children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
         role="alertdialog" aria-modal="true" aria-labelledby="maj-titre" aria-describedby="maj-texte">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {icone}
          <h2 id="maj-titre" className="text-xs font-bold tracking-widest text-primary">{titre}</h2>
        </div>
        <p id="maj-texte" className="text-sm text-foreground leading-snug">{texte}</p>
        <div className="flex flex-col gap-2 pt-1">{children}</div>
      </div>
    </div>
  );
}

function Bouton({ principal, onClick, children }: { principal?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={principal
        ? 'px-4 py-2.5 rounded-xl font-bold tracking-wide text-xs text-background bg-primary hover:bg-primary/90 transition-colors'
        : 'px-4 py-2.5 rounded-xl font-bold tracking-wide text-xs text-muted-foreground bg-white/5 hover:bg-white/10 transition-colors'}
    >
      {children}
    </button>
  );
}
