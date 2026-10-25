import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import prisma from '../db/prisma';
import { HealthResponseSchema } from '../schemas/common.schema';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'System health check and database status',
        description: 'Returns API health, database connection state, and anime count.',
        response: {
          200: HealthResponseSchema,
          503: HealthResponseSchema,
        },
      },
    },
    async (_req, reply) => {
      try {
        const count = await prisma.anime.count();
        return reply.status(200).send({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: {
            status: 'connected',
            totalAnime: count,
          },
          version: '1.0.0',
        });
      } catch (err: any) {
        return reply.status(503).send({
          status: 'degraded',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: {
            status: 'disconnected',
            totalAnime: 0,
          },
          version: '1.0.0',
        });
      }
    }
  );
};
