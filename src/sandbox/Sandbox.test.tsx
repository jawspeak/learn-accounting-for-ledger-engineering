// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Sandbox, emptyState, type SandboxState, type SandboxTarget, type SandboxView } from '.';

afterEach(cleanup);

/** A host with no URL routing at all: state in React, views switched through onNavigate. */
function StandaloneHost({ onState }: { onState(s: SandboxState): void }) {
  const [state, setState] = useState<SandboxState>(() => {
    const s = emptyState();
    s.entities[0]!.name = 'Lemonade stand';
    return s;
  });
  const [view, setView] = useState<SandboxView>('journal');
  const [party, setParty] = useState(0);
  return (
    <Sandbox
      state={state}
      onChange={(s) => {
        setState(s);
        onState(s);
      }}
      view={view}
      party={party}
      onPartyChange={setParty}
      linkTo={() => '#'}
      onNavigate={(t: SandboxTarget) => {
        setView(t.view);
        if (t.party !== undefined) setParty(t.party);
      }}
    />
  );
}

describe('Sandbox as a standalone module (no router, no course content)', () => {
  it('a host handles navigation; edits come back through onChange', () => {
    const onState = vi.fn();
    render(<StandaloneHost onState={onState} />);
    // No examples given: no example menu.
    expect(screen.queryByLabelText('Example scenarios:')).toBeNull();
    // Add two accounts in the Accounts panel.
    for (const [name, type] of [
      ['Cash', 'asset'],
      ['Sales', 'revenue'],
    ]) {
      fireEvent.change(screen.getByPlaceholderText('New account name'), {
        target: { value: name },
      });
      fireEvent.change(screen.getByLabelText('New account type'), { target: { value: type } });
      fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    }
    expect(
      onState.mock.calls.at(-1)![0].entities[0].accounts.map((a: { id: string }) => a.id),
    ).toEqual(['cash', 'sales']);

    // Write an entry: sell lemonade for $3.
    fireEvent.click(screen.getByRole('button', { name: /Add entry/ }));
    // An untouched entry isn't flagged as unbalanced anywhere.
    expect(screen.getByText(/Entries balanced \(1\)/)).toBeTruthy();
    // A debit line has only a debit amount; a credit line only a credit amount.
    expect(screen.queryByLabelText('Entry 1 line 1 credit')).toBeNull();
    expect(screen.queryByLabelText('Entry 1 line 2 debit')).toBeNull();
    fireEvent.change(screen.getByLabelText('Entry 1 line 1 account'), {
      target: { value: 'cash' },
    });
    fireEvent.change(screen.getByLabelText('Entry 1 line 1 debit'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Entry 1 line 2 account'), {
      target: { value: 'sales' },
    });
    fireEvent.change(screen.getByLabelText('Entry 1 line 2 credit'), { target: { value: '3' } });
    expect(screen.getByText('Debits = credits')).toBeTruthy();

    // The view switch calls onNavigate (no URL): the T-accounts view shows the same books.
    const nav = screen.getByRole('navigation', { name: 'Sandbox view' });
    fireEvent.click(within(nav).getByRole('link', { name: 'T-accounts' }));
    const ledger = screen.getByRole('region', { name: 'Lemonade stand’s ledger' });
    expect(
      within(ledger)
        .getByRole('group', { name: /^Cash, asset T-account/ })
        .getAttribute('aria-label'),
    ).toMatch(/balance \$3 debit/);
    // An entry number goes back to the Journal through the host, too.
    fireEvent.click(within(ledger).getAllByRole('link', { name: '(1)' })[0]!);
    expect(screen.getByLabelText('Entry 1 description')).toBeTruthy();
  });
});
