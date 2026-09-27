import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { checkDatabaseConnection } from './config/database';
import { checkRedisConnection } from './config/redis';
import apiRouter from './routes';
import { serverAdapter, bullBoardAuthMiddleware } from './queues/bullboard';

export const app = express();

// Middlewares
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic request logger in development
if (env.NODE_ENV === 'development') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const dbOk = await checkDatabaseConnection();
  const redisOk = await checkRedisConnection();

  const isHealthy = dbOk && redisOk;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
    version: '1.0.0',
  });
});

// Bull Board live queue monitoring dashboard
app.use('/admin/queues', bullBoardAuthMiddleware, serverAdapter.getRouter());

// API routes
app.use('/api/v1', apiRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});
