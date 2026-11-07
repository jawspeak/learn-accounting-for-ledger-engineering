import { marked } from 'marked';

/** Renders authored (trusted, in-repo) markdown. Never pass user-supplied text here without sanitizing. */
export function Markdown({ text, inline = false }: { text: string; inline?: boolean }) {
  const html = inline ? (marked.parseInline(text) as string) : (marked.parse(text) as string);
  if (inline) return <span className="md inline" dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
