import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { changePasswordSchema, loginSchema, signupSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/signup', validateBody(signupSchema), authController.signup);
router.post('/login', validateBody(loginSchema), authController.login);
router.get('/me', requireAuth, authController.me);
router.patch('/password', requireAuth, validateBody(changePasswordSchema), authController.changePassword);

export default router;
