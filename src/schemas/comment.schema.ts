import { Type, Static } from '@sinclair/typebox';
import { PaginationMetaSchema, PaginationQuerySchema } from './common.schema';

export const CommentUserSummarySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  username: Type.Union([Type.String(), Type.Null()]),
  role: Type.String(),
});

export const CommentItemSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid', description: 'Comment UUID' }),
    episode_id: Type.String({
      description: 'Episode identifier formatted as animeid&ep=(int)',
      example: '199918116&ep=1',
    }),
    user_id: Type.String({ format: 'uuid' }),
    user: CommentUserSummarySchema,
    comment: Type.String({ description: 'Text comment body' }),
    type: Type.Union([Type.Literal('parent'), Type.Literal('reply')], {
      description: 'Comment level type',
      default: 'parent',
    }),
    parent_comment_id: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    replies_count: Type.Optional(Type.Integer({ description: 'Count of direct replies' })),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { $id: 'CommentItem', description: 'Single comment record' }
);

export type CommentItemType = Static<typeof CommentItemSchema>;

export const CreateCommentBodySchema = Type.Object({
  episode_id: Type.String({
    description: 'Episode identifier formatted as animeid&ep=(int)',
    example: '199918116&ep=1',
  }),
  user_id: Type.String({ format: 'uuid', description: 'Author User UUID' }),
  comment: Type.String({ minLength: 1, maxLength: 5000, description: 'Comment text content' }),
  type: Type.Optional(
    Type.Union([Type.Literal('parent'), Type.Literal('reply')], {
      default: 'parent',
    })
  ),
  parent_comment_id: Type.Optional(
    Type.String({ format: 'uuid', description: 'Required if type is reply' })
  ),
});

export type CreateCommentBodyType = Static<typeof CreateCommentBodySchema>;

export const EpisodeCommentsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    type: Type.Optional(
      Type.Union([Type.Literal('parent'), Type.Literal('reply')], {
        description: 'Filter comments by type (e.g. parent only to fetch top-level threads)',
      })
    ),
  }),
]);

export type EpisodeCommentsQueryType = Static<typeof EpisodeCommentsQuerySchema>;

export const CommentsListResponseSchema = Type.Object(
  {
    data: Type.Array(CommentItemSchema),
    pagination: PaginationMetaSchema,
  },
  { $id: 'CommentsListResponse', description: 'Paginated list of comments' }
);

export type CommentsListResponseType = Static<typeof CommentsListResponseSchema>;
