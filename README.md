# Deal Desk Agent (practice repo)

A small sales operations app for approving discounts on deals. When a rep
(or an AI assistant helping them) proposes a discount, a policy decides whether
it can be approved automatically or has to wait for a manager, VP or finance
reviewer.

This is a **practice repo for a timed build exercise**. It contains a bug and a
feature request to work on, written the way a business stakeholder would write
them. Everything runs locally, with no database and no API keys.

## Run it

```bash
# terminal 1: API on http://localhost:4000
cd backend
npm install
npm run dev

# terminal 2: UI on http://localhost:5173
cd frontend
npm install
npm run dev
```

Run the backend tests with `cd backend && npm test`.

## What is in here

```
backend/src
  seed.ts                 sample deals and the default policy
  store.ts                in memory data store (resets on restart)
  routes.ts               URL to controller mapping
  controllers/            thin HTTP handlers
  services/
    dealService.ts        propose, approve, reject, list
    approvalEngine.ts     decides auto approve vs needs approval
    policyService.ts      reads and updates the policy
  ai/llmClient.ts         stand in for a model call (used by ticket 03)
backend/tests             Vitest unit tests for the services
frontend/src              React app: approval queue and policy screen
tickets/                  the work to do
```

## The policy rules

A deal needs an approver based on its list amount and the requested discount:

| Condition | Who must approve |
| --- | --- |
| Deal amount above the finance limit AND discount above the manager threshold | Finance |
| Discount above the VP threshold | VP |
| Discount above the manager threshold | Manager |
| Otherwise | Nobody, auto approved |

Defaults: manager above 10%, VP above 25%, finance for deals above $100,000.
"Above" means strictly greater than.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | /api/deals?status= | List deals, optionally by status |
| GET | /api/deals/:id | One deal |
| POST | /api/deals/:id/propose-discount | Body `{ discountPct }`, runs the policy |
| POST | /api/deals/:id/approve | Body `{ approver, comment? }` |
| POST | /api/deals/:id/reject | Body `{ approver, comment? }` |
| GET | /api/policy | Current policy |
| PUT | /api/policy | Update any of the three thresholds |

Deal statuses: `draft`, `pending_approval`, `approved`, `rejected`.

## How to practice

Treat this like the real exercise.

1. **Plan (15 min):** read the tickets, run the app and the tests, trace one
   request from route to store. Write a short plan or spec.
2. **Build (90 min):** do ticket 01 (the bug) first, then ticket 02 (the
   feature). Ticket 03 is optional. Use an AI coding agent as much as you like.
3. **Review (45 min):** explain your work out loud, as if two engineers were in
   the room. For every change, cover: why this design, what could go wrong,
   and the business case.

Tips:

- All the existing tests pass today. That does not mean the app is free of bugs.
- Reproduce the problem before you change anything.
- Write a test that fails for the bug, then make it pass.
- Keep a short decision log as you go. It becomes your review script.
- Some details in the tickets are vague on purpose. Decide what to assume,
  write the assumption down, or note what you would ask the stakeholder.
