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
            fileSize: Number(process.env.MAX_FILE_SIZE) || 10485760,
        }
    });
    await fastify.register(static_1.default, {
        root: path_1.default.join(__dirname, '../uploads'),
        prefix: '/uploads/',
    });
}
async function registerRoutes() {
    await fastify.register(auth_1.authRoutes, { prefix: '/api' });
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
                    services: {
                        database: { status: dbStatus, type: 'PostgreSQL (Neon)' },
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
    fastify.post('/api/files', { preHandler: auth_2.requireAuth }, async (request, reply) => {
        return {
            success: true,
            message: 'File upload endpoint - Fastify + Prisma version',
            user: request.currentUser
        };
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
        return {
            success: true,
            message: 'Submission created',
            user: request.currentUser
        };
    });
}
fastify.get('/', async (request, reply) => {
    return {
        message: 'AI微积分助教 API服务器',
        version: '1.0.0',
        status: 'running',
        framework: 'Fastify',
        orm: 'Prisma',
        database: 'PostgreSQL (Neon)',
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
        console.log(`⚡ 框架: Fastify + Prisma`);
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
            console.log(`💾 数据库: ${statusEmoji} ${dbStatus} (PostgreSQL via Prisma)`);
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