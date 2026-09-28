const taskService = require('../src/services/taskService');

describe('taskService.create', () => {
  beforeEach(() => taskService._reset());

  test('creates a task with defaults when only title is given', () => {
    const task = taskService.create({ title: 'Write tests' });
    expect(task).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(task.id).toEqual(expect.any(String));
    expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
  });

  test('accepts all custom fields', () => {
    const task = taskService.create({
      title: 'Fix bugs',
      description: 'urgent',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-10-01T10:00:00.000Z',
    });
    expect(task).toMatchObject({
      description: 'urgent',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-10-01T10:00:00.000Z',
    });
  });

  test('generates a unique id per task', () => {
    const a = taskService.create({ title: 'a' });
    const b = taskService.create({ title: 'b' });
    expect(a.id).not.toBe(b.id);
  });

  test('ignores unknown fields', () => {
    const task = taskService.create({ title: 'x', completedAt: '2020-01-01T00:00:00.000Z' });
    expect(task.completedAt).toBeNull();
  });
});

describe('taskService.getAll', () => {
  beforeEach(() => taskService._reset());

  test('returns an empty array when there are no tasks', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  test('returns every task in creation order', () => {
    taskService.create({ title: 'first' });
    taskService.create({ title: 'second' });
    expect(taskService.getAll().map((t) => t.title)).toEqual(['first', 'second']);
  });

  test('returns a copy of the internal list', () => {
    taskService.create({ title: 'x' });
    const result = taskService.getAll();
    result.length = 0;
    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe('taskService.findById', () => {
  beforeEach(() => taskService._reset());

  test('returns the matching task', () => {
    const created = taskService.create({ title: 'find me' });
    expect(taskService.findById(created.id)).toBe(created);
  });

  test('returns undefined for an unknown id', () => {
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('taskService.getByStatus', () => {
  beforeEach(() => {
    taskService._reset();
    taskService.create({ title: 'one', status: 'todo' });
    taskService.create({ title: 'two', status: 'in_progress' });
    taskService.create({ title: 'three', status: 'done' });
  });

  test('returns only tasks with the exact matching status', () => {
    expect(taskService.getByStatus('todo').map((t) => t.title)).toEqual(['one']);
    expect(taskService.getByStatus('in_progress').map((t) => t.title)).toEqual(['two']);
  });

  test('returns an empty list when no task has the status', () => {
    expect(taskService.getByStatus('archived')).toEqual([]);
  });

  // Documents bug #3 (BUG_REPORT.md): filtering uses substring matching, so a
  // partial value like "do" matches "done". Skipped until it is fixed.
  test.skip('does not match partial status values', () => {
    expect(taskService.getByStatus('do')).toEqual([]);
  });
});

describe('taskService.getPaginated', () => {
  beforeEach(() => {
    taskService._reset();
    for (let i = 1; i <= 5; i++) taskService.create({ title: 'task ' + i });
  });

  test('page 1 with limit 2 returns the first two tasks', () => {
    expect(taskService.getPaginated(1, 2).map((t) => t.title)).toEqual(['task 1', 'task 2']);
  });

  test('page 2 with limit 2 returns tasks 3 and 4', () => {
    expect(taskService.getPaginated(2, 2).map((t) => t.title)).toEqual(['task 3', 'task 4']);
  });

  test('page 3 with limit 2 returns the last task', () => {
    expect(taskService.getPaginated(3, 2).map((t) => t.title)).toEqual(['task 5']);
  });

  test('a page past the end returns an empty list', () => {
    expect(taskService.getPaginated(10, 2)).toEqual([]);
  });

  test('a limit larger than the list returns everything from the page on', () => {
    expect(taskService.getPaginated(1, 100)).toHaveLength(5);
  });

  test('negative page numbers are treated as page 1', () => {
    expect(taskService.getPaginated(-1, 2).map((t) => t.title)).toEqual(['task 1', 'task 2']);
  });

  test('returns a copy of the internal list', () => {
    const page = taskService.getPaginated(1, 2);
    page.length = 0;
    expect(taskService.getAll()).toHaveLength(5);
  });
});

describe('taskService.getStats', () => {
  beforeEach(() => taskService._reset());

  test('returns all zero counts when there are no tasks', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks per status', () => {
    taskService.create({ title: 'a', status: 'todo' });
    taskService.create({ title: 'b', status: 'todo' });
    taskService.create({ title: 'c', status: 'in_progress' });
    taskService.create({ title: 'd', status: 'done' });
    expect(taskService.getStats()).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 0 });
  });

  test('counts tasks whose dueDate is in the past and not done as overdue', () => {
    taskService.create({ title: 'late todo', status: 'todo', dueDate: '2020-01-01T00:00:00.000Z' });
    taskService.create({ title: 'late in progress', status: 'in_progress', dueDate: '2020-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(2);
  });

  test('does not count done tasks with a past dueDate as overdue', () => {
    taskService.create({ title: 'finished late', status: 'done', dueDate: '2020-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(0);
  });

  test('does not count future dueDates or missing dueDates as overdue', () => {
    taskService.create({ title: 'future', status: 'todo', dueDate: '2999-01-01T00:00:00.000Z' });
    taskService.create({ title: 'no date', status: 'todo' });
    expect(taskService.getStats().overdue).toBe(0);
  });
});

describe('taskService.update', () => {
  let task;

  beforeEach(() => {
    taskService._reset();
    task = taskService.create({ title: 'original', status: 'todo', priority: 'low', description: 'desc' });
  });

  test('updates the given fields and keeps the rest', () => {
    const updated = taskService.update(task.id, { title: 'renamed', priority: 'high' });
    expect(updated).toMatchObject({ title: 'renamed', priority: 'high', status: 'todo', description: 'desc' });
    expect(taskService.findById(task.id).title).toBe('renamed');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  // Documents bug #4 (BUG_REPORT.md): update spreads arbitrary fields, so the
  // id (and other internal fields) can be overwritten. Skipped until fixed.
  test.skip('does not allow overwriting the task id', () => {
    const updated = taskService.update(task.id, { id: 'forged-id' });
    expect(updated.id).toBe(task.id);
    expect(taskService.findById(task.id).id).toBe(task.id);
  });
});

describe('taskService.remove', () => {
  beforeEach(() => taskService._reset());

  test('removes the task and returns true', () => {
    const task = taskService.create({ title: 'x' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  test('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('taskService.completeTask', () => {
  beforeEach(() => taskService._reset());

  test('marks the task done and sets completedAt to a valid ISO timestamp', () => {
    const task = taskService.create({ title: 'x', status: 'in_progress' });
    const completed = taskService.completeTask(task.id);
    expect(completed.status).toBe('done');
    expect(new Date(completed.completedAt).toISOString()).toBe(completed.completedAt);
    expect(taskService.findById(task.id).status).toBe('done');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });

  // Documents bug #2 (BUG_REPORT.md): completing a task silently resets its
  // priority to medium. Skipped until fixed.
  test.skip('keeps the original priority', () => {
    const task = taskService.create({ title: 'x', priority: 'high' });
    expect(taskService.completeTask(task.id).priority).toBe('high');
  });
});
