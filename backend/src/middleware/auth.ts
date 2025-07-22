// 认证中间件

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// JWT载荷类型
interface JWTPayload {
  userId: number;
  email: string;
  username: string;
  role: string;
  authType: string;
}

// 扩展Fastify请求类型 - 使用不同的属性名避免冲突
declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: {
      id: number;
      username: string;
      email: string;
      role: string;
      authType: string;
      githubId?: string;
      githubUsername?: string;
      avatarUrl?: string;
    };
  }
}

// 认证中间件工厂函数
export function createAuthMiddleware(required: boolean = true) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (required) {
          return reply.code(401).send({
            success: false,
            error: '缺少认证令牌'
          });
        }
        return; // 可选认证，继续执行
      }

      // 提取token
      const token = authHeader.substring(7);
      
      // 验证JWT token
      const decoded = await request.jwtVerify() as JWTPayload;
      
      // 从数据库获取最新用户信息
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          authType: true,
          githubId: true,
          githubUsername: true,
          avatarUrl: true,
        }
      });

      if (!user) {
        return reply.code(401).send({
          success: false,
          error: '用户不存在'
        });
      }

      // 将用户信息添加到请求对象
      request.currentUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authType: user.authType,
        githubId: user.githubId || undefined,
        githubUsername: user.githubUsername || undefined,
        avatarUrl: user.avatarUrl || undefined,
      };

    } catch (error) {
      if (required) {
        request.log.error('认证中间件错误:', error);
        return reply.code(401).send({
          success: false,
          error: '无效的认证令牌'
        });
      }
      // 可选认证时，忽略错误继续执行
    }
  };
}

// 必需认证中间件
export const requireAuth = createAuthMiddleware(true);

// 可选认证中间件  
export const optionalAuth = createAuthMiddleware(false);

// 角色检查中间件
export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.code(401).send({
        success: false,
        error: '需要先进行认证'
      });
    }

    if (!allowedRoles.includes(request.currentUser.role)) {
      return reply.code(403).send({
        success: false,
        error: '权限不足'
      });
    }
  };
}

// 用户所有者检查中间件
export function requireOwnership(userIdField: string = 'userId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.code(401).send({
        success: false,
        error: '需要先进行认证'
      });
    }

    const params = request.params as any;
    const body = request.body as any;
    const query = request.query as any;
    
    // 从参数、body或query中获取用户ID
    const resourceUserId = params[userIdField] || body[userIdField] || query[userIdField];
    
    if (resourceUserId && parseInt(resourceUserId) !== request.currentUser.id) {
      // 教师可以访问所有资源
      if (request.currentUser.role !== 'teacher') {
        return reply.code(403).send({
          success: false,
          error: '只能访问自己的资源'
        });
      }
    }
  };
} 