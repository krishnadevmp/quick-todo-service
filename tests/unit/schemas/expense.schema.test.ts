import { describe, expect, it } from 'vitest';
import { expenseCreateSchema, expenseUpdateSchema } from '../../../src/schemas/expense.schema';

describe('expenseCreateSchema', () => {
  it('accepts a normal expense with a fixed category', () => {
    const result = expenseCreateSchema.safeParse({
      title: 'Groceries',
      amount: 45.5,
      category: 'grocery',
      date: '2026-08-16',
    });
    expect(result.success).toBe(true);
  });

  it("requires customCategory when category is 'other'", () => {
    const result = expenseCreateSchema.safeParse({
      title: 'Fixed the sink',
      amount: 20,
      category: 'other',
      date: '2026-08-16',
    });
    expect(result.success).toBe(false);
  });

  it("accepts 'other' when customCategory is provided", () => {
    const result = expenseCreateSchema.safeParse({
      title: 'Fixed the sink',
      amount: 20,
      category: 'other',
      customCategory: 'Plumber',
      date: '2026-08-16',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative amount', () => {
    const result = expenseCreateSchema.safeParse({
      title: 'x',
      amount: -5,
      category: 'grocery',
      date: '2026-08-16',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    const result = expenseCreateSchema.safeParse({
      title: 'x',
      amount: 5,
      category: 'crypto',
      date: '2026-08-16',
    });
    expect(result.success).toBe(false);
  });
});

describe('expenseUpdateSchema', () => {
  it('allows a partial patch with no category change at all', () => {
    expect(expenseUpdateSchema.safeParse({ amount: 10 }).success).toBe(true);
  });

  it("rejects switching to 'other' without customCategory in the same patch", () => {
    expect(expenseUpdateSchema.safeParse({ category: 'other' }).success).toBe(false);
  });
});
