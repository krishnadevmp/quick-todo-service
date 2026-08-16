import { Router } from 'express';
import * as tasksController from '../controllers/tasks.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  taskCreateSchema,
  taskFilterQuerySchema,
  taskImportSchema,
  taskSeriesUpdateSchema,
  taskUpdateSchema,
  upcomingQuerySchema,
} from '../schemas/task.schema';

const router = Router();
router.use(requireAuth);

// Static/collection routes before ':id' so they aren't swallowed by the param route.
router.get('/', validateQuery(taskFilterQuerySchema), tasksController.list);
router.get('/today', tasksController.today);
router.get('/upcoming', validateQuery(upcomingQuerySchema), tasksController.upcoming);
router.get('/stats', tasksController.stats);
router.delete('/completed', tasksController.clearCompleted);
router.post('/import', validateBody(taskImportSchema), tasksController.importTasks);
router.post('/', validateBody(taskCreateSchema), tasksController.create);

router.get('/:id', tasksController.getById);
router.patch('/:id', validateBody(taskUpdateSchema), tasksController.update);
router.patch('/:id/series', validateBody(taskSeriesUpdateSchema), tasksController.updateSeries);
router.post('/:id/complete', tasksController.complete);
router.post('/:id/stop-recurring', tasksController.stopRecurring);
router.delete('/:id', tasksController.remove);

export default router;
