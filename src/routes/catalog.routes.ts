import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { catalogService } from '../services/catalog.service';
import { metaService } from '../services/meta.service';
import {
  CatalogResponseSchema,
  LatestEpisodesResponseSchema,
  TopTenResponseSchema,
  ScheduleResponseSchema,
  AnimeEpisodesResponseSchema,
  AzQuerySchema,
} from '../schemas/catalog.schema';
import { MetaListResponseSchema } from '../schemas/meta.schema';
import { PaginationQuerySchema, ErrorResponseSchema } from '../schemas/common.schema';

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * GET /trending (or /tranding) - AniList trending resolved in our DB with local fallback
   */
  const handleTrending = async (req: any, reply: any) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const result = await catalogService.getTrending(page, limit);
    return reply.send(result);
  };

  app.get(
    '/trending',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Trending anime',
        description: 'Trending anime resolved by AniList ID in our local database with local fallback and caching.',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    handleTrending
  );

  app.get(
    '/tranding',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Trending anime (alias)',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    handleTrending
  );

  /**
   * GET /top-airing - Ongoing TV series
   */
  app.get(
    '/top-airing',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Top airing anime',
        description: 'Ongoing TV anime series sorted by score.',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getTopAiring(req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * GET /most-popular - Highest views
   */
  app.get(
    '/most-popular',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Most popular anime',
        description: 'Anime titles ordered by total views.',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getMostPopular(req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * GET /most-favorite - Highest likes
   */
  app.get(
    '/most-favorite',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Most favorite anime',
        description: 'Anime titles ordered by user likes.',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getMostFavorite(req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * GET /latest-completed - Recently finished series
   */
  app.get(
    '/latest-completed',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Latest completed anime',
        description: 'Finished anime series sorted by latest season and score.',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getLatestCompleted(req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * GET /top-upcoming - Top upcoming anime
   */
  app.get(
    '/top-upcoming',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Top upcoming anime',
        description: 'Upcoming scheduled anime releases.',
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getTopUpcoming(req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * GET /top-ten (or /top-10) - Top 10 anime ranking
   */
  const handleTopTen = async (req: any, reply: any) => {
    const period = req.query.period || 'week';
    const result = await catalogService.getTopTen(period);
    return reply.send(result);
  };

  app.get(
    '/top-ten',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Top 10 anime leaderboard',
        description: 'Ranked top 10 anime for week, month, or year.',
        querystring: Type.Object({
          period: Type.Optional(
            Type.Union([Type.Literal('week'), Type.Literal('month'), Type.Literal('year')], {
              default: 'week',
            })
          ),
        }),
        response: { 200: TopTenResponseSchema },
      },
    },
    handleTopTen
  );

  app.get(
    '/top-10',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Top 10 anime leaderboard (alias)',
        querystring: Type.Object({
          period: Type.Optional(
            Type.Union([Type.Literal('week'), Type.Literal('month'), Type.Literal('year')], {
              default: 'week',
            })
          ),
        }),
        response: { 200: TopTenResponseSchema },
      },
    },
    handleTopTen
  );

  /**
   * GET /latest-episodes (or /latest-episode) - Recently released episodes with AnisoraId&ep=int
   */
  const handleLatestEpisodes = async (req: any, reply: any) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const result = await catalogService.getLatestEpisodes(page, limit);
    return reply.send(result);
  };

  app.get(
    '/latest-episodes',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Latest aired episodes',
        description: 'Recently aired episodes mapped with AnisoraId&ep=int episode IDs.',
        querystring: PaginationQuerySchema,
        response: { 200: LatestEpisodesResponseSchema },
      },
    },
    handleLatestEpisodes
  );

  app.get(
    '/latest-episode',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Latest aired episodes (alias)',
        querystring: PaginationQuerySchema,
        response: { 200: LatestEpisodesResponseSchema },
      },
    },
    handleLatestEpisodes
  );

  /**
   * GET /schedule - Estimated Airing Schedule for date
   */
  app.get(
    '/schedule',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Estimated airing schedule',
        description: 'Airing schedule for a given date (defaults to current day).',
        querystring: Type.Object({
          date: Type.Optional(Type.String({ description: 'Date in YYYY-MM-DD format', example: '2026-10-25' })),
        }),
        response: { 200: ScheduleResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getEstimatedSchedule(req.query.date);
      return reply.send(result);
    }
  );

  /**
   * GET /az-list - Filter by letter
   */
  app.get(
    '/az-list',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'A-Z anime list',
        description: 'Filter anime alphabetically (A-Z, 0-9, or all).',
        querystring: AzQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getAzList(req.query.letter, req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * GET /genres - List of all genres with anime counts
   */
  app.get(
    '/genres',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'List all genres',
        description: 'Returns available anime genres and tags with counts.',
        querystring: PaginationQuerySchema,
        response: { 200: MetaListResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await metaService.getTags(req.query);
      return reply.send(result);
    }
  );

  /**
   * GET /genre/:genre - Filter by genre
   */
  app.get(
    '/genre/:genre',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Anime by genre',
        description: 'Filter anime by specific genre name.',
        params: Type.Object({
          genre: Type.String({ description: 'Genre or tag name', example: 'action' }),
        }),
        querystring: PaginationQuerySchema,
        response: { 200: CatalogResponseSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getByGenre(req.params.genre, req.query.page, req.query.limit);
      return reply.send(result);
    }
  );

  /**
   * Format Specific: /movie, /ova, /ona, /special
   */
  const registerFormat = (path: string, type: 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL', label: string) => {
    app.get(
      path,
      {
        schema: {
          tags: ['Catalog'],
          summary: `${label} list`,
          description: `All anime of format ${label} without external API overhead.`,
          querystring: PaginationQuerySchema,
          response: { 200: CatalogResponseSchema },
        },
      },
      async (req, reply) => {
        const result = await catalogService.getByType(type, req.query.page, req.query.limit);
        return reply.send(result);
      }
    );
  };

  registerFormat('/movie', 'MOVIE', 'Movie');
  registerFormat('/movies', 'MOVIE', 'Movie (alias)');
  registerFormat('/ova', 'OVA', 'OVA');
  registerFormat('/ona', 'ONA', 'ONA');
  registerFormat('/special', 'SPECIAL', 'Special');

  /**
   * GET /episodes/:id - Get episode list by Anisora ID
   */
  app.get(
    '/episodes/:id',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Get episode list for anime',
        description: 'Returns all episode IDs (formatted as AnisoraId&ep=int) for an anime.',
        params: Type.Object({
          id: Type.String({ description: 'AniSora Anime ID' }),
        }),
        response: {
          200: AnimeEpisodesResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await catalogService.getAnimeEpisodes(req.params.id);
      if (!result) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Anime with ID '${req.params.id}' was not found.`,
        });
      }
      return reply.send(result);
    }
  );
};
