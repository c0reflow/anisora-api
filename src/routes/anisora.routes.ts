import { FastifyPluginAsync } from 'fastify';
import { AnisoraService, FilterOptions } from '../services/anisora.service';
import { HomeAdminService } from '../services/home-admin.service';

export const anisoraRoutes: FastifyPluginAsync = async (app) => {
  // 1. /api/v1/anisora/home - returns full home response
  app.get('/home', async (_req, reply) => {
    try {
      const data = await HomeAdminService.getHomeData();
      return reply.send({
        success: true,
        data,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to fetch home data',
      });
    }
  });

  // 2. /api/v1/anisora/anime - Supports POST body OR GET query / parameter
  app.all('/anime', async (req, reply) => {
    const body = (req.body as any) || {};
    const query = (req.query as any) || {};
    const anisoraId = body.anisora_id || body.id || query.anisora_id || query.id;

    if (!anisoraId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required field: anisora_id or id (in query or body)',
      });
    }

    try {
      const anime = await AnisoraService.getAnimeById(anisoraId);
      if (!anime) {
        return reply.status(404).send({
          success: false,
          error: `Anime with Anisora ID '${anisoraId}' not found.`,
        });
      }

      return reply.send({
        success: true,
        anime,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to fetch anime data',
      });
    }
  });

  // Also support GET /api/v1/anisora/anime/:id as convenience
  app.get('/anime/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const anime = await AnisoraService.getAnimeById(id);
      if (!anime) {
        return reply.status(404).send({
          success: false,
          error: `Anime with Anisora ID '${id}' not found.`,
        });
      }
      return reply.send({
        success: true,
        anime,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 3. /api/v1/anisora/filter - filter by type, status, season, year, genre, order, sort, etc.
  app.get('/filter', async (req, reply) => {
    const q = (req.query as any) || {};

    const options: FilterOptions = {
      type: q.type,
      status: q.status,
      season: q.season,
      year: q.year ? parseInt(q.year, 10) : undefined,
      genre: q.genre || q.genres,
      tag: q.tag || q.tags,
      order: q.order || q.sort_by || 'popular',
      sort: q.sort === 'asc' ? 'asc' : 'desc',
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? parseInt(q.limit, 10) : 24,
    };

    try {
      const data = await AnisoraService.filterAnimes(options);
      return reply.send({
        success: true,
        ...data,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to filter anime',
      });
    }
  });

  // 4. /api/v1/anisora/search - comprehensive search
  app.get('/search', async (req, reply) => {
    const q = (req.query as any) || {};
    const queryStr = q.q || q.keyword || q.title || '';
    const page = q.page ? parseInt(q.page, 10) : 1;
    const limit = q.limit ? parseInt(q.limit, 10) : 20;

    try {
      const data = await AnisoraService.search(queryStr, page, limit);
      return reply.send({
        success: true,
        query: queryStr,
        ...data,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 5. /api/v1/anisora/search-suggestion - fast autocomplete/dropdown search suggestions
  app.get('/search-suggestion', async (req, reply) => {
    const q = (req.query as any) || {};
    const queryStr = q.q || q.keyword || q.query || '';
    const limit = q.limit ? parseInt(q.limit, 10) : 8;

    try {
      const suggestions = await AnisoraService.searchSuggestions(queryStr, limit);
      return reply.send({
        success: true,
        suggestions,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 6. /api/v1/anisora/Az-list - get anime list alphabetically (A-Z, 0-9, or other)
  app.get('/Az-list', async (req, reply) => {
    const q = (req.query as any) || {};
    const letter = q.letter || q.char || 'A';
    const page = q.page ? parseInt(q.page, 10) : 1;
    const limit = q.limit ? parseInt(q.limit, 10) : 24;

    try {
      const data = await AnisoraService.getAzList(letter, page, limit);
      return reply.send({
        success: true,
        ...data,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // Support /Az-list/:letter route format as well
  app.get('/Az-list/:letter', async (req, reply) => {
    const { letter } = req.params as { letter: string };
    const q = (req.query as any) || {};
    const page = q.page ? parseInt(q.page, 10) : 1;
    const limit = q.limit ? parseInt(q.limit, 10) : 24;

    try {
      const data = await AnisoraService.getAzList(letter, page, limit);
      return reply.send({
        success: true,
        ...data,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });
};

