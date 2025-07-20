"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const upload_1 = __importDefault(require("./routes/upload"));
const submissions_1 = __importDefault(require("./routes/submissions"));
const ocr_1 = __importDefault(require("./routes/ocr"));
const ai_1 = __importDefault(require("./routes/ai"));
const health_1 = __importDefault(require("./routes/health"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_2 = require("./middleware/auth");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use((0, cors_1.default)({
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
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api/health', health_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/files', auth_2.authMiddleware, upload_1.default);
app.use('/api/submissions', auth_2.authMiddleware, submissions_1.default);
app.use('/api/ocr', auth_2.authMiddleware, ocr_1.default);
app.use('/api/ai', auth_2.authMiddleware, ai_1.default);
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
app.use(errorHandler_1.errorHandler);
const server = app.listen(PORT, () => {
    console.log(`🚀 AI微积分助教服务器启动成功`);
    console.log(`📍 端口: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📚 API文档: http://localhost:${PORT}`);
    console.log(`💾 数据库: ${process.env.DATABASE_URL ? '已连接' : '未配置'}`);
});
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
exports.default = app;
//# sourceMappingURL=app.js.map