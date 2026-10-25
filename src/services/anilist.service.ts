/**
 * AniList GraphQL Client with in-memory caching and timeout fallbacks
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

export const anilistCache = new MemoryCache();

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

export interface AiringItem {
  anilistId: number;
  episode: number;
  airingAt: number;
}

export interface ScheduleItem {
  anilistId: number;
  episode: number;
  airingAt: number;
  title: string;
}

export class AnilistService {
  /**
   * Helper to execute GraphQL queries with 5s timeout
   */
  private async queryGraphQL<T>(query: string, variables: Record<string, any>): Promise<T | null> {
    try {
      const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const json: any = await response.json();
      return json.data as T;
    } catch (err) {
      // Graceful fallback on network timeout or rate limits
      return null;
    }
  }

  /**
   * Get trending anime AniList IDs (Cached for 30 minutes)
   */
  async getTrendingAnilistIds(page = 1, perPage = 20): Promise<number[]> {
    const cacheKey = `trending:${page}:${perPage}`;
    const cached = anilistCache.get<number[]>(cacheKey);
    if (cached) return cached;

    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(sort: TRENDING_DESC, type: ANIME) {
            id
          }
        }
      }
    `;

    const data = await this.queryGraphQL<any>(query, { page, perPage });
    if (!data?.Page?.media) return [];

    const ids: number[] = data.Page.media.map((m: any) => m.id);
    anilistCache.set(cacheKey, ids, 1800); // 30 min cache
    return ids;
  }

  /**
   * Get latest released episodes from AniList (Cached for 5 minutes)
   */
  async getLatestAiringEpisodes(page = 1, perPage = 20): Promise<AiringItem[]> {
    const cacheKey = `latest-airing:${page}:${perPage}`;
    const cached = anilistCache.get<AiringItem[]>(cacheKey);
    if (cached) return cached;

    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          airingSchedules(notYetAired: false, sort: TIME_DESC) {
            episode
            airingAt
            media {
              id
            }
          }
        }
      }
    `;

    const data = await this.queryGraphQL<any>(query, { page, perPage });
    if (!data?.Page?.airingSchedules) return [];

    const list: AiringItem[] = data.Page.airingSchedules.map((s: any) => ({
      anilistId: s.media.id,
      episode: s.episode,
      airingAt: s.airingAt,
    }));

    anilistCache.set(cacheKey, list, 300); // 5 min cache
    return list;
  }

  /**
   * Get estimated airing schedule for a given day range (Cached for 1 hour)
   */
  async getSchedule(startUnix: number, endUnix: number): Promise<ScheduleItem[]> {
    const cacheKey = `schedule:${startUnix}:${endUnix}`;
    const cached = anilistCache.get<ScheduleItem[]>(cacheKey);
    if (cached) return cached;

    const query = `
      query ($start: Int, $end: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            episode
            airingAt
            media {
              id
              title {
                romaji
                english
              }
            }
          }
        }
      }
    `;

    const data = await this.queryGraphQL<any>(query, { start: startUnix, end: endUnix });
    if (!data?.Page?.airingSchedules) return [];

    const list: ScheduleItem[] = data.Page.airingSchedules.map((s: any) => ({
      anilistId: s.media.id,
      episode: s.episode,
      airingAt: s.airingAt,
      title: s.media.title?.english || s.media.title?.romaji || 'Unknown Title',
    }));

    anilistCache.set(cacheKey, list, 3600); // 1 hour cache
    return list;
  }
}

export const anilistService = new AnilistService();
