import { Router } from 'express';
import authRoutes from './auth.routes';
import taskRoutes from './tasks.routes';
import expenseRoutes from './expenses.routes';
import settingsRoutes from './settings.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/expenses', expenseRoutes);
router.use('/settings', settingsRoutes);

export default router;
