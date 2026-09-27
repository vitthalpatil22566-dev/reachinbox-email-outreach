import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Google OAuth
router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);

// Slack OAuth (initiator + callback)
router.get('/slack', requireAuth, SlackController.initiateSlackAuth);
router.get('/slack/callback', SlackController.slackCallback);

// Session endpoints
router.get('/me', requireAuth, AuthController.getCurrentUser);
router.post('/logout', AuthController.logout);

export default router;
