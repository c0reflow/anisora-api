import * as cheerio from 'cheerio';
import { prisma } from '../db/prisma';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// How old cached DB rows can be before we re-scrape (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface MalPaginationLink {
  range: string;
  offset: number;
  url: string;
  isCurrent: boolean;
}

export interface MalEpisodeItem {
  episodeNumber: number;
  title: string;
  japaneseTitle: string | null;
  airedDate: string | null;
  url: string | null;
  forumUrl: string | null;
}

export interface MalEpisodesResponse {
  anisora_id: string;
  mal_id: number;
  title: string;
  currentPageOffset: number;
  currentRange: string;
  totalEpisodes: number;
  totalEpisodesRange: string;
  availableRanges: MalPaginationLink[];
  count: number;
  episodes: MalEpisodeItem[];
  cached?: boolean;
}

export class MalEpisodeScraperService {
  /**
   * Returns episodes for the given anisora_id + offset page.
   *
   * Strategy:
   *   1. Look up the anime record (mal_id, title, episode count).
   *   2. Query `anime_episodes` DB for this offset window (episodes offset+1 … offset+100).
   *   3. If the DB has a full page of fresh rows → return from DB without hitting MAL (fast path).
   *   4. Otherwise scrape MAL, upsert results into DB, then return scraped data.
   */
  static async getAndSaveEpisodes(
    anisoraIdInput: string | number | bigint,
    offset = 0
  ): Promise<MalEpisodesResponse> {
    const anisoraId = BigInt(anisoraIdInput);

    // -----------------------------------------------------------------------
    // 1. Fetch anime record
    // -----------------------------------------------------------------------
    const anime = await prisma.anime.findUnique({
      where: { anisora_id: anisoraId },
      include: { default_name: true, mal_metadata: true },
    });

    if (!anime) {
      throw new Error(`Anime with Anisora ID ${anisoraId} not found in database.`);
    }

    const malId =
      anime.mal_id
        ? Number(anime.mal_id)
        : anime.mal_metadata?.mal_id
        ? Number(anime.mal_metadata.mal_id)
        : null;

    if (!malId) {
      throw new Error(
        `Anime '${anime.title}' (ID ${anisoraId}) has no MyAnimeList ID (mal_id) mapped.`
      );
    }

    const rawTitle =
      anime.mal_metadata?.title_romaji || anime.default_name?.name || anime.title;
    const slug =
      encodeURIComponent(
        rawTitle
          .replace(/[^a-zA-Z0-9\s_-]/g, '')
          .trim()
          .replace(/\s+/g, '_')
      ) || 'anime';

    const PAGE_SIZE = 100;
    const startEpNum = offset + 1;
    const endEpNum = offset + PAGE_SIZE;

    // -----------------------------------------------------------------------
    // 2. DB-first lookup — check if we already have fresh rows for this page
    // -----------------------------------------------------------------------
    const dbRows = await prisma.anime_episodes.findMany({
      where: {
        anisora_id: anisoraId,
        episode_number: { gte: startEpNum, lte: endEpNum },
      },
      orderBy: { episode_number: 'asc' },
    });

    // Determine if DB rows are fresh enough
    const staleThreshold = new Date(Date.now() - CACHE_TTL_MS);
    const freshRows = dbRows.filter(
      (r) => !r.updated_at || r.updated_at > staleThreshold
    );

    // Known total episode count from anime record (may be null for ongoing)
    const knownTotal = anime.episodes ?? 0;
    // Expected episodes in this page window
    const expectedInPage =
      knownTotal > 0
        ? Math.min(PAGE_SIZE, Math.max(0, knownTotal - offset))
        : PAGE_SIZE;

    const hasFullPage = freshRows.length > 0 && freshRows.length >= Math.min(expectedInPage, freshRows.length === dbRows.length ? dbRows.length : expectedInPage);
    const isCacheSufficient = freshRows.length > 0 && freshRows.length >= dbRows.length && dbRows.length >= expectedInPage;

    if (isCacheSufficient || (freshRows.length > 0 && knownTotal === 0)) {
      // Fast path: serve from DB
      const episodes: MalEpisodeItem[] = freshRows.map((r) => ({
        episodeNumber: r.episode_number,
        title: r.title ?? `Episode ${r.episode_number}`,
        japaneseTitle: r.japanese_title ?? null,
        airedDate: r.aired_date ?? null,
        url: r.mal_url ?? null,
        forumUrl: r.forum_url ?? null,
      }));

      // Build pagination from DB aggregate
      const maxEpInDb = await prisma.anime_episodes.aggregate({
        where: { anisora_id: anisoraId },
        _max: { episode_number: true },
      });
      const maxEpisode = Math.max(
        knownTotal,
        maxEpInDb._max.episode_number ?? 0
      );

      const availableRanges = this.buildRanges(malId, slug, maxEpisode, offset, PAGE_SIZE);
      const currentRange = availableRanges.find((r) => r.isCurrent)?.range ?? `${startEpNum} - ${endEpNum}`;

      return {
        anisora_id: anisoraId.toString(),
        mal_id: malId,
        title: anime.default_name?.name ?? anime.title,
        currentPageOffset: offset,
        currentRange,
        totalEpisodes: maxEpisode,
        totalEpisodesRange: `1 - ${maxEpisode}`,
        availableRanges,
        count: episodes.length,
        episodes,
        cached: true,
      };
    }

    // -----------------------------------------------------------------------
    // 3. Slow path: scrape MAL
    // -----------------------------------------------------------------------
    const malUrl = `https://myanimelist.net/anime/${malId}/${slug}/episode?offset=${offset}`;

    const res = await fetch(malUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      // If MAL is unreachable but we have stale DB rows, return them as fallback
      if (dbRows.length > 0) {
        const episodes: MalEpisodeItem[] = dbRows.map((r) => ({
          episodeNumber: r.episode_number,
          title: r.title ?? `Episode ${r.episode_number}`,
          japaneseTitle: r.japanese_title ?? null,
          airedDate: r.aired_date ?? null,
          url: r.mal_url ?? null,
          forumUrl: r.forum_url ?? null,
        }));
        const maxEpisode = knownTotal || Math.max(...episodes.map((e) => e.episodeNumber));
        const availableRanges = this.buildRanges(malId, slug, maxEpisode, offset, PAGE_SIZE);
        const currentRange = availableRanges.find((r) => r.isCurrent)?.range ?? `${startEpNum} - ${endEpNum}`;
        return {
          anisora_id: anisoraId.toString(),
          mal_id: malId,
          title: anime.default_name?.name ?? anime.title,
          currentPageOffset: offset,
          currentRange,
          totalEpisodes: maxEpisode,
          totalEpisodesRange: `1 - ${maxEpisode}`,
          availableRanges,
          count: episodes.length,
          episodes,
          cached: true,
        };
      }
      throw new Error(`MyAnimeList request failed: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 3a. Parse raw pagination ranges
    const parsedRanges: { range: string; offset: number }[] = [];
    let currentRange = `${startEpNum} - ${endEpNum}`;

    $('.pagination a, .pagination_block a').each((_, el) => {
      const $a = $(el);
      const text = $a.text().trim();
      const href = $a.attr('href') || '';

      const offsetMatch = href.match(/offset=(\d+)/i);
      const rangeOffset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

      if (text && /\d+\s*-\s*\d+/.test(text)) {
        parsedRanges.push({ range: text, offset: rangeOffset });
      }
    });

    // 3b. Parse episode rows
    const episodes: MalEpisodeItem[] = [];
    const dbUpsertData: any[] = [];

    $('table.ascendant-table tbody tr, table.episode_list tr').each((_, el) => {
      const $tr = $(el);
      const numStr = $tr.find('.episode-number, td.episode-number').text().trim();
      const episodeNumber = parseInt(numStr, 10);
      if (isNaN(episodeNumber)) return;

      const titleA = $tr.find('.episode-title a, td.episode-title a');
      const title = titleA.text().trim() || `Episode ${episodeNumber}`;
      const epUrl = titleA.attr('href') || null;

      const jname = $tr.find('.episode-title span.di-ib').text().trim() || null;
      const aired = $tr.find('.episode-aired, td.episode-aired').text().trim() || null;
      const forumA = $tr.find('.episode-forum a, td.episode-forum a');
      const forumUrl = forumA.attr('href') || null;

      episodes.push({ episodeNumber, title, japaneseTitle: jname, airedDate: aired, url: epUrl, forumUrl });

      dbUpsertData.push({
        anisora_id: anisoraId,
        mal_id: BigInt(malId),
        episode_number: episodeNumber,
        title,
        japanese_title: jname,
        aired_date: aired,
        mal_url: epUrl,
        forum_url: forumUrl,
      });
    });

    // 3c. Upsert into DB (fire-and-forget so response isn't blocked)
    if (dbUpsertData.length > 0) {
      Promise.allSettled(
        dbUpsertData.map((data) =>
          prisma.anime_episodes.upsert({
            where: {
              anisora_id_episode_number: {
                anisora_id: data.anisora_id,
                episode_number: data.episode_number,
              },
            },
            update: {
              title: data.title,
              japanese_title: data.japanese_title,
              aired_date: data.aired_date,
              mal_url: data.mal_url,
              forum_url: data.forum_url,
              updated_at: new Date(),
            },
            create: data,
          })
        )
      ).catch(() => {});
    }

    // -----------------------------------------------------------------------
    // 4. Determine max episode count from pagination / DB / anime record
    // -----------------------------------------------------------------------
    let maxEpisode =
      episodes.length > 0 ? Math.max(...episodes.map((e) => e.episodeNumber)) : 0;

    for (const pr of parsedRanges) {
      const match = pr.range.match(/-\s*(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxEpisode) maxEpisode = num;
      }
    }
    if (anime.episodes && anime.episodes > maxEpisode) maxEpisode = anime.episodes;

    const availableRanges = this.buildRanges(malId, slug, maxEpisode, offset, PAGE_SIZE);
    currentRange = availableRanges.find((r) => r.isCurrent)?.range ?? currentRange;

    return {
      anisora_id: anisoraId.toString(),
      mal_id: malId,
      title: anime.default_name?.name ?? anime.title,
      currentPageOffset: offset,
      currentRange,
      totalEpisodes: maxEpisode,
      totalEpisodesRange: `1 - ${maxEpisode}`,
      availableRanges,
      count: episodes.length,
      episodes,
      cached: false,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private static buildRanges(
    malId: number,
    slug: string,
    maxEpisode: number,
    currentOffset: number,
    pageSize: number
  ): MalPaginationLink[] {
    const totalPages = Math.max(1, Math.ceil(maxEpisode / pageSize));
    const ranges: MalPaginationLink[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageOffset = i * pageSize;
      const startEp = pageOffset + 1;
      const endEp = Math.min(pageOffset + pageSize, maxEpisode);
      const isCurrent =
        currentOffset >= pageOffset &&
        (currentOffset < pageOffset + pageSize || i === totalPages - 1);

      ranges.push({
        range: `${startEp} - ${endEp}`,
        offset: pageOffset,
        url: `https://myanimelist.net/anime/${malId}/${slug}/episode?offset=${pageOffset}`,
        isCurrent,
      });
    }

    return ranges;
  }
}
