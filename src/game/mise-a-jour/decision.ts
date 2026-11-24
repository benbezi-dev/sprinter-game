// CE QUE DIT LA VERSION — sans reseau, sans plugin, sans horloge propre.
//
// Trois etats, et rien d'autre :
//   a-jour       la version locale vaut au moins la derniere publiee ;
//   optionnelle  plus ancienne que la derniere, mais encore jouable ;
//   obligatoire  plus ancienne que la minimale : la partie est bloquee.
//
// Tout ce qui est douteux — version locale illisible, configuration mal
// formee — rend « a-jour » : le jeu doit se lancer, et un joueur bloque a tort
// est bien pire qu'une mise a jour proposee un jour plus tard.

import { comparerVersions, lireVersion } from './semver';

export type EtatMaj = 'a-jour' | 'optionnelle' | 'obligatoire';
export type Plateforme = 'ios' | 'android';

export type ConfigStore = {
  latestVersion: string;
  minSupportedVersion: string;
  storeUrl: string;
};

/** Un « Plus tard » : pour quelle version, et jusqu'a quand. */
export type Report = { version: string; jusqua: number } | null;

/** La reponse de GET /app/version pour une plateforme, validee. */
export function configDe(json: unknown, plateforme: Plateforme): ConfigStore | null {
  const p = (json as Record<string, unknown> | null)?.[plateforme] as Record<string, unknown> | undefined;
  if (!p || typeof p !== 'object') return null;
  const { latestVersion, minSupportedVersion, storeUrl } = p;
  if (!lireVersion(latestVersion) || !lireVersion(minSupportedVersion)) return null;
  if (typeof storeUrl !== 'string' || !/^https:\/\//.test(storeUrl)) return null;
  return { latestVersion: latestVersion as string, minSupportedVersion: minSupportedVersion as string, storeUrl };
}

export function etatDeVersion(locale: string | null | undefined, cfg: ConfigStore): EtatMaj {
  const min = comparerVersions(locale, cfg.minSupportedVersion);
  if (min === null) return 'a-jour';
  if (min < 0) return 'obligatoire';
  const derniere = comparerVersions(locale, cfg.latestVersion);
  return derniere !== null && derniere < 0 ? 'optionnelle' : 'a-jour';
}

/**
 * Faut-il montrer quelque chose ? L'obligatoire toujours. L'optionnelle sauf si
 * le joueur a dit « Plus tard » pour CETTE version il y a moins du delai : une
 * version plus recente que celle repoussee se propose a nouveau tout de suite.
 */
export function doitProposer(etat: EtatMaj, cfg: ConfigStore, report: Report, maintenant: number): boolean {
  if (etat === 'obligatoire') return true;
  if (etat === 'a-jour') return false;
  if (!report) return true;
  if (comparerVersions(report.version, cfg.latestVersion) !== 0) return true;
  return maintenant >= report.jusqua;
}

export function reporter(cfg: ConfigStore, maintenant: number, delaiMs: number): Report {
  return { version: cfg.latestVersion, jusqua: maintenant + delaiMs };
}

/** Un report relu depuis le stockage, ou null s'il est abime. */
export function reportValide(brut: unknown): Report {
  const r = brut as { version?: unknown; jusqua?: unknown } | null;
  if (!r || typeof r.version !== 'string' || typeof r.jusqua !== 'number' || !Number.isFinite(r.jusqua)) return null;
  return { version: r.version, jusqua: r.jusqua };
}
