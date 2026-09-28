const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../src/utils/validators');

describe('validateCreateTask', () => {
  test('accepts a valid minimal task', () => {
    expect(validateCreateTask({ title: 'Valid' })).toBeNull();
  });

  test('accepts a valid full task', () => {
    expect(
      validateCreateTask({
        title: 'Valid',
        description: 'desc',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-10-01T10:00:00.000Z',
      })
    ).toBeNull();
  });

  test('rejects a missing title', () => {
    expect(validateCreateTask({})).toMatch(/title is required/);
  });

  test('rejects a null title', () => {
    expect(validateCreateTask({ title: null })).toMatch(/title is required/);
  });

  test('rejects a blank or whitespace-only title', () => {
    expect(validateCreateTask({ title: '   ' })).toMatch(/title is required/);
  });

  test('rejects a non-string title', () => {
    expect(validateCreateTask({ title: 42 })).toMatch(/title is required/);
  });

  test('rejects an invalid status', () => {
    expect(validateCreateTask({ title: 'x', status: 'blocked' })).toMatch(/status must be one of/);
  });

  test('rejects an invalid priority', () => {
    expect(validateCreateTask({ title: 'x', priority: 'urgent' })).toMatch(/priority must be one of/);
  });

  test('rejects an invalid dueDate', () => {
    expect(validateCreateTask({ title: 'x', dueDate: 'not-a-date' })).toMatch(/dueDate must be a valid ISO date/);
  });

  test('accepts an empty-string status (create applies the default)', () => {
    expect(validateCreateTask({ title: 'x', status: '' })).toBeNull();
  });

  // Documents bug #6 (BUG_REPORT.md): a missing body crashes the validator
  // instead of returning a validation error. Skipped until fixed.
  test.skip('handles a missing body without throwing', () => {
    expect(() => validateCreateTask(undefined)).not.toThrow();
  });
});

describe('validateUpdateTask', () => {
  test('accepts an empty body (no fields to update)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  test('accepts valid fields', () => {
    expect(
      validateUpdateTask({ title: 'x', status: 'done', priority: 'low', dueDate: null })
    ).toBeNull();
  });

  test('rejects a non-string title', () => {
    expect(validateUpdateTask({ title: 7 })).toMatch(/title must be a non-empty string/);
  });

  test('rejects a blank title', () => {
    expect(validateUpdateTask({ title: '  ' })).toMatch(/title must be a non-empty string/);
  });

  test('rejects an invalid status', () => {
    expect(validateUpdateTask({ status: 'archived' })).toMatch(/status must be one of/);
  });

  test('rejects an invalid priority', () => {
    expect(validateUpdateTask({ priority: 'top' })).toMatch(/priority must be one of/);
  });

  test('rejects an invalid dueDate', () => {
    expect(validateUpdateTask({ dueDate: 'tomorrow' })).toMatch(/dueDate must be a valid ISO date/);
  });

  // Documents bug #5 (BUG_REPORT.md): empty strings bypass validation because
  // of the falsy checks, so the update stores an invalid status. Skipped until fixed.
  test.skip('rejects an empty-string status', () => {
    expect(validateUpdateTask({ status: '' })).toMatch(/status must be one of/);
  });

  test.skip('rejects an empty-string priority', () => {
    expect(validateUpdateTask({ priority: '' })).toMatch(/priority must be one of/);
  });
});

describe('validateAssignTask', () => {
  test('accepts a non-empty string assignee', () => {
    expect(validateAssignTask({ assignee: 'Gungun' })).toBeNull();
  });

  test('rejects a missing assignee', () => {
    expect(validateAssignTask({})).toMatch(/assignee must be a non-empty string/);
  });

  test('rejects a missing body', () => {
    expect(validateAssignTask(undefined)).toMatch(/assignee must be a non-empty string/);
  });

  test('rejects an empty or whitespace-only assignee', () => {
    expect(validateAssignTask({ assignee: '' })).toMatch(/assignee must be a non-empty string/);
    expect(validateAssignTask({ assignee: '   ' })).toMatch(/assignee must be a non-empty string/);
  });

  test('rejects a non-string assignee', () => {
    expect(validateAssignTask({ assignee: 42 })).toMatch(/assignee must be a non-empty string/);
  });
});
