import { Type, Static } from '@sinclair/typebox';
import { PaginationMetaSchema, PaginationQuerySchema } from './common.schema';

export const ExternalIdsSchema = Type.Object({
  hianime_id: Type.Union([Type.String(), Type.Null()]),
  miruro_id: Type.Union([Type.String(), Type.Null()]),
  anilist_id: Type.Union([Type.String(), Type.Null()]),
  mal_id: Type.Union([Type.String(), Type.Null()]),
  animeplanet_id: Type.Union([Type.String(), Type.Null()]),
  animecountdown_id: Type.Union([Type.String(), Type.Null()]),
  kitsu_id: Type.Union([Type.String(), Type.Null()]),
  anidb_id: Type.Union([Type.String(), Type.Null()]),
  anisearch_id: Type.Union([Type.String(), Type.Null()]),
  simkl_id: Type.Union([Type.String(), Type.Null()]),
  livechart_id: Type.Union([Type.String(), Type.Null()]),
  animenewsnetwork_id: Type.Union([Type.String(), Type.Null()]),
});

export const AnimeItemSchema = Type.Object(
  {
    anisora_id: Type.String({ description: 'Unique AniSora ID (64-bit int as string)' }),
    title: Type.String({ description: 'English display title (from default_name)' }),
    jname: Type.Union([Type.String(), Type.Null()], { description: 'Japanese Romaji name' }),
    romaji: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    type: Type.String({ description: 'Format type (TV, MOVIE, OVA, ONA, SPECIAL, etc.)' }),
    episodes: Type.Union([Type.Integer(), Type.Null()]),
    status: Type.String({ description: 'Release status (FINISHED, ONGOING, UPCOMING)' }),
    season: Type.Union([Type.String(), Type.Null()]),
    season_year: Type.Union([Type.Integer(), Type.Null()]),
    picture: Type.Union([Type.String(), Type.Null()]),
    thumbnail: Type.Union([Type.String(), Type.Null()]),
    duration_value: Type.Union([Type.Number(), Type.Null()]),
    duration_unit: Type.Union([Type.String(), Type.Null()]),
    score_agm: Type.Union([Type.Number(), Type.Null()]),
    score_mean: Type.Union([Type.Number(), Type.Null()]),
    score_median: Type.Union([Type.Number(), Type.Null()]),
    views: Type.Integer({ description: 'Total anime view count', default: 0 }),
    likes: Type.Integer({ description: 'Total anime like count', default: 0 }),
    sources: Type.Array(Type.String(), { description: 'External database URLs' }),
    external_ids: ExternalIdsSchema,
    tags: Type.Optional(Type.Array(Type.String())),
    studios: Type.Optional(Type.Array(Type.String())),
    producers: Type.Optional(Type.Array(Type.String())),
    synonyms: Type.Optional(Type.Array(Type.String())),
  },
  { $id: 'AnimeItem', description: 'Anime summary metadata' }
);

export type AnimeItemType = Static<typeof AnimeItemSchema>;

export const AnimeRelationSummarySchema = Type.Object({
  anisora_id: Type.String(),
  title: Type.String({ description: 'English display title' }),
  jname: Type.Union([Type.String(), Type.Null()], { description: 'Japanese Romaji name' }),
  romaji: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  type: Type.String(),
  status: Type.String(),
  picture: Type.Union([Type.String(), Type.Null()]),
  thumbnail: Type.Union([Type.String(), Type.Null()]),
  score_mean: Type.Union([Type.Number(), Type.Null()]),
});

export const AnimeDetailSchema = Type.Intersect(
  [
    AnimeItemSchema,
    Type.Object({
      synonyms: Type.Array(Type.String(), { description: 'Alternative and localized titles' }),
      studios: Type.Array(Type.String(), { description: 'Animation production studios' }),
      producers: Type.Array(Type.String(), { description: 'Producers and companies' }),
      tags: Type.Array(Type.String(), { description: 'Genres and theme tags' }),
      relations: Type.Array(AnimeRelationSummarySchema, { description: 'Directly related anime titles' }),
    }),
  ],
  { $id: 'AnimeDetail', description: 'Complete detailed anime record with relationships' }
);

export type AnimeDetailType = Static<typeof AnimeDetailSchema>;

export const AnimeListQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    q: Type.Optional(Type.String({ description: 'Search keyword matching title or synonyms' })),
    type: Type.Optional(Type.String({ description: 'Filter by type (TV, MOVIE, OVA, ONA, SPECIAL, etc.)' })),
    status: Type.Optional(Type.String({ description: 'Filter by status (FINISHED, ONGOING, UPCOMING)' })),
    season: Type.Optional(Type.String({ description: 'Filter by season (WINTER, SPRING, SUMMER, FALL)' })),
    year: Type.Optional(Type.Integer({ description: 'Filter by season release year' })),
    tag: Type.Optional(Type.String({ description: 'Filter by genre / tag name' })),
    studio: Type.Optional(Type.String({ description: 'Filter by studio name' })),
    producer: Type.Optional(Type.String({ description: 'Filter by producer name' })),
    min_score: Type.Optional(Type.Number({ minimum: 0, maximum: 10, description: 'Minimum mean score' })),
    max_score: Type.Optional(Type.Number({ minimum: 0, maximum: 10, description: 'Maximum mean score' })),
    sort_by: Type.Optional(
      Type.Union([
        Type.Literal('score_mean'),
        Type.Literal('score_agm'),
        Type.Literal('season_year'),
        Type.Literal('title'),
        Type.Literal('episodes'),
        Type.Literal('views'),
        Type.Literal('likes'),
        Type.Literal('anisora_id'),
      ], { default: 'score_mean', description: 'Attribute to sort by' })
    ),
    sort_order: Type.Optional(
      Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        default: 'desc',
        description: 'Sort direction',
      })
    ),
  }),
]);

export type AnimeListQueryType = Static<typeof AnimeListQuerySchema>;

export const AnimeListResponseSchema = Type.Object(
  {
    data: Type.Array(AnimeItemSchema),
    pagination: PaginationMetaSchema,
  },
  { $id: 'AnimeListResponse', description: 'Paginated Anime list' }
);

export type AnimeListResponseType = Static<typeof AnimeListResponseSchema>;

export const AnimeIdParamSchema = Type.Object({
  id: Type.String({ description: 'AniSora Anime ID' }),
});

export const AnimeProviderParamSchema = Type.Object({
  provider: Type.Union([
    Type.Literal('mal'),
    Type.Literal('anilist'),
    Type.Literal('kitsu'),
    Type.Literal('hianime'),
    Type.Literal('miruro'),
    Type.Literal('animeplanet'),
    Type.Literal('anidb'),
    Type.Literal('anisearch'),
    Type.Literal('simkl'),
    Type.Literal('livechart'),
    Type.Literal('animecountdown'),
    Type.Literal('ann'),
  ], { description: 'Supported external provider name' }),
  providerId: Type.String({ description: 'ID in the external provider system' }),
});

export const RandomAnimeQuerySchema = Type.Object({
  type: Type.Optional(Type.String({ description: 'Optional anime type filter' })),
  min_score: Type.Optional(Type.Number({ minimum: 0, maximum: 10, description: 'Minimum score filter' })),
});
