import type { Account, AccountId, SandboxEntity, SandboxState, Side } from '@contracts';
import { engine } from '@engine';
import { BalanceSheetPanel } from '../components/builder/BalanceSheetPanel';
import { formatDollars } from '../components/builder/model';
import '../components/animations/animations.css';
import { useScrollToAt } from '../lib/useScrollToAt';
import { ColumnOrderToggle } from './ColumnOrderToggle';
import { SandboxLink } from './nav';
import { entryAnchor } from './JournalEditor';
import { isManualOrder, orderedAccounts, setManualOrder, summarize, typeResolver } from './model';
import { EntitySummaryLine, typeLabel } from './PartyPanels';
import './journal.css';

const SIDES: Side[] = ['dr', 'cr'];
const other = (s: Side): Side => (s === 'dr' ? 'cr' : 'dr');

/**
 * The T-accounts view: the same entries, organised by account — the general ledger. Every party's books side by
 * side; one T per account that has an opening balance or appears in an entry (no empty T's), in the party's
 * account order, A ‖ = ‖ L + E. Each amount is numbered by its journal entry and links back to it. Read-only:
 * you write entries in the Journal or the Grid.
 */
export function LedgerView({
  state,
  onEntityChange,
  at,
}: {
  state: SandboxState;
  onEntityChange(i: number, e: SandboxEntity): void;
  at?: string;
}) {
  useScrollToAt(at);
  return (
    <div className="lv">
      {state.entities.map((e, pi) => (
        <PartyLedger key={e.id} entity={e} index={pi} onChange={(x) => onEntityChange(pi, x)} />
      ))}
    </div>
  );
}

function PartyLedger({
  entity: e,
  index,
  onChange,
}: {
  entity: SandboxEntity;
  index: number;
  onChange(e: SandboxEntity): void;
}) {
  const typeOf = typeResolver(e);
  const balances = engine.computeBalances(e.rows, typeOf, e.opening);
  const used = new Set<AccountId>([
    ...e.rows.flatMap((r) => r.postings.filter((p) => p.amount > 0).map((p) => p.accountId)),
    ...(e.opening?.lines ?? []).filter((l) => l.amount !== 0).map((l) => l.accountId),
  ]);
  const shown = orderedAccounts(e).filter((a) => used.has(a.id));
  const left = shown.filter((a) => a.type === 'asset' || a.type === 'contra-asset');
  const liab = shown.filter((a) => a.type === 'liability' || a.type === 'contra-liability');
  const eq = shown.filter((a) => !left.includes(a) && !liab.includes(a));
  const nameOf = (id: AccountId) => e.accounts.find((a) => a.id === id)?.name ?? id;
  // The same rows in every T of this party, so a row means the same thing everywhere: the opening balance
  // (if any T has one), then one row per entry, in order (blank where the entry doesn't touch the account),
  // then the ending balance.
  const layout: Layout = {
    opening: shown.some(
      (a) => (e.opening?.lines.find((l) => l.accountId === a.id)?.amount ?? 0) !== 0,
    ),
    entries: e.rows.flatMap((r, ri) => (r.postings.some((p) => p.amount > 0) ? [ri] : [])),
  };

  const band = (label: string, list: Account[]) =>
    list.length > 0 && (
      <div className="lv-band">
        <h4 className="lv-band-label">{label}</h4>
        <div className="lv-taccts">
          {list.map((a) => (
            <TAccount
              key={a.id}
              entity={e}
              account={a}
              balance={balances}
              layout={layout}
              party={index}
            />
          ))}
        </div>
      </div>
    );

  return (
    <section
      className="lv-party"
      id={`party-${index + 1}`}
      aria-label={`${e.name || 'Unnamed party'}’s ledger`}
    >
      <div className="lv-party-head">
        <h2>{e.name || `Party ${index + 1}`}</h2>
        <ColumnOrderToggle
          manual={isManualOrder(e)}
          disabled={e.accounts.length === 0}
          onChange={(m) => onChange(setManualOrder(e, m))}
        />
        <label className="sbx-check">
          <input
            type="checkbox"
            checked={e.showBalanceSheets}
            onChange={(ev) => onChange({ ...e, showBalanceSheets: ev.target.checked })}
          />
          Show balance sheets
        </label>
        <SandboxLink className="lv-edit" to={{ view: 'journal', party: index }}>
          Edit in Journal
        </SandboxLink>
      </div>
      <EntitySummaryLine summary={summarize(e)} rows={e.rows.length} />
      {shown.length === 0 ? (
        <p className="note">
          No postings yet. Write entries in the{' '}
          <SandboxLink to={{ view: 'journal', party: index }}>Journal</SandboxLink> or the{' '}
          <SandboxLink to={{ view: 'grid', party: index }}>Grid</SandboxLink>, and each account you
          use gets a T here.
        </p>
      ) : (
        <div className="lv-ledger">
          <div className="lv-side">{band('Assets', left)}</div>
          <div className="lv-eq" aria-hidden="true">
            =
          </div>
          <div className="lv-side">
            {band('Liabilities', liab)}
            {band('Equity', eq)}
          </div>
        </div>
      )}
      {e.showBalanceSheets && (
        <div className="lv-bs">
          <BalanceSheetPanel
            title="Before"
            bs={e.opening ?? { lines: [] }}
            accountIds={shown.map((a) => a.id)}
            typeOf={typeOf}
            nameOf={nameOf}
          />
          <BalanceSheetPanel
            title="After"
            bs={balances}
            compareTo={e.opening ?? { lines: [] }}
            accountIds={shown.map((a) => a.id)}
            typeOf={typeOf}
            nameOf={nameOf}
          />
        </div>
      )}
    </section>
  );
}

/** The row structure shared by every T in a party: an opening row (if any T has one), then these entries. */
interface Layout {
  opening: boolean;
  /** Row indices of the entries that post anything. */
  entries: number[];
}

/** One real T: the opening balance at the top, a row per entry (numbered; blank if untouched), the balance. */
function TAccount({
  entity: e,
  account: a,
  balance,
  layout,
  party,
}: {
  entity: SandboxEntity;
  account: Account;
  balance: { lines: { accountId: AccountId; amount: number }[] };
  layout: Layout;
  /** Which party this T belongs to (its entry numbers link to that party's Journal). */
  party: number;
}) {
  const normal = engine.normalSide(a.type);
  const bal = balance.lines.find((l) => l.accountId === a.id)?.amount ?? 0;
  const balSide = bal >= 0 ? normal : other(normal);
  const opening = e.opening?.lines.find((l) => l.accountId === a.id)?.amount ?? 0;
  const lines = layout.entries.map((ri) => {
    const r = e.rows[ri]!;
    const sum = (s: Side) =>
      r.postings
        .filter((p) => p.accountId === a.id && p.side === s)
        .reduce((t, p) => t + p.amount, 0);
    return { n: ri + 1, label: r.label, dr: sum('dr'), cr: sum('cr') };
  });

  return (
    <div
      className={`tacct inc-${normal}`}
      role="group"
      aria-label={`${a.name}, ${typeLabel(a.type).toLowerCase()} T-account (increases on the ${normal === 'dr' ? 'debit' : 'credit'} side), balance ${formatDollars(Math.abs(bal))} ${balSide === 'dr' ? 'debit' : 'credit'}`}
    >
      <div className="tacct__head">
        <span className="tacct__name" title={a.name}>
          {a.name}
        </span>
        <span className="tacct__type">{typeLabel(a.type)}</span>
      </div>
      <div className="tacct__t">
        <div className="tacct__sides" aria-hidden="true">
          {SIDES.map((s) => (
            <span key={s}>
              {s === 'dr' ? 'Dr' : 'Cr'}
              {s === normal && <span className="tacct__inc"> ▲</span>}
            </span>
          ))}
        </div>
        <ul className="tacct__body">
          {layout.opening && (
            <li className={`tacct__row is-opening${opening === 0 ? ' is-blank' : ''}`}>
              {SIDES.map((s) =>
                opening !== 0 && s === (opening > 0 ? normal : other(normal)) ? (
                  <span key={s} className={`tacct__cell tacct__${s}`}>
                    <span className="tacct__ref">Bal</span>
                    <span className="tacct__amt">{formatDollars(Math.abs(opening))}</span>
                    <span className="visually-hidden">
                      {' '}
                      opening, {s === 'dr' ? 'debit' : 'credit'}
                    </span>
                  </span>
                ) : (
                  <span key={s} className={`tacct__cell tacct__${s}`} />
                ),
              )}
            </li>
          )}
          {lines.map((l) => (
            <li key={l.n} className={`tacct__row${l.dr || l.cr ? '' : ' is-blank'}`}>
              {SIDES.map((s) =>
                l[s] ? (
                  <span key={s} className={`tacct__cell tacct__${s}`}>
                    <SandboxLink
                      className="tacct__ref lv-ref"
                      to={{ view: 'journal', party, at: entryAnchor(l.n) }}
                      title={`Entry ${l.n}${l.label ? `: ${l.label}` : ''} — open in the Journal`}
                    >
                      ({l.n})
                    </SandboxLink>
                    <span className="tacct__amt">{formatDollars(l[s])}</span>
                    <span className="visually-hidden"> {s === 'dr' ? 'debit' : 'credit'}</span>
                  </span>
                ) : (
                  <span key={s} className={`tacct__cell tacct__${s}`} />
                ),
              )}
            </li>
          ))}
          <li className="tacct__row tacct__total">
            {SIDES.map((s) => (
              <span
                key={s}
                className={`tacct__cell tacct__${s}${s === balSide ? ' is-total' : ''}`}
              >
                {s === balSide && (
                  <>
                    <span className="visually-hidden">balance </span>
                    <strong className="tacct__balval">{formatDollars(Math.abs(bal))}</strong>
                  </>
                )}
              </span>
            ))}
          </li>
        </ul>
      </div>
    </div>
  );
}
