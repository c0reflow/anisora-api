import { FastifyPluginAsync } from 'fastify';
import { AnimeLookupService } from '../services/anime-lookup.service';
import { HomeAdminService, HOME_SECTIONS } from '../services/home-admin.service';
import { config } from '../config/env';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Pre-handler hook to optionally verify API key for administrative mutations if configured
  const verifyAdmin = async (req: any, reply: any) => {
    const authHeader = req.headers['x-admin-key'] || req.headers['authorization'];
    const apiKey = authHeader ? String(authHeader).replace(/^Bearer\s+/i, '') : null;
    if (config.adminApiKey && apiKey && apiKey !== config.adminApiKey) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid Admin API Key' });
    }
  };

  // 1. Get all available sections
  app.get('/sections', async () => {
    return {
      success: true,
      sections: HOME_SECTIONS,
    };
  });

  // 2. Lookup anime details automatically by Anisora ID
  app.get('/lookup/:anisora_id', async (req, reply) => {
    const { anisora_id } = req.params as { anisora_id: string };
    if (!anisora_id) {
      return reply.status(400).send({ error: 'Anisora ID is required' });
    }

    try {
      const anime = await AnimeLookupService.getById(anisora_id);
      if (!anime) {
        return reply.status(404).send({ error: `Anime with Anisora ID '${anisora_id}' not found in database.` });
      }
      return {
        success: true,
        anime,
      };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({ error: err.message || 'Lookup failed' });
    }
  });

  // 3. Get items of a specific section (e.g. spotlight, trending, top_airing)
  app.get('/section/:section', async (req, reply) => {
    const { section } = req.params as { section: string };
    try {
      const items = await HomeAdminService.getSection(section);
      return {
        success: true,
        section,
        count: items.length,
        items,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 4. Add anime to section by Anisora ID (auto-fetches all anime data)
  app.post('/section/:section/add', { preHandler: verifyAdmin }, async (req, reply) => {
    const { section } = req.params as { section: string };
    const body = (req.body as any) || {};
    const anisoraId = body.anisora_id || body.id;
    const position = body.position !== undefined ? Number(body.position) : 0; // 0 = prepend to top

    if (!anisoraId) {
      return reply.status(400).send({ error: 'Missing required field: anisora_id' });
    }

    try {
      const animeCard = await AnimeLookupService.getById(String(anisoraId));
      if (!animeCard) {
        return reply.status(404).send({ error: `Anime with ID '${anisoraId}' not found.` });
      }

      // Merge any optional custom overrides if supplied (e.g. custom banner, badge)
      const mergedCard = {
        ...animeCard,
        ...(body.banner ? { banner: body.banner } : {}),
        ...(body.poster ? { poster: body.poster } : {}),
      };

      const updatedList = await HomeAdminService.addItemToSection(section, mergedCard, position);

      return {
        success: true,
        message: `Successfully added '${mergedCard.title}' to ${section}`,
        added: mergedCard,
        items: updatedList,
      };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // 5. Remove an anime from a section
  app.delete('/section/:section/:id', { preHandler: verifyAdmin }, async (req, reply) => {
    const { section, id } = req.params as { section: string; id: string };
    try {
      const updatedList = await HomeAdminService.removeItemFromSection(section, id);
      return {
        success: true,
        message: `Removed ${id} from ${section}`,
        items: updatedList,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 6. Reorder items in a section (drag & drop or move up/down)
  app.post('/section/:section/reorder', { preHandler: verifyAdmin }, async (req, reply) => {
    const { section } = req.params as { section: string };
    const body = (req.body as any) || {};
    const orderedIds = body.ordered_ids;

    if (!Array.isArray(orderedIds)) {
      return reply.status(400).send({ error: 'ordered_ids array is required' });
    }

    try {
      const updatedList = await HomeAdminService.reorderSection(section, orderedIds);
      return {
        success: true,
        message: `Updated order for ${section}`,
        items: updatedList,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};

