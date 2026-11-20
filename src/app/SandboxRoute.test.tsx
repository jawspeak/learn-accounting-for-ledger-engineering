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
const urlBooks = (scenario: number, entityId: string): ScenarioBooks =>
  urlState()!.scenarios[scenario]!.books[entityId] ?? { rows: [] };
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
    expect(screen.getByText('Debits = credits')).toBeTruthy();
    flush();
    const row = urlBooks(0, 'you').rows[0]!;
    expect(row.label).toBe('Deposit cash');
    // The link leaves out what the account already says (its type).
    expect(row.postings).toEqual([
      { accountId: 'checking', side: 'dr', amount: 4424 },
      { accountId: 'cash', side: 'cr', amount: 4424 },
    ]);
  });

  it('half-written lines stay on screen but are left out of the link', () => {
    mountLoan('journal');
    fireEvent.click(screen.getAllByRole('button', { name: /Cr line/ })[0]!);
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

  it('entries move up / down and can be removed', () => {
    mountLoan('journal');
    fireEvent.click(screen.getByRole('button', { name: 'Move entry 2 up' }));
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Pay $5 interest',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry 1' }));
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Borrow $500',
    );
    expect(screen.queryByLabelText('Entry 2 description')).toBeNull();
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

describe('scenarios', () => {
  it('tabs pick the scenario; the URL remembers it; accounts carry over, entries don’t', () => {
    mount('journal', bank());
    const tabs = screen.getByRole('tablist', { name: 'Scenarios' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Deposit cash', 'Borrow, then pay interest', 'Repay the loan']);
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Deposit cash',
    );
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Borrow, then pay interest' }));
    expect(parseHash(window.location.hash)).toMatchObject({ scenario: 1 });
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe(
      'Borrow $500',
    );
    // A new scenario: the same entities and accounts, empty books.
    fireEvent.click(screen.getByRole('button', { name: '+ Add scenario' }));
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe('Scenario 4');
    // Its Journal shows only the blank first entry.
    expect((screen.getByLabelText('Entry 1 description') as HTMLInputElement).value).toBe('');
    expect(screen.queryByLabelText('Entry 2 description')).toBeNull();
    expect(screen.getByText(/^Accounts \(5\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Scenario title'), { target: { value: 'Overdraft' } });
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe('Overdraft');
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
    const titles = () =>
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate scenario' }));
    expect(titles()[1]).toBe('Deposit cash (copy)');
    fireEvent.click(screen.getByRole('button', { name: 'Move scenario right' }));
    expect(titles()[2]).toBe('Deposit cash (copy)');
    fireEvent.click(screen.getByRole('button', { name: 'Remove scenario' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(titles()).toEqual(['Deposit cash', 'Borrow, then pay interest', 'Repay the loan']);
  });

  it('an example replaces everything — only after you say yes', () => {
    mount('journal', emptyState());
    fireEvent.change(screen.getByLabelText('Example scenarios:'), { target: { value: 'fbo' } });
    expect(screen.getByRole('group', { name: 'Confirm replace' }).textContent).toMatch(
      /Replace everything/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tablist', { name: 'Scenarios' }).textContent).toBe('Scenario 1');
    fireEvent.change(screen.getByLabelText('Example scenarios:'), { target: { value: 'fbo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes, replace' }));
    expect(
      within(screen.getByRole('tablist', { name: 'Scenarios' })).getAllByRole('tab'),
    ).toHaveLength(3);
    expect(
      within(screen.getByRole('tablist', { name: 'Entities' })).getAllByRole('tab'),
    ).toHaveLength(2);
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
      'Deposit cash',
      'Borrow, then pay interest',
      'Repay the loan',
      'Total',
    ]);
    const you = within(table).getByRole('rowgroup', { name: 'You chart of accounts' });
    const cells = (name: string) =>
      [...within(you).getByRole('rowheader', { name }).closest('tr')!.children].map(
        (c) => c.textContent,
      );
    // Checking: 1 line in "Deposit cash", 2 in the loan, 2 when repaying (its opening balance counts too).
    expect(cells('Checking Account')).toEqual([
      'Checking Account',
      'At the bank',
      '1',
      '2',
      '2',
      '5',
    ]);
    expect(cells('Cash')).toEqual(['Cash', 'In your wallet', '2', '', '', '2']);
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

describe('T-accounts view (the ledger)', () => {
  it('lists the entries above the T’s, one per line, as the key to their (n)', () => {
    mountLoan('taccounts');
    const you = screen.getByRole('region', { name: 'You’s ledger' });
    const items = within(within(you).getByRole('list', { name: 'Entries' })).getAllByRole(
      'listitem',
    );
    expect(items.map((li) => li.textContent)).toEqual([
      '(1) Borrow $500Dr Checking Account $500 · Cr Loan Payable $500',
      '(2) Pay $5 interestDr Interest Expense $5 · Cr Checking Account $5',
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
    const ref = within(checking).getByRole('link', { name: '(2)' });
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
    const row = s.scenarios[LOAN]!.books.you!.rows[0]!;
    const dr = row.postings.find((p) => p.side === 'dr')!;
    row.postings = [
      { ...dr, amount: 25000 },
      { ...dr, amount: 25000 },
      ...row.postings.filter((p) => p !== dr),
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

  it('a line keeps the side it was added on; persistable drops half-written lines', () => {
    let e = addEntry(youInLoan());
    e = setLineAccount(e, 0, 1, 'cash');
    e = setLineAmount(e, 0, 1, 1000);
    expect(e.rows[0]!.postings[1]).toMatchObject({ side: 'cr', amount: 1000, chosenType: 'asset' });
    e = setLineAmount(e, 0, 1, 500);
    expect(e.rows[0]!.postings[1]).toMatchObject({ side: 'cr', amount: 500 });
    e = setLineAmount(e, 0, 0, 700); // an amount on a line with no account yet
    const s = persistable(withBooks(bank(), LOAN, 0, e));
    expect(s.scenarios[LOAN]!.books.you!.rows[0]!.postings).toEqual([
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
