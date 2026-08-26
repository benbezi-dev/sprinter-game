import React, { useEffect, useState } from 'react';
import { Users, Eye, Timer, Ghost, Activity, Loader2 } from 'lucide-react';
import {
  fetchBoardStats, fetchServerStats, type BoardStats, type ServerStats,
} from '@/game/stats';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function Tuile({ icone, valeur, libelle, note, attente }: {
  icone: React.ReactNode; valeur: React.ReactNode; libelle: string;
  note?: string; attente?: boolean;
}) {
  return (
    <div className="flex-1 min-w-[8.5rem] bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[#f8cd4a]">
        {icone}
        <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">{libelle}</span>
      </div>
      <div className={`font-mono font-black tabular-nums leading-none mt-1 ${attente ? 'text-2xl text-white/25' : 'text-3xl md:text-4xl text-white'}`}>
        {valeur}
      </div>
      {note && <div className="text-[10px] text-white/40 leading-snug mt-0.5">{note}</div>}
    </div>
  );
}

export function Dashboard() {
  const [board, setBoard] = useState<BoardStats | null>(null);
  const [srv, setSrv] = useState<ServerStats | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    Promise.all([fetchBoardStats(), fetchServerStats()])
      .then(([b, s]) => { if (!annule) { setBoard(b); setSrv(s); setChargement(false); } })
      .catch(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const t = (ms: number | null) => (ms == null ? '—' : (ms / 1000).toFixed(2) + ' s');
  const maxJour = srv?.visites.par_jour.reduce((m, d) => Math.max(m, d.hits), 0) || 1;

  return (
    <div className="min-h-[100dvh] w-full bg-[#060913] text-white font-sans overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">

        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#f8cd4a]">
              TABLEAU DE BORD
            </h1>
            <p className="text-xs text-white/45 mt-1">Sprinter — fréquentation et participation</p>
          </div>
          <a href={`${BASE}/`} className="text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            Retour au jeu
          </a>
        </header>

        {chargement && (
          <div className="flex items-center gap-2 text-white/50 text-sm py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> chargement des chiffres...
          </div>
        )}

        {!chargement && (
          <>
            {/* Fréquentation — dépend du compteur serveur */}
            <section className="flex flex-wrap gap-3">
              <Tuile
                icone={<Eye className="w-4 h-4" />}
                libelle="Visites"
                valeur={srv ? srv.visites.total.toLocaleString('fr-FR') : 'en attente'}
                attente={!srv}
                note={srv ? 'passages cumulés' : 'compteur pas encore déployé sur le serveur'}
              />
              <Tuile
                icone={<Users className="w-4 h-4" />}
                libelle="Visiteurs"
                valeur={srv ? srv.visites.visiteurs.toLocaleString('fr-FR') : 'en attente'}
                attente={!srv}
                note={srv ? 'appareils distincts' : undefined}
              />
              <Tuile
                icone={<Users className="w-4 h-4" />}
                libelle="Participants"
                valeur={board ? board.joueurs.length : '—'}
                note="noms distincts au classement"
              />
              <Tuile
                icone={<Timer className="w-4 h-4" />}
                libelle="Chronos classés"
                valeur={board ? board.lignes : '—'}
                note="toutes épreuves confondues"
              />
            </section>

            {/* Activité récente, déduite de la date des chronos */}
            {board && (
              <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 md:p-5">
                <div className="flex items-center gap-2 text-[#f8cd4a] mb-3">
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">Activité</span>
                </div>
                <div className="flex flex-wrap gap-6">
                  {[['24 heures', board.actifs24h], ['7 jours', board.actifs7j], ['30 jours', board.actifs30j]].map(([l, v]) => (
                    <div key={String(l)} className="flex flex-col">
                      <span className="font-mono font-black text-2xl tabular-nums">{v as number}</span>
                      <span className="text-[10px] text-white/45 uppercase tracking-widest">{l as string}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/35 mt-3 leading-snug">
                  Chronos mis à jour sur la période. Un joueur qui rejoue sans améliorer
                  son temps n'y apparaît pas : c'est une mesure de progression, pas de connexion.
                </p>
              </section>
            )}

            {/* Par discipline */}
            {board && (
              <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 md:p-5">
                <div className="flex items-center gap-2 text-[#f8cd4a] mb-3">
                  <Timer className="w-4 h-4" />
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">Par discipline</span>
                </div>
                <div className="flex flex-col gap-2">
                  {board.parEpreuve.map(e => (
                    <div key={e.race} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-black/25 border border-white/5">
                      <span className="font-bold w-16 shrink-0">{e.race} m</span>
                      <span className="text-xs text-white/50 flex-1">{e.classes} classés</span>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-[#f8cd4a]">{t(e.meilleur)}</div>
                        <div className="text-[10px] text-white/40 truncate max-w-[10rem]">{e.meilleurNom || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Défis — dépend du serveur */}
            <section className="flex flex-wrap gap-3">
              <Tuile
                icone={<Ghost className="w-4 h-4" />}
                libelle="Défis créés"
                valeur={srv?.defis?.defis ?? 'en attente'}
                attente={!srv}
              />
              <Tuile
                icone={<Ghost className="w-4 h-4" />}
                libelle="Tentatives"
                valeur={srv?.defis?.tentatives ?? 'en attente'}
                attente={!srv}
              />
              <Tuile
                icone={<Users className="w-4 h-4" />}
                libelle="Appareils"
                valeur={srv?.scores?.appareils ?? 'en attente'}
                attente={!srv}
                note={srv ? 'un joueur peut en avoir plusieurs' : undefined}
              />
            </section>

            {/* Visites jour par jour */}
            {srv && srv.visites.par_jour.length > 0 && (
              <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 md:p-5">
                <div className="flex items-center gap-2 text-[#f8cd4a] mb-3">
                  <Eye className="w-4 h-4" />
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">30 derniers jours</span>
                </div>
                <div className="flex items-end gap-1 h-28">
                  {srv.visites.par_jour.slice().reverse().map(d => (
                    <div key={d.day} className="flex-1 flex flex-col justify-end items-center gap-1 group" title={`${d.day} — ${d.hits} passages, ${d.visiteurs} visiteurs`}>
                      <div className="w-full rounded-t bg-[#f8cd4a]/70 group-hover:bg-[#f8cd4a] transition-colors"
                           style={{ height: `${Math.max(4, (d.hits / maxJour) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-white/35 mt-2">
                  <span>{srv.visites.par_jour[srv.visites.par_jour.length - 1]?.day}</span>
                  <span>{srv.visites.par_jour[0]?.day}</span>
                </div>
              </section>
            )}

            {!srv && (
              <p className="text-[11px] text-white/40 leading-relaxed border border-white/10 rounded-xl p-4">
                Les visites, les défis et le nombre d'appareils viennent d'un compteur
                qui vit dans le Worker. Il est écrit et testé, mais pas encore en ligne :
                il attend un déploiement du serveur. Les participants et les chronos,
                eux, se lisent directement du classement et sont donc à jour.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
