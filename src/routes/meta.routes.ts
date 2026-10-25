import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { metaService } from '../services/meta.service';
import {
  MetaListResponseSchema,
  MetaSearchQuerySchema,
  StatsResponseSchema,
} from '../schemas/meta.schema';
import { ErrorResponseSchema } from '../schemas/common.schema';

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * GET /api/v1/meta/tags - List tags with anime counts
   */
  app.get(
    '/tags',
    {
      schema: {
        tags: ['Metadata'],
        summary: 'List anime tags and genres',
        description: 'Returns all anime tags/genres sorted by frequency with search and pagination.',
        querystring: MetaSearchQuerySchema,
        response: {
          200: MetaListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await metaService.getTags(req.query);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/meta/studios - List studios with anime counts
   */
  app.get(
    '/studios',
    {
      schema: {
        tags: ['Metadata'],
        summary: 'List animation studios',
        description: 'Returns all animation production studios sorted by frequency with search and pagination.',
        querystring: MetaSearchQuerySchema,
        response: {
          200: MetaListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await metaService.getStudios(req.query);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/meta/producers - List producers with anime counts
   */
  app.get(
    '/producers',
    {
      schema: {
        tags: ['Metadata'],
        summary: 'List anime producers',
        description: 'Returns all anime producers sorted by frequency with search and pagination.',
        querystring: MetaSearchQuerySchema,
        response: {
          200: MetaListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await metaService.getProducers(req.query);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/meta/stats - Overall database metrics
   */
  app.get(
    '/stats',
    {
      schema: {
        tags: ['Metadata'],
        summary: 'Database statistics & breakdowns',
        description:
          'Provides total counts and categorized breakdowns by format types, release statuses, and seasons.',
        response: {
          200: StatsResponseSchema,
        },
      },
    },
    async (_req, reply) => {
      const stats = await metaService.getStats();
      return reply.send(stats);
    }
  );
};
