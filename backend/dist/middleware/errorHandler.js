"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error('🚨 错误详情:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    let statusCode = err.statusCode || 500;
    let message = err.message || '服务器内部错误';
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = '请求参数验证失败';
    }
    else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = '未授权访问';
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = '无效的ID格式';
    }
    else if (err.message.includes('duplicate key')) {
        statusCode = 409;
        message = '数据已存在';
    }
    const errorResponse = {
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
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map