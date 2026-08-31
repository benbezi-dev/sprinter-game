import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { Loader2, Radio, Send, Video, VideoOff, Trophy } from 'lucide-react';
import {
  Salle, type EtatSalle, type JoueurSalle, type Presentation, type MessageChat,
} from '@/game/live';
import { poserSalon, salonCourant, quitterSalon } from '@/game/salon-direct';
import { Review, type EtatReview } from '@/game/review';
import { lancerPresentation } from '@/game/presentation-directe';
import { ReviewVideo } from './ReviewVideo';
import type { Partant } from '@/game/championnats';

/**
 * Une course de championnat, courue en direct.
 *
 * C'est la meme salle que le duel en direct — meme Durable Object, meme
 * horloge, meme arbitre — avec trois differences qui sont exactement ce qui
 * fait une serie de championnat plutot qu'une course entre amis :
 *
 *   1. le code du salon ne se choisit pas, il se calcule. Huit personnes
 *      doivent tomber sur la meme piste sans se donner rendez-vous ;
 *   2. la taille de la piste est l'effectif reel de la course, pas un reglage ;
 *   3. le resultat s'ecrit tout seul au championnat, depuis la salle, parce que
 *      c'est le seul endroit ou les huit chronos existent ensemble.
 *
 * S'y ajoutent le chat, ouvert du debut a la fin, et la webcam incrustee dans
 * le canvas deja filme par `Review` — de quoi produire une video de course
 * commentee, avec le visage de celui qui court, sans qu'aucun flux video ne
 * transite entre les joueurs : chacun enregistre sa propre vue, chez lui.
 */

const OR = '#F8CD4A';
/** L'epreuve d'un championnat. Le 100 m, et il n'y a rien a choisir. */
const EPREUVE = '100';

type Etape = 'salon' | 'presentation' | 'partie' | 'fini';

/** Une course de championnat est-elle deja en cours sous ce code ? */
export function courseChampEnCours(code: string): boolean {
  const s = salonCourant();
  return !!s && s.code === code.toUpperCase();
}

export function CourseChampionnat({ edition, phase, phaseNom, course, partants, code, onQuitter }: {
  edition: string;
  phase: string;
  phaseNom: string;
  course: number;
  partants: Partant[];
  code: string;
  onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const [etape, setEtape] = useState<Etape>('salon');
  const [salon, setSalon] = useState<EtatSalle | null>(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState('');
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [saisie, setSaisie] = useState('');
  const [camera, setCamera] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [review, setReview] = useState<EtatReview>({
    phase: 'inactif', url: null, fichier: '', reste: 0, taille: 0,
  });

  const salle = useRef<Salle | null>(null);
  const film = useRef<Review | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const boucle = useRef(0);
  const cibleDepart = useRef<number | null>(null);
  const presEnCours = useRef(false);
  const monte = useRef(false);

  const taille = Math.max(2, Math.min(8, partants.length));

  /* ------------------------------------------------------------ la piste */

  const lesAutres = () => {
    const s = salle.current;
    const moi = s?.moi || '';
    return (s?.dernierEtat?.joueurs || [])
      .filter(j => j.id !== moi)
      .map(j => ({ id: j.id, nom: j.nom, couloir: j.couloir || 0 }));
  };

  const monterLaPiste = () => {
    if (SprinterApp.G.state === 'count' || SprinterApp.G.state === 'race') return;
    SprinterApp.startLive([EPREUVE], {
      levelIdx: 4, adversaire: salle.current?.adversaire || '', autres: lesAutres(),
    });
  };

  const lancerCourse = () => {
    const dans = Math.max(0, (cibleDepart.current ?? Date.now()) - Date.now());
    if (SprinterApp.G.state !== 'count' && SprinterApp.G.state !== 'race') {
      SprinterApp.startLive([EPREUVE], {
        levelIdx: 4, adversaire: salle.current?.adversaire || '', autres: lesAutres(),
      });
    }
    SprinterApp.liveDepart(dans);
    setEtape('partie');

    // On filme le canvas du jeu — celui-la meme ou la webcam vient s'incruster.
    if (!film.current) film.current = new Review(setReview);
    const f = film.current;
    setTimeout(() => f.demarrer(SprinterApp.G.cv || null), Math.max(0, dans - 300));
  };

  /* ------------------------------------------------------------ la salle */

  const ecouteurs = () => ({
    onEtat: (e: EtatSalle) => {
      setSalon(e);
      setEtape(p => (p === 'presentation' || p === 'partie' || p === 'fini') ? p : 'salon');
    },
    onPresentation: (p: Presentation) => {
      presEnCours.current = true;
      setEtape('presentation');
      monterLaPiste();
      lancerPresentation({
        presentation: p,
        moi: salle.current?.moi || '',
        // Pas de micro ici : une serie a huit passe par huit liaisons audio,
        // et la voix de la salle en direct est faite pour une paire. Le
        // commentaire d'une course de championnat se fait au chat.
        onTour: () => { },
        onFini: () => { lancerPresentation(null); finPresentation(); },
        etatVoix: () => ({ micro: false, refuse: false, ouvert: false, connecte: false }),
      });
    },
    onDepart: (dansMs: number) => {
      cibleDepart.current = Date.now() + dansMs;
      if (!presEnCours.current) lancerCourse();
    },
    onPos: (id: string, d: number) => SprinterApp.liveDistDe(id, d),
    onFini: (_n: string, ms: number) => { SprinterApp.G.liveFin = ms; },
    onResultat: (r: any) => {
      SprinterApp.G.liveResultat = { ...r, moi: salle.current?.moi || '' };
      SprinterApp.G.liveOn = true;
      presEnCours.current = false;
      film.current?.arreter();
      setResultat(r);
      setEtape('fini');
    },
    onChat: (m: MessageChat) => setMessages(v => [...v.slice(-60), m]),
    onSorti: () => setErreur(N.t('live_gone')),
    onFerme: () => setEtape(p => (p === 'salon' ? p : p)),
  });

  useEffect(() => {
    if (monte.current) return;
    monte.current = true;

    // Une salle deja ouverte se reprend telle quelle : cet ecran disparait au
    // coup de pistolet — le jeu prend la piste — et revient a l'arrivee. La
    // course, elle, n'a pas bouge.
    const dejaLa = salonCourant();
    if (dejaLa && dejaLa.code === code.toUpperCase()) {
      salle.current = dejaLa;
      dejaLa.ecouter(ecouteurs());
      if (dejaLa.dernierEtat) setSalon(dejaLa.dernierEtat);
      brancherSalle({
        position: (d: number) => dejaLa.position(d),
        fini: (ms: number) => dejaLa.fini(ms),
      });
      if (SprinterApp.G.liveResultat) { setResultat(SprinterApp.G.liveResultat); setEtape('fini'); }
      return;
    }

    const s = new Salle(code, ecouteurs());
    salle.current = s;
    poserSalon(s);
    brancherSalle({
      position: (d: number) => s.position(d),
      fini: (ms: number) => s.fini(ms),
    });
    // Le contexte de championnat part avec la connexion : la salle saura ou
    // ecrire son resultat sans que personne n'ait a le lui redire ensuite.
    s.connecter([EPREUVE], 4, taille, { edition, phase, course });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rien n'est ferme au demontage : la salle appartient a la course, pas a
  // l'ecran. La camera, elle, se rend — un voyant allume pendant qu'on regarde
  // autre chose est un probleme d'un autre ordre.
  useEffect(() => () => { cancelAnimationFrame(boucle.current); }, []);

  /* ----------------------------------------------------- la webcam en PIP */

  const dessiner = () => {
    boucle.current = requestAnimationFrame(dessiner);
    const cv = SprinterApp.G.cv as HTMLCanvasElement | null;
    const v = video.current;
    if (!cv || !v || v.readyState < 2) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    // L'incrustation se dessine SUR le canvas du jeu, apres lui : c'est ce qui
    // la fait entrer dans la video sans toucher a l'enregistreur, qui filme ce
    // canvas et ne sait rien de ce qu'on y ajoute.
    const l = Math.round(cv.width * 0.2);
    const h = Math.round(l * 0.75);
    const x = cv.width - l - Math.round(cv.width * 0.02);
    const y = Math.round(cv.width * 0.02);
    ctx.save();
    ctx.drawImage(v, x, y, l, h);
    ctx.strokeStyle = 'rgba(248,205,74,0.75)';
    ctx.lineWidth = Math.max(1, Math.round(cv.width * 0.003));
    ctx.strokeRect(x, y, l, h);
    ctx.restore();
  };

  const basculerCamera = async () => {
    if (camera) {
      cancelAnimationFrame(boucle.current);
      flux.current?.getTracks().forEach(t => t.stop());
      flux.current = null; video.current = null;
      setCamera(false);
      return;
    }
    try {
      const f = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }, audio: false,
      });
      const v = document.createElement('video');
      v.srcObject = f; v.muted = true; (v as any).playsInline = true;
      await v.play();
      flux.current = f; video.current = v;
      setCamera(true);
      dessiner();
    } catch {
      setErreur(N.t('champ_camera_refus'));
    }
  };

  /* ---------------------------------------------------------------- gestes */

  const finPresentation = () => {
    if (!presEnCours.current) return;
    presEnCours.current = false;
    lancerCourse();
  };

  const basculerPret = () => {
    const v = !pret; setPret(v); salle.current?.pret(v);
  };

  const envoyer = () => {
    const t = saisie.trim();
    if (!t) return;
    salle.current?.chat(t);
    setSaisie('');
  };

  const partir = () => {
    quitterSalon();
    salle.current = null;
    brancherSalle(null);
    lancerPresentation(null);
    cancelAnimationFrame(boucle.current);
    flux.current?.getTracks().forEach(t => t.stop());
    flux.current = null; video.current = null;
    if (SprinterApp.G.state === 'count' && SprinterApp.G.countT <= -90) SprinterApp.goHome();
    onQuitter();
  };

  const joueurs: JoueurSalle[] = salon?.joueurs || [];
  const complet = joueurs.length >= taille;
  const moi = salle.current?.moi || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card/70 backdrop-blur-xl border rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-3"
      style={{ borderColor: 'rgba(248,205,74,0.28)' }}
    >
      <div className="flex items-center gap-2 justify-center">
        <Radio className="w-3.5 h-3.5 animate-pulse" style={{ color: OR }} />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest" style={{ color: OR }}>
          {phaseNom.toUpperCase()} {course > 1 ? course : ''} · {N.t('champ_course_directe')}
        </h3>
      </div>

      {/* La video de la course, quand elle est prete. */}
      {(etape === 'fini' || review.phase === 'prete' || review.phase === 'expiree') && (
        <ReviewVideo etat={review} onTelecharger={() => film.current?.telecharger()} />
      )}

      {etape === 'fini' && resultat && (
        <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl border border-primary/35 bg-primary/[0.07]">
          <div className="flex items-center gap-2 justify-center">
            <Trophy className="w-3.5 h-3.5" style={{ color: OR }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: OR }}>
              {N.t('champ_course_finie')}
            </span>
          </div>
          {(resultat.classement || []).map((r: any) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="font-mono text-[10px] w-4 text-primary tabular-nums">{r.place}</span>
              <span className={`text-[11px] flex-1 truncate ${r.id === moi ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                {r.nom}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {r.abandon ? '—' : (r.ms / 1000).toFixed(3) + ' s'}
              </span>
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground text-center leading-snug">
            {N.t('champ_course_ecrite')}
          </p>
        </div>
      )}

      {/* La grille : qui est arrive sur la piste, et qui manque encore. */}
      {etape !== 'fini' && (
        <div className="flex flex-col gap-1.5">
          {partants.map(p => {
            const la = joueurs.find(j => j.nom.toLowerCase() === p.nom.toLowerCase());
            return (
              <div key={p.name_key}
                   className={`flex items-center justify-between px-3 py-1.5 rounded-xl border
                     ${la?.pret ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
                       : la ? 'border-white/12 bg-black/25'
                       : 'border-dashed border-white/10 bg-black/15'}`}>
                <span className="text-[11px] font-bold tracking-wide text-foreground truncate">
                  {p.nom}
                </span>
                <span className={`text-[9px] font-bold tracking-widest
                  ${la?.pret ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {N.t(la?.pret ? 'live_ready' : la ? 'live_notready' : 'champ_absent')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {etape === 'salon' && (
        <button onClick={basculerPret} disabled={!complet}
          className={`w-full py-3 rounded-xl font-black font-display tracking-widest transition-colors
            disabled:opacity-40 disabled:pointer-events-none
            ${pret ? 'bg-primary/20 text-primary border border-primary/40'
                   : 'bg-primary text-background hover:bg-primary/90'}`}>
          {N.t(pret ? 'live_unready' : 'live_go')}
        </button>
      )}
      {etape === 'salon' && !complet && (
        <p className="text-[9px] text-muted-foreground text-center -mt-1">
          {N.t('champ_attente', { n: taille - joueurs.length })}
        </p>
      )}

      {etape === 'presentation' && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* La webcam. Elle ne part chez personne : elle s'incruste dans le canvas
          du jeu, que l'enregistreur filme deja. */}
      <button onClick={basculerCamera}
        className="self-center flex items-center gap-1.5 text-[9px] font-bold tracking-widest
                   text-muted-foreground hover:text-foreground transition-colors">
        {camera ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5" />}
        {N.t(camera ? 'champ_camera_on' : 'champ_camera_off')}
      </button>

      {/* Le chat, du debut a la fin. */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-white/8">
        <span className="text-[9px] font-bold tracking-widest text-muted-foreground">
          {N.t('champ_chat_titre')}
        </span>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={m.au + '-' + i} className="flex items-baseline gap-1.5">
              <span className={`text-[10px] font-bold shrink-0 ${m.id === moi ? 'text-primary' : 'text-emerald-300'}`}>
                {m.nom}
              </span>
              <span className="text-[10px] text-muted-foreground break-words">{m.texte}</span>
            </div>
          ))}
          {!messages.length && (
            <span className="text-[10px] text-muted-foreground/60">{N.t('champ_chat_vide')}</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={saisie}
            onChange={e => setSaisie(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') envoyer(); }}
            placeholder={N.t('champ_chat_placeholder')}
            maxLength={200}
            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5
                       text-[11px] text-foreground placeholder:text-muted-foreground
                       focus:outline-none focus:border-primary/50"
          />
          <button onClick={envoyer} disabled={!saisie.trim()}
            className="shrink-0 px-3 rounded-xl text-background bg-primary disabled:opacity-30">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {erreur && <p className="text-center text-[10px] text-destructive">{erreur}</p>}

      <button onClick={partir}
        className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
        {N.t(etape === 'fini' ? 'champ_retour' : 'live_leave')}
      </button>
    </motion.div>
  );
}
