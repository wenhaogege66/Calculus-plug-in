// AI微积分助教后端API服务器

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// 路由导入
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import submissionRoutes from './routes/submissions';
import ocrRoutes from './routes/ocr';
import aiRoutes from './routes/ai';
import healthRoutes from './routes/health';

// 中间件导入
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS配置
app.use(cors({
  origin: [
    'chrome-extension://*',
    'https://ap-southeast-1.run.claw.cloud',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 基础中间件
app.use(morgan('combined')); // 日志记录
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL编码解析

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查路由（无需认证）
app.use('/api/health', healthRoutes);

// 认证路由（无需认证）
app.use('/api/auth', authRoutes);

// 需要认证的路由
app.use('/api/files', authMiddleware, uploadRoutes);
app.use('/api/submissions', authMiddleware, submissionRoutes);
app.use('/api/ocr', authMiddleware, ocrRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'AI微积分助教 API服务器',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      files: '/api/files',
      submissions: '/api/submissions',
      ocr: '/api/ocr',
      ai: '/api/ai'
    }
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    message: `路径 ${req.originalUrl} 未找到`,
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

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`🚀 AI微积分助教服务器启动成功`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}`);
  console.log(`💾 数据库: ${process.env.DATABASE_URL ? '已连接' : '未配置'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('📴 收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

export default app; 