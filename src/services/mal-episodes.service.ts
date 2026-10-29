import * as cheerio from 'cheerio';
import { prisma } from '../db/prisma';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
}

export class MalEpisodeScraperService {
  /**
   * Scrapes episodes page from MyAnimeList:
   * https://myanimelist.net/anime/{mal_id}/{slug}/episode?offset={offset}
   * and saves each episode into the database table `anime_episodes`.
   */
  static async getAndSaveEpisodes(
    anisoraIdInput: string | number | bigint,
    offset = 0
  ): Promise<MalEpisodesResponse> {
    const anisoraId = BigInt(anisoraIdInput);

    // 1. Fetch anime record to find mal_id and title
    const anime = await prisma.anime.findUnique({
      where: { anisora_id: anisoraId },
      include: { default_name: true, mal_metadata: true },
    });

    if (!anime) {
      throw new Error(`Anime with Anisora ID ${anisoraId} not found in database.`);
    }

    const malId = anime.mal_id ? Number(anime.mal_id) : anime.mal_metadata?.mal_id ? Number(anime.mal_metadata.mal_id) : null;
    if (!malId) {
      throw new Error(`Anime '${anime.title}' (ID ${anisoraId}) has no MyAnimeList ID (mal_id) mapped.`);
    }

    // Prepare slug for URL
    const rawTitle = anime.mal_metadata?.title_romaji || anime.default_name?.name || anime.title;
    const slug = encodeURIComponent(
      rawTitle
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
    ) || 'anime';

    const malUrl = `https://myanimelist.net/anime/${malId}/${slug}/episode?offset=${offset}`;

    const res = await fetch(malUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`MyAnimeList request failed: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 2. Parse raw pagination ranges from page to find absolute max
    const parsedRanges: { range: string; offset: number }[] = [];
    let currentRange = `${offset + 1} - ${offset + 100}`;

    $('.pagination a, .pagination_block a').each((_, el) => {
      const $a = $(el);
      const text = $a.text().trim();
      const href = $a.attr('href') || '';

      const offsetMatch = href.match(/offset=(\d+)/i);
      const rangeOffset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

      if (text && /\d+\s*-\s*\d+/.test(text)) {
        parsedRanges.push({
          range: text,
          offset: rangeOffset,
        });
      }
    });

    // 3. Parse episode rows
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

      const epItem: MalEpisodeItem = {
        episodeNumber,
        title,
        japaneseTitle: jname,
        airedDate: aired,
        url: epUrl,
        forumUrl,
      };

      episodes.push(epItem);

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

    // 4. Upsert scraped episodes into database table `anime_episodes`
    if (dbUpsertData.length > 0) {
      await Promise.allSettled(
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
      );
    }

    // Determine the absolute max episode count from MAL's last pagination link, DB, or current list
    let maxEpisode = episodes.length > 0 ? Math.max(...episodes.map(e => e.episodeNumber)) : 0;
    if (parsedRanges.length > 0) {
      for (const pr of parsedRanges) {
        const match = pr.range.match(/-\s*(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxEpisode) maxEpisode = num;
        }
      }
    }
    if (anime.episodes && anime.episodes > maxEpisode) {
      maxEpisode = anime.episodes;
    }

    // Generate complete, continuous 100-episode ranges from 1 up to maxEpisode
    const completeRanges: MalPaginationLink[] = [];
    const PAGE_SIZE = 100;
    const totalPages = Math.max(1, Math.ceil(maxEpisode / PAGE_SIZE));

    for (let i = 0; i < totalPages; i++) {
      const pageOffset = i * PAGE_SIZE;
      const startEp = pageOffset + 1;
      const endEp = Math.min(pageOffset + PAGE_SIZE, maxEpisode);
      const isCurrent = offset >= pageOffset && (offset < pageOffset + PAGE_SIZE || i === totalPages - 1);

      completeRanges.push({
        range: `${startEp} - ${endEp}`,
        offset: pageOffset,
        url: `https://myanimelist.net/anime/${malId}/${slug}/episode?offset=${pageOffset}`,
        isCurrent,
      });

      if (isCurrent) {
        currentRange = `${startEp} - ${endEp}`;
      }
    }

    return {
      anisora_id: anisoraId.toString(),
      mal_id: malId,
      title: anime.default_name?.name || anime.title,
      currentPageOffset: offset,
      currentRange,
      totalEpisodes: maxEpisode,
      totalEpisodesRange: `1 - ${maxEpisode}`,
      availableRanges: completeRanges,
      count: episodes.length,
      episodes,
    };
  }
}
