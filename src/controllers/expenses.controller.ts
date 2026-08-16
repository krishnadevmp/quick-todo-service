import type { Request } from 'express';
import * as expensesService from '../services/expenses.service';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';

function uid(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export const list = asyncHandler(async (req, res) => {
  res.status(200).json(await expensesService.listExpenses(uid(req)));
});

export const getById = asyncHandler(async (req, res) => {
  res.status(200).json(await expensesService.getExpenseById(uid(req), req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await expensesService.createExpense(uid(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.status(200).json(await expensesService.updateExpense(uid(req), req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await expensesService.deleteExpense(uid(req), req.params.id);
  res.status(204).send();
});

export const stats = asyncHandler(async (req, res) => {
  res.status(200).json(await expensesService.getExpenseStats(uid(req)));
});

export const thisMonthCount = asyncHandler(async (req, res) => {
  res.status(200).json({ count: await expensesService.thisMonthCount(uid(req)) });
});
