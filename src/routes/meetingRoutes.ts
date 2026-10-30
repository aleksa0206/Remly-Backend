import { Router } from 'express';
import {
  completeMeetingHandler,
  createMeetingHandler,
  deleteMeetingHandler,
  getAllMeetingsHandler,
  getMeetingByIdHandler,
  updateMeetingHandler,
} from '../controllers/meetingController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import {
  completeMeetingSchema,
  createMeetingSchema,
  updateMeetingSchema,
} from '../validation/meetingSchemas';

const router = Router();

router.get('/meetings', authMiddleware, getAllMeetingsHandler);
router.get('/meetings/:meetingId', authMiddleware, getMeetingByIdHandler);
router.post('/meetings', authMiddleware, validate(createMeetingSchema), createMeetingHandler);
router.put(
  '/meetings/:meetingId',
  authMiddleware,
  validate(updateMeetingSchema),
  updateMeetingHandler
);
router.post(
  '/meetings/:meetingId/complete',
  authMiddleware,
  validate(completeMeetingSchema),
  completeMeetingHandler
);
router.delete('/meetings/:meetingId', authMiddleware, deleteMeetingHandler);

export default router;
