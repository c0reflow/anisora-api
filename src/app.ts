import Fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { adminRoutes } from './routes/admin.routes';
import { anisoraRoutes } from './routes/anisora.routes';
import { anilistRoutes } from './routes/anilist.routes';
import { streamRoutes } from './routes/stream.routes';
import { HomeAdminService } from './services/home-admin.service';
import { config } from './config/env';

export async function buildApp(): Promise<FastifyInstance> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  const app = Fastify({
    logger: isServerless || config.isProduction
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Enable CORS
  await app.register(fastifyCors, {
    origin: true,
  });

  // Serve static assets from public/ (including admin UI)
  const publicPath = path.resolve(process.cwd(), 'public');
  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  // Shortcut to admin dashboard
  app.get('/admin', async (_req, reply) => {
    return reply.sendFile('admin.html');
  });

  // Read-only Home endpoint for clients / frontend
  app.get('/api/v1/home', async (_req, reply) => {
    const data = await HomeAdminService.getHomeData();
    return reply.send({
      success: true,
      data,
    });
  });

  // Register API routes under /api/v1
  await app.register(
    async (v1) => {
      // Admin endpoints
      await v1.register(adminRoutes, { prefix: '/admin' });

      // Anisora endpoints: /api/v1/anisora/...
      await v1.register(anisoraRoutes, { prefix: '/anisora' });

      // AniList endpoints: /api/v1/anilist/...
      await v1.register(anilistRoutes, { prefix: '/anilist' });

      // Stream endpoints are also under /api/v1/anisora/...
      await v1.register(streamRoutes, { prefix: '/anisora' });
    },
    { prefix: config.apiPrefix }
  );

  // Custom 404 handler
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route '${req.method} ${req.url}' was not found.`,
    });
  });

  // Global Error Handler
  app.setErrorHandler((error: any, _req, reply) => {
    app.log.error(error);
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message: error.message || 'Internal Server Error',
    });
  });

  return app;
}
