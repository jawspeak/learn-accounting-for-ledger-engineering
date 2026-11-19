// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Account, BalanceSheet, TAccountBuilderProps, TransactionRow } from '@contracts';
import { TAccountBuilder } from './TAccountBuilder';
import { parseDollars, placeColumns, rankAccounts } from './model';

afterEach(cleanup);

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', type: 'asset' },
  { id: 'checking', name: 'Checking Account', type: 'asset' },
  { id: 'customer-deposits', name: 'Customer Deposits', type: 'liability' },
  { id: 'net-worth', name: 'Net Worth', type: 'equity', equityGroup: 'retained' },
  { id: 'salary', name: 'Salary Income', type: 'revenue' },
];
const coaOrder = ['cash', 'checking', 'net-worth', 'salary'];

function Harness(
  p: Partial<TAccountBuilderProps> & {
    initialRows?: TransactionRow[];
    spy?: (rows: TransactionRow[]) => void;
  },
) {
  const { initialRows, spy, ...rest } = p;
  const [rows, setRows] = useState<TransactionRow[]>(initialRows ?? [{ id: 'r1', postings: [] }]);
  return (
    <TAccountBuilder
      mode="problem"
      accounts={accounts}
      coaOrder={coaOrder}
      showBalanceSheets={false}
      {...rest}
      rows={rows}
      onRowsChange={(r) => {
        spy?.(r);
        setRows(r);
      }}
    />
  );
}

/** Column order as rendered in the first transaction row: account ids, with '=' for the divider. */
const headOrder = (container: HTMLElement) =>
  [...container.querySelectorAll('tr[data-row]:first-of-type > td')]
    .filter((td) => td.classList.contains('tab-eq-col') || td.classList.contains('tab-dr'))
    .map((td) => (td.classList.contains('tab-eq-col') ? '=' : td.getAttribute('data-account')));

describe('TAccountBuilder — columns', () => {
  it('orders columns canonically (A ‖ = ‖ L │ E) by the chosen type, with group bands', () => {
    const rows: TransactionRow[] = [
      {
        id: 'r1',
        postings: [
          { accountId: 'salary', side: 'cr', amount: 5000, chosenType: 'revenue' },
          { accountId: 'customer-deposits', side: 'cr', amount: 5000, chosenType: 'liability' },
          { accountId: 'checking', side: 'dr', amount: 10000, chosenType: 'asset' },
        ],
      },
      { id: 'r2', postings: [{ accountId: 'cash', side: 'dr', amount: 100, chosenType: 'asset' }] },
    ];
    const { container } = render(<Harness initialRows={rows} />);
    expect(headOrder(container)).toEqual(['cash', 'checking', '=', 'customer-deposits', 'salary']);
    const bands = [...container.querySelectorAll('th.tab-band')].map((t) => t.textContent);
    expect(bands).toEqual(['Assets', 'Liabilities', 'Equity']);
    expect(container.querySelector('th.tab-subband.is-equity')?.textContent).toBe('Revenue');
  });

  it('places a column by the learner’s (wrong) chosen type, not the real one', () => {
    const rows: TransactionRow[] = [
      {
        id: 'r1',
        postings: [
          { accountId: 'cash', side: 'cr', amount: 100, chosenType: 'liability' },
          { accountId: 'checking', side: 'dr', amount: 100, chosenType: 'asset' },
        ],
      },
    ];
    const { container } = render(<Harness initialRows={rows} />);
    expect(headOrder(container)).toEqual(['checking', '=', 'cash']);
  });

  it('honours a manual sandbox order, and the canonical helper ignores an empty override', () => {
    const cols = [
      { accountId: 'net-worth', type: 'equity' as const },
      { accountId: 'cash', type: 'asset' as const },
    ];
    expect(placeColumns(cols, accounts, coaOrder).map((c) => c.accountId)).toEqual([
      'cash',
      'net-worth',
    ]);
    expect(placeColumns(cols, accounts, coaOrder, []).map((c) => c.accountId)).toEqual([
      'cash',
      'net-worth',
    ]);
    expect(
      placeColumns(cols, accounts, coaOrder, ['net-worth', 'cash']).map((c) => c.accountId),
    ).toEqual(['net-worth', 'cash']);
  });
});

describe('TAccountBuilder — per-row check and amounts', () => {
  it('one Dr = Cr bar above the grid names the row that doesn’t balance; that row gets a ✗', () => {
    const rows: TransactionRow[] = [
      {
        id: 'r1',
        postings: [
          { accountId: 'checking', side: 'dr', amount: 10000, chosenType: 'asset' },
          { accountId: 'cash', side: 'cr', amount: 10000, chosenType: 'asset' },
        ],
      },
      {
        id: 'r2',
        postings: [
          { accountId: 'checking', side: 'dr', amount: 10000, chosenType: 'asset' },
          { accountId: 'cash', side: 'cr', amount: 5000, chosenType: 'asset' },
        ],
      },
    ];
    const { container } = render(<Harness initialRows={rows} />);
    const r1 = container.querySelector('tr[data-row="r1"]') as HTMLElement;
    const r2 = container.querySelector('tr[data-row="r2"]') as HTMLElement;
    const bar = container.querySelector('.tab-balance-bar') as HTMLElement;
    expect(bar.className).toContain('is-bad');
    expect(bar.textContent).toContain('Row 2 doesn’t balance: Dr $100 ≠ Cr $50');
    expect(bar.textContent).not.toContain('Row 1');
    expect(r1.querySelector('.tab-row-bad')).toBeNull();
    expect(r2.querySelector('.tab-row-bad')).not.toBeNull();
    // no per-row column any more
    expect(container.querySelector('.tab-check-col')).toBeNull();
    // footer balance: checking 200 Dr (normal side), cash 150 abnormal → shown on Cr
    const foot = container.querySelector('tr.tab-balance-row') as HTMLElement;
    expect(foot.textContent).toContain('$200');
    expect(foot.textContent).toContain('$150 (abnormal)');
  });

  it('converts whole dollars to cents and tags the posting with the chosen type', () => {
    const spy = vi.fn();
    const rows: TransactionRow[] = [
      { id: 'r1', postings: [{ accountId: 'cash', side: 'cr', amount: 100, chosenType: 'asset' }] },
    ];
    render(<Harness initialRows={rows} spy={spy} />);
    fireEvent.change(screen.getByLabelText('Row 1 Cash Dr'), { target: { value: '1,000' } });
    const last = spy.mock.calls.at(-1)![0] as TransactionRow[];
    expect(last[0]!.postings).toContainEqual({
      accountId: 'cash',
      side: 'dr',
      amount: 100000,
      chosenType: 'asset',
    });
    // non-numeric keystrokes are rejected
    spy.mockClear();
    fireEvent.change(screen.getByLabelText('Row 1 Cash Dr'), { target: { value: '12.5' } });
    expect(spy).not.toHaveBeenCalled();
    expect(parseDollars('$25')).toBe(2500);
    expect(parseDollars('')).toBe(0);
    expect(parseDollars('-5')).toBeNull();
    expect(parseDollars('-5', { allowNegative: true })).toBe(-500);
  });

  it('adds and removes rows and edits labels', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.click(screen.getByRole('button', { name: /Add row/ }));
    expect(spy.mock.calls.at(-1)![0]).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Row 2 label'), { target: { value: 'Pay rent' } });
    expect((spy.mock.calls.at(-1)![0] as TransactionRow[])[1]!.label).toBe('Pay rent');
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));
    expect(spy.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it('makes the first lockedRowCount rows read-only', () => {
    const rows: TransactionRow[] = [
      { id: 't1', label: 'Example', postings: [{ accountId: 'cash', side: 'dr', amount: 100 }] },
      { id: 'r2', postings: [] },
    ];
    const { container } = render(<Harness initialRows={rows} lockedRowCount={1} />);
    const locked = container.querySelector('tr[data-row="t1"]') as HTMLElement;
    expect(locked.querySelector('input')).toBeNull();
    expect(within(locked).getByText('$1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove row 1' })).toBeNull();
    expect(screen.getByLabelText('Row 2 Cash Dr')).toBeTruthy();
    // a column used by a locked row can't be removed or re-typed
    expect(screen.queryByRole('button', { name: 'Remove Cash' })).toBeNull();
    expect((screen.getByLabelText('Type of Cash') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('TAccountBuilder — account picker', () => {
  it('requires a type first, then searches the full unfiltered list by name', async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    // Before a type is chosen there is no text box at all — just the hint (it used to look like "type a name").
    const pickerEl = screen.getByRole('group', { name: 'Add a T-account' });
    expect(within(pickerEl).queryByRole('combobox')).toBeNull();
    expect(within(pickerEl).getByText(/Choose a type first/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Liability'));
    const combo = within(pickerEl).getByRole('combobox') as HTMLInputElement;
    // not filtered by type and no type labels
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(accounts.map((a) => a.name));

    fireEvent.change(combo, { target: { value: 'check' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Checking Account']);
    await act(async () => {
      fireEvent.keyDown(combo, { key: 'Enter' });
    });
    // after a pick: a confirmation with the next step, not a reset form with empty fields
    const picker = screen.getByRole('group', { name: 'Add a T-account' });
    expect(within(picker).queryByRole('listbox')).toBeNull();
    expect(within(picker).queryByRole('combobox')).toBeNull();
    expect(within(picker).getByRole('status').textContent).toContain(
      'Added Checking Account as a Liability',
    );
    expect(within(picker).getByRole('status').textContent).toContain('Next: type its amount');
    // "Add another account" goes back to step 1, with the type chosen afresh
    fireEvent.click(within(picker).getByRole('button', { name: /Add another account/ }));
    expect((within(picker).getByLabelText('Liability') as HTMLInputElement).checked).toBe(false);
    fireEvent.keyDown(within(picker).getByLabelText('Asset'), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Add a T-account' })).toBeNull();
    // the column exists with no postings yet, and sits where the chosen type puts it
    expect(headOrder(container)).toEqual(['=', 'checking']);
    expect((screen.getByLabelText('Type of Checking Account') as HTMLSelectElement).value).toBe(
      'liability',
    );

    // change its type → it moves to the asset side
    fireEvent.change(screen.getByLabelText('Type of Checking Account'), {
      target: { value: 'asset' },
    });
    expect(headOrder(container)).toEqual(['checking', '=']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Checking Account' }));
    expect(container.querySelector('th[data-col-head]')).toBeNull();
    expect(headOrder(container)).toEqual([]);
  });

  it('ranks an exact or prefix match above other substring matches', async () => {
    const list = [
      { name: 'Card Receivables (Cash in Transit)' },
      { name: 'Cash' },
      { name: 'Prepaid Utilities' },
      { name: 'Utilities Expense' },
    ];
    expect(rankAccounts(list, 'cash').map((a) => a.name)).toEqual([
      'Cash',
      'Card Receivables (Cash in Transit)',
    ]);
    expect(rankAccounts(list, 'utilities').map((a) => a.name)).toEqual([
      'Utilities Expense',
      'Prepaid Utilities',
    ]);
    expect(rankAccounts(list, '')).toBe(list);

    const { container } = render(
      <Harness
        accounts={[
          { id: 'card', name: 'Card Receivables (Cash in Transit)', type: 'asset' },
          ...accounts,
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Asset'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Cash' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    });
    expect(headOrder(container)).toEqual(['cash', '=']);
  });

  it('"Enter amounts" closes the picker and puts the cursor in the new account’s first open cell', async () => {
    const rows: TransactionRow[] = [
      {
        id: 'r1',
        postings: [{ accountId: 'checking', side: 'dr', amount: 2000, chosenType: 'asset' }],
      },
    ];
    render(<Harness initialRows={rows} lockedRowCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Asset'));
    fireEvent.change(screen.getByRole('combobox', { name: /Pick the account/ }), {
      target: { value: 'Cash' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('combobox', { name: /Pick the account/ }), {
        key: 'Enter',
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enter amounts' }));
    });
    expect(screen.queryByRole('group', { name: 'Add a T-account' })).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Row 1 Cash Dr');
  });

  it('offers only the given types (contra types hidden in early sections)', () => {
    render(
      <Harness pickerTypes={['asset', 'liability', 'equity', 'revenue', 'expense', 'dividend']} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    const radios = screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value);
    expect(radios).toEqual(['asset', 'liability', 'equity', 'revenue', 'expense', 'dividend']);
  });

  it('Escape clears the search first, then closes the picker', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Asset'));
    const combo = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(combo, { target: { value: 'ca' } });
    fireEvent.keyDown(combo, { key: 'Escape' });
    expect(combo.value).toBe('');
    fireEvent.keyDown(combo, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Add a T-account' })).toBeNull();
  });

  it('supports arrow-key navigation in the listbox', async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Asset'));
    const combo = screen.getByRole('combobox');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    expect(combo.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]!.id);
    await act(async () => {
      fireEvent.keyDown(combo, { key: 'Enter' });
    });
    expect(headOrder(container)).toEqual(['checking', '=']);
  });

  it('sandbox: creates a new account via onAccountsChange', async () => {
    const onAccountsChange = vi.fn();
    const { container } = render(<Harness mode="sandbox" onAccountsChange={onAccountsChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Expense'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Coffee Beans' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /Create account/ }));
    });
    expect(onAccountsChange).toHaveBeenCalledWith([
      ...accounts,
      { id: 'coffee-beans', name: 'Coffee Beans', type: 'expense' },
    ]);
    expect(headOrder(container)).toEqual(['=', 'coffee-beans']);
    expect(container.querySelector('[data-col-head="coffee-beans"]')!.textContent).toContain(
      'Coffee Beans',
    );
  });

  it('sandbox: ◀ ▶ only in manual order (when the parent passes onColumnOrderChange)', () => {
    const onColumnOrderChange = vi.fn();
    const rows: TransactionRow[] = [
      {
        id: 'r1',
        postings: [
          { accountId: 'cash', side: 'dr', amount: 100, chosenType: 'asset' },
          { accountId: 'checking', side: 'dr', amount: 100, chosenType: 'asset' },
        ],
      },
    ];
    const { rerender } = render(<Harness mode="sandbox" initialRows={rows} />);
    expect(screen.queryByRole('button', { name: 'Move Cash right' })).toBeNull(); // auto order
    rerender(<Harness mode="sandbox" initialRows={rows} onColumnOrderChange={onColumnOrderChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Cash right' }));
    expect(onColumnOrderChange).toHaveBeenCalledWith(['checking', 'cash']);
    expect(screen.queryByRole('button', { name: /Reset to canonical/ })).toBeNull();
  });

  it('sandbox: the picker lists only accounts of the chosen type', () => {
    render(<Harness mode="sandbox" onAccountsChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Asset'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cash', 'Checking Account']);
    fireEvent.click(screen.getByLabelText('Expense'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/No expense accounts yet — type a name to create one/)).toBeTruthy();
  });

  it('sandbox: changing a column’s type changes the account’s type (one truth for both views)', () => {
    const onAccountsChange = vi.fn();
    const rows: TransactionRow[] = [
      { id: 'r1', postings: [{ accountId: 'cash', side: 'dr', amount: 100, chosenType: 'asset' }] },
    ];
    render(<Harness mode="sandbox" initialRows={rows} onAccountsChange={onAccountsChange} />);
    fireEvent.change(screen.getByLabelText('Type of Cash'), { target: { value: 'liability' } });
    expect(onAccountsChange.mock.calls.at(-1)![0].find((a: Account) => a.id === 'cash').type).toBe('liability');
  });

  it('sandbox: rows move up / down; Add row is under the grid', () => {
    const spy = vi.fn();
    const rows: TransactionRow[] = [
      { id: 'r1', label: 'first', postings: [] },
      { id: 'r2', label: 'second', postings: [] },
    ];
    const { container } = render(<Harness mode="sandbox" initialRows={rows} spy={spy} />);
    expect(screen.getByRole('button', { name: 'Move row 1 up' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Move row 2 up' }));
    expect(spy.mock.calls.at(-1)![0].map((r: TransactionRow) => r.label)).toEqual(['second', 'first']);
    const addRow = screen.getByRole('button', { name: /Add row/ });
    expect(container.querySelector('.tab-toolbar')!.contains(addRow)).toBe(false);
  });

  it('sandbox: with accounts but no columns yet, it says so instead of "add your first account"', () => {
    render(<Harness mode="sandbox" />);
    expect(screen.getByRole('button', { name: /Add an account column/ })).toBeTruthy();
    expect(screen.getByText(/already has 5 accounts/)).toBeTruthy();
  });

  it('problems: no row arrows and the picker list is not filtered by type', () => {
    render(<Harness initialRows={[{ id: 'r1', postings: [] }, { id: 'r2', postings: [] }]} />);
    expect(screen.queryByRole('button', { name: /Move row/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Expense'));
    expect(screen.getAllByRole('option')).toHaveLength(accounts.length);
  });
});

describe('TAccountBuilder — balance sheets, overlays, journal', () => {
  const rows: TransactionRow[] = [
    {
      id: 'r1',
      postings: [
        { accountId: 'checking', side: 'dr', amount: 10000, chosenType: 'asset' },
        { accountId: 'cash', side: 'cr', amount: 10000, chosenType: 'asset' },
      ],
    },
  ];
  const opening: BalanceSheet = {
    lines: [
      { accountId: 'cash', amount: 10000 },
      { accountId: 'net-worth', amount: 10000 },
    ],
  };

  it('balance line: only the side that carries each total is marked (gets the rule)', () => {
    const { container } = render(
      <Harness initialRows={rows} showBalanceSheets opening={opening} />,
    );
    const totals = [...container.querySelectorAll('tr.tab-balance-row td.is-total')].map((td) => [
      td.getAttribute('class')!.includes('tab-dr') ? 'dr' : 'cr',
      td.textContent,
    ]);
    // Checking: $100 Dr balance; Cash: opening 100 − 100 = $0 (shown on its normal Dr side).
    expect(totals).toEqual([
      ['dr', '$0'],
      ['dr', '$100'],
    ]);
  });

  it('computes the after balance sheet with an A = L + E indicator', () => {
    render(<Harness initialRows={rows} showBalanceSheets opening={opening} />);
    const after = screen.getByRole('region', { name: 'After' });
    expect(within(after).getByText('Checking Account').closest('li')!.textContent).toContain(
      '$100',
    );
    expect(within(after).getByTestId('equation').textContent).toContain('A = L + E');
    const before = screen.getByRole('region', { name: 'Before' });
    expect(within(before).getByText('Cash').closest('li')!.textContent).toContain('$100');
  });

  it('marks after-BS lines that changed, with the amount and direction', () => {
    render(<Harness initialRows={rows} showBalanceSheets opening={opening} />);
    const after = screen.getByRole('region', { name: 'After' });
    const checking = within(after).getByText('Checking Account').closest('li')!;
    expect(checking.classList.contains('is-changed')).toBe(true);
    expect(checking.textContent).toContain('up $100');
    expect(within(after).getByText('Cash').closest('li')!.textContent).toContain('down $100');
    expect(
      within(after).getByText('Net Worth').closest('li')!.classList.contains('is-changed'),
    ).toBe(false);
    // the Before panel never shows deltas
    expect(screen.getByRole('region', { name: 'Before' }).querySelector('.is-changed')).toBeNull();
  });

  it('lets the learner fill in the after balance sheet when asked', () => {
    function AfterHarness({ spy }: { spy: (bs: BalanceSheet) => void }) {
      const [bs, setBs] = useState<BalanceSheet>({ lines: [] });
      return (
        <Harness
          initialRows={rows}
          showBalanceSheets
          opening={opening}
          afterBalanceSheet={bs}
          onAfterBalanceSheetChange={(b) => {
            spy(b);
            setBs(b);
          }}
        />
      );
    }
    const spy = vi.fn();
    render(<AfterHarness spy={spy} />);
    // every account in play gets an input
    for (const name of ['Cash', 'Checking Account', 'Net Worth'])
      expect(screen.getByLabelText(`After: ${name}`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('After: Checking Account'), {
      target: { value: '100' },
    });
    expect(spy).toHaveBeenLastCalledWith({ lines: [{ accountId: 'checking', amount: 10000 }] });
    fireEvent.change(screen.getByLabelText('After: Cash'), { target: { value: '0' } });
    expect(spy.mock.calls.at(-1)![0].lines).toContainEqual({ accountId: 'cash', amount: 0 });
    // learner's numbers drive the equation check: 100 ≠ 0 + 0
    expect(
      screen.getByRole('region', { name: 'After' }).querySelector('[data-testid="equation"]')!
        .textContent,
    ).toContain('A ≠ L + E');
  });

  it('marks correct parts and highlights flagged locations (without leaking missing accounts)', () => {
    const { container } = render(
      <Harness
        initialRows={rows}
        correctParts={[{ rowId: 'r1', accountId: 'checking' }]}
        highlights={[
          { rowId: 'r1', accountId: 'cash', field: 'type' },
          { rowId: 'r1', accountId: 'salary', field: 'account' },
        ]}
      />,
    );
    const r1 = container.querySelector('tr[data-row="r1"]') as HTMLElement;
    expect(within(r1).getAllByText('✓').length).toBeGreaterThanOrEqual(1); // the correct checking cell (Dr = Cr lives in the bar now)
    expect(screen.getByLabelText('Type of Cash').classList.contains('tab-hl')).toBe(true);
    // 'salary' isn't a column → the row is highlighted instead, no salary column appears
    expect(r1.classList.contains('tab-hl-row')).toBe(true);
    expect(container.querySelector('[data-col-head="salary"]')).toBeNull();
  });

  it('shows the same rows as journal entries when toggled', () => {
    render(<Harness initialRows={rows} journalView />);
    fireEvent.click(screen.getByRole('button', { name: 'Journal view' }));
    const journal = screen.getByRole('region', { name: 'Journal entries' });
    // Same journal sheet as everywhere else: debits first, then credits (indented), then the totals line.
    const lines = [...journal.querySelectorAll('tr.je-line')].map((r) => [
      r.className,
      r.textContent,
    ]);
    expect(lines).toEqual([
      ['je-line is-dr', 'Checking Account$100'],
      ['je-line is-cr', 'Cash$100'],
    ]);
    expect(journal.querySelector('tr.je-total')!.textContent).toContain('Debits = credits');
    expect(journal.querySelector('input')).toBeNull();
  });
});

describe('TAccountBuilder — balance sheets do not leak real types', () => {
  it('Before panel shows learner-added accounts under the chosen type, not the real type', () => {
    const rows: TransactionRow[] = [
      {
        id: 'r1',
        postings: [
          { accountId: 'cash', side: 'cr', amount: 10000, chosenType: 'asset' },
          // Trap: really a liability, learner chose asset.
          { accountId: 'customer-deposits', side: 'dr', amount: 10000, chosenType: 'asset' },
        ],
      },
    ];
    const opening: BalanceSheet = {
      lines: [
        { accountId: 'cash', amount: 10000 },
        { accountId: 'net-worth', amount: 10000 },
      ],
    };
    render(<Harness initialRows={rows} showBalanceSheets opening={opening} />);
    const before = screen.getByText('Before').closest('section, div')!.parentElement!;
    const text = before.textContent ?? '';
    const liabIdx = text.search(/liabilities/i);
    const depIdx = text.indexOf('Customer Deposits');
    expect(depIdx).toBeGreaterThan(-1);
    expect(depIdx).toBeLessThan(liabIdx);
  });
});
