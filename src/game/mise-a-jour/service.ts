// AppUpdateService — QUOI FAIRE AU LANCEMENT, et rien qui touche l'ecran.
//
// Le service ne parle a Capacitor, au reseau et au stockage qu'a travers des
// « ports » qu'on lui donne (capacitor.ts en fournit les vrais). Le harnais lui
// en donne des faux et verifie chaque chemin sans telephone :
// tools/mise-a-jour-test.mjs.
//
// La regle qui passe avant toutes les autres : LE JEU SE LANCE. Hors ligne,
// serveur muet, reponse abimee, plugin en panne, delai depasse — dans tous ces
// cas la verification rend « rien » et le joueur ne voit rien. Elle ne leve
// jamais d'exception.
//
// Par plateforme :
//   Android  l'API Google Play In-App Updates installe depuis le jeu —
//            IMMEDIATE sous la version minimale, FLEXIBLE au-dessus. Si Play
//            ne peut pas (pas installe depuis le Play Store, API en echec),
//            repli sur la modale qui ouvre la fiche.
//            Play fait foi pour l'optionnelle : s'il dit « pas de mise a jour »
//            pour CE joueur (deploiement progressif, cache du store), on ne
//            l'envoie pas sur une fiche qui n'a rien de neuf a lui proposer.
//   iOS      Apple interdit l'installation silencieuse : la modale, et un
//            bouton qui ouvre l'App Store.

import {
  configDe, doitProposer, etatDeVersion, reporter,
  type ConfigStore, type EtatMaj, type Plateforme, type Report,
} from './decision';

export type InfoPlay = {
  disponible: 'oui' | 'non' | 'inconnu';
  immediate: boolean;
  flexible: boolean;
};
export type ResultatPlay = 'ok' | 'annule' | 'echec';

export interface Ports {
  plateforme(): Plateforme | 'web';
  versionLocale(): Promise<string | null>;
  /** GET /app/version ; doit respecter le signal (abandon au delai). */
  chargerConfig(signal: AbortSignal): Promise<unknown>;
  lireReport(): Report;
  ecrireReport(r: Report): void;
  maintenant(): number;
  /** Android seulement. */
  infoPlay(): Promise<InfoPlay>;
  miseAJourImmediate(): Promise<ResultatPlay>;
  /** Lance le telechargement en arriere-plan ; `prete` part quand il est fini. */
  miseAJourFlexible(prete: () => void): Promise<ResultatPlay>;
  ouvrirStore(cfg: ConfigStore): Promise<void>;
}

export type Simulation = 'off' | 'optionnelle' | 'obligatoire' | null;

export type Options = {
  delaiMs: number;
  reportMs: number;
  /** Drapeau de developpement (VITE_MAJ) : force un etat sans reseau. */
  simulation?: Simulation;
  /** Une mise a jour FLEXIBLE est telechargee : proposer le redemarrage. */
  surTelechargee?: () => void;
};

export type Issue =
  | { type: 'rien'; raison: string }
  | { type: 'modale'; etat: Exclude<EtatMaj, 'a-jour'>; cfg: ConfigStore }
  | { type: 'play'; mode: 'immediate' | 'flexible' };

const rien = (raison: string): Issue => ({ type: 'rien', raison });

const CONFIG_SIMULEE: ConfigStore = {
  latestVersion: '99.0.0',
  minSupportedVersion: '0.0.0',
  storeUrl: 'https://sprinter-game.com/',
};

/** Rend la valeur de la promesse, ou `null` passe le delai (sans jamais lever). */
export function avecDelai<T>(p: Promise<T>, ms: number, auDelai?: () => void): Promise<T | null> {
  return new Promise(resolve => {
    const t = setTimeout(() => { auDelai?.(); resolve(null); }, ms);
    p.then(v => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}

/** Version locale + configuration distante, le tout borne par le delai. */
async function lireEtat(ports: Ports, plateforme: Plateforme, delaiMs: number) {
  const ctrl = new AbortController();
  const lu = await avecDelai((async () => {
    const [version, json] = await Promise.all([ports.versionLocale(), ports.chargerConfig(ctrl.signal)]);
    return { version, cfg: configDe(json, plateforme) };
  })(), delaiMs, () => ctrl.abort());
  return lu;
}

export async function verifierMiseAJour(ports: Ports, opts: Options): Promise<Issue> {
  try {
    if (opts.simulation === 'off') return rien('desactive');
    if (opts.simulation === 'optionnelle' || opts.simulation === 'obligatoire') {
      return { type: 'modale', etat: opts.simulation, cfg: CONFIG_SIMULEE };
    }

    const plateforme = ports.plateforme();
    if (plateforme === 'web') return rien('web');

    const lu = await lireEtat(ports, plateforme, opts.delaiMs);
    if (!lu) return rien('delai-ou-reseau');
    if (!lu.cfg) return rien('config-invalide');
    const cfg = lu.cfg;

    const etat = etatDeVersion(lu.version, cfg);
    if (etat === 'a-jour') return rien('a-jour');
    if (!doitProposer(etat, cfg, ports.lireReport(), ports.maintenant())) return rien('reporte');

    if (plateforme === 'android') return await viaPlay(ports, opts, etat, cfg);
    return { type: 'modale', etat, cfg };
  } catch {
    return rien('erreur');
  }
}

async function viaPlay(ports: Ports, opts: Options, etat: Exclude<EtatMaj, 'a-jour'>, cfg: ConfigStore): Promise<Issue> {
  const modale: Issue = { type: 'modale', etat, cfg };
  const info = await avecDelai(ports.infoPlay(), opts.delaiMs);
  if (!info || info.disponible === 'inconnu') return modale;

  if (info.disponible === 'non') {
    // Play ne propose rien a ce joueur. L'optionnelle attend son tour ; la
    // minimale, elle, tient : le serveur ne peut pas accepter cette version.
    return etat === 'obligatoire' ? modale : rien('play-sans-mise-a-jour');
  }

  if (etat === 'obligatoire') {
    if (!info.immediate) return modale;
    const r = await ports.miseAJourImmediate().catch((): ResultatPlay => 'echec');
    // Annulee ou ratee, la mise a jour reste due : la modale bloquante prend
    // le relais, et son bouton retentera.
    return r === 'ok' ? { type: 'play', mode: 'immediate' } : modale;
  }

  if (!info.flexible) return modale;
  const r = await ports.miseAJourFlexible(() => opts.surTelechargee?.()).catch((): ResultatPlay => 'echec');
  if (r === 'ok') return { type: 'play', mode: 'flexible' };
  if (r === 'annule') {
    // Le « Non merci » de Play vaut un « Plus tard ».
    ports.ecrireReport(reporter(cfg, ports.maintenant(), opts.reportMs));
    return rien('play-annule');
  }
  return modale;
}

/** Le bouton « Mettre a jour » de la modale. */
export async function lancerMiseAJour(ports: Ports, cfg: ConfigStore, etat: Exclude<EtatMaj, 'a-jour'>): Promise<void> {
  if (ports.plateforme() === 'android' && etat === 'obligatoire') {
    const info = await avecDelai(ports.infoPlay(), 4000);
    if (info?.disponible === 'oui' && info.immediate) {
      const r = await ports.miseAJourImmediate().catch((): ResultatPlay => 'echec');
      if (r === 'ok') return;
    }
  }
  await ports.ouvrirStore(cfg).catch(() => { /* la modale reste, le joueur peut retenter */ });
}

/** Le bouton « Plus tard ». */
export function plusTard(ports: Ports, cfg: ConfigStore, reportMs: number): void {
  ports.ecrireReport(reporter(cfg, ports.maintenant(), reportMs));
}
