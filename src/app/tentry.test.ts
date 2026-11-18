import { describe, expect, it } from 'vitest';
import { parseTEntry, tEntryHtml } from './tentry';

const src = `You repay the loan
Loan Payable (liability): Dr 1,000
Interest Expense (expense): Dr 50
Checking Account (asset): Cr $1,050`;

describe('tentry', () => {
  it('parses events and lines', () => {
    expect(parseTEntry(src)).toEqual([
      {
        title: 'You repay the loan',
        lines: [
          { account: 'Loan Payable', type: 'liability', side: 'dr', amount: 1000 },
          { account: 'Interest Expense', type: 'expense', side: 'dr', amount: 50 },
          { account: 'Checking Account', type: 'asset', side: 'cr', amount: 1050 },
        ],
      },
    ]);
  });

  it('marks the increasing side consistently and the effect of each amount', () => {
    const html = tEntryHtml(src);
    expect(html).toContain('class="tacct inc-cr tone-liability"'); // liabilities increase with a credit
    expect(html).toContain('class="tacct inc-dr tone-expense"');
    expect(html).toContain('class="tacct inc-dr tone-asset"');
    // Dr on a liability = decrease; Dr on an expense = increase; Cr on an asset = decrease.
    expect(html.match(/tacct-amt is-down/g)).toHaveLength(2);
    expect(html.match(/tacct-amt is-up/g)).toHaveLength(1);
    expect(html).toContain('Dr $1,050 = Cr $1,050');
  });

  it('flags an unbalanced event and escapes text', () => {
    const html = tEntryHtml('A <b>bad</b> one\nCash (asset): Dr 10\nRevenue (revenue): Cr 5');
    expect(html).toContain('is-bad');
    expect(html).toContain('A &lt;b&gt;bad&lt;/b&gt; one');
  });

  it('reports a malformed posting instead of rendering a wrong figure', () => {
    expect(() => parseTEntry('Event\nCash (asset): Dr 10\noops')).toThrow(/line 3/);
    expect(() => parseTEntry('Event\nCash (planet): Dr 10')).toThrow(/unknown account type/);
    expect(tEntryHtml('Event\nCash (planet): Dr 10')).toContain('tentry-error');
  });
});
