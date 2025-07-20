// JWT认证中间件

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string;
  role: 'student' | 'teacher';
}

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未提供有效的认证令牌'
      });
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '认证令牌为空'
      });
    }

    // 验证token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET未配置');
      return res.status(500).json({
        success: false,
        error: '服务器配置错误'
      });
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // 将用户信息添加到请求对象
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('JWT验证失败:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: '认证令牌已过期'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: '无效的认证令牌'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: '认证验证失败'
      });
    }
  }
};

// 可选认证中间件（允许匿名访问，但如果有token则验证）
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 没有token，继续处理但不添加用户信息
    return next();
  }

  // 有token，尝试验证
  authMiddleware(req, res, next);
};

// 角色检查中间件
export const requireRole = (allowedRoles: Array<'student' | 'teacher'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '需要认证'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '权限不足'
      });
    }

    next();
  };
};

// 生成JWT token的工具函数
export const generateToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET未配置');
  }

  return jwt.sign(payload, secret, {
    expiresIn: '7d', // 7天过期
    issuer: 'calculus-ai-assistant',
    audience: 'calculus-ai-users'
  });
};

// 验证JWT token的工具函数
export const verifyToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET未配置');
  }

  return jwt.verify(token, secret) as JwtPayload;
}; 