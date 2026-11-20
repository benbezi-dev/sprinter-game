import { EST_TEST } from './canal';
import { navigateurActuel } from './navigateur';

/** Les tests du site public peuvent ouvrir une session avec ?mesure=test. */
export function mesureActive(): boolean {
  if (EST_TEST || import.meta.env.DEV || navigateurActuel() === 'robot') return false;
  if (new URLSearchParams(location.search).get('mesure') === 'test') return false;
  try { return sessionStorage.getItem('sprinter_mesure_test') !== '1'; }
  catch { return true; }
}
