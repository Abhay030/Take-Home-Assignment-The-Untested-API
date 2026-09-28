const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

const createTask = (overrides = {}) =>
  request(app)
    .post('/tasks')
    .send({ title: 'Sample task', ...overrides })
    .expect(201)
    .then((res) => res.body);

describe('GET /tasks', () => {
  beforeEach(() => taskService._reset());

  test('returns an empty list when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns every task in creation order', async () => {
    await createTask({ title: 'first' });
    await createTask({ title: 'second' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(['first', 'second']);
  });

  test('each task has the documented shape', async () => {
    const created = await createTask({ title: 'shape' });
    expect(created).toEqual({
      id: expect.any(String),
      title: 'shape',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
      createdAt: expect.any(String),
    });
    const listed = await request(app).get('/tasks');
    expect(listed.body).toEqual([created]);
  });
});

describe('GET /tasks?status=', () => {
  beforeEach(async () => {
    taskService._reset();
    await createTask({ title: 'todo one', status: 'todo' });
    await createTask({ title: 'progress two', status: 'in_progress' });
    await createTask({ title: 'done three', status: 'done' });
  });

  test('returns only tasks with the requested status', async () => {
    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(['todo one']);
  });

  test('returns an empty list when no task matches', async () => {
    const res = await request(app).get('/tasks?status=archived');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Documents bug #3 (BUG_REPORT.md): the filter uses substring matching, so
  // a partial value like "o" matches every status. Skipped until fixed.
  test.skip('does not match partial status values', async () => {
    const res = await request(app).get('/tasks?status=o');
    expect(res.body).toEqual([]);
  });
});

describe('GET /tasks?page=&limit=', () => {
  beforeEach(async () => {
    taskService._reset();
    for (let i = 1; i <= 5; i++) await createTask({ title: 'task ' + i });
  });

  test('page 1 limit 2 returns the first two tasks', async () => {
    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(['task 1', 'task 2']);
  });

  test('page 2 limit 2 returns tasks 3 and 4', async () => {
    const res = await request(app).get('/tasks?page=2&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['task 3', 'task 4']);
  });

  test('a page past the end returns an empty list', async () => {
    const res = await request(app).get('/tasks?page=9&limit=2');
    expect(res.body).toEqual([]);
  });

  test('non-numeric page and limit fall back to defaults', async () => {
    const res = await request(app).get('/tasks?page=abc&limit=xyz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  test('page 0 falls back to page 1', async () => {
    const res = await request(app).get('/tasks?page=0&limit=1');
    expect(res.body.map((t) => t.title)).toEqual(['task 1']);
  });

  test('limit 0 falls back to the default limit', async () => {
    const res = await request(app).get('/tasks?limit=0');
    expect(res.body).toHaveLength(5);
  });
});

describe('POST /tasks', () => {
  beforeEach(() => taskService._reset());

  test('creates a task with defaults when only title is sent', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(res.body.id).toEqual(expect.any(String));
  });

  test('creates a task with every field provided', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({
        title: 'Full',
        description: 'd',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-01T10:00:00.000Z',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-12-01T10:00:00.000Z',
    });
  });

  test('rejects a missing title with 400', async () => {
    const res = await request(app).post('/tasks').send({ description: 'no title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  test('rejects a whitespace-only title with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  test('rejects a non-string title with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 42 });
    expect(res.status).toBe(400);
  });

  test('rejects an invalid status with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x', status: 'blocked' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });

  test('rejects an invalid priority with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x', priority: 'urgent' });
    expect(res.status).toBe(400);
  });

  test('rejects an invalid dueDate with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  test('ignores unknown fields', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'x', foo: 'bar', completedAt: '2020-01-01T00:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body.foo).toBeUndefined();
    expect(res.body.completedAt).toBeNull();
  });

  test('returns 400 when no body is sent', async () => {
    const res = await request(app).post('/tasks').set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  test('malformed JSON gets a JSON error response instead of crashing the server', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": broken');
    // NOTE: documents bug #6 (BUG_REPORT.md) — this should be a 400, it is currently a 500.
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    const after = await request(app).get('/tasks');
    expect(after.status).toBe(200);
  });
});

describe('PUT /tasks/:id', () => {
  let task;

  beforeEach(async () => {
    taskService._reset();
    task = await createTask({ title: 'original', status: 'todo', priority: 'low', description: 'desc' });
  });

  test('updates the provided fields and keeps the rest', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'renamed', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: task.id,
      title: 'renamed',
      priority: 'high',
      status: 'todo',
      description: 'desc',
    });
    const listed = await request(app).get('/tasks');
    expect(listed.body[0].title).toBe('renamed');
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Task not found' });
  });

  test('rejects an invalid status with 400', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ status: 'blocked' });
    expect(res.status).toBe(400);
  });

  test('rejects an invalid priority with 400', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ priority: 'urgent' });
    expect(res.status).toBe(400);
  });

  test('rejects an invalid dueDate with 400', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  test('rejects a blank title with 400', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });

  test('an empty body returns the task unchanged', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(task);
  });

  // Documents bug #4 (BUG_REPORT.md): update spreads arbitrary fields, so the
  // id (and other internal fields) can be overwritten. Skipped until fixed.
  test.skip('does not allow overwriting the task id', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ id: 'forged-id' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(task.id);
    const listed = await request(app).get('/tasks');
    expect(listed.body[0].id).toBe(task.id);
  });

  // Documents bug #5 (BUG_REPORT.md): an empty-string status bypasses
  // validation and corrupts the task. Skipped until fixed.
  test.skip('rejects an empty-string status with 400', async () => {
    const res = await request(app).put(`/tasks/${task.id}`).send({ status: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  let task;

  beforeEach(async () => {
    taskService._reset();
    task = await createTask({ title: 'doomed' });
  });

  test('deletes the task and returns 204', async () => {
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
    const listed = await request(app).get('/tasks');
    expect(listed.body).toEqual([]);
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Task not found' });
  });

  test('deleting twice returns 404 the second time', async () => {
    await request(app).delete(`/tasks/${task.id}`).expect(204);
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  let task;

  beforeEach(async () => {
    taskService._reset();
    task = await createTask({ title: 'finish me', status: 'in_progress' });
  });

  test('marks the task done and sets completedAt', async () => {
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(new Date(res.body.completedAt).toISOString()).toBe(res.body.completedAt);
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/complete');
    expect(res.status).toBe(404);
  });

  // Documents bug #2 (BUG_REPORT.md): completing a task resets its priority.
  test.skip('keeps the original priority', async () => {
    const high = await createTask({ title: 'high prio', priority: 'high' });
    const res = await request(app).patch(`/tasks/${high.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  test('completing an already-completed task keeps it done', async () => {
    await request(app).patch(`/tasks/${task.id}/complete`).expect(200);
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });
});

describe('GET /tasks/stats', () => {
  beforeEach(() => taskService._reset());

  test('returns all zeros when there are no tasks', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks per status', async () => {
    await createTask({ title: 'a', status: 'todo' });
    await createTask({ title: 'b', status: 'in_progress' });
    await createTask({ title: 'c', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 0 });
  });

  test('counts overdue tasks (past dueDate, not done)', async () => {
    await createTask({ title: 'late', status: 'in_progress', dueDate: '2020-01-01T00:00:00.000Z' });
    await createTask({ title: 'done late', status: 'done', dueDate: '2020-01-01T00:00:00.000Z' });
    const res = await request(app).get('/tasks/stats');
    expect(res.body.overdue).toBe(1);
  });
});
