import { describe, expect, it } from 'vitest';
import { problems, sections } from '@content';
import { glossary } from '../../content/glossary';
import { buildIndex, createSearcher, siteSearch, words } from '.';

const s = siteSearch();
const top = (q: string) => s.search(q)[0];
const ids = (q: string) => s.search(q).map((e) => e.id);

describe('search index', () => {
  const index = buildIndex();

  it('has unique ids and a few hundred entries', () => {
    expect(new Set(index.map((e) => e.id)).size).toBe(index.length);
    expect(index.length).toBeGreaterThan(150);
    expect(index.length).toBeLessThan(400);
  });

  it('indexes every problem, section and glossary term', () => {
    for (const id of Object.keys(problems)) expect(ids(problems[id]!.title)).toContain(`problem:${id}`);
    for (const sec of sections) expect(index.some((e) => e.id === `section:${sec.id}`)).toBe(true);
    for (const t of glossary) expect(index.some((e) => e.id === `term:${t.id}`)).toBe(true);
  });

  it('indexes titles only — no prose (prompts, definitions, primers)', () => {
    for (const e of index) {
      expect(e.title.length, e.id).toBeLessThan(90);
      expect(e.title, e.id).not.toMatch(/\n/);
    }
    // A word that appears in prose everywhere but in no title.
    expect(s.search('whose')).toEqual([]);
  });
});

describe('ranking', () => {
  it('a glossary term (or alias) finds its definition first', () => {
    for (const t of glossary) {
      expect(top(t.term)?.id, t.term).toBe(`term:${t.id}`);
      // An alias may tie with a section of exactly that name (e.g. "journal entries"); either is a fine first hit.
      for (const a of t.aliases ?? []) expect(['term', 'section'], a).toContain(top(a)?.kind);
      for (const a of t.aliases ?? []) expect(ids(a).slice(0, 2), a).toContain(`term:${t.id}`);
    }
    expect(top('dr')?.id).toBe('term:debit');
    expect(top('cr')?.id).toBe('term:credit');
  });

  it('every section title finds its section first', () => {
    for (const sec of sections) expect(top(sec.title)?.id, sec.title).toBe(`section:${sec.id}`);
  });

  it('a common word finds things named for it, not everything', () => {
    const r = s.search('debit', 100);
    expect(r[0]?.id).toBe('term:debit');
    expect(r.length).toBeLessThan(20);
  });

  it('matches word prefixes, needs every word, and ignores punctuation and case', () => {
    expect(ids('watch loan')).toContain('watch:loan-creates-deposit');
    expect(ids('fbo gross')).toContain('watch:fbo-gross-up');
    expect(ids('LOAN CREATED')).toContain('callout:06-loans:0');
    expect(ids('the banks books')[0]).toBe('section:04-perspectives');
    expect(s.search('debit zzzz')).toEqual([]);
  });

  it('a problem number jumps to that problem', () => {
    const pid = sections.find((x) => x.id === '06-loans')!.problemIds[2]!;
    expect(top('6.3')?.id).toBe(`problem:${pid}`);
  });

  it('finds pages, cheat-sheet blocks and sandbox examples', () => {
    expect(top('sandbox')?.id).toBe('page:sandbox');
    expect(ids('dealer').slice(0, 2)).toEqual(expect.arrayContaining(['page:cheatsheet:dealer', 'problem:00-dealer']));
    expect(top('contra accounts')?.id).toMatch(/contra/);
    expect(ids('payroll')).toContain('example:payroll');
  });
});

describe('matcher basics', () => {
  it('words() normalizes', () => {
    expect(words('Bank’s Books — Dr/Cr!')).toEqual(['banks', 'books', 'dr', 'cr']);
  });
  it('empty query returns nothing', () => {
    expect(createSearcher(buildIndex()).search('   ')).toEqual([]);
  });
});
