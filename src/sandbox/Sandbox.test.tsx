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
  const [entity, setEntity] = useState(0);
  const [scenario, setScenario] = useState(0);
  return (
    <Sandbox
      state={state}
      onChange={(s) => {
        setState(s);
        onState(s);
      }}
      view={view}
      scenario={scenario}
      onScenarioSelect={setScenario}
      entity={entity}
      onEntitySelect={setEntity}
      linkTo={() => '#'}
      onNavigate={(t: SandboxTarget) => {
        setView(t.view);
        if (t.entity !== undefined) setEntity(t.entity);
        if (t.scenario !== undefined) setScenario(t.scenario);
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

    // The Journal starts with a blank entry (one Dr line, one Cr line) to show how to begin. It isn't saved
    // until you type in it, and an untouched entry isn't flagged as unbalanced anywhere.
    expect(screen.getByLabelText('Entry 1 line 1 account')).toBeTruthy();
    expect(screen.getByText(/Entries balanced \(0\)/)).toBeTruthy();
    expect(onState.mock.calls.at(-1)![0].scenarios[0].books.you.rows).toEqual([]);
    // Write it: sell lemonade for $3.
    // Every line takes an amount under Dr or Cr; the column you type in decides which it is.
    expect(screen.getByLabelText('Entry 1 line 1 credit')).toBeTruthy();
    expect(screen.getByLabelText('Entry 1 line 2 debit')).toBeTruthy();
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
