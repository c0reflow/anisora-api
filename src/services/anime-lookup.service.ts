import { prisma } from '../db/prisma';

export interface FormattedAnimeCard {
  id: string;
  anisora_id: string;
  title: string;
  jname: string;
  romaji: string;
  poster: string | null;
  banner?: string | null;
  type: string;
  status?: string;
  score: number | null;
  quality: string;
  duration?: string | null;
  description: string | null;
  total_episodes: number;
  sub_episodes?: number;
  dub_episodes?: number;
  episodes: {
    sub: number;
    dub: number;
    total: number;
  };
  tags: string[];
  tag?: string;
  rank?: number;
  spotlight_badge?: string;
  release_date?: string | null;
}

export class AnimeLookupService {
  /**
   * Fetches an anime by Anisora ID from DB and formats it cleanly for Home sections
   */
  static async getById(anisoraIdStr: string): Promise<FormattedAnimeCard | null> {
    const anisoraId = BigInt(anisoraIdStr);

    const record = await prisma.anime.findUnique({
      where: { anisora_id: anisoraId },
      include: {
        default_name: true,
        mal_metadata: true,
        anime_tags: true,
        anime_studios: true,
      },
    });

    if (!record) return null;

    const title = record.default_name?.name || record.title;
    const jname = record.default_name?.jname || record.title;
    const romaji = record.mal_metadata?.title_romaji || record.title;
    const poster = record.picture || (record.mal_metadata as any)?.images?.jpg?.large_image_url || null;
    const banner = record.mal_metadata?.trailer_url || poster;
    const scoreVal = record.mal_metadata?.score
      ? Number(record.mal_metadata.score)
      : record.score_mean
      ? Number(record.score_mean)
      : null;
    const tags = record.anime_tags.map((t) => t.tag);

    const episodesTotal = record.episodes || record.mal_metadata?.episodes || 0;
    const desc = record.description || record.mal_metadata?.synopsis || null;

    const formatted: FormattedAnimeCard = {
      id: record.anisora_id.toString(),
      anisora_id: record.anisora_id.toString(),
      title,
      jname,
      romaji,
      poster,
      banner,
      type: record.type || record.mal_metadata?.type || 'TV',
      status: record.status || record.mal_metadata?.status || undefined,
      score: scoreVal ? Math.round(scoreVal * 10) / 10 : null,
      quality: 'HD',
      duration: record.mal_metadata?.duration || null,
      description: desc,
      total_episodes: episodesTotal,
      sub_episodes: episodesTotal,
      dub_episodes: 0,
      episodes: {
        sub: episodesTotal,
        dub: 0,
        total: episodesTotal,
      },
      tags: tags.slice(0, 5),
      tag: tags[0] || 'action',
      release_date: record.mal_metadata?.aired_string || `${record.season || ''} ${record.season_year || ''}`.trim() || null,
    };

    return formatted;
  }
}

