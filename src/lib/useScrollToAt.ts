import { useEffect } from 'react';

/**
 * Scroll to the element with id `at` (from a `?at=` deep link) and flash it briefly, so the reader sees where
 * they landed. `key` re-runs it when the page changes but `at` doesn't.
 */
export function useScrollToAt(at: string | undefined, key?: string) {
  useEffect(() => {
    if (!at) return;
    const el = document.getElementById(at);
    if (!el) return;
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
    el.classList.add('is-target');
    const t = setTimeout(() => el.classList.remove('is-target'), 2400);
    return () => {
      clearTimeout(t);
      el.classList.remove('is-target');
    };
  }, [at, key]);
}
