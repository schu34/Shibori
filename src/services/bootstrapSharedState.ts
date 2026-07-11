import { Action, ActionType } from '../store/shiboriCanvasState';
import { decodeStateFromUrl } from '../utils/urlStateUtils';
import { logger } from '../utils/logger';

interface BootstrapLocation {
  href: string;
  search: string;
}

interface BootstrapHistory {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

type BootstrapDispatch = (action: Action) => unknown;

/**
 * Load a valid share document synchronously before React mounts. Redux dispatch
 * is synchronous, so canvas consumers see the restored state on first render.
 * The query parameter is removed only after the reducer has received it.
 */
export function bootstrapSharedState(
  location: BootstrapLocation,
  history: BootstrapHistory,
  title: string,
  dispatch: BootstrapDispatch
): boolean {
  const encoded = new URLSearchParams(location.search).get('shared');
  if (!encoded) return false;

  const decoded = decodeStateFromUrl(encoded);
  if (!decoded) {
    logger.url.load('Invalid shared parameter found, using default state');
    return false;
  }

  dispatch({ type: ActionType.LOAD_STATE_FROM_URL, payload: decoded });

  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete('shared');
  history.replaceState({}, title, cleanUrl.toString());
  logger.url.load('Loaded shared state before render and cleaned URL');
  return true;
}
