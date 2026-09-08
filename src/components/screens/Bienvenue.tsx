import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { paysDe } from '@/game/identity';
import { PanneauIdentite } from './NameChip';
import { tourVu, TOUR_VU } from './GameTour';

/** Le joueur est alle au bout des trois questions, une fois. */
const VUE = 'sprinter_bienvenue_vue';

export function bienvenueVue(): boolean {
  try { return localStorage.getItem(VUE) === '1'; } catch { return true; }
}
export function marquerBienvenueVue() {
  try { localStorage.setItem(VUE, '1'); } catch { /* sans memoire, elle reviendra */ }
}

/**
 * LA QUESTION DU NOM, POSEE UNE FOIS, AU DEBUT.
 *
 * Elle se posait partout ailleurs. Un champ « ton nom » attendait a la fin
 * d'un one shot, un autre dans le bandeau de record mondial, un troisieme au
 * fond du TOP 500 : trois formulaires pour une seule information, et toujours
 * au pire moment — le joueur venait de battre son record et devait taper son
 * pseudo avant de pouvoir le lire. La question remonte donc ici, avant la
 * premiere course, la ou elle ne coupe rien.
 *
 * QUAND ELLE S'OUVRE. Sur l'accueil, une fois la visite du jeu terminee, tant
 * qu'il manque le nom ou la nationalite. C'est la puce du nom, en haut de
 * l'accueil, qui sert a tout modifier ensuite.
 *
 * APRES LA VISITE, ET PAS AVANT. Au tout premier lancement les deux se
 * presentent en meme temps : la visite explique ce qu'il y a a faire ici, la
 * bienvenue demande qui l'on est. Empilees, elles ne se lisent ni l'une ni
 * l'autre — et demander son nom a quelqu'un qui n'a encore rien vu du jeu,
 * c'est la meilleure facon de lui faire toucher « PLUS TARD ».
 *
 * QUAND ELLE NE S'OUVRE PAS. Pendant une course, pendant une cinematique, sur
 * un ecran de fin : `state` doit valoir `title`. Une fois repoussee d'un
 * « PLUS TARD », elle se tait jusqu'au prochain lancement — reproposer la
 * meme fenetre a chaque retour a l'accueil serait la transformer en peage.
 *
 * ET UNE FOIS LES TROIS QUESTIONS VUES, PLUS JAMAIS. C'est ce que retient
 * `bienvenueVue`, sur l'appareil. On ne s'en remet pas au serveur pour le
 * savoir : la nationalite est FACULTATIVE, quelqu'un a parfaitement le droit
 * de n'en poser aucune, et rouvrir la fenetre a chaque lancement tant qu'il
 * manque un drapeau reviendrait a le harceler jusqu'a ce qu'il en choisisse un
 * au hasard. Aller au bout des trois pas — meme en les passant tous — suffit :
 * on a demande, la reponse est non, on n'y revient pas.
 */
export function Bienvenue() {
  const etat = useGameStore(s => s.state);
  const [ouvert, setOuvert] = useState(false);
  /** Repoussee pour ce lancement : elle ne se represente plus d'ici la. */
  const [repoussee, setRepoussee] = useState(false);
  /** La question n'est posee au serveur qu'une fois par lancement. */
  const demande = useRef(false);
  /** La visite du jeu est-elle finie ? Elle passe devant. */
  const [visiteFinie, setVisiteFinie] = useState(tourVu);

  useEffect(() => {
    if (visiteFinie) return;
    const finie = () => setVisiteFinie(true);
    window.addEventListener(TOUR_VU, finie);
    return () => window.removeEventListener(TOUR_VU, finie);
  }, [visiteFinie]);

  useEffect(() => {
    if (etat !== 'title' || !visiteFinie || repoussee || ouvert || demande.current) return;
    if (bienvenueVue()) return;
    demande.current = true;
    const nom = getSavedName().trim();
    // Sans nom, rien a demander au serveur : il n'a personne a qui rattacher
    // une nationalite, et la fenetre s'ouvre de toute facon.
    if (!nom) { setOuvert(true); return; }
    let vivant = true;
    paysDe(nom)
      .then(({ definitif }) => { if (vivant && !definitif) setOuvert(true); })
      // Reseau muet : on ne derange pas quelqu'un pour une nationalite qu'on
      // n'a pas su lire. Elle reste a portee depuis la puce du nom.
      .catch(() => { /* on se tait */ });
    return () => { vivant = false; };
  }, [etat, visiteFinie, repoussee, ouvert]);

  /**
   * `alBout` dit ce qui vient de se passer, et les deux cas ne se valent pas.
   *
   * Au bout des trois pas, on a pose la question en entier : on n'y revient
   * plus, jamais. Referme au premier pas — la croix, « PLUS TARD » — on n'a
   * rien demande de lisible : la fenetre se representera au prochain
   * lancement, une fois, comme aujourd'hui.
   */
  const fermer = useCallback((alBout?: boolean) => {
    if (alBout) marquerBienvenueVue();
    setOuvert(false);
    setRepoussee(true);
  }, []);

  if (!ouvert || etat !== 'title') return null;

  return <PanneauIdentite bienvenue onFermer={fermer} />;
}
