import { Router } from 'express';
import { SenderController } from '../controllers/sender.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Enforce session authentication across all sender endpoints
router.use(requireAuth);

router.get('/', SenderController.listSenders);
router.post('/', SenderController.createSender);

export default router;
