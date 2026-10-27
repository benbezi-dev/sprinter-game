import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

// UN MORCEAU QUI N'EXISTE PLUS SUR LE SERVEUR.
//
// Les ecrans charges a la demande (lazy) portent un nom hache, et chaque
// deploiement GitHub Pages remplace tout le dossier : une page ouverte avant
// le deploiement — application installee reprise, index.html servi par le
// cache HTTP — reclame un morceau qui repond 404. React retient l'echec du
// `lazy`, donc « Try again » rejouait la meme erreur : le joueur restait
// bloque (21/10). Le seul remede est de recharger la page, qui reprend
// l'index.html du jour avec les bons noms.
const MORCEAU_MANQUANT =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load module script/i;

export function estMorceauManquant(error: unknown): boolean {
  return MORCEAU_MANQUANT.test(error instanceof Error ? error.message : String(error));
}

// Une fois, pas en boucle : si le morceau manque encore apres le rechargement,
// c'est le serveur qui est en cause, et l'ecran d'erreur reste.
const CLE_RECHARGE = 'sprinter_recharge_morceau';
export function rechargerUneFois(): boolean {
  // Hors ligne, le morceau manque faute de reseau, pas parce qu'il est vieux :
  // recharger n'y changerait rien, et sans service worker la page tomberait
  // sur l'erreur du navigateur.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const avant = Number(sessionStorage.getItem(CLE_RECHARGE) || 0);
    if (Date.now() - avant < 10_000) return false;
    sessionStorage.setItem(CLE_RECHARGE, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This part of the app hit an error. The rest of the app is still
          running.
        </p>
        {/* Dev only: messages can carry API responses and other internals. */}
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800">
            {error.message || String(error)}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
    if (estMorceauManquant(error)) {
      rechargerUneFois();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    // Un geste du joueur : on recharge sans la garde, puisque re-rendre ne
    // ferait que relire l'echec retenu par `lazy`.
    if (this.state.error !== null && estMorceauManquant(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
