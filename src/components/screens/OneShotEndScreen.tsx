import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Ghost, Loader2, Copy, Check, MessageCircle, MessageSquare, Share2, Globe2, Swords, Radio, RotateCcw, ImageDown } from 'lucide-react';
import {
  getSavedName, saveName, qualifyingRaces, submitRaceRecord, NO_RUN_MS, NOM_PRIS,
  type RaceKey, type RaceOutcome,
} from '@/game/leaderboard';
import { primeTopNames } from '@/game/engine';
import {
  createChallenge, submitAttempt, challengeLink,
  shareText, whatsappUrl, smsUrl, canNativeShare, nativeShare,
} from '@/game/challenge';
import { pushReprise } from '@/game/history';
import { DuelRanking } from './DuelRanking';
import { nomDuRang } from '@/components/Insignes';
import { pique, relance } from '@/game/piques';
import { LaisserUnMot } from './MotDuel';
import type { DuelIssue } from '@/game/duels';
import { DUELS_OUVERTS } from '@/game/duels';
import { RECOMMENCER_OUVERT } from '@/game/canal';
import { verrouDeReprise, fauxDepartEstUneDefaite } from '@/game/reprise';
import { useTenirDansLEcran } from '@/hooks/use-tenir-dans-lecran';
import { partager as partagerAffiche, type Sortie } from '@/game/affiche';

/**
 * Chrono envoye au serveur apres une elimination au faux depart. Le duel se
 * tranche en comparant deux totaux : un abandon doit perdre, et cette marque
 * — la meme qui signale ailleurs une ligne sans course derriere elle — le dit
 * sans ajouter de colonne. C'est aussi la borne haute que le serveur accepte :
 * au-dela il rejette l'envoi, et le duel resterait ouvert alors qu'il est
 * bel et bien perdu.
 */
const DSQ_MS = NO_RUN_MS;

/** Chrono ou abandon, sans jamais appeler toFixed sur un null. */
function fmt(v: number | null | undefined, dnf: string) {
  return v == null ? dnf : `${v.toFixed(2)} s`;
}

/**
 * L'ENTREE EN CASCADE : UN PANNEAU APRES L'AUTRE, ET NON TOUS A LA FOIS.
 *
 * Cet ecran dit jusqu'a huit choses — le resultat, le duel, la pique, les
 * chronos face au fantome, le TOP 500, le defi a renvoyer, l'image a partager,
 * les boutons — et elles tombaient toutes dans la meme image. Celui qui vient
 * de gagner ou de perdre recevait un mur : rien ne disait par ou commencer, et
 * le seul mot qu'il attendait — REMPORTE, PERDU — se noyait dans le reste.
 *
 * Rien n'est retire ni replie. Les panneaux entrent l'un apres l'autre, dans
 * l'ordre ou ils sont ecrits — le titre d'abord, les boutons en dernier — et
 * la seconde que dure la descente est celle ou l'on lisait deja le titre.
 *
 * LE DECALAGE EST PORTE PAR LE PARENT, ET C'EST VOULU. La moitie des panneaux
 * est conditionnelle : un delai calcule panneau par panneau se serait decale
 * d'un cran des qu'il en manquait un, et les derniers auraient attendu pour
 * rien. `staggerChildren` ne compte que les enfants reellement rendus. Et si
 * l'un d'eux devait apparaitre apres coup, il entrerait seul, a la seconde ou
 * il arrive, sans rejouer toute la descente derriere lui.
 *
 * LA DESCENTE DURE MOINS D'UNE SECONDE, ET C'EST UN PLAFOND. On revient sur
 * cet ecran a chaque course, plusieurs fois par minute : la cascade doit se
 * remarquer une fois et ne jamais se faire attendre. Dans le cas courant —
 * titre, chronos, TOP 500, defi, boutons — le dernier panneau est pose au bout
 * de six dixiemes ; dans le plus charge, juste avant la seconde.
 */
const CASCADE: Variants = {
  repliee: {},
  ouverte: { transition: { delayChildren: 0.05, staggerChildren: 0.08 } },
};

/**
 * Un panneau qui entre. Opacite et glissement, rien d'autre : ce sont les deux
 * seules proprietes qu'un telephone anime sans refaire la mise en page, et la
 * hauteur que mesure `useTenirDansLEcran` reste donc juste des la premiere
 * image — sans quoi l'ecran se serait mis a l'echelle d'apres un contenu a
 * moitie arrive, puis aurait saute une fois la cascade finie.
 */
const VOLET: Variants = {
  repliee: { opacity: 0, y: 14 },
  ouverte: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/** Mouvement reduit : l'ordre reste — c'est la lecture qu'on etale, pas
 *  l'animation — et seul le glissement part. */
const VOLET_IMMOBILE: Variants = {
  repliee: { opacity: 0 },
  ouverte: { opacity: 1, transition: { duration: 0.2 } },
};

export function OneShotEndScreen() {
  const { runTime, runSplits, shotRaces, ghostName, ghostTime, challenge, falseOut,
          liveOn, liveNom, liveResultat } = useGameStore();
  const { N, RACES } = SprinterApp;

  // Ce qui depasse est reduit, pas cache — voir le crochet.
  const { cadre, contenu, echelle, hauteur, serre } = useTenirDansLEcran();

  // Les panneaux entrent l'un apres l'autre — voir CASCADE.
  const doux = useReducedMotion();
  const volet = doux ? VOLET_IMMOBILE : VOLET;

  const [name, setName] = useState(getSavedName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [sent, setSent] = useState(false);
  // Retient le defi deja envoye, pas un simple booleen : si l'ecran survit
  // au passage d'un defi au suivant, un booleen bloquerait le second envoi.
  const submitted = useRef<string | null>(null);
  /** La revanche deja envoyee — evite un doublon si l'ecran se rejoue. */
  const revancheEnvoyee = useRef<string | null>(null);
  /**
   * Le nom de celui a qui la revanche vient de partir.
   *
   * Il double `G.revanche`, et il le faut : G est vide des l'envoi — sans quoi
   * la course suivante repartirait vers le meme adversaire — et l'ecran
   * perdrait a la seconde meme sa confirmation, pour se rabattre sur « DEFIER
   * UN AMI » alors que le defi vient de partir tout seul.
   */
  const [revancheFaite, setRevancheFaite] = useState<string | null>(null);
  /** Qui l'on visait, meme si le serveur n'a finalement touche personne. */
  const [revancheVise, setRevancheVise] = useState<string>('');
  // Issue du duel telle que le serveur l'a tranchee. Elle ne depend pas du
  // chrono affiche ici : c'est lui qui fait foi, et il ne se rejoue pas.
  const [duel, setDuel] = useState<DuelIssue | null>(null);
  const [duelEnCours, setDuelEnCours] = useState(!!challenge);
  const [voirDuels, setVoirDuels] = useState(false);
  /**
   * Ou en est l'image de la course.
   *
   * Quatre etats et pas un booleen « en cours » : ce qui arrive au bout n'est
   * pas toujours le meme geste. Sur un telephone l'image part dans une
   * application, sur un ordinateur elle se range dans les telechargements, et
   * annoncer « envoye » a quelqu'un qui vient de recevoir un fichier est le
   * genre de petit mensonge qui se voit tout de suite.
   */
  const [affiche, setAffiche] = useState<'repos' | 'fabrique' | Sortie>('repos');
  // La phrase de resultat ne se joue qu'une fois par defi.
  const sonne = useRef(false);

  // Les chronos d'un one shot ou d'un defi valent ceux de la carriere : un
  // 100 m reste un 100 m. On les propose donc au TOP 500, epreuve par epreuve
  // dans la categorie PAR COURSE, et seulement ceux qui y entrent vraiment.
  const [outcomes, setOutcomes] = useState<RaceOutcome[] | null>(null);
  const [topName, setTopName] = useState(getSavedName());
  const [topStatus, setTopStatus] = useState<'checking' | 'idle' | 'sending' | 'done' | 'error' | 'pris'>('checking');

  useEffect(() => {
    let cancelled = false;
    qualifyingRaces(shotRaces as RaceKey[], runSplits)
      .then(list => {
        if (cancelled) return;
        setOutcomes(list);
        const aEnvoyer = list.filter(o => o.beatsOwn);
        if (!aEnvoyer.length) { setTopStatus('done'); return; }
        // Nom deja connu : on enregistre sans rien demander. Un chrono qui
        // ameliore son propre record n'a aucune raison d'attendre un clic,
        // et c'est deja ce que fait la carriere.
        const nom = getSavedName().trim();
        if (nom) envoyer(nom, aEnvoyer);
        else setTopStatus('idle');
      })
      .catch(() => { if (!cancelled) { setOutcomes([]); setTopStatus('error'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const envoyer = async (nom: string, liste: RaceOutcome[]) => {
    saveName(nom);
    setTopStatus('sending');
    try {
      for (const t of liste) await submitRaceRecord(t.race, nom, t.ms);
      primeTopNames();          // le plateau olympique se met a jour
      setTopStatus('done');
    } catch (e) {
      // Un nom qui appartient a un autre appareil ne se debloque pas en
      // reessayant : on le dit, et on laisse le champ ouvert pour en changer.
      setTopStatus(e instanceof Error && e.message === NOM_PRIS ? 'pris' : 'error');
    }
  };

  // Seuls les chronos qui ameliorent le record personnel sont envoyes : le
  // serveur ecarterait les autres de toute facon.
  const tops = (outcomes || []).filter(o => o.beatsOwn);
  const kept = (outcomes || []).filter(o => !o.beatsOwn);

  const handleSaveTop = () => {
    const finalName = topName.trim();
    if (!finalName || !tops.length) return;
    envoyer(finalName, tops);
  };

  const cible = SprinterApp.G.challengeTarget as { scoreId: number; name: string } | null;
  const sansCible = SprinterApp.G.defiSansCible as string | null;

  // Message envoye a l'ami : chrono realise, code, lien direct.
  const msg = code ? shareText(code, shotRaces, runTime * 1000, N.getLang() === 'fr') : '';

  const ghostSplits: number[] = (SprinterApp.G.ghostSplits || []) as number[];
  const complete = runSplits.length === shotRaces.length && runSplits.every(s => s != null);

  /**
   * Fabrique l'image de la course et la fait sortir de l'application.
   *
   * Elle ne demande ni code, ni adversaire, ni nom : le partage textuel qui
   * vit plus bas a besoin d'un defi cree, celui-ci n'a besoin que d'un chrono.
   * C'est la raison d'etre du bouton — un joueur qui vient de courir seul
   * n'avait jusqu'ici rien a montrer.
   */
  async function partagerMaCourse() {
    setAffiche('fabrique');
    const sortie = await partagerAffiche({
      chronoMs: runTime * 1000,
      epreuves: shotRaces,
      nom: name || undefined,
      // Le fantome ne s'affiche que s'il a vraiment couru : `ghostTime` vaut
      // zero hors d'un defi, et un ecart calcule dessus annoncerait une
      // avance de neuf secondes sur personne.
      fantomeNom: aFantome ? ghostName : undefined,
      fantomeMs: aFantome ? ghostTime * 1000 : null,
    });
    setAffiche(sortie);
    // L'aveu revient au repos tout seul : ce n'est pas un etat durable, et un
    // « image enregistree » qui reste affiche jusqu'a la course suivante finit
    // par parler d'un fichier que le joueur a oublie.
    setTimeout(() => setAffiche('repos'), 3200);
  }
  const beaten = !!challenge && complete && runTime < ghostTime;
  /**
   * Un fantome a-t-il couru dans ce couloir ?
   *
   * Ce n'etait pas la meme question que « suis-je dans un defi », et les
   * confondre coutait tout l'ecran de la revanche : elle se court desormais
   * contre le fantome du vainqueur, hors de tout defi — l'ecran comparait donc
   * deux chronos qu'il refusait d'afficher l'un a cote de l'autre.
   *
   * `ghostTime` ne vaut plus zero que quand personne n'a couru : le one shot
   * ordinaire, le TOP 500, la course en direct le remettent a zero au depart.
   */
  const aFantome = ghostTime > 0;

  /**
   * Cette course venge un duel perdu, si `revancheId` est pose.
   *
   * `revancheMs` est le chrono qu'il fallait battre — celui qui nous a battus
   * la premiere fois. Tant qu'on ne l'a pas battu, le defi ne part pas : on
   * ne derange pas quelqu'un avec un temps moins bon que le sien. C'est la
   * seule condition ; les points du duel qu'on venge restent perdus, la
   * revanche n'efface rien, elle ouvre juste une seconde manche.
   */
  const revancheId = SprinterApp.G.revancheId as string | null;
  const revancheNom = SprinterApp.G.revanche as string | null;
  const revancheMs = (SprinterApp.G.revancheMs as number) || 0;
  const revancheBattue = !!revancheId && !falseOut && complete && runTime * 1000 < revancheMs;


  // Defi en cours : on envoie le resultat une seule fois, des l'arrivee.
  // Un faux depart eliminatoire s'envoie aussi — c'est une defaite, pas une
  // course qui n'a pas eu lieu, et l'adversaire doit toucher ses points.
  useEffect(() => {
    if (!challenge || submitted.current === challenge.id || (!complete && !falseOut)) return;
    submitted.current = challenge.id;
    setDuel(null); setDuelEnCours(true); sonne.current = false;
    submitAttempt({
      id: challenge.id,
      totalMs: falseOut ? DSQ_MS : runTime * 1000,
      splits: falseOut ? [] : runSplits.map(s => (s || 0) * 1000),
      name: getSavedName() || undefined,
      // Ma course devient a son tour un fantome : celui que l'adversaire
      // aura a courir s'il perd et prend sa revanche. Un faux depart n'a
      // rien enregistre, et il n'y a rien a faire courir.
      traces: falseOut ? [] : (SprinterApp.G.shotTraces || []),
    })
      .then(r => { setSent(true); setDuel(r.duel || null); })
      .catch(() => { /* le chrono local reste affiche */ })
      .finally(() => setDuelEnCours(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge && challenge.id, complete, falseOut]);

  // La musique du resultat. Elle ne part qu'une fois l'issue connue : jouer
  // une fanfare avant de savoir qui a gagne serait pire que le silence.
  // Apres un faux depart la phrase de defaite a deja retenti pendant la
  // cinematique, on ne la rejoue pas.
  useEffect(() => {
    if (!duel || sonne.current || falseOut) return;
    sonne.current = true;
    SprinterApp.Audio_.cue(duel.issue === 'opponent' ? 'fanfare'
                         : duel.issue === 'draw' ? 'win' : 'dirge');
  }, [duel, falseOut]);

  /**
   * Envoie la revanche toute seule, des que le chrono la bat.
   *
   * On n'attend pas un clic : la promesse du bouton « PRENDRE MA REVANCHE »
   * etait justement de ne plus avoir a recopier un code. Rien ne part si le
   * chrono ne bat pas `revancheMs` — le champ reste vide, et le bouton de
   * relance, plus bas, laisse retenter sans avoir perdu la trace de qui l'on
   * venge.
   *
   * Consommee des l'envoi : sans quoi une nouvelle course lancee depuis cet
   * ecran — un defi different, ou un fantome du TOP 500 — se retrouverait
   * elle aussi adressee a l'adversaire d'une revanche deja partie.
   */
  useEffect(() => {
    if (!revancheId || revancheEnvoyee.current === revancheId) return;
    if (!complete && !falseOut) return;          // la course n'est pas finie
    if (falseOut || !revancheBattue) return;      // pas battu : rien ne part
    revancheEnvoyee.current = revancheId;
    (async () => {
      setBusy(true); setErr(false);
      try {
        const { id, cible: prevenu } = await createChallenge({
          races: shotRaces as ('100' | '200' | '400')[],
          levelIdx: SprinterApp.G.shotLevel,
          totalMs: runTime * 1000,
          splits: runSplits.map(s => (s || 0) * 1000),
          traces: SprinterApp.G.shotTraces || [],
          name: name.trim() || undefined,
          revancheDe: revancheId,
        });
        setCode(id);
        setRevancheVise(revancheNom || '');
        // On annonce « envoye a X » seulement si le serveur a bien touche
        // quelqu'un. Sinon le code existe et c'est tout : on le dira comme
        // tel, plutot que d'affirmer une remise qui n'a pas eu lieu.
        setRevancheFaite(prevenu || '');
        SprinterApp.G.revanche = null;
        SprinterApp.G.revancheId = null;
        SprinterApp.G.revancheMs = 0;
      } catch {
        setErr(true);
        revancheEnvoyee.current = null;           // le prochain rendu retentera
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revancheId, complete, falseOut, revancheBattue]);

  /**
   * Repartir sur la meme course, contre le meme fantome, hors du defi.
   *
   * Sert deux fois : au perdant d'un defi qui prend sa revanche, et a celui qui
   * la retente apres l'avoir ratee. Les options du depart sont reprises telles
   * quelles — c'est ce qui embarque la trace de l'adversaire, ses chronos et son
   * nom — moins le defi lui-meme, qui est joue et ne se rejoue pas.
   *
   * Les reconstruire a la main aurait donne une course qui ressemble a la
   * premiere : meme distance, mais plus de fantome. C'est ce que faisait le
   * bouton avant aujourd'hui, et la revanche se courait sur une piste vide.
   */
  const memeCourseSansLeDefi = () => {
    const opts = (SprinterApp.G.shotOpts || {}) as any;
    SprinterApp.startOneShot(shotRaces as any, {
      ...opts,
      levelIdx: opts.levelIdx == null ? SprinterApp.G.shotLevel : opts.levelIdx,
      challenge: null,
    });
  };

  const handleCreate = async () => {
    const finalName = name.trim();
    if (finalName) saveName(finalName);
    setBusy(true); setErr(false);
    try {
      const { id } = await createChallenge({
        races: shotRaces as ('100' | '200' | '400')[],
        levelIdx: SprinterApp.G.shotLevel,
        totalMs: runTime * 1000,
        splits: runSplits.map(s => (s || 0) * 1000),
        traces: SprinterApp.G.shotTraces || [],
        name: finalName || undefined,
        targetScoreId: SprinterApp.G.challengeTarget?.scoreId ?? null,
      });
      setCode(id);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  // Le code se dicte, le lien s'envoie : les deux servent, on propose les deux.
  const handleCopy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : challengeLink(code));
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // presse-papiers refuse : le code reste lisible et recopiable a la main
    }
  };

  // Course en direct : l'issue vient de la salle, pas du chrono local — c'est
  // elle qui a vu les arrivees.
  const live = !!liveOn && !!liveResultat;

  /**
   * A DEUX, ET SEULEMENT A DEUX, la salle annonce un duel.
   *
   * Au-dela, elle envoie un ordre d'arrivee et rien d'autre : le bareme des
   * duels est fait pour une paire, et une course a huit n'en est pas une. Cet
   * ecran lisait pourtant `liveResultat.hote.id` sans condition — sur une
   * piste a quatre, six ou huit couloirs, la lecture echouait et emportait
   * TOUT l'ecran de fin. On ne voyait donc aucun resultat apres la course :
   * pas une omission d'affichage, une page qui tombait.
   */
  const duo = live && !!liveResultat.hote && !!liveResultat.invite;
  const monRole = duo && liveResultat.hote.id === liveResultat.moi ? 'hote' : 'invite';
  const liveNul = duo && liveResultat.issue === 'draw';
  const monMs = duo ? liveResultat[monRole].ms : 0;
  const sonMs = duo ? liveResultat[monRole === 'hote' ? 'invite' : 'hote'].ms : 0;

  /** L'ordre d'arrivee, quand il y a plus de deux couloirs sur la piste. */
  const classement: Array<{ place: number; id: string; nom: string; ms: number; abandon?: boolean }> =
    (live && !duo && Array.isArray(liveResultat.classement)) ? liveResultat.classement : [];
  const maLigne = classement.find(x => x.id === liveResultat?.moi) || null;

  const liveGagne = duo
    ? ((monRole === 'hote' && liveResultat.issue === 'challenger') ||
       (monRole === 'invite' && liveResultat.issue === 'opponent'))
    : !!maLigne && maLigne.place === 1;

  // D'ou sort-on : d'une victoire, d'une defaite, ou de nulle part ?
  //
  // Sert au ton du bouton qui mene au classement, et a rien d'autre. Le duel
  // tranche par le serveur fait foi quand il est connu — « opponent », c'est
  // celui qui releve le defi, donc nous ; avant sa reponse on se rabat sur le
  // chrono local, qui dit deja la meme chose dans presque tous les cas.
  //
  // Un faux depart en duel est une defaite meme sans chrono : c'est justement
  // la ou la vanne tombe le mieux.
  const issue: 'gagne' | 'perdu' | null =
      live ? (liveGagne ? 'gagne' : liveNul ? null : 'perdu')
    : challenge ? (falseOut ? 'perdu'
                 : duel ? (duel.issue === 'opponent' ? 'gagne'
                         : duel.issue === 'draw' ? null : 'perdu')
                 : beaten ? 'gagne' : 'perdu')
    : null;

  // La phrase du bouton, tiree d'une graine stable : le code du defi quand il
  // y en a un, le chrono sinon. Elle ne doit pas changer pendant qu'on lit.
  const mots = issue ? relance(issue, challenge?.id || String(runTime)) : null;

  // Ce qui interdit de rejouer, ou rien. `code` est l'identifiant du defi cree
  // depuis cette course : sa presence dit que le chrono est parti. `revanche`
  // marque une course lancee depuis un duel — elle survit a une reprise, sans
  // quoi il suffirait de rejouer une fois pour sortir de la chaine.
  const etatCourse = {
    // Une course en direct emprunte toute la plomberie du one shot et finit
    // ici, sans defi recu ni envoye. Sans cette ligne elle passait entre les
    // autres verrous et proposait de rejouer un duel deja tranche par la
    // salle, contre quelqu'un qui a couru au meme instant.
    courseEnDirect: !!liveOn,
    defiRecu: !!challenge,
    defiEnvoye: !!code,
    fauxDepart: falseOut,
    chaineDeDuel: !!SprinterApp.G.revanche,
  };
  const verrou = verrouDeReprise(etatCourse);
  // Un faux depart ne fait perdre que s'il y a quelqu'un a qui perdre. Seul
  // sur la piste, il arrete la course et rien d'autre.
  const defaiteSeche = fauxDepartEstUneDefaite(etatCourse);

  // PARTAGER partage sa rangee avec ACCUEIL quand l'ecran est serre et debout.
  // Seul, ACCUEIL prendrait une demi-largeur pour rien : il s'etale alors.
  const afficheAffiche = complete && !falseOut && runTime > 0;

  const dnf = N.t('dnf_short');

  return (
    <div ref={cadre} className="w-full h-full flex flex-col pointer-events-auto bg-black/90 backdrop-blur-md overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      {/* CENTRE QUAND IL Y A DE LA PLACE, ENTIER QUAND IL N'Y EN A PAS.

          `justify-center` faisait les deux mal : des que le contenu depassait,
          il debordait des DEUX cotes et le haut devenait inatteignable — le
          titre de l'ecran se retrouvait cent pixels au-dessus du premier pixel
          qu'on puisse faire defiler. On pouvait descendre, jamais remonter
          jusqu'a lui, et « DEFI REMPORTE » n'existait simplement plus.

          Les marges automatiques centrent aussi bien et s'effacent d'elles
          memes quand la place manque : rien ne sort de l'ecran par le haut. */}
      <div className="min-h-full flex flex-col items-center w-full">
        {/* La reduction vit sur ce calque-ci, et elle y vit seule : plus bas,
            chaque panneau porte sa propre transformation le temps d'entrer, et
            deux transformations sur le meme element s'ecrasent l'une l'autre.
            La hauteur reservee est celle d'apres reduction, sans quoi le
            conteneur croirait deborder encore. */}
        <div className="w-full my-auto flex flex-col items-center"
             style={{ height: hauteur ?? undefined }}>
        <div ref={contenu} className={`w-full flex flex-col items-center ${serre ? 'serre' : ''}`}
             style={echelle < 1
               ? { transform: `scale(${echelle})`, transformOrigin: 'top center' }
               : undefined}>
        <motion.div variants={CASCADE} initial="repliee" animate="ouverte"
          className="flex flex-col items-center max-w-2xl court:max-w-none w-full
                     py-4 md:py-8 court:py-1 serre:py-1 gap-3 md:gap-6 court:gap-0 serre:gap-1
                     colonnes-si-bas">

          <motion.div variants={volet} className="flex flex-col items-center text-center gap-1 md:gap-2 serre:gap-0">
            {/* Titre en trois mots : tracking-tighter les collait en un seul
                bloc. On respire un peu et on garde le mot entier soude. */}
            <h1 className={`text-3xl sm:text-4xl md:text-6xl court:text-xl font-black font-display tracking-tight uppercase text-balance drop-shadow-[0_0_30px_rgba(248,205,74,0.35)]
              ${falseOut || (challenge && !beaten) || (live && !liveGagne && !liveNul)
                ? 'text-destructive' : live && liveGagne ? 'text-emerald-400' : 'text-primary'}`}>
              {falseOut ? N.t('false_out')
                : live && !duo && maLigne
                  ? `${N.ord(maLigne.place)} ${N.t('live_sur', { n: classement.length })}`
                : live ? N.t(liveGagne ? 'live_won' : liveNul ? 'live_tie' : 'live_lost')
                : challenge ? N.t(beaten ? 'challenge_won' : 'challenge_lost')
                : N.t('oneshot_done')}
            </h1>
            {falseOut ? (
              <div className="text-[10px] sm:text-xs md:text-base court:text-[10px] font-bold text-destructive tracking-widest uppercase">
                {N.t(defaiteSeche ? 'false_out_sub' : 'false_out_seul')}
              </div>
            ) : (
              <div className="text-[10px] sm:text-xs md:text-base court:text-[10px] font-medium text-foreground/80 tracking-widest uppercase">
                {N.t('total_in')}<span className="text-white font-bold ml-1 md:ml-2">{runTime.toFixed(2)} s</span>
              </div>
            )}
            {aFantome && !falseOut && (
              <div className="text-[10px] sm:text-xs md:text-sm court:text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
                {N.t('challenge_gap', { s: (Math.abs(runTime - ghostTime)).toFixed(2) })}
              </div>
            )}
          </motion.div>

          {/* Course en direct : les deux chronos face a face. Le classement des
              duels est alimente par la salle elle-meme, donc rien a envoyer
              d'ici — seulement a montrer. */}
          {duo && (
            <motion.div
              variants={volet}
              className={`w-full rounded-2xl border px-4 py-4 flex flex-col items-center gap-2 shadow-2xl
                ${liveGagne ? 'border-emerald-400/50 bg-emerald-400/[0.10]'
                  : liveNul ? 'border-white/20 bg-white/5'
                  : 'border-destructive/50 bg-destructive/10'}`}
            >
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${liveGagne ? 'text-emerald-400' : liveNul ? 'text-foreground' : 'text-destructive'}`} />
                <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-muted-foreground">
                  {N.t('live_vs', { n: liveNom || N.t('ghost_label') })}
                </span>
              </div>
              <div className="w-full rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs md:text-sm font-bold tracking-wide text-primary">{N.t('duel_you')}</span>
                  <span className={`font-mono font-bold text-sm md:text-base ${liveGagne ? 'text-emerald-400' : 'text-foreground'}`}>
                    {(monMs / 1000).toFixed(2)} s
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs md:text-sm font-bold tracking-wide text-cyan-300 truncate min-w-0">
                    {liveNom || '—'}
                  </span>
                  <span className={`font-mono font-bold text-sm md:text-base ${liveGagne ? 'text-foreground' : 'text-destructive'}`}>
                    {(sonMs / 1000).toFixed(2)} s
                  </span>
                </div>
              </div>
              {!liveNul && (
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  {N.t('live_gap', { s: (Math.abs(monMs - sonMs) / 1000).toFixed(2) })}
                </span>
              )}
            </motion.div>
          )}

          {/* Plus de deux couloirs : c'est une course, et le resultat d'une
              course est son ordre d'arrivee. Rien au classement des duels —
              le bareme est fait pour une paire — mais il fallait bien montrer
              qui a gagne, ce qui ne se faisait nulle part. */}
          {live && !duo && classement.length > 0 && (
            <motion.div
              variants={volet}
              className={`w-full rounded-2xl border px-4 py-4 flex flex-col items-center gap-2 shadow-2xl
                ${liveGagne ? 'border-emerald-400/50 bg-emerald-400/[0.10]'
                  : 'border-white/15 bg-card/60'}`}
            >
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${liveGagne ? 'text-emerald-400' : 'text-foreground'}`} />
                <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-muted-foreground">
                  {N.t('live_ordre')}
                </span>
              </div>
              <div className="w-full rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5">
                {classement.map(l => {
                  const moi = l.id === liveResultat.moi;
                  return (
                    <div key={l.id} className={`flex items-center justify-between px-3 py-2
                      ${moi ? 'bg-primary/10' : ''}`}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`font-bold w-6 shrink-0 text-xs md:text-sm
                          ${l.place === 1 ? 'text-primary' : l.place === 2 ? 'text-slate-300'
                            : l.place === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {l.place}.
                        </span>
                        <span className={`font-bold tracking-wide truncate text-xs md:text-sm
                          ${moi ? 'text-primary' : 'text-foreground'}`}>
                          {moi ? N.t('duel_you') : l.nom}
                        </span>
                      </span>
                      <span className={`font-mono font-bold shrink-0 text-sm md:text-base
                        ${l.abandon ? 'text-destructive' : 'text-foreground'}`}>
                        {l.abandon ? N.t('dnf') : `${(l.ms / 1000).toFixed(2)} s`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* La pique, apres une course en direct perdue.
              Elle existait pour le defi differe et manquait ici, alors que
              c'est le moment ou elle porte le plus : l'autre vient de nous
              battre en meme temps que nous, et il est encore la. */}
          {live && !liveGagne && !liveNul && (
            <motion.div variants={volet} className="w-full rounded-xl border border-destructive/30 bg-destructive/[0.07]
                            px-4 py-3 flex flex-col items-center gap-1.5">
              <p className="text-sm md:text-base text-foreground text-center leading-snug">
                « {pique(`${liveNom}${monMs || (maLigne ? maLigne.ms : 0)}`,
                         duo ? liveNom : (classement[0] ? classement[0].nom : liveNom))} »
              </p>
              <span className="text-[10px] md:text-xs font-bold tracking-widest text-cyan-300
                               truncate max-w-full">
                {duo ? liveNom : (classement[0] ? classement[0].nom : liveNom)}
              </span>
            </motion.div>
          )}

          {/* Resultat du duel : les points comptent pour le classement des
              duels, et une seule fois. On l'annonce comme definitif parce
              qu'il l'est — relancer le meme defi ne redistribue rien. */}
          {challenge && (duelEnCours || duel) && (
            <motion.div
              variants={volet}
              className={`w-full rounded-2xl border px-4 py-3 md:py-4 court:px-3 court:py-2 serre:px-3 serre:py-1 flex flex-col items-center gap-1.5 serre:gap-0.5 shadow-2xl
                ${!duel ? 'border-white/10 bg-card/60'
                  : duel.issue === 'opponent' ? 'border-primary/50 bg-primary/10'
                  : duel.issue === 'draw' ? 'border-white/20 bg-white/5'
                  : 'border-destructive/50 bg-destructive/10'}`}
            >
              <div className="flex items-center gap-2">
                <Swords className={`w-4 h-4 ${!duel ? 'text-muted-foreground'
                  : duel.issue === 'opponent' ? 'text-primary'
                  : duel.issue === 'draw' ? 'text-foreground' : 'text-destructive'}`} />
                <span className={`font-black font-display tracking-tight uppercase text-lg md:text-2xl court:text-base serre:text-base
                  ${!duel ? 'text-muted-foreground'
                    : duel.issue === 'opponent' ? 'text-primary'
                    : duel.issue === 'draw' ? 'text-foreground' : 'text-destructive'}`}>
                  {!duel ? N.t('duel_await')
                    : N.t(duel.issue === 'opponent' ? 'duel_won'
                        : duel.issue === 'draw' ? 'duel_tie' : 'duel_lost')}
                </span>
              </div>

              {duel && (
                <>
                  {/* Un duel deja tranche ne redistribue rien : afficher un
                      « 0 PL » laisserait croire a un match nul. */}
                  {typeof duel.lp === 'number' && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono font-black text-2xl md:text-3xl court:text-xl serre:text-lg
                                       tabular-nums text-foreground">
                        {duel.lp > 0 ? '+' : ''}{duel.lp}
                        <span className="text-xs font-normal ml-1 text-muted-foreground">
                          {N.t('duel_lp')}
                        </span>
                      </span>
                      {/* Un changement de division est le seul moment ou le
                          classement se raconte tout seul. On ne le laisse pas
                          passer dans une ligne de chiffres. */}
                      {duel.rang && (duel.monte || duel.descend) && (
                        <span className={`text-[10px] md:text-xs font-bold tracking-widest
                          ${duel.monte ? 'text-emerald-400' : 'text-destructive'}`}>
                          {N.t(duel.monte ? 'duel_promu' : 'duel_relegue', {
                            r: nomDuRang(duel.rang.etage, duel.rang.division),
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Gagne : le vainqueur est la, et l'autre est parti depuis
                      longtemps. C'est ici, et nulle part ailleurs, qu'il peut
                      lui laisser un mot.

                      Derriere le meme interrupteur que le classement des duels,
                      et pas seulement par prudence : le serveur refuse le depot
                      hors du canal de test. Sans cette condition, un joueur de
                      la vraie version verrait le champ, ecrirait sa phrase, et
                      recevrait un refus — on lui aurait promis quelque chose
                      qui n'existe pas encore. Les deux verrous s'ouvriront le
                      meme jour. */}
                  {DUELS_OUVERTS && duel.issue === 'opponent' && (
                    <LaisserUnMot duel={challenge.id}
                                  adversaire={challenge.owner_name || N.t('opponent')} />
                  )}

                  {/* Perdu : le mot de l'adversaire, et la revanche.
                      Un ecart de chronos est exact et froid ; c'est la phrase
                      qui donne envie de repartir, et le bouton qui le permet
                      dans la foulee. */}
                  {duel.issue === 'challenger' && (
                    <>
                      <p className="text-sm md:text-base text-foreground text-center leading-snug
                                    px-2 mt-0.5">
                        « {pique(challenge.id, challenge.owner_name)} »
                      </p>
                      <button
                        onClick={() => {
                          SprinterApp.G.revanche = challenge.owner_name;
                          SprinterApp.G.revancheId = challenge.id;
                          SprinterApp.G.revancheMs = challenge.total_ms;
                          // Le fantome qui vient de nous battre repart avec la
                          // revanche : sa trace est deja la, celle du defi
                          // qu'on vient de courir.
                          memeCourseSansLeDefi();
                        }}
                        className="mt-1 px-5 py-2.5 rounded-xl font-black font-display tracking-widest
                                   text-background bg-primary hover:bg-primary/90 transition-colors
                                   flex flex-col items-center leading-tight text-sm"
                      >
                        {N.t('duel_revanche')}
                        <span className="font-sans font-normal text-[9px] tracking-normal opacity-70">
                          {N.t('duel_revanche_sub')}
                        </span>
                      </button>
                    </>
                  )}
                  <span className="text-[10px] md:text-xs text-muted-foreground tracking-wide text-center">
                    {N.t('duel_vs', { n: challenge.owner_name || N.t('ghost_label') })}
                    {' · '}
                    {N.t(duel.deja ? 'duel_seen' : 'duel_final')}
                  </span>
                </>
              )}
            </motion.div>
          )}

          {/* Chronos epreuve par epreuve, face au fantome si defi */}
          <motion.div variants={volet} className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-8 court:p-2 serre:p-1.5 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-3 court:gap-1 serre:gap-1">
              {shotRaces.map((r, i) => {
                const mine = runSplits[i];
                const his = aFantome ? ghostSplits[i] : undefined;
                const ahead = mine != null && his != null && mine < his;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 md:px-4 md:py-3 court:px-2 court:py-1 serre:px-2 serre:py-0.5 rounded-xl border border-white/5 bg-black/20 gap-2">
                    <span className="font-bold tracking-wide text-foreground text-sm md:text-base court:text-xs serre:text-xs truncate">
                      {RACES[r].label}
                    </span>
                    <div className="flex items-center gap-3 md:gap-5 court:gap-2 shrink-0">
                      {his != null && (
                        <span className="font-mono text-xs md:text-sm court:text-[10px] serre:text-[10px] text-cyan-300/70">
                          {his.toFixed(2)} s
                        </span>
                      )}
                      <span className={`font-mono font-bold text-base md:text-lg court:text-xs serre:text-sm
                        ${mine == null ? 'text-destructive' : his == null ? 'text-primary' : ahead ? 'text-emerald-400' : 'text-destructive'}`}>
                        {fmt(mine, dnf)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 md:mt-4 pt-2 md:pt-4 court:mt-2 court:pt-2 serre:mt-1 serre:pt-1 border-t border-white/10 flex justify-between items-center px-2 md:px-4 gap-2">
              <span className="font-bold tracking-widest text-foreground uppercase text-sm md:text-base court:text-xs serre:text-xs min-w-0 truncate">
                {challenge ? N.t('you_label') : 'TOTAL'}
              </span>
              <span className={`font-mono font-black text-xl md:text-2xl court:text-sm serre:text-sm shrink-0 whitespace-nowrap
                ${falseOut ? 'text-destructive' : 'text-primary'}`}>
                {falseOut ? dnf : `${runTime.toFixed(2)} s`}
              </span>
            </div>
            {aFantome && (
              <div className="flex justify-between items-center px-2 md:px-4 gap-2 mt-1">
                <span className="font-bold tracking-widest text-cyan-300 uppercase text-sm md:text-base court:text-xs serre:text-xs min-w-0 truncate flex items-center gap-2">
                  <Ghost className="w-4 h-4 court:w-3 court:h-3 shrink-0" />
                  <span className="truncate">{ghostName || N.t('ghost_label')}</span>
                </span>
                <span className="font-mono font-black text-xl md:text-2xl court:text-sm serre:text-sm shrink-0 whitespace-nowrap text-cyan-300">{ghostTime.toFixed(2)} s</span>
              </div>
            )}
          </motion.div>

          {/* LE TOP 500 EN DEUX LIGNES.

              Il tenait un panneau entier — un titre, une phrase, une ligne
              encadree par epreuve, puis une confirmation — pour dire six
              nombres et un nom. Cent soixante pixels, qui en portrait
              repoussaient les boutons hors de l'ecran : on arrivait sur son
              resultat et il fallait defiler pour trouver RECOMMENCER.

              Rien n'est retire. Le titre porte desormais l'etat — on verifie,
              tant de chronos entrent, enregistres sous tel nom — et les
              chronos passent en une file qui se replie toute seule. Le
              formulaire, lui, ne s'affiche que quand il sert vraiment : sans
              nom connu, personne ne peut enregistrer a votre place. */}
          {(topStatus === 'checking' || (outcomes && outcomes.length > 0)) && (
            <motion.div variants={volet} className="w-full bg-card/60 border border-white/10 rounded-2xl p-2.5 sm:p-4 md:p-6 court:p-2 serre:p-1.5 shadow-2xl flex flex-col gap-1.5 court:gap-1.5 serre:gap-1">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-2 shrink-0">
                  <Globe2 className="w-4 h-4 court:w-3 court:h-3 text-primary" />
                  <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm court:text-[10px]">{N.t('top500')}</h2>
                </span>
                {topStatus === 'checking' && (
                  <span className="text-[10px] md:text-xs text-muted-foreground animate-pulse">
                    {N.t('os_top_checking')}
                  </span>
                )}
                {tops.length > 0 && (
                  <span className="text-[10px] md:text-xs text-primary font-bold tracking-wide">
                    · {N.t(tops.length > 1 ? 'os_top_intro_n' : 'os_top_intro', { n: tops.length })}
                  </span>
                )}
                {topStatus === 'done' && tops.length > 0 && (
                  <span className="text-[10px] md:text-xs text-muted-foreground">
                    · {N.t('os_top_saved', { n: topName.trim() })}
                  </span>
                )}
              </div>

              {outcomes && outcomes.length > 0 && (
                <>
                  <div className="flex flex-col gap-1">
                    {tops.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                        {tops.map((t, i) => (
                          <span key={'n' + i} className="whitespace-nowrap text-xs md:text-sm court:text-[10px]">
                            <span className="font-bold text-foreground">{t.race} m</span>{' '}
                            <span className="font-mono text-primary">{(t.ms / 1000).toFixed(2)} s</span>{' '}
                            <span className="text-muted-foreground">{N.ord(t.rank)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Chronos plus lents que son propre record. Le tableau ne
                        garde qu'un chrono par epreuve et par appareil, le
                        meilleur : envoyer celui-ci le remplacerait par un
                        moins bon. On l'annonce franchement, parce qu'une
                        petite ligne grise se lisait comme « rien ne s'est
                        passe ». */}
                    {kept.length > 0 && (
                      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/[0.07] px-3 py-1.5 flex flex-col gap-0.5">
                        {kept.map((t, i) => (
                          <p key={'k' + i} className="text-[10px] md:text-xs text-center leading-snug">
                            <span className="font-bold tracking-widest text-cyan-300">
                              {N.t('os_kept_title')}
                            </span>
                            {' · '}
                            <span className="text-foreground">
                              {N.t('os_kept_line', {
                                d: t.race,
                                s: ((t.ownMs || 0) / 1000).toFixed(2),
                                r: t.ownRank ? N.ord(t.ownRank) : '—',
                              })}
                            </span>
                            {' — '}
                            <span className="text-muted-foreground">
                              {N.t('os_kept_now', { s: (t.ms / 1000).toFixed(2) })}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {topStatus === 'done' ? null : (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={topName}
                          onChange={e => setTopName(e.target.value)}
                          placeholder={N.t('your_name')}
                          maxLength={20}
                          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 court:px-2 court:py-1.5 text-sm court:text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                        />
                        <button
                          onClick={handleSaveTop}
                          disabled={!topName.trim() || topStatus === 'sending'}
                          className="shrink-0 px-4 py-2 court:px-2 court:py-1.5 rounded-xl font-bold tracking-wide text-xs md:text-sm court:text-[10px] text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                        >
                          {topStatus === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {N.t('save_score')}
                        </button>
                      </div>
                      {topStatus === 'error' && (
                        <p className="text-center text-xs text-destructive">{N.t('score_save_fail')}</p>
                      )}
                      {topStatus === 'pris' && (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-center text-xs text-destructive">{N.t('score_name_taken')}</p>
                          <p className="text-center text-[10px] text-muted-foreground leading-snug">
                            {N.t('score_taken_help')}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Creer un defi a partir de cette course. Hors defi c'est le
              partage normal ; une revanche part toute seule des qu'elle bat
              le chrono qu'elle venge. */}
          {/* Un faux depart dans une revanche ne la termine pas : rien n'est
              parti chez l'adversaire, rien n'est perdu du duel qu'on venge —
              seule la tentative est brulee. Le panneau restait pourtant cache,
              et avec lui le seul bouton qui gardait la trace de qui l'on
              venge : il fallait repasser par RECOMMENCER, qui sort de la
              chaine. On le garde donc ouvert, sans le formulaire de creation
              — celui-la reste ferme, il n'y a pas de chrono a envoyer. */}
          {(!falseOut || !!revancheId) && (!challenge || beaten) && (
            <motion.div variants={volet} className={`w-full bg-card/60 border rounded-2xl p-3 sm:p-4 md:p-6 court:p-2 serre:p-1.5 shadow-2xl flex flex-col gap-3 court:gap-1.5 serre:gap-1.5
              ${beaten || revancheBattue || revancheFaite !== null
                ? 'border-primary/40' : 'border-white/10'}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 justify-center">
                <span className="flex items-center gap-2 shrink-0">
                  <Ghost className="w-4 h-4 court:w-3 court:h-3 text-primary" />
                  <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm court:text-[10px]">
                    {N.t(revancheFaite !== null ? 'duel_revanche_envoyee'
                       : revancheId ? (revancheBattue ? 'duel_revanche_envoyee' : 'duel_revanche_ratee_titre')
                       : beaten ? 'challenge_rematch' : 'challenge_make')}
                  </h2>
                </span>
                {/* La phrase qui expliquait le panneau vivait sous lui, en
                    ligne pleine ; a cote du titre elle dit la meme chose et
                    rend une ligne a l'ecran. */}
                {!code && !revancheId && revancheFaite === null && (
                  <span className="text-[10px] md:text-xs text-muted-foreground">
                    · {N.t(beaten ? 'challenge_rematch_sub' : 'challenge_share')}
                  </span>
                )}
              </div>
              {/* Defi adresse a quelqu'un du TOP 500 : on le rappelle, sinon
                  le joueur ne sait plus a qui son code va partir. */}
              {cible && (
                <p className="text-center text-[10px] md:text-xs text-cyan-300">
                  {N.t(code ? 'target_sent' : 'target_run', { n: cible.name, d: shotRaces[0] })}
                </p>
              )}
              {/* Defi lance depuis le classement des duels, mais la personne
                  n'a pas ete retrouvee au TOP 500 de cette epreuve : le code
                  existe, personne ne l'a recu. On le dit ici plutot que de
                  laisser croire qu'elle a ete prevenue. */}
              {!cible && !revancheId && revancheFaite === null && sansCible && (
                <p className="text-center text-[10px] md:text-xs text-amber-300/90 leading-snug">
                  {N.t('os_defi_sans_cible', { n: sansCible })}
                </p>
              )}
              {/* Revanche gagnee : le defi vient de partir tout seul, comme
                  pour une cible du TOP 500 — meme phrase, meme confiance. */}
              {!cible && (revancheFaite || (revancheId && revancheBattue)) && (
                <p className="text-center text-[10px] md:text-xs text-cyan-300">
                  {N.t(code ? 'target_sent' : 'target_run',
                       { n: revancheFaite || revancheVise || revancheNom, d: shotRaces[0] })}
                </p>
              )}
              {/* La revanche est partie, mais le serveur n'a retrouve
                  personne : le code existe, il reste a l'envoyer soi-meme. On
                  le dit plutot que d'affirmer une remise qui n'a pas eu lieu. */}
              {!cible && revancheFaite === '' && (
                <p className="text-center text-[10px] md:text-xs text-amber-300/90 leading-snug">
                  {N.t('os_revanche_sans_cible', { n: revancheVise })}
                </p>
              )}
              {/* Revanche pas encore gagnee : le chrono n'a pas suffi, rien
                  n'est parti, et le meme adversaire reste vise — on ne perd
                  pas la main en retentant. */}
              {!cible && revancheId && !revancheBattue && revancheFaite === null && (
                <div className="flex flex-col items-center gap-2.5">
                  <p className="text-center text-[10px] md:text-xs text-amber-300/90 leading-snug">
                    {N.t('duel_revanche_ratee', { n: revancheNom, s: (revancheMs / 1000).toFixed(2) })}
                  </p>
                  <button
                    onClick={memeCourseSansLeDefi}
                    className="px-5 py-2 rounded-xl font-black font-display tracking-widest text-xs md:text-sm
                               text-background bg-primary hover:bg-primary/90 transition-colors"
                  >
                    {N.t('duel_revanche')}
                  </button>
                </div>
              )}

              {/* La saisie manuelle — nom, puis « défier » — ne concerne pas
                  une revanche : elle part d'elle-meme, ou pas du tout. */}
              {!code && !revancheId && revancheFaite === null && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={N.t('your_name')}
                      maxLength={20}
                      className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 court:px-2 court:py-1.5 text-sm court:text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={handleCreate}
                      disabled={busy || !complete}
                      className="shrink-0 px-4 py-2 court:px-2 court:py-1.5 rounded-xl font-bold tracking-wide text-xs md:text-sm court:text-[10px] text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {busy ? N.t('challenge_making') : N.t(beaten ? 'challenge_rematch' : 'challenge_make')}
                    </button>
                  </div>
                  {err && <p className="text-center text-xs text-destructive">{N.t('challenge_net')}</p>}
                </>
              )}

              {code && (
                <div className="flex flex-col items-center gap-2">
                  <div className="font-mono font-black text-3xl md:text-4xl tracking-[0.35em] text-primary pl-[0.35em]">
                    {code}
                  </div>

                  {/* Envoi direct. WhatsApp et SMS acceptent un message
                      prerempli par simple lien. Snapchat et Instagram non :
                      ils passent par la feuille de partage du telephone. */}
                  <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground mt-1">
                    {N.t('share_send')}
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <a
                      href={whatsappUrl(msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {N.t('share_whatsapp')}
                    </a>
                    <a
                      href={smsUrl(msg)}
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: '#4FC3F7' }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {N.t('share_sms')}
                    </a>
                    {canNativeShare() && (
                      <button
                        onClick={() => nativeShare(msg, code)}
                        className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-2"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {N.t('share_other')}
                      </button>
                    )}
                  </div>
                  {canNativeShare() && (
                    <p className="text-[9px] md:text-[10px] text-muted-foreground text-center max-w-xs leading-snug">
                      {N.t('share_other_hint')}
                    </p>
                  )}

                  {/* Copier reste un repli : traite en lien discret pour que
                      la rangee d'envoi garde le premier plan. */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center pt-1">
                    <button
                      onClick={() => handleCopy('code')}
                      className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {copied === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'code' ? N.t('code_copied') : N.t('challenge_copy_code')}
                    </button>
                    <button
                      onClick={() => handleCopy('link')}
                      className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {copied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'link' ? N.t('challenge_copied') : N.t('challenge_copy')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {challenge && sent && (
            <motion.p variants={volet} className="text-[10px] md:text-xs text-muted-foreground tracking-wide">
              {N.t('challenge_from', { n: challenge.owner_name })} &middot; {challenge.id}
            </motion.p>
          )}

          {/* PARTAGER MA COURSE — une image, pas un code.
              Le partage qui vit plus haut envoie du texte : un code a six
              lettres dans une conversation ne ressemble a rien et personne ne
              le republie. Celui-ci sort une image de la course, et il ne
              demande ni defi ni adversaire — seulement un chrono.

              Il ne s'affiche donc pas aux memes conditions que le reste : une
              course non terminee ou un faux depart n'ont pas de chrono a
              montrer, et le bouton disparait plutot que de produire une image
              qui annoncerait un temps qui n'existe pas. */}
          {/* RECOMMENCER — le raccourci, et la raison de tout ce qui suit.
              Ce que les joueurs demandaient n'etait pas d'effacer un chrono
              mais d'en relancer un : apres un faux depart ou une course ratee,
              il fallait repasser par l'accueil, le menu, le mode, puis
              demarrer. Quatre ecrans pour refaire dix secondes de course.

              Le bouton est donc INCONDITIONNEL. Recommencer ne reprend rien a
              personne : la course qui vient de finir garde son chrono, et s'il
              etait parti dans un duel il y reste. Ce qui est acquis se dit
              juste en dessous, a cote du bouton et non a sa place. */}
          {/* Sur un ecran bas, cette barre traverse les colonnes et se met a
              l'horizontale : trois boutons empiles avec leurs phrases faisaient
              deux cents pixels d'un seul bloc, qu'aucune colonne ne pouvait
              prendre sans deborder. Chaque bouton garde la sienne, dessous. */}
          {/* CHAQUE BOUTON PORTE SA PHRASE.

              Elles vivaient dessous, en paragraphes : trois lignes de texte
              gris separees des boutons qu'elles expliquent, et trente pixels
              de perdus a chaque fois. Dedans, elles disent la meme chose au
              meme endroit — c'est deja ce que fait « PRENDRE MA REVANCHE »
              depuis le debut, et personne n'a jamais eu de mal a le lire. */}
          <motion.div variants={volet} className="flex flex-col gap-2 md:gap-4 court:gap-1.5 serre:gap-1 w-full max-w-md court:max-w-none mt-1 md:mt-2 court:mt-0 serre:mt-0
                          serre-debout:grid serre-debout:grid-cols-2 serre-debout:items-start
                          court:flex-row court:items-start court:[column-span:all]">
            {/* PARTAGER MA COURSE — une image, pas un code.
                Le partage qui vit plus haut envoie du texte : un code a six
                lettres dans une conversation ne ressemble a rien et personne
                ne le republie. Celui-ci sort une image de la course, et il ne
                demande ni defi ni adversaire — seulement un chrono. D'ou sa
                condition propre : une course non terminee ou un faux depart
                n'ont pas de chrono a montrer, et le bouton disparait plutot
                que de produire une image qui annoncerait un temps qui
                n'existe pas. */}
            {afficheAffiche && (
              <button
                onClick={partagerMaCourse}
                disabled={affiche === 'fabrique'}
                className="w-full court:flex-1 court:min-w-0 py-2.5 md:py-3 court:py-2 serre:py-1.5 serre-debout:order-4 rounded-xl font-black font-display tracking-widest serre-debout:tracking-normal
                           text-xs md:text-sm serre-debout:text-[10px] serre-debout:leading-tight text-primary bg-primary/10 border border-primary/30
                           hover:bg-primary/20 disabled:opacity-50 disabled:pointer-events-none
                           transition-colors flex flex-col items-center leading-tight gap-0.5"
              >
                <span className="flex items-center gap-2">
                  {affiche === 'fabrique'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ImageDown className="w-4 h-4" />}
                  {affiche === 'fabrique' ? N.t('affiche_making') : N.t('affiche_share')}
                </span>
                {/* Ce qui s'est reellement passe. « Enregistre » et « envoye »
                    ne se disent pas au meme moment, et le module rend lequel
                    des deux a eu lieu precisement pour qu'on ne devine pas. */}
                <span className="font-sans font-normal text-[9px] md:text-[10px] serre:text-[8px] serre-debout:leading-none tracking-normal opacity-80 leading-snug">
                  {affiche === 'telechargement' ? N.t('affiche_saved')
                    : affiche === 'echec' ? N.t('affiche_failed')
                    : N.t('affiche_hint')}
                </span>
              </button>
            )}
            <div className="flex flex-col gap-2 md:gap-4 court:gap-1 serre:gap-1 court:flex-1 court:min-w-0 serre-debout:contents">
            {RECOMMENCER_OUVERT && <button
              onClick={() => { pushReprise(); SprinterApp.recommencer(); }}
              className="w-full py-3 md:py-4 court:py-2 serre:py-1.5 serre-debout:order-1 serre-debout:col-span-2 rounded-xl font-black font-display text-base sm:text-lg md:text-xl court:text-sm serre:text-sm
                         tracking-widest text-background bg-emerald-400 hover:bg-emerald-300 transition-all
                         border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1
                         flex flex-col items-center leading-tight gap-0.5"
            >
              <span className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                {N.t('os_rejouer')}
              </span>
              <span className="font-sans font-normal text-[10px] md:text-xs court:text-[9px] serre:text-[9px] tracking-normal opacity-80 leading-snug">
                {N.t('os_rejouer_sub')}
              </span>
            </button>}

            {/* Ce qui est joue de la course precedente. Un constat, plus un
                verrou : il n'empeche plus rien, il informe. */}
            {verrou && (
              <p className={`text-center text-[11px] md:text-xs serre:text-[9px] serre-debout:order-2 serre-debout:col-span-2 tracking-wide leading-snug max-w-sm mx-auto
                ${verrou === 'faux_depart_duel' ? 'text-destructive font-bold'
                                                : 'text-muted-foreground'}`}>
                {N.t(verrou === 'course_directe' ? 'os_verrou_direct'
                   : verrou === 'defi_recu' ? 'os_verrou_recu'
                   : verrou === 'defi_envoye' ? 'os_verrou_envoye'
                   : 'os_verrou_faux')}
              </p>
            )}
            </div>
            <div className="flex flex-col gap-2 md:gap-4 court:gap-1 serre:gap-1 court:flex-1 court:min-w-0 serre-debout:contents">

            {/* Le classement s'AJOUTE au raccourci. Une version precedente le
                mettait a sa place le 5 septembre — mais defier quelqu'un est
                un autre ecran et un autre parcours, et la plainte des joueurs
                serait revenue ce jour-la telle quelle.
                Ferme tant que DUELS_OUVERTS vaut false (voir game/duels). */}
            {DUELS_OUVERTS && <button
              onClick={() => setVoirDuels(true)}
              className="w-full py-3 md:py-4 court:py-2 serre:py-1.5 serre-debout:order-3 serre-debout:col-span-2 rounded-xl font-black font-display text-base sm:text-lg md:text-xl court:text-sm serre:text-sm
                         tracking-widest text-background bg-primary hover:bg-primary/90 transition-all
                         border-b-4 border-amber-600 active:border-b-0 active:translate-y-1
                         flex flex-col items-center leading-tight gap-0.5"
            >
              <span className="flex items-center gap-2">
                <Swords className="w-4 h-4" />
                {N.t(mots ? mots.titre : 'os_defier')}
              </span>
              <span className="font-sans font-normal text-[10px] md:text-xs court:text-[9px] serre:text-[9px] tracking-normal opacity-80 leading-snug">
                {N.t(mots ? mots.sous : 'os_defier_sub')}
              </span>
            </button>}
            </div>
            <button onClick={() => SprinterApp.goHome()} className={`w-full court:flex-1 court:self-stretch py-3 md:py-4 court:py-2 serre:py-1.5 court:text-sm serre:text-sm serre-debout:order-5 ${afficheAffiche ? '' : 'serre-debout:col-span-2'} rounded-xl font-bold tracking-widest text-foreground bg-secondary hover:bg-secondary/80 transition-all border-b-4 border-black active:border-b-0 active:translate-y-1`}>
              {N.t('home')}
            </button>
          </motion.div>

        </motion.div>
        </div>
        </div>
      </div>

      {/* voirDuels ne peut devenir vrai que par le bouton lui-meme ferme tant
          que DUELS_OUVERTS vaut false ; le repeter ici est ce qui permet au
          bundler de le prouver sans suivre l'etat a l'execution. */}
      {DUELS_OUVERTS && voirDuels && <DuelRanking onClose={() => setVoirDuels(false)}
                                 epreuves={shotRaces as string[]} />}
    </div>
  );
}
