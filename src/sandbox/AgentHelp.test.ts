import { describe, expect, it } from 'vitest';
import { agentPrompt, docUrl } from './AgentHelp';

describe('agent prompt', () => {
  it('names the docs by their full URL, beside the app, wherever it is served', () => {
    const href = 'https://example.org/course/#/sandbox?d=abc';
    expect(docUrl('sandbox-format.md', href)).toBe('https://example.org/course/sandbox-format.md');
    const p = agentPrompt(href);
    for (const f of ['sandbox-format.md', 'sandbox.schema.json', 'sandbox-example.json'])
      expect(p).toContain(`https://example.org/course/${f}`);
    expect(p).toMatch(/cents/);
    expect(p).toMatch(/"none"/);
    expect(p).toMatch(/Import/);
  });
});
