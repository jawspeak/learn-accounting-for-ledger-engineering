/**
 * Definitions, shown when a learner taps a marked term (`[[Retained Earnings]]` in authored markdown) and listed
 * on the Definitions page (#/definitions). Keep each definition short and concrete — one idea, one example —
 * and consistent with the course's own entities. Definitions may themselves mark other terms with [[…]].
 *
 * `aliases` are the other spellings a marker may use (plurals, abbreviations); matching is case-insensitive.
 * Basics (`core: true`) are only auto-marked in the early sections so later pages aren't covered in underlines.
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  aliases?: string[];
  definition: string;
  core?: boolean;
}

export const glossary: GlossaryTerm[] = [
  // ---- the five account types + dividends ----
  {
    id: 'asset',
    term: 'Asset',
    aliases: ['assets'],
    core: true,
    definition:
      'Something the entity owns or is owed that has future value: cash, money in a bank account, money customers owe it ([[accounts receivable]]), equipment. Left side of `A = L + E`; increases with a [[debit]].',
  },
  {
    id: 'liability',
    term: 'Liability',
    aliases: ['liabilities'],
    core: true,
    definition:
      'Something the entity owes someone else: a loan, an unpaid bill ([[accounts payable]]), or — for a bank — the customer deposits it must pay back. Right side of `A = L + E`; increases with a [[credit]].',
  },
  {
    id: 'equity',
    term: 'Equity',
    core: true,
    definition:
      "The owners' claim on the assets: what's left after liabilities (`A − L`). For a person it's [[net worth]]; for a company it's [[paid-in capital]] plus [[retained earnings]]. Increases with a [[credit]].",
  },
  {
    id: 'revenue',
    term: 'Revenue',
    aliases: ['revenues'],
    core: true,
    definition:
      'Value earned by delivering goods or services — sales, fees, interest earned. It increases [[equity]], so it is credit-normal. Often called *income* (Salary Income, Interest Income).',
  },
  {
    id: 'expense',
    term: 'Expense',
    aliases: ['expenses'],
    core: true,
    definition:
      'A cost used up to earn revenue or run the business — rent, wages, interest paid. It decreases [[equity]], so it is debit-normal.',
  },
  {
    id: 'dividends',
    term: 'Dividends / Draws',
    aliases: ['dividends', 'dividend', 'draws', 'draw', 'owner draws', 'owner draw'],
    core: true,
    definition:
      "Money the owners take out of the business for themselves (a *draw* for a sole proprietor, a *dividend* for a corporation). Not an [[expense]] — it doesn't help earn revenue — but it reduces [[equity]], so it is debit-normal.",
  },
  {
    id: 'net-worth',
    term: 'Net Worth',
    definition: "A person's [[equity]]: everything you own minus everything you owe.",
  },
  {
    id: 'paid-in-capital',
    term: 'Paid-in Capital',
    definition:
      'The part of [[equity]] the owners put in — e.g. buying shares or investing cash to start the business. It changes only when owners invest more or take capital back.',
  },
  {
    id: 'retained-earnings',
    term: 'Retained Earnings',
    definition:
      'The part of [[equity]] built from profits kept in the business: all past net income minus all [[dividends]]. During a period, revenue and expense accounts track the changes; at period end they are closed into Retained Earnings ([[closing entries]]).',
  },

  // ---- the mechanics ----
  {
    id: 'debit',
    term: 'Debit',
    aliases: ['debits', 'dr'],
    core: true,
    definition:
      'The **left** side of a [[T-account]] (abbreviated Dr). Increases assets, expenses and dividends; decreases liabilities, equity and revenue. It means *left*, not "good", "bad" or "money out".',
  },
  {
    id: 'credit',
    term: 'Credit',
    aliases: ['credits', 'cr'],
    core: true,
    definition:
      'The **right** side of a [[T-account]] (abbreviated Cr). Increases liabilities, equity and revenue; decreases assets, expenses and dividends. Your bank statement says "credit" when your balance goes up because it is printed from the **bank\'s** books.',
  },
  {
    id: 'normal-balance',
    term: 'Normal balance',
    aliases: ['normal side', 'normal sides', 'normal balances', 'debit-normal', 'credit-normal'],
    definition:
      'The side an account **increases** on, and where its balance normally sits: debit for assets, expenses and dividends; credit for liabilities, equity and revenue (mnemonic **DEALER**). A balance on the other side is *abnormal* — e.g. an overdrawn account.',
  },
  {
    id: 't-account',
    term: 'T-account',
    aliases: ['t-accounts', 't account', 't accounts'],
    definition:
      'One account drawn as a big "T": debits on the left, credits on the right, the balance underneath. A thinking tool for working out which accounts a transaction touches and on which side.',
  },
  {
    id: 'double-entry',
    term: 'Double entry',
    aliases: ['double-entry', 'double-entry bookkeeping', 'double entry bookkeeping'],
    definition:
      'Every transaction posts to **at least two** accounts, and its total debits equal its total credits. That rule is what keeps `A = L + E` true after every transaction.',
  },
  {
    id: 'posting',
    term: 'Posting',
    aliases: ['postings'],
    definition:
      'One line of a transaction: an account, a side (Dr or Cr) and an amount. A transaction is a set of postings whose debits equal its credits.',
  },
  {
    id: 'journal-entry',
    term: 'Journal entry',
    aliases: ['journal entries', 'journal'],
    definition:
      'A transaction written as lines: debits first, then the credits indented, each with an amount. The dense, standard form accountants (and ledgers) use instead of drawing [[T-accounts]].',
  },
  {
    id: 'compound-entry',
    term: 'Compound entry',
    aliases: ['compound entries', 'compound journal entry'],
    definition:
      'A [[journal entry]] with more than two lines — e.g. a loan payment split into principal (Loan Payable) and interest (Interest Expense). Still **one** transaction; debits still equal credits.',
  },
  {
    id: 'chart-of-accounts',
    term: 'Chart of accounts',
    aliases: ['charts of accounts', 'coa'],
    definition:
      'The list of every account an entity uses, each with a name and a type (and, in a ledger, an id and attributes). Accountants often hand it to engineers as a table; engineers implement it as reference data.',
  },
  {
    id: 'ledger',
    term: 'Ledger',
    aliases: ['ledgers', 'general ledger', 'gl'],
    definition:
      "The record of every account and all its postings. The *general ledger* (GL) holds the entity's main accounts; detail can live in [[sub-ledgers]].",
  },
  {
    id: 'sub-ledger',
    term: 'Sub-ledger',
    aliases: ['sub-ledgers', 'subledger', 'subledgers'],
    definition:
      'A detailed ledger — e.g. one balance per customer — whose total must always equal one summary account in the general ledger, its [[control account]].',
  },
  {
    id: 'control-account',
    term: 'Control account',
    aliases: ['control accounts'],
    definition:
      "A general-ledger account whose balance equals the total of a [[sub-ledger]] — e.g. *Customer Balances Payable* = the sum of every customer's balance.",
  },
  {
    id: 'trial-balance',
    term: 'Trial balance',
    aliases: ['trial balances'],
    definition:
      "A list of every account's balance in a Debit and a Credit column; the two columns must total the same. It catches arithmetic and one-sided errors — but not a balanced entry booked to the wrong accounts.",
  },
  {
    id: 'balance-sheet',
    term: 'Balance sheet',
    aliases: ['balance sheets'],
    definition:
      'A snapshot of assets, liabilities and equity **at a point in time**. It always satisfies `A = L + E`.',
  },
  {
    id: 'income-statement',
    term: 'Income statement',
    aliases: ['income statements', 'p&l', 'profit and loss'],
    definition:
      'Revenue minus expenses **for a period** (a month, a year): the result is net income (a profit) or a net loss. Also called the P&L.',
  },
  {
    id: 'closing-entries',
    term: 'Closing entries',
    aliases: ['closing entry', 'closing', 'close the books', 'closed'],
    definition:
      'Period-end entries that move the balances of revenue, expense and dividend accounts into [[retained earnings]], leaving those accounts at zero to start the next period.',
  },
  {
    id: 'counterparty',
    term: 'Counterparty',
    aliases: ['counterparties'],
    definition:
      "The other party to a transaction. The same event appears in both parties' books on opposite sides — your checking account (an asset to you) is the bank's customer deposit (a liability to it).",
  },
  {
    id: 'liquidity',
    term: 'Liquidity',
    aliases: ['liquidity order', 'liquid'],
    definition:
      'How quickly an asset can become cash. Balance sheets list assets most-liquid first (cash, then receivables, then equipment).',
  },

  // ---- loans, interest, banks ----
  {
    id: 'principal',
    term: 'Principal',
    definition:
      'The amount borrowed (or lent), not counting interest. Repaying principal just shrinks the loan — no gain or loss for either side.',
  },
  {
    id: 'interest',
    term: 'Interest',
    definition:
      'The price of borrowing money, usually a percentage of the [[principal]] per year: an [[expense]] for the borrower and [[revenue]] for the lender.',
  },
  {
    id: 'reserves',
    term: 'Reserves',
    aliases: ['reserve balance', 'reserves at the federal reserve', 'fed reserves'],
    definition:
      "A bank's balance in its own account at the Federal Reserve. Banks pay each other by moving reserves; they're the bank's asset, not a slice set aside for any one depositor.",
  },
  {
    id: 'fungible',
    term: 'Fungible',
    definition:
      "Interchangeable — one dollar is as good as another. So a bank's cash isn't tied to any particular deposit; it moves around the bank's assets while the bank still owes each customer their balance.",
  },
  {
    id: 'settlement',
    term: 'Settlement',
    aliases: ['settle', 'settles', 'settled'],
    definition:
      'When money actually moves between institutions to complete a payment (e.g. between two banks\' accounts at the Fed). Before settlement the money is "in flight" — often tracked in a [[clearing account]].',
  },

  // ---- accrual accounting ----
  {
    id: 'cash-basis',
    term: 'Cash basis',
    aliases: ['cash-basis', 'cash basis accounting'],
    definition:
      'Recording revenue and expenses only when cash moves. Fine for a person (and used for "you" in this course); not allowed for most companies or banks.',
  },
  {
    id: 'accrual-basis',
    term: 'Accrual basis',
    aliases: ['accrual-basis', 'accrual accounting', 'accrual basis accounting'],
    definition:
      'Recording revenue when it is **earned** and expenses when they are **incurred**, whether or not cash has moved yet — so each period shows what really happened in it. Required for companies and banks.',
  },
  {
    id: 'accrual',
    term: 'Accrual',
    aliases: ['accruals', 'accrue', 'accrued', 'accrues'],
    definition:
      'Revenue earned or an expense incurred **before** cash moves, recorded with a receivable or payable — e.g. interest earned daily (Interest Receivable) or wages earned but not yet paid (Wages Payable).',
  },
  {
    id: 'deferral',
    term: 'Deferral',
    aliases: ['deferrals', 'defer', 'deferred'],
    definition:
      'Cash moves **before** the revenue is earned or the expense is used up, so it waits on the balance sheet: [[unearned revenue]] (a liability) or a [[prepaid expense]] (an asset).',
  },
  {
    id: 'unearned-revenue',
    term: 'Unearned revenue',
    aliases: ['deferred revenue'],
    definition:
      'Cash received for goods or services not yet delivered — e.g. gift cards sold. A [[liability]] (you owe the goods) until delivered, then it becomes revenue.',
  },
  {
    id: 'prepaid-expense',
    term: 'Prepaid expense',
    aliases: ['prepaid expenses', 'prepaid', 'prepaids'],
    definition:
      'Paying in advance for something used later — e.g. three months of rent. An [[asset]] that is moved to expense as each month is used up.',
  },
  {
    id: 'accounts-receivable',
    term: 'Accounts receivable',
    aliases: ['receivable', 'receivables', 'ar'],
    definition: 'Money customers owe for goods or services already delivered. An [[asset]].',
  },
  {
    id: 'accounts-payable',
    term: 'Accounts payable',
    aliases: ['payable', 'payables', 'ap'],
    definition: 'Bills the entity owes suppliers for things already received. A [[liability]].',
  },
  {
    id: 'inventory',
    term: 'Inventory',
    definition:
      'Goods held to sell, or the supplies used to make them (coffee beans, cups). An [[asset]] until sold or used up, when its cost becomes [[cost of goods sold]].',
  },
  {
    id: 'cogs',
    term: 'Cost of goods sold',
    aliases: ['cogs', 'cost of sales'],
    definition: 'The cost of the inventory sold or used up in a period. An [[expense]].',
  },

  // ---- contra accounts ----
  {
    id: 'contra-account',
    term: 'Contra account',
    aliases: ['contra accounts', 'contra-account', 'contra-accounts', 'contra'],
    definition:
      'An account that **reduces** another account in the same group and so sits on the opposite side — e.g. [[Accumulated Depreciation]] (credit) reduces Equipment (debit). On the balance sheet the two are shown net.',
  },
  {
    id: 'depreciation',
    term: 'Depreciation',
    definition:
      "Spreading an asset's cost over its useful life as an expense — e.g. a $12,000 espresso machine used for 5 years: $200 a month. Booked Dr Depreciation Expense / Cr [[Accumulated Depreciation]].",
  },
  {
    id: 'accumulated-depreciation',
    term: 'Accumulated depreciation',
    definition:
      'A [[contra account]] for an asset: all the depreciation recorded on it so far. The original cost stays visible; cost minus accumulated depreciation is the [[book value]].',
  },
  {
    id: 'book-value',
    term: 'Book value',
    aliases: ['net book value', 'carrying value', 'carrying amount'],
    definition:
      "An asset's cost minus its contra account (e.g. Equipment − Accumulated Depreciation).",
  },
  {
    id: 'allowance-for-doubtful-accounts',
    term: 'Allowance for doubtful accounts',
    aliases: ['allowance for doubtful', 'allowance'],
    definition:
      'A [[contra account]] for receivables: the estimate of customer balances that will never be collected, so receivables are shown at what is really expected.',
  },
  {
    id: 'sales-returns',
    term: 'Sales returns & allowances',
    aliases: ['sales returns', 'sales returns and allowances'],
    definition:
      'A contra-revenue account for goods returned and discounts given after a sale, so gross sales stay visible.',
  },

  // ---- processes and fintech ----
  {
    id: 'reversal',
    term: 'Reversal',
    aliases: ['reversals', 'reversing entry', 'reverse', 'reversed'],
    definition:
      'An entry that exactly undoes an earlier one: same accounts and amounts, opposite sides. Ledgers never edit a posted entry — they reverse it and book the correct one, so history stays auditable.',
  },
  {
    id: 'fbo-account',
    term: 'FBO account',
    aliases: ['fbo', 'fbo accounts', 'for benefit of', 'for the benefit of'],
    definition:
      '"For Benefit Of": a bank account titled to a fintech *for the benefit of* its customers. The money is the customers\', kept apart from the fintech\'s own operating account.',
  },
  {
    id: 'gross-up',
    term: 'Gross-up',
    aliases: ['gross up', 'grossed up'],
    definition:
      'Showing customer funds a company holds on its own balance sheet — the cash as an asset with a matching liability to the customers — instead of keeping them off the balance sheet in a sub-ledger only.',
  },
  {
    id: 'pass-through-insurance',
    term: 'Pass-through deposit insurance',
    aliases: ['pass-through insurance', 'pass-through'],
    definition:
      'Deposit insurance that can extend to each end customer of an [[FBO account]] — but only if the records show who owns how much. Good ledgers are what make it work.',
  },
  {
    id: 'clearing-account',
    term: 'Clearing account',
    aliases: ['clearing accounts', 'in-transit account', 'in transit', 'cash in transit'],
    definition:
      'A temporary account for money in flight — e.g. a cash-out sent but not yet settled — so the books balance at every step. It should return to zero once the money lands.',
  },
  {
    id: 'suspense-account',
    term: 'Suspense account',
    aliases: ['suspense', 'suspense accounts'],
    definition:
      "A temporary home for money that can't be matched yet — e.g. a deposit with no recognisable customer — until someone works out where it belongs.",
  },

  // ---- ledger engineering ----
  {
    id: 'invariant',
    term: 'Invariant',
    aliases: ['invariants'],
    definition:
      "A rule that must always hold, enforced by the system rather than hoped for — e.g. every transaction's debits equal its credits, checked in the database at commit.",
  },
  {
    id: 'atomic-transaction',
    term: 'Atomic transaction',
    aliases: ['atomic', 'atomicity', 'atomically'],
    definition:
      "All of a transaction's postings commit together or none do. One business event = one atomic transaction, so the books never show half an event.",
  },
  {
    id: 'idempotency-key',
    term: 'Idempotency key',
    aliases: ['idempotency keys', 'idempotency', 'idempotent'],
    definition:
      'A unique id sent with a request so that retrying it can never post the same transaction twice.',
  },
  {
    id: 'minor-units',
    term: 'Minor units',
    aliases: ['integer minor units', 'minor unit'],
    definition:
      "Storing money as whole numbers of the smallest unit (cents for USD) instead of floating-point dollars, which can't represent amounts like 0.10 exactly.",
  },
];
