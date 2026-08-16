import { describe, expect, it } from 'vitest';
import {
  taskCreateSchema,
  taskFilterQuerySchema,
  taskImportSchema,
  taskSeriesUpdateSchema,
  taskUpdateSchema,
  upcomingQuerySchema,
} from '../../../src/schemas/task.schema';

describe('taskCreateSchema', () => {
  it('accepts a title-only payload and fills in every default', () => {
    const result = taskCreateSchema.parse({ title: 'Buy milk' });
    expect(result).toEqual({
      title: 'Buy milk',
      priority: 'none',
      status: 'todo',
      reminderOffset: 'none',
      recurring: 'none',
      tags: [],
    });
  });

  it('rejects a blank title', () => {
    expect(taskCreateSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('rejects an invalid priority/category/status value', () => {
    expect(taskCreateSchema.safeParse({ title: 'x', priority: 'urgent' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'x', category: 'shopping' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'x', status: 'in_progress' }).success).toBe(false); // must be 'in-progress'
  });

  it('accepts the hyphenated in-progress status literal', () => {
    expect(taskCreateSchema.safeParse({ title: 'x', status: 'in-progress' }).success).toBe(true);
  });

  it('lowercases and trims tags', () => {
    const result = taskCreateSchema.parse({ title: 'x', tags: ['  Work  ', 'URGENT'] });
    expect(result.tags).toEqual(['work', 'urgent']);
  });

  it('rejects more than 50 tags', () => {
    const tags = Array.from({ length: 51 }, (_, i) => `tag${i}`);
    expect(taskCreateSchema.safeParse({ title: 'x', tags }).success).toBe(false);
  });

  it('rejects a malformed dueDate or dueTime', () => {
    expect(taskCreateSchema.safeParse({ title: 'x', dueDate: '16-08-2026' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'x', dueTime: '9:30am' }).success).toBe(false);
  });
});

describe('taskUpdateSchema', () => {
  it('accepts an empty patch (every field optional, no defaults injected)', () => {
    expect(taskUpdateSchema.parse({})).toEqual({});
  });

  it('still validates the fields that are present', () => {
    expect(taskUpdateSchema.safeParse({ priority: 'urgent' }).success).toBe(false);
  });
});

describe('taskSeriesUpdateSchema', () => {
  it('has no dueDate, status, or completedAt fields at all', () => {
    const result = taskSeriesUpdateSchema.safeParse({ dueDate: '2026-08-16', status: 'done' });
    // extra/unknown keys are stripped by default z.object() behavior, not rejected —
    // the important guarantee is they never reach the parsed output.
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('dueDate');
    expect(result.data).not.toHaveProperty('status');
  });

  it('accepts a partial series edit', () => {
    expect(taskSeriesUpdateSchema.safeParse({ priority: 'high', tags: ['work'] }).success).toBe(true);
  });
});

describe('taskFilterQuerySchema', () => {
  it('defaults sortBy/sortDir and an empty tags array when nothing is given', () => {
    const result = taskFilterQuerySchema.parse({});
    expect(result).toEqual({ tags: [], sortBy: 'createdAt', sortDir: 'desc' });
  });

  it('splits a comma-separated tags query param into a lowercase array', () => {
    const result = taskFilterQuerySchema.parse({ tags: 'Work, Urgent ,,personal' });
    expect(result.tags).toEqual(['work', 'urgent', 'personal']);
  });

  it('rejects an invalid sortBy', () => {
    expect(taskFilterQuerySchema.safeParse({ sortBy: 'title' }).success).toBe(false);
  });
});

describe('upcomingQuerySchema', () => {
  it('defaults days to 7', () => {
    expect(upcomingQuerySchema.parse({})).toEqual({ days: 7 });
  });

  it('coerces a string query param to a number', () => {
    expect(upcomingQuerySchema.parse({ days: '14' })).toEqual({ days: 14 });
  });

  it('rejects zero, negative, or excessive values', () => {
    expect(upcomingQuerySchema.safeParse({ days: '0' }).success).toBe(false);
    expect(upcomingQuerySchema.safeParse({ days: '-1' }).success).toBe(false);
    expect(upcomingQuerySchema.safeParse({ days: '400' }).success).toBe(false);
  });
});

describe('taskImportSchema', () => {
  it('accepts an array of otherwise-valid create payloads, with optional id', () => {
    const result = taskImportSchema.safeParse([{ title: 'Imported', id: '11111111-1111-1111-1111-111111111111' }]);
    expect(result.success).toBe(true);
  });

  it('rejects an empty array', () => {
    expect(taskImportSchema.safeParse([]).success).toBe(false);
  });

  it('rejects a non-UUID id', () => {
    expect(taskImportSchema.safeParse([{ title: 'x', id: 'not-a-uuid' }]).success).toBe(false);
  });

  it('rejects more than 5000 items', () => {
    const items = Array.from({ length: 5001 }, () => ({ title: 'x' }));
    expect(taskImportSchema.safeParse(items).success).toBe(false);
  });
});
