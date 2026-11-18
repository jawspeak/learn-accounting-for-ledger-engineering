import { Marked, type Tokens } from 'marked';
import { tEntryHtml } from './tentry';
import '../styles/tentry.css';

/**
 * Markdown for authored (trusted, in-repo) content. Never pass user-supplied text here without sanitizing.
 * Extras: a ```tentry fenced block renders as T-account entry figures (see ./tentry.ts).
 */
const authored = new Marked({
  gfm: true,
  renderer: {
    code(token: Tokens.Code) {
      if (token.lang?.trim() === 'tentry') return tEntryHtml(token.text);
      return false; // default rendering
    },
  },
});

export function Markdown({ text, inline = false }: { text: string; inline?: boolean }) {
  const html = inline ? (authored.parseInline(text) as string) : (authored.parse(text) as string);
  if (inline) return <span className="md inline" dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
