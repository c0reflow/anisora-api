import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { commentService } from '../services/comment.service';
import {
  CommentsListResponseSchema,
  CommentItemSchema,
  CreateCommentBodySchema,
  EpisodeCommentsQuerySchema,
} from '../schemas/comment.schema';
import { ErrorResponseSchema } from '../schemas/common.schema';

export const commentRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * GET /api/v1/comments/:episodeId - Get comments for an episode
   */
  app.get(
    '/:episodeId',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Get comments for an episode',
        description: 'Returns all comments for the specified episode ID (formatted as animeid&ep=(int)).',
        params: Type.Object({
          episodeId: Type.String({
            description: 'Episode ID in the format animeid&ep=(int)',
            example: '199918116&ep=1',
          }),
        }),
        querystring: EpisodeCommentsQuerySchema,
        response: {
          200: CommentsListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await commentService.listCommentsByEpisode(req.params.episodeId, req.query);
      return reply.send(result);
    }
  );

  /**
   * POST /api/v1/comments - Post a new comment or reply
   */
  app.post(
    '/',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Create a comment on an episode',
        description: 'Posts a new top-level comment or a reply to an existing comment on an episode.',
        body: CreateCommentBodySchema,
        response: {
          201: CommentItemSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const comment = await commentService.createComment(req.body);
        return reply.status(201).send(comment);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Failed to create comment',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/comments/:id - Delete a comment
   */
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Delete a comment',
        description: 'Removes a comment and cascades to any direct replies.',
        params: Type.Object({
          id: Type.String({ format: 'uuid', description: 'Comment UUID' }),
        }),
        response: {
          200: Type.Object({ success: Type.Boolean(), message: Type.String() }),
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const deleted = await commentService.deleteComment(req.params.id);
      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Comment '${req.params.id}' not found`,
        });
      }
      return reply.send({ success: true, message: 'Comment deleted successfully' });
    }
  );
};
