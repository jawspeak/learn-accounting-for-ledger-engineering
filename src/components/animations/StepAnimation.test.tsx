// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { animations, AnimationGallery, animationDefs } from './index';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stubReducedMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const renderAnim = (id: string) => {
  const C = animations[id]!.component;
  const utils = render(<C />);
  const figure = utils.container.querySelector('figure.step-anim') as HTMLElement;
  return { ...utils, figure };
};

describe('StepAnimation navigation', () => {
  it('steps forward/back with buttons and restarts', () => {
    const { figure } = renderAnim('cash-to-checking');
    expect(screen.getByText('Step 1 of 5')).toBeTruthy();
    const prev = screen.getByRole('button', { name: 'Previous step' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement;
    const restart = screen.getByRole('button', { name: 'Restart' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(restart.disabled).toBe(true);
    expect(figure.textContent).toContain('Starting point');

    fireEvent.click(next);
    expect(screen.getByText('Step 2 of 5')).toBeTruthy();
    expect(figure.textContent).toContain('Start with the account you’re sure about');
    expect(figure.textContent).toContain('not balanced yet');

    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText('Step 5 of 5')).toBeTruthy();
    expect(next.disabled).toBe(true);
    fireEvent.click(next);
    expect(screen.getByText('Step 5 of 5')).toBeTruthy();

    fireEvent.click(prev);
    expect(screen.getByText('Step 4 of 5')).toBeTruthy();
    fireEvent.click(restart);
    expect(screen.getByText('Step 1 of 5')).toBeTruthy();
  });

  it('supports ←/→/Home/End on the focused figure', () => {
    const { figure } = renderAnim('daily-accrual');
    const total = animationDefs.find((d) => d.id === 'daily-accrual')!.steps.length;
    expect(figure.tabIndex).toBe(0);
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    expect(screen.getByText(`Step 3 of ${total}`)).toBeTruthy();
    fireEvent.keyDown(figure, { key: 'ArrowLeft' });
    expect(screen.getByText(`Step 2 of ${total}`)).toBeTruthy();
    fireEvent.keyDown(figure, { key: 'End' });
    expect(screen.getByText(`Step ${total} of ${total}`)).toBeTruthy();
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    expect(screen.getByText(`Step ${total} of ${total}`)).toBeTruthy();
    fireEvent.keyDown(figure, { key: 'Home' });
    expect(screen.getByText(`Step 1 of ${total}`)).toBeTruthy();
    fireEvent.keyDown(figure, { key: 'ArrowLeft' });
    expect(screen.getByText(`Step 1 of ${total}`)).toBeTruthy();
  });

  it('shows a money token when stepping forward onto a step with a flow', () => {
    stubReducedMotion(false);
    const { figure } = renderAnim('cash-to-checking');
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    expect(figure.querySelectorAll('.flow-token')).toHaveLength(0);
    fireEvent.keyDown(figure, { key: 'ArrowRight' }); // step 3 has the Cash → Checking flow
    expect(figure.querySelector('.flow-token')?.textContent).toBe('$100');
    fireEvent.keyDown(figure, { key: 'ArrowLeft' });
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    expect(figure.querySelector('.flow-token')).toBeTruthy();
  });
});

describe('reduced motion', () => {
  it('marks the figure reduced and never renders moving tokens', () => {
    stubReducedMotion(true);
    const { figure } = renderAnim('cash-to-checking');
    expect(figure.classList.contains('step-anim--reduced')).toBe(true);
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    fireEvent.keyDown(figure, { key: 'ArrowRight' });
    expect(screen.getByText('Step 3 of 5')).toBeTruthy();
    expect(figure.querySelectorAll('.flow-token')).toHaveLength(0);
  });

  it('is not reduced by default', () => {
    stubReducedMotion(false);
    const { figure } = renderAnim('cash-to-checking');
    expect(figure.classList.contains('step-anim--reduced')).toBe(false);
  });
});

describe('rendering every animation', () => {
  it.each(Object.keys(animations))('%s renders every step with balanced balance sheets', (id) => {
    const { figure } = renderAnim(id);
    const total = animationDefs.find((d) => d.id === id)!.steps.length;
    for (let i = 0; i < total; i++) {
      expect(screen.getByText(`Step ${i + 1} of ${total}`)).toBeTruthy();
      const footers = figure.querySelectorAll('.bs tfoot td');
      expect(footers.length).toBeGreaterThan(0);
      footers.forEach((td) => {
        expect(td.textContent).toContain('✓');
        expect(td.classList.contains('is-err')).toBe(false);
      });
      fireEvent.keyDown(figure, { key: 'ArrowRight' });
    }
  });

  it('cash-to-checking final step shows Cash $0 and Checking $100', () => {
    const { figure } = renderAnim('cash-to-checking');
    fireEvent.keyDown(figure, { key: 'End' });
    expect(
      screen.getByRole('group', {
        name: /^Cash, asset T-account \(increases on the debit side\), balance \$0/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('group', { name: /^Checking Account, asset T-account .*balance \$100 Dr/ }),
    ).toBeTruthy();
  });

  it('daily-accrual collapses 30 stacked rows', () => {
    const { figure } = renderAnim('daily-accrual');
    for (let i = 0; i < 4; i++) fireEvent.keyDown(figure, { key: 'ArrowRight' });
    expect(figure.textContent).toContain('more identical rows');
    expect(
      screen.getByRole('group', {
        name: /^Interest Receivable, asset T-account .*balance \$30 Dr/,
      }),
    ).toBeTruthy();
  });

  it('gallery renders all animations', () => {
    const { container } = render(<AnimationGallery />);
    expect(container.querySelectorAll('figure.step-anim')).toHaveLength(
      Object.keys(animations).length,
    );
  });
});
