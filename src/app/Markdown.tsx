import { renderInline, renderMarkdown } from './markdownRender';

/** Renders authored (trusted, in-repo) markdown. Never pass user-supplied text here without sanitizing. */
export function Markdown({ text, inline = false }: { text: string; inline?: boolean }) {
  if (inline) return <span className="md inline" dangerouslySetInnerHTML={{ __html: renderInline(text) }} />;
  return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
