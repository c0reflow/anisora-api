import prisma from '../db/prisma';
import { StatsResponseType } from '../schemas/meta.schema';

export class MetaService {
  /**
   * List popular/searched tags with anime counts
   */
  async getTags(params: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where = params.q
      ? { tag: { contains: params.q.trim().toLowerCase(), mode: 'insensitive' as const } }
      : {};

    const [grouped, totalDistinct] = await Promise.all([
      prisma.anime_tags.groupBy({
        by: ['tag'],
        where,
        _count: { anisora_id: true },
        orderBy: { _count: { anisora_id: 'desc' } },
        skip,
        take: limit,
      }),
      prisma.anime_tags.groupBy({
        by: ['tag'],
        where,
      }),
    ]);

    const total = totalDistinct.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: grouped.map((g) => ({
        name: g.tag,
        count: g._count.anisora_id,
      })),
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
   * List animation studios with anime counts
   */
  async getStudios(params: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where = params.q
      ? { studio: { contains: params.q.trim().toLowerCase(), mode: 'insensitive' as const } }
      : {};

    const [grouped, totalDistinct] = await Promise.all([
      prisma.anime_studios.groupBy({
        by: ['studio'],
        where,
        _count: { anisora_id: true },
        orderBy: { _count: { anisora_id: 'desc' } },
        skip,
        take: limit,
      }),
      prisma.anime_studios.groupBy({
        by: ['studio'],
        where,
      }),
    ]);

    const total = totalDistinct.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: grouped.map((g) => ({
        name: g.studio,
        count: g._count.anisora_id,
      })),
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
   * List producers with anime counts
   */
  async getProducers(params: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where = params.q
      ? { producer: { contains: params.q.trim().toLowerCase(), mode: 'insensitive' as const } }
      : {};

    const [grouped, totalDistinct] = await Promise.all([
      prisma.anime_producers.groupBy({
        by: ['producer'],
        where,
        _count: { anisora_id: true },
        orderBy: { _count: { anisora_id: 'desc' } },
        skip,
        take: limit,
      }),
      prisma.anime_producers.groupBy({
        by: ['producer'],
        where,
      }),
    ]);

    const total = totalDistinct.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: grouped.map((g) => ({
        name: g.producer,
        count: g._count.anisora_id,
      })),
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
   * Get overall database statistics and breakdowns
   */
  async getStats(): Promise<StatsResponseType> {
    const [
      totalAnime,
      studiosCount,
      producersCount,
      tagsCount,
      typesGroup,
      statusGroup,
      seasonsGroup,
    ] = await Promise.all([
      prisma.anime.count(),
      prisma.anime_studios.groupBy({ by: ['studio'] }),
      prisma.anime_producers.groupBy({ by: ['producer'] }),
      prisma.anime_tags.groupBy({ by: ['tag'] }),
      prisma.anime.groupBy({
        by: ['type'],
        _count: { anisora_id: true },
      }),
      prisma.anime.groupBy({
        by: ['status'],
        _count: { anisora_id: true },
      }),
      prisma.anime.groupBy({
        by: ['season'],
        where: { season: { not: null } },
        _count: { anisora_id: true },
      }),
    ]);

    const typesBreakdown: Record<string, number> = {};
    for (const t of typesGroup) {
      typesBreakdown[t.type] = t._count.anisora_id;
    }

    const statusesBreakdown: Record<string, number> = {};
    for (const s of statusGroup) {
      statusesBreakdown[s.status] = s._count.anisora_id;
    }

    const seasonsBreakdown: Record<string, number> = {};
    for (const s of seasonsGroup) {
      if (s.season) {
        seasonsBreakdown[s.season] = s._count.anisora_id;
      }
    }

    return {
      total_anime: totalAnime,
      total_studios: studiosCount.length,
      total_producers: producersCount.length,
      total_tags: tagsCount.length,
      types_breakdown: typesBreakdown,
      statuses_breakdown: statusesBreakdown,
      seasons_breakdown: seasonsBreakdown,
    };
  }
}

export const metaService = new MetaService();
