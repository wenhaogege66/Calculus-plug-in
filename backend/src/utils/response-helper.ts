import { FastifyReply } from 'fastify';

export interface ApiSuccessResponse<TData = unknown, TMeta = Record<string, unknown>> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorBody<TDetails = Record<string, unknown>> {
  message: string;
  code?: string;
  details?: TDetails;
}

export interface ApiErrorResponse<TDetails = Record<string, unknown>> {
  success: false;
  error: ApiErrorBody<TDetails>;
}

export type ApiResponse<TData = unknown, TMeta = Record<string, unknown>, TDetails = Record<string, unknown>> =
  | ApiSuccessResponse<TData, TMeta>
  | ApiErrorResponse<TDetails>;

export function successResponse<TData, TMeta = Record<string, unknown>>(
  data: TData,
  meta?: TMeta
): ApiSuccessResponse<TData, TMeta> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function errorResponse<TDetails = Record<string, unknown>>(
  message: string,
  options?: { code?: string; details?: TDetails }
): ApiErrorResponse<TDetails> {
  const payload: ApiErrorResponse<TDetails> = {
    success: false,
    error: { message },
  };

  if (options?.code) {
    payload.error.code = options.code;
  }

  if (options?.details) {
    payload.error.details = options.details;
  }

  return payload;
}

export function sendSuccess<TData, TMeta = Record<string, unknown>>(
  reply: FastifyReply,
  data: TData,
  statusCode = 200,
  meta?: TMeta
) {
  return reply.code(statusCode).send(successResponse(data, meta));
}

export function sendError<TDetails = Record<string, unknown>>(
  reply: FastifyReply,
  message: string,
  statusCode = 500,
  options?: { code?: string; details?: TDetails }
) {
  return reply.code(statusCode).send(errorResponse(message, options));
}
