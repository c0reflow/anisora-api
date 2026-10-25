import prisma from '../db/prisma';
import { anilistService, AnilistSpotlightMedia } from './anilist.service';
import { catalogService } from './catalog.service';
import { metaService } from './meta.service';
import { formatAnimeType, formatDuration } from './search.service';
import {
  SpotlightItemType,
  HomeResponseType,
  HomeLatestCommentType,
} from '../schemas/home.schema';
import { AnimeSearchResultItemType } from '../schemas/search.schema';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export class HomeService {
  /**
   * Helper to format AniList startDate into readable date string
   * Example: { year: 2026, month: 10, day: 5 } -> "Oct 5, 2026"
   */
  private formatDate(startDate?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
    if (!startDate || !startDate.year) return null;
    const year = startDate.year;
    const month = startDate.month ? MONTH_NAMES[startDate.month - 1] : null;
    const day = startDate.day;

    if (month && day) {
      return `${month} ${day}, ${year}`;
    }
    if (month) {
      return `${month} ${year}`;
    }
    return `${year}`;
  }

  /**
   * Cleans HTML tags from text
   */
  private cleanDescription(text?: string | null): string | null {
    if (!text) return null;
    return text.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').trim();
  }

  /**
   * Retrieve cached home page data from PostgreSQL `home` table.
   * If table has no record, triggers automatic initial generation.
   */
  async getHomeData(): Promise<HomeResponseType> {
    const existing = await prisma.home.findUnique({
      where: { id: 'current' },
    });

    if (existing && existing.data) {
      return existing.data as unknown as HomeResponseType;
    }

    // Auto-initialize if empty
    return this.syncHomeData();
  }

  /**
   * Build fresh home page data from AniList and Local PostgreSQL,
   * then cache the result in the `home` table.
   */
  async syncHomeData(): Promise<HomeResponseType> {
    // 1. Fetch Spotlight Anime from AniList
    const anilistSpotlights = await anilistService.getSpotlightMedia(15);
    const spotlightIds = anilistSpotlights.map((m) => BigInt(m.id));

    // Resolve matching local records by anilist_id
    const localMatches = spotlightIds.length > 0
      ? await prisma.anime.findMany({
          where: { anilist_id: { in: spotlightIds } },
          include: { anime_tags: { take: 3 } },
        })
      : [];

    const localMap = new Map<string, any>();
    for (const anime of localMatches) {
      if (anime.anilist_id) {
        localMap.set(anime.anilist_id.toString(), anime);
      }
    }

    // Assemble spotlight items
    const spotlight: SpotlightItemType[] = anilistSpotlights.map((m, idx) => {
      const local = localMap.get(m.id.toString());
      const rank = idx + 1;
      const totalEpisodes = local?.episodes ?? m.episodes ?? null;
      const nextEp = m.nextAiringEpisode?.episode;
      const currentAired = nextEp ? nextEp - 1 : (totalEpisodes || 1);
      const subEpisodes = currentAired;
      const dubEpisodes = Math.max(0, currentAired - 1);

      const title = local?.title || m.title?.english || m.title?.romaji || 'Unknown Title';
      const banner = m.bannerImage || local?.picture || 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg';
      const poster = local?.picture || m.coverImage?.extraLarge || m.coverImage?.large || null;
      const description = this.cleanDescription(local?.description || m.description);
      const releaseDate = this.formatDate(m.startDate) || (local?.season_year ? `${local.season_year}` : null);
      const score = local?.score_mean ? Number(local.score_mean) : (m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : null);
      const tags = m.genres && m.genres.length > 0
        ? m.genres
        : (local?.anime_tags ? local.anime_tags.map((t: any) => t.tag) : []);

      return {
        id: local ? local.anisora_id.toString() : m.id.toString(),
        rank,
        spotlight_badge: `#${rank} Spotlight`,
        title,
        banner,
        poster,
        description,
        type: local ? local.type : (m.format || 'TV'),
        release_date: releaseDate,
        quality: 'HD',
        episodes: {
          sub: subEpisodes,
          dub: dubEpisodes,
          total: totalEpisodes,
        },
        sub_episodes: subEpisodes,
        dub_episodes: dubEpisodes,
        total_episodes: totalEpisodes,
        score,
        tags,
      };
    });

    // 2. Fetch Catalog Sections
    const [
      trending,
      topAiring,
      mostPopular,
      mostFavorite,
      latestCompleted,
      genresResult,
      latestEpisodes,
      schedule,
      topTen,
      topUpcoming,
    ] = await Promise.all([
      catalogService.getTrending(1, 20),
      catalogService.getTopAiring(1, 20),
      catalogService.getMostPopular(1, 20),
      catalogService.getMostFavorite(1, 20),
      catalogService.getLatestCompleted(1, 20),
      metaService.getTags({ limit: 30 }),
      catalogService.getLatestEpisodes(1, 20),
      catalogService.getEstimatedSchedule(),
      catalogService.getTopTen('week'),
      catalogService.getTopUpcoming(1, 20),
    ]);

    // 3. New on AniSora (Recently added items in PostgreSQL)
    const recentRecords = await prisma.anime.findMany({
      take: 20,
      orderBy: { anisora_id: 'desc' },
      include: {
        anime_tags: {
          take: 1,
        },
      },
    });

    const newOnAnisora: AnimeSearchResultItemType[] = recentRecords.map((a) => ({
      id: a.anisora_id.toString(),
      title: a.title,
      total_episodes: a.episodes,
      poster: a.picture,
      description: a.description,
      type: formatAnimeType(a.type),
      duration: formatDuration(a.duration_value, a.duration_unit),
      score: a.score_mean ? Number(Number(a.score_mean).toFixed(2)) : null,
      tag: a.anime_tags[0]?.tag || null,
    }));

    // 4. Latest Comments with resolved anime titles
    const recentComments = await prisma.anime_comments.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Extract unique anime IDs from episode_id e.g. "199918116&ep=1"
    const animeIds = [
      ...new Set(
        recentComments
          .map((c) => c.episode_id.split('&')[0])
          .filter((id) => /^\d+$/.test(id))
      ),
    ].map((id) => BigInt(id));

    const commentAnime = animeIds.length > 0
      ? await prisma.anime.findMany({
          where: { anisora_id: { in: animeIds } },
          select: { anisora_id: true, title: true },
        })
      : [];

    const commentAnimeMap = new Map<string, string>();
    for (const a of commentAnime) {
      commentAnimeMap.set(a.anisora_id.toString(), a.title);
    }

    const latestComments: HomeLatestCommentType[] = recentComments.map((c) => {
      const animeId = c.episode_id.split('&')[0];
      return {
        id: c.id,
        episode_id: c.episode_id,
        anime_id: animeId,
        anime_title: commentAnimeMap.get(animeId) || 'Anime Episode',
        user: {
          id: c.users.id,
          username: c.users.username,
        },
        comment: c.comment,
        type: c.type,
        created_at: c.created_at.toISOString(),
      };
    });

    // 5. Construct Full Home Payload
    const homePayload: HomeResponseType = {
      spotlight,
      trending: trending.data,
      top_airing: topAiring.data,
      most_popular: mostPopular.data,
      most_favorite: mostFavorite.data,
      latest_completed: latestCompleted.data,
      genres: genresResult.data,
      latest_episodes: latestEpisodes.data,
      new_on_anisora: newOnAnisora,
      estimated_schedule: schedule.data,
      top_10: topTen,
      top_upcoming: topUpcoming.data,
      latest_comments: latestComments,
      updated_at: new Date().toISOString(),
    };

    // 6. Save in PostgreSQL `home` table
    await prisma.home.upsert({
      where: { id: 'current' },
      create: {
        id: 'current',
        data: homePayload as any,
        updated_at: new Date(),
      },
      update: {
        data: homePayload as any,
        updated_at: new Date(),
      },
    });

    return homePayload;
  }
}

export const homeService = new HomeService();
