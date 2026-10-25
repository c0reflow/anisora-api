import { Type, Static } from '@sinclair/typebox';
import { PaginationMetaSchema, PaginationQuerySchema } from './common.schema';

export const MetaCountItemSchema = Type.Object({
  name: Type.String({ description: 'Entity name (tag, studio, producer)' }),
  count: Type.Integer({ description: 'Number of anime associated with this item' }),
});

export const MetaListResponseSchema = Type.Object(
  {
    data: Type.Array(MetaCountItemSchema),
    pagination: PaginationMetaSchema,
  },
  { $id: 'MetaListResponse', description: 'Paginated metadata items with count' }
);

export const MetaSearchQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    q: Type.Optional(Type.String({ description: 'Filter item names by prefix or keyword' })),
  }),
]);

export const StatsResponseSchema = Type.Object(
  {
    total_anime: Type.Integer({ description: 'Total anime titles recorded' }),
    total_studios: Type.Integer({ description: 'Total distinct studios' }),
    total_producers: Type.Integer({ description: 'Total distinct producers' }),
    total_tags: Type.Integer({ description: 'Total distinct tags/genres' }),
    types_breakdown: Type.Record(Type.String(), Type.Integer()),
    statuses_breakdown: Type.Record(Type.String(), Type.Integer()),
    seasons_breakdown: Type.Record(Type.String(), Type.Integer()),
  },
  { $id: 'StatsResponse', description: 'Overall database statistics' }
);

export type StatsResponseType = Static<typeof StatsResponseSchema>;
