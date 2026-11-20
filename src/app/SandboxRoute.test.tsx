// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SandboxState, ScenarioBooks } from '@contracts';
import { engine } from '@engine';
import { parseHash, type SandboxView } from './router';
import SandboxRoute, { URL_DEBOUNCE_MS } from './SandboxRoute';
import { EXAMPLES } from '../../content/sandbox-examples';
import {
  addEntry,
  booksOf,
  emptyState,
  entryCheck,
  persistable,
  setLineAccount,
  setLineAmount,
  summarize,
  withBooks,
} from '../sandbox/model';

beforeEach(() => {
  vi.useFakeTimers();
  // replaceState, not location.hash: a hash assignment fires a (late) hashchange, which reloads the board.
  history.replaceState(null, '', '#/sandbox');
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The state currently in the URL (after the debounced write). */
function urlState(): SandboxState | null {
  const r = parseHash(window.location.hash);
  return r.name === 'sandbox' && r.data ? engine.decodeSandbox(r.data) : null;
}
/** One entity's books in one scenario, from the URL. */
const urlBooks = (scenario: number, entityId: string): ScenarioBooks => {
  const s = urlState()!;
  return booksOf(
    s,
    scenario,
    s.entities.findIndex((e) => e.id === entityId),
  );
};
const flush = () => act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS + 10));
const mount = (view: SandboxView, s?: SandboxState, entity = 0, scenario = 0) =>
  render(
    <SandboxRoute
      view={view}
      data={s ? engine.encodeState(s) : undefined}
      scenario={scenario}
      entity={entity}
    />,
  );
/** "You and your bank": scenario 1 is "Borrow, then pay interest" (You: 2 entries; the bank: 2 entries). */
const bank = () => EXAMPLES.find((x) => x.id === 'bank')!.build();
const LOAN = 1;
const mountLoan = (view: SandboxView, entity = 0) => mount(view, bank(), entity, LOAN);

describe('Journal view (the editor)', () => {
  it('write an entry: description, accounts, amounts; Dr = Cr status; saved in the link', () => {
    const s = emptyState();
    s.entities[0]!.accounts = [
      { id: 'cash', name: 'Cash', type: 'asset' },
      { id: 'checking', name: 'Checking Account', type: 'asset' },
    ];
    mount('journal', s);
    // No entries yet: a blank first entry is there to write into (no need for "+ Add entry").
    expect(screen.getByText(/Write your first entry/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove entry 1' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Entry 1 description'), {
      target: { value: 'Deposit cash' },
    });
    fireEvent.change(screen.getByLabelText('Entry 1 line 1 account'), {
      target: { value: 'checking' },
    });
    fireEvent.change(screen.getByLabelText('Entry 1 line 1 debit'), { target: { value: '44.24' } });
    expect(screen.getByText(/Debits \$44.24 ≠ credits \$0/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Entry 1 line 2 account'), {
      target: { value: 'cash' },
    });
    fireEvent.change(screen.getByLabelText('Entry 1 line 2 credit'), {
      target: { value: '44.24' },
    });
    // A balanced entry shows no status (only a problem is worth the space).
    expect(document.querySelector('.jx-status')).toBeNull();
    flush();
    const row = urlBooks(0, 'you').rows[0]!;
    expect(row.label).toBe('Deposit cash');
    // The link leaves out what the account already says (its type).
    expect(row.postings).toEqual([
      { accountId: 'checking', side: 'dr', amount: 4424 },
      { accountId: 'cash', side: 'cr', amount: 4424 },
    ]);
  });

  it('type under Dr or Cr: the line becomes a debit or a credit, and leaving the entry puts debits first', () => {
    mountLoan('journal');
    // Entry 1 is "Dr Checking $500 / Cr Loan Payable $500". Retype the debit under Cr…
    const dr = screen.getByLabelText('Entry 1 line 1 debit') as HTMLInputElement;
    fireEvent.focus(dr);
    fireEvent.change(dr, { target: { value: '' } });
    const cr = screen.getByLabelText('Entry 1 line 1 credit') as HTMLInputElement;
    fireEvent.change(cr, { target: { value: '500' } });
    expect(cr.closest('tr')!.className).toMatch(/is-cr/);
    // …and add a line, type its debit: still in the order written while you're in the entry.
    fireEvent.click(screen.getByRole('button', { name: 'Add a line to entry 1' }));
    fireEvent.change(screen.getByLabelText('Entry 1 line 3 debit'), { target: { value: '1000' } });
    const sides = () =>
      [...document.querySelectorAll('#entry-1 tr.jx-line')].map((tr) =>
        tr.classList.contains('is-cr') ? 'cr' : 'dr',
      );
    expect(sides()).toEqual(['cr', 'cr', 'dr']);
    // Leaving the entry sorts it: debits first.
    fireEvent.blur(document.querySelector('#entry-1')!, { relatedTarget: document.body });
    expect(sides()).toEqual(['dr', 'cr', 'cr']);
  });

  it('beside each amount: ▲ (green) when it increases the account, ▼ (red) when it decreases it', () => {
    mountLoan('journal'); // Entry 1: Dr Checking $500 / Cr Loan Payable $500; entry 2: Dr Interest / Cr Checking
    const mark = (label: string) =>
      screen.getByLabelText(label).closest('td')!.querySelector('.jx-eff')!;
    expect(mark('Entry 1 line 1 debit').className).toMatch(/is-up/);
    expect(mark('Entry 1 line 1 debit').getAttribute('title')).toBe(
      'Asset — this debit increases Checking Account',
    );
    expect(mark('Entry 1 line 2 credit').getAttribute('title')).toBe(
      'Liability — this credit increases Loan Payable',
    );
    // Paying interest out of checking: a credit to an asset decreases it.
    expect(mark('Entry 2 line 2 credit').className).toMatch(/is-down/);
    expect(mark('Entry 2 line 2 credit').textContent).toBe('▼ decreases the account');
    // No mark in the empty column of a line.
    expect(mark('Entry 1 line 1 credit').textContent).toBe('');
    // The account's type sits in the Account column, to the right of the account.
    const type = (label: string) =>
      screen.getByLabelText(label).closest('td')!.querySelector('.jx-acct-type')?.textContent;
    expect(type('Entry 1 line 1 account')).toBe('Asset');
    expect(type('Entry 1 line 2 account')).toBe('Liability');
  });

  it('half-written lines stay on screen but are left out of the link', () => {
    mountLoan('journal');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line to entry 1' }));
    expect(screen.getByLabelText('Entry 1 line 3 account')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Entry 1 description'), { target: { value: 'Borrow' } });
    flush();
    expect(urlBooks(LOAN, 'you').rows[0]!.postings).toHaveLength(2);
    expect(screen.getByLabelText('Entry 1 line 3 account')).toBeTruthy();
  });

  it('a new account straight from a line’s account list', () => {
    mountLoan('journal');
    fireEvent.click(screen.getByRole('button', { name: /Add entry/ }));
    fireEvent.change(screen.getByLabelText('Entry 3 line 1 account'), {
      target: { value: '__new' },
    });
    const form = screen.getByRole('form', { name: 'New account' });
    fireEvent.change(within(form).getByLabelText('New account name'), { target: { value: 'Car' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }));
    expect((screen.getByLabelText('Entry 3 line 1 account') as HTMLSelectElement).value).toBe(
      'car',
    );
    expect(screen.getByText(/^Accounts \(6\)/)).toBeTruthy();
  });

  it('events move up / down and can be removed — for every entity, asking first if another has lines', () => {
    mountLoan('journal');
    fireEvent.click(screen.getByRole('button', { name: 'Move entry 2 up' }));
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Pay $5 interest',
    );
    // The bank has its entry for this event too, so removing it asks first.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry 1' }));
    expect(confirm.mock.calls[0]![0]).toMatch(
      /Remove E1 from every entity\? First Example Bank’s entry goes too/,
    );
    expect(screen.getByLabelText('Entry 2 description')).toBeTruthy(); // kept
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry 1' }));
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Borrow $500',
    );
    expect(screen.queryByLabelText('Entry 2 description')).toBeNull();
    // …and it's gone from the bank's books too (the same event).
    flush();
    expect(urlBooks(LOAN, 'bank').rows.map((r) => r.label)).toEqual(['Borrow $500']); // one name per event
    confirm.mockRestore();
  });

  it('every event shows the other side, can be marked "No entry", and flags a missing side', () => {
    mount('journal', EXAMPLES.find((x) => x.id === 'fbo')!.build(), 0, 1); // S2 "Alice pays Bob"
    // Zap's E1: the bank has no entry (the money never leaves the FBO account).
    expect(screen.getByRole('link', { name: /First Example Bank\s*\(no entry\)/ })).toBeTruthy();
    // In the bank's journal, E1 is "No entry"; add one, and the scenario flags the missing side until filled.
    fireEvent.click(
      within(screen.getByRole('tablist', { name: 'Entities' })).getByRole('tab', {
        name: 'First Example Bank',
      }),
    );
    expect(screen.getByTitle(/has no entry in First Example Bank’s books/).textContent).toMatch(
      /^No entry here/,
    );
    fireEvent.click(screen.getByRole('button', { name: '＋ Add one' }));
    expect(screen.getByLabelText('Entry 1 line 1 account')).toBeTruthy();
    expect(screen.getByText(/First Example Bank’s side is missing/)).toBeTruthy();
    const tab = within(screen.getByRole('tablist', { name: 'Scenarios' })).getAllByRole('tab')[1]!;
    expect(tab.textContent).toMatch(/^S2✗/);
    // Mark it "No entry" again: the scenario is fine.
    fireEvent.click(screen.getByRole('button', { name: 'No entry for entry 1' }));
    expect(tab.textContent).toMatch(/^S2✓/);
  });
});

describe('Accounts panel', () => {
  it('manual order: a list, so ↑ ↓ move an account earlier / later (the order the Grid shows left → right)', () => {
    mountLoan('journal');
    expect(
      screen.queryByRole('button', { name: /^Move (?!entry|scenario).* (up|down)$/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    expect(
      screen.queryByRole('button', { name: /^Move (?!entry|scenario).* (left|right)$/ }),
    ).toBeNull();
    const names = () =>
      [...document.querySelectorAll<HTMLInputElement>('.sbx-accounts tbody input')].map(
        (i) => i.value,
      );
    const before = names();
    fireEvent.click(screen.getByRole('button', { name: `Move ${before[1]} up` }));
    expect(names().slice(0, 2)).toEqual([before[1], before[0]]);
    expect(screen.getByRole('button', { name: `Move ${before[1]} up` })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

describe('entities (Journal and Grid)', () => {
  it('tabs pick whose books; add, duplicate, rename and remove an entity', () => {
    mountLoan('journal');
    const tabs = screen.getByRole('tablist', { name: 'Entities' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['You', 'First Example Bank']);
    fireEvent.click(within(tabs).getByRole('tab', { name: 'First Example Bank' }));
    expect(screen.getByRole('tabpanel', { name: 'First Example Bank' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate entity' }));
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe(
      'First Example Bank (copy)',
    );
    fireEvent.change(screen.getByLabelText('Entity name'), { target: { value: 'Bank 2' } });
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe('Bank 2');
    fireEvent.click(screen.getByRole('button', { name: 'Remove entity' }));
    expect(screen.getByRole('group', { name: 'Confirm remove entity' }).textContent).toMatch(
      /in all 3 scenarios/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '+ Add entity' }));
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
  });
});

/** Open one of the "⋯" menus (Sandbox menu, Scenario menu). */
const openMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('scenarios', () => {
  it('tabs pick the scenario — "S1 ✓ title", like a test run; the URL remembers it; accounts carry over', () => {
    mount('journal', bank());
    const tabs = screen.getByRole('tablist', { name: 'Scenarios' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual([
      'S1✓Deposit cash (balances)',
      'S2✓Borrow, then pay interest (balances)',
      'S3✓Repay the loan (balances)',
    ]);
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Deposit cash',
    );
    fireEvent.click(within(tabs).getByRole('tab', { name: /Borrow, then pay interest/ }));
    expect(parseHash(window.location.hash)).toMatchObject({ scenario: 1 });
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Borrow $500',
    );
    // A new scenario: the same entities and accounts, empty books (no ✓ or ✗ yet).
    fireEvent.click(screen.getByRole('button', { name: '+ Add scenario' }));
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe('S4Scenario 4');
    // Its Journal shows only the blank first entry.
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe('');
    expect(screen.queryByLabelText('Entry 2 description')).toBeNull();
    expect(screen.getByText(/^Accounts \(5\)/)).toBeTruthy();
    // Rename it from the scenario's "⋯" menu.
    openMenu('Scenario menu');
    fireEvent.change(screen.getByLabelText('Scenario title'), { target: { value: 'Overdraft' } });
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe('S4Overdraft');
    flush();
    expect(urlState()!.scenarios.map((s) => s.title)).toEqual([
      'Deposit cash',
      'Borrow, then pay interest',
      'Repay the loan',
      'Overdraft',
    ]);
  });

  it('duplicate, move and remove a scenario (remove asks first)', () => {
    mount('journal', bank());
    const tabs = screen.getByRole('tablist', { name: 'Scenarios' });
    // The title, without the S-number and the check.
    const titles = () =>
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent!.replace(/^S\d+✓|\s\(balances\)$/g, ''));
    openMenu('Scenario menu');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate scenario' }));
    expect(titles()[1]).toBe('Deposit cash (copy)');
    openMenu('Scenario menu');
    fireEvent.click(screen.getByRole('button', { name: 'Move scenario right' }));
    expect(titles()[2]).toBe('Deposit cash (copy)');
    fireEvent.click(screen.getByRole('button', { name: 'Remove scenario' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(titles()).toEqual(['Deposit cash', 'Borrow, then pay interest', 'Repay the loan']);
  });

  it('a scenario whose books don’t balance shows ✗ on its tab', () => {
    const s = bank();
    s.scenarios[0]!.events[0]!.lines.you![0]!.amount = 9900; // Dr $99 ≠ Cr $100
    mount('journal', s);
    const tab = within(screen.getByRole('tablist', { name: 'Scenarios' })).getAllByRole('tab')[0]!;
    expect(tab.textContent).toBe('S1✗Deposit cash (doesn’t balance)');
  });

  it('the story shows its first line; click it to read or edit it all', () => {
    mount('journal', bank());
    const line = screen.getByRole('button', { name: /You walk into First Example Bank/ });
    expect(line.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/it now owes you \$100/)).toBeNull();
    fireEvent.click(line);
    expect(screen.getByText(/it now owes you \$100/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      (screen.getByLabelText('Scenario text (markdown)') as HTMLTextAreaElement).value,
    ).toMatch(/^You walk into/);
  });

  it('an example replaces everything — only after you say yes', () => {
    mount('journal', emptyState());
    openMenu('Sandbox menu');
    fireEvent.change(screen.getByLabelText('Example scenarios:'), { target: { value: 'fbo' } });
    expect(screen.getByRole('group', { name: 'Confirm replace' }).textContent).toMatch(
      /Replace everything/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tablist', { name: 'Scenarios' }).textContent).toBe('S1Scenario 1');
    openMenu('Sandbox menu');
    fireEvent.change(screen.getByLabelText('Example scenarios:'), { target: { value: 'fbo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes, replace' }));
    expect(
      within(screen.getByRole('tablist', { name: 'Scenarios' })).getAllByRole('tab'),
    ).toHaveLength(3);
    expect(
      within(screen.getByRole('tablist', { name: 'Entities' })).getAllByRole('tab'),
    ).toHaveLength(3);
  });

  it('the chart of accounts: every entity’s accounts with their labels, and which scenarios use them', () => {
    mount('journal', bank());
    // One table: a column per scenario (lines posted there), then the total.
    const table = screen.getByRole('table', { name: /^Chart of accounts/ });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      'Account',
      'Label',
      // "S1" on screen (as on the tabs); the full title for screen readers and as a tooltip.
      'S1Deposit cash',
      'S2Borrow, then pay interest',
      'S3Repay the loan',
      'Used in',
    ]);
    const you = within(table).getByRole('rowgroup', { name: 'You chart of accounts' });
    // ✓ where a scenario uses the account (an entry or an opening balance); "Used in" counts the scenarios.
    const cells = (name: string) =>
      [...within(you).getByRole('rowheader', { name }).closest('tr')!.children].map((c) =>
        c.querySelector('[aria-hidden="true"]')?.textContent === '✓' ? '✓' : c.textContent,
      );
    expect(cells('Checking Account')).toEqual([
      'Checking Account',
      'At the bank',
      '✓',
      '✓',
      '✓',
      '3 of 3',
    ]);
    expect(cells('Cash')).toEqual(['Cash', 'In your wallet', '✓', '', '', '1 of 3']);
    expect(within(you).getByText(/5 accounts/)).toBeTruthy();
    // An account no scenario posts to is marked.
    const s = bank();
    s.entities[0]!.accounts.push({ id: 'savings', name: 'Savings', type: 'asset' });
    cleanup();
    mount('journal', s);
    const you2 = screen.getByRole('rowgroup', { name: 'You chart of accounts' });
    expect(
      within(you2).getByRole('rowheader', { name: 'Savings' }).closest('tr')!.textContent,
    ).toBe('Savingsunused');
    expect(within(you2).getByText(/1 unused/)).toBeTruthy();
  });
});

describe('opening balances', () => {
  it('read as a balance sheet: Assets, Liabilities, Equity with totals, and the A = L + E check', () => {
    mount('journal', bank()); // S1 "Deposit cash": You start with Cash $100 = Net Worth $100
    const sheet = screen.getByRole('table', { name: 'Opening balance sheet' });
    const rows = [...sheet.querySelectorAll('tr')].map((tr) =>
      [...tr.children]
        .map((c) => (c.querySelector('input') as HTMLInputElement | null)?.value ?? c.textContent)
        .join(' | '),
    );
    expect(rows).toEqual([
      'Assets',
      'Cash | 100',
      'Checking Account | ',
      'Total assets | $100',
      'Liabilities',
      'Loan Payable | ',
      'Total liabilities | $0',
      'Equity',
      'Net Worth | 100',
      'Revenue & expenses (usually 0 at the start)',
      'Interest Expense (expense) | ',
      'Total equity | $100',
      'Total liabilities + equity | $100',
      '✓ A = L + E',
    ]);
    // Out of balance: the foot says by how much.
    fireEvent.change(within(sheet).getByLabelText('Opening balance for Cash'), {
      target: { value: '120' },
    });
    expect(sheet.querySelector('tfoot')!.textContent).toMatch(/✗ A = L \+ E — off by \$20/);
  });
});

describe('Journal: all scenarios', () => {
  it('one entity, every scenario one after another — still editable, each in its own scenario', () => {
    mount('journal', bank());
    fireEvent.click(screen.getByRole('button', { name: 'All scenarios' }));
    const sections = screen.getAllByRole('region', { name: /^S\d / });
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual([
      'S1 Deposit cash',
      'S2 Borrow, then pay interest',
      'S3 Repay the loan',
    ]);
    // Edit S2's first entry from here: it changes S2's books, not the current scenario's.
    fireEvent.change(within(sections[1]!).getByLabelText('Entry 1 description'), {
      target: { value: 'Borrow from the bank' },
    });
    flush();
    expect(urlBooks(1, 'you').rows[0]!.label).toBe('Borrow from the bank');
    expect(urlBooks(0, 'you').rows[0]!.label).toBe('Deposit cash');
    // A heading makes its scenario the current one.
    fireEvent.click(within(sections[2]!).getByRole('button', { name: /Repay the loan/ }));
    expect(parseHash(window.location.hash)).toMatchObject({ scenario: 2 });
    // Back to one scenario.
    fireEvent.click(screen.getByRole('button', { name: 'This scenario' }));
    expect(screen.queryAllByRole('region', { name: /^S\d / })).toHaveLength(0);
  });
});

describe('T-accounts view (the ledger)', () => {
  it('lists the entries above the T’s, one per line, as the key to their (n)', () => {
    mountLoan('taccounts');
    const you = screen.getByRole('region', { name: 'You’s ledger' });
    const items = within(within(you).getByRole('list', { name: 'Entries' })).getAllByRole(
      'listitem',
    );
    expect(items.map((li) => li.textContent)).toEqual([
      'E1 Borrow $500Dr Checking Account $500 · Cr Loan Payable $500',
      'E2 Pay $5 interestDr Interest Expense $5 · Cr Checking Account $5',
    ]);
    // Liabilities and equity share one flow, each labelled above its first T.
    expect(
      within(you.querySelector<HTMLElement>('.lv-ledger')!)
        .getAllByRole('heading', { level: 4 })
        .map((h) => h.textContent),
    ).toEqual(['Assets', 'Liabilities', 'Equity']);
  });

  it('every entity side by side; a T only for accounts in use; entries numbered and linked to the Journal', () => {
    mountLoan('taccounts');
    expect(screen.queryByRole('tablist', { name: 'Entities' })).toBeNull();
    const you = screen.getByRole('region', { name: 'You’s ledger' });
    const ts = within(you).getAllByRole('group', { name: /T-account/ });
    // "You" has 5 accounts; only the 3 used in this scenario's entries get a T.
    expect(ts.map((t) => t.getAttribute('aria-label')!.split(',')[0])).toEqual([
      'Checking Account',
      'Loan Payable',
      'Interest Expense',
    ]);
    const checking = ts[0]!;
    expect(checking.getAttribute('aria-label')).toMatch(/balance \$495 debit/);
    const ref = within(checking).getByRole('link', { name: 'E2' });
    expect(parseHash(ref.getAttribute('href')!)).toMatchObject({
      view: 'journal',
      scenario: LOAN,
      entity: 0,
      at: 'entry-2',
    });
    expect(screen.getByRole('region', { name: 'First Example Bank’s ledger' })).toBeTruthy();
  });

  it('every T in an entity has the same rows: opening, one per entry, total (so row n is entry n everywhere)', () => {
    mountLoan('taccounts');
    const bankLedger = screen.getByRole('region', { name: 'First Example Bank’s ledger' });
    const rows = within(bankLedger)
      .getAllByRole('group', { name: /T-account/ })
      .map((t) =>
        [...t.querySelectorAll('.tacct__row')].map(
          (r) => r.textContent!.match(/\((\d)\)|Bal/)?.[0] ?? '',
        ),
      );
    // Opening row, entry 1, entry 2, total — in the same place in every T (blank where untouched).
    for (const r of rows) expect(r).toHaveLength(4);
    expect(rows.map((r) => r[0])).toContain('Bal');
    expect(rows.every((r) => r[1] === '' || r[1] === '(1)')).toBe(true);
    expect(rows.every((r) => r[2] === '' || r[2] === '(2)')).toBe(true);
  });

  it('balance sheets per entity', () => {
    mountLoan('taccounts');
    const you = screen.getByRole('region', { name: 'You’s ledger' });
    const box = within(you).getByRole('checkbox', {
      name: 'Show balance sheets',
    }) as HTMLInputElement;
    if (box.checked) fireEvent.click(box);
    expect(within(you).queryByText('After')).toBeNull();
    fireEvent.click(box);
    expect(within(you).getByText('After')).toBeTruthy();
  });
});

describe('Grid view', () => {
  it('one entity at a time, with the same entity tabs', () => {
    mountLoan('grid', 1);
    expect(
      within(screen.getByRole('tablist', { name: 'Entities' })).getByRole('tab', {
        selected: true,
      }).textContent,
    ).toBe('First Example Bank');
    expect(screen.getByRole('region', { name: /Spreadsheet/ })).toBeTruthy();
  });

  it('a contra type says what it needs first; the Description column resizes with ← →', () => {
    mount('grid', emptyState());
    const contra = screen.getByRole('option', { name: /^Contra-asset/ }) as HTMLOptionElement;
    expect(contra.disabled).toBe(true);
    expect(contra.textContent).toBe('Contra-asset (add an asset first)');
    const edge = screen.getByRole('separator', { name: 'Resize the Description column' });
    const region = screen.getByRole('region', { name: /Spreadsheet/ });
    fireEvent.keyDown(edge, { key: 'ArrowRight' }); // jsdom has no layout: from 0 → the 120px minimum
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(region.style.getPropertyValue('--sh-w2')).toBe('136px');
    fireEvent.doubleClick(edge);
    expect(region.style.getPropertyValue('--sh-w2')).toBe('');
  });

  it('starts with one blank entry that is saved only once you type in it', () => {
    const s = emptyState();
    s.entities[0]!.accounts = [{ id: 'cash', name: 'Cash', type: 'asset' }];
    mount('grid', s);
    expect(screen.getByLabelText('Entry 1 description')).toBeTruthy();
    // Untouched, it isn't in the books (or the link).
    fireEvent.change(screen.getByLabelText('Sandbox title'), { target: { value: 'T' } });
    flush();
    expect(urlBooks(0, 'you').rows).toEqual([]);
    // Typing an amount creates it.
    fireEvent.change(screen.getByLabelText('Entry 1 Cash debit'), { target: { value: '5' } });
    flush();
    expect(urlBooks(0, 'you').rows).toEqual([
      { id: 'r1', postings: [{ accountId: 'cash', side: 'dr', amount: 500 }] },
    ]);
    // "+ Add entry" adds entry 2 below it.
    fireEvent.click(screen.getByRole('button', { name: /Add entry/ }));
    expect(screen.getByLabelText('Entry 2 description')).toBeTruthy();
  });

  it('a cell made of two journal lines shows their total read-only, so it can’t merge them', () => {
    const s = bank();
    // Entry 1 borrows $500 into Checking: split it into two $250 debit lines (as the Journal allows).
    const ev = s.scenarios[LOAN]!.events[0]!;
    const lines = ev.lines.you!;
    const dr = lines.find((p) => p.side === 'dr')!;
    ev.lines.you = [
      { ...dr, amount: 25000 },
      { ...dr, amount: 25000 },
      ...lines.filter((p) => p !== dr),
    ];
    mount('grid', s, 0, LOAN);
    const cell = screen.getByLabelText(
      'Entry 1 Checking Account debit (2 lines; edit in the Journal)',
    ) as HTMLInputElement;
    expect(cell.readOnly).toBe(true);
    expect(cell.value).toBe('$500');
    // The other cells stay editable.
    expect(
      (screen.getByLabelText('Entry 1 Checking Account credit') as HTMLInputElement).readOnly,
    ).toBe(false);
  });
});

describe('the view switcher', () => {
  it('links every view to the same state and scenario', () => {
    mountLoan('journal');
    const nav = screen.getByRole('navigation', { name: 'Sandbox view' });
    const views = within(nav)
      .getAllByRole('link')
      .map((a) => parseHash(a.getAttribute('href')!));
    expect(views.map((v) => v.name === 'sandbox' && v.view)).toEqual([
      'journal',
      'taccounts',
      'grid',
    ]);
    expect(new Set(views.map((v) => v.name === 'sandbox' && v.data)).size).toBe(1);
    expect(views.every((v) => v.name === 'sandbox' && v.scenario === LOAN)).toBe(true);
    expect(within(nav).getByRole('link', { name: 'Journal' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});

describe('journal model', () => {
  const youInLoan = () => ({ ...booksOf(bank(), LOAN, 0), rows: [] });

  it('the column you type in makes a line a debit or a credit; persistable drops half-written lines', () => {
    let e = addEntry(youInLoan());
    e = setLineAccount(e, 0, 1, 'cash');
    e = setLineAmount(e, 0, 1, 1000, 'cr');
    expect(e.rows[0]!.postings[1]).toMatchObject({ side: 'cr', amount: 1000, chosenType: 'asset' });
    // Typing under Dr instead makes it a debit; clearing the other column leaves it alone.
    e = setLineAmount(e, 0, 1, 500, 'dr');
    expect(e.rows[0]!.postings[1]).toMatchObject({ side: 'dr', amount: 500 });
    e = setLineAmount(e, 0, 1, 0, 'cr');
    expect(e.rows[0]!.postings[1]).toMatchObject({ side: 'dr', amount: 500 });
    e = setLineAmount(e, 0, 1, 500, 'cr');
    e = setLineAmount(e, 0, 0, 700); // an amount on a line with no account yet
    const s = persistable(withBooks(bank(), LOAN, 0, e));
    expect(s.scenarios[LOAN]!.events[0]!.lines.you).toEqual([
      { accountId: 'cash', side: 'cr', amount: 500 },
    ]);
  });

  it('one balance check everywhere: an untouched entry is not flagged; a line with no account never counts', () => {
    let e = addEntry(youInLoan());
    expect(entryCheck(e.rows[0]!)).toMatchObject({ started: false, balanced: false });
    expect(summarize(e).unbalancedRows).toEqual([]);
    e = setLineAccount(e, 0, 0, 'cash');
    e = setLineAmount(e, 0, 0, 300);
    e = setLineAmount(e, 0, 1, 300); // amount typed, but no account on the credit line
    expect(entryCheck(e.rows[0]!)).toMatchObject({
      dr: 300,
      cr: 0,
      missingAccount: 1,
      balanced: false,
    });
    expect(summarize(e).unbalancedRows).toEqual([1]);
    e = setLineAccount(e, 0, 1, 'loan-payable');
    expect(entryCheck(e.rows[0]!).balanced).toBe(true);
    expect(summarize(e).rowsBalanced).toBe(true);
  });
});
