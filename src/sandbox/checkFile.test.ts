/**
 * Check a Sandbox file before importing it — for people and agents writing one by hand:
 *
 *   SANDBOX_FILE=path/to/file.json npm run check:sandbox
 *
 * Fails with the located errors (it wouldn't import), or with the warnings (it would, but they're almost always
 * mistakes); passes when the file is clean. Without SANDBOX_FILE it does nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSandbox, parseSandboxFile } from './fileFormat';
import { eventParts, scenarioStatus } from './model';

const file = process.env.SANDBOX_FILE;

describe.skipIf(!file)('check a Sandbox file (SANDBOX_FILE)', () => {
  it(`${file} is a valid Sandbox file with nothing to warn about`, () => {
    const r = parseSandboxFile(readFileSync(resolve(process.env.INIT_CWD ?? '.', file!), 'utf8'));
    expect(r.ok ? [] : r.errors, 'errors (the file would not import)').toEqual([]);
    if (!r.ok) return;
    const problems = [...checkSandbox(r.state)];
    // Sides still to do: an entity neither posts an event nor marks it "none".
    r.state.scenarios.forEach((sc, si) => {
      eventParts(r.state, si).forEach((parts, i) => {
        for (const p of parts)
          if (p.part === 'todo')
            problems.push(`${sc.title} E${i + 1}: ${p.entity} has no entry and isn't in "none".`);
      });
      if (scenarioStatus(r.state, si) === 'bad' && !problems.some((x) => x.startsWith(sc.title)))
        problems.push(`${sc.title}: an entry or the opening balances don't balance (A = L + E).`);
    });
    expect(problems, 'warnings').toEqual([]);
  });
});
