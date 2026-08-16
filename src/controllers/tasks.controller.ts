import type { Request, Response } from 'express';
import * as tasksService from '../services/tasks.service';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';

function uid(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export const list = asyncHandler(async (req, res) => {
  res.status(200).json(await tasksService.listTasks(uid(req), req.query as never));
});

export const today = asyncHandler(async (req, res) => {
  res.status(200).json(await tasksService.getToday(uid(req)));
});

export const upcoming = asyncHandler(async (req, res) => {
  const { days } = req.query as unknown as { days: number };
  res.status(200).json(await tasksService.getUpcoming(uid(req), days));
});

export const getById = asyncHandler(async (req, res) => {
  res.status(200).json(await tasksService.getTaskById(uid(req), req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await tasksService.createTask(uid(req), req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.status(200).json(await tasksService.updateTask(uid(req), req.params.id, req.body));
});

export const updateSeries = asyncHandler(async (req, res) => {
  await tasksService.updateSeries(uid(req), req.params.id, req.body);
  res.status(204).send();
});

export const complete = asyncHandler(async (req, res) => {
  const result = await tasksService.completeTask(uid(req), req.params.id);
  res.status(200).json(result);
});

export const stopRecurring = asyncHandler(async (req, res) => {
  await tasksService.stopRecurring(uid(req), req.params.id);
  res.status(204).send();
});

export const remove = asyncHandler(async (req, res) => {
  await tasksService.deleteTask(uid(req), req.params.id);
  res.status(204).send();
});

export const clearCompleted = asyncHandler(async (req, res) => {
  const count = await tasksService.clearCompleted(uid(req));
  res.status(200).json({ count });
});

export const importTasks = asyncHandler(async (req, res) => {
  const count = await tasksService.importTasks(uid(req), req.body);
  res.status(200).json({ count });
});

export const stats = asyncHandler(async (req, res) => {
  res.status(200).json(await tasksService.getTaskStats(uid(req)));
});
