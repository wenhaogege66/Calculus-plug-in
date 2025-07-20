// 错误处理中间件

import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
  statusCode?: number;
  status?: string;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('🚨 错误详情:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 默认错误状态码
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';

  // 处理特定类型的错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '请求参数验证失败';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = '未授权访问';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = '无效的ID格式';
  } else if (err.message.includes('duplicate key')) {
    statusCode = 409;
    message = '数据已存在';
  }

  // 开发环境返回详细错误信息
  const errorResponse: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.url
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  res.status(statusCode).json(errorResponse);
};

// 异步错误捕获包装器
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
}; 