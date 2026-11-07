/**
 * Markdown for UNTRUSTED text (sandbox scenarios arrive via URLs anyone can craft).
 * - Raw HTML (block and inline) is escaped and shown as text, never rendered.
 * - Links are kept only for http(s):, mailto:, in-page/hash (`#…`) and relative URLs; anything else
 *   (javascript:, data:, vbscript:, obfuscated schemes…) renders as plain text.
 * - Images are kept only for http(s): sources.
 */
import { Marked, type Tokens } from 'marked';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** True if `href` is safe to put in an <a href>. */
export function isSafeHref(href: string): boolean {
  // Browsers ignore whitespace/control chars inside schemes ("java\tscript:"), so strip them before checking.
  // eslint-disable-next-line no-control-regex
  const h = href.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  if (h.startsWith('#')) return true;
  if (/^(https?:|mailto:)/.test(h)) return true;
  // Relative URL: no ":" before the first "/", "?" or "#". Anything else has (or might have) a scheme.
  const head = h.split(/[/?#]/, 1)[0] ?? '';
  return !head.includes(':') && !head.includes('&');
}

const isSafeImageSrc = (src: string) => /^https?:\/\//i.test(src.trim());

const safe = new Marked({
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link(token: Tokens.Link) {
      if (isSafeHref(token.href)) return false; // default renderer (escapes href/title)
      return this.parser.parseInline(token.tokens);
    },
    image(token: Tokens.Image) {
      if (isSafeImageSrc(token.href)) return false;
      return escapeHtml(token.text);
    },
  },
});

export function renderUntrustedMarkdown(text: string): string {
  return safe.parse(text, { async: false });
}

export function SafeMarkdown({ text }: { text: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: renderUntrustedMarkdown(text) }} />;
}
