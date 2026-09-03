import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'motion/react';
import { SURGISSEMENT } from '@/lib/mouvement';
import { User, Check, Loader2, KeyRound, X, Instagram, Unlink, Flag, Lock } from 'lucide-react';
import { getSavedName, saveName } from '@/game/leaderboard';
import { claimName, savedCode, lierInstagram, instagramDe, lienInstagram,
         nations, paysDe, poserPays, type Nation } from '@/game/identity';
import { nettoyerInsta } from '@/game/insta';
import { Drapeau } from '@/components/Insignes';

/**
 * Le nom du joueur, la ou tout le monde passe.
 *
 * Il etait demande uniquement a la fin d'une course, dans le bandeau de
 * record, et modifiable seulement au fond de TOP 500 > MES COURSES. Un joueur
 * qui ne bat aucun record ne se voyait donc jamais proposer de nom, et celui
 * qui voulait le changer devait le chercher trois ecrans plus loin. Resultat :
 * des chronos anonymes et des noms qui ne suivent pas d'un appareil a l'autre.
 *
 * Il vit desormais sur l'accueil, en evidence tant qu'il est vide.
 */
export function NameChip() {
  const { N } = SprinterApp;
  const etatJeu = useGameStore(s => s.state);
  const [nom, setNom] = useState(getSavedName());

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState(nom);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'pris' | 'ok'>('repos');
  const [code, setCode] = useState(savedCode());
  const [insta, setInsta] = useState('');
  // Ce qui est reellement lie, distinct de ce qu'on tape : sans cette
  // distinction, le bouton ne saurait pas s'il doit lier ou delier.
  const [lie, setLie] = useState('');
  const [instaEtat, setInstaEtat] = useState<'repos' | 'envoi' | 'lie' | 'delie' | 'bad' | 'sansnom' | 'pasatoi'>('repos');

  /* La nationalite. OPTIONNELLE, et trois etats distincts qu'il ne faut pas
     confondre :
       `pays`     ce que le champ montre — donc ce que le joueur est en train
                  de choisir, pas forcement ce qui est enregistre ;
       `paysPose` ce qui EST enregistre, pour savoir si le bouton enregistre ou
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

  // Le nom peut aussi etre pose ailleurs — au bandeau de record, a la fin
  // d'un one shot. On le relit en revenant a l'accueil, sinon la puce
  // afficherait encore « choisis ton nom » alors qu'il vient d'etre choisi.
  useEffect(() => { setNom(getSavedName()); setCode(savedCode()); }, [etatJeu]);

  useEffect(() => {
    if (!ouvert) return;
    setSaisie(getSavedName()); setEtat('repos'); setInstaEtat('repos');
    // On rappelle le pseudo deja lie, pour ne pas le faire retaper.
    const n = getSavedName();
    setLie(''); setInsta('');
    if (n) instagramDe(n).then(v => { if (v) { setLie(v); setInsta(v); } });

    // La liste des pays vient du serveur : c'est lui qui sait nommer un titre
    // (« Champion du Maroc », pas « Champion de MA »), et deux tables du meme
    // fait auraient diverge a la premiere retouche.
    nations().then(setNationsListe);
    setPays(''); setPaysFige(''); setPaysVu(''); setPaysEtat('repos');
    paysDe(n).then(({ pays: p, definitif }) => {
      if (definitif) { setPays(p || ''); setPaysFige(p || ''); }
      else if (p) setPaysVu(p);     // vu, pas choisi : on propose, on ne coche pas
    });
  }, [ouvert]);

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
    const nom = nationsListe.find(n => n.code === p)?.nom || p;
    if (!window.confirm(N.t('pays_confirm').replace('{pays}', nom))) return;
    setPaysEtat('envoi');
    const r = await poserPays(p);
    if (r.etat === 'ok') {
      setPaysFige(r.pays || '');
      setPays(r.pays || '');
      setPaysEtat('pose');
    }
    else if (r.etat === 'deja-choisi') {
      // Le serveur a tranche : on se range sur ce qu'il dit plutot que de
      // laisser l'ecran montrer un pays qui n'est pas le bon.
      setPaysFige(r.pays || '');
      setPays(r.pays || '');
      setPaysEtat('deja');
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
    }
    else if (r.etat === 'sans-nom') setInstaEtat('sansnom');
    else if (r.etat === 'pas-a-toi') setInstaEtat('pasatoi');
    else setInstaEtat('bad');
  };

  const valider = async () => {
    const n = saisie.trim();
    if (n.length < 2) return;
    // On enregistre d'abord : le nom doit servir meme si le reseau est muet.
    saveName(n); setNom(n);
    setEtat('envoi');
    // Puis on tente de le reserver, ce qui donne le code de recuperation et
    // permet de retrouver ses courses sur un autre telephone.
    const r = await claimName(n);
    if (r.etat === 'reserve') { setCode(r.code); setEtat('ok'); }
    else if (r.etat === 'pris') setEtat('pris');
    else setEtat('ok');
    if (r.etat !== 'pris') setTimeout(() => setOuvert(false), 1200);
  };

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
        <div className="fixed inset-0 z-[58] bg-black/85 backdrop-blur-sm flex items-center justify-center
                        pointer-events-auto p-4">
          <motion.div
            {...SURGISSEMENT}
            className="w-full max-w-sm bg-card/95 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-primary">
                {N.t('name_title')}
              </span>
              <button onClick={() => setOuvert(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-4 h-4 opacity-70" />
              </button>
            </div>

            <p className="text-[10px] md:text-xs text-muted-foreground leading-snug">
              {N.t('name_why')}
            </p>

            <input
              value={saisie}
              onChange={e => { setSaisie(e.target.value); setEtat('repos'); }}
              onKeyDown={e => { if (e.key === 'Enter') valider(); }}
              placeholder={N.t('your_name')}
              maxLength={20}
              autoFocus
              className="bg-black/35 border border-white/10 rounded-xl px-3 py-2.5 text-base text-foreground
                         placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />

            {etat === 'pris' && (
              <p className="text-xs text-destructive">{N.t('name_taken')}</p>
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

            {/* La nationalite. Elle reste FACULTATIVE — on peut courir, se
                classer et gagner sans drapeau — mais elle est DEFINITIVE une
                fois posee, et il faut l'avoir posee pour se presenter a un
                championnat national.

                Deux etats, deux formes. Tant que rien n'est choisi : une
                liste, une suggestion a toucher, et un bouton qui demande
                confirmation en nommant le pays. Une fois choisi : plus de
                liste du tout. Laisser un menu deroulant qui ne repond plus
                serait pire que de ne rien afficher — on montre le drapeau, le
                nom, et le mot « definitif ». */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 pt-2">
                <Flag className="w-3 h-3" />{N.t('pays_title')}
                <span className="font-medium tracking-normal text-muted-foreground/60 normal-case">
                  · {N.t(paysFige ? 'pays_fige' : 'pays_opt')}
                </span>
              </span>

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
                  </div>

                  {/* La suggestion. Elle se TOUCHE, elle ne s'applique pas
                      toute seule : le serveur voit d'ou part la connexion, pas
                      pour qui l'on court. */}
                  {!pays && paysVu && (
                    <button
                      onClick={() => { setPays(paysVu); setPaysEtat('repos'); }}
                      className="self-start flex items-center gap-1.5 text-[9px] text-muted-foreground
                                 hover:text-foreground transition-colors text-left leading-snug"
                    >
                      <Drapeau pays={paysVu} className="text-[11px]" />
                      {N.t('pays_vu').replace('{pays}',
                        nationsListe.find(n => n.code === paysVu)?.nom || paysVu)}
                    </button>
                  )}
                </>
              )}

              <span className="text-[9px] text-muted-foreground leading-snug">
                {N.t(paysEtat === 'bad' ? 'pays_bad'
                   : paysEtat === 'sansnom' ? 'pays_first'
                   : paysEtat === 'deja' ? 'pays_deja'
                   : paysFige ? 'pays_on'
                   : 'pays_why')}
              </span>
            </div>

            {/* Instagram : un lien declare, pas une connexion. L'API qui
                permettait de se connecter avec un compte personnel a ete
                retiree par Meta fin 2024 ; on demande donc le pseudo, et le
                serveur verifie seulement que le nom de joueur est bien a
                nous — sans quoi on pourrait accrocher le compte d'un autre. */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 pt-2">
                <Instagram className="w-3 h-3" />{N.t('insta_title')}
              </span>
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
              </div>
              <span className="text-[9px] text-muted-foreground leading-snug">
                {N.t(instaEtat === 'bad' ? 'insta_bad'
                   : instaEtat === 'sansnom' ? 'insta_first'
                   : instaEtat === 'pasatoi' ? 'insta_notyours'
                   : instaEtat === 'delie' ? 'insta_gone'
                   : lie ? 'insta_on'
                   : 'insta_why')}
              </span>
              <span className="text-[9px] text-muted-foreground/70 leading-snug">
                {N.t('insta_note')}
              </span>
            </div>

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
          </motion.div>
        </div>
      )}
    </>
  );
}
