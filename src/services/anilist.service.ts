import { prisma } from '../db/prisma';

// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number) {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.store.delete(key);
  }
}

// Cache anime details for 1 hour, episode lists for 30 min
const animeDetailsCache = new TtlCache<any>();
const episodeCache = new TtlCache<any>();
const anilistIdCache = new TtlCache<number | null>();

const ANIME_TTL = 60 * 60 * 1000;     // 1 hour
const EPISODE_TTL = 30 * 60 * 1000;   // 30 minutes
const ID_TTL = 6 * 60 * 60 * 1000;    // 6 hours

export class AnilistService {
  private static readonly GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

  private static async executeQuery(query: string, variables: Record<string, any>) {
    const res = await fetch(this.GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AniSora/1.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`AniList API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as any;
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message || 'Unknown AniList GraphQL error');
    }

    return json.data;
  }

  /**
   * Resolves anilist_id from anisora_id.
   * Result is cached in-memory for 6 hours to avoid repeated DB round-trips.
   */
  static async getAnilistId(anisoraIdInput: string | number | bigint): Promise<number | null> {
    const cacheKey = `id:${anisoraIdInput}`;
    const cached = anilistIdCache.get(cacheKey);
    if (cached !== null) return cached;

    const idBig = BigInt(anisoraIdInput);
    const row = await prisma.anime.findUnique({
      where: { anisora_id: idBig },
      select: { anilist_id: true, title: true, default_name: { select: { name: true } } },
    });

    if (!row) {
      anilistIdCache.set(cacheKey, null, ID_TTL);
      return null;
    }

    if (row.anilist_id) {
      const id = Number(row.anilist_id);
      anilistIdCache.set(cacheKey, id, ID_TTL);
      return id;
    }

    // If anilist_id is not mapped in DB, search by title on AniList
    const titleToSearch = row.default_name?.name || row.title;
    if (titleToSearch) {
      const searchData = await this.searchAnimeByTitle(titleToSearch);
      if (searchData && searchData.id) {
        // Persist to DB in background so future requests skip this search
        prisma.anime.update({
          where: { anisora_id: idBig },
          data: { anilist_id: BigInt(searchData.id) },
        }).catch(() => {});
        anilistIdCache.set(cacheKey, searchData.id, ID_TTL);
        return searchData.id;
      }
    }

    anilistIdCache.set(cacheKey, null, ID_TTL);
    return null;
  }

  private static async searchAnimeByTitle(title: string): Promise<{ id: number } | null> {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
        }
      }
    `;
    const data = await this.executeQuery(query, { search: title }).catch(() => null);
    return data?.Media || null;
  }

  /**
   * Fetches complete media details from AniList by Anisora ID.
   * Results are cached in-memory for 1 hour.
   */
  static async getAnimeDetails(anisoraId: string | number | bigint) {
    const cacheKey = `details:${anisoraId}`;
    const cached = animeDetailsCache.get(cacheKey);
    if (cached) return cached;

    const anilistId = await this.getAnilistId(anisoraId);
    if (!anilistId) {
      throw new Error(`No AniList entry found for Anisora ID ${anisoraId}`);
    }

    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          type
          format
          status
          description(asHtml: false)
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          season
          seasonYear
          seasonInt
          episodes
          duration
          countryOfOrigin
          isLicensed
          source
          hashtag
          trailer {
            id
            site
            thumbnail
          }
          coverImage {
            extraLarge
            large
            medium
            color
          }
          bannerImage
          genres
          synonyms
          averageScore
          meanScore
          popularity
          trending
          favourites
          tags {
            id
            name
            description
            category
            rank
            isGeneralSpoiler
            isMediaSpoiler
            isAdult
          }
          studios {
            edges {
              isMain
              node {
                id
                name
                isAnimationStudio
              }
            }
          }
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
          characters(perPage: 12, sort: [ROLE, RELEVANCE]) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
                image {
                  large
                  medium
                }
              }
              voiceActors(language: JAPANESE) {
                id
                name {
                  full
                  native
                }
                image {
                  large
                }
                languageV2
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  userPreferred
                  english
                }
                format
                type
                status
                coverImage {
                  large
                }
              }
            }
          }
          recommendations(perPage: 10, sort: [RATING_DESC]) {
            nodes {
              mediaRecommendation {
                id
                title {
                  userPreferred
                  english
                }
                format
                type
                status
                coverImage {
                  large
                }
                averageScore
              }
            }
          }
          externalLinks {
            id
            url
            site
            type
            icon
            color
          }
          siteUrl
        }
      }
    `;

    const data = await this.executeQuery(query, { id: anilistId });
    const result = {
      anisora_id: anisoraId.toString(),
      anilist_id: anilistId,
      media: data?.Media || null,
    };

    animeDetailsCache.set(cacheKey, result, ANIME_TTL);
    return result;
  }

  /**
   * Fetches all episodes of that anime including title, thumbnail, number.
   * Results are cached in-memory for 30 minutes.
   */
  static async getEpisodes(anisoraId: string | number | bigint) {
    const cacheKey = `episodes:${anisoraId}`;
    const cached = episodeCache.get(cacheKey);
    if (cached) return cached;

    const anilistId = await this.getAnilistId(anisoraId);
    if (!anilistId) {
      throw new Error(`No AniList entry found for Anisora ID ${anisoraId}`);
    }

    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title {
            userPreferred
            english
            romaji
          }
          episodes
          coverImage {
            large
          }
          streamingEpisodes {
            title
            thumbnail
            url
            site
          }
        }
      }
    `;

    const data = await this.executeQuery(query, { id: anilistId });
    const media = data?.Media;
    const streamEps = media?.streamingEpisodes || [];

    // Parse episode number from title (e.g. "Episode 1 - The Beginning")
    const formattedEpisodes = streamEps.map((ep: any, idx: number) => {
      let epNumber: number | null = idx + 1;
      const match = ep.title ? ep.title.match(/(?:Episode|Ep\.?|E)\s*(\d+)/i) : null;
      if (match) {
        epNumber = parseInt(match[1], 10);
      }

      return {
        number: epNumber,
        title: ep.title || `Episode ${epNumber}`,
        thumbnail: ep.thumbnail || media.coverImage?.large || null,
        url: ep.url || null,
        site: ep.site || null,
      };
    });

    const result = {
      anisora_id: anisoraId.toString(),
      anilist_id: anilistId,
      total_episodes: media?.episodes || formattedEpisodes.length,
      count: formattedEpisodes.length,
      episodes: formattedEpisodes,
    };

    episodeCache.set(cacheKey, result, EPISODE_TTL);
    return result;
  }
}
