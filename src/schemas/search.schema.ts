import { Type, Static } from '@sinclair/typebox';
import { PaginationMetaSchema } from './common.schema';

export const AnimeSearchResultItemSchema = Type.Object(
  {
    id: Type.String({ description: 'AniSora Anime ID' }),
    title: Type.String({ description: 'Anime title' }),
    total_episodes: Type.Union([Type.Integer(), Type.Null()], {
      description: 'Total number of episodes',
      example: 24,
    }),
    poster: Type.Union([Type.String(), Type.Null()], {
      description: 'Cover poster artwork URL',
    }),
    description: Type.Union([Type.String(), Type.Null()], {
      description: 'Synopsis or description',
    }),
    type: Type.Union([Type.Literal('movie'), Type.Literal('series')], {
      description: 'Format category: movie or series',
      example: 'series',
    }),
    duration: Type.Union([Type.String(), Type.Null()], {
      description: 'Human readable episode or movie duration',
      example: '24m',
    }),
    score: Type.Union([Type.Number(), Type.Null()], {
      description: 'Mean community score rating',
      example: 7.85,
    }),
    tag: Type.Union([Type.String(), Type.Null()], {
      description: '1st primary tag or genre',
      example: 'action',
    }),
  },
  { description: 'Clean formatted anime search result' }
);

export type AnimeSearchResultItemType = Static<typeof AnimeSearchResultItemSchema>;

export const AnimeSearchResponseSchema = Type.Object(
  {
    data: Type.Array(AnimeSearchResultItemSchema),
    pagination: PaginationMetaSchema,
  },
  { $id: 'AnimeSearchResponse', description: 'Paginated search results by name' }
);

export type AnimeSearchResponseType = Static<typeof AnimeSearchResponseSchema>;

export const SearchQuerySchema = Type.Object({
  query: Type.Optional(Type.String({ description: 'Search term for anime title / name' })),
  q: Type.Optional(Type.String({ description: 'Alias for query parameter' })),
  page: Type.Optional(
    Type.Integer({
      minimum: 1,
      default: 1,
      description: 'Page number for pagination',
    })
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Items per page',
    })
  ),
});

export type SearchQueryType = Static<typeof SearchQuerySchema>;

export const AnimeSuggestionItemSchema = Type.Object(
  {
    id: Type.String({ description: 'AniSora Anime ID' }),
    title: Type.String({ description: 'Anime title' }),
    poster: Type.Union([Type.String(), Type.Null()]),
    type: Type.Union([Type.Literal('movie'), Type.Literal('series')]),
    score: Type.Union([Type.Number(), Type.Null()]),
    year: Type.Union([Type.Integer(), Type.Null()]),
    tag: Type.Union([Type.String(), Type.Null()]),
  },
  { $id: 'AnimeSuggestionItem', description: 'Lightweight fast suggestion match' }
);

export type AnimeSuggestionItemType = Static<typeof AnimeSuggestionItemSchema>;

export const AnimeSuggestionResponseSchema = Type.Object(
  {
    query: Type.String({ description: 'Queried keyword' }),
    suggestions: Type.Array(AnimeSuggestionItemSchema, {
      description: 'Top 5 matches',
      maxItems: 5,
    }),
  },
  { $id: 'AnimeSuggestionResponse', description: 'Top 5 quick search suggestions' }
);

export type AnimeSuggestionResponseType = Static<typeof AnimeSuggestionResponseSchema>;
