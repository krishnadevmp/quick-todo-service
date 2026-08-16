import { Router } from 'express';
import * as expensesController from '../controllers/expenses.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { expenseCreateSchema, expenseUpdateSchema } from '../schemas/expense.schema';

const router = Router();
router.use(requireAuth);

router.get('/', expensesController.list);
router.get('/stats', expensesController.stats);
router.get('/this-month-count', expensesController.thisMonthCount);
router.get('/:id', expensesController.getById);
router.post('/', validateBody(expenseCreateSchema), expensesController.create);
router.patch('/:id', validateBody(expenseUpdateSchema), expensesController.update);
router.delete('/:id', expensesController.remove);

export default router;
