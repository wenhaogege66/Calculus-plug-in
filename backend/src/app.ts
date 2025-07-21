// AI微积分助教后端API服务器 - Fastify版本

import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';

// 插件导入
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';

// 加载环境变量
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

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

  // CORS配置
  await fastify.register(cors, {
    origin: [
      /^chrome-extension:\/\/.*/,
      'http://localhost:3000',
      'http://localhost:8080'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });

  // 文件上传支持
  await fastify.register(multipart, {
    limits: {
      fileSize: Number(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    }
  });

  // 静态文件服务
  await fastify.register(staticFiles, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/',
  });
}

// 注册路由
async function registerRoutes() {
  // 暂时使用简化的路由，稍后重构
  
  // 健康检查路由
  fastify.get('/api/health', async (request, reply) => {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });
      
      let dbStatus = 'healthy';
      try {
        await pool.query('SELECT 1');
        await pool.end();
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
          services: {
            database: { status: dbStatus },
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
  
  // 临时的简化路由
  fastify.post('/api/files', async (request, reply) => {
    return { success: true, message: 'File upload endpoint - Fastify version' };
  });
  
  fastify.get('/api/submissions', async (request, reply) => {
    return { success: true, data: { submissions: [] } };
  });
  
  fastify.post('/api/submissions', async (request, reply) => {
    return { success: true, message: 'Submission created' };
  });
}

// 根路径
fastify.get('/', async (request, reply) => {
  return {
    message: 'AI微积分助教 API服务器',
    version: '1.0.0',
    status: 'running',
    framework: 'Fastify',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      files: '/api/files',
      submissions: '/api/submissions',
      ocr: '/api/ocr',
      ai: '/api/ai'
    }
  };
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
      '/api/ai'
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
    console.log(`⚡ 框架: Fastify`);
    
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
      
      console.log(`💾 数据库: ${statusEmoji} ${dbStatus} (Neon PostgreSQL)`);
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
  await fastify.close();
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 收到SIGINT信号，正在关闭服务器...');
  await fastify.close();
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

// 启动应用
start();

export default fastify; 