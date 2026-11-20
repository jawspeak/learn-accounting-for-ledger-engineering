# Sandbox file format (version 3)

The Sandbox is a double-entry workbench: you model **entities** (a bank, a payments company, a person), each with its
own **chart of accounts**, and write **scenarios** — stories made of **events**, each booked as a journal entry in
every entity it touches. This file describes the JSON the Sandbox **exports** and **imports** (⋯ Sandbox menu →
Export / Import), so a person or an agent can write one by hand and open it in the tool.

- **JSON Schema:** [`sandbox.schema.json`](sandbox.schema.json) — generated from the same validator the app uses.
- **A complete, valid example:** [`sandbox-example.json`](sandbox-example.json) — a coffee cart and its bank.
- The same JSON also lives in Sandbox links (`#/sandbox?d=…`, compressed); files are for anything you want to keep.

## The shape

```jsonc
{
  "v": 3, // required: the format version
  "title": "Coffee cart and its bank",
  "showCodes": true, // optional: show entity codes and GL numbers in every view
  "entities": [/* Entity, ... */],
  "scenarios": [/* Scenario, ... (at least one) */],
}
```

### Entity — one set of books

```jsonc
{
  "id": "cart", // unique in the file; kebab-case is conventional
  "name": "Bean Cart",
  "code": "1000", // optional: an entity code, any format (shown when showCodes is on)
  "showBalanceSheets": true, // required: show before/after balance sheets in the T-accounts view
  "accounts": [/* Account, ... */],
  "columnOrder": ["checking"], // optional: a manual account order (account ids)
  "sortByNumber": true, // optional: order accounts by GL number
}
```

### Account — shared by every scenario

```jsonc
{
  "id": "checking", // unique within the entity; referenced by postings and opening balances
  "name": "Cash: Checking",
  "type": "asset", // see the table below
  "number": "1010", // optional: a GL account number, any format
  "subtitle": "At First Example Bank", // optional: a short second line (the Grid's "Label")
  "description": "…", // optional: shown on hover
  "contraOf": "equipment", // required for contra-* types: the account it reduces (same entity)
  "equityGroup": "paid-in", // optional, equity only: "paid-in" (default) or "retained"
}
```

| `type`                                      | Normal (increasing) side | Section         |
| ------------------------------------------- | ------------------------ | --------------- |
| `asset`                                     | debit                    | Assets          |
| `contra-asset` (needs `contraOf`, an asset) | credit                   | Assets          |
| `liability`                                 | credit                   | Liabilities     |
| `contra-liability` (needs `contraOf`)       | debit                    | Liabilities     |
| `equity`                                    | credit                   | Equity          |
| `contra-equity` (needs `contraOf`)          | debit                    | Equity          |
| `revenue`                                   | credit                   | Equity (income) |
| `contra-revenue` (needs `contraOf`)         | debit                    | Equity (income) |
| `expense`                                   | debit                    | Equity (income) |
| `dividend`                                  | debit                    | Equity          |

### Scenario — a story, its events, and each entity's opening balances

```jsonc
{
  "id": "borrow-and-buy", // unique in the file
  "title": "Borrow, buy a cart, sell coffee",
  "text": "Markdown: what happens, and anything worth noticing.",
  "opening": {
    // by entity id; omit an entity to start it at zero
    "cart": { "lines": [{ "accountId": "checking", "amount": 50000 }] },
  },
  "events": [/* Event, ... in order: E1, E2, … */],
}
```

**Opening balances** are amounts in **cents**, each on the account's **normal side** (a positive number); a negative
number is an abnormal balance. They should satisfy A = L + E.

### Event — one thing that happens, in every entity's books

```jsonc
{
  "id": "e1", // unique within the scenario
  "label": "Borrow $2,000", // the event's name, shown in every entity's journal
  "lines": {
    // each affected entity's journal entry for this event, by entity id
    "cart": [
      { "accountId": "checking", "side": "dr", "amount": 200000 },
      { "accountId": "loan-payable", "side": "cr", "amount": 200000 },
    ],
    "bank": [
      { "accountId": "loans-receivable", "side": "dr", "amount": 200000 },
      { "accountId": "deposits-business", "side": "cr", "amount": 200000 },
    ],
  },
  "none": [], // entity ids this event doesn't touch (no entry in their books)
}
```

A **line** (posting) is `{ "accountId", "side": "dr" | "cr", "amount" }`, where `amount` is a **positive integer
number of cents** (`$2,000.00` → `200000`).

For every event, each entity is in exactly one state:

- **Has its entry** — it's a key in `lines`, with lines that balance (total debits = total credits).
- **No entry** — its id is in `none`: the event really doesn't touch its books.
- **Still to do** — neither. The Sandbox flags this ("…'s side is missing", ✗ on the scenario) so the other side of
  an event isn't forgotten. In a finished file, every entity should be in `lines` or `none` for every event.

## Rules the Sandbox checks

The file **won't import** unless it matches the schema: `v` is 3, the required fields are there, types are valid,
amounts are integers (lines: > 0), and contra accounts name a `contraOf`. The error says where, e.g.
`scenarios[0].events[1].lines.cart[0].amount: Too small: expected number to be >0`.

It **imports with warnings** when (fix these — they're almost always mistakes):

- an id is used twice (entities, scenarios, an entity's accounts, a scenario's events);
- a line or opening balance names an account the entity doesn't have, or an entity that doesn't exist;
- an entity's entry for an event doesn't balance;
- an entity is in both `lines` and `none` for the same event;
- a contra account's `contraOf` isn't one of its entity's accounts.

## Tips for modelling (and for agents writing files)

- **One event, one compound entry per entity.** "Bob cashes out $20, less a $1 fee" is _one_ event: in the wallet's
  books, Dr Wallet: Bob 20 / Cr Cash: FBO 19 / Cr Fee Revenue 1. A later sweep of the fee is a _second_ event.
- **Both sides of an event.** A payment between two entities usually appears in both sets of books, mirrored: one
  entity's asset is the other's liability. If it truly doesn't touch an entity, put that entity in `none`.
- **Money between banks settles through reserves.** A transfer to a customer at another bank: Dr the deposit /
  Cr Reserves at the Federal Reserve in the paying bank; Dr Reserves / Cr the deposit in the receiving bank. A
  transfer between two accounts at the _same_ bank moves no reserves.
- **Accounts are per entity and shared by its scenarios**: define each account once, on its entity, and post to it
  from any scenario.
- **Amounts are cents**, sides are `"dr"` / `"cr"`, and an entry's debits must equal its credits.
- Start from [`sandbox-example.json`](sandbox-example.json) and change it, or export a Sandbox and edit the file.
