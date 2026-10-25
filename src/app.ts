import Fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyWebsocket from '@fastify/websocket';
import { registerSecurity } from './plugins/security.plugin';
import { registerSwagger } from './plugins/swagger.plugin';
import { healthRoutes } from './routes/health.routes';
import { animeRoutes } from './routes/anime.routes';
import { metaRoutes } from './routes/meta.routes';
import { commentRoutes } from './routes/comment.routes';
import { userRoutes } from './routes/user.routes';
import { searchRoutes, searchSuggestionRoutes } from './routes/search.routes';
import { catalogRoutes } from './routes/catalog.routes';
import { homeRoutes } from './routes/home.routes';
import { config } from './config/env';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    ajv: {
      customOptions: {
        strict: false,
      },
    },
    logger: {
      level: config.isProduction ? 'info' : 'debug',
      transport: config.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register WebSocket support
  await app.register(fastifyWebsocket);

  // Register security (CORS, Helmet, Rate Limit)
  await registerSecurity(app);

  // Register OpenAPI / Swagger Documentation
  await registerSwagger(app);

  // Welcome route redirecting to /docs
  app.get('/', async (_req, reply) => {
    return reply.redirect('/docs');
  });

  // Health route
  await app.register(healthRoutes);

  // Top-level direct shortcuts (/home, /trending, /top-airing, /movie, /search, etc.)
  await app.register(homeRoutes);
  await app.register(catalogRoutes);
  await app.register(searchRoutes, { prefix: '/search' });
  await app.register(searchSuggestionRoutes, { prefix: '/searchsuggestion' });

  // API v1 routes
  await app.register(
    async (v1) => {
      await v1.register(homeRoutes);
      await v1.register(catalogRoutes, { prefix: '/catalog' });
      await v1.register(catalogRoutes); // Also accessible as /api/v1/trending, /api/v1/movie, etc.
      await v1.register(searchRoutes, { prefix: '/search' });
      await v1.register(searchSuggestionRoutes, { prefix: '/searchsuggestion' });
      await v1.register(animeRoutes, { prefix: '/anime' });
      await v1.register(commentRoutes, { prefix: '/comments' });
      await v1.register(userRoutes, { prefix: '/users' });
      await v1.register(metaRoutes, { prefix: '/meta' });
    },
    { prefix: config.apiPrefix }
  );

  // Custom 404 handler
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route '${req.method} ${req.url}' was not found. Visit /docs for available endpoints.`,
    });
  });

  // Global Error Handler
  app.setErrorHandler((error: any, _req, reply) => {
    app.log.error(error);

    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    const message = error.message || 'Internal Server Error';

    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message,
    });
  });

  return app;
}
