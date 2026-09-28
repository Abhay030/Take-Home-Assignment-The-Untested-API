# Bug Report

Found by reading the source, probing the running server, and writing tests that assert
expected behavior. Tests for bugs that were left unfixed are committed as `test.skip`ed
with a pointer back to this report (see `tests/taskService.test.js`, `tests/validators.test.js`
and `tests/tasks.test.js`).

## Summary

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | Pagination is off by one — page 1 skips the first page of tasks | High | **Fixed** |
| 2 | `PATCH /tasks/:id/complete` resets the task's priority to `medium` | High | Open |
| 3 | Status filter matches substrings instead of exact values | Medium | Open |
| 4 | `PUT /tasks/:id` can overwrite the `id` and other internal fields | Medium | Open |
| 5 | Empty-string `status`/`priority` bypass update validation | Medium | Open |
| 6 | Malformed JSON body returns 500 instead of 400 | Low | Open |

## 1. Pagination is off by one — FIXED

- **Where:** `getPaginated()` in `src/services/taskService.js`
- **Expected:** `GET /tasks?page=1&limit=2` returns the first two tasks; page 2 returns tasks 3–4.
- **Actual:** the offset is computed as `page * limit`, so page 1 starts at index `limit`.
  With 3 tasks, `page=1&limit=2` returned only the third task; with 5 tasks and the default
  `limit=10`, the first page was silently empty.
- **How found:** manual probe, then 10 tests across `taskService.getPaginated` and
  `GET /tasks?page=&limit=` that all failed before the fix.
- **Fix:** `const offset = (Math.max(page, 1) - 1) * limit;` — starts page 1 at index 0 and
  clamps invalid page numbers (0, negative) to page 1. All 10 tests now pass.

## 2. Completing a task resets its priority — Open

- **Where:** `completeTask()` in `src/services/taskService.js`
- **Expected:** completing changes `status` and sets `completedAt`; `priority` is untouched.
- **Actual:** `priority: 'medium'` is hard-coded into the updated task, so a `high`-priority
  task silently becomes `medium`.
- **How found:** manual probe (`high` → `medium`), then the failing tests
  `taskService.completeTask > keeps the original priority` and
  `PATCH /tasks/:id/complete > keeps the original priority` (now `test.skip`ed).
- **What a fix would look like:** drop the `priority: 'medium'` line from the object literal.

## 3. Status filter uses substring matching — Open

- **Where:** `getByStatus()` in `src/services/taskService.js`
- **Expected:** `?status=todo` returns only `todo` tasks; partial or unknown values match nothing.
- **Actual:** `t.status.includes(status)` — `?status=o` returns every task (`todo`,
  `in_progress` and `done` all contain "o") and `?status=do` returns `done` tasks.
- **How found:** manual probe, then the failing tests `taskService.getByStatus > does not match
  partial status values` and `GET /tasks?status= > does not match partial status values`
  (now skipped).
- **What a fix would look like:** `tasks.filter((t) => t.status === status)`, and consider
  rejecting unknown statuses with a 400 instead of returning an empty list.

## 4. PUT can overwrite the task id — Open

- **Where:** `update()` in `src/services/taskService.js`
- **Expected:** the id is immutable; the update is either rejected or ignored.
- **Actual:** `{ ...tasks[index], ...fields }` spreads arbitrary fields, so
  `PUT /tasks/:id` with `{"id": "forged-id"}` renames the task — every later request to the
  original id 404s. `createdAt`, `completedAt` and `assignee` can be overwritten the same way.
- **How found:** failing tests `taskService.update > does not allow overwriting the task id`
  and `PUT /tasks/:id > does not allow overwriting the task id` (now skipped).
- **What a fix would look like:** whitelist the mutable fields in `update()` (title,
  description, status, priority, dueDate) instead of spreading the raw input.

## 5. Empty-string status/priority bypass update validation — Open

- **Where:** `validateUpdateTask()` in `src/utils/validators.js`
- **Expected:** `PUT /tasks/:id` with `{"status": ""}` is rejected with 400.
- **Actual:** the guards are `if (body.status && …)` — an empty string is falsy, so validation
  passes and the task's status is stored as `""`, a value no other endpoint or stat counter
  understands.
- **How found:** failing tests `validateUpdateTask > rejects an empty-string status/priority`
  and `PUT /tasks/:id > rejects an empty-string status with 400` (now skipped).
- **What a fix would look like:** check `body.status !== undefined` (and the same for
  priority/dueDate) instead of truthiness.

## 6. Malformed JSON returns 500 instead of 400 — Open

- **Where:** the error handler in `src/app.js`
- **Expected:** a malformed JSON body is a client error and should return 400.
- **Actual:** `express.json()` raises a `SyntaxError` that carries `status: 400`, but the
  handler responds `res.status(500)` for every error, so clients get a 500 for a bad request.
- **How found:** integration test `POST /tasks > malformed JSON gets a JSON error response
  instead of crashing the server` (asserts the current 500 and documents the gap; it also
  proves the server keeps serving requests afterwards).
- **What a fix would look like:** use `err.status || 500` in the handler and keep the generic
  500 body for real server errors.

## Minor observations

- `completeTask()` on an already-done task rewrites `completedAt` instead of being a no-op
  (covered as current behavior: `completing an already-completed task keeps it done`).
- `validateCreateTask(undefined)` throws a `TypeError` rather than returning a message;
  unreachable via the API today (an empty body arrives as `{}`), but fragile if reused.
- Pagination returns a bare array — no `total`/`totalPages` metadata for clients.
- `limit` has no upper bound; a client can request the whole dataset in one page.
- Unknown routes return Express's default HTML 404 instead of a JSON error body.
