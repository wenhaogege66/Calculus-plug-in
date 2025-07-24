"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const static_1 = __importDefault(require("@fastify/static"));
const auth_1 = require("./routes/auth");
const upload_1 = require("./routes/upload");
const ocr_1 = require("./routes/ocr");
const ai_1 = require("./routes/ai");
const auth_2 = require("./middleware/auth");
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 3000;
const prisma = new client_1.PrismaClient();
const fastify = (0, fastify_1.default)({
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
async function registerPlugins() {
    await fastify.register(helmet_1.default, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    });
    await fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'fallback-secret-key'
    });
    await fastify.register(cors_1.default, {
        origin: [
            /^chrome-extension:\/\/.*/,
            'http://localhost:3000',
            'http://localhost:8080'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    });
    await fastify.register(multipart_1.default, {
        limits: {
            fileSize: Number(process.env.MAX_FILE_SIZE) || 104857600,
        }
    });
    await fastify.register(static_1.default, {
        root: path_1.default.join(__dirname, '../uploads'),
        prefix: '/uploads/',
    });
}
async function registerRoutes() {
    await fastify.register(auth_1.authRoutes, { prefix: '/api' });
    await fastify.register(upload_1.uploadRoutes, { prefix: '/api' });
    await fastify.register(ocr_1.ocrRoutes, { prefix: '/api' });
    await fastify.register(ai_1.aiRoutes, { prefix: '/api' });
    fastify.get('/api/health', async (request, reply) => {
        try {
            let dbStatus = 'healthy';
            try {
                await prisma.$queryRaw `SELECT 1`;
            }
            catch (error) {
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
        }
        catch (error) {
            reply.code(500);
            return {
                success: false,
                error: 'Health check failed'
            };
        }
    });
    fastify.get('/api/submissions', { preHandler: auth_2.requireAuth }, async (request, reply) => {
        try {
            const submissions = await prisma.submission.findMany({
                where: { userId: request.currentUser.id },
                include: {
                    fileUpload: true,
                    myscriptResults: true,
                    deepseekResults: true,
                },
                orderBy: { submittedAt: 'desc' },
                take: 10
            });
            return {
                success: true,
                data: { submissions }
            };
        }
        catch (error) {
            fastify.log.error('获取提交记录失败:', error);
            return reply.code(500).send({
                success: false,
                error: '获取提交记录失败'
            });
        }
    });
    fastify.post('/api/submissions', { preHandler: auth_2.requireAuth }, async (request, reply) => {
        try {
            const { fileUploadId } = request.body;
            if (!fileUploadId) {
                return reply.code(400).send({
                    success: false,
                    error: '缺少文件ID'
                });
            }
            const fileUpload = await prisma.fileUpload.findFirst({
                where: {
                    id: fileUploadId,
                    userId: request.currentUser.id
                }
            });
            if (!fileUpload) {
                return reply.code(404).send({
                    success: false,
                    error: '文件不存在'
                });
            }
            const submission = await prisma.submission.create({
                data: {
                    userId: request.currentUser.id,
                    fileUploadId: fileUploadId,
                    status: 'UPLOADED'
                }
            });
            return {
                success: true,
                data: {
                    submissionId: submission.id,
                    status: submission.status
                }
            };
        }
        catch (error) {
            fastify.log.error('创建提交失败:', error);
            return reply.code(500).send({
                success: false,
                error: '创建提交失败'
            });
        }
    });
}
fastify.get('/', async (request, reply) => {
    const oauthHandlerPage = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI微积分助教 - OAuth处理中</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .loading { color: #4CAF50; margin-bottom: 20px; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .error { color: #f44336; }
        .success { color: #4CAF50; }
        .token { word-break: break-all; font-family: monospace; font-size: 12px; background: #e8e8e8; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>AI微积分助教</h1>
        <div id="status">
          <div class="loading">
            <div class="spinner"></div>
            <p>正在处理GitHub登录...</p>
          </div>
        </div>
        <div id="result" style="display: none;"></div>
      </div>
      
      <script>
        // 处理URL片段中的OAuth参数
        async function handleOAuthCallback() {
          const statusDiv = document.getElementById('status');
          const resultDiv = document.getElementById('result');
          
          try {
            // 解析URL片段
            const hash = window.location.hash;
            if (!hash || !hash.includes('access_token')) {
              // 不是OAuth回调，显示正常主页
              statusDiv.innerHTML = \`
                <div class="success">
                  <h2>🎓 AI微积分助教 API服务器</h2>
                  <p>版本: 1.0.0</p>
                  <p>状态: 运行中</p>
                  <p>框架: Fastify + Prisma + Supabase</p>
                  <br>
                  <p><strong>可用端点:</strong></p>
                  <ul style="text-align: left; display: inline-block;">
                    <li>/api/health - 健康检查</li>
                    <li>/api/auth - 认证相关</li>
                    <li>/api/files - 文件管理</li>
                    <li>/api/submissions - 提交管理</li>
                    <li>/api/ocr - OCR识别</li>
                    <li>/api/ai - AI批改</li>
                  </ul>
                </div>
              \`;
              return;
            }
            
            // 解析参数
            const params = new URLSearchParams(hash.substring(1));
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            
            if (!access_token) {
              throw new Error('未获取到访问令牌');
            }
            
            // 发送到后端处理
            const response = await fetch('/api/auth/github/process-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                access_token,
                refresh_token
              })
            });
            
            const data = await response.json();
            
            if (data.success) {
              // 成功获取到我们的JWT token
              statusDiv.style.display = 'none';
              resultDiv.style.display = 'block';
              resultDiv.innerHTML = \`
                <div class="success">
                  <h2>✅ GitHub登录成功！</h2>
                  <div style="margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
                    <img src="\${data.data.user.avatarUrl || '/default-avatar.png'}" width="60" height="60" style="border-radius: 50%; margin-bottom: 10px;">
                    <p><strong>用户名:</strong> \${data.data.user.username}</p>
                    <p><strong>邮箱:</strong> \${data.data.user.email}</p>
                    <p><strong>角色:</strong> \${data.data.user.role === 'STUDENT' ? '学生' : '教师'}</p>
                  </div>
                  <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                    <p><strong>认证令牌:</strong></p>
                    <div class="token">\${data.data.token}</div>
                    <p><small>请复制上面的令牌，用于Chrome扩展程序的登录。</small></p>
                  </div>
                  <button class="btn" onclick="copyToken('\${data.data.token}')">复制令牌</button>
                </div>
              \`;
              
              // 向Chrome扩展发送消息
              if (window.opener && window.opener.postMessage) {
                window.opener.postMessage({
                  type: 'SUPABASE_AUTH_SUCCESS',
                  token: data.data.token,
                  user: data.data.user
                }, '*');
              }
              
            } else {
              throw new Error(data.error || '处理登录失败');
            }
            
          } catch (error) {
            statusDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = \`
              <div class="error">
                <h2>❌ 登录失败</h2>
                <p>错误信息: \${error.message}</p>
                <button class="btn" onclick="window.close()">关闭窗口</button>
              </div>
            \`;
          }
        }
        
        function copyToken(token) {
          navigator.clipboard.writeText(token).then(() => {
            alert('令牌已复制到剪贴板！');
          });
        }
        
        // 页面加载时执行
        handleOAuthCallback();
      </script>
    </body>
    </html>
  `;
    return reply.type('text/html').send(oauthHandlerPage);
});
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
fastify.setErrorHandler(async (error, request, reply) => {
    fastify.log.error({
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
    }, '🚨 请求错误');
    let statusCode = error.statusCode || 500;
    let message = error.message || '服务器内部错误';
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = '请求参数验证失败';
    }
    else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = '未授权访问';
    }
    const errorResponse = {
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
async function start() {
    try {
        await registerPlugins();
        await registerRoutes();
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 AI微积分助教服务器启动成功`);
        console.log(`📍 端口: ${PORT}`);
        console.log(`🔗 URL: http://localhost:${PORT}`);
        console.log(`📚 API文档: http://localhost:${PORT}`);
        console.log(`⚡ 框架: Fastify + Prisma + Supabase`);
        try {
            const healthResponse = await fetch(`http://localhost:${PORT}/api/health`);
            const healthData = await healthResponse.json();
            const dbStatus = healthData.data?.services?.database?.status || 'unknown';
            const statusMap = {
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
        }
        catch (error) {
            console.log(`💾 数据库: ❓ 状态检查失败`);
        }
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
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
start();
exports.default = fastify;
//# sourceMappingURL=app.js.map