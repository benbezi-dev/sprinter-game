import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { motion } from 'framer-motion';
import { Radio, Loader2, Copy, Check, MessageCircle, MessageSquare, Share2 } from 'lucide-react';
import {
  Salle, ouvrirSalle, etatSalle, lienSalle, codeDirectUrl, nettoyerUrlDirect,
  type EtatSalle, type JoueurSalle, type Presentation,
} from '@/game/live';
import { whatsappUrl, smsUrl, canNativeShare, nativeShare } from '@/game/challenge';
import { getSavedName, saveName, type RaceKey } from '@/game/leaderboard';
import { Voix, type EtatVoix } from '@/game/voix';
import { Review, type EtatReview } from '@/game/review';
import { PresentationDirect } from './PresentationDirect';
import { ReviewVideo } from './ReviewVideo';

const RACE_KEYS: RaceKey[] = ['100', '200', '400'];

/** Le mot du vainqueur, apres la course. */
const MICRO_VAINQUEUR_MS = 5000;

type Etape = 'repos' | 'ouverture' | 'salon' | 'presentation' | 'partie' | 'review';

/**
 * Course en direct.
 *
 * Le defi differe est un duel a distance dans le temps : on pose un chrono,
 * l'autre le rejoue plus tard contre un fantome. Ici les deux courent en meme
 * temps, sans savoir qui gagnera — c'est la seule facon d'avoir vraiment le
 * coeur qui bat. En echange il faut que les deux soient la, maintenant, ce que
 * le salon organise.
 */
export function LivePanel() {
  const { N, RACES } = SprinterApp;

  const [etape, setEtape] = useState<Etape>('repos');
  const [code, setCode] = useState('');
  const [saisie, setSaisie] = useState('');
  const [epreuve, setEpreuve] = useState<RaceKey>('100');
  const [salon, setSalon] = useState<EtatSalle | null>(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);
  const [nom, setNom] = useState(getSavedName());

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [voixEtat, setVoixEtat] = useState<EtatVoix>({
    micro: false, refuse: false, ouvert: false, connecte: false,
  });
  const [review, setReview] = useState<EtatReview>({
    phase: 'inactif', url: null, fichier: '', reste: 0, taille: 0,
  });

  const salle = useRef<Salle | null>(null);
  const voix = useRef<Voix | null>(null);
  const film = useRef<Review | null>(null);
  const auto = useRef(false);
  /** Instant absolu du coup de pistolet, garde le temps de la presentation. */
  const cibleDepart = useRef<number | null>(null);
  const presEnCours = useRef(false);

  // Un lien ?direct=CODE tombe directement dans le salon.
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    const c = codeDirectUrl();
    if (c) { nettoyerUrlDirect(); setSaisie(c); rejoindre(c); }
    return () => {
      salle.current?.fermer();
      voix.current?.arreter();
      film.current?.jeter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ouvre la liaison audio. Un seul des deux emet l'offre — l'hote — sans quoi
   * les deux negociations se croisent et aucune n'aboutit.
   */
  const ouvrirVoix = () => {
    if (voix.current) return;
    const v = new Voix({
      envoyer: (type, charge) => salle.current?.signaler(type, charge),
      onEtat: setVoixEtat,
    });
    voix.current = v;
    v.demarrer(!!salle.current?.suisHote);
  };

  /**
   * Le pistolet. Appele soit a la fin de la presentation, soit tout de suite
   * si la salle n'en a pas annonce — le mode reste jouable contre un serveur
   * qui ne connaitrait pas encore la sequence.
   */
  const lancerCourse = () => {
    const dans = Math.max(0, (cibleDepart.current ?? Date.now()) - Date.now());
    const adverse = salle.current?.adversaire || '';
    if (SprinterApp.G.state !== 'count' && SprinterApp.G.state !== 'race') {
      SprinterApp.startLive([epreuve], { levelIdx: 4, adversaire: adverse });
    }
    SprinterApp.G.liveNom = adverse;
    SprinterApp.G.ghostName = adverse;
    SprinterApp.liveDepart(dans);
    setEtape('partie');

    // On ne filme que la course. Un peu avant le coup de pistolet, pour ne pas
    // perdre les premieres images le temps que l'encodeur demarre.
    if (!film.current) film.current = new Review(setReview);
    const f = film.current;
    setTimeout(() => f.demarrer(SprinterApp.G.cv || null), Math.max(0, dans - 300));
  };

  const ecouteurs = (monCode: string) => ({
    onEtat: (e: EtatSalle) => {
      setSalon(e);
      setEtape(p => (p === 'presentation' || p === 'partie' || p === 'review') ? p : 'salon');
    },
    onPresentation: (p: Presentation) => {
      setPresentation(p);
      presEnCours.current = true;
      setEtape('presentation');
      // La voix se monte pendant la presentation : la negociation prend un
      // instant, et on veut que le micro soit deja pret au premier passage.
      ouvrirVoix();
    },
    onDepart: (dansMs: number) => {
      cibleDepart.current = Date.now() + dansMs;
      if (!presEnCours.current) lancerCourse();
    },
    onPos: (d: number) => SprinterApp.liveDist(d),
    onFini: (_n: string, ms: number) => { SprinterApp.G.liveFin = ms; },
    onResultat: (r: any) => {
      SprinterApp.G.liveResultat = { ...r, moi: salle.current?.moi || '' };
      SprinterApp.G.liveOn = true;
      presEnCours.current = false;
      setPresentation(null);
      film.current?.arreter();

      // Le mot du vainqueur : cinq secondes, et seulement pour lui. Le perdant
      // garde son micro coupe, ce qui est aussi une facon de ne pas transformer
      // une defaite en moment penible.
      const jaiGagne = (r.issue === 'challenger' && salle.current?.suisHote) ||
                       (r.issue === 'opponent' && !salle.current?.suisHote);
      if (jaiGagne) voix.current?.ouvrirMicro(MICRO_VAINQUEUR_MS);
      else voix.current?.fermerMicro();

      setEtape('review');
    },
    onSignal: (type: 'sdp' | 'ice', charge: any) => {
      // Un pair peut recevoir l'offre avant d'avoir monte sa connexion.
      if (!voix.current) ouvrirVoix();
      voix.current?.recu(type, charge);
    },
    onSorti: () => { setErreur(N.t('live_gone')); voix.current?.fermerMicro(); },
    onFerme: () => { if (etape === 'salon') setErreur(N.t('live_closed')); },
  });

  const brancher = (c: string) => {
    const s = new Salle(c, ecouteurs(c));
    salle.current = s;
    brancherSalle({
      position: (d: number) => s.position(d),
      fini: (ms: number) => s.fini(ms),
    });
    s.connecter([epreuve], 4);
  };

  const creer = async () => {
    const n = nom.trim(); if (n) saveName(n);
    setOccupe(true); setErreur('');
    const c = await ouvrirSalle();
    setOccupe(false);
    if (!c) { setErreur(N.t('challenge_net')); return; }
    setCode(c); setEtape('ouverture');
    brancher(c);
  };

  const rejoindre = async (brut?: string) => {
    const c = (brut || saisie).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) return;
    const n = nom.trim(); if (n) saveName(n);
    setOccupe(true); setErreur('');
    const e = await etatSalle(c);
    setOccupe(false);
    if (!e || !e.existe) { setErreur(N.t('live_none')); return; }
    if (e.complete) { setErreur(N.t('live_full')); return; }
    if (e.epreuves && e.epreuves[0]) setEpreuve(e.epreuves[0] as RaceKey);
    setCode(c); brancher(c);
  };

  const basculerPret = () => {
    const v = !pret; setPret(v); salle.current?.pret(v);
  };

  const quitter = () => {
    salle.current?.fermer(); salle.current = null;
    brancherSalle(null);
    // Le micro se rend tout de suite : le voyant de l'appareil doit s'eteindre
    // au moment ou l'on quitte, pas quand le composant voudra bien mourir.
    voix.current?.arreter(); voix.current = null;
    presEnCours.current = false; cibleDepart.current = null;
    setPresentation(null);
    setEtape('repos'); setCode(''); setSalon(null); setPret(false); setErreur('');
  };

  /** Tout le monde est passe : on enchaine sur le pistolet. */
  const finPresentation = () => {
    if (!presEnCours.current) return;
    presEnCours.current = false;
    voix.current?.fermerMicro();
    lancerCourse();
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lienSalle(code));
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refuse */ }
  };

  const msg = code ? N.t('live_invite', { c: code, l: lienSalle(code) }) : '';
  const joueurs: JoueurSalle[] = salon?.joueurs || [];
  const complet = joueurs.length >= 2;

  // --- au repos : creer ou rejoindre ---------------------------------------
  if (etape === 'repos') {
    return (
      <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center gap-2 justify-center">
          <Radio className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-emerald-400">
            {N.t('live_title')}
          </h3>
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
          {N.t('live_desc')}
        </p>

        <div className="flex gap-2">
          {RACE_KEYS.map(k => (
            <button
              key={k}
              onClick={() => setEpreuve(k)}
              className={`flex-1 py-2 rounded-xl font-bold tracking-wider text-xs transition-all border-b-2
                ${epreuve === k
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                  : 'bg-black/30 text-muted-foreground border-transparent hover:bg-white/5'}`}
            >
              {RACES[k].label}
            </button>
          ))}
        </div>

        <input
          value={nom}
          onChange={e => setNom(e.target.value)}
          placeholder={N.t('your_name')}
          maxLength={20}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/50"
        />

        <button
          onClick={creer}
          disabled={occupe}
          className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background
                     bg-emerald-400 hover:bg-emerald-400/90 disabled:opacity-40 transition-colors
                     flex items-center justify-center gap-2"
        >
          {occupe && <Loader2 className="w-4 h-4 animate-spin" />}
          {N.t('live_create')}
        </button>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[9px] tracking-widest text-muted-foreground">{N.t('live_or')}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={saisie}
            onChange={e => setSaisie(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') rejoindre(); }}
            placeholder={N.t('challenge_enter')}
            maxLength={10}
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono tracking-[0.3em] text-center text-foreground placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-emerald-400/50"
          />
          <button
            onClick={() => rejoindre()}
            disabled={occupe || saisie.replace(/[^A-Z0-9]/g, '').length < 4}
            className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background bg-emerald-400 hover:bg-emerald-400/90 disabled:opacity-40 transition-colors"
          >
            {N.t('live_join')}
          </button>
        </div>
        {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
      </div>
    );
  }

  // --- salon : on attend, on partage, on se declare pret --------------------
  return (
    <>
      {/* La presentation couvre l'ecran : c'est un moment a part, pas un
          encart dans le salon. */}
      {etape === 'presentation' && presentation && (
        <PresentationDirect
          presentation={presentation}
          moi={salle.current?.moi || ''}
          voix={voixEtat}
          onTour={(_i, estMoi) => {
            if (estMoi) voix.current?.ouvrirMicro(presentation.micro);
            else voix.current?.fermerMicro();
          }}
          onFini={finPresentation}
        />
      )}

    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card/70 backdrop-blur-xl border border-emerald-400/30 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-3"
    >
      {/* Apres la course : la video, et son compte a rebours. */}
      {(etape === 'review' || review.phase === 'prete' || review.phase === 'expiree') && (
        <ReviewVideo etat={review} onTelecharger={() => film.current?.telecharger()} />
      )}

      {/* Le mot du vainqueur, pendant qu'il l'a. */}
      {etape === 'review' && voixEtat.ouvert && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full
                        bg-red-500/15 border border-red-400/40 self-center">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="font-mono text-[10px] tracking-widest text-red-300">
            {N.t('mic_winner')}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 justify-center">
        <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-emerald-400">
          {N.t('live_room')} · {RACES[epreuve].label}
        </h3>
      </div>

      <div className="font-mono font-black text-3xl md:text-4xl tracking-[0.35em] text-emerald-300 text-center pl-[0.35em]">
        {code}
      </div>

      {/* Tant qu'on est seul, tout l'ecran sert a faire venir l'autre. */}
      {!complet && (
        <>
          <p className="text-[10px] md:text-xs text-muted-foreground text-center">
            {N.t('live_waiting')}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <a href={whatsappUrl(msg)} target="_blank" rel="noopener noreferrer"
               className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background flex items-center gap-2"
               style={{ backgroundColor: '#25D366' }}>
              <MessageCircle className="w-3.5 h-3.5" />{N.t('share_whatsapp')}
            </a>
            <a href={smsUrl(msg)}
               className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background flex items-center gap-2"
               style={{ backgroundColor: '#4FC3F7' }}>
              <MessageSquare className="w-3.5 h-3.5" />{N.t('share_sms')}
            </a>
            {canNativeShare() && (
              <button onClick={() => nativeShare(msg, code)}
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5" />{N.t('share_other')}
              </button>
            )}
            <button onClick={copier}
                    className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-muted-foreground hover:text-emerald-300 flex items-center gap-2">
              {copie ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copie ? N.t('code_copied') : N.t('challenge_copy')}
            </button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        {joueurs.map(j => (
          <div key={j.id}
               className={`flex items-center justify-between px-3 py-2 rounded-xl border
                 ${j.pret ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/10 bg-black/25'}`}>
            <span className="text-xs md:text-sm font-bold tracking-wide text-foreground truncate">
              {j.nom}{j.hote ? ' ·' : ''}
            </span>
            <span className={`text-[9px] md:text-[10px] font-bold tracking-widest
              ${j.pret ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {N.t(j.pret ? 'live_ready' : 'live_notready')}
            </span>
          </div>
        ))}
        {joueurs.length < 2 && (
          <div className="flex items-center justify-center px-3 py-2 rounded-xl border border-dashed border-white/15 text-[10px] text-muted-foreground">
            {N.t('live_empty_seat')}
          </div>
        )}
      </div>

      <button
        onClick={basculerPret}
        disabled={!complet}
        className={`w-full py-3 rounded-xl font-black font-display tracking-widest transition-colors
          disabled:opacity-40 disabled:pointer-events-none
          ${pret ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                 : 'bg-emerald-400 text-background hover:bg-emerald-400/90'}`}
      >
        {N.t(pret ? 'live_unready' : 'live_go')}
      </button>

      {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}

      <button onClick={quitter}
              className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
        {N.t('live_leave')}
      </button>
    </motion.div>
    </>
  );
}
