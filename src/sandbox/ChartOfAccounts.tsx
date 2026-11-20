import { Fragment } from 'react';
import type { SandboxState } from '@contracts';
import { orderedAccounts, usageByScenario } from './model';
import { SECTION_LABEL, sectionOf, typeLabel } from './EntityPanels';

/**
 * The chart of accounts as built so far: every entity's accounts (with the label set in the Grid), and which
 * scenarios use each one. The point of the Sandbox is to find the accounts that model every scenario, so an
 * account no scenario uses yet is flagged.
 */
export function ChartOfAccounts({ state, scenario }: { state: SandboxState; scenario: number }) {
  const names = state.scenarios.map((s, i) => s.title || `Scenario ${i + 1}`);
  return (
    <div className="coa">
      {state.entities.map((e) => {
        const accounts = orderedAccounts({ ...e, rows: [] });
        const usage = new Map(accounts.map((a) => [a.id, usageByScenario(state, e.id, a.id)]));
        const unused = accounts.filter((a) => usage.get(a.id)!.every((n) => n === 0)).length;
        return (
          <section
            key={e.id}
            className="coa-entity"
            aria-label={`${e.name || 'Entity'} chart of accounts`}
          >
            <h3>
              {e.name || 'Unnamed entity'}{' '}
              <span className="note">
                {accounts.length} account{accounts.length === 1 ? '' : 's'}
                {unused ? ` · ${unused} not used in any scenario` : ''}
              </span>
            </h3>
            {accounts.length === 0 ? (
              <p className="note">No accounts yet.</p>
            ) : (
              <table className="sbx-table coa-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Label</th>
                    <th scope="col">Type</th>
                    <th scope="col">Used in</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, i) => {
                    const used = usage.get(a.id)!;
                    const section = sectionOf(a.type);
                    const parent = a.contraOf && e.accounts.find((x) => x.id === a.contraOf);
                    return (
                      <Fragment key={a.id}>
                        {(i === 0 || sectionOf(accounts[i - 1]!.type) !== section) && (
                          <tr className="sbx-section-row">
                            <th scope="rowgroup" colSpan={4}>
                              {SECTION_LABEL[section]}
                            </th>
                          </tr>
                        )}
                        <tr>
                          <th scope="row" title={a.description}>
                            {a.name}
                          </th>
                          <td>{a.subtitle ?? <span className="note">—</span>}</td>
                          <td>
                            {typeLabel(a.type)}
                            {parent && <span className="note"> of {parent.name}</span>}
                          </td>
                          <td>
                            {used.some((n) => n > 0) ? (
                              <span className="coa-used">
                                {used.map((n, si) =>
                                  n > 0 ? (
                                    <span
                                      key={si}
                                      className={`coa-chip${si === scenario ? ' is-current' : ''}`}
                                      title={`${names[si]}: ${n} line${n > 1 ? 's' : ''}`}
                                    >
                                      {names[si]}
                                    </span>
                                  ) : null,
                                )}
                              </span>
                            ) : (
                              <span className="coa-unused">Not used yet</span>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
