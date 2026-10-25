import prisma from '../db/prisma';
import { CreateCommentBodyType, EpisodeCommentsQueryType, CommentItemType } from '../schemas/comment.schema';

export class CommentService {
  /**
   * List comments for a given episode_id (animeid&ep=(int))
   */
  async listCommentsByEpisode(episodeId: string, query: EpisodeCommentsQueryType) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      episode_id: episodeId,
    };

    if (query.type) {
      where.type = query.type;
    }

    const [total, items] = await Promise.all([
      prisma.anime_comments.count({ where }),
      prisma.anime_comments.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
          _count: {
            select: {
              other_anime_comments: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const data: CommentItemType[] = items.map((item) => ({
      id: item.id,
      episode_id: item.episode_id,
      user_id: item.user_id,
      user: {
        id: item.users.id,
        username: item.users.username,
        role: item.users.role,
      },
      comment: item.comment,
      type: item.type as 'parent' | 'reply',
      parent_comment_id: item.parent_comment_id,
      replies_count: item._count.other_anime_comments,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
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
   * Create a new comment for an episode
   */
  async createComment(input: CreateCommentBodyType): Promise<CommentItemType> {
    const type = input.type || (input.parent_comment_id ? 'reply' : 'parent');

    if (type === 'reply' && !input.parent_comment_id) {
      throw new Error('parent_comment_id is required when comment type is "reply"');
    }

    // Verify parent exists if reply
    if (input.parent_comment_id) {
      const parent = await prisma.anime_comments.findUnique({
        where: { id: input.parent_comment_id },
      });
      if (!parent) {
        throw new Error(`Parent comment '${input.parent_comment_id}' not found`);
      }
    }

    const comment = await prisma.anime_comments.create({
      data: {
        episode_id: input.episode_id,
        user_id: input.user_id,
        comment: input.comment,
        type,
        parent_comment_id: input.parent_comment_id || null,
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });

    return {
      id: comment.id,
      episode_id: comment.episode_id,
      user_id: comment.user_id,
      user: {
        id: comment.users.id,
        username: comment.users.username,
        role: comment.users.role,
      },
      comment: comment.comment,
      type: comment.type as 'parent' | 'reply',
      parent_comment_id: comment.parent_comment_id,
      replies_count: 0,
      created_at: comment.created_at.toISOString(),
      updated_at: comment.updated_at.toISOString(),
    };
  }

  /**
   * Delete comment by ID
   */
  async deleteComment(id: string): Promise<boolean> {
    try {
      await prisma.anime_comments.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const commentService = new CommentService();
