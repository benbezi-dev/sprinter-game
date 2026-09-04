import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { motion } from 'framer-motion';
import { Radio, Loader2, Copy, Check, MessageCircle, MessageSquare, Share2 } from 'lucide-react';
import {
  Salle, ouvrirSalle, etatSalle, lienSalle, codeDirectUrl, nettoyerUrlDirect,
  type EtatSalle, type JoueurSalle, type Presentation,
} from '@/game/live';
import { poserSalon, salonCourant, quitterSalon } from '@/game/salon-direct';
import {
  poserVoix, voixCourante, couperVoix, programmerFinVoix, annulerFinVoix,
} from '@/game/voix-directe';
import { whatsappUrl, smsUrl, canNativeShare, nativeShare } from '@/game/challenge';
import { getSavedName, saveName, type RaceKey } from '@/game/leaderboard';
import { Repliable } from './Repliable';
import { Voix, type EtatVoix } from '@/game/voix';
import { Review, TTL_MS, type EtatReview } from '@/game/review';
import { lancerPresentation } from '@/game/presentation-directe';
import { ReviewVideo } from './ReviewVideo';
import { DUELS_OUVERTS, repereAvantDuel } from '@/game/duels';

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
  /**
   * Combien de couloirs sur cette piste.
   *
   * Deux, c'est un duel : un vainqueur, un perdant, des points qui changent de
   * main. Trois ou plus, c'est une course : un classement, et rien au
   * classement des duels — le bareme est fait pour une paire.
   *
   * Huit est le nombre de couloirs d'une piste, et donc le format d'une serie
   * de championnat.
   */
  const [places, setPlaces] = useState(2);

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [voixEtat, setVoixEtat] = useState<EtatVoix>({
    micro: false, refuse: false, ouvert: false, connecte: false,
  });
  const [review, setReview] = useState<EtatReview>({
    phase: 'inactif', url: null, fichier: '', reste: 0, taille: 0,
  });

  const salle = useRef<Salle | null>(null);
  const film = useRef<Review | null>(null);
  const auto = useRef(false);
  /** Instant absolu du coup de pistolet, garde le temps de la presentation. */
  const cibleDepart = useRef<number | null>(null);
  const presEnCours = useRef(false);

  // Un lien ?direct=CODE tombe directement dans le salon.
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;

    // Une salle deja ouverte se reprend telle quelle.
    //
    // Ce panneau vit dans l'ecran-titre, qui disparait au coup de pistolet et
    // revient a la fin de la course. Ouvrir une seconde salle au retour
    // laisserait la premiere courir sans personne pour l'ecouter, et fermer la
    // premiere au depart — ce qu'on faisait — figeait les deux adversaires
    // l'un pour l'autre. La salle survit donc au demontage, et c'est l'ecran
    // qui se rebranche dessus.
    const dejaLa = salonCourant();
    if (dejaLa) {
      salle.current = dejaLa;
      dejaLa.ecouter(ecouteurs(dejaLa.code));
      setCode(dejaLa.code);
      if (dejaLa.epreuves[0]) setEpreuve(dejaLa.epreuves[0] as RaceKey);
      if (dejaLa.dernierEtat) {
        setSalon(dejaLa.dernierEtat);
        setPlaces(dejaLa.dernierEtat.max || 2);
      }
      setEtape('salon');
      // La liaison audio a survecu au demontage — c'est tout l'objet de
      // `voix-directe`. Elle continue d'emettre vers un composant mort tant
      // qu'on ne la rebranche pas sur celui-ci.
      voixCourante()?.brancherEtat(setVoixEtat);
    } else {
      const c = codeDirectUrl();
      if (c) { nettoyerUrlDirect(); setSaisie(c); rejoindre(c); }
    }

    // Rien n'est ferme ici, et c'est le coeur de la correction. Un demontage
    // n'est pas un depart : la salle, la liaison audio et l'enregistrement
    // appartiennent a la course, pas a l'ecran qui la regarde. Ils se ferment
    // dans quitter(), ou d'eux-memes a la fin de la review.
    //
    // Le micro, lui, n'est meme pas tenu entre-temps : il est pris a l'ouverture
    // d'une fenetre de parole — la presentation, puis les cinq secondes du
    // vainqueur — et rendu au systeme des qu'elle se referme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ouvre la liaison audio. Un seul des deux emet l'offre — l'hote — sans quoi
   * les deux negociations se croisent et aucune n'aboutit.
   */
  const ouvrirVoix = () => {
    if (voixCourante()) return;
    const v = new Voix({
      envoyer: (type, charge) => salle.current?.signaler(type, charge),
      onEtat: setVoixEtat,
    });
    poserVoix(v);
    v.demarrer(!!salle.current?.suisHote);
  };

  /**
   * Monte la piste sans donner le depart.
   *
   * Les adversaires viennent du salon avec le couloir que la salle leur a
   * attribue : c'est ce qui fait que les huit telephones placent les memes
   * gens aux memes endroits, pendant la presentation comme pendant la course.
   */
  const monterLaPiste = () => {
    if (SprinterApp.G.state === 'count' || SprinterApp.G.state === 'race') return;
    SprinterApp.startLive([epreuve], {
      levelIdx: 4, adversaire: salle.current?.adversaire || '', autres: lesAutres(),
    });
  };

  /**
   * Les adversaires, lus dans la SALLE et non dans l'etat React.
   *
   * Les ecouteurs de la salle sont crees une fois, a la connexion : ce qu'ils
   * capturent de React date de cet instant-la, ou le salon etait encore vide.
   * Lire `salon` depuis eux donnait donc une piste sans personne dessus —
   * huit couloirs, sept coureurs de l'ordinateur, et pas d'adversaire.
   *
   * La salle, elle, garde son dernier etat a jour. C'est la source, on y va.
   */
  const lesAutres = () => {
    const s = salle.current;
    const moi = s?.moi || '';
    return (s?.dernierEtat?.joueurs || [])
      .filter(j => j.id !== moi)
      .map(j => ({ id: j.id, nom: j.nom, couloir: j.couloir || 0 }));
  };

  /**
   * Le pistolet. Appele soit a la fin de la presentation, soit tout de suite
   * si la salle n'en a pas annonce — le mode reste jouable contre un serveur
   * qui ne connaitrait pas encore la sequence.
   */
  const lancerCourse = () => {
    // Une salle qui n'annonce pas de presentation passe directement ici : la
    // coupure programmee doit tomber la aussi.
    annulerFinVoix();
    const dans = Math.max(0, (cibleDepart.current ?? Date.now()) - Date.now());
    const adverse = salle.current?.adversaire || '';
    // Tout le monde sauf soi, avec son couloir tel que la salle l'a attribue :
    // les deux clients doivent placer les memes gens aux memes endroits.
    const autres = lesAutres();
    if (SprinterApp.G.state !== 'count' && SprinterApp.G.state !== 'race') {
      SprinterApp.startLive([epreuve], { levelIdx: 4, adversaire: adverse, autres });
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
      // Une revanche dans la meme salle : la coupure programmee a la fin du
      // duel precedent n'a plus lieu d'etre.
      annulerFinVoix();
      setEtape('presentation');
      // La voix se monte pendant la presentation : la negociation prend un
      // instant, et on veut que le micro soit deja pret au premier passage.
      ouvrirVoix();

      // La piste se monte MAINTENANT, et non au coup de pistolet.
      //
      // C'est ce qui permet de presenter les athletes la ou ils vont courir,
      // dans leurs couloirs, dessines par le moteur. Le decompte reste
      // suspendu — startLive le laisse a -99 — donc personne ne part : on a
      // simplement allume le stade avant l'annonce.
      monterLaPiste();

      // Et la presentation passe a la racine de l'application. Elle ne peut
      // pas rester ici : monter la piste fait sortir le jeu de l'ecran-titre,
      // qui emporte ce panneau avec lui. Les fonctions qu'on lui confie
      // continuent de marcher apres, elles tiennent la liaison audio par une
      // reference qui, elle, survit.
      lancerPresentation({
        presentation: p,
        moi: salle.current?.moi || '',
        onTour: (_i, estMoi) => {
          if (estMoi) voixCourante()?.ouvrirMicro(p.micro);
          else voixCourante()?.fermerMicro();
        },
        onFini: () => { lancerPresentation(null); finPresentation(); },
        etatVoix: () => voixCourante()?.lireEtat() ??
          { micro: false, refuse: false, ouvert: false, connecte: false },
      });
    },
    onDepart: (dansMs: number) => {
      cibleDepart.current = Date.now() + dansMs;
      /* LE REPERE D'AVANT LA COURSE, POSE AU COUP DE PISTOLET.
         A deux, cette course est un duel et elle bougera la ligne des deux
         joueurs au classement. Ce qu'ils y occupaient n'existera plus a
         l'arrivee : le seul moment pour le lire est celui-ci, et il est
         gratuit — il reste une course entiere avant qu'on en ait besoin.
         Sans reponse, l'arrivee se passera de l'animation. */
      if (DUELS_OUVERTS) repereAvantDuel();
      if (!presEnCours.current) lancerCourse();
    },
    // A huit, savoir qui a bouge est la moitie de l'information : la position
    // part vers le coureur qui porte cet identifiant, pas vers « l'adversaire ».
    onPos: (id: string, d: number) => SprinterApp.liveDistDe(id, d),
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
      // A deux, l'issue dit qui gagne ; au-dela, c'est la premiere place de
      // l'ordre d'arrivee. Sans cette seconde lecture, le vainqueur d'une
      // course a quatre ou huit n'avait jamais le micro : `issue` n'existe
      // que pour un duel, et personne ne parlait.
      const premier = Array.isArray(r.classement) ? r.classement[0] : null;
      const jaiGagne = r.issue
        ? ((r.issue === 'challenger' && salle.current?.suisHote) ||
           (r.issue === 'opponent' && !salle.current?.suisHote))
        : !!premier && premier.id === salle.current?.moi;
      if (jaiGagne) voixCourante()?.ouvrirMicro(MICRO_VAINQUEUR_MS);
      else voixCourante()?.fermerMicro();

      // Puis la liaison se coupe d'elle-meme a la fin de la review.
      //
      // La review n'a pas d'autre fin que celle de sa video : dix minutes,
      // comptees a partir d'ici, apres quoi l'ecran ne montre plus rien qu'on
      // puisse encore appeler une course. La meme duree sert quand il n'y a
      // pas eu de video du tout — un appareil qui ne sait pas encoder n'a
      // aucune raison de garder une connexion ouverte plus longtemps que les
      // autres.
      //
      // Le micro, lui, est deja rendu : il ne l'est que pendant les fenetres
      // de parole. Ce qui s'eteint ici, c'est le canal d'ecoute — de quoi se
      // parler apres la course, sans que cela dure indefiniment.
      programmerFinVoix(TTL_MS);

      setEtape('review');
    },
    onSignal: (type: 'sdp' | 'ice', charge: any) => {
      // Un pair peut recevoir l'offre avant d'avoir monte sa connexion.
      if (!voixCourante()) ouvrirVoix();
      voixCourante()?.recu(type, charge);
    },
    onSorti: () => { setErreur(N.t('live_gone')); voixCourante()?.fermerMicro(); },
    onFerme: () => { if (etape === 'salon') setErreur(N.t('live_closed')); },
  });

  const brancher = (c: string) => {
    const s = new Salle(c, ecouteurs(c));
    salle.current = s;
    poserSalon(s);
    brancherSalle({
      position: (d: number) => s.position(d),
      fini: (ms: number) => s.fini(ms),
    });
    s.connecter([epreuve], 4, places);
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
    quitterSalon(); salle.current = null;
    brancherSalle(null);
    // Partir pendant la presentation laissait le jeu sur la piste, decompte
    // suspendu, sans rien pour le relancer ni pour en sortir : la piste montee
    // avant le pistolet doit se demonter par le meme chemin.
    lancerPresentation(null);
    if (SprinterApp.G.state === 'count' && SprinterApp.G.countT <= -90) {
      SprinterApp.goHome();
    }
    // Le micro se rend tout de suite : le voyant de l'appareil doit s'eteindre
    // au moment ou l'on quitte, pas quand le composant voudra bien mourir.
    couperVoix();
    presEnCours.current = false; cibleDepart.current = null;
    setPresentation(null);
    setEtape('repos'); setCode(''); setSalon(null); setPret(false); setErreur('');
  };

  /** Tout le monde est passe : on enchaine sur le pistolet. */
  const finPresentation = () => {
    if (!presEnCours.current) return;
    presEnCours.current = false;
    voixCourante()?.fermerMicro();
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
      <Repliable
        titre={N.t('live_title')}
        sous={N.t('live_desc')}
        icone={<Radio className="w-4 h-4" />}
      >

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

        {/* Le nombre de couloirs. Il ne se choisit qu'a l'ouverture : le
            changer une fois la piste formee ferait entrer ou sortir des gens
            d'une course deja commencee. */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-widest text-muted-foreground shrink-0">
            {N.t('live_lanes')}
          </span>
          <div className="flex gap-1 flex-1">
            {[2, 4, 6, 8].map(n => (
              <button
                key={n}
                onClick={() => setPlaces(n)}
                className={`flex-1 py-1.5 rounded-lg font-mono font-bold text-xs transition-all border
                  ${places === n
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    : 'bg-black/30 text-muted-foreground border-transparent hover:bg-white/5'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground/70 text-center leading-snug -mt-1">
          {N.t(places === 2 ? 'live_lanes_duel' : 'live_lanes_course')}
        </p>

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
      </Repliable>
    );
  }

  // --- salon : on attend, on partage, on se declare pret --------------------
  return (
    <>
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
