import { useSyncExternalStore } from 'react';
import { problems, sections } from '@content';

/**
 * Your progress, kept only in this browser (localStorage). Keyed by problem id (e.g. "05-friend-repays"), which
 * is stable across title edits and reordering — numbers like 5.7 are display only. New problems simply start
 * as not done; ids no longer in the course are ignored.
 *
 * "solved" sticks: a later wrong attempt doesn't undo it. "tried" = checked at least once, not correct yet.
 */
export type ProblemStatus = 'solved' | 'tried';
type Store = Record<string, { s: ProblemStatus; t: number }>;

export const PROGRESS_KEY = 'progress:v1';
const EVENT = 'progress-change';

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(next: Store) {
  cache = next;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage blocked: progress still shows for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Record the outcome of checking an answer. */
export function recordResult(problemId: string, correct: boolean) {
  const cur = load();
  const prev = cur[problemId]?.s;
  const s: ProblemStatus = correct || prev === 'solved' ? 'solved' : 'tried';
  if (prev === s) return;
  save({ ...cur, [problemId]: { s, t: Date.now() } });
}

/** Forget all progress (this browser only). */
export function resetProgress() {
  cache = {};
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(on: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROGRESS_KEY || e.key === null) {
      cache = null; // another tab changed it
      on();
    }
  };
  window.addEventListener(EVENT, on);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener('storage', onStorage);
  };
}

/** The live progress store; re-renders when it changes (here or in another tab). */
export function useProgress(): Store {
  return useSyncExternalStore(subscribe, load, load);
}

export function statusOf(store: Store, problemId: string): ProblemStatus | undefined {
  return problems[problemId] ? store[problemId]?.s : undefined;
}

export interface SectionProgress {
  id: string;
  label: string;
  total: number;
  solved: number;
  tried: number;
  /** One slot per problem, in order. */
  slots: { id: string; status: ProblemStatus | undefined }[];
}

/** Progress per section (sections with problems only), in course order. */
export function sectionProgress(store: Store): SectionProgress[] {
  return sections
    .filter((s) => s.problemIds.length > 0)
    .map((s) => {
      const slots = s.problemIds.map((id) => ({ id, status: statusOf(store, id) }));
      return {
        id: s.id,
        label: `${s.id === 'review' ? '' : `${s.number}. `}${s.title}`,
        total: slots.length,
        solved: slots.filter((x) => x.status === 'solved').length,
        tried: slots.filter((x) => x.status === 'tried').length,
        slots,
      };
    });
}
