import { describe, expect, it } from 'vitest';
import { journalBlockHtml, journalHtml, parseJournal, rowsToEntries } from './journal';

describe('journal', () => {
  it('parses titles, debits and indented credits; blank line separates entries', () => {
    const entries = parseJournal(`2026-11-02  Deposit cash
Dr  Checking Account     100
    Cr  Cash                  100

T2
Dr Savings 500
Cr Salary Income $500`);
    expect(entries).toEqual([
      {
        title: '2026-11-02  Deposit cash',
        lines: [
          { account: 'Checking Account', side: 'dr', amount: 10000 },
          { account: 'Cash', side: 'cr', amount: 10000 },
        ],
      },
      {
        title: 'T2',
        lines: [
          { account: 'Savings', side: 'dr', amount: 50000 },
          { account: 'Salary Income', side: 'cr', amount: 50000 },
        ],
      },
    ]);
  });

  it('a title line right after an entry starts the next entry (dated journals without blank lines)', () => {
    const e = parseJournal(
      '11-05 Gift\nDr Checking 300\nCr Gifts 300\n11-06 Cash\nDr Cash 100\nCr Checking 100',
    );
    expect(e.map((x) => x.title)).toEqual(['11-05 Gift', '11-06 Cash']);
  });

  it('renders debits first, credits indented, and a balanced totals line', () => {
    const html = journalHtml([
      {
        title: 'Repay',
        lines: [
          { account: 'Checking', side: 'cr', amount: 105000 },
          { account: 'Loan Payable', side: 'dr', amount: 100000 },
          { account: 'Interest Expense', side: 'dr', amount: 5000 },
        ],
      },
    ]);
    const order = [...html.matchAll(/je-line is-(dr|cr)"><td class="je-acct">([^<]+)/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    expect(order).toEqual(['dr Loan Payable', 'dr Interest Expense', 'cr Checking']);
    expect(html).toContain('Debits = credits');
    expect(html).toContain('$1,050');
  });

  it('flags an unbalanced entry, escapes text, and shows parse errors visibly', () => {
    const html = journalHtml([
      { title: '<b>x</b>', lines: [{ account: 'A', side: 'dr', amount: 100 }] },
    ]);
    expect(html).toContain('Debits ≠ credits');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(journalBlockHtml('Title only')).toContain('je-error');
  });

  it('numbers builder rows', () => {
    const entries = rowsToEntries(
      [
        { id: 'r1', postings: [{ accountId: 'cash', side: 'dr', amount: 100 }] },
        { id: 'r2', label: 'Pay', postings: [] },
      ],
      (id) => id.toUpperCase(),
    );
    expect(entries.map((e) => e.title)).toEqual(['1. Transaction 1', '2. Pay']);
    expect(entries[0]!.lines[0]!.account).toBe('CASH');
  });
});
