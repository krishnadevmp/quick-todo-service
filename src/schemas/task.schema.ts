import { z } from 'zod';
import {
  dateStrSchema,
  prioritySchema,
  recurringPatternSchema,
  reminderOffsetSchema,
  taskCategorySchema,
  taskStatusSchema,
  timeStrSchema,
} from './common.schema';

const tagsSchema = z.array(z.string().trim().toLowerCase().min(1).max(60)).max(50).default([]);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().trim().max(5000).optional(),
  priority: prioritySchema.default('none'),
  category: taskCategorySchema.optional(),
  status: taskStatusSchema.default('todo'),
  dueDate: dateStrSchema.optional(),
  dueTime: timeStrSchema.optional(),
  reminderOffset: reminderOffsetSchema.default('none'),
  recurring: recurringPatternSchema.default('none'),
  tags: tagsSchema,
});

// Any field from taskCreateSchema may be patched, except we never accept
// id/createdAt/userId from the client — those are server-controlled.
export const taskUpdateSchema = taskCreateSchema.partial();

// Mirrors the frontend's `SeriesChanges` type: series-wide edits exclude
// dueDate, status, and completedAt (each occurrence keeps its own).
export const taskSeriesUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  priority: prioritySchema.optional(),
  category: taskCategorySchema.optional(),
  dueTime: timeStrSchema.optional(),
  reminderOffset: reminderOffsetSchema.optional(),
  recurring: recurringPatternSchema.optional(),
  tags: tagsSchema.optional(),
});

export const taskFilterQuerySchema = z.object({
  priority: prioritySchema.optional(),
  category: taskCategorySchema.optional(),
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [])),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const upcomingQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(7),
});

const taskImportItemSchema = taskCreateSchema.extend({
  id: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  recurringParentId: z.string().uuid().optional(),
});

export const taskImportSchema = z.array(taskImportItemSchema).min(1).max(5000);
