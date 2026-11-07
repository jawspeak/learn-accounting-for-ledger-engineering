// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CheckResult, RevealLevel } from '@contracts';
import { FeedbackPanel } from './FeedbackPanel';
import { describeLocation } from './describe';

afterEach(cleanup);

const wrong: CheckResult = {
  correct: false,
  diagnostics: [
    {
      code: 'WRONG_TYPE',
      severity: 'error',
      location: { rowId: 'r1', accountId: 'checking', field: 'type' },
      message: 'One account has the wrong type.',
      explanation: 'Your **checking account** is something you own.',
    },
    {
      code: 'MISSING_ACCOUNT',
      severity: 'error',
      location: { rowId: 'r1', accountId: 'secret-answer', field: 'account' },
      message: 'An account that should change is missing.',
    },
  ],
  correctParts: [{ rowId: 'r1', accountId: 'cash' }],
};

const base = {
  hints: ['Whose books are we in?', 'Which account are you *sure* changes?'],
  explanation: 'Cash goes down, **Checking** goes up.',
  walkthrough: ['Step one.', 'Step two.'],
};

const renderAt = (level: RevealLevel, result: CheckResult | null = wrong, onEscalate = vi.fn()) =>
  render(<FeedbackPanel {...base} result={result} level={level} onEscalate={onEscalate} />);

describe('FeedbackPanel progressive reveal', () => {
  it('shows nothing about the answer before checking', () => {
    renderAt(0, null);
    expect(screen.queryByText(/issue/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Tell me more/ })).toBeNull();
  });

  it('L1: counts issues and correct parts only', () => {
    renderAt(1);
    expect(screen.getByText(/2 issues found/)).toBeTruthy();
    expect(screen.getByText(/1 part correct/)).toBeTruthy();
    expect(screen.queryByText(/Row 1/)).toBeNull();
    expect(screen.queryByText(/wrong type/)).toBeNull();
  });

  it('L2: says where, in words, without naming a missing (solution) account', () => {
    renderAt(2);
    expect(screen.getByText(/Row 1 · Checking/)).toBeTruthy();
    expect(screen.queryByText(/Secret answer/i)).toBeNull();
    expect(screen.queryByText(/wrong type/)).toBeNull();
  });

  it('L3: adds category messages; L4: adds explanations', () => {
    renderAt(3);
    expect(screen.getByText('One account has the wrong type.')).toBeTruthy();
    expect(screen.queryByText(/something you own/)).toBeNull();
    cleanup();
    renderAt(4);
    expect(screen.getByText(/something you own/)).toBeTruthy();
    expect(screen.queryByText(/Step one/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Show the full solution' })).toBeTruthy();
  });

  it('L5: full explanation and walkthrough, no more escalation', () => {
    renderAt(5);
    expect(screen.getByText(/goes up/)).toBeTruthy();
    expect(screen.getByText('Step two.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tell me more|full solution/ })).toBeNull();
  });

  it('"Tell me more" escalates', () => {
    const onEscalate = vi.fn();
    renderAt(1, wrong, onEscalate);
    fireEvent.click(screen.getByRole('button', { name: 'Tell me more' }));
    expect(onEscalate).toHaveBeenCalledOnce();
  });

  it('correct: ✓ + near-miss note, and "Why does this work?" jumps to the explanation', () => {
    const onEscalate = vi.fn();
    const ok: CheckResult = {
      correct: true,
      diagnostics: [
        { code: 'SPLIT_ENTRY', severity: 'near-miss', location: { rowId: 'r1' }, message: 'One event was split across two rows.' },
      ],
      correctParts: [],
    };
    renderAt(1, ok, onEscalate);
    expect(screen.getByText(/Correct!/)).toBeTruthy();
    expect(screen.getByText('One event was split across two rows.')).toBeTruthy();
    expect(screen.queryByText(/goes up/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Why does this work?' }));
    expect(screen.getByText(/goes up/)).toBeTruthy();
    expect(screen.getByText('Step one.')).toBeTruthy();
    expect(onEscalate).not.toHaveBeenCalled();
  });

  it('reveals hints one at a time, independent of checking', () => {
    renderAt(0, null);
    expect(screen.queryByText(/Whose books/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show a hint/ }));
    expect(screen.getByText(/Whose books/)).toBeTruthy();
    expect(screen.queryByText(/sure/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show next hint/ }));
    expect(screen.getByText(/sure/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hint/ })).toBeNull();
  });

  it('uses a polite live region for results', () => {
    const { container } = renderAt(1);
    expect(container.querySelector('.fb-result')?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('describeLocation', () => {
  it('formats rows, accounts, items and BS lines', () => {
    expect(describeLocation({ code: 'WRONG_SIDE', location: { rowId: 't2', accountId: 'loan-payable' } })).toBe('Row 2 · Loan payable');
    expect(describeLocation({ code: 'BS_MISMATCH', location: { accountId: 'cash', field: 'bs-line' } })).toBe('After balance sheet · Cash');
    expect(describeLocation({ code: 'WRONG_ITEM', location: { itemIndex: 0 } })).toBe('Item 1');
    expect(describeLocation({ code: 'EQUATION_BROKEN', location: {} })).toBe('Balance sheet');
  });
});
