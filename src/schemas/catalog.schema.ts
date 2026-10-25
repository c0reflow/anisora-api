import { Type, Static } from '@sinclair/typebox';
import { PaginationMetaSchema, PaginationQuerySchema } from './common.schema';
import { AnimeSearchResultItemSchema } from './search.schema';

export const CatalogResponseSchema = Type.Object(
  {
    data: Type.Array(AnimeSearchResultItemSchema),
    pagination: PaginationMetaSchema,
  },
  { $id: 'CatalogResponse', description: 'Standard paginated catalog list' }
);

export type CatalogResponseType = Static<typeof CatalogResponseSchema>;

export const LatestEpisodeItemSchema = Type.Object(
  {
    id: Type.String({ description: 'AniSora Anime ID' }),
    episode_id: Type.String({
      description: 'Episode ID formatted as AnisoraId&ep=int',
      example: '142051&ep=12',
    }),
    episode_number: Type.Integer({ example: 12 }),
    title: Type.String(),
    poster: Type.Union([Type.String(), Type.Null()]),
    type: Type.Union([Type.Literal('movie'), Type.Literal('series')]),
    duration: Type.Union([Type.String(), Type.Null()]),
    score: Type.Union([Type.Number(), Type.Null()]),
    tag: Type.Union([Type.String(), Type.Null()]),
    airing_at: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { $id: 'LatestEpisodeItem', description: 'Recently aired anime episode' }
);

export type LatestEpisodeItemType = Static<typeof LatestEpisodeItemSchema>;

export const LatestEpisodesResponseSchema = Type.Object(
  {
    data: Type.Array(LatestEpisodeItemSchema),
    pagination: PaginationMetaSchema,
  },
  { $id: 'LatestEpisodesResponse', description: 'List of recently aired episodes' }
);

export const TopTenItemSchema = Type.Intersect([
  AnimeSearchResultItemSchema,
  Type.Object({
    rank: Type.Integer({ description: 'Rank number (1-10)' }),
  }),
]);

export const TopTenResponseSchema = Type.Object(
  {
    period: Type.Union([Type.Literal('week'), Type.Literal('month'), Type.Literal('year')]),
    data: Type.Array(TopTenItemSchema),
  },
  { $id: 'TopTenResponse', description: 'Top 10 anime ranking' }
);

export const ScheduleEntrySchema = Type.Object({
  episode_id: Type.Union([Type.String(), Type.Null()]),
  episode_number: Type.Integer(),
  airing_at: Type.String({ format: 'date-time' }),
  airing_time: Type.String({ example: '14:30' }),
  anime: AnimeSearchResultItemSchema,
});

export const ScheduleResponseSchema = Type.Object(
  {
    date: Type.String({ description: 'Queried date YYYY-MM-DD' }),
    total: Type.Integer(),
    data: Type.Array(ScheduleEntrySchema),
  },
  { $id: 'ScheduleResponse', description: 'Estimated airing schedule for a given day' }
);

export const AnimeEpisodesResponseSchema = Type.Object(
  {
    anisora_id: Type.String({ description: 'AniSora ID' }),
    title: Type.String(),
    total_episodes: Type.Union([Type.Integer(), Type.Null()]),
    episodes: Type.Array(
      Type.Object({
        episode_id: Type.String({
          description: 'Episode ID formatted as AnisoraId&ep=int',
          example: '199918116&ep=1',
        }),
        episode_number: Type.Integer({ example: 1 }),
        title: Type.String({ example: 'Episode 1' }),
      })
    ),
  },
  { $id: 'AnimeEpisodesResponse', description: 'List of episodes for an anime' }
);

export const AzQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    letter: Type.Optional(
      Type.String({
        maxLength: 5,
        default: 'all',
        description: 'Letter filter: A-Z, 0-9, or other',
        example: 'A',
      })
    ),
  }),
]);
