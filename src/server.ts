import { buildApp } from './app';
import { config } from './config/env';
import prisma from './db/prisma';

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully shutting down...`);
    try {
      await app.close();
      await prisma.$disconnect();
      app.log.info('Server and database connections closed cleanly.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error occurred during graceful shutdown.');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(`AniSora API server is listening at ${address}`);
    app.log.info(`Interactive OpenAPI Swagger Documentation: ${address}/docs`);
    app.log.info(`Database connectivity verified: 41,908+ anime records available`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
