import { useEffect, useId, useRef, useState } from 'react';

/** Which "chat with this page" story we can tell: Gemini in Chrome reads the open tab, so real Chrome matters. */
export type BrowserKind = 'chrome' | 'chrome-mobile' | 'other';

type NavLike = {
  userAgent: string;
  userAgentData?: { brands?: { brand: string }[]; mobile?: boolean };
  brave?: unknown;
};

/**
 * Real Google Chrome only — Edge, Brave, Opera, Vivaldi, Samsung etc. also say "Chrome" in their UA but
 * don't ship Gemini in Chrome. Prefer UA Client Hints (brand "Google Chrome"); fall back to the UA string.
 */
export function detectBrowser(nav: NavLike = navigator as unknown as NavLike): BrowserKind {
  const ua = nav.userAgent || '';
  const brands = nav.userAgentData?.brands;
  if (brands && brands.length > 0) {
    if (!brands.some((b) => b.brand === 'Google Chrome')) return 'other';
    return nav.userAgentData?.mobile ? 'chrome-mobile' : 'chrome';
  }
  if (/CriOS\//.test(ua)) return 'chrome-mobile';
  if (nav.brave) return 'other';
  if (!/Chrome\/\d/.test(ua)) return 'other';
  if (/Edg\/|EdgA\/|OPR\/|Opera|Vivaldi|SamsungBrowser|YaBrowser|Brave|DuckDuckGo/.test(ua))
    return 'other';
  return /Mobile|Android/.test(ua) ? 'chrome-mobile' : 'chrome';
}

/** What the reader is looking at, so the suggested questions fit the page. */
export type AskContext =
  { kind: 'section'; title: string } | { kind: 'problem'; title: string } | { kind: 'other' };

export function suggestedQuestions(ctx: AskContext): string[] {
  if (ctx.kind === 'problem')
    return [
      `Give me a hint for "${ctx.title}" without telling me the answer.`,
      'Which accounts does this problem involve, and does each one go up or down?',
      'After I answer, explain why the correct entry is correct in plain words.',
    ];
  if (ctx.kind === 'section')
    return [
      `Explain "${ctx.title}" in plain words for a software engineer.`,
      'Give me a fresh worked example of the main idea on this page, then quiz me on it.',
      'What would break in a real ledger system if I got this concept wrong?',
      'What do people most often misunderstand about this page?',
    ];
  return [
    'Summarize what this page covers and what I should learn from it.',
    'Quiz me with three questions about the content on this page.',
  ];
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Floating bottom-right tip: chat with the page using Gemini in Chrome (no keys, nothing hosted). */
export function AskGemini({ context }: { context: AskContext }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [browser] = useState<BrowserKind>(() =>
    typeof navigator === 'undefined' ? 'other' : detectBrowser(),
  );
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const onCopy = async (key: string, text: string) => {
    if (await copy(text)) setCopied(key);
  };

  const questions = suggestedQuestions(context);
  const inChrome = browser === 'chrome';

  return (
    <div className={`ask-gemini${open ? ' open' : ''}`}>
      {open && (
        <section id={panelId} className="ask-panel" aria-label="Chat about this page">
          <div className="ask-head">
            <strong>{inChrome ? 'Ask Gemini about this page' : 'Chat with this page'}</strong>
            <button
              type="button"
              className="ghost"
              aria-label="Close"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
            >
              ✕
            </button>
          </div>

          {inChrome && (
            <>
              <p className="ask-badge">✓ You're in Chrome — Gemini can read this page.</p>
              <ol className="ask-steps">
                <li>
                  Click the <strong>Gemini</strong> button at the top right of Chrome's toolbar.
                </li>
                <li>Ask anything about what you're reading — the page is its context.</li>
              </ol>
              <p className="ask-note">
                Asking questions while you read is one of the best ways to learn: have it explain
                differently, invent new examples, or quiz you.
              </p>
            </>
          )}
          {browser === 'chrome-mobile' && (
            <p className="ask-note">
              Gemini in Chrome reads the page you're on, which works best in{' '}
              <strong>Chrome on a computer</strong>. Open this page there and click the Gemini
              button in the toolbar to chat about it.
            </p>
          )}
          {browser === 'other' && (
            <>
              <p className="ask-note">
                Open this page in <strong>Google Chrome</strong> to chat with it: Gemini in Chrome
                can read the page and answer your questions about it while you learn.
              </p>
              <button type="button" onClick={() => onCopy('link', window.location.href)}>
                {copied === 'link' ? '✓ Link copied' : 'Copy page link for Chrome'}
              </button>
            </>
          )}

          <p className="ask-sub">
            {inChrome ? 'Questions to try' : 'Or ask any AI assistant'} — click to copy:
          </p>
          <ul className="ask-questions">
            {questions.map((q, i) => (
              <li key={q}>
                <button type="button" className="ask-q" onClick={() => onCopy(`q${i}`, q)}>
                  <span>{q}</span>
                  <span className="ask-copied" aria-live="polite">
                    {copied === `q${i}` ? '✓ Copied' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {inChrome && (
            <p className="ask-fine">
              Don't see the Gemini button? It may not be available for your account or region yet.
            </p>
          )}
        </section>
      )}
      <button
        ref={toggleRef}
        type="button"
        className="ask-toggle"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={inChrome ? 'Ask Gemini about this page' : 'Chat with this page'}
        title={inChrome ? 'Ask Gemini in Chrome about this page' : 'Chat with this page'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">✦</span>
        <span className="ask-label">{inChrome ? 'Ask Gemini' : 'Chat with this page'}</span>
      </button>
    </div>
  );
}
