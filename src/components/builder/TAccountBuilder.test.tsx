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

function Harness(p: Partial<TAccountBuilderProps> & { initialRows?: TransactionRow[]; spy?: (rows: TransactionRow[]) => void }) {
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
    expect(placeColumns(cols, accounts, coaOrder).map((c) => c.accountId)).toEqual(['cash', 'net-worth']);
    expect(placeColumns(cols, accounts, coaOrder, []).map((c) => c.accountId)).toEqual(['cash', 'net-worth']);
    expect(placeColumns(cols, accounts, coaOrder, ['net-worth', 'cash']).map((c) => c.accountId)).toEqual(['net-worth', 'cash']);
  });
});

describe('TAccountBuilder — per-row check and amounts', () => {
  it('shows a ✓/✗ text indicator per row', () => {
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
    expect(within(r1).getByText(/Balanced/)).toBeTruthy();
    expect(within(r2).getByText(/Unbalanced: Dr \$100 ≠ Cr \$50/)).toBeTruthy();
    // footer balance: checking 200 Dr (normal side), cash 150 abnormal → shown on Cr
    const foot = container.querySelector('tr.tab-balance-row') as HTMLElement;
    expect(foot.textContent).toContain('$200');
    expect(foot.textContent).toContain('$150 (abnormal)');
  });

  it('converts whole dollars to cents and tags the posting with the chosen type', () => {
    const spy = vi.fn();
    const rows: TransactionRow[] = [{ id: 'r1', postings: [{ accountId: 'cash', side: 'cr', amount: 100, chosenType: 'asset' }] }];
    render(<Harness initialRows={rows} spy={spy} />);
    fireEvent.change(screen.getByLabelText('Row 1 Cash Dr'), { target: { value: '1,000' } });
    const last = spy.mock.calls.at(-1)![0] as TransactionRow[];
    expect(last[0]!.postings).toContainEqual({ accountId: 'cash', side: 'dr', amount: 100000, chosenType: 'asset' });
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
    const combo = screen.getByRole('combobox') as HTMLInputElement;
    expect(combo.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Liability'));
    expect(combo.disabled).toBe(false);
    // not filtered by type and no type labels
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(accounts.map((a) => a.name));

    fireEvent.change(combo, { target: { value: 'check' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Checking Account']);
    await act(async () => {
      fireEvent.keyDown(combo, { key: 'Enter' });
    });
    // the picker stays open for the next account, reset to step 1 (type is chosen afresh each time)
    expect(screen.getByRole('group', { name: 'Add a T-account' })).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
    const picker = screen.getByRole('group', { name: 'Add a T-account' });
    expect((within(picker).getByRole('combobox') as HTMLInputElement).disabled).toBe(true);
    expect(within(picker).getByRole('status').textContent).toContain('Added Checking Account as Liability');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('group', { name: 'Add a T-account' })).toBeNull();
    // the column exists with no postings yet, and sits where the chosen type puts it
    expect(headOrder(container)).toEqual(['=', 'checking']);
    expect((screen.getByLabelText('Type of Checking Account') as HTMLSelectElement).value).toBe('liability');

    // change its type → it moves to the asset side
    fireEvent.change(screen.getByLabelText('Type of Checking Account'), { target: { value: 'asset' } });
    expect(headOrder(container)).toEqual(['checking', '=']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Checking Account' }));
    expect(container.querySelector('th[data-col-head]')).toBeNull();
    expect(headOrder(container)).toEqual([]);
  });

  it('ranks an exact or prefix match above other substring matches', async () => {
    const list = [{ name: 'Card Receivables (Cash in Transit)' }, { name: 'Cash' }, { name: 'Prepaid Utilities' }, { name: 'Utilities Expense' }];
    expect(rankAccounts(list, 'cash').map((a) => a.name)).toEqual(['Cash', 'Card Receivables (Cash in Transit)']);
    expect(rankAccounts(list, 'utilities').map((a) => a.name)).toEqual(['Utilities Expense', 'Prepaid Utilities']);
    expect(rankAccounts(list, '')).toBe(list);

    const { container } = render(<Harness accounts={[{ id: 'card', name: 'Card Receivables (Cash in Transit)', type: 'asset' }, ...accounts]} />);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    fireEvent.click(screen.getByLabelText('Asset'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Cash' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    });
    expect(headOrder(container)).toEqual(['cash', '=']);
  });

  it('offers only the given types (contra types hidden in early sections)', () => {
    render(<Harness pickerTypes={['asset', 'liability', 'equity', 'revenue', 'expense', 'dividend']} />);
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
    expect(onAccountsChange).toHaveBeenCalledWith([...accounts, { id: 'coffee-beans', name: 'Coffee Beans', type: 'expense' }]);
    expect(headOrder(container)).toEqual(['=', 'coffee-beans']);
    expect(screen.getByText('Coffee Beans')).toBeTruthy();
  });

  it('sandbox: keyboard reorder and reset', () => {
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
    const { rerender } = render(<Harness mode="sandbox" initialRows={rows} onColumnOrderChange={onColumnOrderChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Cash right' }));
    expect(onColumnOrderChange).toHaveBeenCalledWith(['checking', 'cash']);
    rerender(<Harness mode="sandbox" initialRows={rows} columnOrder={['checking', 'cash']} onColumnOrderChange={onColumnOrderChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to canonical order' }));
    expect(onColumnOrderChange).toHaveBeenLastCalledWith([]);
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

  it('computes the after balance sheet with an A = L + E indicator', () => {
    render(<Harness initialRows={rows} showBalanceSheets opening={opening} />);
    const after = screen.getByRole('region', { name: 'After' });
    expect(within(after).getByText('Checking Account').closest('li')!.textContent).toContain('$100');
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
    expect(within(after).getByText('Net Worth').closest('li')!.classList.contains('is-changed')).toBe(false);
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
    for (const name of ['Cash', 'Checking Account', 'Net Worth']) expect(screen.getByLabelText(`After: ${name}`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('After: Checking Account'), { target: { value: '100' } });
    expect(spy).toHaveBeenLastCalledWith({ lines: [{ accountId: 'checking', amount: 10000 }] });
    fireEvent.change(screen.getByLabelText('After: Cash'), { target: { value: '0' } });
    expect(spy.mock.calls.at(-1)![0].lines).toContainEqual({ accountId: 'cash', amount: 0 });
    // learner's numbers drive the equation check: 100 ≠ 0 + 0
    expect(screen.getByRole('region', { name: 'After' }).querySelector('[data-testid="equation"]')!.textContent).toContain('A ≠ L + E');
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
    expect(within(r1).getAllByText('✓').length).toBeGreaterThanOrEqual(2); // checking cell + row check
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
    const lines = [...journal.querySelectorAll('tr.je-line')].map((r) => [r.className, r.textContent]);
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
