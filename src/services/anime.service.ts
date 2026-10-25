import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { AnimeListQueryType, AnimeItemType, AnimeDetailType } from '../schemas/anime.schema';

export function formatAnimeItem(item: any): AnimeItemType {
  return {
    anisora_id: item.anisora_id.toString(),
    title: item.title,
    type: item.type,
    episodes: item.episodes ?? null,
    status: item.status,
    season: item.season ?? null,
    season_year: item.season_year ?? null,
    picture: item.picture ?? null,
    thumbnail: item.thumbnail ?? null,
    duration_value: item.duration_value != null ? Number(item.duration_value) : null,
    duration_unit: item.duration_unit ?? null,
    score_agm: item.score_agm != null ? Number(item.score_agm) : null,
    score_mean: item.score_mean != null ? Number(item.score_mean) : null,
    score_median: item.score_median != null ? Number(item.score_median) : null,
    views: item.views != null ? Number(item.views) : 0,
    likes: item.likes != null ? Number(item.likes) : 0,
    sources: Array.isArray(item.sources)
      ? item.sources
      : typeof item.sources === 'string'
      ? JSON.parse(item.sources)
      : [],
    external_ids: {
      hianime_id: item.hianime_id ?? null,
      miruro_id: item.miruro_id ?? null,
      anilist_id: item.anilist_id != null ? item.anilist_id.toString() : null,
      mal_id: item.mal_id != null ? item.mal_id.toString() : null,
      animeplanet_id: item.animeplanet_id ?? null,
      animecountdown_id: item.animecountdown_id != null ? item.animecountdown_id.toString() : null,
      kitsu_id: item.kitsu_id != null ? item.kitsu_id.toString() : null,
      anidb_id: item.anidb_id != null ? item.anidb_id.toString() : null,
      anisearch_id: item.anisearch_id != null ? item.anisearch_id.toString() : null,
      simkl_id: item.simkl_id != null ? item.simkl_id.toString() : null,
      livechart_id: item.livechart_id != null ? item.livechart_id.toString() : null,
      animenewsnetwork_id: item.animenewsnetwork_id != null ? item.animenewsnetwork_id.toString() : null,
    },
    studios: item.anime_studios ? item.anime_studios.map((s: any) => s.studio) : undefined,
    tags: item.anime_tags ? item.anime_tags.map((t: any) => t.tag) : undefined,
    producers: item.anime_producers ? item.anime_producers.map((p: any) => p.producer) : undefined,
    synonyms: item.anime_synonyms ? item.anime_synonyms.map((s: any) => s.synonym) : undefined,
  };
}

export class AnimeService {
  /**
   * Search and list anime with filtering, sorting and pagination
   */
  async listAnime(params: AnimeListQueryType) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.animeWhereInput = {};

    if (params.q) {
      const q = params.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { anime_synonyms: { some: { synonym: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (params.type) {
      where.type = { equals: params.type.toUpperCase() };
    }

    if (params.status) {
      where.status = { equals: params.status.toUpperCase() };
    }

    if (params.season) {
      where.season = { equals: params.season.toUpperCase() };
    }

    if (params.year) {
      where.season_year = params.year;
    }

    if (params.tag) {
      where.anime_tags = {
        some: { tag: { equals: params.tag.toLowerCase(), mode: 'insensitive' } },
      };
    }

    if (params.studio) {
      where.anime_studios = {
        some: { studio: { equals: params.studio.toLowerCase(), mode: 'insensitive' } },
      };
    }

    if (params.producer) {
      where.anime_producers = {
        some: { producer: { equals: params.producer.toLowerCase(), mode: 'insensitive' } },
      };
    }

    if (params.min_score !== undefined || params.max_score !== undefined) {
      where.score_mean = {};
      if (params.min_score !== undefined) {
        where.score_mean.gte = new Prisma.Decimal(params.min_score);
      }
      if (params.max_score !== undefined) {
        where.score_mean.lte = new Prisma.Decimal(params.max_score);
      }
    }

    // Determine sort field and direction
    const sortBy = params.sort_by || 'score_mean';
    const sortOrder = params.sort_order || 'desc';

    const orderBy: Prisma.animeOrderByWithRelationInput = {
      [sortBy]: { sort: sortOrder, nulls: 'last' },
    };

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          anime_studios: true,
          anime_tags: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(formatAnimeItem),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single anime by AniSora ID with complete relationships
   */
  async getAnimeById(idString: string): Promise<AnimeDetailType | null> {
    let id: bigint;
    try {
      id = BigInt(idString);
    } catch {
      return null;
    }

    const item = await prisma.anime.findUnique({
      where: { anisora_id: id },
      include: {
        anime_synonyms: true,
        anime_studios: true,
        anime_producers: true,
        anime_tags: true,
        anime_relations_anime_relations_anisora_idToanime: {
          include: {
            anime_anime_relations_related_anisora_idToanime: true,
          },
        },
        anime_relations_anime_relations_related_anisora_idToanime: {
          include: {
            anime_anime_relations_anisora_idToanime: true,
          },
        },
      },
    });

    if (!item) return null;

    // Collect related anime
    const relationsMap = new Map<string, any>();

    for (const rel of item.anime_relations_anime_relations_anisora_idToanime) {
      const target = rel.anime_anime_relations_related_anisora_idToanime;
      if (target && !relationsMap.has(target.anisora_id.toString())) {
        relationsMap.set(target.anisora_id.toString(), {
          anisora_id: target.anisora_id.toString(),
          title: target.title,
          type: target.type,
          status: target.status,
          picture: target.picture,
          thumbnail: target.thumbnail,
          score_mean: target.score_mean != null ? Number(target.score_mean) : null,
        });
      }
    }

    for (const rel of item.anime_relations_anime_relations_related_anisora_idToanime) {
      const target = rel.anime_anime_relations_anisora_idToanime;
      if (target && !relationsMap.has(target.anisora_id.toString())) {
        relationsMap.set(target.anisora_id.toString(), {
          anisora_id: target.anisora_id.toString(),
          title: target.title,
          type: target.type,
          status: target.status,
          picture: target.picture,
          thumbnail: target.thumbnail,
          score_mean: target.score_mean != null ? Number(target.score_mean) : null,
        });
      }
    }

    const baseItem = formatAnimeItem(item);

    return {
      ...baseItem,
      synonyms: item.anime_synonyms.map((s) => s.synonym),
      studios: item.anime_studios.map((s) => s.studio),
      producers: item.anime_producers.map((p) => p.producer),
      tags: item.anime_tags.map((t) => t.tag),
      relations: Array.from(relationsMap.values()),
    };
  }

  /**
   * Find an anime by an external provider ID
   */
  async getAnimeByProvider(provider: string, providerId: string): Promise<AnimeDetailType | null> {
    const where: Prisma.animeWhereInput = {};

    switch (provider.toLowerCase()) {
      case 'mal':
        try {
          where.mal_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'anilist':
        try {
          where.anilist_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'kitsu':
        try {
          where.kitsu_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'anidb':
        try {
          where.anidb_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'anisearch':
        try {
          where.anisearch_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'simkl':
        try {
          where.simkl_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'livechart':
        try {
          where.livechart_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'animecountdown':
        try {
          where.animecountdown_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'ann':
        try {
          where.animenewsnetwork_id = BigInt(providerId);
        } catch {
          return null;
        }
        break;
      case 'hianime':
        where.hianime_id = providerId;
        break;
      case 'miruro':
        where.miruro_id = providerId;
        break;
      case 'animeplanet':
        where.animeplanet_id = providerId;
        break;
      default:
        return null;
    }

    const item = await prisma.anime.findFirst({
      where,
      select: { anisora_id: true },
    });

    if (!item) return null;

    return this.getAnimeById(item.anisora_id.toString());
  }

  /**
   * Get a random anime recommendation
   */
  async getRandomAnime(filter?: { type?: string; min_score?: number }): Promise<AnimeDetailType | null> {
    const where: Prisma.animeWhereInput = {};

    if (filter?.type) {
      where.type = { equals: filter.type.toUpperCase() };
    }
    if (filter?.min_score !== undefined) {
      where.score_mean = { gte: new Prisma.Decimal(filter.min_score) };
    }

    const count = await prisma.anime.count({ where });
    if (count === 0) return null;

    const randomOffset = Math.floor(Math.random() * count);
    const item = await prisma.anime.findFirst({
      where,
      skip: randomOffset,
      select: { anisora_id: true },
    });

    if (!item) return null;

    return this.getAnimeById(item.anisora_id.toString());
  }

  /**
   * Increment view count for an anime
   */
  async incrementViews(idString: string): Promise<{ views: number } | null> {
    try {
      const id = BigInt(idString);
      const updated = await prisma.anime.update({
        where: { anisora_id: id },
        data: { views: { increment: 1 } },
        select: { views: true },
      });
      return { views: Number(updated.views) };
    } catch {
      return null;
    }
  }

  /**
   * Increment or decrement likes count for an anime
   */
  async updateLikes(idString: string, change: 1 | -1 = 1): Promise<{ likes: number } | null> {
    try {
      const id = BigInt(idString);
      const updated = await prisma.anime.update({
        where: { anisora_id: id },
        data: { likes: { increment: change } },
        select: { likes: true },
      });
      return { likes: Number(updated.likes) };
    } catch {
      return null;
    }
  }
}

export const animeService = new AnimeService();
