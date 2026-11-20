import { Fragment } from 'react';
import type { Account, SandboxState } from '@contracts';
import { orderedAccounts, usageByScenario } from './model';
import { SECTION_LABEL, sectionOf, typeLabel } from './EntityPanels';

/** A type the section heading doesn't already say (Assets, Liabilities, Equity, Revenue, Expenses). */
const plainType = (t: Account['type']) =>
  t === 'asset' || t === 'liability' || t === 'equity' || t === 'revenue' || t === 'expense';

/**
 * The chart of accounts as built so far, as one ruled table: every entity's accounts by section, with the label
 * set in the Grid, and how many lines each scenario posts to each account. The point of the Sandbox is to find
 * the accounts that model every scenario, so an account no scenario uses yet is marked "unused".
 */
export function ChartOfAccounts({ state, scenario }: { state: SandboxState; scenario: number }) {
  const names = state.scenarios.map((s, i) => s.title || `Scenario ${i + 1}`);
  const cols = 3 + names.length;
  return (
    <div className="coa">
      <table className="coa-table">
        <caption className="sr-only">
          Chart of accounts: each entity’s accounts, and the lines each scenario posts to them
        </caption>
        <colgroup>
          <col className="coa-c-name" />
          <col className="coa-c-label" />
          {names.map((_, i) => (
            <col key={i} className={`coa-c-sc${i === scenario ? ' is-current' : ''}`} />
          ))}
          <col className="coa-c-total" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col">Label</th>
            {names.map((n, i) => (
              <th
                key={i}
                scope="col"
                className={`coa-sc${i === scenario ? ' is-current' : ''}`}
                title={n}
              >
                <span className="coa-sc-name">{n}</span>
              </th>
            ))}
            <th scope="col" className="coa-num">
              Total
            </th>
          </tr>
        </thead>
        {state.entities.map((e) => {
          const accounts = orderedAccounts({ ...e, rows: [] });
          const unused = accounts.filter((a) =>
            usageByScenario(state, e.id, a.id).every((x) => x === 0),
          ).length;
          return (
            <tbody key={e.id} aria-label={`${e.name || 'Entity'} chart of accounts`}>
              <tr className="coa-entity">
                <th scope="rowgroup" colSpan={cols}>
                  {e.name || 'Unnamed entity'}{' '}
                  <span className="note">
                    {accounts.length} account{accounts.length === 1 ? '' : 's'}
                    {unused ? ` · ${unused} unused` : ''}
                  </span>
                </th>
              </tr>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={cols} className="note">
                    No accounts yet.
                  </td>
                </tr>
              )}
              {accounts.map((a, i) => {
                const used = usageByScenario(state, e.id, a.id);
                const total = used.reduce((t, x) => t + x, 0);
                const section = sectionOf(a.type);
                const parent = a.contraOf && e.accounts.find((x) => x.id === a.contraOf);
                return (
                  <Fragment key={a.id}>
                    {(i === 0 || sectionOf(accounts[i - 1]!.type) !== section) && (
                      <tr className="coa-section">
                        <th scope="rowgroup" colSpan={cols}>
                          {SECTION_LABEL[section]}
                        </th>
                      </tr>
                    )}
                    <tr className="coa-row">
                      <th scope="row" title={a.description}>
                        {a.name}
                        {!plainType(a.type) && (
                          <span className="note">
                            {' '}
                            {typeLabel(a.type).toLowerCase()}
                            {parent ? ` of ${parent.name}` : ''}
                          </span>
                        )}
                      </th>
                      <td>{a.subtitle ?? ''}</td>
                      {used.map((x, si) => (
                        <td
                          key={si}
                          className={`coa-num${si === scenario ? ' is-current' : ''}`}
                          title={`${names[si]}: ${x} line${x === 1 ? '' : 's'}`}
                        >
                          {x || ''}
                        </td>
                      ))}
                      <td className={`coa-num${total ? '' : ' coa-unused'}`}>
                        {total || 'unused'}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
