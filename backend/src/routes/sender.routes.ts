import { Router } from 'express';
import { SenderController } from '../controllers/sender.controller';

const router = Router();

router.get('/', SenderController.listSenders);
router.post('/', SenderController.createSender);

export default router;
