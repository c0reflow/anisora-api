import { Type, Static } from '@sinclair/typebox';
import { AnimeSearchResultItemSchema } from './search.schema';
import { LatestEpisodeItemSchema, TopTenItemSchema, ScheduleEntrySchema } from './catalog.schema';
import { MetaCountItemSchema } from './meta.schema';

/**
 * Spotlight item schema matching modern anime streaming UI (banner, rank, details)
 */
export const SpotlightItemSchema = Type.Object(
  {
    id: Type.String({ description: 'AniSora Anime ID' }),
    rank: Type.Integer({ description: 'Spotlight rank (1-15)', example: 1 }),
    spotlight_badge: Type.String({ example: '#1 Spotlight' }),
    title: Type.String({ example: 'Cyberpunk: Edgerunners 2' }),
    banner: Type.String({
      description: 'High-resolution banner backdrop image URL',
      example: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/195539-lO5SUdp4SOrq.jpg',
    }),
    poster: Type.Union([Type.String(), Type.Null()]),
    description: Type.Union([Type.String(), Type.Null()]),
    type: Type.String({ example: 'TV' }),
    release_date: Type.Union([Type.String(), Type.Null()], { example: 'Oct 5, 2026' }),
    quality: Type.String({ example: 'HD' }),
    episodes: Type.Object({
      sub: Type.Union([Type.Integer(), Type.Null()], { example: 10 }),
      dub: Type.Union([Type.Integer(), Type.Null()], { example: 10 }),
      total: Type.Union([Type.Integer(), Type.Null()], { example: 10 }),
    }),
    sub_episodes: Type.Union([Type.Integer(), Type.Null()]),
    dub_episodes: Type.Union([Type.Integer(), Type.Null()]),
    total_episodes: Type.Union([Type.Integer(), Type.Null()]),
    score: Type.Union([Type.Number(), Type.Null()]),
    tags: Type.Array(Type.String()),
  },
  { description: 'Featured spotlight banner anime' }
);

export type SpotlightItemType = Static<typeof SpotlightItemSchema>;

/**
 * Recent comments schema for home page
 */
export const HomeLatestCommentSchema = Type.Object(
  {
    id: Type.String({ description: 'Comment UUID' }),
    episode_id: Type.String({ example: '199918116&ep=1' }),
    anime_id: Type.String({ example: '199918116' }),
    anime_title: Type.String({ example: '!NVADE SHOW!' }),
    user: Type.Object({
      id: Type.String(),
      username: Type.Union([Type.String(), Type.Null()]),
    }),
    comment: Type.String(),
    type: Type.String({ example: 'parent' }),
    created_at: Type.String({ format: 'date-time' }),
  },
  { description: 'Recent user comment on an episode' }
);

export type HomeLatestCommentType = Static<typeof HomeLatestCommentSchema>;

/**
 * Top 10 section in home response
 */
export const HomeTopTenSectionSchema = Type.Object({
  period: Type.Union([Type.Literal('week'), Type.Literal('month'), Type.Literal('year')]),
  data: Type.Array(TopTenItemSchema),
});

/**
 * Complete /home response schema
 */
export const HomeResponseSchema = Type.Object(
  {
    spotlight: Type.Array(SpotlightItemSchema),
    trending: Type.Array(AnimeSearchResultItemSchema),
    top_airing: Type.Array(AnimeSearchResultItemSchema),
    most_popular: Type.Array(AnimeSearchResultItemSchema),
    most_favorite: Type.Array(AnimeSearchResultItemSchema),
    latest_completed: Type.Array(AnimeSearchResultItemSchema),
    genres: Type.Array(MetaCountItemSchema),
    latest_episodes: Type.Array(LatestEpisodeItemSchema),
    new_on_anisora: Type.Array(AnimeSearchResultItemSchema),
    estimated_schedule: Type.Array(ScheduleEntrySchema),
    top_10: HomeTopTenSectionSchema,
    top_upcoming: Type.Array(AnimeSearchResultItemSchema),
    latest_comments: Type.Array(HomeLatestCommentSchema),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { $id: 'HomeResponse', description: 'All-in-one curated daily home page data' }
);

export type HomeResponseType = Static<typeof HomeResponseSchema>;

/**
 * Response for sync endpoint
 */
export const HomeSyncResponseSchema = Type.Object(
  {
    success: Type.Boolean(),
    message: Type.String(),
    data: HomeResponseSchema,
  },
  { $id: 'HomeSyncResponse', description: 'Response when home data is synced by admin' }
);
