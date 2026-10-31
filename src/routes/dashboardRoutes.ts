import { Router } from 'express';
import { getDashboardHandler } from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/dashboard', authMiddleware, getDashboardHandler);

export default router;
