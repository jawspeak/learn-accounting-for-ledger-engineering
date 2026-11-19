// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SandboxState } from '@contracts';
import { engine } from '@engine';
import { parseHash, type SandboxView } from '../router';
import { SandboxApp, URL_DEBOUNCE_MS } from './SandboxApp';
import { EXAMPLES } from './examples';
import { addEntry, emptyState, persistable, setLineAccount, setLineAmount } from './model';

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
const flush = () => act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS + 10));
const mount = (view: SandboxView, s?: SandboxState, entity = 0) =>
  render(<SandboxApp view={view} data={s ? engine.encodeState(s) : undefined} entity={entity} />);
const loan = () => EXAMPLES.find((x) => x.id === 'loan')!.build();

describe('Journal view (the editor)', () => {
  it('write an entry: description, accounts, amounts; Dr = Cr status; saved in the link', () => {
    const s = emptyState();
    s.entities[0]!.accounts = [
      { id: 'cash', name: 'Cash', type: 'asset' },
      { id: 'checking', name: 'Checking Account', type: 'asset' },
    ];
    s.entities[0]!.rows = [];
    mount('journal', s);
    fireEvent.click(screen.getByRole('button', { name: /Add entry/ }));
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
    const row = urlState()!.entities[0]!.rows[0]!;
    expect(row.label).toBe('Deposit cash');
    expect(row.postings).toEqual([
      { accountId: 'checking', side: 'dr', amount: 4424, chosenType: 'asset' },
      { accountId: 'cash', side: 'cr', amount: 4424, chosenType: 'asset' },
    ]);
  });

  it('half-written lines stay on screen but are left out of the link', () => {
    mount('journal', loan());
    fireEvent.click(screen.getAllByRole('button', { name: /Credit line/ })[0]!);
    expect(screen.getByLabelText('Entry 1 line 3 account')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Entry 1 description'), { target: { value: 'Borrow' } });
    flush();
    expect(urlState()!.entities[0]!.rows[0]!.postings).toHaveLength(2);
    expect(screen.getByLabelText('Entry 1 line 3 account')).toBeTruthy();
  });

  it('a new account straight from a line’s account list', () => {
    mount('journal', loan());
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
    mount('journal', loan());
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

describe('party bar (Journal and Grid)', () => {
  it('tabs pick whose books; add, duplicate, rename and remove a party', () => {
    mount('journal', loan());
    const tabs = screen.getByRole('tablist', { name: 'Whose books' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['You', 'First Example Bank']);
    fireEvent.click(within(tabs).getByRole('tab', { name: 'First Example Bank' }));
    expect(screen.getByRole('tabpanel', { name: 'First Example Bank' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe(
      'First Example Bank (copy)',
    );
    fireEvent.change(screen.getByLabelText('Rename this party'), { target: { value: 'Bank 2' } });
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toBe('Bank 2');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '+ Add party' }));
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
  });
});

describe('T-accounts view (the ledger)', () => {
  it('every party side by side; a T only for accounts in use; entries numbered and linked to the Journal', () => {
    mount('taccounts', loan());
    expect(screen.queryByRole('tablist')).toBeNull();
    const you = screen.getByRole('region', { name: 'You’s ledger' });
    const ts = within(you).getAllByRole('group', { name: /T-account/ });
    // "You" has 5 accounts; only the 3 used in entries get a T.
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
      entity: 0,
      at: 'entry-2',
    });
    expect(screen.getByRole('region', { name: 'First Example Bank’s ledger' })).toBeTruthy();
  });

  it('balance sheets per party', () => {
    mount('taccounts', loan());
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
  it('one party at a time, with the same party tabs', () => {
    mount('grid', loan(), 1);
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('First Example Bank');
    expect(screen.getByRole('region', { name: /Spreadsheet/ })).toBeTruthy();
  });
});

describe('the view switcher', () => {
  it('links every view to the same state', () => {
    mount('journal', loan());
    const nav = screen.getByRole('navigation', { name: 'Sandbox view' });
    const views = within(nav)
      .getAllByRole('link')
      .map((a) => parseHash(a.getAttribute('href')!));
    expect(views.map((v) => v.name === 'sandbox' && v.view)).toEqual([
      'journal',
      'taccounts',
      'grid',
    ]);
    const datas = new Set(views.map((v) => v.name === 'sandbox' && v.data));
    expect(datas.size).toBe(1);
    expect(within(nav).getByRole('link', { name: 'Journal' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});

describe('journal model', () => {
  it('a line is one posting: typing on the other side moves it; persistable drops half-written lines', () => {
    let e = addEntry({ ...loan().entities[0]!, rows: [] });
    e = setLineAccount(e, 0, 0, 'cash');
    e = setLineAmount(e, 0, 0, 'dr', 1000);
    expect(e.rows[0]!.postings[0]).toMatchObject({ side: 'dr', amount: 1000, chosenType: 'asset' });
    e = setLineAmount(e, 0, 0, 'cr', 500);
    expect(e.rows[0]!.postings[0]).toMatchObject({ side: 'cr', amount: 500 });
    e = setLineAmount(e, 0, 0, 'dr', 0); // clearing the other side leaves it alone
    expect(e.rows[0]!.postings[0]).toMatchObject({ side: 'cr', amount: 500 });
    const s = persistable({ v: 1, scenario: '', entities: [e] });
    expect(s.entities[0]!.rows[0]!.postings).toEqual([
      { accountId: 'cash', side: 'cr', amount: 500, chosenType: 'asset' },
    ]);
  });
});
