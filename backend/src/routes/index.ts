import { Router } from 'express';
import emailRoutes from './email.routes';
import authRoutes from './auth.routes';
import slackRoutes from './slack.routes';

const router = Router();

router.use('/emails', emailRoutes);
router.use('/auth', authRoutes);
router.use('/slack', slackRoutes);

export default router;
