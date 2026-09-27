import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Slack OAuth endpoints
router.get('/connect', requireAuth, SlackController.initiateSlackAuth);
router.get('/callback', SlackController.slackCallback);

// Slack management endpoints (Protected by session authentication)
router.get('/status', requireAuth, SlackController.getStatus);
router.post('/disconnect', requireAuth, SlackController.disconnect);
router.get('/channels', requireAuth, SlackController.listChannels);
router.post('/channel', requireAuth, SlackController.setChannel);

export default router;
