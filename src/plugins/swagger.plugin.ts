import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'AniSora Anime Database API',
        description:
          'High-performance, production-ready REST API for 41,000+ anime titles. Features cross-provider ID mapping (MAL, AniList, Kitsu, etc.), rich filtering, relationships, tags, and database aggregation.',
        version: '1.0.0',
        contact: {
          name: 'AniSora API Team',
        },
      },
      servers: [
        {
          url: '/',
          description: 'Current Environment Server',
        },
      ],
      tags: [
        { name: 'Search', description: 'Optimized anime search by name and quick top-5 autocomplete suggestions' },
        { name: 'Anime', description: 'Anime search, listing, details, and cross-provider resolution' },
        { name: 'Comments', description: 'Episode comments, replies, and discussion threads' },
        { name: 'Users', description: 'User account management and profiles' },
        { name: 'Metadata', description: 'Tags, studios, producers, and database breakdown statistics' },
        { name: 'Health', description: 'API health and database connectivity diagnostics' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}
