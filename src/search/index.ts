/**
 * Site search: a small, titles-only index built in the browser from the same content modules the app renders,
 * so it can never go stale and needs no build step.
 *
 * Deliberately narrow: names and headings only (problem titles, section H1s, "Watch it" animations, callout
 * titles, glossary term names, a few pages, and each lens by its topic + keywords). No prose — primers, prompts, definitions and hints are not indexed,
 * so a common word like "debit" finds the handful of things *named* for it, not every page that mentions it.
 */
import { problems, sections } from '@content';
import { engine } from '@engine';
import { glossary } from '../../content/glossary';
import { animations } from '../components/animations';
import { ROLE_LABEL } from '../app/badges';
import { CHEATSHEET_ANCHORS } from '../app/CheatSheet';
import { problemNumber } from '../app/problemNumber';
import { href } from '../app/router';
import { EXAMPLES } from '../../content/sandbox-examples';
import { lensKeywords } from '../../content/search-keywords';
import {
  SECTION_ANIMATIONS,
  calloutAnchor,
  LENS_ANCHOR,
  watchAnchor,
} from '../app/sectionAnimations';

export type SearchKind =
  'term' | 'section' | 'watch' | 'callout' | 'lens' | 'page' | 'example' | 'problem';

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  /** What's shown and searched. */
  title: string;
  /** Other searchable names (glossary aliases, lens keywords). */
  aliases?: string[];
  /** Matched only as a whole query, e.g. a problem's number "6.3". */
  code?: string;
  /** Breadcrumb shown under the title, e.g. "§6 Loans — Both Sides · Practice". Not searched. */
  context: string;
  href: string;
  /** Problem id, so the dialog can show progress. */
  problemId?: string;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  term: 'Definition',
  section: 'Section',
  watch: 'Watch it',
  callout: 'Callout',
  lens: 'Lens',
  page: 'Page',
  example: 'Sandbox example',
  problem: 'Problem',
};

/** Aliases every lens shares, so "lens" lists them all. */
const GENERIC_ALIASES = new Set(['lens', 'ledger engineers lens']);

const sectionLabel = (s: (typeof sections)[number]) =>
  s.id === 'review' ? s.title : `§${s.number} ${s.title}`;

export function buildIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];

  for (const t of glossary) {
    out.push({
      id: `term:${t.id}`,
      kind: 'term',
      title: t.term,
      aliases: t.aliases,
      context: 'Definitions',
      href: href.definitions(t.id),
    });
  }

  for (const s of sections) {
    const label = sectionLabel(s);
    out.push({
      id: `section:${s.id}`,
      kind: 'section',
      title: s.title,
      code: s.id === 'review' ? undefined : `§${s.number}`,
      context: s.id === 'review' ? s.summary : `Section ${s.number} · ${s.summary}`,
      href: href.section(s.id),
    });
    for (const aid of SECTION_ANIMATIONS[s.id] ?? []) {
      const a = animations[aid];
      if (!a) continue;
      out.push({
        id: `watch:${aid}`,
        kind: 'watch',
        title: `Watch it: ${a.title}`,
        context: label,
        href: href.section(s.id, watchAnchor(aid)),
      });
    }
    (s.callouts ?? []).forEach((c, i) => {
      out.push({
        id: `callout:${s.id}:${i}`,
        kind: 'callout',
        title: c.title,
        context: label,
        href: href.section(s.id, calloutAnchor(i)),
      });
    });
    // Every lens has the same heading, so it's found by its topic and hand-picked keywords
    // (content/search-keywords.ts) — not its prose. "lens" alone lists them all.
    const lens = lensKeywords[s.id];
    if (s.lens && lens) {
      out.push({
        id: `lens:${s.id}`,
        kind: 'lens',
        title: lens.topic,
        aliases: [...GENERIC_ALIASES, ...lens.keywords],
        context: `${label} · Ledger engineer’s lens`,
        href: href.section(s.id, LENS_ANCHOR),
      });
    }
    for (const pid of s.problemIds) {
      const p = problems[pid];
      if (!p) continue;
      const num = problemNumber(pid);
      out.push({
        id: `problem:${pid}`,
        kind: 'problem',
        title: p.title,
        code: num,
        context: `${num ? `${num} · ` : ''}${label} · ${ROLE_LABEL[p.role]}`,
        href: href.problem(pid),
        problemId: pid,
      });
    }
  }

  const pages: [string, string, string, string?][] = [
    ['home', 'Home', href.home(), 'How to use this course and all sections'],
    [
      'sandbox',
      'Sandbox',
      href.sandbox(),
      'Free practice (not graded): books for several parties as Journal, T-accounts, Grid',
    ],
    ['journal', 'Sandbox: Journal', href.sandbox(), 'Write entries: debits then credits'],
    ['taccounts', 'Sandbox: T-accounts', href.taccounts(), 'Every party’s ledger as T-accounts'],
    ['sheet', 'Sandbox: Grid', href.sheet(), 'Entries down, accounts across, as a wide grid'],
    ['cheatsheet', 'Cheat sheet', href.cheatsheet(), 'A = L + E, normal sides, DEALER'],
    ['definitions', 'Definitions', href.definitions(), 'Every term the course defines'],
  ];
  for (const [id, title, h, context] of pages)
    out.push({ id: `page:${id}`, kind: 'page', title, context: context ?? '', href: h });
  out.push(
    {
      id: 'page:cheatsheet:dealer',
      kind: 'page',
      title: 'Mnemonic: DEALER',
      context: 'Cheat sheet',
      href: href.cheatsheet(CHEATSHEET_ANCHORS.dealer),
    },
    {
      id: 'page:cheatsheet:contra',
      kind: 'page',
      title: 'Contra accounts',
      context: 'Cheat sheet',
      href: href.cheatsheet(CHEATSHEET_ANCHORS.contra),
    },
  );

  for (const ex of EXAMPLES) {
    out.push({
      id: `example:${ex.id}`,
      kind: 'example',
      title: ex.label,
      context: 'Sandbox example — opens a pre-filled board',
      href: href.sandbox(engine.encodeState(ex.build())),
    });
  }

  return out;
}

// ---- matching ----

/** Lowercase, drop accents and apostrophes ("bank’s" → "banks"), split on anything that isn't a letter/digit. */
export function words(s: string): string[] {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘]/g, '')
    .split(/[^a-z0-9§]+/)
    .filter(Boolean);
}

const KIND_WEIGHT: Record<SearchKind, number> = {
  term: 6,
  section: 5,
  watch: 4,
  callout: 4,
  lens: 4,
  page: 3,
  example: 2,
  problem: 1,
};

interface Prepared {
  entry: SearchEntry;
  order: number;
  phrases: string[]; // normalized title + aliases, joined by single spaces
  titleWords: string[];
  aliasWords: string[];
}

export interface Searcher {
  search(query: string, limit?: number): SearchEntry[];
  size: number;
}

export function createSearcher(entries: SearchEntry[]): Searcher {
  const prepared: Prepared[] = entries.map((entry, order) => {
    const titleWords = words(entry.title);
    const aliasWords = (entry.aliases ?? []).flatMap(words);
    return {
      entry,
      order,
      titleWords,
      aliasWords,
      phrases: [entry.title, ...(entry.aliases ?? [])].map((p) => words(p).join(' ')),
    };
  });

  const score = (p: Prepared, q: string[], phrase: string, raw: string): number => {
    if (p.entry.code && p.entry.code.toLowerCase() === raw) return 2000;
    let s = 0;
    let inTitle = false;
    for (const t of q) {
      let best = 0;
      for (const w of p.titleWords) best = Math.max(best, w === t ? 20 : w.startsWith(t) ? 10 : 0);
      if (best > 0) inTitle = true;
      for (const w of p.aliasWords) best = Math.max(best, w === t ? 16 : w.startsWith(t) ? 8 : 0);
      if (best === 0) return 0; // every query word must match
      s += best;
    }
    if (p.phrases.includes(phrase)) s += 1000;
    else if (p.phrases.some((x) => x.startsWith(phrase))) s += 300;
    // Prefer short, specific titles (when the title is what matched); then the kind of thing; ties keep
    // course order.
    return s + KIND_WEIGHT[p.entry.kind] * 3 - (inTitle ? p.titleWords.length * 0.5 : 0);
  };

  return {
    size: prepared.length,
    search(query, limit = 30) {
      const raw = query.trim().toLowerCase();
      const q = words(query);
      if (q.length === 0) return [];
      const phrase = q.join(' ');
      return prepared
        .map((p) => ({ p, s: score(p, q, phrase, raw) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || a.p.order - b.p.order)
        .slice(0, limit)
        .map((x) => x.p.entry);
    },
  };
}

/**
 * When a result matched through an alias/keyword and not its title, the alias that explains it (so the dialog
 * can say *matches “idempotency key”*). Undefined when the title itself matches.
 */
export function matchedAlias(entry: SearchEntry, query: string): string | undefined {
  const q = words(query);
  if (q.length === 0 || !entry.aliases) return undefined;
  const covers = (ws: string[]) => q.every((t) => ws.some((w) => w.startsWith(t)));
  if (covers(words(entry.title))) return undefined;
  // The generic lens aliases ("lens") explain nothing — the kind label already says Lens.
  return entry.aliases.find((a) => !GENERIC_ALIASES.has(a) && covers(words(a)));
}

let cached: Searcher | undefined;
/** The site's searcher, built on first use (a few hundred short entries — milliseconds). */
export function siteSearch(): Searcher {
  cached ??= createSearcher(buildIndex());
  return cached;
}
