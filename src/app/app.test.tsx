// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { sections } from '@content';
import { App } from './App';
import { QuestionView } from '../components/questions/QuestionView';
import { classifyFx } from '../components/questions/__fixtures__';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function go(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('App routes render without console errors', () => {
  const routes = [
    '#/',
    '#/cheatsheet',
    '#/sandbox',
    '#/s/nope',
    '#/p/nope',
    '#/p/03-cash-to-checking',
    '#/nothing/here',
    ...sections.map((s) => `#/s/${s.id}`),
  ];
  for (const r of routes) {
    it(r, async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<App />);
      await go(r);
      expect(document.querySelector('main')).toBeTruthy();
      expect(err).not.toHaveBeenCalled();
    });
  }

  it('problem page shows entity badge, copy link and sandbox link', async () => {
    render(<App />);
    await go('#/p/03-cash-to-checking');
    expect(screen.getByText(/Books of: You/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    const a = screen.getByRole('link', { name: 'Open in Sandbox' });
    expect(a.getAttribute('href')).toMatch(/^#\/sandbox\?d=./);
  });
});

describe('Cheat sheet drawer', () => {
  it('opens from header, traps focus, closes on Esc', async () => {
    render(<App />);
    await go('#/');
    fireEvent.click(screen.getByRole('button', { name: 'Cheat sheet' }));
    const dlg = screen.getByRole('dialog', { name: 'Cheat sheet' });
    expect(dlg).toBeTruthy();
    expect(document.activeElement && dlg.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Theme toggle', () => {
  it('sets data-theme on <html>', async () => {
    render(<App />);
    await go('#/');
    const btn = screen.getByRole('button', { name: 'Dark theme' });
    fireEvent.click(btn);
    const first = document.documentElement.dataset.theme;
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).not.toBe(first);
  });
});

describe('QuestionView', () => {
  it('Check calls the engine and shows feedback', () => {
    render(<QuestionView problem={classifyFx} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(document.querySelector('.fb-result')).toBeTruthy();
  });
});
