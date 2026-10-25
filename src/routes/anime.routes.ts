import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { animeService } from '../services/anime.service';
import {
  AnimeListQuerySchema,
  AnimeListResponseSchema,
  AnimeDetailSchema,
  AnimeIdParamSchema,
  AnimeProviderParamSchema,
  RandomAnimeQuerySchema,
  AnimeRelationSummarySchema,
} from '../schemas/anime.schema';
import { ErrorResponseSchema } from '../schemas/common.schema';

export const animeRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * GET /api/v1/anime - Search & list anime
   */
  app.get(
    '/',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Search and filter anime list',
        description:
          'Returns a paginated list of anime matching filter criteria such as keyword, type, status, season, year, studio, tag, and score ranges.',
        querystring: AnimeListQuerySchema,
        response: {
          200: AnimeListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await animeService.listAnime(req.query);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/anime/random - Get a random anime recommendation
   */
  app.get(
    '/random',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Get a random anime recommendation',
        description: 'Picks a random anime title, with optional filtering by type or minimum score.',
        querystring: RandomAnimeQuerySchema,
        response: {
          200: AnimeDetailSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const anime = await animeService.getRandomAnime(req.query);
      if (!anime) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'No anime found matching criteria',
        });
      }
      return reply.send(anime);
    }
  );

  /**
   * GET /api/v1/anime/by-provider/:provider/:providerId - Lookup by external provider ID
   */
  app.get(
    '/by-provider/:provider/:providerId',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Find anime by external provider ID',
        description:
          'Resolves an AniSora anime using external IDs from MyAnimeList, AniList, Kitsu, HiAnime, Miruro, AnimePlanet, AniDB, AniSearch, Simkl, LiveChart, AnimeCountdown, or ANN.',
        params: AnimeProviderParamSchema,
        response: {
          200: AnimeDetailSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { provider, providerId } = req.params;
      const anime = await animeService.getAnimeByProvider(provider, providerId);
      if (!anime) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Anime with ${provider.toUpperCase()} ID '${providerId}' was not found.`,
        });
      }
      return reply.send(anime);
    }
  );

  /**
   * GET /api/v1/anime/:id - Get anime detail by AniSora ID
   */
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Get anime details by AniSora ID',
        description: 'Retrieves complete metadata, external IDs, synonyms, studios, producers, tags, and direct relations.',
        params: AnimeIdParamSchema,
        response: {
          200: AnimeDetailSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const anime = await animeService.getAnimeById(req.params.id);
      if (!anime) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Anime with AniSora ID '${req.params.id}' was not found.`,
        });
      }
      return reply.send(anime);
    }
  );

  /**
   * GET /api/v1/anime/:id/relations - Get related anime
   */
  app.get(
    '/:id/relations',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Get related anime titles',
        description: 'Returns all anime directly related (prequels, sequels, spin-offs, side stories) to this anime.',
        params: AnimeIdParamSchema,
        response: {
          200: Type.Array(AnimeRelationSummarySchema),
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const anime = await animeService.getAnimeById(req.params.id);
      if (!anime) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Anime with AniSora ID '${req.params.id}' was not found.`,
        });
      }
      return reply.send(anime.relations);
    }
  );

  /**
   * POST /api/v1/anime/:id/view - Increment anime views counter
   */
  app.post(
    '/:id/view',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Increment anime views count',
        description: 'Records a new view for the specified anime title.',
        params: AnimeIdParamSchema,
        response: {
          200: Type.Object({ views: Type.Integer({ description: 'Updated views count' }) }),
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const res = await animeService.incrementViews(req.params.id);
      if (!res) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Anime with ID '${req.params.id}' was not found.`,
        });
      }
      return reply.send(res);
    }
  );

  /**
   * POST /api/v1/anime/:id/like - Increment anime likes counter
   */
  app.post(
    '/:id/like',
    {
      schema: {
        tags: ['Anime'],
        summary: 'Increment anime likes count',
        description: 'Records a like for the specified anime title.',
        params: AnimeIdParamSchema,
        response: {
          200: Type.Object({ likes: Type.Integer({ description: 'Updated likes count' }) }),
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const res = await animeService.updateLikes(req.params.id, 1);
      if (!res) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Anime with ID '${req.params.id}' was not found.`,
        });
      }
      return reply.send(res);
    }
  );
};
