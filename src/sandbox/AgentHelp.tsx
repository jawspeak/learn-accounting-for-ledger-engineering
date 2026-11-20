/**
 * "Build a file with an agent": where the format is documented (published next to the app), and a prompt to paste
 * into an agent so it writes a file the Sandbox can import.
 */
const DOCS = [
  ['sandbox-format.md', 'Format guide'],
  ['sandbox.schema.json', 'JSON Schema'],
  ['sandbox-example.json', 'Example file'],
  ['llms.txt', 'llms.txt'],
] as const;

/** A doc's full URL, beside the app (works on any host or path the site is served from). */
export const docUrl = (f: string, href = window.location.href) =>
  new URL(f, href.split('#')[0]).href;

/** The prompt to paste into an agent: what to read, the rules that matter most, and how the file comes back. */
export function agentPrompt(href?: string): string {
  return [
    'Write a Sandbox file (JSON) for the double-entry Sandbox in "Accounting for Ledger Engineers".',
    `Read the format guide first: ${docUrl('sandbox-format.md', href)}`,
    `JSON Schema: ${docUrl('sandbox.schema.json', href)} · a complete example: ${docUrl('sandbox-example.json', href)}`,
    '',
    'What to model: <describe the entities (companies, banks, people) and what happens, step by step>',
    '',
    'Rules: "v": 3; amounts are integer cents; each event is booked in every entity it touches, with debits =',
    'credits, or that entity is listed in the event\'s "none". Give me one .json file to open with',
    '⋯ Sandbox menu → Import.',
  ].join('\n');
}

export function AgentHelp({ onCopied }: { onCopied(ok: boolean): void }) {
  return (
    <div className="sbx-menu-agents" role="group" aria-label="Build a file with an agent">
      <p className="sbx-menu-heading">Build a file with an agent</p>
      <p className="note">
        Point your agent to the format guide; it writes a .json file you Import.
      </p>
      <p className="sbx-menu-links">
        {DOCS.map(([f, label]) => (
          <a key={f} href={f} target="_blank" rel="noreferrer">
            {label}
          </a>
        ))}
      </p>
      <button
        type="button"
        className="btn"
        title="Copy a prompt that tells an agent where the format is documented"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(agentPrompt());
            onCopied(true);
          } catch {
            onCopied(false);
          }
        }}
      >
        Copy agent prompt
      </button>
    </div>
  );
}
