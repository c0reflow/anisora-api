import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from '../config/env';

export async function registerSecurity(app: FastifyInstance) {
  // CORS
  await app.register(fastifyCors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Helmet with relaxed CSP for Swagger UI
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  // Rate Limiting
  await app.register(fastifyRateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. You are only allowed ${context.max} requests per ${context.after}.`,
    }),
  });
}
