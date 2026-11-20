import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schemas, type SandboxState } from '@contracts';
import { EXAMPLES } from '../../content/sandbox-examples';
import { checkSandbox, exportFileName, parseSandboxFile } from './fileFormat';
import { eventParts, persistable, scenarioStatus } from './model';

const pub = (f: string) => resolve(__dirname, '../../public', f);
const read = (f: string) => readFileSync(pub(f), 'utf8');

describe('export file name', () => {
  it('the title, then the UTC time: yyyymmdd-hhmmssZ', () => {
    const at = new Date(Date.UTC(2026, 10, 20, 6, 15, 30));
    expect(exportFileName('Zap — a wallet on an FBO account', at)).toBe(
      'zap-a-wallet-on-an-fbo-account-20261120-061530Z.json',
    );
    expect(exportFileName('', at)).toBe('sandbox-20261120-061530Z.json');
  });
});

describe('import: located errors', () => {
  it('not JSON, the wrong version, or the wrong shape — each says where', () => {
    expect(parseSandboxFile('{oops')).toMatchObject({ ok: false });
    expect(parseSandboxFile('{"v": 2}')).toEqual({
      ok: false,
      errors: ['"v" must be 3 (this Sandbox\'s file version); found 2.'],
    });
    const s = JSON.parse(read('sandbox-example.json')) as SandboxState;
    s.scenarios[0]!.events[1]!.lines.cart![0]!.amount = -5;
    const r = parseSandboxFile(JSON.stringify(s));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toMatch(
      /^scenarios\[0\]\.events\[1\]\.lines\.cart\[0\]\.amount: /,
    );
  });

  it('warnings for what the schema can’t see: unknown accounts, unbalanced entries, both lines and none', () => {
    const s = JSON.parse(read('sandbox-example.json')) as SandboxState;
    const ev = s.scenarios[0]!.events[0]!;
    ev.lines.cart![0]!.accountId = 'cash';
    ev.lines.bank![0]!.amount += 1;
    ev.none = ['bank'];
    expect(checkSandbox(s)).toEqual([
      'Borrow, buy a cart, sell coffee E1: cart posts to unknown account "cash".',
      "Borrow, buy a cart, sell coffee E1: bank's entry doesn't balance (debits 200001 ≠ credits 200000, in cents).",
      'Borrow, buy a cart, sell coffee E1: bank has lines but is also marked "none".',
    ]);
  });
});

describe('the published docs and example (public/) match the code', () => {
  it('the example file imports, has nothing to warn about, and every scenario checks out (no side missing)', () => {
    const r = parseSandboxFile(read('sandbox-example.json'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(checkSandbox(r.state)).toEqual([]);
    r.state.scenarios.forEach((_, si) => {
      expect(scenarioStatus(r.state, si)).toBe('ok');
      for (const parts of eventParts(r.state, si))
        expect(parts.map((p) => p.part)).not.toContain('todo');
    });
  });

  it('the built-in examples export as files that import cleanly', () => {
    for (const ex of EXAMPLES) {
      const s = persistable(ex.build());
      const r = parseSandboxFile(JSON.stringify(s, null, 2));
      expect(r).toEqual({ ok: true, state: s });
      expect(checkSandbox(s)).toEqual([]);
    }
  });

  it('sandbox.schema.json is the JSON Schema of the validator (UPDATE_SCHEMA=1 rewrites it)', () => {
    const generated = {
      title: 'Sandbox file (version 3)',
      description:
        'A Sandbox export: entities with their charts of accounts, and scenarios of events booked in each entity. See sandbox-format.md.',
      ...z.toJSONSchema(schemas.sandboxStateSchema),
    };
    const text = `${JSON.stringify(generated, null, 2)}\n`;
    if (process.env.UPDATE_SCHEMA) writeFileSync(pub('sandbox.schema.json'), text);
    expect(read('sandbox.schema.json')).toBe(text);
  });

  it('sandbox-format.md mentions every field of the format', () => {
    const doc = read('sandbox-format.md');
    const shape = schemas.sandboxStateSchema.shape;
    const entity = shape.entities.element.shape;
    const scenario = shape.scenarios.element.shape;
    const event = scenario.events.element.shape;
    const account = Object.keys(
      (schemas.accountSchema as unknown as { shape: object }).shape ?? {},
    );
    const keys = [
      ...Object.keys(shape),
      ...Object.keys(entity),
      ...Object.keys(scenario),
      ...Object.keys(event),
      ...account,
      'accountId',
      'side',
      'amount',
    ];
    for (const k of keys)
      expect(doc, `sandbox-format.md should document "${k}"`).toContain(`"${k}"`);
  });

  it('llms.txt points to the format, the schema and the example', () => {
    const llms = read('llms.txt');
    for (const f of ['sandbox-format.md', 'sandbox.schema.json', 'sandbox-example.json'])
      expect(llms).toContain(`](${f})`);
  });
});
