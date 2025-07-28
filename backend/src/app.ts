// AI微积分助教后端API服务器 - Fastify版本

import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// 插件导入
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';

// 路由导入
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import { ocrRoutes } from './routes/ocr';
import { aiRoutes } from './routes/ai';
import classroomRoutes from './routes/classroom';
import assignmentRoutes from './routes/assignment';
import submissionRoutes from './routes/submissions';
import { requireAuth, optionalAuth } from './middleware/auth';

// 加载环境变量
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const prisma = new PrismaClient();

// 创建 Fastify 实例
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }
});

// 注册插件
async function registerPlugins() {
  // 安全插件
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  // JWT插件
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-key'
  });

  // CORS配置
  await fastify.register(cors, {
    origin: [
      /^chrome-extension:\/\/.*/,
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.DEV_SERVER_URL || 'http://localhost:8080'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });

  // 文件上传支持 - 100MB限制
  await fastify.register(multipart, {
    limits: {
      fileSize: Number(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    }
  });

  // 静态文件服务
  await fastify.register(staticFiles, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/',
  });

  // 公共静态文件服务
  await fastify.register(staticFiles, {
    root: path.join(__dirname, '../public'),
    prefix: '/',
    decorateReply: false
  });
}

// 注册路由
async function registerRoutes() {
  // 注册认证路由
  await fastify.register(authRoutes, { prefix: '/api' });
  
  // 注册文件上传路由
  await fastify.register(uploadRoutes, { prefix: '/api' });
  
  // 注册OCR路由
  await fastify.register(ocrRoutes, { prefix: '/api' });
  
  // 注册AI批改路由
  await fastify.register(aiRoutes, { prefix: '/api' });
  
  // 注册班级管理路由
  await fastify.register(classroomRoutes, { prefix: '/api' });
  
  // 注册作业管理路由
  await fastify.register(assignmentRoutes, { prefix: '/api' });
  
  // 注册提交管理路由
  await fastify.register(submissionRoutes, { prefix: '/api' });
  
  // 健康检查路由
  fastify.get('/api/health', async (request, reply) => {
    try {
      let dbStatus = 'healthy';
      try {
        // 使用Prisma进行数据库连接测试
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        dbStatus = 'unhealthy';
      }
      
      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0',
          framework: 'Fastify',
          orm: 'Prisma',
          database: 'Supabase',
          services: {
            database: { status: dbStatus, type: 'PostgreSQL (Supabase)' },
            storage: { status: 'configured', type: 'Supabase Storage' },
            myscript: { status: 'configured' },
            deepseek: { status: 'configured' }
          }
        }
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: 'Health check failed'
      };
    }
  });


}

// 根路径 - 处理OAuth重定向
fastify.get('/', async (request, reply) => {
  return { status: 'ok', message: 'Welcome to Calculus AI Assistant API' };
});

// 404处理
fastify.setNotFoundHandler(async (request, reply) => {
  reply.code(404).send({
    error: '接口不存在',
    message: `路径 ${request.url} 未找到`,
    availableEndpoints: [
      '/api/health',
      '/api/auth',
      '/api/files',
      '/api/submissions',
      '/api/ocr',
      '/api/ai',
      '/api/classrooms',
      '/api/assignments'
    ]
  });
});

// 错误处理
fastify.setErrorHandler(async (error, request, reply) => {
  fastify.log.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  }, '🚨 请求错误');

  let statusCode = error.statusCode || 500;
  let message = error.message || '服务器内部错误';

  // 处理特定类型的错误
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = '请求参数验证失败';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = '未授权访问';
  }

  const errorResponse: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: request.url
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  reply.code(statusCode).send(errorResponse);
});

// 启动服务器
async function start() {
  try {
    // 注册插件和路由
    await registerPlugins();
    await registerRoutes();

    // 启动服务器
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    
    console.log(`🚀 AI微积分助教服务器启动成功`);
    console.log(`📍 端口: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📚 API文档: http://localhost:${PORT}`);
    console.log(`⚡ 框架: Fastify + Prisma + Supabase`);
    
    // 检查数据库连接状态
    try {
      const healthResponse = await fetch(`http://localhost:${PORT}/api/health`);
      const healthData: any = await healthResponse.json();
      const dbStatus: string = healthData.data?.services?.database?.status || 'unknown';
      
      const statusMap: Record<string, string> = {
        'healthy': '✅',
        'configured': '⚙️',
        'not_configured': '❌',
        'unhealthy': '🔴',
        'unknown': '❓'
      };
      
      const statusEmoji = statusMap[dbStatus] || '❓';
      
      console.log(`💾 数据库: ${statusEmoji} ${dbStatus} (Supabase PostgreSQL)`);
      console.log(`📁 存储: ⚙️ configured (Supabase Storage)`);
      console.log(`🔐 认证: ⚙️ configured (Supabase Auth + GitHub)`);
    } catch (error) {
      console.log(`💾 数据库: ❓ 状态检查失败`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('📴 收到SIGTERM信号，正在关闭服务器...');
  await prisma.$disconnect();
  await fastify.close();
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 收到SIGINT信号，正在关闭服务器...');
  await prisma.$disconnect();
  await fastify.close();
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

// 启动应用
start();

export default fastify; 