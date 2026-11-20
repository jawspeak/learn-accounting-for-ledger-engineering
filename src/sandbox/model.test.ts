// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { EntityBooks } from '@contracts';
import { engine } from '@engine';
import { EXAMPLES } from '../../content/sandbox-examples';
import {
  addScenarioTo,
  allBooks,
  applyAccounts,
  booksOf,
  duplicateEntity,
  duplicateEntityIn,
  duplicateScenarioIn,
  emptyState,
  eventParts,
  persistable,
  removeEntityFrom,
  removeScenarioFrom,
  scenarioStatus,
  setOpening,
  slugify,
  summarize,
  uniqueId,
  usageByScenario,
  withBooks,
  withColumnOrder,
} from './model';
import { isSafeHref, renderUntrustedMarkdown } from './safeMarkdown';

describe('ids', () => {
  it('slugifies to kebab-case', () => {
    expect(slugify('Cash: Vault')).toBe('cash-vault');
    expect(slugify('  Café Receivable!! ')).toBe('cafe-receivable');
    expect(slugify('***')).toBe('account');
  });
  it('de-duplicates', () => {
    expect(uniqueId('Cash', ['cash', 'cash-2'])).toBe('cash-3');
    expect(uniqueId('Cash', [])).toBe('cash');
  });
});

describe('applyAccounts', () => {
  const base: EntityBooks = {
    id: 'you',
    name: 'You',
    accounts: [{ id: 'cash', name: 'Cash', type: 'asset' }],
    rows: [{ id: 'r1', postings: [] }],
    showBalanceSheets: false,
  };
  it('re-ids new accounts as slugs and rewrites references', () => {
    const withRow: EntityBooks = {
      ...base,
      rows: [
        {
          id: 'r1',
          postings: [{ accountId: 'tmp-1', side: 'dr', amount: 100, chosenType: 'asset' }],
        },
      ],
      columnOrder: ['tmp-1', 'cash'],
    };
    const out = applyAccounts(withRow, [
      ...base.accounts,
      { id: 'tmp-1', name: 'Cash', type: 'asset' },
      { id: 'tmp-2', name: 'Allowance', type: 'contra-asset', contraOf: 'tmp-1' },
    ]);
    expect(out.accounts.map((a) => a.id)).toEqual(['cash', 'cash-2', 'allowance']);
    expect(out.accounts[2]!.contraOf).toBe('cash-2');
    expect(out.rows[0]!.postings[0]!.accountId).toBe('cash-2');
    expect(out.columnOrder).toEqual(['cash-2', 'cash']);
  });
  it('keeps ids of existing accounts on rename and drops opening lines of deleted accounts', () => {
    const e = setOpening(base, 'cash', 1024); // cents: $10.24
    expect(e.opening?.lines).toEqual([{ accountId: 'cash', amount: 1024 }]);
    const renamed = applyAccounts(e, [{ id: 'cash', name: 'Wallet', type: 'asset' }]);
    expect(renamed.accounts[0]).toEqual({ id: 'cash', name: 'Wallet', type: 'asset' });
    expect(applyAccounts(e, []).opening).toBeUndefined();
  });
  it('treats an empty column order as canonical', () => {
    expect(withColumnOrder({ ...base, columnOrder: ['cash'] }, []).columnOrder).toBeUndefined();
    expect('columnOrder' in withColumnOrder(base, undefined)).toBe(false);
  });
});

describe('entities', () => {
  it('duplicate gets a unique id', () => {
    const s = emptyState();
    const d = duplicateEntity(s.entities, s.entities[0]!);
    expect(d.id).not.toBe(s.entities[0]!.id);
    expect(d.name).toMatch(/copy/);
  });
});

describe('URL round-trip', () => {
  it('encodes and decodes a sandbox state', () => {
    for (const ex of EXAMPLES) {
      const s = ex.build();
      expect(engine.decodeSandbox(engine.encodeState(s))).toEqual(s);
    }
  });
  it('rejects garbage', () => {
    expect(engine.decodeSandbox('not-a-real-state')).toBeNull();
    expect(engine.decodeSandbox('')).toBeNull();
  });
});

describe('examples', () => {
  it.each(EXAMPLES.map((x) => [x.label, x] as const))(
    '%s: in every scenario, entries balance and A = L + E holds for every entity',
    (_, ex) => {
      const s = ex.build();
      expect(s.entities.length).toBeGreaterThanOrEqual(2);
      expect(s.scenarios.length).toBeGreaterThanOrEqual(2);
      for (const [si, sc] of s.scenarios.entries()) {
        expect(sc.text.length).toBeGreaterThan(0);
        for (const ei of s.entities.keys()) {
          const e = booksOf(s, si, ei);
          const ids = new Set(e.accounts.map((a) => a.id));
          for (const r of e.rows) {
            if (r.none) continue; // this event has no entry in these books
            expect(engine.rowTotals(r).balanced).toBe(true);
            for (const p of r.postings) expect(ids.has(p.accountId)).toBe(true);
          }
          for (const l of e.opening?.lines ?? []) expect(ids.has(l.accountId)).toBe(true);
          const sum = summarize(e);
          expect(sum.rowsBalanced).toBe(true);
          expect(sum.opening?.balanced ?? true).toBe(true);
          expect(sum.equation.balanced).toBe(true);
        }
      }
    },
  );
});

describe('entities × scenarios', () => {
  const ex = () => EXAMPLES.find((x) => x.id === 'fbo')!.build();

  it('the views edit one entity in one scenario; accounts are shared, entries are not', () => {
    let s = ex();
    const zap = s.entities.findIndex((e) => e.id === 'zap');
    // Add an account in scenario 1: every scenario has it; scenario 2's entries are untouched.
    const b = booksOf(s, 0, zap);
    s = withBooks(s, 0, zap, {
      ...b,
      accounts: [...b.accounts, { id: 'rewards', name: 'Rewards Payable', type: 'liability' }],
      rows: [],
    });
    expect(booksOf(s, 1, zap).accounts.map((a) => a.id)).toContain('rewards');
    expect(booksOf(s, 0, zap).rows).toEqual([]);
    expect(booksOf(s, 1, zap).rows).toHaveLength(1);
  });

  it('removing an account removes its lines in every scenario', () => {
    let s = ex();
    const zap = s.entities.findIndex((e) => e.id === 'zap');
    expect(usageByScenario(s, 'zap', 'wallet-bob')).toEqual([0, 1, 2]);
    const b = booksOf(s, 0, zap);
    s = withBooks(s, 0, zap, { ...b, accounts: b.accounts.filter((a) => a.id !== 'wallet-bob') });
    expect(usageByScenario(s, 'zap', 'wallet-bob')).toEqual([0, 0, 0]);
    expect(booksOf(s, 2, zap).opening!.lines.some((l) => l.accountId === 'wallet-bob')).toBe(false);
  });

  it('add / duplicate / remove scenarios and entities', () => {
    let s = ex();
    s = addScenarioTo(s).state;
    expect(s.scenarios.at(-1)).toMatchObject({ title: 'Scenario 4', events: [], opening: {} });
    s = duplicateScenarioIn(s, 0);
    expect(s.scenarios[1]!.title).toBe('Alice tops up $50 (copy)');
    expect(s.scenarios[1]!.events).toEqual(s.scenarios[0]!.events);
    s = removeScenarioFrom(s, 1);
    expect(s.scenarios).toHaveLength(4);
    s = duplicateEntityIn(s, 0);
    const copy = s.entities[1]!;
    const ev0 = s.scenarios[0]!.events[0]!;
    expect(ev0.lines[copy.id]).toEqual(ev0.lines[s.entities[0]!.id]);
    s = removeEntityFrom(s, 1);
    expect(s.scenarios.every((sc) => sc.events.every((ev) => !(copy.id in ev.lines)))).toBe(true);
  });

  it('Bob’s cash-out settles through the Fed: what leaves one bank’s reserves arrives in the other’s', () => {
    const s = ex();
    const reserves = (entityId: string) =>
      allBooks(s, 2)
        .find((b) => b.id === entityId)!
        .rows.flatMap((r) => r.postings)
        .filter((p) => p.accountId === 'reserves-fed')
        .map((p) => [p.side, p.amount]);
    expect(reserves('bank')).toEqual([['cr', 1900]]); // First Example Bank pays out $19
    expect(reserves('bobs-bank')).toEqual([['dr', 1900]]); // Bob's Bank receives it
    // E2, the fee sweep, stays inside First Example Bank: Bob's Bank has no entry.
    expect(eventParts(s, 2)[1]!.map((p) => p.part)).toEqual(['posted', 'posted', 'none']);
    expect(scenarioStatus(s, 2)).toBe('ok');
  });

  it('events are shared: one row per event in every entity, the same label and number (E1…)', () => {
    let s = ex();
    const zap = s.entities.findIndex((e) => e.id === 'zap');
    const bank = s.entities.findIndex((e) => e.id === 'bank');
    // S3: E1 the cash-out (Zap: one entry, three lines; the bank: FBO → checking), E2 the fee sweep.
    expect(booksOf(s, 2, zap).rows.map((r) => r.postings.length)).toEqual([3, 2]);
    expect(booksOf(s, 2, bank).rows.map((r) => r.label)).toEqual(
      booksOf(s, 2, zap).rows.map((r) => r.label),
    );
    // Renaming an event in one entity's journal renames it for every entity.
    const b = booksOf(s, 2, zap);
    s = withBooks(s, 2, zap, {
      ...b,
      rows: b.rows.map((r, i) => (i === 0 ? { ...r, label: 'Cash-out' } : r)),
    });
    expect(booksOf(s, 2, bank).rows[0]!.label).toBe('Cash-out');
  });

  it('each entity has its entry for an event, "no entry", or one still to do — and a missing side is ✗', () => {
    let s = ex();
    // S2 "Alice pays Bob": Zap posts it; the bank has no entry (the money never leaves the FBO account).
    expect(eventParts(s, 1)[0]!.map((p) => [p.entity, p.part])).toEqual([
      ['Zap', 'posted'],
      ['First Example Bank', 'none'],
      ['Bob’s Bank', 'none'],
    ]);
    expect(scenarioStatus(s, 1)).toBe('ok');
    // Clear "no entry" for the bank without filling it in: its side is missing, so the scenario is ✗.
    const bank = s.entities.findIndex((e) => e.id === 'bank');
    const b = booksOf(s, 1, bank);
    s = withBooks(s, 1, bank, {
      ...b,
      rows: b.rows.map((r) => ({ id: r.id, label: r.label, postings: [] })),
    });
    expect(eventParts(s, 1)[0]![1]!.part).toBe('todo');
    expect(scenarioStatus(s, 1)).toBe('bad');
  });

  it('persistable drops half-written lines and the type an account already says', () => {
    const s = ex();
    const out = persistable(s);
    const p = out.scenarios[0]!.events[0]!.lines.zap![0]!;
    expect(p).toEqual({ accountId: 'fbo-cash', side: 'dr', amount: 5000 });
    expect(engine.decodeSandbox(engine.encodeState(out))).toEqual(out);
  });
});

describe('summarize', () => {
  it('does not report an empty row as unbalanced', () => {
    const e: EntityBooks = {
      id: 'x',
      name: 'X',
      accounts: [],
      rows: [{ id: 'r1', postings: [] }],
      showBalanceSheets: false,
    };
    expect(summarize(e).unbalancedRows).toEqual([]);
    const half: EntityBooks = {
      ...e,
      accounts: [{ id: 'cash', name: 'Cash', type: 'asset' }],
      rows: [{ id: 'r1', postings: [{ accountId: 'cash', side: 'dr', amount: 100 }] }],
    };
    expect(summarize(half).unbalancedRows).toEqual([1]);
  });
});

describe('untrusted markdown', () => {
  it('does not render raw HTML', () => {
    const html = renderUntrustedMarkdown(
      'Hi <img src=x onerror=alert(1)> there\n\n<script>alert(1)</script>',
    );
    const div = parse(html);
    expect(div.querySelector('img')).toBeNull();
    expect(div.querySelector('script')).toBeNull();
    expect(html).not.toMatch(/<img/i);
    expect(div.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('strips javascript: and other unsafe links', () => {
    for (const src of [
      '[x](javascript:alert(1))',
      '[x](JavaScript:alert(1))',
      '[x](java\tscript:alert(1))',
      '[x](jav&#x61;script:alert(1))',
      '[x](data:text/html,<script>alert(1)</script>)',
      '<javascript:alert(1)>',
      '![i](javascript:alert(1))',
    ]) {
      const div = parse(renderUntrustedMarkdown(src));
      for (const a of div.querySelectorAll('a'))
        expect(isSafeHref(a.getAttribute('href') ?? '')).toBe(true);
      for (const el of div.querySelectorAll('*'))
        for (const attr of el.attributes)
          expect(attr.value.toLowerCase()).not.toMatch(/javascript:|^data:/);
      expect(div.querySelector('img')).toBeNull();
    }
  });
  it('keeps safe markdown and links', () => {
    const div = parse(renderUntrustedMarkdown('**bold** [docs](https://example.com) [s3](#/s/03)'));
    expect(div.querySelector('strong')?.textContent).toBe('bold');
    expect([...div.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://example.com',
      '#/s/03',
    ]);
  });
});

function parse(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}
