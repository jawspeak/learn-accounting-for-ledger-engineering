import { describe, expect, it } from 'vitest';
import { ledgerBalance, parseTAccounts, tAccountsHtml } from './taccount';

const primer = `Checking Account (asset)
Opening: Dr 1,000
ATM withdrawal: Cr 60
Balance`;

describe('taccount', () => {
  it('parses an account with opening, postings and a balance request', () => {
    const [l] = parseTAccounts(primer);
    expect(l).toEqual({
      account: 'Checking Account',
      type: 'asset',
      showBalance: true,
      postings: [
        { label: 'Opening', side: 'dr', amount: 1000, opening: true },
        { label: 'ATM withdrawal', side: 'cr', amount: 60, opening: false },
      ],
    });
    expect(ledgerBalance(l!)).toBe(940);
  });

  it('renders the balance on its side, the increasing side shaded, and effect marks', () => {
    const html = tAccountsHtml(primer);
    expect(html).toContain('class="tacct tledger inc-dr tone-asset"');
    // Plain `Balance`: the shorthand — rule + bold total; the word is for screen readers only.
    expect(html).toMatch(
      /tl-balance is-total"><span class="tl-entry"><span class="sr-only">balance <\/span><strong class="tl-amt">\$940/,
    );
    expect(html).not.toContain('class="tl-label">balance');
    // `Balance: labelled` (introductory examples) writes the word.
    expect(tAccountsHtml(primer.replace(/Balance$/, 'Balance: labelled'))).toContain(
      '<span class="tl-label">balance</span><strong class="tl-amt">$940',
    );
    expect(html).toContain('tacct-effect is-down'); // the $60 credit lowers an asset
    // Only the side carrying the total gets the rule (is-total); the other half of the balance row stays open.
    expect(html.match(/tl-balance is-total/g)).toHaveLength(1);
    expect(html).toContain('tacct-dr tl-cell tl-balance is-total');
    expect(html).toContain('tacct-cr tl-cell tl-balance"');
    expect(html).not.toContain('(abnormal)');
  });

  it('one posting per line: opening on line 1 (Dr), the $60 credit on its own line 2 (Cr)', () => {
    const cells = [
      ...tAccountsHtml(primer).matchAll(
        /<span class="tacct-cell tacct-(dr|cr) tl-cell([^"]*)">(.*?)<\/span>(?=<span class="tacct-cell|<\/div>)/g,
      ),
    ];
    const lines = cells
      .filter((c) => !c[2]!.includes('tl-balance'))
      .map((c) => `${c[1]}:${c[3]!.includes('$') ? c[3]!.match(/\$[\d,]+/)![0] : ''}`);
    expect(lines).toEqual(['dr:$1,000', 'cr:', 'dr:', 'cr:$60']);
  });

  it('orders several accounts Assets → Liabilities → Equity and flags an abnormal balance', () => {
    const html = tAccountsHtml(
      'Groceries Expense (expense)\n(1): Dr 120\n\nChecking Account (asset)\n(2): Cr 120\nBalance',
    );
    const names = [...html.matchAll(/class="tacct-name">([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(['Checking Account', 'Groceries Expense']);
    expect(html).toContain('(abnormal)');
  });

  it('reports malformed blocks visibly', () => {
    expect(() => parseTAccounts('Cash\nDr 10')).toThrow(/Account name \(type\)/);
    expect(() => parseTAccounts('Cash (asset)\nlots of money')).toThrow(/line 2/);
    expect(tAccountsHtml('Cash (planet)\nDr 1')).toContain('tentry-error');
  });
});
