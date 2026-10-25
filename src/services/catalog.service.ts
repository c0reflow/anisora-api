import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { anilistService } from './anilist.service';
import { formatAnimeType, formatDuration } from './search.service';
import {
  AnimeSearchResultItemType,
  AnimeSearchResultItemSchema,
} from '../schemas/search.schema';
import {
  LatestEpisodeItemType,
  ScheduleEntrySchema,
} from '../schemas/catalog.schema';

export function mapToSearchItem(item: any): AnimeSearchResultItemType {
  const englishTitle = item.default_name?.name || item.title;
  const jpName = item.default_name?.jname || item.title;

  return {
    id: item.anisora_id.toString(),
    title: englishTitle,
    jname: jpName,
    romaji: jpName,
    total_episodes: item.episodes ?? null,
    poster: item.picture || item.thumbnail || null,
    description: item.description ?? null,
    type: formatAnimeType(item.type),
    duration: formatDuration(item.duration_value, item.duration_unit),
    score: item.score_mean != null ? Number(Number(item.score_mean).toFixed(2)) : null,
    tag: item.anime_tags?.[0]?.tag ?? null,
  };
}

export class CatalogService {
  /**
   * /trending - Fetches trending anime using AniList IDs, mapped to our local database
   * Minimizes AniList calls via in-memory caching and falls back seamlessly to local DB
   */
  async getTrending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    try {
      const anilistIds = await anilistService.getTrendingAnilistIds(page, limit);

      if (anilistIds && anilistIds.length > 0) {
        const bigIntIds = anilistIds.map((id) => BigInt(id));
        const dbItems = await prisma.anime.findMany({
          where: {
            anilist_id: { in: bigIntIds },
          },
          include: {
            anime_tags: { take: 1, select: { tag: true } },
            default_name: { select: { name: true, jname: true } },
          },
        });

        // Maintain AniList trending sort order
        const itemMap = new Map(dbItems.map((item) => [item.anilist_id?.toString(), item]));
        const orderedItems = anilistIds
          .map((id) => itemMap.get(id.toString()))
          .filter(Boolean) as typeof dbItems;

        if (orderedItems.length > 0) {
          return {
            data: orderedItems.map(mapToSearchItem),
            pagination: {
              total: Math.max(100, orderedItems.length),
              page,
              limit,
              totalPages: 5,
              hasNextPage: page < 5,
              hasPrevPage: page > 1,
            },
          };
        }
      }
    } catch {
      // AniList network failure fallback
    }

    // Local DB fallback: Ongoing or high scoring anime
    const [total, items] = await Promise.all([
      prisma.anime.count({ where: { status: 'ONGOING' } }),
      prisma.anime.findMany({
        where: { status: 'ONGOING' },
        skip,
        take: limit,
        orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(mapToSearchItem),
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
   * /top-airing - Ongoing TV series sorted by rating
   */
  async getTopAiring(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.animeWhereInput = {
      status: 'ONGOING',
      type: 'TV',
    };

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /most-popular - Highest views count
   */
  async getMostPopular(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.anime.count(),
      prisma.anime.findMany({
        skip,
        take: limit,
        orderBy: [{ views: 'desc' }, { score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /most-favorite - Highest likes count
   */
  async getMostFavorite(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.anime.count(),
      prisma.anime.findMany({
        skip,
        take: limit,
        orderBy: [{ likes: 'desc' }, { score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /latest-completed - Recently finished anime
   */
  async getLatestCompleted(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.animeWhereInput = {
      status: 'FINISHED',
      season_year: { not: null },
    };

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ season_year: 'desc' }, { score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /top-upcoming - Upcoming releases
   */
  async getTopUpcoming(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const currentYear = new Date().getFullYear();
    const where: Prisma.animeWhereInput = {
      status: 'UPCOMING',
      OR: [{ season_year: { gte: currentYear } }, { season_year: null }],
    };

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ season_year: { sort: 'asc', nulls: 'last' } }, { anisora_id: 'asc' }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /top-ten - Top 10 ranking by week, month, or year
   */
  async getTopTen(period: 'week' | 'month' | 'year' = 'week') {
    const currentYear = new Date().getFullYear();
    const where: Prisma.animeWhereInput = {};

    if (period === 'year') {
      where.season_year = currentYear;
    } else {
      where.status = 'ONGOING';
    }

    const items = await prisma.anime.findMany({
      where,
      take: 10,
      orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }, { views: 'desc' }],
      include: {
        anime_tags: { take: 1, select: { tag: true } },
        default_name: { select: { name: true, jname: true } },
      },
    });

    const data = items.map((item, index) => ({
      ...mapToSearchItem(item),
      rank: index + 1,
    }));

    return {
      period,
      data,
    };
  }

  /**
   * Format-specific listings (Movie, OVA, ONA, Special) - Pure local DB queries
   */
  async getByType(type: 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.animeWhereInput = {
      type: { equals: type, mode: 'insensitive' },
    };

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /genre/:genre - Filter by genre with pagination
   */
  async getByGenre(genre: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.animeWhereInput = {
      anime_tags: {
        some: {
          tag: { equals: genre.toLowerCase().trim(), mode: 'insensitive' },
        },
      },
    };

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /az-list - Filter anime by starting letter (A-Z, 0-9, or other)
   */
  async getAzList(letter = 'all', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const cleanLetter = letter.trim().toUpperCase();
    const where: Prisma.animeWhereInput = {};

    if (cleanLetter === '0-9') {
      where.OR = [
        ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => ({
          title: { startsWith: digit },
        })),
        ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => ({
          default_name: { name: { startsWith: digit } },
        })),
      ];
    } else if (cleanLetter !== 'ALL' && cleanLetter.length === 1 && cleanLetter >= 'A' && cleanLetter <= 'Z') {
      where.OR = [
        { title: { startsWith: cleanLetter, mode: 'insensitive' } },
        { default_name: { name: { startsWith: cleanLetter, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map(mapToSearchItem),
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
   * /latest-episodes - Recently aired episodes with episode_id = AnisoraId&ep=int
   */
  async getLatestEpisodes(page = 1, limit = 20) {
    try {
      const airing = await anilistService.getLatestAiringEpisodes(page, limit);
      if (airing && airing.length > 0) {
        const bigIntIds = airing.map((a) => BigInt(a.anilistId));
        const dbItems = await prisma.anime.findMany({
          where: {
            anilist_id: { in: bigIntIds },
          },
          include: {
            anime_tags: { take: 1, select: { tag: true } },
            default_name: { select: { name: true, jname: true } },
          },
        });

        const itemMap = new Map(dbItems.map((item) => [item.anilist_id?.toString(), item]));

        const results: LatestEpisodeItemType[] = [];
        for (const air of airing) {
          const matched = itemMap.get(air.anilistId.toString());
          if (matched) {
            const anisoraId = matched.anisora_id.toString();
            const englishTitle = matched.default_name?.name || matched.title;
            const jpName = matched.default_name?.jname || matched.title;

            results.push({
              id: anisoraId,
              episode_id: `${anisoraId}&ep=${air.episode}`,
              episode_number: air.episode,
              title: englishTitle,
              jname: jpName,
              romaji: jpName,
              poster: matched.picture || matched.thumbnail || null,
              type: formatAnimeType(matched.type),
              duration: formatDuration(matched.duration_value, matched.duration_unit),
              score: matched.score_mean != null ? Number(Number(matched.score_mean).toFixed(2)) : null,
              tag: matched.anime_tags?.[0]?.tag ?? null,
              airing_at: new Date(air.airingAt * 1000).toISOString(),
            });
          }
        }

        if (results.length > 0) {
          return {
            data: results,
            pagination: {
              total: Math.max(100, results.length),
              page,
              limit,
              totalPages: 5,
              hasNextPage: page < 5,
              hasPrevPage: page > 1,
            },
          };
        }
      }
    } catch {
      // Fallback on network fail
    }

    // Local DB fallback for ongoing series
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.anime.count({ where: { status: 'ONGOING' } }),
      prisma.anime.findMany({
        where: { status: 'ONGOING' },
        skip,
        take: limit,
        orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }],
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      }),
    ]);

    const data: LatestEpisodeItemType[] = items.map((item) => {
      const epNum = item.episodes || 1;
      const anisoraId = item.anisora_id.toString();
      const englishTitle = item.default_name?.name || item.title;
      const jpName = item.default_name?.jname || item.title;

      return {
        id: anisoraId,
        episode_id: `${anisoraId}&ep=${epNum}`,
        episode_number: epNum,
        title: englishTitle,
        jname: jpName,
        romaji: jpName,
        poster: item.picture || item.thumbnail || null,
        type: formatAnimeType(item.type),
        duration: formatDuration(item.duration_value, item.duration_unit),
        score: item.score_mean != null ? Number(Number(item.score_mean).toFixed(2)) : null,
        tag: item.anime_tags?.[0]?.tag ?? null,
        airing_at: new Date().toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit);
    return {
      data,
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
   * /schedule - Estimated airing schedule for a given date (defaults to today)
   */
  async getEstimatedSchedule(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));

    const startUnix = Math.floor(startOfDay.getTime() / 1000);
    const endUnix = Math.floor(endOfDay.getTime() / 1000);

    const schedule = await anilistService.getSchedule(startUnix, endUnix);

    if (schedule && schedule.length > 0) {
      const bigIntIds = schedule.map((s) => BigInt(s.anilistId));
      const dbItems = await prisma.anime.findMany({
        where: { anilist_id: { in: bigIntIds } },
        include: {
          anime_tags: { take: 1, select: { tag: true } },
          default_name: { select: { name: true, jname: true } },
        },
      });

      const itemMap = new Map(dbItems.map((item) => [item.anilist_id?.toString(), item]));

      const entries = schedule.map((sch) => {
        const matched = itemMap.get(sch.anilistId.toString());
        const anisoraId = matched ? matched.anisora_id.toString() : null;
        const airingDate = new Date(sch.airingAt * 1000);
        const hours = airingDate.getUTCHours().toString().padStart(2, '0');
        const minutes = airingDate.getUTCMinutes().toString().padStart(2, '0');

        return {
          episode_id: anisoraId ? `${anisoraId}&ep=${sch.episode}` : null,
          episode_number: sch.episode,
          airing_at: airingDate.toISOString(),
          airing_time: `${hours}:${minutes} UTC`,
          anime: matched
            ? mapToSearchItem(matched)
            : {
                id: sch.anilistId.toString(),
                title: sch.title,
                jname: sch.title,
                romaji: sch.title,
                total_episodes: null,
                poster: null,
                description: null,
                type: 'series' as const,
                duration: null,
                score: null,
                tag: null,
              },
        };
      });

      return {
        date: startOfDay.toISOString().slice(0, 10),
        total: entries.length,
        data: entries,
      };
    }

    return {
      date: startOfDay.toISOString().slice(0, 10),
      total: 0,
      data: [],
    };
  }

  /**
   * Get all episode details for an anime by anisora_id
   * Formats each episode as: AnisoraId&ep=int with thumbnail, name, duration, and title
   */
  async getAnimeEpisodes(idString: string) {
    let id: bigint;
    try {
      id = BigInt(idString);
    } catch {
      return null;
    }

    const anime = await prisma.anime.findUnique({
      where: { anisora_id: id },
      select: {
        anisora_id: true,
        title: true,
        episodes: true,
        type: true,
        anilist_id: true,
        picture: true,
        thumbnail: true,
        duration_value: true,
        duration_unit: true,
        default_name: { select: { name: true, jname: true } },
      },
    });

    if (!anime) return null;

    const anisoraId = anime.anisora_id.toString();
    const isMovie = anime.type?.toUpperCase() === 'MOVIE';
    const totalEpisodes = isMovie ? 1 : anime.episodes || 1;
    const englishTitle = anime.default_name?.name || anime.title;
    const jpName = anime.default_name?.jname || anime.title;
    const animeDuration = formatDuration(anime.duration_value, anime.duration_unit);
    const defaultThumbnail = anime.picture || anime.thumbnail || null;

    // Fetch streaming episodes from AniList if anilist_id is present
    let streamingEps: any[] = [];
    if (anime.anilist_id) {
      try {
        streamingEps = await anilistService.getStreamingEpisodes(Number(anime.anilist_id));
      } catch {
        streamingEps = [];
      }
    }

    // Index streaming episodes by parsed episode number
    const epMap = new Map<number, { name: string; title: string; thumbnail?: string | null; url?: string | null; site?: string | null }>();

    for (let idx = 0; idx < streamingEps.length; idx++) {
      const ep = streamingEps[idx];
      const parsed = this.parseEpisodeTitle(ep.title, idx + 1);
      epMap.set(parsed.number, {
        name: parsed.name,
        title: parsed.title,
        thumbnail: ep.thumbnail || defaultThumbnail,
        url: ep.url ?? null,
        site: ep.site ?? null,
      });
    }

    // Determine count: max of DB episodes or highest episode found in streaming map
    const maxEpNumber = epMap.size > 0 ? Math.max(...Array.from(epMap.keys())) : totalEpisodes;
    const resolvedTotal = Math.max(totalEpisodes, maxEpNumber);

    const episodes = [];
    for (let i = 1; i <= Math.min(resolvedTotal, 1500); i++) {
      const meta = epMap.get(i);
      const epName = isMovie ? 'Full Movie' : (meta?.name || `Episode ${i}`);
      const epTitle = isMovie ? 'Full Movie' : (meta?.title || `Episode ${i}`);
      const epThumb = meta?.thumbnail || defaultThumbnail;

      episodes.push({
        episode_id: `${anisoraId}&ep=${i}`,
        episode_number: i,
        title: epTitle,
        name: epName,
        thumbnail: epThumb,
        duration: animeDuration,
        url: meta?.url ?? null,
        site: meta?.site ?? null,
      });
    }

    return {
      anisora_id: anisoraId,
      title: englishTitle,
      jname: jpName,
      romaji: jpName,
      total_episodes: resolvedTotal,
      episodes,
    };
  }

  private parseEpisodeTitle(rawTitle?: string | null, fallbackEp = 1): { number: number; title: string; name: string } {
    if (!rawTitle) {
      return {
        number: fallbackEp,
        title: `Episode ${fallbackEp}`,
        name: `Episode ${fallbackEp}`,
      };
    }

    const match = rawTitle.match(/^Episode\s+(\d+)\s*[-:]\s*(.+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const name = match[2].trim();
      return {
        number: num,
        title: `Episode ${num} - ${name}`,
        name,
      };
    }

    const epOnlyMatch = rawTitle.match(/^Episode\s+(\d+)$/i);
    if (epOnlyMatch) {
      const num = parseInt(epOnlyMatch[1], 10);
      return {
        number: num,
        title: `Episode ${num}`,
        name: `Episode ${num}`,
      };
    }

    return {
      number: fallbackEp,
      title: `Episode ${fallbackEp} - ${rawTitle.trim()}`,
      name: rawTitle.trim(),
    };
  }
}

export const catalogService = new CatalogService();
