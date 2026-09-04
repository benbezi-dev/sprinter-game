import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'motion/react';
import { SURGISSEMENT } from '@/lib/mouvement';
import { User, Check, Loader2, KeyRound, X, Instagram, Unlink, Flag, Lock, LifeBuoy } from 'lucide-react';
import { getSavedName, saveName, NOM_CHANGE } from '@/game/leaderboard';
import { claimName, linkDevice, savedCode, lierInstagram, instagramDe, lienInstagram,
         nations, paysDe, poserPays, type Nation } from '@/game/identity';
import { nettoyerInsta } from '@/game/insta';
import { Drapeau } from '@/components/Insignes';
import { Recuperation } from './Recuperation';

/**
 * Le nom du joueur, la ou tout le monde passe.
 *
 * Il etait demande uniquement a la fin d'une course, dans le bandeau de
 * record, et modifiable seulement au fond de TOP 500 > MES COURSES. Un joueur
 * qui ne bat aucun record ne se voyait donc jamais proposer de nom, et celui
 * qui voulait le changer devait le chercher trois ecrans plus loin. Resultat :
 * des chronos anonymes et des noms qui ne suivent pas d'un appareil a l'autre.
 *
 * Il vit desormais sur l'accueil, en evidence tant qu'il est vide — et le
 * panneau qu'il ouvre est le MEME que celui de la bienvenue au premier
 * lancement (voir Bienvenue.tsx) : une seule fenetre d'identite, pas deux
 * formulaires qui divergeraient a la premiere retouche.
 */
export function NameChip() {
  const { N } = SprinterApp;
  const etatJeu = useGameStore(s => s.state);
  const [nom, setNom] = useState(getSavedName());
  const [ouvert, setOuvert] = useState(false);

  // Le nom peut aussi etre pose ailleurs — a la bienvenue, au bandeau de
  // record, a la fin d'un one shot. On le relit en revenant a l'accueil,
  // sinon la puce afficherait encore « choisis ton nom » alors qu'il vient
  // d'etre choisi.
  useEffect(() => { setNom(getSavedName()); }, [etatJeu]);
  // Et sans attendre le changement d'etat : la bienvenue vit a cote de la
  // puce, elle pose le nom sans que le moteur bouge d'un pouce.
  useEffect(() => {
    const relire = () => setNom(getSavedName());
    window.addEventListener(NOM_CHANGE, relire);
    return () => window.removeEventListener(NOM_CHANGE, relire);
  }, []);

  const vide = !nom;

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-1.5 md:gap-2
                    border transition-colors max-w-[45vw]
          ${vide
            ? 'bg-primary/20 border-primary/60 text-primary animate-pulse'
            : 'bg-card/80 backdrop-blur-md border-white/10 hover:bg-white/10 text-foreground/90'}`}
      >
        <User className={`w-3.5 h-3.5 md:w-4 md:h-4 ${vide ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="font-bold text-xs md:text-sm truncate">
          {vide ? N.t('name_set') : nom}
        </span>
      </button>

      {ouvert && (
        <PanneauIdentite onFermer={() => { setOuvert(false); setNom(getSavedName()); }} />
      )}
    </>
  );
}

/**
 * LA FENETRE D'IDENTITE : NOM, DRAPEAU, INSTAGRAM.
 *
 * Trois choses qui vont ensemble et ne se demandent qu'une fois. Elle s'ouvre
 * depuis la puce de l'accueil pour tout modifier, et toute seule au premier
 * lancement pour tout poser.
 *
 * DEUX FORMES, LES MEMES CHAMPS. A l'accueil, les trois sections sont la, d'un
 * bloc : on est venu changer quelque chose de precis, et le chercher derriere
 * deux ecrans serait une corvee.
 *
 * A LA BIENVENUE, UN PAS A LA FOIS. Le meme bloc y faisait une page entiere de
 * texte a lire avant d'avoir couru une seule fois — trois titres, trois
 * explications, deux avertissements — et le bouton passait sous le bord de
 * l'ecran. Chaque pas ne montre donc qu'un titre de deux mots, un champ et un
 * bouton. Ce que le champ fait se lit sur le champ.
 *
 * ET UNE SORTIE PARTOUT. Personne n'est retenu a l'entree d'un jeu de course.
 * Le drapeau, surtout, est definitif : le reclamer reviendrait a le faire
 * choisir au hasard.
 */
export function PanneauIdentite({
  onFermer, bienvenue = false,
}: {
  /**
   * Referme la fenetre. `alBout` vaut vrai quand les trois questions ont ete
   * posees jusqu'a la derniere — repondues ou passees, peu importe : ce qui
   * compte est qu'on les a VUES. La bienvenue s'en sert pour ne plus revenir
   * (voir Bienvenue.tsx) ; la puce de l'accueil n'en a que faire.
   */
  onFermer: (alBout?: boolean) => void;
  bienvenue?: boolean;
}) {
  const { N } = SprinterApp;

  /** Bienvenue : ou l'on en est. 0 le nom, 1 le drapeau, 2 Instagram. */
  const [pas, setPas] = useState(0);
  const DERNIER = 2;
  /** Hors bienvenue, tout est montre en meme temps. */
  const montre = (n: number) => !bienvenue || pas === n;
  const avancer = () => { if (pas >= DERNIER) onFermer(true); else setPas(pas + 1); };

  const [saisie, setSaisie] = useState(getSavedName());
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'pris' | 'est_un_code' | 'reseau' | 'ok'>('repos');
  const [code, setCode] = useState(savedCode());

  /* Ce qu'il faut pour sortir d'un essai qui n'aboutit pas.

     `autreCode` le code presente pour prouver que ce nom est bien a nous ;
     `nomDuCode` le nom auquel appartient un code colle dans le champ du nom ;
     `perdu`     la porte de secours est ouverte — on n'a plus de code du tout.

     Ces trois-la vivaient uniquement dans MES COURSES (`IdentityPanel`), trois
     ecrans plus loin. Le joueur qui se voit refuser son nom, lui, est ICI : le
     laisser devant « ce nom est deja pris » sans rien a faire, c'est lui dire
     de renoncer a ses courses. Ils restent donc a portee AUSSI a la bienvenue,
     ou le tout premier nom essaye est justement celui qu'on avait sur l'autre
     telephone. */
  const [autreCode, setAutreCode] = useState('');
  const [nomDuCode, setNomDuCode] = useState('');
  const [lien, setLien] = useState<'' | 'envoi' | 'lie' | 'mauvais' | 'inconnu' | 'erreur'>('');
  const [perdu, setPerdu] = useState(false);
  const [insta, setInsta] = useState('');
  // Ce qui est reellement lie, distinct de ce qu'on tape : sans cette
  // distinction, le bouton ne saurait pas s'il doit lier ou delier.
  const [lie, setLie] = useState('');
  const [instaEtat, setInstaEtat] = useState<'repos' | 'envoi' | 'lie' | 'delie' | 'bad' | 'sansnom' | 'pasatoi'>('repos');

  /* La nationalite. OPTIONNELLE, et trois etats distincts qu'il ne faut pas
     confondre :
       `pays`     ce que le champ montre — donc ce que le joueur est en train
                  de choisir, pas forcement ce qui est enregistre ;
       `paysFige` ce qui EST enregistre, pour savoir si le bouton enregistre ou
                  retire ;
       `paysVu`   ce que le serveur croit voir d'apres la connexion. Une
                  SUGGESTION, jamais un choix : quelqu'un qui joue depuis
                  Bruxelles peut courir pour le Maroc, et pre-cocher un drapeau
                  d'apres une adresse IP serait decider a sa place. */
  const [nationsListe, setNationsListe] = useState<Nation[]>([]);
  const [pays, setPays] = useState('');
  const [paysFige, setPaysFige] = useState('');
  const [paysVu, setPaysVu] = useState('');
  const [paysEtat, setPaysEtat] = useState<'repos' | 'envoi' | 'pose' | 'deja' | 'bad' | 'sansnom'>('repos');

  useEffect(() => {
    // On rappelle le pseudo deja lie, pour ne pas le faire retaper.
    const n = getSavedName();
    if (n) instagramDe(n).then(v => { if (v) { setLie(v); setInsta(v); } });

    // La liste des pays vient du serveur : c'est lui qui sait nommer un titre
    // (« Champion du Maroc », pas « Champion de MA »), et deux tables du meme
    // fait auraient diverge a la premiere retouche.
    nations().then(setNationsListe);
    paysDe(n).then(({ pays: p, definitif }) => {
      if (definitif) { setPays(p || ''); setPaysFige(p || ''); }
      else if (p) setPaysVu(p);     // vu, pas choisi : on propose, on ne coche pas
    });
  }, []);

  /**
   * Choisit la nationalite. Une fois, et l'ecran le dit avant.
   *
   * La confirmation n'est pas une politesse : c'est le seul endroit ou l'on
   * peut encore revenir en arriere. Le serveur refuse tout second choix, et il
   * n'existe volontairement aucune route pour defaire celui-ci — un doigt qui
   * glisse sur une liste de cinquante pays coute donc la saison entiere, si
   * rien ne s'interpose. On nomme le pays dans la question plutot que de
   * demander « confirmer ? », qui ne fait relire personne.
   */
  const choisirNationalite = async () => {
    const p = pays.trim().toUpperCase();
    if (!p || p === paysFige) return;
    const nomPays = nationsListe.find(n => n.code === p)?.nom || p;
    if (!window.confirm(N.t('pays_confirm').replace('{pays}', nomPays))) return;
    setPaysEtat('envoi');
    const r = await poserPays(p);
    if (r.etat === 'ok') {
      setPaysFige(r.pays || '');
      setPays(r.pays || '');
      setPaysEtat('pose');
      // Le drapeau vient de se poser : on le laisse se voir, puis on passe.
      if (bienvenue) setTimeout(avancer, 700);
    }
    else if (r.etat === 'deja-choisi') {
      // Le serveur a tranche : on se range sur ce qu'il dit plutot que de
      // laisser l'ecran montrer un pays qui n'est pas le bon.
      setPaysFige(r.pays || '');
      setPays(r.pays || '');
      setPaysEtat('deja');
      if (bienvenue) setTimeout(avancer, 900);
    }
    else if (r.etat === 'sans-nom' || r.etat === 'pas-a-toi') setPaysEtat('sansnom');
    else setPaysEtat('bad');
  };

  /**
   * Le meme bouton lie et delie, selon l'etat.
   *
   * Delier, c'est envoyer un pseudo vide : le serveur en fait un NULL, et le
   * profil disparait du TOP 500. Rien d'autre ne change — ni le nom, ni le
   * code de recuperation, ni les chronos.
   *
   * Avant d'envoyer, on nettoie : @pseudo, pseudo nu ou lien du profil colle
   * designent le meme compte, et c'est presque toujours avec l'arobase que le
   * pseudo est sous la main. On repose dans le champ ce qui sera enregistre,
   * pour que le joueur voie ce qu'il lie.
   */
  const basculerInsta = async () => {
    const delier = !!lie;
    const v = delier ? '' : insta.trim();
    if (!delier && v.length < 1) return;
    const propre = delier ? '' : nettoyerInsta(v);
    if (propre === null || (!delier && propre === '')) { setInstaEtat('bad'); return; }
    if (!delier && propre !== v) setInsta(propre);
    setInstaEtat('envoi');
    const r = await lierInstagram(propre);
    if (r.etat === 'ok') {
      setLie(r.insta || '');
      setInsta(r.insta || '');
      setInstaEtat(r.insta ? 'lie' : 'delie');
      // Dernier pas de la bienvenue : le compte est accroche, on laisse
      // l'aveu s'afficher une seconde et on rend la piste.
      if (bienvenue && r.insta) setTimeout(() => onFermer(true), 1100);
    }
    else if (r.etat === 'sans-nom') setInstaEtat('sansnom');
    else if (r.etat === 'pas-a-toi') setInstaEtat('pasatoi');
    else setInstaEtat('bad');
  };

  const valider = async () => {
    const n = saisie.trim();
    if (n.length < 2) return;
    // Le nom d'avant, pour pouvoir revenir dessus : ce qu'on vient de taper
    // n'est pas toujours un nom (voir `est_un_code` plus bas).
    const avant = getSavedName();
    // On enregistre d'abord : le nom doit servir meme si le reseau est muet.
    saveName(n);
    setEtat('envoi'); setLien(''); setPerdu(false);
    // Puis on tente de le reserver, ce qui donne le code de recuperation et
    // permet de retrouver ses courses sur un autre telephone.
    const r = await claimName(n);
    if (r.etat === 'reserve') {
      setCode(r.code); setEtat('ok');
      // A l'accueil le nom etait la seule raison d'ouvrir : la fenetre se
      // referme. A la bienvenue, on passe au drapeau — mais pas avant d'avoir
      // laisse voir le code de recuperation, qui ne se represente jamais.
      if (bienvenue) setTimeout(avancer, 2600);
      else setTimeout(() => onFermer(), 1200);
    }
    else if (r.etat === 'pris') setEtat('pris');
    else if (r.etat === 'est_un_code') {
      /* Le joueur a colle son code dans le champ du nom. Il n'a pas tort : il
         a perdu son nom, son code est ce qu'il lui reste, et c'est le seul
         champ visible. On remet chaque chose a sa place — le vrai nom dans le
         champ du nom, le code dans le sien — plutot que de garder ce code
         enregistre comme nom sur l'appareil. */
      saveName(avant);
      setSaisie(r.nom); setNomDuCode(r.nom);
      setAutreCode(n.toUpperCase());
      setEtat('est_un_code');
    }
    /* Le reseau muet ne se raconte plus comme une reussite. L'ecran disait
       « ENREGISTRÉ » et se fermait : le nom etait bien pose sur l'appareil,
       mais pas reserve — et rien ne disait qu'un autre pouvait encore le
       prendre. */
    else setEtat('reseau');
  };

  /**
   * Relier cet appareil au nom, code a l'appui.
   *
   * C'est la seule preuve d'appartenance que le jeu connaisse : pas de mot de
   * passe, pas d'e-mail. Sans elle il reste la demande de recuperation, plus
   * bas, qu'un humain tranche.
   */
  const relier = async () => {
    const n = saisie.trim();
    if (!n || !autreCode.trim()) return;
    setLien('envoi');
    const r = await linkDevice(n, autreCode);
    if (r === 'lie') {
      saveName(n);
      setCode(autreCode.trim().toUpperCase());
      setLien('lie'); setEtat('ok');
      /* On ne referme pas tout seul, contrairement a un simple enregistrement :
         ce qui s'affiche ici est le code retrouve, et il est a noter. */
    }
    else if (r === 'mauvais_code') setLien('mauvais');
    else if (r === 'inconnu') setLien('inconnu');
    else setLien('erreur');
  };

  /** Le titre d'un pas, deux mots et une ligne. Bienvenue seulement. */
  const titrePas = (icone: React.ReactNode, t: string, s: string) => (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 font-black font-display tracking-widest uppercase
                       text-primary text-base md:text-lg">
        {icone}{N.t(t)}
      </span>
      <span className="text-[11px] text-muted-foreground leading-snug">{N.t(s)}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[58] bg-black/85 backdrop-blur-sm flex items-center justify-center
                    pointer-events-auto p-4">
      <motion.div
        {...SURGISSEMENT}
        /* La carte defile : elle porte deja le nom, le pays et Instagram, et
           le bloc de recuperation peut s'ouvrir dessous. Sans cela, sur un
           telephone tenu a l'horizontale, le bouton ENREGISTRER passait
           sous le bord de l'ecran — hors d'atteinte. */
        className="w-full max-w-sm max-h-[88vh] overflow-y-auto bg-card/95 border border-white/10
                   rounded-2xl p-5 shadow-2xl flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-primary">
            {N.t(bienvenue ? 'bienvenue_titre' : 'name_title')}
          </span>
          <div className="flex items-center gap-3">
            {/* OU L'ON EN EST, EN TROIS POINTS. Trois pas sans compteur, c'est
                un formulaire dont on ne voit pas le bout ; avec, c'est court
                par construction — on sait des le premier ecran qu'il y en a
                deux autres, et qu'ils sont aussi petits. */}
            {bienvenue && (
              <div className="flex items-center gap-1.5" aria-hidden>
                {[0, 1, 2].map(i => (
                  <span key={i} className={`rounded-full transition-all duration-300
                    ${i === pas ? 'w-4 h-1.5 bg-primary'
                     : i < pas ? 'w-1.5 h-1.5 bg-primary/60' : 'w-1.5 h-1.5 bg-white/20'}`} />
                ))}
              </div>
            )}
            {/* La croix REPOUSSE, elle ne repond pas : la bienvenue se
                representera au prochain lancement. */}
            <button onClick={() => onFermer(false)} className="p-1.5 -mr-1.5 rounded-lg hover:bg-white/10">
              <X className="w-4 h-4 opacity-70" />
            </button>
          </div>
        </div>

        {!bienvenue && (
          <p className="text-[10px] md:text-xs text-muted-foreground leading-snug">
            {N.t('name_why')}
          </p>
        )}

        {/* ------------------------------------------------------- LE NOM */}
        {montre(0) && (
          <div className="flex flex-col gap-2">
            {bienvenue && titrePas(<User className="w-4 h-4" />, 'bv_nom_t', 'bv_nom_s')}

            <input
              value={saisie}
              onChange={e => { setSaisie(e.target.value); setEtat('repos'); setLien(''); }}
              onKeyDown={e => { if (e.key === 'Enter') valider(); }}
              placeholder={N.t('your_name')}
              maxLength={20}
              autoFocus
              className="bg-black/35 border border-white/10 rounded-xl px-3 py-2.5 text-base text-foreground
                         placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />

            {/* L'essai qui n'aboutit pas — et ce qu'on peut encore faire.

                Deux refus mènent ici : le nom est à quelqu'un, ou bien c'est
                un code qui a été collé dans le champ du nom. Les deux ouvrent
                la même porte : le code, puis — s'il ne l'a plus — la demande
                de récupération. */}
            {(etat === 'pris' || etat === 'est_un_code' || lien) && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-2">
                {etat === 'pris' && (
                  <>
                    <span className="text-xs font-bold text-destructive text-center">{N.t('name_taken')}</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-snug">
                      {N.t('id_taken_help')}
                    </span>
                  </>
                )}
                {etat === 'est_un_code' && (
                  <>
                    <span className="text-xs font-bold text-primary text-center">{N.t('id_is_code')}</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-snug">
                      {N.t('id_is_code_help', { n: nomDuCode })}
                    </span>
                  </>
                )}

                {lien !== 'lie' && (
                  <div className="flex gap-2">
                    <input
                      value={autreCode}
                      onChange={e => { setAutreCode(e.target.value.toUpperCase()); setLien(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') relier(); }}
                      placeholder={N.t('id_code_title')}
                      maxLength={10}
                      autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                      className="flex-1 min-w-0 bg-black/35 border border-white/10 rounded-xl px-3 py-2
                                 text-sm font-mono tracking-[0.25em] text-center text-foreground
                                 placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground
                                 focus:outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={relier}
                      disabled={!autreCode.trim() || lien === 'envoi'}
                      className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] text-background
                                 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                                 transition-colors flex items-center gap-1.5"
                    >
                      {lien === 'envoi' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {N.t('id_link')}
                    </button>
                  </div>
                )}

                {lien === 'lie' && (
                  <span className="text-xs font-bold text-primary text-center">
                    {N.t('id_linked', { n: saisie.trim() })}
                  </span>
                )}
                {lien === 'mauvais' && (
                  <span className="text-[10px] text-destructive text-center">{N.t('id_bad_code')}</span>
                )}
                {lien === 'inconnu' && (
                  <span className="text-[10px] text-destructive text-center">{N.t('id_unknown')}</span>
                )}
                {lien === 'erreur' && (
                  <span className="text-[10px] text-destructive text-center">{N.t('score_save_fail')}</span>
                )}

                {/* La porte de secours : plus de code, plus d'appareil relié.

                    Elle n'apparaît qu'ici, après un essai qui n'a pas abouti.
                    Offerte d'emblée, elle enverrait demander à un humain ce
                    qu'un code déjà en poche règle en deux secondes — et la
                    file des demandes se remplirait de gens qui n'ont rien
                    perdu. */}
                {perdu ? (
                  <Recuperation
                    nom={saisie.trim()}
                    surRetour={(c, n) => {
                      setCode(c); setSaisie(n);
                      setPerdu(false); setEtat('ok'); setLien('');
                    }}
                  />
                ) : (
                  (etat === 'pris' || lien === 'mauvais' || lien === 'inconnu') && (
                    <button
                      onClick={() => setPerdu(true)}
                      className="self-center text-[10px] font-bold tracking-widest text-muted-foreground
                                 hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <LifeBuoy className="w-3 h-3" /> {N.t('rec_lost')}
                    </button>
                  )
                )}
              </div>
            )}

            {etat === 'reseau' && (
              <p className="text-xs text-destructive text-center">{N.t('score_save_fail')}</p>
            )}
            {etat === 'ok' && code && (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-2 flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-primary flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" />{N.t('name_code')}
                </span>
                <span className="font-mono font-black tracking-[0.25em] text-primary text-lg">{code}</span>
                <span className="text-[9px] text-muted-foreground leading-snug">{N.t('name_code_why')}</span>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------- LE DRAPEAU

            FACULTATIF — on court, on se classe et on gagne sans — mais
            DEFINITIF une fois pose, et il faut l'avoir pose pour se presenter
            a un championnat national.

            Deux etats, deux formes. Tant que rien n'est choisi : une liste,
            une suggestion a toucher, et un bouton qui demande confirmation en
            nommant le pays. Une fois choisi : plus de liste du tout. Laisser
            un menu deroulant qui ne repond plus serait pire que de ne rien
            afficher — on montre le drapeau, le nom, et le cadenas. */}
        {montre(1) && (
          <div className={`flex flex-col gap-1.5 ${bienvenue ? '' : 'pt-1 border-t border-white/10'}`}>
            {bienvenue
              ? titrePas(<Flag className="w-4 h-4" />, 'bv_pays_t', 'bv_pays_s')
              : (
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 pt-2">
                  <Flag className="w-3 h-3" />{N.t('pays_title')}
                  <span className="font-medium tracking-normal text-muted-foreground/60 normal-case">
                    · {N.t(paysFige ? 'pays_fige' : 'pays_opt')}
                  </span>
                </span>
              )}

            {paysFige ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                              bg-primary/[0.08] border border-primary/30 text-primary">
                <Drapeau pays={paysFige} className="text-base shrink-0" />
                <span className="text-sm font-bold truncate">
                  {nationsListe.find(n => n.code === paysFige)?.nom || paysFige}
                </span>
                <Lock className="w-3 h-3 ml-auto shrink-0 opacity-60" />
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2 bg-black/35 border border-white/10
                                  rounded-xl px-2 focus-within:border-primary/50">
                    {pays
                      ? <Drapeau pays={pays} className="text-base shrink-0" />
                      : <Flag className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                    <select
                      value={pays}
                      onChange={e => { setPays(e.target.value); setPaysEtat('repos'); }}
                      className="flex-1 min-w-0 bg-transparent py-2 text-sm text-foreground
                                 focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="">{N.t('pays_aucun')}</option>
                      {nationsListe.map(n => (
                        <option key={n.code} value={n.code}>{n.nom}</option>
                      ))}
                    </select>
                  </div>
                  {/* A la bienvenue, CHOISIR est le bouton du pas, en bas :
                      deux boutons cote a cote pour une seule action, c'est la
                      moitie des gens qui appuie sur le mauvais. */}
                  {!bienvenue && (
                    <button
                      onClick={choisirNationalite}
                      disabled={paysEtat === 'envoi' || !pays}
                      className="shrink-0 px-3 py-2 rounded-xl font-bold tracking-wide text-[10px]
                                 border transition-colors flex items-center gap-1.5
                                 text-foreground bg-white/5 border-white/15 hover:bg-white/10
                                 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {paysEtat === 'envoi' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {N.t('pays_save')}
                    </button>
                  )}
                </div>

                {/* LA SUGGESTION SE TOUCHE, elle ne s'applique pas toute
                    seule : le serveur voit d'ou part la connexion, pas pour
                    qui l'on court. */}
                {!pays && paysVu && (
                  <button
                    onClick={() => { setPays(paysVu); setPaysEtat('repos'); }}
                    className={`self-start flex items-center gap-1.5 rounded-lg transition-colors text-left leading-snug
                      ${bienvenue
                        ? 'px-2.5 py-1.5 bg-white/5 border border-white/15 hover:bg-white/10 text-sm text-foreground'
                        : 'text-[9px] text-muted-foreground hover:text-foreground'}`}
                  >
                    <Drapeau pays={paysVu} className={bienvenue ? 'text-base' : 'text-[11px]'} />
                    {bienvenue
                      ? (nationsListe.find(n => n.code === paysVu)?.nom || paysVu)
                      : N.t('pays_vu').replace('{pays}',
                          nationsListe.find(n => n.code === paysVu)?.nom || paysVu)}
                  </button>
                )}
              </>
            )}

            {/* La phrase d'etat. A la bienvenue elle ne parle que quand il y a
                quelque chose a dire : le sous-titre du pas porte deja le
                « definitif », et le repeter en dessous serait du remplissage. */}
            {(!bienvenue || paysEtat !== 'repos' || paysFige) && (
              <span className="text-[9px] text-muted-foreground leading-snug">
                {N.t(paysEtat === 'bad' ? 'pays_bad'
                   : paysEtat === 'sansnom' ? 'pays_first'
                   : paysEtat === 'deja' ? 'pays_deja'
                   : paysFige ? 'pays_on'
                   : 'pays_why')}
              </span>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ INSTAGRAM

            Un lien declare, pas une connexion. L'API qui permettait de se
            connecter avec un compte personnel a ete retiree par Meta fin 2024 ;
            on demande donc le pseudo, et le serveur verifie seulement que le
            nom de joueur est bien a nous — sans quoi on pourrait accrocher le
            compte d'un autre. */}
        {montre(2) && (
          <div className={`flex flex-col gap-1.5 ${bienvenue ? '' : 'pt-1 border-t border-white/10'}`}>
            {bienvenue
              ? titrePas(<Instagram className="w-4 h-4" />, 'bv_insta_t', 'bv_insta_s')
              : (
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 pt-2">
                  <Instagram className="w-3 h-3" />{N.t('insta_title')}
                </span>
              )}
            <div className="flex gap-2">
              {lie ? (
                // Deja lie : on montre le compte plutot qu'un champ vide, et
                // le bouton propose la seule action qui reste utile.
                <a
                  href={lienInstagram(lie)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-1 px-3 py-2 rounded-xl
                             bg-primary/[0.08] border border-primary/30 text-primary
                             text-sm font-bold truncate hover:bg-primary/[0.14] transition-colors"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">@{lie}</span>
                </a>
              ) : (
                <>
                  <span className="flex items-center px-2 rounded-l-xl bg-black/35 border border-r-0 border-white/10 text-muted-foreground text-sm">@</span>
                  <input
                    value={insta}
                    /* L'arobase est deja dessinee a gauche du champ : celle
                       que le joueur tape ou colle ferait doublon, on la
                       retire a la volee plutot que de la lui reprocher. */
                    onChange={e => { setInsta(e.target.value.replace(/^\s*@+/, '')); setInstaEtat('repos'); }}
                    onKeyDown={e => { if (e.key === 'Enter') basculerInsta(); }}
                    placeholder={N.t('insta_ph')}
                    maxLength={40}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    className="flex-1 min-w-0 -ml-2 bg-black/35 border border-white/10 rounded-r-xl px-2 py-2 text-sm text-foreground
                               placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </>
              )}
              {/* Meme raison qu'au drapeau : a la bienvenue, l'action du pas
                  vit en bas, seule. Sauf pour delier, qui n'est pas l'action
                  du pas et n'a nulle part ailleurs ou aller. */}
              {(!bienvenue || lie) && (
                <button
                  onClick={basculerInsta}
                  disabled={instaEtat === 'envoi' || (!lie && !insta.trim())}
                  className={`shrink-0 px-3 py-2 rounded-xl font-bold tracking-wide text-[10px]
                              border transition-colors flex items-center gap-1.5
                              disabled:opacity-40 disabled:pointer-events-none
                    ${lie ? 'text-destructive bg-destructive/10 border-destructive/30 hover:bg-destructive/20'
                          : 'text-foreground bg-white/5 border-white/15 hover:bg-white/10'}`}
                >
                  {instaEtat === 'envoi' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {lie ? <Unlink className="w-3 h-3" /> : null}
                  {N.t(lie ? 'insta_unlink' : 'insta_link')}
                </button>
              )}
            </div>
            {(!bienvenue || instaEtat !== 'repos' || lie) && (
              <span className="text-[9px] text-muted-foreground leading-snug">
                {N.t(instaEtat === 'bad' ? 'insta_bad'
                   : instaEtat === 'sansnom' ? 'insta_first'
                   : instaEtat === 'pasatoi' ? 'insta_notyours'
                   : instaEtat === 'delie' ? 'insta_gone'
                   : lie ? 'insta_on'
                   : 'insta_why')}
              </span>
            )}
            {/* « Declare par toi, non verifie » se lit AUSSI a la bienvenue :
                c'est au moment ou l'on tape son pseudo que la phrase sert, pas
                trois ecrans plus tard. Elle tient sur une ligne grise. */}
            <span className="text-[9px] text-muted-foreground/70 leading-snug">
              {N.t('insta_note')}
            </span>
          </div>
        )}

        {/* -------------------------------------------------------- LE PIED

            UNE ACTION PAR PAS, ET UNE SORTIE. Le bouton plein fait la seule
            chose que ce pas propose ; sous lui, en gris, celle qui permet de
            s'en aller. Deux boutons de meme poids feraient hesiter la ou il
            n'y a rien a decider. */}
        {bienvenue ? (() => {
          // Ce pas est-il DEJA fait ? Un drapeau pose, un compte deja lie : le
          // bouton n'a plus son action a proposer, et le laisser grise sous
          // « CHOISIR » donnerait un ecran qui a l'air en panne. Il devient
          // alors ce qu'il reste a faire — continuer.
          const fait = pas === 1 ? !!paysFige : pas === 2 ? !!lie : false;
          const enCours = etat === 'envoi' || paysEtat === 'envoi' || instaEtat === 'envoi';
          /* Le nom EST-IL pose ? Sans lui, le pas suivant n'a rien a quoi se
             rattacher : le serveur refuse une nationalite comme un compte
             Instagram tant qu'aucun nom n'est reserve. « PLUS TARD » referme
             donc la fenetre entiere — c'est aussi ce que le mot promet — au
             lieu d'avancer dans le vide. Quelqu'un qui a deja un nom, lui,
             passe simplement au pas suivant. */
          const nomPose = !!getSavedName().trim();
          return (
          <div className="flex flex-col gap-1 pt-1">
            <button
              onClick={fait ? (pas === DERNIER ? () => onFermer(true) : avancer)
                     : pas === 0 ? valider : pas === 1 ? choisirNationalite : basculerInsta}
              disabled={!fait && (
                pas === 0 ? (saisie.trim().length < 2 || etat === 'envoi')
              : pas === 1 ? (paysEtat === 'envoi' || !pays)
              : (instaEtat === 'envoi' || !insta.trim())
              )}
              className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background
                         bg-primary hover:bg-primary/90 disabled:opacity-40 transition-colors
                         flex items-center justify-center gap-2"
            >
              {enCours && <Loader2 className="w-4 h-4 animate-spin" />}
              {N.t(fait ? (pas === DERNIER ? 'bienvenue_go' : 'bv_suite')
                 : pas === 0 ? 'bv_suite' : pas === 1 ? 'pays_save' : 'insta_link')}
            </button>
            {!fait && (
              <button
                onClick={pas === DERNIER ? () => onFermer(true)
                       : (pas === 0 && !nomPose) ? () => onFermer(false)
                       : avancer}
                className="w-full py-2 rounded-xl font-bold tracking-widest text-xs
                           text-muted-foreground hover:text-foreground transition-colors"
              >
                {N.t(pas === DERNIER ? 'bienvenue_go'
                   : pas === 0 ? (nomPose ? 'bv_passer' : 'bienvenue_plus')
                   : 'bv_passer')}
              </button>
            )}
          </div>
          );
        })() : (
          <button
            onClick={valider}
            disabled={saisie.trim().length < 2 || etat === 'envoi'}
            className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background
                       bg-primary hover:bg-primary/90 disabled:opacity-40 transition-colors
                       flex items-center justify-center gap-2"
          >
            {etat === 'envoi' && <Loader2 className="w-4 h-4 animate-spin" />}
            {etat === 'ok' && <Check className="w-4 h-4" />}
            {N.t(etat === 'ok' ? 'name_saved' : 'name_save')}
          </button>
        )}
      </motion.div>
    </div>
  );
}
