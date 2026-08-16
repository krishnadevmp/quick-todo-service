import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { dateStrToDate, dateToDateStr, todayStr } from '../utils/date';
import { badRequest, notFound } from '../utils/httpError';
import type { expenseCreateSchema, expenseUpdateSchema } from '../schemas/expense.schema';

type ExpenseRow = {
  id: string;
  title: string;
  description: string | null;
  amount: Prisma.Decimal;
  category: string;
  customCategory: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(e: ExpenseRow) {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    amount: Number(e.amount),
    category: e.category,
    customCategory: e.customCategory ?? undefined,
    date: dateToDateStr(e.date),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Grocery',
  rent: 'Rent',
  electricity: 'Electricity',
  water: 'Water',
  phone: 'Phone',
  entertainment: 'Entertainment',
  equipment: 'Utensils / Equipment',
  other: 'Other',
};

export async function listExpenses(userId: string) {
  const rows = await prisma.expense.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toDto);
}

export async function getExpenseById(userId: string, id: string) {
  const row = await prisma.expense.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw notFound('Expense not found');
  return toDto(row);
}

export async function createExpense(userId: string, data: z.infer<typeof expenseCreateSchema>) {
  const row = await prisma.expense.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      amount: data.amount,
      category: data.category,
      customCategory: data.category === 'other' ? data.customCategory : undefined,
      date: dateStrToDate(data.date),
    },
  });
  return toDto(row);
}

export async function updateExpense(userId: string, id: string, patch: z.infer<typeof expenseUpdateSchema>) {
  const existing = await prisma.expense.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw notFound('Expense not found');

  const nextCategory = patch.category ?? existing.category;
  const nextCustomCategory = patch.customCategory ?? existing.customCategory ?? undefined;
  if (nextCategory === 'other' && !nextCustomCategory?.trim()) {
    throw badRequest("customCategory is required when category is 'other'");
  }

  const row = await prisma.expense.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      amount: patch.amount,
      category: patch.category,
      customCategory: nextCategory === 'other' ? nextCustomCategory : null,
      date: patch.date ? dateStrToDate(patch.date) : undefined,
    },
  });
  return toDto(row);
}

export async function deleteExpense(userId: string, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw notFound('Expense not found');
  await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function thisMonthCount(userId: string): Promise<number> {
  const prefix = todayStr().slice(0, 7); // YYYY-MM
  return prisma.expense.count({
    where: {
      userId,
      deletedAt: null,
      date: { gte: dateStrToDate(`${prefix}-01`), lt: nextMonthStart(prefix) },
    },
  });
}

function nextMonthStart(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split('-').map(Number);
  const nextMonth = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  return nextMonth;
}

/** Mirrors the aggregates ExpensesView used to compute client-side from the full list. */
export async function getExpenseStats(userId: string) {
  const monthPrefix = todayStr().slice(0, 7);
  const today = todayStr();

  const thisMonth = await prisma.expense.findMany({
    where: {
      userId,
      deletedAt: null,
      date: { gte: dateStrToDate(`${monthPrefix}-01`), lt: nextMonthStart(monthPrefix) },
    },
  });

  const totalThisMonth = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalToday = thisMonth
    .filter((e) => dateToDateStr(e.date) === today)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryMap = new Map<string, { label: string; amount: number }>();
  for (const e of thisMonth) {
    const label = e.category === 'other' ? e.customCategory?.trim() || 'Other' : EXPENSE_CATEGORY_LABELS[e.category];
    const existing = categoryMap.get(label);
    if (existing) existing.amount += Number(e.amount);
    else categoryMap.set(label, { label, amount: Number(e.amount) });
  }
  const categoryTotals = [...categoryMap.values()].sort((a, b) => b.amount - a.amount);

  const dayOfMonth = new Date().getUTCDate();

  return {
    totalThisMonth,
    totalToday,
    transactionsThisMonth: thisMonth.length,
    categoryTotals,
    topCategory: categoryTotals[0] ?? null,
    avgPerDay: dayOfMonth > 0 ? totalThisMonth / dayOfMonth : 0,
  };
}
