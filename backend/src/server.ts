import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { redisClient } from './config/redis';

const server = app.listen(env.PORT, () => {
  console.log(`
=====================================================
🚀 ReachInbox Email Scheduler API
📡 Server running on: http://localhost:${env.PORT}
📊 Health Check:      http://localhost:${env.PORT}/health
🌍 Environment:       ${env.NODE_ENV}
=====================================================
  `);
});

// Graceful shutdown handler
async function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('🔌 HTTP server closed.');

    try {
      await prisma.$disconnect();
      console.log('💾 Database connection closed.');
    } catch (err) {
      console.error('Error disconnecting database:', err);
    }

    try {
      await redisClient.quit();
      console.log('⚡ Redis connection closed.');
    } catch (err) {
      console.error('Error disconnecting Redis:', err);
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
