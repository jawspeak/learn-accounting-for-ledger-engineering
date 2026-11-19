import { describe, expect, it } from 'vitest';
import { problems, sections } from '@content';
import { glossary } from '../../content/glossary';
import { lensKeywords } from '../../content/search-keywords';
import { buildIndex, createSearcher, matchedAlias, siteSearch, words } from '.';

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
    for (const id of Object.keys(problems))
      expect(ids(problems[id]!.title)).toContain(`problem:${id}`);
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
    expect(ids('dealer').slice(0, 2)).toEqual(
      expect.arrayContaining(['page:cheatsheet:dealer', 'problem:00-dealer']),
    );
    expect(top('contra accounts')?.id).toMatch(/contra/);
    expect(ids('payroll')).toContain('example:payroll');
  });
});

describe('ledger engineer’s lens', () => {
  const withLens = sections.filter((x) => x.lens);

  it('every lens has keywords, and every keyword entry is a real section with a lens', () => {
    for (const sec of withLens) expect(lensKeywords[sec.id], sec.id).toBeTruthy();
    for (const id of Object.keys(lensKeywords))
      expect(
        withLens.map((x) => x.id),
        id,
      ).toContain(id);
  });

  it('"lens" lists every lens first, in course order, without a "matches" note', () => {
    const r = s.search('lens', 100);
    expect(r.slice(0, withLens.length).map((e) => e.id)).toEqual(
      withLens.map((x) => `lens:${x.id}`),
    );
    expect(r.filter((e) => e.kind === 'lens')).toHaveLength(withLens.length);
    expect(r.map((e) => matchedAlias(e, 'lens')).filter(Boolean)).toEqual([]);
  });

  it('"reconcile" and "reconciliation" find every lens about reconciling', () => {
    for (const q of ['reconcile', 'reconciliation'])
      expect(ids(q), q).toEqual(
        expect.arrayContaining([
          'lens:04-perspectives',
          'lens:06-loans',
          'lens:08-accruals',
          'lens:10-processes',
          'lens:11-fintech',
        ]),
      );
  });

  it('engineering words find the right lens', () => {
    expect(ids('idempotency')).toEqual(
      expect.arrayContaining(['lens:05-journal-entries', 'lens:11-fintech']),
    );
    expect(ids('cron')[0]).toBe('lens:08-accruals');
    expect(ids('signed amount')[0]).toBe('lens:02-debits-credits');
    expect(ids('sub-ledger')).toContain('lens:04-perspectives');
    expect(ids('floating point')[0]).toBe('lens:03-t-accounts');
    expect(ids('schema migration')[0]).toBe('lens:12-capstone');
    expect(ids('store gross')[0]).toBe('lens:09-contra');
  });

  it('does not flood common accounting words', () => {
    expect(s.search('debit', 100).length).toBeLessThan(20);
    expect(s.search('debit', 100).some((e) => e.kind === 'lens')).toBe(false);
  });

  it('says which keyword matched when the title did not', () => {
    const e = s.search('cron')[0]!;
    expect(matchedAlias(e, 'cron')).toBe('cron job');
    expect(matchedAlias(s.search('dr')[0]!, 'dr')).toBe('dr');
    expect(matchedAlias(s.search('accruals are')[0]!, 'accruals are')).toBeUndefined();
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
