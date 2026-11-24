// Les vrais ports du service : Capacitor, le reseau, le stockage local.
// Charge a la demande par la modale, jamais par le build du site.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  AppUpdate, AppUpdateAvailability, AppUpdateResultCode, FlexibleUpdateInstallStatus,
} from '@capawesome/capacitor-app-update';
import { reportValide, type Report } from './decision';
import type { Ports, ResultatPlay } from './service';
import { API_VERSIONS, CLE_REPORT, ID_APPLE, PAQUET_ANDROID } from './config';

const resultat = (code: AppUpdateResultCode | undefined): ResultatPlay =>
  code === AppUpdateResultCode.OK ? 'ok' : code === AppUpdateResultCode.CANCELED ? 'annule' : 'echec';

export const portsCapacitor: Ports = {
  plateforme() {
    const p = Capacitor.getPlatform();
    return p === 'ios' || p === 'android' ? p : 'web';
  },

  async versionLocale() {
    // versionName sur Android, CFBundleShortVersionString sur iOS.
    const info = await App.getInfo();
    return info.version || null;
  },

  async chargerConfig(signal) {
    const r = await fetch(API_VERSIONS, { signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },

  lireReport(): Report {
    try { return reportValide(JSON.parse(localStorage.getItem(CLE_REPORT) || 'null')); }
    catch { return null; }
  },

  ecrireReport(r) {
    try {
      if (r) localStorage.setItem(CLE_REPORT, JSON.stringify(r));
      else localStorage.removeItem(CLE_REPORT);
    } catch { /* stockage indisponible : la modale reviendra, rien de grave */ }
  },

  maintenant: () => Date.now(),

  async infoPlay() {
    const i = await AppUpdate.getAppUpdateInfo();
    const disponible = i.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
      || i.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS ? 'oui'
      : i.updateAvailability === AppUpdateAvailability.UPDATE_NOT_AVAILABLE ? 'non' : 'inconnu';
    return { disponible, immediate: !!i.immediateUpdateAllowed, flexible: !!i.flexibleUpdateAllowed };
  },

  async miseAJourImmediate() {
    const r = await AppUpdate.performImmediateUpdate();
    return resultat(r.code);
  },

  async miseAJourFlexible(prete) {
    const ecoute = await AppUpdate.addListener('onFlexibleUpdateStateChange', etat => {
      if (etat.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
        void ecoute.remove();
        prete();
      } else if (etat.installStatus === FlexibleUpdateInstallStatus.FAILED
        || etat.installStatus === FlexibleUpdateInstallStatus.CANCELED) {
        void ecoute.remove();
      }
    });
    const r = resultat((await AppUpdate.startFlexibleUpdate()).code);
    if (r !== 'ok') void ecoute.remove();
    return r;
  },

  async ouvrirStore(cfg) {
    try {
      const p = Capacitor.getPlatform();
      if (p === 'ios') await AppUpdate.openAppStore({ appId: ID_APPLE });
      else if (p === 'android') await AppUpdate.openAppStore({ androidPackageName: PAQUET_ANDROID });
      else window.open(cfg.storeUrl, '_blank', 'noopener');
    } catch {
      // Le plugin a echoue : le lien web de la fiche, que le systeme confie au store.
      window.open(cfg.storeUrl, '_system');
    }
  },
};

/** Redemarre l'application pour installer la mise a jour FLEXIBLE telechargee. */
export function installerLaMiseAJourTelechargee(): Promise<void> {
  return AppUpdate.completeFlexibleUpdate();
}
