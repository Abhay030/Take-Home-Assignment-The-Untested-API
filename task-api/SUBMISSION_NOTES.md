# Submission Notes

**Live demo:** https://task-api-hmrq.onrender.com — quick check: `GET /tasks/stats`.
(Free tier: the service sleeps after ~15 min idle and takes ~30–60s to wake on the next
request; the in-memory store resets on restart, per the assignment's design.)

## Test coverage (Day 1 deliverable)

`npm test` → **111 tests: 101 passed, 10 skipped, 0 failed**.
The 10 skipped tests are the expected-behavior tests for bugs that were found but left
unfixed (each has a comment pointing to the matching entry in `BUG_REPORT.md`).

`npm run coverage` →

```
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |    98.7 |    97.67 |   96.66 |   98.57 |
 src             |   84.61 |       75 |      50 |   84.61 |
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18
 src/routes      |     100 |      100 |     100 |     100 |
  tasks.js       |     100 |      100 |     100 |     100 |
 src/services    |     100 |    94.73 |     100 |     100 |
  taskService.js |     100 |    94.73 |     100 |     100 | 22
 src/utils       |     100 |      100 |     100 |     100 |
  validators.js  |     100 |      100 |     100 |     100 |
```

The only uncovered lines are the `app.listen` block (not executed when the app is
required by tests) and a defensive status-counting branch in `getStats`.

## What I'd test next given more time

- **Fuzz/property tests for the validators** — random payloads (arrays, booleans, deep
  objects, `null` in nested positions) to shake out any remaining crash paths.
- **Pagination boundary math** — every combination of page/limit near zero and near the
  dataset size, and a decision on whether `limit` needs an upper bound.
- **Cross-feature interactions** — update/delete/complete/assign a task while paginating
  and filtering, to catch ordering and staleness issues in the in-memory store.
- **Concurrency** — parallel requests (e.g. two DELETEs or an update racing a complete).
  The store is synchronous in a single Node process, but a load test would confirm no
  surprises when the array is mutated during request handling.
- **Contract/regression tests for response shapes** — assert the full JSON schema of
  every endpoint so clients can rely on it (the `each task has the documented shape`
  test is a start).

## Anything surprising in the codebase

- `getPaginated` computed its offset as `page * limit`, so page 1 started at index
  `limit` — the first page was silently skipped (fixed; see `BUG_REPORT.md` #1).
- `completeTask` hard-codes `priority: 'medium'` onto the task it completes, silently
  downgrading high-priority work (#2).
- The status filter is a substring match — `?status=o` matches every status (#3).
- `PUT` spreads the raw request body onto the task, so callers can overwrite the `id`,
  `createdAt` and `completedAt` (#4).
- Empty strings (`""`) slip past every update validator because the guards check
  truthiness instead of presence (#5).
- Malformed JSON returns a 500 instead of a 400 because the error handler ignores
  `err.status` (#6).

## Questions I'd ask before shipping to production

1. **Persistence** — the store is in-memory and resets on restart. Is that intended for
   production, or should we wire a database (and if so, which)?
2. **Auth** — there are no users or permissions; anyone who can reach the server can
   create/delete everything. What access control model is expected?
3. **Filtering semantics** — should an unknown `?status=` value be a 400 (strict) or an
   empty list (lenient)? Should filters combine with pagination?
4. **Pagination contract** — do clients need `total`/`totalPages` metadata, and is there
   a maximum `limit`?
5. **PUT semantics** — partial update (merge, current behavior) vs. full replacement
   (RFC-style PUT)? This affects how clients send updates.
6. **Assign semantics** — is reassigning (overwriting an existing assignee) acceptable,
   or should it be rejected? Should there be an "unassign" path?
7. **Observability** — the error handler logs full stacks to stdout; do we need
   structured logs, request ids, or metrics before production?
