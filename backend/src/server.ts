import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { redisClient } from './config/redis';
import { emailQueue } from './queues/email.queue';
import { emailWorker } from './queues/email.worker';
import { ReconcilerService } from './services/reconciler.service';

const server = app.listen(env.PORT, async () => {
  console.log(`
=====================================================
🚀 ReachInbox Email Scheduler API
📡 Server running on: http://localhost:${env.PORT}
📊 Health Check:      http://localhost:${env.PORT}/health
⚙️  Worker Concurrency: ${env.WORKER_CONCURRENCY}
🌍 Environment:       ${env.NODE_ENV}
=====================================================
  `);

  try {
    // Run startup crash recovery for orphaned jobs only
    await ReconcilerService.runStartupReconciliation();
  } catch (err: any) {
    console.error('⚠️ Startup reconciliation warning (database may not be ready yet):', err.message);
  }
});

// Graceful shutdown handler
async function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('🔌 HTTP server closed.');

    try {
      console.log('⏳ Closing BullMQ worker and queue...');
      await emailWorker.close();
      await emailQueue.close();
      console.log('✅ BullMQ worker and queue closed.');
    } catch (err: any) {
      console.error('Error closing BullMQ:', err.message);
    }

    try {
      await prisma.$disconnect();
      console.log('💾 Database connection closed.');
    } catch (err: any) {
      console.error('Error disconnecting database:', err.message);
    }

    try {
      await redisClient.quit();
      console.log('⚡ Redis connection closed.');
    } catch (err: any) {
      console.error('Error disconnecting Redis:', err.message);
    }

    console.log('👋 Shutdown complete. Exiting process.');
    process.exit(0);
  });

  // Force exit after 10 seconds if hanging
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
