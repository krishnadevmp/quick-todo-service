import { z } from 'zod';
import { dateStrSchema, expenseCategorySchema } from './common.schema';

export const expenseCreateSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(2000).optional(),
    amount: z.number().finite().min(0, 'Amount must be >= 0'),
    category: expenseCategorySchema,
    customCategory: z.string().trim().max(60).optional(),
    date: dateStrSchema,
  })
  .refine((data) => data.category !== 'other' || !!data.customCategory?.trim(), {
    message: "customCategory is required when category is 'other'",
    path: ['customCategory'],
  });

export const expenseUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    amount: z.number().finite().min(0).optional(),
    category: expenseCategorySchema.optional(),
    customCategory: z.string().trim().max(60).optional(),
    date: dateStrSchema.optional(),
  })
  .refine((data) => data.category !== 'other' || !!data.customCategory?.trim(), {
    message: "customCategory is required when category is 'other'",
    path: ['customCategory'],
  });
