import { prisma } from '../db/prisma';

export interface FilterOptions {
  type?: string;
  status?: string;
  season?: string;
  year?: number;
  genre?: string;
  tag?: string;
  order?: 'popular' | 'score' | 'latest' | 'title' | 'episodes';
  sort?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export class AnisoraService {
  /**
   * Fetch complete saved anime details from DB (all relations, mal_metadata, default_name, studios, producers, tags)
   */
  static async getAnimeById(anisoraIdInput: string | number | bigint) {
    const anisoraId = BigInt(anisoraIdInput);

    const record = await prisma.anime.findUnique({
      where: { anisora_id: anisoraId },
      include: {
        default_name: true,
        mal_metadata: true,
        anime_tags: true,
        anime_studios: true,
        anime_producers: true,
        anime_synonyms: true,
        anime_relations_anime_relations_anisora_idToanime: {
          include: {
            anime_anime_relations_related_anisora_idToanime: {
              select: {
                anisora_id: true,
                title: true,
                picture: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!record) return null;

    // Serialize BigInt safely
    return JSON.parse(
      JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
    );
  }

  /**
   * Search animes with fuzzy-like substring matching across title, default name, synonyms, and romaji
   */
  static async search(query: string, page = 1, limit = 20) {
    const q = query.trim();
    if (!q) return { results: [], total: 0, page, totalPages: 0 };

    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (page - 1) * take;

    const whereClause: any = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { default_name: { name: { contains: q, mode: 'insensitive' } } },
        { default_name: { jname: { contains: q, mode: 'insensitive' } } },
        { mal_metadata: { title_english: { contains: q, mode: 'insensitive' } } },
        { mal_metadata: { title_romaji: { contains: q, mode: 'insensitive' } } },
      ],
    };

    const [total, records] = await Promise.all([
      prisma.anime.count({ where: whereClause }),
      prisma.anime.findMany({
        where: whereClause,
        include: {
          default_name: true,
          mal_metadata: true,
          anime_tags: true,
        },
        orderBy: {
          score_mean: 'desc',
        },
        skip,
        take,
      }),
    ]);

    const results = records.map((a) => this.formatListItem(a));

    return {
      results,
      total,
      page,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Search suggestions (fast, top 10 lightweight results)
   */
  static async searchSuggestions(query: string, limit = 8) {
    const q = query.trim();
    if (!q) return [];

    const take = Math.min(Math.max(limit, 1), 20);

    const records = await prisma.anime.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { default_name: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        anisora_id: true,
        title: true,
        type: true,
        picture: true,
        season_year: true,
        score_mean: true,
        default_name: {
          select: { name: true, jname: true },
        },
      },
      orderBy: {
        score_mean: 'desc',
      },
      take,
    });

    return records.map((r) => ({
      id: r.anisora_id.toString(),
      anisora_id: r.anisora_id.toString(),
      title: r.default_name?.name || r.title,
      jname: r.default_name?.jname || r.title,
      poster: r.picture,
      type: r.type,
      year: r.season_year,
      score: r.score_mean ? Math.round(Number(r.score_mean) * 10) / 10 : null,
    }));
  }

  /**
   * Filter animes with specified order, genres, type, status, season, year, etc.
   */
  static async filterAnimes(options: FilterOptions) {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 24, 1), 50);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.type && options.type.toLowerCase() !== 'all') {
      where.type = { equals: options.type.toUpperCase() };
    }

    if (options.status && options.status.toLowerCase() !== 'all') {
      where.status = { equals: options.status.toUpperCase() };
    }

    if (options.season && options.season.toLowerCase() !== 'all') {
      where.season = { equals: options.season.toUpperCase() };
    }

    if (options.year) {
      where.season_year = options.year;
    }

    if (options.genre || options.tag) {
      const g = (options.genre || options.tag)!.toLowerCase();
      where.anime_tags = {
        some: {
          tag: { contains: g, mode: 'insensitive' },
        },
      };
    }

    // Determine ordering
    let orderBy: any = { score_mean: 'desc' };
    const sortDir = options.sort === 'asc' ? 'asc' : 'desc';

    if (options.order === 'popular') {
      orderBy = { score_agm: sortDir };
    } else if (options.order === 'score') {
      orderBy = { score_mean: sortDir };
    } else if (options.order === 'latest') {
      orderBy = [{ season_year: sortDir }, { anisora_id: sortDir }];
    } else if (options.order === 'title') {
      orderBy = { title: sortDir };
    } else if (options.order === 'episodes') {
      orderBy = { episodes: sortDir };
    }

    const [total, records] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        include: {
          default_name: true,
          mal_metadata: true,
          anime_tags: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      results: records.map((a) => this.formatListItem(a)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filters: options,
    };
  }

  /**
   * AZ-List: Get animes by starting letter (A-Z, 0-9, or 'other')
   */
  static async getAzList(letter: string, page = 1, limit = 24) {
    const l = letter.trim().toUpperCase();
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;

    let where: any = {};

    if (l === '0-9' || l === '09') {
      where = {
        OR: Array.from({ length: 10 }, (_, i) => ({
          title: { startsWith: String(i) },
        })),
      };
    } else if (l === 'OTHER' || l === '#') {
      where = {
        AND: [
          ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((c) => ({
            title: { not: { startsWith: c, mode: 'insensitive' as const } },
          })),
          ...Array.from('0123456789').map((d) => ({
            title: { not: { startsWith: d } },
          })),
        ],
      };
    } else if (/^[A-Z]$/.test(l)) {
      where = {
        title: { startsWith: l, mode: 'insensitive' },
      };
    }

    const [total, records] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        include: {
          default_name: true,
          mal_metadata: true,
          anime_tags: true,
        },
        orderBy: { title: 'asc' },
        skip,
        take,
      }),
    ]);

    return {
      letter: l,
      results: records.map((a) => this.formatListItem(a)),
      total,
      page,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Formats a database record into a sleek anime card
   */
  private static formatListItem(a: any) {
    const title = a.default_name?.name || a.title;
    const jname = a.default_name?.jname || a.title;
    const romaji = a.mal_metadata?.title_romaji || a.title;
    const poster = a.picture || null;
    const scoreVal = a.mal_metadata?.score
      ? Number(a.mal_metadata.score)
      : a.score_mean
      ? Number(a.score_mean)
      : null;
    const tags = a.anime_tags?.map((t: any) => t.tag) || [];

    return {
      id: a.anisora_id.toString(),
      anisora_id: a.anisora_id.toString(),
      title,
      jname,
      romaji,
      poster,
      type: a.type || 'TV',
      status: a.status || 'UNKNOWN',
      episodes: a.episodes || 0,
      season: a.season,
      year: a.season_year,
      score: scoreVal ? Math.round(scoreVal * 10) / 10 : null,
      tags: tags.slice(0, 5),
    };
  }
}

