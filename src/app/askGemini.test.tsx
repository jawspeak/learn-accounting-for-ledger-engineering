// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AskGemini, detectBrowser, suggestedQuestions } from './AskGemini';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('detectBrowser', () => {
  it('trusts client-hint brands', () => {
    expect(
      detectBrowser({ userAgent: CHROME, userAgentData: { brands: [{ brand: 'Google Chrome' }] } }),
    ).toBe('chrome');
    expect(
      detectBrowser({
        userAgent: CHROME,
        userAgentData: { brands: [{ brand: 'Microsoft Edge' }, { brand: 'Chromium' }] },
      }),
    ).toBe('other');
    expect(
      detectBrowser({
        userAgent: CHROME,
        userAgentData: { brands: [{ brand: 'Google Chrome' }], mobile: true },
      }),
    ).toBe('chrome-mobile');
  });

  it('falls back to the UA string, excluding Chromium look-alikes', () => {
    expect(detectBrowser({ userAgent: CHROME })).toBe('chrome');
    expect(detectBrowser({ userAgent: `${CHROME} Edg/142.0` })).toBe('other');
    expect(detectBrowser({ userAgent: `${CHROME} OPR/120.0` })).toBe('other');
    expect(detectBrowser({ userAgent: CHROME, brave: {} })).toBe('other');
    expect(
      detectBrowser({ userAgent: 'Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/140.0' }),
    ).toBe('other');
    expect(
      detectBrowser({
        userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605 CriOS/142.0 Mobile Safari/604.1',
      }),
    ).toBe('chrome-mobile');
  });
});

describe('AskGemini', () => {
  it('tailors questions to problems (hints, not answers)', () => {
    expect(suggestedQuestions({ kind: 'problem', title: 'X' })[0]).toMatch(
      /hint.*without telling me the answer/,
    );
  });

  it('in Chrome: says so and points at the Gemini button', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(CHROME);
    render(<AskGemini context={{ kind: 'section', title: 'Debits and credits' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Gemini/ }));
    expect(screen.getByText(/You're in Chrome/)).toBeTruthy();
    expect(screen.getByText(/Debits and credits/)).toBeTruthy();
  });

  it('elsewhere: suggests opening the page in Chrome; Esc closes', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Firefox/140.0');
    render(<AskGemini context={{ kind: 'other' }} />);
    const toggle = screen.getByRole('button', { name: /Chat with this page/ });
    fireEvent.click(toggle);
    expect(screen.getByText(/Open this page in/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy page link for Chrome/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
