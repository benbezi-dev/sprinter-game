import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import {
  KeyRound, Copy, Check, Loader2, ShieldCheck, Smartphone, LifeBuoy, Instagram,
} from 'lucide-react';
import { getSavedName, saveName } from '@/game/leaderboard';
import {
  claimName, linkDevice, savedCode,
  nouveauTransfert, type Transfert,
  demanderRecuperation, etatRecuperation, type Recuperation,
} from '@/game/identity';
import { QrCarre } from './QrCarre';

/**
 * Identite du joueur : son nom, le code qui le lui reserve, et de quoi relier
 * un autre appareil. Pose dans MES COURSES, qui est deja l'espace personnel —
 * plutot que d'inventer un ecran de compte pour un jeu qui n'en a pas.
 *
 * Trois chemins mènent ici, et l'ecran doit les distinguer sans faire un
 * formulaire de banque :
 *
 *   · je reserve mon nom pour la premiere fois ;
 *   · j'ai un appareil qui me connait — on le vise, et c'est fini ;
 *   · je n'ai plus rien — il faut demander, et prouver.
 */
export function IdentityPanel() {
  const { N } = SprinterApp;
  const [nom, setNom] = useState(getSavedName());
  const [code, setCode] = useState(savedCode());
  const [voirCode, setVoirCode] = useState(false);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'pris' | 'code' | 'erreur'>('repos');
  const [nomDuCode, setNomDuCode] = useState('');
  const [copie, setCopie] = useState(false);

  const [autreCode, setAutreCode] = useState('');
  const [lien, setLien] = useState<'' | 'envoi' | 'lie' | 'mauvais' | 'inconnu' | 'erreur'>('');

  const reserver = async () => {
    const n = nom.trim();
    if (!n) return;
    setEtat('envoi');
    const r = await claimName(n);
    if (r.etat === 'reserve') {
      saveName(r.name); setNom(r.name); setCode(r.code); setVoirCode(true); setEtat('repos');
    } else if (r.etat === 'pris') setEtat('pris');
    else if (r.etat === 'code') {
      // Le joueur a colle son code dans le champ du nom. On ne le laisse pas
      // repartir avec un refus : on lui dit quel nom ce code ouvre, et on
      // prepare la liaison a sa place.
      setNomDuCode(r.name);
      setAutreCode(n.toUpperCase());
      setNom(r.name);
      setEtat('code');
    } else setEtat('erreur');
  };

  const relier = async () => {
    const n = nom.trim();
    if (!n || !autreCode.trim()) return;
    setLien('envoi');
    const r = await linkDevice(n, autreCode);
    if (r === 'lie') {
      saveName(n); setCode(autreCode.trim().toUpperCase());
      setLien('lie'); setEtat('repos');
    } else if (r === 'mauvais_code') setLien('mauvais');
    else if (r === 'inconnu') setLien('inconnu');
    else setLien('erreur');
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refuse : le code reste lisible */ }
  };

  return (
    <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-primary">
          {N.t('id_title')}
        </h3>
      </div>

      <div className="flex gap-2">
        <input
          value={nom}
          onChange={e => { setNom(e.target.value); setEtat('repos'); setLien(''); }}
          placeholder={N.t('your_name')}
          maxLength={20}
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm
                     text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <button
          onClick={reserver}
          disabled={!nom.trim() || etat === 'envoi'}
          className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                     bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                     transition-colors flex items-center gap-2"
        >
          {etat === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {code ? N.t('id_show') : N.t('id_reserve')}
        </button>
      </div>

      {/* Le code, revele a la demande : c'est la preuve d'appartenance. */}
      {code && voirCode && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex flex-col items-center gap-2">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
            {N.t('id_code_title')}
          </span>
          <span className="font-mono font-black text-2xl md:text-3xl tracking-[0.3em] text-primary pl-[0.3em]">
            {code}
          </span>
          <button
            onClick={copier}
            className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-primary
                       transition-colors flex items-center gap-1.5"
          >
            {copie ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copie ? N.t('code_copied') : N.t('challenge_copy_code')}
          </button>
          <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug">
            {N.t('id_code_note')}
          </p>
        </div>
      )}
      {code && !voirCode && (
        <button onClick={() => setVoirCode(true)}
                className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-primary
                           transition-colors flex items-center gap-1.5 self-start">
          <ShieldCheck className="w-3 h-3" /> {N.t('id_show')}
        </button>
      )}

      {/* Le code pris pour un nom : on explique, et on prepare la liaison. */}
      {etat === 'code' && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-1">
          <span className="text-xs font-bold text-primary text-center">{N.t('id_is_code')}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-snug">
            {N.t('id_is_code_help', { n: nomDuCode })}
          </span>
        </div>
      )}

      {/* Nom deja pris : on ne bloque pas, on explique et on propose le code. */}
      {(etat === 'pris' || etat === 'code' || lien) && (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 flex flex-col gap-2">
          {etat === 'pris' && (
            <>
              <span className="text-xs font-bold text-foreground text-center">
                {N.t('id_taken', { n: nom.trim() })}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-snug">
                {N.t('id_taken_help')}
              </span>
            </>
          )}
          {lien !== 'lie' && (
            <div className="flex gap-2">
              <input
                value={autreCode}
                onChange={e => { setAutreCode(e.target.value.toUpperCase()); setLien(''); }}
                placeholder={N.t('id_code_title')}
                maxLength={10}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2
                           text-sm font-mono tracking-[0.25em] text-center text-foreground
                           placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground
                           focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={relier}
                disabled={!autreCode.trim() || lien === 'envoi'}
                className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                           bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                           transition-colors flex items-center gap-2"
              >
                {lien === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {N.t('id_link')}
              </button>
            </div>
          )}
          {lien === 'lie' && (
            <span className="text-xs font-bold text-primary text-center">
              {N.t('id_linked', { n: nom.trim() })}
            </span>
          )}
          {lien === 'mauvais' && <span className="text-[10px] text-destructive text-center">{N.t('id_bad_code')}</span>}
          {lien === 'inconnu' && <span className="text-[10px] text-destructive text-center">{N.t('id_unknown')}</span>}
          {(lien === 'erreur' || etat === 'erreur') && (
            <span className="text-[10px] text-destructive text-center">{N.t('score_save_fail')}</span>
          )}
          {etat === 'pris' && (
            <span className="text-[9px] text-muted-foreground/70 text-center">{N.t('id_taken_other')}</span>
          )}
        </div>
      )}

      {/* Comment retrouver ses chronos depuis un autre telephone. */}
      {!code && etat !== 'pris' && etat !== 'code' && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-muted-foreground">
            {N.t('id_link_title')}
          </span>
          <p className="text-[9px] md:text-[10px] text-muted-foreground/80 leading-snug">
            {N.t('id_link_help')}
          </p>
        </div>
      )}

      {/* Relier un telephone en le visant : possible seulement depuis un
          appareil qui porte deja le nom. */}
      {code && <PanneauQR nom={nom.trim()} />}

      {/* Et pour ceux qui n'ont plus rien. */}
      {!code && <PanneauPerdu nomInitial={nom} />}
    </div>
  );
}

/* ------------------------------------------------- relier en visant l'ecran */

function PanneauQR({ nom }: { nom: string }) {
  const { N } = SprinterApp;
  const [ouvert, setOuvert] = useState(false);
  const [transfert, setTransfert] = useState<Transfert | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);
  const [restant, setRestant] = useState(0);

  const ouvrir = async () => {
    setOuvert(true); setOccupe(true); setTransfert(null);
    setTransfert(await nouveauTransfert(nom));
    setOccupe(false);
  };

  // Le compte a rebours n'est pas un ornement : un QR code affiche a l'ecran
  // apres sa peremption est un QR code qu'on vise pour rien, et le joueur
  // conclut que la fonction ne marche pas.
  useEffect(() => {
    if (!transfert) return;
    const tic = () => setRestant(Math.max(0, Math.round((transfert.expire_le - Date.now()) / 1000)));
    tic();
    const id = setInterval(tic, 1000);
    return () => clearInterval(id);
  }, [transfert]);

  const copierLien = async () => {
    if (!transfert) return;
    try {
      await navigator.clipboard.writeText(transfert.lien);
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refuse */ }
  };

  if (!ouvert) {
    return (
      <button
        onClick={ouvrir}
        className="self-start text-[10px] font-bold tracking-widest text-muted-foreground
                   hover:text-primary transition-colors flex items-center gap-1.5"
      >
        <Smartphone className="w-3 h-3" /> {N.t('id_qr_open')}
      </button>
    );
  }

  const perime = !!transfert && restant <= 0;

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 flex flex-col items-center gap-2">
      <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
        {N.t('id_qr_title')}
      </span>

      {occupe && <Loader2 className="w-5 h-5 animate-spin text-white/30 my-6" />}

      {!occupe && !transfert && (
        <span className="text-[10px] text-destructive text-center py-4">{N.t('id_qr_fail')}</span>
      )}

      {transfert && (
        <>
          <div className={perime ? 'opacity-25 transition-opacity' : 'transition-opacity'}>
            <QrCarre texte={transfert.lien} taille={190} />
          </div>
          <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug max-w-[15rem]">
            {N.t('id_qr_help')}
          </p>
          <span className="text-[9px] font-mono text-muted-foreground/60">
            {perime
              ? N.t('id_join_dead')
              : `${N.t('id_qr_expire')} · ${Math.floor(restant / 60)}:${String(restant % 60).padStart(2, '0')}`}
          </span>
          <div className="flex gap-3">
            <button onClick={copierLien}
                    className="text-[10px] font-bold tracking-widest text-muted-foreground
                               hover:text-primary transition-colors flex items-center gap-1.5">
              {copie ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {N.t('id_qr_copy')}
            </button>
            <button onClick={ouvrir}
                    className="text-[10px] font-bold tracking-widest text-muted-foreground
                               hover:text-primary transition-colors">
              {N.t('id_qr_again')}
            </button>
          </div>
        </>
      )}

      <button onClick={() => setOuvert(false)}
              className="text-[9px] tracking-widest text-muted-foreground/50 hover:text-muted-foreground">
        {N.t('id_qr_close')}
      </button>
    </div>
  );
}

/* --------------------------------------------------- je n'ai plus mon code */

function PanneauPerdu({ nomInitial }: { nomInitial: string }) {
  const { N } = SprinterApp;
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState(nomInitial);
  const [indice, setIndice] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [reponse, setReponse] = useState<Recuperation | null>(null);

  // A l'ouverture, on regarde d'abord si une demande deja deposee a recu sa
  // reponse : le joueur qui revient trois jours plus tard ne doit pas avoir a
  // en redeposer une pour l'apprendre.
  useEffect(() => {
    if (!ouvert || !nomInitial.trim()) return;
    let vivant = true;
    etatRecuperation(nomInitial.trim()).then(r => {
      if (vivant && r.etat !== 'aucune' && r.etat !== 'reseau') setReponse(r);
    });
    return () => { vivant = false; };
  }, [ouvert, nomInitial]);

  const envoyer = async () => {
    const n = nom.trim();
    if (!n) return;
    setOccupe(true);
    setReponse(await demanderRecuperation(n, indice));
    setOccupe(false);
  };

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="self-start text-[10px] font-bold tracking-widest text-muted-foreground/70
                   hover:text-primary transition-colors flex items-center gap-1.5"
      >
        <LifeBuoy className="w-3 h-3" /> {N.t('id_lost')}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 flex flex-col gap-2">
      <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
        {N.t('id_lost_title')}
      </span>

      {/* Le code est revenu : plus rien a demander. */}
      {reponse?.etat === 'rendu' && (
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-xs font-bold text-primary text-center">
            {N.t('id_lost_back', { n: reponse.name })}
          </span>
          <span className="font-mono font-black text-2xl tracking-[0.3em] text-primary pl-[0.3em]">
            {reponse.code}
          </span>
          <span className="text-[9px] text-muted-foreground text-center">{N.t('id_code_note')}</span>
        </div>
      )}

      {/* En attente : ce qu'il reste a faire, et c'est la seule chose a faire. */}
      {reponse?.etat === 'attente' && (
        <div className="flex flex-col gap-2">
          {reponse.phrase && reponse.insta ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold tracking-widest text-primary flex items-center gap-1.5">
                <Instagram className="w-3 h-3" /> {N.t('id_lost_insta_t')}
              </span>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {N.t('id_lost_insta', { c: reponse.compte, i: reponse.insta })}
              </p>
              <span className="self-center font-mono font-black text-base tracking-[0.15em] text-primary">
                {reponse.phrase}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground leading-snug">{N.t('id_lost_no_insta')}</p>
          )}
          <span className="text-[10px] text-muted-foreground/70 text-center">{N.t('id_lost_waiting')}</span>
        </div>
      )}

      {reponse?.etat === 'refuse' && (
        <span className="text-[10px] text-destructive text-center">{N.t('id_lost_refused')}</span>
      )}
      {reponse?.etat === 'inconnu' && (
        <span className="text-[10px] text-muted-foreground text-center">{N.t('id_lost_none')}</span>
      )}

      {/* Le formulaire, tant qu'il y a quelque chose a demander. */}
      {(!reponse || reponse.etat === 'reseau' || reponse.etat === 'inconnu') && (
        <>
          <span className="text-[10px] text-muted-foreground">{N.t('id_lost_who')}</span>
          <input
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder={N.t('your_name')}
            maxLength={20}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground
                       placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <input
            value={indice}
            onChange={e => setIndice(e.target.value)}
            placeholder={N.t('id_lost_hint')}
            maxLength={280}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground
                       placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={envoyer}
            disabled={!nom.trim() || occupe}
            className="px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                       bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                       transition-colors flex items-center justify-center gap-2"
          >
            {occupe && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {N.t('id_lost_send')}
          </button>
          {reponse?.etat === 'reseau' && (
            <span className="text-[10px] text-destructive text-center">{N.t('score_save_fail')}</span>
          )}
        </>
      )}

      <button onClick={() => setOuvert(false)}
              className="text-[9px] tracking-widest text-muted-foreground/50 hover:text-muted-foreground self-center">
        {N.t('id_qr_close')}
      </button>
    </div>
  );
}
