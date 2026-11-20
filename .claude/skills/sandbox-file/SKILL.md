---
name: sandbox-file
description: Write a Sandbox file (.json) that the course's double-entry Sandbox can import — entities with charts of accounts, and scenarios of events booked in every entity they touch. Use when asked to model a flow, set of transactions, chart of accounts or ledger scenario "in the Sandbox", or to create, fix or check a Sandbox import/export file.
---

# Writing a Sandbox file

The Sandbox imports one JSON file (⋯ Sandbox menu → Import). The format is documented for people and agents in
`public/sandbox-format.md` (served at the site root, next to `llms.txt`) — **read it first**; the JSON Schema is
`public/sandbox.schema.json` and a complete, valid example is `public/sandbox-example.json`.

## Steps

1. **Read** `public/sandbox-format.md`, and start from `public/sandbox-example.json` (or a file the user exported).
2. **Model the entities**: one per set of books (each company, bank, person). Give each its accounts once — `id`,
   `name`, `type` (asset, liability, equity, revenue, expense, dividend, or contra-* with `contraOf`). Entity `code`
   and account `number` are optional; use the user's numbering if they have one — don't invent a convention.
   Accounts can also carry short free-form `tags` (["GL Acct", "review"]) for discussion.
3. **Write the scenarios**: a `title`, a markdown `text` telling the story, each entity's `opening` balances (cents,
   on the account's normal side), and `events` in order.
4. **Book each event in every entity it touches** — `lines[entityId]` is that entity's journal entry: `{ accountId,
   side: "dr" | "cr", amount }`, amounts in **integer cents**, debits = credits. One business event is one compound
   entry per entity. If the event doesn't touch an entity, list it in `none` — every entity should be in `lines` or
   `none` for every event, or the Sandbox flags the missing side.
5. **Check the file** before handing it over:

   ```sh
   SANDBOX_FILE=path/to/file.json npm run check:sandbox
   ```

   It fails with located errors (e.g. `scenarios[0].events[1].lines.zap[0].amount: …`) if the file wouldn't import,
   and with warnings for likely mistakes (unknown accounts, unbalanced entries, a side neither posted nor `none`).
   Fix them until it passes.
6. Tell the user where the file is and to open it with **⋯ Sandbox menu → Import**.

## Accounting reminders

- Assets, expenses and dividends increase with a **debit**; liabilities, equity and revenue with a **credit**
  (contras the opposite of their parent).
- A payment between entities is mirrored: one entity's asset is the other's liability.
- Money moving to another bank settles through **Reserves at the Federal Reserve** in both banks; between two
  accounts at the same bank, no reserves move.
