// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AttemptState } from '@contracts';
import { QuestionInput, marksFor, type NonBookingProblem } from './QuestionView';
import {
  classifyFx,
  coaFx,
  drCrFx,
  equationFx,
  mcFx,
  mcMultiFx,
  statementFx,
  trialBalanceFx,
} from './__fixtures__';

afterEach(cleanup);

/** Harness that keeps state and exposes the latest value. */
function Harness({
  problem,
  spy,
  correct,
  wrong,
}: {
  problem: NonBookingProblem;
  spy: { v: AttemptState };
  correct?: number[];
  wrong?: number[];
}) {
  const [v, setV] = useState<AttemptState>({ v: 1, problemId: problem.id });
  // eslint-disable-next-line react-hooks/immutability -- test harness captures latest state
  spy.v = v;
  return (
    <QuestionInput
      problem={problem}
      value={v}
      onChange={setV}
      correctItems={correct}
      wrongItems={wrong}
    />
  );
}
const mount = (
  problem: NonBookingProblem,
  extra: { correct?: number[]; wrong?: number[] } = {},
) => {
  const spy = { v: { v: 1, problemId: problem.id } as AttemptState };
  render(<Harness problem={problem} spy={spy} {...extra} />);
  return spy;
};

describe('Classify', () => {
  it('select + Place here writes bucket per item index', () => {
    const spy = mount(classifyFx);
    fireEvent.click(screen.getByRole('button', { name: 'Loan Payable' }));
    fireEvent.click(within('Liability bucket').getByRole('button', { name: 'Place here' }));
    expect(spy.v.items).toEqual([null, 'liability', null]);
  });
  it('drag and drop works', () => {
    const spy = mount(classifyFx);
    const data: Record<string, string> = {};
    const dt = {
      setData: (k: string, v: string) => (data[k] = v),
      getData: (k: string) => data[k],
      effectAllowed: '',
    };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Cash' }), { dataTransfer: dt });
    fireEvent.drop(screen.getByRole('group', { name: 'Asset bucket' }), { dataTransfer: dt });
    expect(spy.v.items).toEqual(['asset', null, null]);
  });
  it('shows correct/wrong marks as text, not only colour', () => {
    mount(classifyFx, { correct: [0], wrong: [1] });
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(screen.getByText('Incorrect')).toBeTruthy();
  });
});

function within(name: string) {
  const el = screen.getByRole('group', { name });
  return {
    getByRole: (role: string, opts: { name: string }) => {
      const all = Array.from(el.querySelectorAll('button'));
      const hit = all.find((b) => b.textContent?.includes(opts.name));
      if (!hit) throw new Error(`no ${role} ${opts.name}`);
      return hit;
    },
  };
}

describe('DrCrPredict', () => {
  it('writes sides', () => {
    const spy = mount(drCrFx);
    fireEvent.click(screen.getAllByLabelText('Debit')[0]!);
    fireEvent.click(screen.getAllByLabelText('Credit')[1]!);
    expect(spy.v.items).toEqual(['dr', 'cr']);
  });
});

describe('EquationFill', () => {
  it('writes the number for the blank, with formatting tolerated', () => {
    const spy = mount(equationFx);
    fireEvent.change(screen.getByLabelText('Item 1: missing Equity'), { target: { value: '$60' } });
    fireEvent.change(screen.getByLabelText('Item 2: missing Assets'), { target: { value: '15' } });
    expect(spy.v.items).toEqual([60, 15]);
  });
  it('treats junk as unanswered', () => {
    const spy = mount(equationFx);
    fireEvent.change(screen.getByLabelText('Item 1: missing Equity'), { target: { value: 'abc' } });
    expect(spy.v.items?.[0]).toBeNull();
  });
});

describe('StatementFill', () => {
  it('balance sheet writes lines in cents', () => {
    const spy = mount(statementFx);
    fireEvent.change(screen.getByLabelText('Checking Account amount'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Cash amount'), { target: { value: '0' } });
    expect(spy.v.balanceSheet?.lines).toEqual([
      { accountId: 'checking', amount: 10000 },
      { accountId: 'cash', amount: 0 },
    ]);
    fireEvent.change(screen.getByLabelText('Checking Account amount'), { target: { value: '' } });
    expect(spy.v.balanceSheet?.lines).toEqual([{ accountId: 'cash', amount: 0 }]);
  });
  it('trial balance writes side + amount', () => {
    const spy = mount(trialBalanceFx);
    fireEvent.change(screen.getByLabelText('Checking Account debit'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Net Worth credit'), { target: { value: '100' } });
    expect(spy.v.trialBalance).toEqual([
      { accountId: 'checking', side: 'dr', amount: 10000 },
      { accountId: 'net-worth', side: 'cr', amount: 10000 },
    ]);
  });
});

describe('MultipleChoice', () => {
  it('single select replaces', () => {
    const spy = mount(mcFx);
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(spy.v.items).toEqual([[1]]);
  });
  it('multi select toggles, sorted', () => {
    const spy = mount(mcMultiFx);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(spy.v.items).toEqual([[0, 1]]);
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(spy.v.items).toEqual([[1]]);
  });
});

describe('CoaDesign', () => {
  it('writes included + type per candidate', () => {
    const spy = mount(coaFx);
    fireEvent.click(screen.getByLabelText('Include Cash'));
    fireEvent.change(screen.getByLabelText('Type of Cash'), { target: { value: 'asset' } });
    expect(spy.v.items).toEqual([
      { included: true, type: 'asset' },
      { included: false, type: null },
    ]);
    fireEvent.click(screen.getByLabelText('Include Cash'));
    expect((spy.v.items as { type: unknown }[])[0]!.type).toBeNull();
  });
});

describe('marksFor', () => {
  const result = {
    correct: false,
    correctParts: [{ itemIndex: 0 }],
    diagnostics: [
      {
        code: 'WRONG_ITEM' as const,
        severity: 'error' as const,
        location: { itemIndex: 1 },
        message: 'x',
      },
    ],
  };
  it('respects reveal level', () => {
    expect(marksFor(result, 0)).toEqual({ correctItems: undefined, wrongItems: undefined });
    expect(marksFor(result, 1)).toEqual({ correctItems: [0], wrongItems: undefined });
    expect(marksFor(result, 2)).toEqual({ correctItems: [0], wrongItems: [1] });
  });
});
