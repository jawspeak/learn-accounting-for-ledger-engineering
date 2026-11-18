// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SandboxState, TAccountBuilderProps } from '@contracts';
import { engine } from '@engine';
import { parseHash } from '../router';

// Capture the props passed to each builder instead of depending on the builder's UI.
const builders: TAccountBuilderProps[] = [];
vi.mock('../../components/builder/TAccountBuilder', () => ({
  TAccountBuilder: (props: TAccountBuilderProps) => {
    builders.push(props);
    return <div data-testid="builder" />;
  },
}));

const { SandboxPage, URL_DEBOUNCE_MS } = await import('./SandboxPage');

const lastBuilder = (i = 0) => {
  const seen = new Map<number, TAccountBuilderProps>();
  // builders are rendered in order; take the last render batch's i-th
  const count = screen.getAllByTestId('builder').length;
  builders.slice(-count).forEach((p, j) => seen.set(j, p));
  return seen.get(i)!;
};

function urlState(): SandboxState | null {
  const r = parseHash(window.location.hash);
  return r.name === 'sandbox' && r.data ? engine.decodeSandbox(r.data) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  builders.length = 0;
  history.replaceState(null, '', '#/sandbox');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SandboxPage', () => {
  it('renders an empty board with one entity and no notice', () => {
    render(<SandboxPage />);
    expect(screen.getAllByTestId('builder')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(lastBuilder().mode).toBe('sandbox');
  });

  it('shows a friendly notice for an invalid link', () => {
    render(<SandboxPage data="garbage!!" />);
    expect(screen.getByRole('alert').textContent).toMatch(/couldn’t be read/);
    expect(screen.getAllByTestId('builder')).toHaveLength(1);
  });

  it('loads state from the link', () => {
    const s: SandboxState = {
      v: 1,
      title: 'Shared board',
      scenario: 'Hello',
      entities: [
        { id: 'a', name: 'Alpha', accounts: [], rows: [], showBalanceSheets: true },
        { id: 'b', name: 'Beta', accounts: [], rows: [], showBalanceSheets: false },
      ],
    };
    render(<SandboxPage data={engine.encodeState(s)} />);
    expect((screen.getByPlaceholderText('Untitled scenario') as HTMLInputElement).value).toBe('Shared board');
    expect(screen.getByDisplayValue('Alpha')).toBeTruthy();
    expect(screen.getByDisplayValue('Beta')).toBeTruthy();
    expect(lastBuilder(0).showBalanceSheets).toBe(true);
  });

  it('add entity → create account via builder → add rows → URL round-trips', () => {
    render(<SandboxPage />);
    fireEvent.click(screen.getByRole('button', { name: /Add another party/ }));
    expect(screen.getAllByTestId('builder')).toHaveLength(2);

    // Builder creates an account with its own id; sandbox re-ids it as a slug.
    act(() => lastBuilder(1).onAccountsChange!([{ id: 'tmp', name: 'Customer Deposits', type: 'liability' }]));
    act(() => lastBuilder(1).onAccountsChange!([...lastBuilder(1).accounts, { id: 'tmp2', name: 'Vault Cash', type: 'asset' }]));
    expect(lastBuilder(1).accounts.map((a) => a.id)).toEqual(['customer-deposits', 'vault-cash']);

    act(() =>
      lastBuilder(1).onRowsChange([
        {
          id: 'r1',
          postings: [
            { accountId: 'vault-cash', side: 'dr', amount: 10000, chosenType: 'asset' },
            { accountId: 'customer-deposits', side: 'cr', amount: 10000, chosenType: 'liability' },
          ],
        },
      ]),
    );
    expect(urlState()).toBeNull(); // debounced
    act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS + 10));
    const s = urlState()!;
    expect(s.entities).toHaveLength(2);
    expect(s.entities[1]!.accounts.map((a) => a.id)).toEqual(['customer-deposits', 'vault-cash']);
    expect(s.entities[1]!.rows[0]!.postings).toHaveLength(2);
    expect(screen.getAllByText(/A = L \+ E: \$100 = \$100 \+ \$0/)).toHaveLength(1);

    // Empty column order from builder = canonical.
    act(() => lastBuilder(1).onColumnOrderChange!(['vault-cash', 'customer-deposits']));
    expect(lastBuilder(1).columnOrder).toEqual(['vault-cash', 'customer-deposits']);
    act(() => lastBuilder(1).onColumnOrderChange!([]));
    expect(lastBuilder(1).columnOrder).toBeUndefined();
  });

  it('loads an example and shows balanced summaries', () => {
    render(<SandboxPage />);
    fireEvent.change(screen.getByRole('combobox', { name: /Example scenarios/ }), { target: { value: 'loan' } });
    expect(screen.getAllByTestId('builder')).toHaveLength(2);
    expect(screen.getAllByText(/Rows balanced/)).toHaveLength(2);
    expect(screen.queryByText(/≠/)).toBeNull();
    expect(urlState()?.title).toBe('Loan — both sides');
  });

  it('New / Clear asks inline before discarding', () => {
    render(<SandboxPage />);
    fireEvent.change(screen.getByRole('combobox', { name: /Example scenarios/ }), { target: { value: 'loan' } });
    fireEvent.click(screen.getByRole('button', { name: 'New / Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getAllByTestId('builder')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'New / Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
    expect(screen.getAllByTestId('builder')).toHaveLength(1);
    expect(window.location.hash).toBe('#/sandbox');
  });

  it('renders scenario markdown without executable markup', () => {
    const s: SandboxState = {
      v: 1,
      scenario: '**hi** <img src=x onerror=alert(1)> [x](javascript:alert(1))',
      entities: [],
    };
    const { container } = render(<SandboxPage data={engine.encodeState(s)} />);
    const preview = container.querySelector('.sbx-scenario-preview')!;
    expect(preview.querySelector('strong')).toBeTruthy();
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.querySelector('a')).toBeNull();
    expect(preview.innerHTML).not.toMatch(/javascript:/i);
  });

  it('warns when the URL gets long', () => {
    const s: SandboxState = { v: 1, scenario: Array.from({ length: 3000 }, (_, i) => `w${i * 7919}`).join(' '), entities: [] };
    render(<SandboxPage data={engine.encodeState(s)} />);
    expect(screen.getByText(/This link is getting long/)).toBeTruthy();
  });

  it('opening balances editor writes whole-dollar cents', () => {
    render(<SandboxPage />);
    act(() => lastBuilder().onAccountsChange!([{ id: 'x', name: 'Cash', type: 'asset' }]));
    fireEvent.change(screen.getByLabelText('Opening balance for Cash'), { target: { value: '250' } });
    expect(lastBuilder().opening).toEqual({ lines: [{ accountId: 'cash', amount: 25000 }] });
  });
});
