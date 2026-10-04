import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { Radio, Loader2, Copy, Check, MessageCircle, MessageSquare, Share2, ListOrdered, RotateCcw, Trophy } from 'lucide-react';
import {
  Salle, ouvrirSalle, etatSalle, lienSalle, codeDirectUrl, nettoyerUrlDirect,
  COULOIRS, mesPointsDe, TOURNOI_MIN, tournoiLance,
  type EtatSalle, type JoueurSalle, type Presentation, type DuelDirect,
  type ResultatDirect, type PointsDuel,
} from '@/game/live';
import {
  regarderLaManche, recalerLeRegard, mancheRegardee, oublierLeRegard,
  remettreLeRegard, veutRegarder, regardSur, nomDeManche,
} from '@/game/tournoi-direct';
import { TableauTournoi, PretTournoi } from './TournoiDirect';
import {
  poserSalon, salonCourant, quitterSalon, surDemandeRejoindre, useSalonDirect,
} from '@/game/salon-direct';
import {
  poserVoix, voixCourante, couperVoix, programmerFinVoix, annulerFinVoix,
} from '@/game/voix-directe';
import { whatsappUrl, smsUrl, canNativeShare, nativeShare } from '@/game/challenge';
import { inviterEnDirect } from '@/game/invitations-directes';
import { noterDefi, noterCourseDirecte } from '@/game/journal-defis';
import { DuelRanking } from './DuelRanking';
import { PanneauIdentite } from './NameChip';
import { nomPourLeDirect } from '@/game/identity';
import { getSavedName, saveName, type RaceKey } from '@/game/leaderboard';
import { useJeu, epreuvesDuJeu } from '@/game/jeux';
import { Repliable } from './Repliable';
import { Voix, type EtatVoix } from '@/game/voix';
import { prechargerGlace } from '@/game/turn';
import {
  programmerLeFilm, arreterLeFilm, jeterLeFilm, useFilmDeLaCourse, partagerLeFilm,
} from '@/game/film-course';
import { lancerPresentation } from '@/game/presentation-directe';
import { ReviewVideo } from './ReviewVideo';
import { IconeRapide } from './TchatRapide';
import { ouvrirChoixRapide } from '@/game/tchat-rapide';
import { TCHAT_RAPIDE_OUVERT } from '@/game/canal';


/** Le mot du vainqueur, apres la course. */
/**
 * Combien de temps la liaison audio reste ouverte apres la course.
 *
 * Elle valait la duree de vie de la video, et l'accord tenait tant que les
 * deux faisaient dix minutes. La video vit maintenant deux heures — ce qui est
 * bien pour un fichier dans une memoire, et absurde pour un micro ouvert entre
 * deux inconnus. Les deux durees ont donc repris leur independance, et celle-ci
 * garde la valeur qu'elle a toujours eue.
 */
const FIN_VOIX_MS = 10 * 60 * 1000;

const MICRO_VAINQUEUR_MS = 5000;
/**
 * Ce qu'on ajoute a la duree annoncee d'une presentation pour garder le micro.
 *
 * La sequence est calee sur une date absolue, ramenee dans l'horloge locale :
 * quelques dizaines de millisecondes d'ecart entre les deux appareils sont
 * normales. La marge evite que l'appareil soit rendu juste avant le dernier
 * mot du dernier athlete.
 */
const MARGE_MICRO_MS = 1500;

/**
 * Combien de temps un elimine reste dans les tribunes apres le verdict d'une
 * manche qu'il regardait : le temps de lire qui sort, puis retour au salon,
 * ou le tableau du tournoi l'attend. Un bouton l'y ramene plus tot.
 */
const RETOUR_TRIBUNE_MS = 6000;

/**
 * Le terrain du direct : le stade intergalactique, dernier de la campagne.
 *
 * Le direct se courait sur la piste olympique, un rang plus bas. Ce n'est pas
 * le meme rendez-vous : on y vient avec des gens qu'on a invites soi-meme, et
 * c'est la course qu'ils raconteront. Elle se court donc sur le plus beau
 * stade du jeu — cosmos, tribunes pleines — plutot que sur celui qu'on
 * traverse en montant.
 *
 * Le terrain ne change rien a la physique : les chronos vises du dernier rang
 * ne concernent que le plateau de l'ordinateur, qui ne court pas ici.
 */
const NIVEAU_DIRECT = 5;

type Etape = 'repos' | 'ouverture' | 'salon' | 'presentation' | 'partie' | 'review';

/** Un partant que la salle a range sans nom : il court, il ne se redefie pas. */
const sansNom = (nom: string) => {
  const n = String(nom || '').trim().toLowerCase();
  return !n || n === 'anonyme';
};

/**
 * LA COURSE QUI VIENT DE SE TRANCHER, AU JOURNAL DES DEFIS.
 *
 * Une ligne par adversaire : a deux c'est le duel, a huit ce sont les sept
 * duels de la course, et chacun se redefie a part. L'issue s'ecrit des le
 * verdict — une base indisponible ne doit pas laisser la course sans trace —
 * et les points la completent quand la salle les annonce (`points`).
 *
 * L'issue vient de la salle quand elle l'a dite, duel par duel ; sinon des
 * chronos du classement, qui disent la meme chose.
 */
function inscrireAuJournal(
  r: ResultatDirect, moi: string, salle: string, course: number | null,
  suisHote: boolean, epreuves: string[], points?: PointsDuel | null,
) {
  const classement = Array.isArray(r?.classement) ? r.classement : [];
  const mien = classement.find(l => l.id === moi);
  if (!mien || classement.length < 2 || !salle || !course) return;
  // Le journal ne doit jamais couter l'ecran de fin : il est appele dans le
  // meme geste que l'annonce du verdict.
  try { for (const l of classement) {
    if (l.id === moi || sansNom(l.nom)) continue;
    const duel = points?.duels?.find(x => x.id === l.id);
    noterCourseDirecte({
      salle, course, nom: l.nom,
      sens: suisHote ? 'lance' : 'recu',
      etat: duel ? duel.issue
          : mien.ms < l.ms ? 'gagne' : mien.ms > l.ms ? 'perdu' : 'nul',
      epreuves,
      lp: duel?.lp,
      mon_ms: mien.abandon ? undefined : mien.ms,
      son_ms: l.abandon ? undefined : l.ms,
    });
  } } catch { /* une ligne de journal en moins, rien de plus */ }
}

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
  /**
   * Le classement des duels, ouvert par-dessus le salon pour y choisir des
   * adversaires.
   *
   * Le code de salle ne suffisait qu'avec des gens qu'on a deja au telephone.
   * Quelqu'un croise au classement n'est joignable par aucun de ces moyens :
   * c'est le serveur qui porte l'invitation jusqu'a lui.
   */
  const [choisirAdversaires, setChoisirAdversaires] = useState(false);
  /** Ce que le dernier envoi a donne, pour le dire sans faire un ecran de plus. */
  const [conviesInfo, setConviesInfo] = useState<{ ok: number; injoignable: string | null }>(
    { ok: 0, injoignable: null });
  const [saisie, setSaisie] = useState('');
  // Les epreuves du jeu courant : un direct lance depuis Hurdlers se court
  // avec des haies.
  const jeu = useJeu();
  const RACE_KEYS = epreuvesDuJeu(jeu);
  const [epreuve, setEpreuve] = useState<RaceKey>(() => RACE_KEYS[0]);
  const [salon, setSalon] = useState<EtatSalle | null>(null);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);
  const [nom, setNom] = useState(getSavedName());
  /**
   * Combien de couloirs sur cette piste.
   *
   * Un, c'est un tour de piste seul : le stade, la video, et personne a
   * attendre. Deux, c'est un duel : un vainqueur, un perdant, des points qui
   * changent de main. Trois ou plus, ce sont des duels contre chacun des
   * autres : un ordre d'arrivee, et des points pour chaque paire.
   *
   * Huit est le nombre de couloirs d'une piste, et donc le format d'une serie
   * de championnat.
   *
   * Toutes les tailles intermediaires existent, impaires comprises. On n'en
   * proposait que quatre — deux, quatre, six, huit — et cela paraissait suffire
   * jusqu'a ce qu'on soit trois : il fallait alors ouvrir une piste a quatre et
   * attendre un quatrieme qui n'existait pas. Le depart n'arrive que quand tous
   * les couloirs sont pris, donc cette course-la ne partait jamais.
   */
  const [places, setPlaces] = useState(2);
  /**
   * Le tournoi a elimination : des manches, le dernier de chacune sort,
   * jusqu'a la finale a deux. De trois a huit couloirs seulement — a deux,
   * c'est deja une finale (voir TOURNOI_MIN).
   */
  const [tournoi, setTournoi] = useState(false);
  const tournoiPossible = places >= TOURNOI_MIN;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [voixEtat, setVoixEtat] = useState<EtatVoix>({
    micro: false, refuse: false, ouvert: false, connecte: false,
  });
  /**
   * LE FILM DE LA COURSE, QUI NE VIT PLUS ICI.
   *
   * Il tenait dans un `useRef` de ce composant, et c'etait le seul endroit ou
   * il ne pouvait pas tenir : ce panneau vit dans l'ecran-titre, qui disparait
   * au coup de pistolet. La camera tournait bien — la salle garde les
   * fonctions qu'on lui a confiees — mais au retour de la course, le panneau
   * se remontait a neuf, avec un `ref` vide : la video etait en memoire, et
   * plus un seul ecran ne pouvait la proposer.
   *
   * Elle vit donc dans `game/film-course`, au-dessus des composants, comme
   * celle du one shot. Deux ecrans la montrent maintenant : celui de fin de
   * course, tout de suite, et ce panneau au retour dans le salon.
   */
  const film = useFilmDeLaCourse();

  const salle = useRef<Salle | null>(null);
  /**
   * Un rendu a chaque changement de la salle, y compris ceux qu'aucun
   * ecouteur ne porte : la liaison que la salle coupe apres la course, celle
   * qu'on rouvre sous le meme code.
   */
  useSalonDirect();
  const auto = useRef(false);
  /** Instant absolu du coup de pistolet, garde le temps de la presentation. */
  const cibleDepart = useRef<number | null>(null);
  /**
   * Cette meme date, mais dans l'horloge de la SALLE.
   *
   * Elle ne sert pas a compter — chacun compte chez lui, sur l'ecart qu'il a
   * mesure — mais a tirer la tenue du starter : c'est le seul nombre que les
   * huit telephones ont en commun, et donc le seul qui puisse leur faire
   * entendre « pret » au meme instant. Voir poserLeDepart.
   */
  const dateDepart = useRef<number | null>(null);
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

    // Une invitation acceptee ailleurs dans le jeu.
    //
    // L'ecran qui affiche l'invitation ne sait pas rejoindre une salle — c'est
    // ce panneau qui sait, et il n'est pas toujours monte quand l'invitation
    // arrive. La demande attend donc dans `salon-direct` et ce branchement la
    // ramasse, qu'elle soit deja la ou qu'elle vienne plus tard.
    //
    // On ne rejoint pas si l'on est deja dans une salle : accepter une
    // invitation en pleine composition d'un relais ferait sortir de la
    // premiere sans le dire.
    const desabonner = surDemandeRejoindre(c => {
      if (salonCourant()) return;
      setSaisie(c);
      rejoindre(c);
    });

    // Le nettoyage ne ferme QUE ce branchement, et c'est le coeur de la
    // correction que ce fichier porte depuis le debut : un demontage n'est pas
    // un depart. La salle, la liaison audio et l'enregistrement appartiennent a
    // la course, pas a l'ecran qui la regarde — ils se ferment dans quitter(),
    // ou d'eux-memes a la fin de la review. Ne se desabonner que du guetteur
    // est sans risque : il ne tient rien, il ecoute.
    //
    // Le micro, lui, n'est meme pas tenu entre-temps : il est pris a l'ouverture
    // d'une fenetre de parole — la presentation, puis les cinq secondes du
    // vainqueur — et rendu au systeme des qu'elle se referme.
    return () => { desabonner(); };
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
    SprinterApp.startLive([epreuveDeLaSalle()], {
      levelIdx: NIVEAU_DIRECT, adversaire: salle.current?.adversaire || '',
      autres: lesAutres(), sansOrdinateur: true, photoFinish: true,
    });
    // Sorti du tournoi : on regarde la manche depuis les tribunes.
    if (salle.current?.elimineMoi) regarderLaManche();
  };

  /**
   * Un elimine qui a dit qu'il ne voulait pas regarder : la manche part sans
   * lui, et son ecran reste ou il est.
   */
  const resteALEcart = () => !!salle.current?.elimineMoi && !veutRegarder();

  /**
   * Les adversaires, lus dans la SALLE et non dans l'etat React.
   *
   * Les ecouteurs de la salle sont crees une fois, a la connexion : ce qu'ils
   * capturent de React date de cet instant-la, ou le salon etait encore vide.
   * Lire `salon` depuis eux donnait donc une piste sans personne dessus : le
   * joueur seul dans son couloir, et pas un adversaire.
   *
   * La salle, elle, garde son dernier etat a jour. C'est la source, on y va.
   */
  const lesAutres = () => {
    const s = salle.current;
    const moi = s?.moi || '';
    // En tournoi, seuls ceux qui courent encore sont sur la piste : un elimine
    // y resterait plante dans ses blocs pendant toute la manche.
    return (s?.dernierEtat?.joueurs || [])
      .filter(j => j.id !== moi && j.en_lice !== false)
      .map(j => ({ id: j.id, nom: j.nom, couloir: j.couloir || 0 }));
  };

  /**
   * LA DISTANCE, LUE DANS LA SALLE ET NON DANS LE SELECTEUR.
   *
   * C'est celui qui ouvre la piste qui la choisit, et tous ceux qui entrent
   * avec son code la courent. Le salon le disait bien — `rejoindre` recalait
   * le selecteur sur la salle — mais la course partait d'ailleurs : les
   * ecouteurs sont crees a la connexion, avec l'etat React de cet instant-la,
   * soit AVANT que le recalage ait pris effet. Celui qui rejoignait courait
   * donc la distance de son propre selecteur — le 100 m par defaut, ou celle
   * qu'il avait touchee avant de taper le code — pendant que l'hote courait
   * son 400 m. Meme defaut au retour d'une course : le panneau remonte avec
   * son selecteur remis a zero, et une revanche partie de la serait partie
   * sur 100 m.
   *
   * Meme remede que pour les adversaires : la salle garde son dernier etat a
   * jour, c'est la source.
   */
  const epreuveDeLaSalle = (): RaceKey => {
    const s = salle.current;
    return ((s?.dernierEtat?.epreuves?.[0] || s?.epreuves?.[0] || epreuve) as RaceKey);
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
    // La liaison passe en veille pour la duree de la course : ni micro, ni
    // ecoute. Personne ne parle entre le pistolet et l'arrivee, et une
    // conversation ouverte tient le systeme en mode appel — le jeu sort alors
    // au volume d'un telephone qu'on a a l'oreille. La connexion, elle, reste
    // montee : le mot du vainqueur ne peut pas attendre une renegociation.
    voixCourante()?.veille();
    const dans = Math.max(0, (cibleDepart.current ?? Date.now()) - Date.now());
    const adverse = salle.current?.adversaire || '';
    // Tout le monde sauf soi, avec son couloir tel que la salle l'a attribue :
    // les deux clients doivent placer les memes gens aux memes endroits.
    const autres = lesAutres();
    const tribune = !!salle.current?.elimineMoi;
    if (SprinterApp.G.state !== 'count' && SprinterApp.G.state !== 'race') {
      SprinterApp.startLive([epreuveDeLaSalle()], {
        levelIdx: NIVEAU_DIRECT, adversaire: adverse, autres, sansOrdinateur: true,
        photoFinish: true,
      });
      if (tribune) regarderLaManche();
    } else {
      // La piste est deja montee — c'est le cas normal, elle l'a ete pour la
      // presentation. On ne la remonte pas, mais on part avec la salle telle
      // qu'elle est MAINTENANT et non telle qu'elle etait a l'annonce.
      SprinterApp.majLives(autres);
    }
    SprinterApp.G.liveNom = adverse;
    SprinterApp.G.ghostName = adverse;
    SprinterApp.liveDepart(dans, dateDepart.current);
    setEtape('partie');

    // On ne filme que la course. Un peu avant le coup de pistolet, pour ne pas
    // perdre les premieres images le temps que l'encodeur demarre.
    //
    // AVEC LE SON, ET AVEC LA VOIX. Le stade sort du moteur, la voix de
    // l'adversaire de la connexion — deux pistes empruntees, jamais arretees
    // par l'enregistreur (voir Review.demarrer). Un duel en direct se court en
    // se parlant : le replay qui n'en garderait que l'image aurait retire ce
    // qui distingue cette course de toutes les autres.
    //
    // La piste distante est relue au moment du depart et non ici : a la
    // seconde ou l'on programme, la connexion peut n'avoir rien recu encore.
    //
    // Pas depuis les tribunes : le film du direct est celui de SA course, et
    // l'elimine garde ainsi celui de la manche ou il est sorti.
    if (!tribune) programmerLeFilm('direct', dans, () => [voixCourante()?.pisteDistante()]);
  };

  /** Ce que la salle court, tel qu'elle l'annonce : celui qui rejoint n'a
   *  rien choisi, et son propre selecteur peut dire autre chose. */
  const epreuvesDeLaSalle = () =>
    salle.current?.dernierEtat?.epreuves || salle.current?.epreuves || [epreuve];

  const ecouteurs = (monCode: string) => ({
    onEtat: (e: EtatSalle) => {
      setSalon(e);
      // Le selecteur suit la salle : c'est sa distance qui s'affiche, et
      // celle qu'on retrouvera en quittant la piste.
      if (e.epreuves && e.epreuves[0]) setEpreuve(e.epreuves[0] as RaceKey);
      setEtape(p => (p === 'presentation' || p === 'partie' || p === 'review') ? p : 'salon');
      // La piste est montee des le debut de la presentation, et la salle
      // continue de vivre jusqu'au pistolet : quelqu'un ferme l'application,
      // un invite arrive. Sans cette remise d'accord, un partant qui s'en va
      // laissait son coureur plante sur la ligne de depart pour toute la
      // course, et un partant arrive apres le montage ne se voyait nulle part
      // — tout en figurant au classement rendu par la salle. Voir majLives.
      const etat = SprinterApp.G.state;
      if (SprinterApp.G.liveOn && (etat === 'count' || etat === 'race')) {
        SprinterApp.majLives(lesAutres());
        // Un forfait pendant qu'on regardait : la camera change de couloir.
        recalerLeRegard();
      }
    },
    onPresentation: (p: Presentation) => {
      if (resteALEcart()) return;
      setPresentation(p);
      presEnCours.current = true;
      // Une revanche dans la meme salle : la coupure programmee a la fin du
      // duel precedent n'a plus lieu d'etre.
      annulerFinVoix();
      setEtape('presentation');
      // La voix se monte pendant la presentation : la negociation prend un
      // instant, et on veut que le micro soit deja pret au premier passage.
      ouvrirVoix();
      voixCourante()?.reveil();

      // Et le micro est demande TOUT DE SUITE, pour toute la sequence.
      //
      // Une fenetre de parole dure 2 200 ms ; obtenir la capture en coute
      // plusieurs centaines sur un telephone. La demander au moment du tour,
      // c'est en perdre la moitie — et parfois la totalite, quand le systeme
      // repond apres la fermeture. On la prend donc avant l'annonce, gardee
      // muette jusqu'au tour de chacun, et rendue a la fin de la sequence.
      // Un elimine n'a pas de creneau dans la sequence : son micro reste au
      // systeme.
      if (!salle.current?.elimineMoi) {
        voixCourante()?.prechauffer(
          Math.max(0, p.dansMs) + p.par * Math.max(1, p.ordre.length) + MARGE_MICRO_MS,
        );
      }

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
    onDepart: (dansMs: number, departA: number) => {
      if (resteALEcart()) return;
      cibleDepart.current = Date.now() + dansMs;
      dateDepart.current = departA;
      if (!presEnCours.current) lancerCourse();
    },
    // A huit, savoir qui a bouge est la moitie de l'information : la position
    // part vers le coureur qui porte cet identifiant, pas vers « l'adversaire ».
    // Avec l'instant de SA course, quand la salle le transmet : c'est lui qui
    // permet de le montrer ou il en est a NOTRE instant, et non ou il etait.
    onPos: (id: string, d: number, c?: number) => SprinterApp.liveDistDe(id, d, c),
    // Son chrono pose son coureur sur la ligne a son vrai temps, et resout le
    // photo-finish. La salle nous renvoie aussi le notre : liveFiniDe ne le
    // trouve pas parmi les adversaires et l'ignore.
    onFini: (_n: string, ms: number, abandon: boolean, id?: string) => {
      SprinterApp.G.liveFin = ms;
      if (id) SprinterApp.liveFiniDe(id, ms, abandon);
    },
    onResultat: (r: any) => {
      // UNE MANCHE DE TOURNOI QU'ON N'A PAS COURUE. Un elimine recoit le
      // verdict des manches suivantes comme tout le monde, mais il n'est pas
      // a lui : il ne doit ni remplacer celui de sa propre manche — que son
      // ecran de fin affiche peut-etre encore — ni entrer au journal, ni lui
      // donner le micro du vainqueur. S'il regardait depuis les tribunes, le
      // bandeau le montre, puis on le ramene au salon.
      const moiId = salle.current?.moi || '';
      const couru = !Array.isArray(r?.classement) || r.classement.some((l: any) => l.id === moiId);
      if (!couru) {
        presEnCours.current = false;
        setPresentation(null);
        lancerPresentation(null);
        voixCourante()?.reveil();
        voixCourante()?.fermerMicro();
        const G = SprinterApp.G;
        if (G.spectateur && G.liveOn) {
          mancheRegardee(r);
          setTimeout(() => {
            const G2 = SprinterApp.G;
            // Toujours dans les tribunes de CETTE manche : la suivante a pu
            // partir entre-temps, et l'on ne sort pas quelqu'un qui regarde.
            if (G2.spectateur && G2.liveOn && regardSur(r)) {
              oublierLeRegard();
              SprinterApp.goHome();
            }
          }, RETOUR_TRIBUNE_MS);
        }
        return;
      }
      SprinterApp.G.liveResultat = { ...r, moi: salle.current?.moi || '' };
      // Au journal, tout de suite : l'issue est connue, les points suivront.
      inscrireAuJournal(r, salle.current?.moi || '', monCode,
                        r.course ?? dateDepart.current, !!salle.current?.suisHote,
                        epreuvesDeLaSalle());
      SprinterApp.G.liveOn = true;
      presEnCours.current = false;
      setPresentation(null);
      void arreterLeFilm('direct');

      // Le mot du vainqueur : cinq secondes, et seulement pour lui. Le perdant
      // garde son micro coupe, ce qui est aussi une facon de ne pas transformer
      // une defaite en moment penible.
      // A deux, l'issue dit qui gagne ; au-dela, c'est la premiere place de
      // l'ordre d'arrivee. Sans cette seconde lecture, le vainqueur d'une
      // course a quatre ou huit n'avait jamais le micro : `issue` n'existe
      // que pour un duel, et personne ne parlait.
      // Premier, c'est avoir la premiere PLACE, pas la premiere ligne : une
      // egalite a la milliseconde partage la place, et les deux vainqueurs
      // ont droit au mot. La premiere ligne seule le donnait a celui que le
      // tri avait pose en tete.
      const maLigne = Array.isArray(r.classement)
        ? r.classement.find((l: any) => l.id === salle.current?.moi) : null;
      // L'ecoute se rebranche : la course est finie, on peut se reparler.
      voixCourante()?.reveil();
      const jaiGagne = r.issue
        ? ((r.issue === 'challenger' && salle.current?.suisHote) ||
           (r.issue === 'opponent' && !salle.current?.suisHote))
        : !!maLigne && maLigne.place === 1 && !maLigne.abandon;
      if (jaiGagne) voixCourante()?.ouvrirMicro(MICRO_VAINQUEUR_MS);
      else voixCourante()?.fermerMicro();

      // Puis la liaison se coupe d'elle-meme a la fin de la review.
      //
      // Dix minutes, comptees a partir d'ici, apres quoi l'ecran ne montre
      // plus rien qu'on puisse encore appeler une course. La meme duree sert
      // quand il n'y a pas eu de video du tout — un appareil qui ne sait pas
      // encoder n'a aucune raison de garder une connexion ouverte plus
      // longtemps que les autres.
      //
      // Le micro, lui, est deja rendu : il ne l'est que pendant les fenetres
      // de parole. Ce qui s'eteint ici, c'est le canal d'ecoute — de quoi se
      // parler apres la course, sans que cela dure indefiniment.
      programmerFinVoix(FIN_VOIX_MS);

      setEtape('review');
    },
    // Les points du duel, quand la salle a fini d'ecrire. L'ecran de fin est
    // deja monte a cet instant : il les lit dans le moteur, comme le resultat.
    //
    // Et au journal, ou ils completent les lignes que le verdict a posees.
    onDuel: (d: DuelDirect) => {
      const moi = salle.current?.moi || '';
      // Les points d'une manche de tournoi qu'on n'a pas courue ne sont pas
      // les notres : ils effaceraient ceux de notre propre manche, que
      // l'ecran de fin montre encore. Hors tournoi, une course sans points
      // pour nous (pas de nom) n'avait rien a afficher de toute facon.
      if (!mesPointsDe(d, moi)) return;
      SprinterApp.G.liveDuel = d;
      const r = SprinterApp.G.liveResultat as (ResultatDirect & { moi: string }) | null;
      if (r) {
        inscrireAuJournal(r, moi, monCode, d.course ?? r.course ?? dateDepart.current,
                          !!salle.current?.suisHote, epreuvesDeLaSalle(),
                          mesPointsDe(d, moi));
      }
    },
    onSignal: (type: 'sdp' | 'ice', charge: any) => {
      // Un pair peut recevoir l'offre avant d'avoir monte sa connexion.
      if (!voixCourante()) ouvrirVoix();
      voixCourante()?.recu(type, charge);
    },
    onSorti: () => { setErreur(N.t('live_gone')); voixCourante()?.fermerMicro(); },
    onFerme: () => { if (etape === 'salon') setErreur(N.t('live_closed')); },
  });

  /**
   * @param eps la distance de la piste quand on la connait deja — celle que la
   *   salle a annoncee a qui la rejoint. Sans elle, c'est le selecteur : on
   *   ouvre la piste, c'est donc nous qui la choisissons.
   */
  const brancher = (c: string, eps?: string[] | null, enTournoi = false) => {
    const s = new Salle(c, ecouteurs(c));
    salle.current = s;
    poserSalon(s);
    // Par ou passera la voix, demande maintenant plutot qu'au debut de la
    // presentation : l'aller-retour au serveur se fait pendant qu'on attend
    // l'adversaire dans le salon, et non dans les mille cinq cents
    // millisecondes qui precedent l'annonce du premier athlete.
    prechargerGlace();
    brancherSalle({
      position: (d: number, c?: number) => s.position(d, c),
      fini: (ms: number) => s.fini(ms),
      // Un faux depart elimine : la salle doit le savoir pour trancher
      // la course des autres (voir signalerFauxDepartDirect).
      abandon: () => s.abandon(),
    });
    // La salle annonce le terrain de la course : le meme qu'on monte ici.
    s.connecter(eps && eps.length ? eps : [epreuve], NIVEAU_DIRECT, places, enTournoi);
  };

  /**
   * LE NOM D'ABORD, LA SALLE ENSUITE.
   *
   * Une course en direct compte au classement des duels, de deux a huit
   * couloirs, et elle y compte sous le nom de celui qui court. On ne part donc
   * pas sans un nom valide — reserve, et relie a cet appareil. Celui qu'on a
   * tape ici est enregistre et reserve dans le meme geste que le panneau
   * d'identite ; s'il manque, ou s'il appartient a quelqu'un d'autre, c'est ce
   * panneau qui s'ouvre, et la salle attend qu'il se referme sur un nom valide.
   *
   * Le nom tape est lu dans une reference, pas dans l'etat : un lien
   * `?direct=` et une invitation acceptee passent par une fonction capturee a
   * l'ouverture, et elle aurait enregistre le nom d'alors.
   */
  const [identite, setIdentite] = useState(false);
  const apresIdentite = useRef<(() => void) | null>(null);
  const nomTape = useRef(nom);
  nomTape.current = nom;

  const avecUnNom = async (suite: () => void) => {
    const n = nomTape.current.trim(); if (n) saveName(n);
    setOccupe(true); setErreur('');
    const verdict = await nomPourLeDirect();
    setOccupe(false);
    if (verdict === 'ok') { suite(); return; }
    apresIdentite.current = suite;
    setIdentite(true);
  };

  const fermerIdentite = async () => {
    setIdentite(false);
    setNom(getSavedName());
    const suite = apresIdentite.current;
    apresIdentite.current = null;
    if (!suite) return;
    setOccupe(true);
    const verdict = await nomPourLeDirect();
    setOccupe(false);
    if (verdict === 'ok') suite();
    else setErreur(N.t('live_nom_requis'));
  };

  const creer = () => avecUnNom(async () => {
    setOccupe(true); setErreur('');
    const c = await ouvrirSalle();
    setOccupe(false);
    if (!c) { setErreur(N.t('challenge_net')); return; }
    setCode(c); setEtape('ouverture');
    brancher(c, null, tournoi && tournoiPossible);
  });

  const rejoindre = (brut?: string) => {
    const c = (brut || saisie).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) return;
    return avecUnNom(async () => {
      setOccupe(true); setErreur('');
      const e = await etatSalle(c);
      setOccupe(false);
      if (!e || !e.existe) { setErreur(N.t('live_none')); return; }
      if (e.en_cours) { setErreur(N.t('tournoi_en_cours')); return; }
      if (e.complete) { setErreur(N.t('live_full')); return; }
      if (e.epreuves && e.epreuves[0]) setEpreuve(e.epreuves[0] as RaceKey);
      setCode(c); brancher(c, e.epreuves);
    });
  };

  /**
   * Pret ou pas, c'est la SALLE qui le dit.
   *
   * Le panneau tenait son propre booleen, et il mentait des qu'il n'etait pas
   * la pour suivre : remonte apres la course, il repartait de « pas pret »
   * alors que la salle, elle, gardait le oui de la course d'avant. Elle remet
   * maintenant tout le monde a zero a chaque verdict, et ce qu'on montre est
   * ce qu'elle a.
   */
  const pret = !!salle.current?.pretMoi;
  const basculerPret = () => { salle.current?.pret(!pret); };
  /**
   * La salle a coupe la liaison — apres la course, faute de revanche, ou
   * apres quelques minutes sans rien. Le code reste bon : on rouvre la meme
   * piste, et les autres la rejoignent en revenant.
   */
  const coupee = !!salle.current?.coupee && !salle.current?.enVie();
  const rouvrir = () => { setErreur(''); salle.current?.rouvrir(); };

  const quitter = () => {
    quitterSalon(); salle.current = null;
    brancherSalle(null);
    // La camera part avec la salle.
    //
    // Quitter, c'est renoncer a la course : celle qui tournait encore n'aura
    // pas de fin a filmer, et celle qui etait prete n'a plus d'ecran ou se
    // montrer — le panneau revient a son etat de repos, sans la carte video.
    // Garder le fichier serait garder quelques dizaines de mega-octets pour
    // personne.
    jeterLeFilm('direct');
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
    // Depuis les tribunes d'un tournoi, on en descend aussi.
    if (SprinterApp.G.spectateur && SprinterApp.G.liveOn &&
        (SprinterApp.G.state === 'count' || SprinterApp.G.state === 'race')) {
      SprinterApp.goHome();
    }
    remettreLeRegard();
    presEnCours.current = false; cibleDepart.current = null;
    dateDepart.current = null;
    setPresentation(null);
    setEtape('repos'); setCode(''); setSalon(null); setErreur('');
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
  // La salle d'abord : c'est elle qui sait ou elle en est, et elle le sait
  // encore quand ce panneau vient d'etre remonte.
  const vu = salle.current?.dernierEtat ?? salon;
  // Une piste refermee n'a plus personne dessus : la liste d'avant decrirait
  // des gens qui n'y sont plus.
  const joueurs: JoueurSalle[] = coupee ? [] : (vu?.joueurs || []);
  /**
   * La taille de la piste vient de la SALLE, pas du selecteur.
   *
   * Celui qui rejoint n'a rien choisi : la piste etait deja formee quand il est
   * arrive, et son propre selecteur est reste sur deux. C'est `max` qui fait
   * foi de part et d'autre, et le selecteur ne sert que le temps d'ouvrir.
   */
  const taille = vu?.max || places;
  /**
   * Le tournoi de cette piste, s'il y en a un. Lance — en manche ou entre
   * deux — il prend la place de la liste des couloirs et du bouton PRET : on
   * n'attend plus personne, on attend la manche suivante.
   */
  const leTournoi = coupee ? null : (vu?.tournoi || null);
  const tournoiEnCours = tournoiLance(leTournoi);
  /**
   * Une course vient de se jouer ici : se redeclarer pret, c'est demander la
   * revanche. La salle a remis tout le monde a « pas pret » au verdict, et
   * repart quand chacun a redit oui.
   */
  // Seul sur la piste, ce n'est pas une revanche : c'est un tour de plus.
  const apresCourse = !coupee && !!vu?.termine && taille > 1;
  const moiId = salle.current?.moi || '';
  const autresPrets = joueurs.filter(j => j.id !== moiId && j.pret).length;
  /**
   * Pleine, donc prete a partir.
   *
   * On lisait « au moins deux », ce qui etait vrai tant que le duel etait le
   * seul format. Sur une piste plus large, le bouton PRET s'allumait des le
   * deuxieme arrive alors que la salle, elle, attend que tous les couloirs
   * soient pris : on pouvait se declarer pret et ne rien voir se passer.
   */
  const complet = joueurs.length >= taille;
  /** Les couloirs encore libres, pour les montrer tels quels. */
  const libres = Math.max(0, taille - joueurs.length);

  // --- au repos : creer ou rejoindre ---------------------------------------
  if (etape === 'repos') {
    return (
      <>
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
            d'une course deja commencee.

            Un a huit, un par un. Les huit tiennent sur une ligne, ce qui evite
            d'avoir a choisir lesquels montrer — et le seul choix qu'on avait
            fait, les tailles paires, tombait exactement sur le cas le plus
            courant apres le duel : etre trois. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] tracking-widest text-muted-foreground text-center">
            {N.t('live_lanes')}
          </span>
          <div className="grid grid-cols-8 gap-1">
            {COULOIRS.map(n => (
              <button
                key={n}
                onClick={() => setPlaces(n)}
                aria-pressed={places === n}
                className={`py-1.5 rounded-lg font-mono font-bold text-xs transition-all border
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
          {tournoi && tournoiPossible
            ? N.t('tournoi_regle', { n: places, m: places - 1 })
            : N.t(places === 1 ? 'live_lanes_seul'
                : places === 2 ? 'live_lanes_duel'
                : 'live_lanes_course', { n: places })}
        </p>

        {/* LE TOURNOI A ELIMINATION. Un interrupteur plutot qu'un mode de
            plus : c'est la meme piste, le meme code, les memes couloirs —
            seulement, au lieu d'une course, une suite de manches ou le
            dernier sort. Il n'existe qu'a partir de trois : a deux, c'est
            deja la finale. */}
        <button
          onClick={() => setTournoi(v => !v)}
          disabled={!tournoiPossible}
          aria-pressed={tournoi && tournoiPossible}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors
            disabled:opacity-40 disabled:pointer-events-none
            ${tournoi && tournoiPossible
              ? 'bg-primary/10 border-primary/50'
              : 'bg-black/30 border-white/10 hover:bg-white/5'}`}
        >
          <Trophy className={`w-4 h-4 shrink-0 ${tournoi && tournoiPossible ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className={`text-[10px] font-bold tracking-widest
              ${tournoi && tournoiPossible ? 'text-primary' : 'text-foreground'}`}>
              {N.t('tournoi_titre')}
            </span>
            <span className="text-[9px] text-muted-foreground leading-snug">
              {N.t(tournoiPossible ? 'tournoi_option' : 'tournoi_min')}
            </span>
          </span>
          {/* L'interrupteur lui-meme : il dit l'etat sans qu'on ait a lire. */}
          <span className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors
            ${tournoi && tournoiPossible ? 'bg-primary' : 'bg-white/15'}`}>
            <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all
              ${tournoi && tournoiPossible ? 'left-[16px]' : 'left-[2px]'}`} />
          </span>
        </button>

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

      {/* Le panneau d'identite, par-dessus tout. Hors du volet : un lien
          `?direct=` arrive volet ferme, et un volet ferme ne rend rien. Par un
          portail : il est en `fixed`, et un cadre flou en ferait sinon son
          repere (voir le classement, plus bas, pour la meme raison). */}
      {identite && createPortal(
        <PanneauIdentite motif={N.t('live_nom_motif')} onFermer={() => { void fermerIdentite(); }} />,
        document.body,
      )}
      </>
    );
  }

  // --- salon : on attend, on partage, on se declare pret --------------------
  return (
    <>
    <motion.div
      {...MONTEE}
      className="bg-card/70 backdrop-blur-xl border border-emerald-400/30 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-3"
    >
      {/* Apres la course : la video, et son compte a rebours.

          Celle du DIRECT, et pas une autre. L'enregistreur est partage avec le
          one shot et le relais — un film qui n'est pas de cette course-ci n'a
          rien a faire dans ce salon. */}
      {film.genre === 'direct' &&
        (etape === 'review' || film.phase === 'prete' || film.phase === 'expiree') && (
        <ReviewVideo etat={film} onPartager={partagerLeFilm} />
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
          {N.t('live_room')} · {(RACES[epreuveDeLaSalle()] || RACES[epreuve]).label}
        </h3>
      </div>

      <div className="font-mono font-black text-3xl md:text-4xl tracking-[0.35em] text-emerald-300 text-center pl-[0.35em]">
        {code}
      </div>

      {/* Une piste ouverte en tournoi le dit des l'entree : qui la rejoint
          doit savoir qu'il ne court pas une course, mais une elimination. */}
      {leTournoi && (
        <div className="flex flex-col items-center gap-1 -mt-1">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/40
                           text-[10px] font-black tracking-[0.2em] text-primary">
            <Trophy className="w-3.5 h-3.5" />
            {N.t('tournoi_titre')}
            {tournoiEnCours && ` · ${nomDeManche(N,
              leTournoi.etat === 'manche' ? leTournoi.manche : leTournoi.manche + 1,
              leTournoi.manches, leTournoi.en_lice.length)}`}
          </span>
          {leTournoi.etat === 'inscription' && (
            <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug">
              {N.t('tournoi_regle', { n: taille, m: taille - 1 })}
            </p>
          )}
        </div>
      )}

      {/* LA PISTE S'EST REFERMEE. On le dit, et on la rouvre d'un geste :
          meme code, memes couloirs, meme distance. Avant, le salon restait
          affiche tel quel — le code, les noms, un bouton PRET qui ne partait
          nulle part — et il fallait quitter pour en ouvrir une autre. */}
      {coupee && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
            {N.t('live_coupee')}
          </p>
          <button
            onClick={rouvrir}
            className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background
                       bg-emerald-400 hover:bg-emerald-400/90 transition-colors
                       flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {N.t('live_rouvrir')}
          </button>
        </div>
      )}

      {/* Tant qu'on est seul, tout l'ecran sert a faire venir l'autre. Pas
          pendant un tournoi : un couloir libere par un elimine ne se reprend
          pas, la salle refuse les nouveaux venus. */}
      {!complet && !coupee && !tournoiEnCours && (
        <>
          <p className="text-[10px] md:text-xs text-muted-foreground text-center">
            {N.t('live_waiting', { n: taille })}
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

          {/* Choisir ses adversaires dans le classement des duels.
              Les boutons au-dessus supposent tous qu'on a deja la personne
              quelque part — un numero, une conversation. Celui-ci s'adresse a
              ceux qu'on ne connait que par leur pseudonyme : l'invitation
              part dans le jeu, et arrive chez eux dans la seconde. */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <button
              onClick={() => setChoisirAdversaires(true)}
              className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs
                         text-emerald-300 bg-emerald-400/10 border border-emerald-400/30
                         hover:bg-emerald-400/20 transition-colors flex items-center gap-2"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              {N.t('live_choisir')}
            </button>
            <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug">
              {conviesInfo.injoignable
                ? N.t('live_injoignable', { n: conviesInfo.injoignable })
                : conviesInfo.ok > 0
                  ? N.t('live_convies', { n: String(conviesInfo.ok) })
                  : N.t('live_choisir_sub')}
            </p>
          </div>
        </>
      )}

      {/* Le classement, par-dessus le salon. On garde la salle ouverte
          derriere : choisir un adversaire ne doit pas faire perdre le code
          ni les joueurs deja arrives. */}
      {/* PAR UN PORTAIL, A LA RACINE DU DOCUMENT. Le cadre du panneau a un
          flou d'arriere-plan (`backdrop-blur-xl`), et un `backdrop-filter`
          fait de son element le repere de tout descendant en `position:
          fixed` : le classement, qui couvre l'ecran partout ailleurs, restait
          ici enferme dans le cadre, a defiler dans une boite de trois cents
          pixels. Le portail le sort du cadre sans rien changer d'autre. */}
      {choisirAdversaires && createPortal(
        <DuelRanking
          onClose={() => setChoisirAdversaires(false)}
          surInviter={async (nom: string) => {
            const r = await inviterEnDirect([nom], code);
            if (r.invites.length) {
              setConviesInfo(c => ({ ok: c.ok + 1, injoignable: null }));
              // Au journal, pour qu'on sache une semaine plus tard qui on a
              // convie. Seulement ceux qui ont ete joints : un injoignable
              // n'a rien recu, et l'inscrire laisserait croire le contraire.
              noterDefi({
                cle: `direct:${code}:${nom.trim().toLowerCase()}`,
                genre: 'direct', sens: 'lance', etat: 'attente', nom, salle: code,
              });
              return true;
            }
            // Injoignable n'est pas une panne : beaucoup de joueurs figurent au
            // classement sans avoir reserve leur nom. On le dit, plutot que de
            // laisser croire a un envoi qui n'a pas eu lieu.
            setConviesInfo(c => ({ ...c, injoignable: nom }));
            return false;
          }}
        />,
        document.body,
      )}

      {/* LE TOURNOI SE COURT : son tableau prend la place des couloirs, et la
          manche suivante celle du bouton PRET. Fini, son tableau reste au-
          dessus de la piste, le temps de redemander un tournoi a tout le
          monde. */}
      {leTournoi && (tournoiEnCours || leTournoi.etat === 'fini') && (
        <TableauTournoi t={leTournoi} joueurs={joueurs} moi={moiId} />
      )}
      {tournoiEnCours && <PretTournoi />}

      {!coupee && !tournoiEnCours && (<>
      <div className="flex flex-col gap-1.5">
        {joueurs.map((j, i) => (
          <div key={j.id}
               className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border
                 ${j.pret ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/10 bg-black/25'}`}>
            <span className="flex items-center gap-2 min-w-0">
              {/* Le couloir, puisqu'il y en a maintenant jusqu'a huit : c'est
                  la que l'on se cherchera des l'entree sur la piste. */}
              <span className="font-mono text-[10px] w-4 shrink-0 text-center text-muted-foreground">
                {j.couloir || i + 1}
              </span>
              <span className="text-xs md:text-sm font-bold tracking-wide text-foreground truncate">
                {j.nom}{j.hote ? ' ·' : ''}
              </span>
            </span>
            <span className={`text-[9px] md:text-[10px] font-bold tracking-widest shrink-0
              ${j.pret ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {N.t(j.pret ? 'live_ready' : 'live_notready')}
            </span>
          </div>
        ))}
        {/* Un couloir vide par couloir vide. Il n'y en avait qu'un, dessine
            des qu'on etait seul : sur une piste a six, on ne voyait pas les
            quatre places qui manquaient encore.

            La phrase ne se lit qu'une fois, sur le premier couloir libre. Sur
            les suivants elle ne dirait rien de plus que le trait pointille, et
            cinq fois la meme ligne se lit comme une erreur d'affichage. */}
        {Array.from({ length: libres }, (_, i) => (
          <div key={`libre-${i}`}
               className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/15 text-[10px] text-muted-foreground">
            <span className="font-mono w-4 shrink-0 text-center">
              {joueurs.length + i + 1}
            </span>
            <span className="truncate">{i === 0 ? N.t('live_empty_seat') : ''}</span>
          </div>
        ))}
      </div>

      {/* Apres une course, le meme bouton demande la revanche : la salle a
          remis tout le monde a « pas pret », et repart quand chacun a redit
          oui. Quand quelqu'un l'a deja demandee, on l'accepte. */}
      <button
        onClick={basculerPret}
        disabled={!complet}
        className={`w-full py-3 rounded-xl font-black font-display tracking-widest transition-colors
          disabled:opacity-40 disabled:pointer-events-none
          ${pret ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                 : 'bg-emerald-400 text-background hover:bg-emerald-400/90'}`}
      >
        {N.t(pret ? 'live_unready'
           : apresCourse && leTournoi ? 'tournoi_rejouer'
           : apresCourse ? (autresPrets > 0 ? 'live_rev_accepter' : 'live_revanche')
           : 'live_go')}
      </button>
      </>)}

      {/* Le tchat rapide (TchatRapide.tsx) : ici plutot qu'en bouton
          flottant, qui aurait mordu sur JE SUIS PRET. */}
      {TCHAT_RAPIDE_OUVERT && (
        <button onClick={() => ouvrirChoixRapide()}
                className="w-full py-2 rounded-xl text-[11px] font-black font-display tracking-[0.2em]
                           text-primary bg-white/5 hover:bg-white/10 border border-white/10
                           flex items-center justify-center gap-2 transition-colors">
          <IconeRapide className="w-4 h-4" />
          {N.t('rapide_ouvrir').toUpperCase()}
        </button>
      )}

      {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}

      <button onClick={quitter}
              className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
        {N.t('live_leave')}
      </button>
    </motion.div>
    </>
  );
}
