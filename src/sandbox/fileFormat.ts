/**
 * The Sandbox's file format — what Export writes and Import reads: the same JSON as the link, `SandboxState`
 * (version 3). Documented for people and agents in public/sandbox-format.md, with a JSON Schema generated from
 * the same zod schema (public/sandbox.schema.json); tests keep both in step with this code.
 */
import { schemas, type SandboxState } from '@contracts';
import { slugify } from './model';

/** "zap-a-wallet-on-an-fbo-account-20261120-061530Z.json": the title, then the UTC time it was saved. */
export function exportFileName(title: string | undefined, at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}-` +
    `${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}Z`;
  return `${slugify(title?.trim() || 'sandbox', 'sandbox')}-${stamp}.json`;
}

export type ParseResult = { ok: true; state: SandboxState } | { ok: false; errors: string[] };

/** "scenarios[0].events[1].lines.zap[0].amount" — where a problem is, the way a person would write it. */
const pathOf = (path: readonly PropertyKey[]) =>
  path.reduce<string>(
    (s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)),
    '',
  ) || '(the whole file)';

/** Read a Sandbox file: valid JSON, version 3, the right shape. On failure, the first few problems, located. */
export function parseSandboxFile(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const v = (json as { v?: unknown } | null)?.v;
  if (v !== 3)
    return {
      ok: false,
      errors: [`"v" must be 3 (this Sandbox's file version); found ${JSON.stringify(v)}.`],
    };
  const parsed = schemas.sandboxStateSchema.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 5).map((i) => `${pathOf(i.path)}: ${i.message}`),
    };
  return { ok: true, state: parsed.data as SandboxState };
}

/**
 * What the schema can't see, as warnings (the file still opens): references to accounts, entities or events
 * that don't exist, duplicate ids, entries that don't balance, contra accounts without a parent.
 */
export function checkSandbox(s: SandboxState): string[] {
  const out: string[] = [];
  const dup = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of dup(s.entities.map((e) => e.id))) out.push(`Entity id "${id}" is used twice.`);
  for (const id of dup(s.scenarios.map((sc) => sc.id)))
    out.push(`Scenario id "${id}" is used twice.`);
  const accounts = new Map(s.entities.map((e) => [e.id, new Set(e.accounts.map((a) => a.id))]));
  for (const e of s.entities) {
    for (const id of dup(e.accounts.map((a) => a.id)))
      out.push(`${e.name}: account id "${id}" is used twice.`);
    for (const a of e.accounts)
      if (a.contraOf && !accounts.get(e.id)!.has(a.contraOf))
        out.push(
          `${e.name}: "${a.name}" reduces "${a.contraOf}", which isn't one of its accounts.`,
        );
  }
  for (const sc of s.scenarios) {
    for (const id of dup(sc.events.map((ev) => ev.id)))
      out.push(`${sc.title}: event id "${id}" is used twice.`);
    for (const id of Object.keys(sc.opening))
      if (!accounts.has(id)) out.push(`${sc.title}: opening balances for unknown entity "${id}".`);
    for (const [id, bs] of Object.entries(sc.opening))
      for (const l of bs.lines)
        if (accounts.get(id) && !accounts.get(id)!.has(l.accountId))
          out.push(`${sc.title}: opening balance for unknown account "${l.accountId}" (${id}).`);
    sc.events.forEach((ev, i) => {
      const n = `${sc.title} E${i + 1}`;
      for (const [id, lines] of Object.entries(ev.lines)) {
        if (!accounts.has(id)) {
          out.push(`${n}: lines for unknown entity "${id}".`);
          continue;
        }
        for (const p of lines)
          if (!accounts.get(id)!.has(p.accountId))
            out.push(`${n}: ${id} posts to unknown account "${p.accountId}".`);
        const dr = lines.filter((p) => p.side === 'dr').reduce((t, p) => t + p.amount, 0);
        const cr = lines.filter((p) => p.side === 'cr').reduce((t, p) => t + p.amount, 0);
        if (lines.length && dr !== cr)
          out.push(`${n}: ${id}'s entry doesn't balance (debits ${dr} ≠ credits ${cr}, in cents).`);
        if (ev.none?.includes(id)) out.push(`${n}: ${id} has lines but is also marked "none".`);
      }
      for (const id of ev.none ?? [])
        if (!accounts.has(id)) out.push(`${n}: "none" names unknown entity "${id}".`);
    });
  }
  return out;
}
