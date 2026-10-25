import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import {
  AnimeSearchResultItemType,
  AnimeSuggestionItemType,
  AnimeSuggestionResponseType,
  SearchQueryType,
} from '../schemas/search.schema';

export function formatAnimeType(typeStr: string): 'movie' | 'series' {
  const t = (typeStr || '').trim().toUpperCase();
  if (t === 'MOVIE') return 'movie';
  return 'series';
}

export function formatDuration(
  value?: number | Prisma.Decimal | null,
  unit?: string | null
): string | null {
  if (value == null) return null;
  const num = Number(value);
  if (isNaN(num) || num <= 0) return null;

  let seconds = num;
  const u = (unit || 'SECONDS').toUpperCase();
  if (u.includes('MIN')) {
    seconds = num * 60;
  } else if (u.includes('HOUR')) {
    seconds = num * 3600;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export class SearchService {
  /**
   * Search anime by name with exact response format requested:
   * total episodes, title, poster, description, type (movie/series), duration, score, and 1st tag
   */
  async searchByName(params: SearchQueryType) {
    const searchTerm = (params.query || params.q || '').trim();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.animeWhereInput = {};

    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { anime_synonyms: { some: { synonym: { contains: searchTerm, mode: 'insensitive' } } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }, { anisora_id: 'asc' }],
        select: {
          anisora_id: true,
          title: true,
          episodes: true,
          picture: true,
          thumbnail: true,
          description: true,
          type: true,
          duration_value: true,
          duration_unit: true,
          score_mean: true,
          anime_tags: {
            take: 1,
            select: { tag: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const data: AnimeSearchResultItemType[] = items.map((item) => ({
      id: item.anisora_id.toString(),
      title: item.title,
      total_episodes: item.episodes ?? null,
      poster: item.picture || item.thumbnail || null,
      description: item.description ?? null,
      type: formatAnimeType(item.type),
      duration: formatDuration(item.duration_value, item.duration_unit),
      score: item.score_mean != null ? Number(Number(item.score_mean).toFixed(2)) : null,
      tag: item.anime_tags?.[0]?.tag ?? null,
    }));

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
   * Fast search suggestions returning only top 5 matches
   */
  async getSuggestions(query: string): Promise<AnimeSuggestionResponseType> {
    const term = (query || '').trim();
    if (!term) {
      return {
        query: '',
        suggestions: [],
      };
    }

    const items = await prisma.anime.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { anime_synonyms: { some: { synonym: { contains: term, mode: 'insensitive' } } } },
        ],
      },
      take: 5,
      orderBy: [{ score_mean: { sort: 'desc', nulls: 'last' } }, { anisora_id: 'asc' }],
      select: {
        anisora_id: true,
        title: true,
        picture: true,
        thumbnail: true,
        type: true,
        score_mean: true,
        season_year: true,
        anime_tags: {
          take: 1,
          select: { tag: true },
        },
      },
    });

    const suggestions: AnimeSuggestionItemType[] = items.map((item) => ({
      id: item.anisora_id.toString(),
      title: item.title,
      poster: item.picture || item.thumbnail || null,
      type: formatAnimeType(item.type),
      score: item.score_mean != null ? Number(Number(item.score_mean).toFixed(2)) : null,
      year: item.season_year ?? null,
      tag: item.anime_tags?.[0]?.tag ?? null,
    }));

    return {
      query: term,
      suggestions,
    };
  }
}

export const searchService = new SearchService();
