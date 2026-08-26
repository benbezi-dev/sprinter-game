import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Service worker : rend le jeu installable sur le telephone, et jouable hors
// ligne. Enregistre apres le chargement pour ne pas disputer la bande passante
// a la premiere image. Sans lui, Chrome ne propose jamais l'installation.
// (localhost est un contexte securise au meme titre que https : sans cela on
// ne pourrait rien verifier avant la mise en ligne)
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => { /* refuse ou indisponible : le jeu marche sans */ });
  });
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
