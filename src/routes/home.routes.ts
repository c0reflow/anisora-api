import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { homeService } from '../services/home.service';
import { HomeResponseSchema, HomeSyncResponseSchema } from '../schemas/home.schema';
import { ErrorResponseSchema } from '../schemas/common.schema';
import { config } from '../config/env';

export const homeRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * Helper to verify Admin API Key from Authorization header (Bearer token),
   * x-admin-key header, or query param.
   */
  const verifyAdminAuth = (req: any): boolean => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token === config.adminApiKey) return true;
    }

    const xAdminKey = req.headers['x-admin-key'];
    if (xAdminKey && xAdminKey === config.adminApiKey) return true;

    const queryKey = req.query?.api_key || req.query?.token;
    if (queryKey && queryKey === config.adminApiKey) return true;

    return false;
  };

  /**
   * Main handler for /home:
   * Returns cached daily home data, or triggers sync if ?update=true with Admin Bearer auth
   */
  const handleHomeRequest = async (req: any, reply: any) => {
    const isUpdateRequested =
      req.query?.update !== undefined ||
      req.url.includes('&update') ||
      req.url.includes('?update');

    if (isUpdateRequested) {
      if (!verifyAdminAuth(req)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or missing Admin API key. Please provide Bearer token in Authorization header or x-admin-key header.',
        });
      }

      const syncedData = await homeService.syncHomeData();
      return reply.send(syncedData);
    }

    const data = await homeService.getHomeData();
    return reply.send(data);
  };

  // GET /home
  app.get(
    '/home',
    {
      schema: {
        tags: ['Home'],
        summary: 'All-in-one curated home page data',
        description:
          'Returns cached daily home page data stored in PostgreSQL (Spotlight with banners, Trending, Top Airing, Most Popular, Most Favorite, Latest Completed, Genres, Latest Episode, New on AniSora, Estimated Schedule, Top 10, Top Upcoming, Latest Comments). Use ?update=true with Bearer admin API key to sync fresh data from AniList.',
        querystring: Type.Object({
          update: Type.Optional(
            Type.Boolean({
              description: 'Set to true to trigger admin sync with AniList (Requires Bearer token)',
            })
          ),
          api_key: Type.Optional(
            Type.String({
              description: 'Optional admin API key if not passing Bearer token',
            })
          ),
        }),
        response: {
          200: HomeResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    handleHomeRequest
  );

  // Alias route for GET /home&update
  app.get(
    '/home&update',
    {
      schema: {
        tags: ['Home'],
        summary: 'Home sync alias (requires Admin Bearer token)',
        description: 'Direct alias for /home?update=true',
        response: {
          200: HomeResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      if (!verifyAdminAuth(req)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or missing Admin API key. Please provide Bearer token in Authorization header.',
        });
      }
      const synced = await homeService.syncHomeData();
      return reply.send(synced);
    }
  );

  // Dedicated POST /home/sync for admin sync
  app.post(
    '/home/sync',
    {
      schema: {
        tags: ['Home'],
        summary: 'Admin sync home data with AniList & Local DB',
        description:
          'Forces a full rebuild and save of home data into the PostgreSQL home table. Requires Bearer admin API key.',
        response: {
          200: HomeSyncResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      if (!verifyAdminAuth(req)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or missing Admin API key. Please provide Bearer token in Authorization header.',
        });
      }

      const freshData = await homeService.syncHomeData();
      return reply.send({
        success: true,
        message: 'Home data successfully synced with AniList and stored in PostgreSQL.',
        data: freshData,
      });
    }
  );
};
