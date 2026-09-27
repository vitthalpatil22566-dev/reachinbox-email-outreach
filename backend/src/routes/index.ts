import { Router } from 'express';
import emailRoutes from './email.routes';
import authRoutes from './auth.routes';
import slackRoutes from './slack.routes';
import senderRoutes from './sender.routes';

const router = Router();

router.use('/emails', emailRoutes);
router.use('/auth', authRoutes);
router.use('/slack', slackRoutes);
router.use('/senders', senderRoutes);

export default router;
