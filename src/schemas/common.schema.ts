import { Type, Static } from '@sinclair/typebox';

export const ErrorResponseSchema = Type.Object(
  {
    statusCode: Type.Integer({ description: 'HTTP status code', example: 400 }),
    error: Type.String({ description: 'Error title', example: 'Bad Request' }),
    message: Type.String({ description: 'Detailed error message', example: 'Invalid parameter' }),
  },
  { $id: 'ErrorResponse', description: 'Standard API Error Response' }
);

export type ErrorResponseType = Static<typeof ErrorResponseSchema>;

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(
    Type.Integer({
      minimum: 1,
      default: 1,
      description: 'Page number for pagination',
      example: 1,
    })
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Number of records per page (max 100)',
      example: 20,
    })
  ),
});

export type PaginationQueryType = Static<typeof PaginationQuerySchema>;

export const PaginationMetaSchema = Type.Object(
  {
    total: Type.Integer({ description: 'Total number of items matching criteria', example: 41908 }),
    page: Type.Integer({ description: 'Current page number', example: 1 }),
    limit: Type.Integer({ description: 'Items per page', example: 20 }),
    totalPages: Type.Integer({ description: 'Total number of pages', example: 2096 }),
    hasNextPage: Type.Boolean({ description: 'Whether there is a next page', example: true }),
    hasPrevPage: Type.Boolean({ description: 'Whether there is a previous page', example: false }),
  },
  { $id: 'PaginationMeta', description: 'Pagination Metadata' }
);

export type PaginationMetaType = Static<typeof PaginationMetaSchema>;

export const HealthResponseSchema = Type.Object(
  {
    status: Type.String({ example: 'ok' }),
    timestamp: Type.String({ example: '2026-10-25T13:30:00.000Z' }),
    uptime: Type.Number({ description: 'Uptime in seconds', example: 124.5 }),
    database: Type.Object({
      status: Type.String({ example: 'connected' }),
      totalAnime: Type.Integer({ example: 41908 }),
    }),
    version: Type.String({ example: '1.0.0' }),
  },
  { $id: 'HealthResponse', description: 'Server Health Response' }
);

export type HealthResponseType = Static<typeof HealthResponseSchema>;
