import type {
  AccountId,
  AccountType,
  BalanceSheet,
  EngineApi,
  EquationCheck,
  OrderedColumn,
  ColumnGroup,
  RowTotals,
  Side,
  TransactionRow,
  TrialBalanceLine,
} from '@contracts';

const NORMAL: Record<AccountType, Side> = {
  asset: 'dr',
  'contra-asset': 'cr',
  liability: 'cr',
  'contra-liability': 'dr',
  equity: 'cr',
  'contra-equity': 'dr',
  revenue: 'cr',
  'contra-revenue': 'dr',
  expense: 'dr',
  dividend: 'dr',
};

export const normalSide: EngineApi['normalSide'] = (type) => NORMAL[type];

export const rowTotals = (row: TransactionRow): RowTotals => {
  let dr = 0;
  let cr = 0;
  for (const p of row.postings) {
    if (p.side === 'dr') dr += p.amount;
    else cr += p.amount;
  }
  return { dr, cr, balanced: dr === cr && dr > 0 };
};

export const computeBalances: EngineApi['computeBalances'] = (rows, typeOf, opening) => {
  const bal = new Map<AccountId, number>();
  for (const l of opening?.lines ?? []) bal.set(l.accountId, l.amount);
  for (const row of rows) {
    for (const p of row.postings) {
      const normal = normalSide(typeOf(p.accountId) ?? 'asset');
      const delta = p.side === normal ? p.amount : -p.amount;
      bal.set(p.accountId, (bal.get(p.accountId) ?? 0) + delta);
    }
  }
  return { lines: [...bal].map(([accountId, amount]) => ({ accountId, amount })) };
};

export const checkEquation = (
  bs: BalanceSheet,
  typeOf: (id: AccountId) => AccountType | undefined,
): EquationCheck => {
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  for (const { accountId, amount } of bs.lines) {
    switch (typeOf(accountId)) {
      case 'asset': assets += amount; break;
      case 'contra-asset': assets -= amount; break;
      case 'liability': liabilities += amount; break;
      case 'contra-liability': liabilities -= amount; break;
      case 'equity':
      case 'revenue': equity += amount; break;
      case 'contra-equity':
      case 'contra-revenue':
      case 'expense':
      case 'dividend': equity -= amount; break;
      default: break;
    }
  }
  return { assets, liabilities, equity, balanced: assets === liabilities + equity };
};

export const trialBalance: EngineApi['trialBalance'] = (rows, typeOf, opening) =>
  computeBalances(rows, typeOf, opening).lines.map((l): TrialBalanceLine => {
    const normal = normalSide(typeOf(l.accountId) ?? 'asset');
    const other: Side = normal === 'dr' ? 'cr' : 'dr';
    return { accountId: l.accountId, side: l.amount >= 0 ? normal : other, amount: Math.abs(l.amount) };
  });

const GROUP_ORDER: ColumnGroup[] = [
  'assets',
  'liabilities',
  'equity-paid-in',
  'equity-retained',
  'revenue',
  'expenses',
  'dividends',
];

function groupOf(type: AccountType, equityGroup?: 'paid-in' | 'retained'): ColumnGroup {
  switch (type) {
    case 'asset':
    case 'contra-asset': return 'assets';
    case 'liability':
    case 'contra-liability': return 'liabilities';
    case 'equity':
    case 'contra-equity': return equityGroup === 'retained' ? 'equity-retained' : 'equity-paid-in';
    case 'revenue':
    case 'contra-revenue': return 'revenue';
    case 'expense': return 'expenses';
    case 'dividend': return 'dividends';
  }
}

/**
 * Canonical column order (VISION-2 §5). Groups follow `A = L + E`; within a group, CoA order, unknown accounts
 * appended alphabetically by id. A contra account sits directly after its parent when the parent is a column in the
 * same group (several contras of one parent keep CoA order among themselves); otherwise it is ordered by its own
 * CoA position. Group placement uses the given `type` (the learner's chosen type in the builder).
 */
export const orderColumns: EngineApi['orderColumns'] = (columns, coaOrder) => {
  const rankMap = new Map<string, number>();
  coaOrder.forEach((id, i) => {
    if (!rankMap.has(id)) rankMap.set(id, i);
  });
  const rank = (id: string) => rankMap.get(id) ?? Number.MAX_SAFE_INTEGER;
  const byId = new Map(columns.map((c) => [c.accountId, c]));
  type Key = [number, number, string, number, number, string];
  const sortKey = (c: (typeof columns)[number]): Key => {
    const group = GROUP_ORDER.indexOf(groupOf(c.type, c.equityGroup));
    const parentCol = c.contraOf && c.contraOf !== c.accountId ? byId.get(c.contraOf) : undefined;
    const parent =
      parentCol && GROUP_ORDER.indexOf(groupOf(parentCol.type, parentCol.equityGroup)) === group ? parentCol : undefined;
    const anchor = parent ?? c;
    return [group, rank(anchor.accountId), anchor.accountId, parent ? 1 : 0, rank(c.accountId), c.accountId];
  };
  const keyed = columns.map((c) => ({ c, k: sortKey(c) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < a.k.length; i++) {
      const x = a.k[i]!;
      const y = b.k[i]!;
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
  return keyed.map(({ c }): OrderedColumn => ({ accountId: c.accountId, group: groupOf(c.type, c.equityGroup) }));
};
