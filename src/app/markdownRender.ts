/**
 * Markdown → HTML for authored (trusted, in-repo) content. Never pass user-supplied text here without sanitizing
 * (the sandbox uses ./sandbox/safeMarkdown instead).
 * Extras: ```tentry renders T-account entry figures (./tentry), ```journal renders journal-entry sheets (./journal).
 */
import { Marked, type Tokens } from 'marked';
import { tEntryHtml } from './tentry';
import { journalBlockHtml } from './journal';
import '../styles/tentry.css';
import '../styles/journal.css';

const authored = new Marked({
  gfm: true,
  renderer: {
    code(token: Tokens.Code) {
      const lang = token.lang?.trim();
      if (lang === 'tentry') return tEntryHtml(token.text);
      if (lang === 'journal') return journalBlockHtml(token.text);
      return false; // default rendering
    },
  },
});

export const renderMarkdown = (md: string) => authored.parse(md) as string;
export const renderInline = (md: string) => authored.parseInline(md) as string;
