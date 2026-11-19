// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { sections } from '@content';
import { calloutAnchor, LENS_ANCHOR, SECTION_ANIMATIONS, watchAnchor } from './sectionAnimations';
import { buildIndex } from '../search';

// jsdom has no layout: give pages that scroll to a target (Definitions, ?at= links) a no-op.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
});

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

describe('search dialog', () => {
  it('opens with ⌘K, finds by title, and Enter navigates', async () => {
    render(<App />);
    await go('#/');
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const box = screen.getByRole('combobox');
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: 'debit' } });
    const opts = screen.getAllByRole('option');
    expect(opts[0]!.textContent).toMatch(/Definition.*Debit/);
    expect(opts[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(window.location.hash).toBe('#/definitions/debit');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('"/" opens it, arrows move, Esc closes', async () => {
    render(<App />);
    await go('#/');
    fireEvent.keyDown(document.body, { key: '/' });
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'loan' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('"/" typed into a field does not open search', async () => {
    render(<App />);
    await go('#/definitions');
    const field = screen.getAllByRole('searchbox')[0]!;
    fireEvent.keyDown(field, { key: '/' });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('every section deep link (Watch it, callout) points at an element that exists', async () => {
    render(<App />);
    for (const s of sections) {
      await go(`#/s/${s.id}`);
      for (const aid of SECTION_ANIMATIONS[s.id] ?? [])
        expect(document.getElementById(watchAnchor(aid)), aid).toBeTruthy();
      (s.callouts ?? []).forEach((_, i) =>
        expect(document.getElementById(calloutAnchor(i))).toBeTruthy(),
      );
      if (s.lens) expect(document.getElementById(LENS_ANCHOR), s.id).toBeTruthy();
    }
    await go('#/cheatsheet');
    for (const e of buildIndex().filter((x) => x.href.startsWith('#/cheatsheet?at='))) {
      expect(document.getElementById(e.href.split('at=')[1]!), e.id).toBeTruthy();
    }
  });
});
