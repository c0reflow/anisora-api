import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { userService } from '../services/user.service';
import { CreateUserSchema, UserSchema } from '../schemas/user.schema';
import { ErrorResponseSchema, PaginationMetaSchema, PaginationQuerySchema } from '../schemas/common.schema';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * POST /api/v1/users - Register new user
   */
  app.post(
    '/',
    {
      schema: {
        tags: ['Users'],
        summary: 'Create user account',
        description: 'Registers a new user account with hashed password.',
        body: CreateUserSchema,
        response: {
          201: UserSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const user = await userService.createUser(req.body);
        return reply.status(201).send(user);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Failed to create user',
        });
      }
    }
  );

  /**
   * GET /api/v1/users/:id - Get user by UUID
   */
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Users'],
        summary: 'Get user account profile',
        params: Type.Object({
          id: Type.String({ format: 'uuid', description: 'User UUID' }),
        }),
        response: {
          200: UserSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const user = await userService.getUserById(req.params.id);
      if (!user) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `User '${req.params.id}' was not found.`,
        });
      }
      return reply.send(user);
    }
  );

  /**
   * GET /api/v1/users - List users
   */
  app.get(
    '/',
    {
      schema: {
        tags: ['Users'],
        summary: 'List users with pagination',
        querystring: PaginationQuerySchema,
        response: {
          200: Type.Object({
            data: Type.Array(UserSchema),
            pagination: PaginationMetaSchema,
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await userService.listUsers(req.query.page, req.query.limit);
      return reply.send(result);
    }
  );
};
