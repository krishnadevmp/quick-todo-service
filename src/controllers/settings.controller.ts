import type { Request, Response } from 'express';
import * as settingsService from '../services/settings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw unauthorized();
  const settings = await settingsService.getSettings(req.userId);
  res.status(200).json(settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw unauthorized();
  const settings = await settingsService.updateSettings(req.userId, req.body);
  res.status(200).json(settings);
});
