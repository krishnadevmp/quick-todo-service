import { z } from 'zod';

// Mirrors the union types in quick-todo/src/types/index.ts exactly — see the
// note at the top of prisma/schema.prisma for why these are validated here
// rather than as native DB enums.

export const prioritySchema = z.enum(['high', 'medium', 'low', 'none']);
export const taskCategorySchema = z.enum(['work', 'personal', 'project', 'routine']);
export const taskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
export const reminderOffsetSchema = z.enum(['none', 'at', '15', '30', '60', '1440']);
export const recurringPatternSchema = z.enum(['none', 'daily', 'weekdays', 'weekly', 'monthly']);
export const expenseCategorySchema = z.enum([
  'grocery',
  'rent',
  'electricity',
  'water',
  'phone',
  'entertainment',
  'equipment',
  'other',
]);
export const currencyCodeSchema = z.enum(['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR']);
export const themeSchema = z.enum(['dark', 'light', 'system']);

/** "YYYY-MM-DD" */
export const dateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** "HH:MM", 24h */
export const timeStrSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24h)');
