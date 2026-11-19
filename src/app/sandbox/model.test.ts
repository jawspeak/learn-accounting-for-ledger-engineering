// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { SandboxEntity } from '@contracts';
import { engine } from '@engine';
import { entities } from '@content';
import { EXAMPLES } from './examples';
import {
  applyAccounts,
  applyTemplate,
  emptyState,
  newEntity,
  duplicateEntity,
  setOpening,
  slugify,
  summarize,
  uniqueId,
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
  const base: SandboxEntity = {
    id: 'you',
    name: 'You',
    accounts: [{ id: 'cash', name: 'Cash', type: 'asset' }],
    rows: [{ id: 'r1', postings: [] }],
    showBalanceSheets: false,
  };
  it('re-ids new accounts as slugs and rewrites references', () => {
    const withRow: SandboxEntity = {
      ...base,
      rows: [{ id: 'r1', postings: [{ accountId: 'tmp-1', side: 'dr', amount: 100, chosenType: 'asset' }] }],
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
  it('template copies content accounts and names a pristine entity', () => {
    const e = applyTemplate(newEntity([], 'New entity'), entities.bank!);
    expect(e.name).toBe(entities.bank!.name);
    expect(e.accounts.length).toBe(entities.bank!.accounts.length);
  });
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
  it.each(EXAMPLES.map((x) => [x.label, x] as const))('%s: rows balance and A = L + E holds', (_, ex) => {
    const s = ex.build();
    expect(s.entities.length).toBeGreaterThanOrEqual(2);
    for (const e of s.entities) {
      const ids = new Set(e.accounts.map((a) => a.id));
      for (const r of e.rows) {
        expect(engine.rowTotals(r).balanced).toBe(true);
        expect(r.postings.length).toBeGreaterThan(0);
        for (const p of r.postings) expect(ids.has(p.accountId)).toBe(true);
      }
      for (const l of e.opening?.lines ?? []) expect(ids.has(l.accountId)).toBe(true);
      const sum = summarize(e);
      expect(sum.rowsBalanced).toBe(true);
      expect(sum.opening?.balanced ?? true).toBe(true);
      expect(sum.equation.balanced).toBe(true);
      expect(sum.equation.assets).toBeGreaterThan(0);
    }
  });
});

describe('summarize', () => {
  it('does not report an empty row as unbalanced', () => {
    const e: SandboxEntity = { id: 'x', name: 'X', accounts: [], rows: [{ id: 'r1', postings: [] }], showBalanceSheets: false };
    expect(summarize(e).unbalancedRows).toEqual([]);
    const half: SandboxEntity = { ...e, accounts: [{ id: 'cash', name: 'Cash', type: 'asset' }], rows: [{ id: 'r1', postings: [{ accountId: 'cash', side: 'dr', amount: 100 }] }] };
    expect(summarize(half).unbalancedRows).toEqual([1]);
  });
});

describe('untrusted markdown', () => {
  it('does not render raw HTML', () => {
    const html = renderUntrustedMarkdown('Hi <img src=x onerror=alert(1)> there\n\n<script>alert(1)</script>');
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
      for (const a of div.querySelectorAll('a')) expect(isSafeHref(a.getAttribute('href') ?? '')).toBe(true);
      for (const el of div.querySelectorAll('*'))
        for (const attr of el.attributes) expect(attr.value.toLowerCase()).not.toMatch(/javascript:|^data:/);
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
