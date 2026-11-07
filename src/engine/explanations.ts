/**
 * Generic diagnostic messages (reveal level 3) and explanations (reveal level 4).
 * Problems can override explanations per code via `problem.diagnosticExplanations`; trap diagnostics use the
 * trap account's own explanation; WRONG_ITEM uses the item's authored explanation.
 */
import type { DiagnosticCode, Markdown, ProblemBase } from '@contracts';

/** Short, encouraging category messages. Plain text. Never names an account the learner hasn't used. */
export const MESSAGES = {
  UNBALANCED_ROW: (dr: string, cr: string) => `This row doesn't balance: debits total ${dr} but credits total ${cr}.`,
  WRONG_TYPE: 'One account has the wrong type.',
  WRONG_SIDE: 'One account is on the wrong side (debit vs. credit).',
  WRONG_AMOUNT: 'Right account and side, but the amount is off.',
  MISSING_ACCOUNT: 'An account that should change in this transaction is missing.',
  MISSING_ROW: "A transaction from the problem hasn't been booked yet.",
  EXTRA_ACCOUNT: "This account doesn't change in this transaction.",
  EXTRA_ROW_ACCOUNT: "This row doesn't match any event in the problem, so this account shouldn't change here.",
  COUNTERPARTY_ACCOUNT: "This account belongs to the other party's books.",
  TRAP_ACCOUNT: 'Close — but this is a commonly confused account.',
  SPLIT_ENTRY: 'Your numbers add up, but one business event is spread over several rows.',
  WRONG_ROW: 'This posting is right, but it belongs to a different transaction.',
  BS_MISMATCH: "This balance-sheet line doesn't match the transactions.",
  TB_MISMATCH: "This trial-balance line doesn't match the transactions.",
  EQUATION_BROKEN: (a: string, l: string, e: string) =>
    `Your balance sheet doesn't balance: Assets ${a} ≠ Liabilities ${l} + Equity ${e}.`,
  ITEM_UNANSWERED: "This one hasn't been answered yet.",
  ITEM_WRONG: "This one isn't right yet.",
  CLASSIFY_WRONG: 'This item is in the wrong bucket.',
  DRCR_WRONG: 'Wrong side — think about the normal balance of this account type.',
  EQUATION_WRONG: "That number doesn't make the equation balance.",
  MC_WRONG_PICK: "This option isn't correct.",
  MC_MISSED: 'There is another correct option you didn’t select.',
  MC_NO_ANSWER: 'Choose an answer first.',
  COA_MISSING: 'This business needs this account.',
  COA_NOT_NEEDED: "This business doesn't need this account.",
  COA_WRONG_TYPE: 'Right account to include, but the type is wrong.',
} as const;

export const GENERIC_EXPLANATIONS: Record<DiagnosticCode, Markdown> = {
  UNBALANCED_ROW:
    'Every transaction must balance: **total debits = total credits**. This is the core invariant of double entry — a ledger database should refuse to store an entry that breaks it.\n\nCheck each posting: did you forget the other side of the entry, put an amount on the wrong side, or type a different amount on one side?',
  WRONG_TYPE:
    'You picked the right account but gave it the wrong **type**. The type decides which side increases the account and where it lands on the balance sheet.\n\nAsk: is it something the entity **owns** (Asset), **owes** (Liability), the owners\' stake (Equity), something **earned** (Revenue), or something **used up** to earn it (Expense)? Remember **DEALER**: Dividends, Expenses, Assets increase with a debit; Liabilities, Equity, Revenue increase with a credit.',
  WRONG_SIDE:
    'The right account changes, but in the opposite direction.\n\nStart from what you know: does this account go **up** or **down**? Then use its normal balance — Assets, Expenses and Dividends increase on the **debit** (left) side; Liabilities, Equity and Revenue increase on the **credit** (right) side. A decrease goes on the other side.',
  WRONG_AMOUNT:
    'The account and the side are right, but the amount is not. Re-read the scenario for the exact figure, and check that compound entries (three or more accounts) still add up to the same total on each side.',
  MISSING_ACCOUNT:
    'An account that changes in this event has no posting. Double entry means every event touches **at least two** accounts.\n\nTry this: pick the account you are *sure* changes, decide whether it goes up or down, and then ask "what was given or received in exchange?" — that is the other side.',
  EXTRA_ACCOUNT:
    "This account doesn't change in this event. Make sure you're in the right entity's books and only post to accounts that really go up or down because of *this* event.",
  COUNTERPARTY_ACCOUNT:
    "This account belongs to the **other party's** books. The same event is recorded by both sides, but each side uses its own accounts: what one party owns (an asset), the other often owes (a liability). Ask first: *whose books are we in?*",
  TRAP_ACCOUNT:
    'This account sounds right but means something different. Compare what the account really represents with what happened in the scenario.',
  SPLIT_ENTRY:
    "Your postings add up to the right totals, but **one business event** is booked as several transactions. In a ledger, one event = **one atomic transaction**: either all of its postings are recorded or none are. Splitting it means a reader (or a crash halfway through) could see a half-finished event. Combine these rows into a single compound entry.",
  WRONG_ROW:
    'This posting is correct, but it belongs to a **different event** (row). Each row should record exactly one business event. Check which event actually caused this account to change and move the posting there.',
  BS_MISMATCH:
    "The balance on this line doesn't match what the transactions produce. A balance is just the **opening balance plus every posting** to that account (increases on its normal side, decreases on the other). Recompute it from the T-account's running total.",
  EQUATION_BROKEN:
    'Every balance sheet must satisfy **Assets = Liabilities + Equity**. If yours does not, at least one line is wrong. Remember that revenue increases equity, while expenses, dividends and contra accounts reduce their group.',
  WRONG_ITEM: "This answer isn't right yet. Look again at what the item represents and whose books it lives in.",
};

/** Problem override → generic. */
export function explanationFor(problem: Pick<ProblemBase, 'diagnosticExplanations'>, code: DiagnosticCode): Markdown {
  return problem.diagnosticExplanations?.[code] ?? GENERIC_EXPLANATIONS[code];
}

/** Whole-dollar display for messages, e.g. 10000 → "$100", 1050 → "$10.50", -500 → "-$5". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  const whole = dollars.toLocaleString('en-US');
  return `${sign}$${whole}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}
