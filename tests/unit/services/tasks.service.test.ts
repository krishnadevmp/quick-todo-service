import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '../../mocks/prisma';

vi.mock('../../../src/lib/prisma', () => ({ prisma: prismaMock }));

import * as tasksService from '../../../src/services/tasks.service';

const USER = 'user-1';
const NOW = new Date('2026-08-16T12:00:00.000Z'); // a Sunday

function tagRelation(name: string, tagId = `tag-${name}`) {
  return { taskId: 'irrelevant', tagId, tag: { id: tagId, userId: USER, name, createdAt: NOW, updatedAt: NOW } };
}

function fakeTaskRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task-1',
    userId: USER,
    title: 'Buy milk',
    description: null,
    priority: 'none',
    category: null,
    status: 'todo',
    dueDate: null,
    dueTime: null,
    reminderOffset: 'none',
    recurring: 'none',
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    deletedAt: null,
    recurringParentId: null,
    taskTags: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── listTasks ────────────────────────────────────────────────────────────

describe('tasksService.listTasks', () => {
  const baseFilter = { tags: [] as string[], sortBy: 'createdAt' as const, sortDir: 'desc' as const };

  it('scopes the query to the user and excludes soft-deleted rows', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    await tasksService.listTasks(USER, baseFilter);
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER, deletedAt: null });
  });

  it('adds priority/category to the where clause when present', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    await tasksService.listTasks(USER, { ...baseFilter, priority: 'high', category: 'work' });
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ priority: 'high', category: 'work' });
  });

  it('requires every listed tag to be present (AND, not OR)', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    await tasksService.listTasks(USER, { ...baseFilter, tags: ['work', 'urgent'] });
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      { taskTags: { some: { tag: { name: 'work' } } } },
      { taskTags: { some: { tag: { name: 'urgent' } } } },
    ]);
  });

  it('searches title and description case-insensitively', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    await tasksService.listTasks(USER, { ...baseFilter, search: 'groc' });
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([
      { title: { contains: 'groc', mode: 'insensitive' } },
      { description: { contains: 'groc', mode: 'insensitive' } },
    ]);
  });

  it('sorts by priority rank (high > medium > low > none) regardless of insertion order', async () => {
    prismaMock.task.findMany.mockResolvedValue([
      fakeTaskRow({ id: 'a', priority: 'none' }),
      fakeTaskRow({ id: 'b', priority: 'high' }),
      fakeTaskRow({ id: 'c', priority: 'low' }),
      fakeTaskRow({ id: 'd', priority: 'medium' }),
    ]);
    const result = await tasksService.listTasks(USER, { ...baseFilter, sortBy: 'priority', sortDir: 'asc' });
    expect(result.map((t) => t.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('sorts by dueDate with tasks that have no due date pushed to the end', async () => {
    prismaMock.task.findMany.mockResolvedValue([
      fakeTaskRow({ id: 'no-date', dueDate: null }),
      fakeTaskRow({ id: 'later', dueDate: new Date('2026-09-01T00:00:00.000Z') }),
      fakeTaskRow({ id: 'sooner', dueDate: new Date('2026-08-20T00:00:00.000Z') }),
    ]);
    const result = await tasksService.listTasks(USER, { ...baseFilter, sortBy: 'dueDate', sortDir: 'asc' });
    expect(result.map((t) => t.id)).toEqual(['sooner', 'later', 'no-date']);
  });

  it('sorts by createdAt descending by default', async () => {
    prismaMock.task.findMany.mockResolvedValue([
      fakeTaskRow({ id: 'older', createdAt: new Date('2026-08-01T00:00:00.000Z') }),
      fakeTaskRow({ id: 'newer', createdAt: new Date('2026-08-15T00:00:00.000Z') }),
    ]);
    const result = await tasksService.listTasks(USER, baseFilter);
    expect(result.map((t) => t.id)).toEqual(['newer', 'older']);
  });
});

// ── today / overdue / upcoming ──────────────────────────────────────────

describe('tasksService.getToday / getOverdue / getUpcoming', () => {
  it('getToday queries for dueDate == today and status != done', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    await tasksService.getToday(USER);
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where.dueDate).toEqual(new Date('2026-08-16T00:00:00.000Z'));
    expect(args.where.status).toEqual({ not: 'done' });
  });

  it('getOverdue queries for dueDate < today and status != done', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    await tasksService.getOverdue(USER);
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where.dueDate).toEqual({ lt: new Date('2026-08-16T00:00:00.000Z') });
  });

  it('getUpcoming returns both overdue and upcoming, upcoming excluding today itself', async () => {
    prismaMock.task.findMany
      .mockResolvedValueOnce([fakeTaskRow({ id: 'upcoming-1' })]) // the upcoming query (first call)
      .mockResolvedValueOnce([fakeTaskRow({ id: 'overdue-1' })]); // getOverdue's internal query (second call)

    const result = await tasksService.getUpcoming(USER, 7);

    expect(result.upcoming.map((t) => t.id)).toEqual(['upcoming-1']);
    expect(result.overdue.map((t) => t.id)).toEqual(['overdue-1']);

    const upcomingArgs = prismaMock.task.findMany.mock.calls[0][0];
    expect(upcomingArgs.where.dueDate).toEqual({
      gt: new Date('2026-08-16T00:00:00.000Z'),
      lte: new Date('2026-08-23T00:00:00.000Z'),
    });
  });
});

// ── getTaskById ──────────────────────────────────────────────────────────

describe('tasksService.getTaskById', () => {
  it('throws 404 when missing, deleted, or owned by another user', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(tasksService.getTaskById(USER, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

// ── createTask ───────────────────────────────────────────────────────────

describe('tasksService.createTask', () => {
  it('creates without touching tags when none are given', async () => {
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());
    await tasksService.createTask(USER, {
      title: 'Buy milk',
      priority: 'none',
      status: 'todo',
      reminderOffset: 'none',
      recurring: 'none',
      tags: [],
    });
    expect(prismaMock.tag.upsert).not.toHaveBeenCalled();
    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data.taskTags).toEqual({ create: [] });
  });

  it('find-or-creates each tag and links the task to the resulting ids', async () => {
    prismaMock.tag.upsert.mockImplementation(async ({ where }: any) => ({ id: `tag-${where.userId_name.name}` }));
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());

    await tasksService.createTask(USER, {
      title: 'Buy milk',
      priority: 'none',
      status: 'todo',
      reminderOffset: 'none',
      recurring: 'none',
      tags: ['groceries', 'urgent'],
    });

    expect(prismaMock.tag.upsert).toHaveBeenCalledTimes(2);
    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data.taskTags).toEqual({ create: [{ tagId: 'tag-groceries' }, { tagId: 'tag-urgent' }] });
  });

  it('deduplicates repeated tag names before syncing', async () => {
    prismaMock.tag.upsert.mockResolvedValue({ id: 'tag-work' });
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());

    await tasksService.createTask(USER, {
      title: 'x',
      priority: 'none',
      status: 'todo',
      reminderOffset: 'none',
      recurring: 'none',
      tags: ['work', 'work'],
    });

    expect(prismaMock.tag.upsert).toHaveBeenCalledTimes(1);
  });
});

// ── updateTask ───────────────────────────────────────────────────────────

describe('tasksService.updateTask', () => {
  it('throws 404 before writing anything when the task is not owned', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(tasksService.updateTask(USER, 'nope', { title: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('leaves existing tags alone when tags is omitted from the patch', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow());
    prismaMock.task.update.mockResolvedValue(fakeTaskRow({ title: 'Buy oat milk' }));

    await tasksService.updateTask(USER, 'task-1', { title: 'Buy oat milk' });

    const args = prismaMock.task.update.mock.calls[0][0];
    expect(args.data.taskTags).toBeUndefined();
  });

  it('replaces the full tag set when tags is provided', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow());
    prismaMock.tag.upsert.mockResolvedValue({ id: 'tag-new' });
    prismaMock.task.update.mockResolvedValue(fakeTaskRow());

    await tasksService.updateTask(USER, 'task-1', { tags: ['new'] });

    const args = prismaMock.task.update.mock.calls[0][0];
    expect(args.data.taskTags).toEqual({ deleteMany: {}, create: [{ tagId: 'tag-new' }] });
  });
});

// ── completeTask ─────────────────────────────────────────────────────────

describe('tasksService.completeTask', () => {
  it('throws 404 when the task is not owned', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(tasksService.completeTask(USER, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('is idempotent: completing an already-done task spawns nothing and writes nothing', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow({ status: 'done' }));

    const result = await tasksService.completeTask(USER, 'task-1');

    expect(result.nextTask).toBeUndefined();
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it('uses a conditional updateMany (not an interactive transaction) for the idempotency guard, and reports a lost race as already-done', async () => {
    // First read sees it as pending, but the write loses a race with another
    // completion in between — updateMany's WHERE (status != 'done') matches
    // nothing, so count is 0. This is the pooler-safe replacement for what
    // used to be a Prisma interactive transaction — see the comment on
    // completeTask for why interactive transactions don't work against
    // Supabase's transaction-mode pooler.
    prismaMock.task.findFirst
      .mockResolvedValueOnce(fakeTaskRow({ status: 'todo' })) // initial read
      .mockResolvedValueOnce(fakeTaskRow({ status: 'done', completedAt: NOW })); // refetch after losing the race
    prismaMock.task.updateMany.mockResolvedValue({ count: 0 });

    const result = await tasksService.completeTask(USER, 'task-1');

    expect(result.task.status).toBe('done');
    expect(result.nextTask).toBeUndefined();
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it('marks a non-recurring task done without spawning a next occurrence', async () => {
    prismaMock.task.findFirst
      .mockResolvedValueOnce(fakeTaskRow({ recurring: 'none', status: 'todo' }))
      .mockResolvedValueOnce(fakeTaskRow({ recurring: 'none', status: 'done', completedAt: NOW }));
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

    const result = await tasksService.completeTask(USER, 'task-1');

    expect(result.task.status).toBe('done');
    expect(result.nextTask).toBeUndefined();
    expect(prismaMock.task.create).not.toHaveBeenCalled();

    const updateManyArgs = prismaMock.task.updateMany.mock.calls[0][0];
    expect(updateManyArgs.where).toEqual({ id: 'task-1', status: { not: 'done' } });
    expect(updateManyArgs.data.status).toBe('done');
  });

  it('spawns the next occurrence for a recurring task, carrying over tags and computing the next due date', async () => {
    const original = fakeTaskRow({
      recurring: 'daily',
      status: 'todo',
      dueDate: new Date('2026-08-16T00:00:00.000Z'),
      taskTags: [tagRelation('routine')],
    });
    prismaMock.task.findFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce({ ...original, status: 'done', completedAt: NOW });
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.task.create.mockResolvedValue(
      fakeTaskRow({ id: 'task-2', dueDate: new Date('2026-08-17T00:00:00.000Z'), recurringParentId: 'task-1' })
    );

    const result = await tasksService.completeTask(USER, 'task-1');

    expect(result.nextTask).toBeDefined();
    const createArgs = prismaMock.task.create.mock.calls[0][0];
    expect(createArgs.data.dueDate).toEqual(new Date('2026-08-17T00:00:00.000Z'));
    expect(createArgs.data.status).toBe('todo');
    expect(createArgs.data.recurringParentId).toBe('task-1'); // root task is its own parent
    expect(createArgs.data.taskTags).toEqual({ create: [{ tagId: 'tag-routine' }] });
  });

  it('chains recurringParentId to the series root, not to the immediately-completed instance', async () => {
    const secondInSeries = fakeTaskRow({
      id: 'task-2',
      recurring: 'daily',
      status: 'todo',
      recurringParentId: 'task-1', // task-1 is the original series root
      dueDate: new Date('2026-08-17T00:00:00.000Z'),
    });
    prismaMock.task.findFirst
      .mockResolvedValueOnce(secondInSeries)
      .mockResolvedValueOnce({ ...secondInSeries, status: 'done' });
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.task.create.mockResolvedValue(fakeTaskRow({ id: 'task-3' }));

    await tasksService.completeTask(USER, 'task-2');

    const createArgs = prismaMock.task.create.mock.calls[0][0];
    expect(createArgs.data.recurringParentId).toBe('task-1');
  });
});

// ── deleteTask ───────────────────────────────────────────────────────────

describe('tasksService.deleteTask', () => {
  it('soft-deletes by setting deletedAt', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow());
    await tasksService.deleteTask(USER, 'task-1');
    const args = prismaMock.task.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'task-1' });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });

  it('throws 404 for a task that is not owned', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(tasksService.deleteTask(USER, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

// ── stopRecurring ────────────────────────────────────────────────────────

describe('tasksService.stopRecurring', () => {
  it('updates the task and its pending siblings in a single round trip', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow({ id: 'task-1', recurring: 'daily', recurringParentId: null }));
    prismaMock.task.updateMany.mockResolvedValue({ count: 3 });

    await tasksService.stopRecurring(USER, 'task-1');

    expect(prismaMock.task.updateMany).toHaveBeenCalledTimes(1); // no separate per-row update call
    expect(prismaMock.task.update).not.toHaveBeenCalled();

    const args = prismaMock.task.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      userId: USER,
      deletedAt: null,
      OR: [
        { id: 'task-1' }, // self, unconditionally (regardless of its own status)
        { recurringParentId: 'task-1', id: { not: 'task-1' }, status: { not: 'done' } }, // pending siblings only
      ],
    });
    expect(args.data).toEqual({ recurring: 'none' });
  });
});

// ── updateSeries ─────────────────────────────────────────────────────────

describe('tasksService.updateSeries', () => {
  it('patches scalar fields for the task + pending siblings in one round trip when tags are unchanged', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow({ id: 'task-1', recurringParentId: null }));
    prismaMock.task.updateMany.mockResolvedValue({ count: 3 });

    await tasksService.updateSeries(USER, 'task-1', { priority: 'high' });

    expect(prismaMock.task.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.findMany).not.toHaveBeenCalled(); // no need to look up sibling ids individually
    expect(prismaMock.task.update).not.toHaveBeenCalled(); // no per-row writes needed

    const args = prismaMock.task.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      userId: USER,
      deletedAt: null,
      OR: [{ id: 'task-1' }, { recurringParentId: 'task-1', id: { not: 'task-1' }, status: { not: 'done' } }],
    });
    expect(args.data.priority).toBe('high');
  });

  it('excludes dueDate/status/completedAt from what it can change (not accepted by the schema layer, but verify the service never writes them)', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow({ id: 'task-1' }));
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

    await tasksService.updateSeries(USER, 'task-1', { priority: 'low' });

    const args = prismaMock.task.updateMany.mock.calls[0][0];
    expect(args.data).not.toHaveProperty('dueDate');
    expect(args.data).not.toHaveProperty('status');
    expect(args.data).not.toHaveProperty('completedAt');
  });

  it('only touches tag relations per-row (and only fetches targets) when tags actually change', async () => {
    prismaMock.task.findFirst.mockResolvedValue(fakeTaskRow({ id: 'task-1', recurringParentId: null }));
    prismaMock.task.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.task.findMany.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);
    prismaMock.tag.upsert.mockResolvedValue({ id: 'tag-new' });
    prismaMock.task.update.mockResolvedValue(fakeTaskRow());

    await tasksService.updateSeries(USER, 'task-1', { tags: ['new'] });

    // Scalar patch still happens in one round trip...
    expect(prismaMock.task.updateMany).toHaveBeenCalledTimes(1);
    // ...but relation writes need a row each — once per target found.
    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.update).toHaveBeenCalledTimes(2);
    for (const call of prismaMock.task.update.mock.calls) {
      expect(call[0].data).toEqual({ taskTags: { deleteMany: {}, create: [{ tagId: 'tag-new' }] } });
    }
  });
});

// ── clearCompleted ───────────────────────────────────────────────────────

describe('tasksService.clearCompleted', () => {
  it('soft-deletes done tasks (not a hard delete) and returns the count', async () => {
    prismaMock.task.updateMany.mockResolvedValue({ count: 3 });

    const count = await tasksService.clearCompleted(USER);

    expect(count).toBe(3);
    expect(prismaMock.task.deleteMany).not.toHaveBeenCalled();
    const args = prismaMock.task.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER, status: 'done', deletedAt: null });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });
});

// ── importTasks ──────────────────────────────────────────────────────────

describe('tasksService.importTasks', () => {
  const importItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
    title: 'Imported task',
    priority: 'none' as const,
    status: 'todo' as const,
    reminderOffset: 'none' as const,
    recurring: 'none' as const,
    tags: [] as string[],
    ...overrides,
  });

  it('creates a fresh row (server-generated id) when no id is given', async () => {
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());

    const count = await tasksService.importTasks(USER, [importItem()]);

    expect(count).toBe(1);
    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data.id).toBeUndefined();
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('updates the existing row in place when the id belongs to the same user', async () => {
    prismaMock.task.findUnique.mockResolvedValue(fakeTaskRow({ id: 'task-1', userId: USER }));
    prismaMock.task.update.mockResolvedValue(fakeTaskRow());

    await tasksService.importTasks(USER, [importItem({ id: 'task-1' })]);

    expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.update.mock.calls[0][0].where).toEqual({ id: 'task-1' });
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it('never lets an id belonging to a different user be reused — creates fresh instead', async () => {
    prismaMock.task.findUnique.mockResolvedValue(fakeTaskRow({ id: 'someone-elses-task', userId: 'other-user' }));
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());

    await tasksService.importTasks(USER, [importItem({ id: 'someone-elses-task' })]);

    expect(prismaMock.task.update).not.toHaveBeenCalled();
    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data.id).toBeUndefined(); // never reuses the foreign id
    expect(args.data.userId).toBe(USER);
  });

  it('creates with the given id preserved when that id does not exist yet', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());

    await tasksService.importTasks(USER, [importItem({ id: 'brand-new-id' })]);

    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data.id).toBe('brand-new-id');
  });

  it('processes a mixed batch and returns the total count', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);
    prismaMock.task.create.mockResolvedValue(fakeTaskRow());

    const count = await tasksService.importTasks(USER, [importItem(), importItem(), importItem()]);
    expect(count).toBe(3);
  });
});

// ── getTaskStats ─────────────────────────────────────────────────────────

describe('tasksService.getTaskStats', () => {
  it('computes total/completed/overdue/dueToday/completionRate', async () => {
    prismaMock.task.findMany.mockResolvedValue([
      fakeTaskRow({ id: '1', status: 'done', completedAt: NOW, priority: 'high', category: 'work' }),
      fakeTaskRow({ id: '2', status: 'todo', dueDate: new Date('2026-08-16T00:00:00.000Z'), priority: 'none' }), // due today
      fakeTaskRow({ id: '3', status: 'todo', dueDate: new Date('2026-08-01T00:00:00.000Z'), priority: 'low' }), // overdue
      fakeTaskRow({ id: '4', status: 'todo', priority: 'medium', category: 'personal' }),
    ]);

    const stats = await tasksService.getTaskStats(USER);

    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.completionRate).toBe(25);
    expect(stats.priorityBreakdown).toEqual({ high: 1, medium: 1, low: 1, none: 1 });
    expect(stats.categoryBreakdown).toEqual({ work: 1, personal: 1, project: 0, routine: 0, uncategorized: 2 });
  });

  it('returns all zeros and a null mostProductiveDay with no tasks', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    const stats = await tasksService.getTaskStats(USER);
    expect(stats.total).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.mostProductiveDay).toBeNull();
    expect(stats.weeklyCompletions).toHaveLength(7);
  });

  it('counts a same-day completion in the streak without requiring one yesterday too', async () => {
    prismaMock.task.findMany.mockResolvedValue([fakeTaskRow({ status: 'done', completedAt: NOW })]);
    const stats = await tasksService.getTaskStats(USER);
    expect(stats.streak).toBe(1);
  });

  it('breaks the streak on the first gap day before today', async () => {
    // Completed today and 2 days ago, but NOT yesterday — streak should be 1 (today only).
    const twoDaysAgo = new Date('2026-08-14T12:00:00.000Z');
    prismaMock.task.findMany.mockResolvedValue([
      fakeTaskRow({ id: '1', status: 'done', completedAt: NOW }),
      fakeTaskRow({ id: '2', status: 'done', completedAt: twoDaysAgo }),
    ]);
    const stats = await tasksService.getTaskStats(USER);
    expect(stats.streak).toBe(1);
  });

  it('identifies the most productive day of the week by completion count', async () => {
    // NOW (2026-08-16) is a Sunday; add two completions on a Wednesday.
    const wednesday = new Date('2026-08-12T09:00:00.000Z');
    prismaMock.task.findMany.mockResolvedValue([
      fakeTaskRow({ id: '1', status: 'done', completedAt: wednesday }),
      fakeTaskRow({ id: '2', status: 'done', completedAt: wednesday }),
      fakeTaskRow({ id: '3', status: 'done', completedAt: NOW }),
    ]);
    const stats = await tasksService.getTaskStats(USER);
    expect(stats.mostProductiveDay).toBe('Wednesday');
  });
});
