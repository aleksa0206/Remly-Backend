import { Router } from 'express';
import {
  createContactHandler,
  deleteContactHandler,
  getAllContactsHandler,
  getContactByIdHandler,
  updateContactHandler,
} from '../controllers/contactController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { createContactSchema, updateContactSchema } from '../validation/contactSchemas';

const router = Router();

router.get('/contacts', authMiddleware, getAllContactsHandler);
router.get('/contacts/:contactId', authMiddleware, getContactByIdHandler);
router.post('/contacts', authMiddleware, validate(createContactSchema), createContactHandler);
router.put(
  '/contacts/:contactId',
  authMiddleware,
  validate(updateContactSchema),
  updateContactHandler
);
router.delete('/contacts/:contactId', authMiddleware, deleteContactHandler);

export default router;
