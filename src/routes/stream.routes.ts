import { FastifyPluginAsync } from 'fastify';
import { StreamService, AVAILABLE_SERVERS } from '../services/stream.service';

export const streamRoutes: FastifyPluginAsync = async (app) => {
  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/anisora/servers
  //   Supports query params and path params:
  //   - /servers?anisora_id=...&episode=...&type=sub|dub
  //   - /servers?anisora_id=... (defaults episode to 1, type to sub)
  //   - /servers/:anisora_id
  //   - /servers/:anisora_id/:episode
  // ───────────────────────────────────────────────────────────────────
  const handleServers = async (req: any, reply: any) => {
    const q = (req.query as any) || {};
    const p = (req.params as any) || {};

    const anisoraId = p.anisora_id || p.id || q.anisora_id || q.id;
    const rawEp = p.episode || p.ep || q.episode || q.ep;
    const episode = rawEp !== undefined && rawEp !== null && rawEp !== '' ? Number(rawEp) : 1;
    const type = q.type || p.type || 'sub';

    if (!anisoraId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required parameter: anisora_id',
      });
    }

    try {
      const servers = StreamService.getServers();
      return reply.send({
        success: true,
        anisora_id: String(anisoraId),
        episode: isNaN(episode) ? 1 : episode,
        type,
        servers,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to list servers',
      });
    }
  };

  app.get('/servers', handleServers);
  app.get('/servers/:anisora_id', handleServers);
  app.get('/servers/:anisora_id/:episode', handleServers);

  // ───────────────────────────────────────────────────────────────────
  // GET /api/v1/anisora/stream
  //   Supports query params and path params:
  //   - /stream?anisora_id=...&episode=...&server=megaplay|zokoanime|...&type=sub|dub
  //   - /stream?anisora_id=... (defaults episode=1, server=megaplay, type=sub)
  //   - /stream/:anisora_id
  //   - /stream/:anisora_id/:episode
  //   - /stream/:anisora_id/:episode/:server
  // ───────────────────────────────────────────────────────────────────
  const handleStream = async (req: any, reply: any) => {
    const q = (req.query as any) || {};
    const p = (req.params as any) || {};

    const anisoraId = p.anisora_id || p.id || q.anisora_id || q.id;
    const rawEp = p.episode || p.ep || q.episode || q.ep;
    const episode = rawEp !== undefined && rawEp !== null && rawEp !== '' ? Number(rawEp) : 1;
    const server = p.server || q.server || 'megaplay';
    const rawType = q.type || p.type || 'sub';
    const subDub = (rawType === 'dub' ? 'dub' : 'sub') as 'sub' | 'dub';

    if (!anisoraId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required parameter: anisora_id',
      });
    }

    // Validate server name
    const validServerIds = AVAILABLE_SERVERS.map((s) => s.id);
    if (!validServerIds.includes(server)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid server '${server}'. Valid servers: ${validServerIds.join(', ')}`,
      });
    }

    try {
      const epNum = isNaN(episode) ? 1 : episode;
      const stream = await StreamService.getStream(
        anisoraId,
        epNum,
        server,
        subDub
      );

      return reply.send({
        success: true,
        anisora_id: String(anisoraId),
        episode: epNum,
        ...stream,
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to extract stream',
      });
    }
  };

  app.get('/stream', handleStream);
  app.get('/stream/:anisora_id', handleStream);
  app.get('/stream/:anisora_id/:episode', handleStream);
  app.get('/stream/:anisora_id/:episode/:server', handleStream);
};

