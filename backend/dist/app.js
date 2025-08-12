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
const classroom_1 = __importDefault(require("./routes/classroom"));
const assignment_1 = __importDefault(require("./routes/assignment"));
const submissions_1 = __importDefault(require("./routes/submissions"));
const practice_1 = __importDefault(require("./routes/practice"));
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
            /^moz-extension:\/\/.*/,
            process.env.FRONTEND_URL || 'http://localhost:3000',
            process.env.DEV_SERVER_URL || 'http://localhost:8080',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 200
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
    await fastify.register(static_1.default, {
        root: path_1.default.join(__dirname, '../public'),
        prefix: '/',
        decorateReply: false
    });
}
async function registerRoutes() {
    await fastify.register(auth_1.authRoutes, { prefix: '/api' });
    await fastify.register(upload_1.uploadRoutes, { prefix: '/api' });
    await fastify.register(ocr_1.ocrRoutes, { prefix: '/api' });
    await fastify.register(ai_1.aiRoutes, { prefix: '/api' });
    await fastify.register(classroom_1.default, { prefix: '/api' });
    await fastify.register(assignment_1.default, { prefix: '/api' });
    await fastify.register(submissions_1.default, { prefix: '/api' });
    await fastify.register(practice_1.default, { prefix: '/api' });
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
}
fastify.get('/', async (request, reply) => {
    return { status: 'ok', message: 'Welcome to Calculus AI Assistant API' };
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
            '/api/practice',
            '/api/ocr',
            '/api/ai',
            '/api/classrooms',
            '/api/assignments'
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