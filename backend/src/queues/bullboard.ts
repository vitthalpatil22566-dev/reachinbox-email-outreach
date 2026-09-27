import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './email.queue';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Express adapter for Bull Board.
 * Mounted at /admin/queues in app.ts.
 */
export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

/**
 * Initializes Bull Board with the existing reachinbox-email-queue.
 * Live monitoring for: waiting, delayed, active, completed, and failed jobs.
 */
export const bullBoard = createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

/**
 * Basic Authentication middleware for administrative Bull Board dashboard.
 * Configured via BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD.
 */
export function bullBoardAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If in test mode or no credentials configured, bypass auth
  if (process.env.NODE_ENV === 'test' || !env.BULL_BOARD_USERNAME || !env.BULL_BOARD_PASSWORD) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Bull Board Queue Monitor"');
    res.status(401).send('Authentication required to access Bull Board dashboard.');
    return;
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (username === env.BULL_BOARD_USERNAME && password === env.BULL_BOARD_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Bull Board Queue Monitor"');
  res.status(401).send('Invalid Bull Board administrative credentials.');
}
