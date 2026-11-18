import { useSyncExternalStore } from 'react';

/**
 * Hash routes: #/  #/s/<sectionId>  #/p/<problemId>?a=<attempt>  #/sandbox?d=<state>  #/cheatsheet
 * #/sheet?d=<state>&e=<entity index> — the full-screen spreadsheet view of the same sandbox state.
 */
export type Route =
  | { name: 'home' }
  | { name: 'section'; id: string }
  | { name: 'problem'; id: string; attempt?: string }
  | { name: 'sandbox'; data?: string }
  | { name: 'sheet'; data?: string; entity: number }
  | { name: 'definitions'; id?: string }
  | { name: 'cheatsheet' }
  | { name: 'animations' }
  | { name: 'not-found' };

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 's' && parts[1]) return { name: 'section', id: parts[1] };
  if (parts[0] === 'p' && parts[1])
    return { name: 'problem', id: parts[1], attempt: params.get('a') ?? undefined };
  if (parts[0] === 'sandbox') return { name: 'sandbox', data: params.get('d') ?? undefined };
  if (parts[0] === 'sheet') {
    const e = Number(params.get('e') ?? 0);
    return { name: 'sheet', data: params.get('d') ?? undefined, entity: Number.isInteger(e) && e > 0 ? e : 0 };
  }
  if (parts[0] === 'definitions') return { name: 'definitions', id: parts[1] };
  if (parts[0] === 'cheatsheet') return { name: 'cheatsheet' };
  if (parts[0] === 'animations') return { name: 'animations' };
  return { name: 'not-found' };
}

export const href = {
  home: () => '#/',
  section: (id: string) => `#/s/${id}`,
  problem: (id: string, attempt?: string) => `#/p/${id}${attempt ? `?a=${attempt}` : ''}`,
  sandbox: (data?: string) => `#/sandbox${data ? `?d=${data}` : ''}`,
  sheet: (data?: string, entity = 0) => {
    const q = [data && `d=${data}`, entity > 0 && `e=${entity}`].filter(Boolean).join('&');
    return `#/sheet${q ? `?${q}` : ''}`;
  },
  definitions: (id?: string) => `#/definitions${id ? `/${id}` : ''}`,
  cheatsheet: () => '#/cheatsheet',
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
