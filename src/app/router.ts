import { useSyncExternalStore } from 'react';
import type { SandboxView } from '../sandbox';

export type { SandboxView };

/**
 * Hash routes: #/  #/s/<sectionId>?at=<element id>  #/p/<problemId>?a=<attempt>
 * #/cheatsheet?at=<element id> — `at` scrolls to a block on the page (search results deep-link with it).
 * The Sandbox: three views of the same state (`d`); `s` = which scenario; `e` = which entity; `at` = an element
 * to scroll to.
 *   #/sandbox?d=&s=&e=&at=   Journal — the editor, and the default
 *   #/taccounts?d=&s=&at=    T-accounts — every entity's ledger, read-only
 *   #/sheet?d=&s=&e=         Grid — one entity as a wide spreadsheet
 */
const VIEW_PATH: Record<SandboxView, string> = {
  journal: 'sandbox',
  taccounts: 'taccounts',
  grid: 'sheet',
};

export type Route =
  | { name: 'home' }
  | { name: 'section'; id: string; at?: string }
  | { name: 'problem'; id: string; attempt?: string }
  | {
      name: 'sandbox';
      view: SandboxView;
      data?: string;
      scenario: number;
      entity: number;
      at?: string;
    }
  | { name: 'definitions'; id?: string }
  | { name: 'cheatsheet'; at?: string }
  | { name: 'animations' }
  | { name: 'not-found' };

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  const at = params.get('at') ?? undefined;
  if (parts[0] === 's' && parts[1]) return { name: 'section', id: parts[1], ...(at ? { at } : {}) };
  if (parts[0] === 'p' && parts[1])
    return { name: 'problem', id: parts[1], attempt: params.get('a') ?? undefined };
  const view = (Object.keys(VIEW_PATH) as SandboxView[]).find((v) => VIEW_PATH[v] === parts[0]);
  if (view) {
    const index = (k: string) => {
      const n = Number(params.get(k) ?? 0);
      return Number.isInteger(n) && n > 0 ? n : 0;
    };
    return {
      name: 'sandbox',
      view,
      data: params.get('d') ?? undefined,
      scenario: index('s'),
      entity: index('e'),
      ...(at ? { at } : {}),
    };
  }
  if (parts[0] === 'definitions') return { name: 'definitions', id: parts[1] };
  if (parts[0] === 'cheatsheet') return { name: 'cheatsheet', ...(at ? { at } : {}) };
  if (parts[0] === 'animations') return { name: 'animations' };
  return { name: 'not-found' };
}

/** Any Sandbox view of the same state. */
function sandboxView(
  view: SandboxView,
  data?: string,
  entity = 0,
  at?: string,
  scenario = 0,
): string {
  const q = [
    data && `d=${data}`,
    scenario > 0 && `s=${scenario}`,
    entity > 0 && view !== 'taccounts' && `e=${entity}`,
    at && `at=${encodeURIComponent(at)}`,
  ]
    .filter(Boolean)
    .join('&');
  return `#/${VIEW_PATH[view]}${q ? `?${q}` : ''}`;
}

export const href = {
  home: () => '#/',
  section: (id: string, at?: string) => `#/s/${id}${at ? `?at=${encodeURIComponent(at)}` : ''}`,
  problem: (id: string, attempt?: string) => `#/p/${id}${attempt ? `?a=${attempt}` : ''}`,
  sandboxView,
  /** The Journal view — the Sandbox's default. */
  sandbox: (data?: string, entity = 0, at?: string) => sandboxView('journal', data, entity, at),
  taccounts: (data?: string, at?: string) => sandboxView('taccounts', data, 0, at),
  sheet: (data?: string, entity = 0) => sandboxView('grid', data, entity),
  definitions: (id?: string) => `#/definitions${id ? `/${id}` : ''}`,
  cheatsheet: (at?: string) => `#/cheatsheet${at ? `?at=${encodeURIComponent(at)}` : ''}`,
  animations: () => '#/animations',
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return parseHash(hash);
}

/** Update the hash without adding a history entry (for live attempt/sandbox state). */
export function replaceHash(h: string) {
  history.replaceState(null, '', h);
}
