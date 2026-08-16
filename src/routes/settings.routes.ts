import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { settingsUpdateSchema } from '../schemas/settings.schema';

const router = Router();
router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.patch('/', validateBody(settingsUpdateSchema), settingsController.updateSettings);

export default router;
