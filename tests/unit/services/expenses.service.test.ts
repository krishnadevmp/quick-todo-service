import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '../../mocks/prisma';

vi.mock('../../../src/lib/prisma', () => ({ prisma: prismaMock }));

import * as expensesService from '../../../src/services/expenses.service';

const USER = 'user-1';

function fakeExpense(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'exp-1',
    userId: USER,
    title: 'Weekly grocery run',
    description: null,
    amount: 45.5,
    category: 'grocery',
    customCategory: null,
    date: new Date('2026-08-16T00:00:00.000Z'),
    createdAt: new Date('2026-08-16T09:00:00.000Z'),
    updatedAt: new Date('2026-08-16T09:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('expensesService.listExpenses', () => {
  it('excludes soft-deleted rows and sorts by date desc, then createdAt desc', async () => {
    prismaMock.expense.findMany.mockResolvedValue([fakeExpense()]);
    const result = await expensesService.listExpenses(USER);

    const args = prismaMock.expense.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER, deletedAt: null });
    expect(args.orderBy).toEqual([{ date: 'desc' }, { createdAt: 'desc' }]);
    expect(result[0]).toMatchObject({ id: 'exp-1', amount: 45.5, date: '2026-08-16' });
  });

  it('converts the Decimal amount to a plain number and formats date as YYYY-MM-DD', async () => {
    prismaMock.expense.findMany.mockResolvedValue([fakeExpense({ amount: 100 })]);
    const [result] = await expensesService.listExpenses(USER);
    expect(result.amount).toBe(100);
    expect(typeof result.amount).toBe('number');
  });
});

describe('expensesService.getExpenseById', () => {
  it('returns the expense when it exists and belongs to the user', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(fakeExpense());
    const result = await expensesService.getExpenseById(USER, 'exp-1');
    expect(result.id).toBe('exp-1');
  });

  it('throws 404 when not found (missing, deleted, or another user\'s)', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null);
    await expect(expensesService.getExpenseById(USER, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('expensesService.createExpense', () => {
  it('stores customCategory when category is "other"', async () => {
    prismaMock.expense.create.mockImplementation(async ({ data }: any) => fakeExpense(data));

    await expensesService.createExpense(USER, {
      title: 'Fixed the sink',
      amount: 20,
      category: 'other',
      customCategory: 'Plumber',
      date: '2026-08-16',
    });

    const args = prismaMock.expense.create.mock.calls[0][0];
    expect(args.data.customCategory).toBe('Plumber');
  });

  it('drops customCategory when category is not "other", even if one was sent', async () => {
    prismaMock.expense.create.mockImplementation(async ({ data }: any) => fakeExpense(data));

    await expensesService.createExpense(USER, {
      title: 'Milk',
      amount: 5,
      category: 'grocery',
      customCategory: 'ignored',
      date: '2026-08-16',
    } as any);

    const args = prismaMock.expense.create.mock.calls[0][0];
    expect(args.data.customCategory).toBeUndefined();
  });
});

describe('expensesService.updateExpense', () => {
  it('throws 404 when the expense does not exist or is already deleted', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null);
    await expect(expensesService.updateExpense(USER, 'nope', { amount: 5 })).rejects.toMatchObject({ status: 404 });
  });

  it('allows patching only amount when the existing category is not "other"', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(fakeExpense({ category: 'grocery' }));
    prismaMock.expense.update.mockResolvedValue(fakeExpense({ amount: 99 }));

    const result = await expensesService.updateExpense(USER, 'exp-1', { amount: 99 });
    expect(result.amount).toBe(99);
  });

  it('rejects switching to "other" without providing customCategory', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(fakeExpense({ category: 'grocery', customCategory: null }));
    await expect(expensesService.updateExpense(USER, 'exp-1', { category: 'other' })).rejects.toMatchObject({
      status: 400,
    });
    expect(prismaMock.expense.update).not.toHaveBeenCalled();
  });

  it('allows patching amount on an already-"other" expense without resending customCategory', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(fakeExpense({ category: 'other', customCategory: 'Plumber' }));
    prismaMock.expense.update.mockResolvedValue(fakeExpense({ category: 'other', customCategory: 'Plumber', amount: 30 }));

    const result = await expensesService.updateExpense(USER, 'exp-1', { amount: 30 });
    expect(result.amount).toBe(30);

    const args = prismaMock.expense.update.mock.calls[0][0];
    expect(args.data.customCategory).toBe('Plumber'); // carried forward from the existing row
  });
});

describe('expensesService.deleteExpense', () => {
  it('soft-deletes by setting deletedAt, not a hard delete', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(fakeExpense());
    prismaMock.expense.update.mockResolvedValue(fakeExpense({ deletedAt: new Date() }));

    await expensesService.deleteExpense(USER, 'exp-1');

    const args = prismaMock.expense.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'exp-1' });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });

  it('throws 404 for an expense that does not belong to the user', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null);
    await expect(expensesService.deleteExpense(USER, 'someone-elses')).rejects.toMatchObject({ status: 404 });
  });
});

describe('expensesService.getExpenseStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z')); // day 16 of the month
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates totals, groups by category label, and picks the top category', async () => {
    prismaMock.expense.findMany.mockResolvedValue([
      fakeExpense({ id: '1', category: 'grocery', amount: 100, date: new Date('2026-08-16T00:00:00.000Z') }),
      fakeExpense({ id: '2', category: 'grocery', amount: 50, date: new Date('2026-08-10T00:00:00.000Z') }),
      fakeExpense({ id: '3', category: 'other', customCategory: 'Gift', amount: 30, date: new Date('2026-08-01T00:00:00.000Z') }),
    ]);

    const stats = await expensesService.getExpenseStats(USER);

    expect(stats.transactionsThisMonth).toBe(3);
    expect(stats.totalThisMonth).toBe(180);
    expect(stats.totalToday).toBe(100);
    expect(stats.topCategory).toEqual({ label: 'Grocery', amount: 150 });
    expect(stats.categoryTotals).toEqual([
      { label: 'Grocery', amount: 150 },
      { label: 'Gift', amount: 30 },
    ]);
    expect(stats.avgPerDay).toBeCloseTo(180 / 16);
  });

  it('returns a null topCategory and zero totals with no expenses this month', async () => {
    prismaMock.expense.findMany.mockResolvedValue([]);
    const stats = await expensesService.getExpenseStats(USER);
    expect(stats.topCategory).toBeNull();
    expect(stats.totalThisMonth).toBe(0);
    expect(stats.categoryTotals).toEqual([]);
  });
});
