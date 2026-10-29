import { FastifyPluginAsync } from 'fastify';
import { AnilistService } from '../services/anilist.service';
import { MalEpisodeScraperService } from '../services/mal-episodes.service';

export const anilistRoutes: FastifyPluginAsync = async (app) => {
  // /api/v1/anilist/anime - fetch complete AniList data by anisora_id (supports POST or GET query/param)
  app.all('/anime', async (req, reply) => {
    const body = (req.body as any) || {};
    const query = (req.query as any) || {};
    const anisoraId = body.anisora_id || body.id || query.anisora_id || query.id;

    if (!anisoraId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required parameter: anisora_id',
      });
    }

    try {
      const data = await AnilistService.getAnimeDetails(anisoraId);
      return reply.send({
        success: true,
        data,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(404).send({
        success: false,
        error: err.message || 'Failed to fetch AniList anime details',
      });
    }
  });

  // /api/v1/anilist/episodes - scrapes MyAnimeList episodes with pagination, offset, and stores into anime_episodes DB table
  app.all('/episodes', async (req, reply) => {
    const body = (req.body as any) || {};
    const query = (req.query as any) || {};
    const anisoraId = body.anisora_id || body.id || query.anisora_id || query.id;
    const startOrOffset = query.offset !== undefined ? query.offset : query.start !== undefined ? query.start : body.offset !== undefined ? body.offset : body.start;
    const offset = startOrOffset !== undefined ? Math.max(0, parseInt(startOrOffset, 10)) : 0;

    if (!anisoraId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required parameter: anisora_id',
      });
    }

    try {
      const data = await MalEpisodeScraperService.getAndSaveEpisodes(anisoraId, offset);
      return reply.send({
        success: true,
        data,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(404).send({
        success: false,
        error: err.message || 'Failed to fetch episodes',
      });
    }
  });
};


