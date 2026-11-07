import { useSyncExternalStore } from 'react';

/** Hash routes: #/  #/s/<sectionId>  #/p/<problemId>?a=<attempt>  #/sandbox?d=<state>  #/cheatsheet */
export type Route =
  | { name: 'home' }
  | { name: 'section'; id: string }
  | { name: 'problem'; id: string; attempt?: string }
  | { name: 'sandbox'; data?: string }
  | { name: 'cheatsheet' }
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
  if (parts[0] === 'cheatsheet') return { name: 'cheatsheet' };
  return { name: 'not-found' };
}

export const href = {
  home: () => '#/',
  section: (id: string) => `#/s/${id}`,
  problem: (id: string, attempt?: string) => `#/p/${id}${attempt ? `?a=${attempt}` : ''}`,
  sandbox: (data?: string) => `#/sandbox${data ? `?d=${data}` : ''}`,
  cheatsheet: () => '#/cheatsheet',
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
