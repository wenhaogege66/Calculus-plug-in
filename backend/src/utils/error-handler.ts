import { FastifyInstance, FastifyReply } from 'fastify';
import { sendError } from './response-helper';

interface HandleErrorOptions {
  statusCode?: number;
  errorCode?: string;
  details?: Record<string, unknown>;
  logContext?: Record<string, unknown>;
}

export function handleRouteError(
  fastify: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
  message: string,
  options: HandleErrorOptions = {}
) {
  const { statusCode = 500, errorCode, details, logContext } = options;

  fastify.log.error(
    {
      err: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
      ...logContext,
    },
    message
  );

  return sendError(reply, message, statusCode, {
    code: errorCode,
    details,
  });
}
