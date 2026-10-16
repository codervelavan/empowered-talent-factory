// Keeps the address bar in step with where the visitor is, and turns addresses back into places.
// Paths are relative to the site's base (e.g. "/empowered-talent-factory/" on GitHub Pages).
import { LEGACY_HASH, routeFor, type RouteDef } from './routes';

const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
const HOME_TITLE = routeFor('')!.title;

/** The current path relative to the base, normalised to "" or "segment/…/". */
export function currentPath(): string {
  let p = decodeURIComponent(location.pathname);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  else if (p.startsWith('/')) p = p.slice(1);
  p = p.replace(/index\.html$/, '').replace(/^\/+/, '');
  if (p && !p.endsWith('/')) p += '/';
  return p;
}

/** The route for the current address (unknown paths fall back to home). */
export function currentRoute(): RouteDef {
  return routeFor(currentPath()) ?? routeFor('')!;
}

/** Old #career style links: the path they now live at, if any. */
export function legacyHashPath(): string | null {
  const h = location.hash.slice(1);
  return h in LEGACY_HASH ? LEGACY_HASH[h] : null;
}

/** Point the address bar at a path. Push for a new place the visitor moved to; replace to correct it. */
export function setPath(path: string, push: boolean): void {
  const r = routeFor(path);
  document.title = r?.title ?? HOME_TITLE;
  if (path === currentPath() && !location.hash) return;
  const url = BASE + path + location.search;
  try {
    if (push) history.pushState({ path }, '', url);
    else history.replaceState({ path }, '', url);
  } catch { /* some embedded views refuse history changes */ }
}

/** Call back when the visitor uses the browser's Back or Forward buttons. */
export function onPathChange(cb: (path: string) => void): void {
  addEventListener('popstate', () => cb(currentPath()));
}

/** A link to a path on this site. */
export const href = (path: string): string => BASE + path;
