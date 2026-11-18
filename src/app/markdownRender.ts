/**
 * Markdown → HTML for authored (trusted, in-repo) content. Never pass user-supplied text here without sanitizing
 * (the sandbox uses ./sandbox/safeMarkdown instead).
 * Extras: ```tentry renders T-account entry figures (./tentry), ```journal renders journal-entry sheets (./journal),
 * ```taccount renders T-account ledgers with postings and balance (./taccount), and `[[term]]` marks a term
 * with a tap-to-open definition (./glossary, content/glossary.ts).
 */
import { Marked, type Tokens, type TokenizerAndRendererExtension } from 'marked';
import { tEntryHtml } from './tentry';
import { journalBlockHtml } from './journal';
import { tAccountsHtml } from './taccount';
import { MARKER_RE, termHtml } from './glossary';
import '../styles/tentry.css';
import '../styles/journal.css';
import '../styles/glossary.css';

const glossaryTerm: TokenizerAndRendererExtension = {
  name: 'glossaryTerm',
  level: 'inline',
  start: (src: string) => src.indexOf('[['),
  tokenizer(src: string) {
    const m = MARKER_RE.exec(src);
    if (!m) return undefined;
    return { type: 'glossaryTerm', raw: m[0], text: m[1]!, key: m[2] };
  },
  renderer: (token) => termHtml(token.text as string, token.key as string | undefined),
};

const authored = new Marked({
  gfm: true,
  extensions: [glossaryTerm],
  renderer: {
    code(token: Tokens.Code) {
      const lang = token.lang?.trim();
      if (lang === 'tentry') return tEntryHtml(token.text);
      if (lang === 'journal') return journalBlockHtml(token.text);
      if (lang === 'taccount') return tAccountsHtml(token.text);
      return false; // default rendering
    },
  },
});

export const renderMarkdown = (md: string) => authored.parse(md) as string;
export const renderInline = (md: string) => authored.parseInline(md) as string;
