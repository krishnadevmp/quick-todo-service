import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const result = await authService.signup(name, email, password);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw unauthorized();
  const user = await authService.getCurrentUser(req.userId);
  res.status(200).json({ user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw unauthorized();
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.userId, currentPassword, newPassword);
  res.status(204).send();
});
