import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { searchService } from '../services/search.service';
import {
  AnimeSearchResponseSchema,
  AnimeSuggestionResponseSchema,
  SearchQuerySchema,
} from '../schemas/search.schema';
import { ErrorResponseSchema } from '../schemas/common.schema';

/**
 * Route plugin for /search
 */
export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * GET /search - Search anime by name
   */
  app.get(
    '/',
    {
      schema: {
        tags: ['Search'],
        summary: 'Search anime by name',
        description:
          'Fast search by anime title or synonyms. Returns total episodes, title, poster, description, type (movie/series), duration, score, and 1st tag.',
        querystring: SearchQuerySchema,
        response: {
          200: AnimeSearchResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await searchService.searchByName(req.query);
      return reply.send(result);
    }
  );
};

/**
 * Route plugin for /searchsuggestion
 */
export const searchSuggestionRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * GET /searchsuggestion - Quick top-5 search suggestions (HTTP)
   */
  app.get(
    '/',
    {
      schema: {
        tags: ['Search'],
        summary: 'Instant top-5 search suggestions (HTTP)',
        description:
          'Ultra-fast search suggestions endpoint returning only the top 5 matches for autocomplete searchbars.',
        querystring: Type.Object({
          query: Type.Optional(Type.String({ description: 'Search keyword query' })),
          q: Type.Optional(Type.String({ description: 'Alias for query' })),
        }),
        response: {
          200: AnimeSuggestionResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const query = req.query.query || req.query.q || '';
      const result = await searchService.getSuggestions(query);
      return reply.send(result);
    }
  );

  /**
   * WebSocket: GET /searchsuggestion/ws - Real-time autocomplete suggestions over WebSocket
   */
  app.get(
    '/ws',
    { websocket: true },
    (socket, _req) => {
      socket.on('message', async (message: any) => {
        try {
          const raw = message.toString();
          let term = raw;
          try {
            const parsed = JSON.parse(raw);
            term = parsed.query || parsed.q || raw;
          } catch {
            term = raw;
          }

          const results = await searchService.getSuggestions(term);
          socket.send(JSON.stringify(results));
        } catch (err: any) {
          socket.send(JSON.stringify({ error: err.message || 'Search error' }));
        }
      });
    }
  );
};
