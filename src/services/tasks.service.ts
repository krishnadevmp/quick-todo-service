import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { dateStrToDate, dateToDateStr, todayStr } from '../utils/date';
import { getNextOccurrence, type RecurringPattern } from '../utils/recurring';
import { notFound } from '../utils/httpError';
import type {
  taskCreateSchema,
  taskFilterQuerySchema,
  taskImportSchema,
  taskSeriesUpdateSchema,
  taskUpdateSchema,
} from '../schemas/task.schema';

const taskInclude = { taskTags: { include: { tag: true } } } satisfies Prisma.TaskInclude;
type TaskWithTags = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

function toDto(t: TaskWithTags) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    priority: t.priority,
    category: t.category ?? undefined,
    status: t.status,
    dueDate: t.dueDate ? dateToDateStr(t.dueDate) : undefined,
    dueTime: t.dueTime ?? undefined,
    reminderOffset: t.reminderOffset,
    recurring: t.recurring,
    // Join-table order isn't meaningful — sorted for a stable response.
    tags: t.taskTags.map((tt) => tt.tag.name).sort(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: t.completedAt?.toISOString(),
    recurringParentId: t.recurringParentId ?? undefined,
  };
}

/** Find-or-create each tag name for this user; returns their ids. */
async function syncTags(userId: string, names: string[]): Promise<string[]> {
  const unique = [...new Set(names)];
  const ids: string[] = [];
  for (const name of unique) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
    ids.push(tag.id);
  }
  return ids;
}

async function assertOwned(userId: string, id: string) {
  const task = await prisma.task.findFirst({ where: { id, userId, deletedAt: null } });
  if (!task) throw notFound('Task not found');
  return task;
}

// ── Read ─────────────────────────────────────────────────────────────────

type FilterQuery = z.infer<typeof taskFilterQuerySchema>;

export async function listTasks(userId: string, filter: FilterQuery) {
  const where: Prisma.TaskWhereInput = {
    userId,
    deletedAt: null,
    ...(filter.priority && { priority: filter.priority }),
    ...(filter.category && { category: filter.category }),
    ...(filter.tags.length > 0 && {
      AND: filter.tags.map((name) => ({ taskTags: { some: { tag: { name } } } })),
    }),
    ...(filter.search && {
      OR: [
        { title: { contains: filter.search, mode: 'insensitive' as const } },
        { description: { contains: filter.search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const rows = await prisma.task.findMany({ where, include: taskInclude });
  const tasks = rows.map(toDto);

  const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
  tasks.sort((a, b) => {
    let cmp = 0;
    if (filter.sortBy === 'priority') {
      cmp = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    } else if (filter.sortBy === 'dueDate') {
      const ad = a.dueDate ?? '9999-99-99';
      const bd = b.dueDate ?? '9999-99-99';
      cmp = ad < bd ? -1 : ad > bd ? 1 : 0;
    } else {
      cmp = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    }
    return filter.sortDir === 'asc' ? cmp : -cmp;
  });

  return tasks;
}

export async function getToday(userId: string) {
  const today = todayStr();
  const rows = await prisma.task.findMany({
    where: { userId, deletedAt: null, dueDate: dateStrToDate(today), status: { not: 'done' } },
    include: taskInclude,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toDto);
}

export async function getOverdue(userId: string) {
  const today = todayStr();
  const rows = await prisma.task.findMany({
    where: { userId, deletedAt: null, dueDate: { lt: dateStrToDate(today) }, status: { not: 'done' } },
    include: taskInclude,
    orderBy: { dueDate: 'asc' },
  });
  return rows.map(toDto);
}

export async function getUpcoming(userId: string, days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setUTCDate(limit.getUTCDate() + days);

  const [rows, overdueDtos] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        dueDate: { gt: today, lte: limit },
        status: { not: 'done' },
      },
      include: taskInclude,
      orderBy: { dueDate: 'asc' },
    }),
    getOverdue(userId),
  ]);

  return { upcoming: rows.map(toDto), overdue: overdueDtos };
}

export async function getTaskById(userId: string, id: string) {
  const row = await prisma.task.findFirst({ where: { id, userId, deletedAt: null }, include: taskInclude });
  if (!row) throw notFound('Task not found');
  return toDto(row);
}

// ── Write ────────────────────────────────────────────────────────────────

export async function createTask(userId: string, data: z.infer<typeof taskCreateSchema>) {
  const tagIds = data.tags.length ? await syncTags(userId, data.tags) : [];
  const row = await prisma.task.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category,
      status: data.status,
      dueDate: data.dueDate ? dateStrToDate(data.dueDate) : undefined,
      dueTime: data.dueTime,
      reminderOffset: data.reminderOffset,
      recurring: data.recurring,
      taskTags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
    include: taskInclude,
  });
  return toDto(row);
}

export async function updateTask(userId: string, id: string, patch: z.infer<typeof taskUpdateSchema>) {
  await assertOwned(userId, id);

  const tagIds = patch.tags ? await syncTags(userId, patch.tags) : undefined;

  const row = await prisma.task.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      category: patch.category,
      status: patch.status,
      dueDate: patch.dueDate ? dateStrToDate(patch.dueDate) : undefined,
      dueTime: patch.dueTime,
      reminderOffset: patch.reminderOffset,
      recurring: patch.recurring,
      ...(tagIds && { taskTags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }),
    },
    include: taskInclude,
  });
  return toDto(row);
}

/**
 * Mark a task done. If it's part of a recurring series, spawns the next
 * occurrence in the same transaction — the DB-level equivalent of the
 * frontend's read-write Dexie transaction, same idempotency guard.
 */
export async function completeTask(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id, userId, deletedAt: null }, include: taskInclude });
    if (!task) throw notFound('Task not found');
    if (task.status === 'done') return { task: toDto(task), nextTask: undefined };

    const now = new Date();
    const updated = await tx.task.update({
      where: { id },
      data: { status: 'done', completedAt: now },
      include: taskInclude,
    });

    if (task.recurring === 'none') return { task: toDto(updated), nextTask: undefined };

    const nextDueDate = getNextOccurrence(
      task.dueDate ? dateToDateStr(task.dueDate) : undefined,
      task.recurring as RecurringPattern
    );
    const parentId = task.recurringParentId ?? task.id;
    const tagIds = task.taskTags.map((tt) => tt.tagId);

    const nextRow = await tx.task.create({
      data: {
        userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        status: 'todo',
        dueDate: dateStrToDate(nextDueDate),
        dueTime: task.dueTime,
        reminderOffset: task.reminderOffset,
        recurring: task.recurring,
        recurringParentId: parentId,
        taskTags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: taskInclude,
    });

    return { task: toDto(updated), nextTask: toDto(nextRow) };
  });
}

/** Soft delete — see docs/DATABASE_DESIGN.md on deletedAt. */
export async function deleteTask(userId: string, id: string) {
  await assertOwned(userId, id);
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function stopRecurring(userId: string, id: string) {
  const task = await assertOwned(userId, id);
  const parentId = task.recurringParentId ?? task.id;

  await prisma.task.update({ where: { id }, data: { recurring: 'none' } });
  await prisma.task.updateMany({
    where: { userId, deletedAt: null, recurringParentId: parentId, id: { not: id }, status: { not: 'done' } },
    data: { recurring: 'none' },
  });
}

export async function updateSeries(userId: string, id: string, changes: z.infer<typeof taskSeriesUpdateSchema>) {
  const task = await assertOwned(userId, id);
  const parentId = task.recurringParentId ?? task.id;

  const tagIds = changes.tags ? await syncTags(userId, changes.tags) : undefined;
  const baseData = {
    title: changes.title,
    description: changes.description,
    priority: changes.priority,
    category: changes.category,
    dueTime: changes.dueTime,
    reminderOffset: changes.reminderOffset,
    recurring: changes.recurring,
  };

  await prisma.task.update({
    where: { id },
    data: { ...baseData, ...(tagIds && { taskTags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }) },
  });

  const siblings = await prisma.task.findMany({
    where: { userId, deletedAt: null, recurringParentId: parentId, id: { not: id }, status: { not: 'done' } },
    select: { id: true },
  });

  for (const sibling of siblings) {
    await prisma.task.update({
      where: { id: sibling.id },
      data: { ...baseData, ...(tagIds && { taskTags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }) },
    });
  }
}

/** Soft delete, same as the single-task DELETE — consistent with docs/DATABASE_DESIGN.md's sync-prep decision. */
export async function clearCompleted(userId: string): Promise<number> {
  const result = await prisma.task.updateMany({
    where: { userId, status: 'done', deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return result.count;
}

/** Bulk upsert, backs Settings -> "Import JSON". Never lets an id collide across users. */
export async function importTasks(userId: string, items: z.infer<typeof taskImportSchema>) {
  let count = 0;
  for (const item of items) {
    const tagIds = item.tags.length ? await syncTags(userId, item.tags) : [];
    const existing = item.id ? await prisma.task.findUnique({ where: { id: item.id } }) : null;
    const canReuseId = existing ? existing.userId === userId : true;

    const data = {
      userId,
      title: item.title,
      description: item.description,
      priority: item.priority,
      category: item.category,
      status: item.status,
      dueDate: item.dueDate ? dateStrToDate(item.dueDate) : undefined,
      dueTime: item.dueTime,
      reminderOffset: item.reminderOffset,
      recurring: item.recurring,
      completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
    };

    if (item.id && canReuseId && existing) {
      await prisma.task.update({
        where: { id: item.id },
        data: { ...data, taskTags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } },
      });
    } else {
      await prisma.task.create({
        data: {
          ...data,
          id: item.id && canReuseId ? item.id : undefined,
          taskTags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
      });
    }
    count++;
  }
  return count;
}

// ── Stats (dashboard) ───────────────────────────────────────────────────
// Computed in application code from the full (non-deleted) task list, same
// approach as the frontend's TaskRepository.getStats() — at personal-app
// data volumes this is simpler and guaranteed to match the frontend's
// existing logic exactly; revisit with SQL aggregation if volume grows.

export async function getTaskStats(userId: string) {
  const all = (await prisma.task.findMany({ where: { userId, deletedAt: null } })).map((t) => ({
    priority: t.priority,
    category: t.category,
    status: t.status,
    dueDate: t.dueDate ? dateToDateStr(t.dueDate) : undefined,
    completedAt: t.completedAt,
  }));

  const done = all.filter((t) => t.status === 'done');
  const today = todayStr();
  const overdue = all.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'done');
  const completedToday = done.filter((t) => t.completedAt && t.completedAt.toISOString().startsWith(today));

  const priorityBreakdown = { high: 0, medium: 0, low: 0, none: 0 } as Record<string, number>;
  for (const t of all) priorityBreakdown[t.priority] = (priorityBreakdown[t.priority] ?? 0) + 1;

  const categoryBreakdown = { work: 0, personal: 0, project: 0, routine: 0, uncategorized: 0 } as Record<
    string,
    number
  >;
  for (const t of all) {
    const key = t.category ?? 'uncategorized';
    categoryBreakdown[key] = (categoryBreakdown[key] ?? 0) + 1;
  }

  const weeklyCompletions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (6 - i));
    const date = d.toISOString().slice(0, 10);
    const count = done.filter((t) => t.completedAt?.toISOString().startsWith(date)).length;
    return { date, count };
  });

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const hasCompletion = done.some((t) => t.completedAt?.toISOString().startsWith(date));
    if (hasCompletion) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const t of done) {
    if (t.completedAt) dayCounts[t.completedAt.getUTCDay()]++;
  }
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const maxDay = Math.max(...dayCounts);
  const mostProductiveDay = maxDay > 0 ? DAY_NAMES[dayCounts.indexOf(maxDay)] : null;

  return {
    total: all.length,
    completed: done.length,
    completedToday: completedToday.length,
    dueToday: all.filter((t) => t.dueDate === today).length,
    overdue: overdue.length,
    completionRate: all.length ? Math.round((done.length / all.length) * 100) : 0,
    priorityBreakdown,
    categoryBreakdown,
    weeklyCompletions,
    streak,
    mostProductiveDay,
  };
}
