"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {
            database: await checkDatabase(),
            myscript: checkMyScript(),
            deepseek: checkDeepseek(),
            chroma: checkChroma()
        },
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
    };
    res.json({
        success: true,
        data: healthData
    });
}));
router.get('/detailed', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {
            database: await checkDatabase(),
            myscript: await checkMyScriptDetailed(),
            deepseek: await checkDeepseekDetailed(),
            chroma: await checkChromaDetailed()
        },
        system: {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        },
        config: {
            port: process.env.PORT || 3000,
            maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
            jwtConfigured: !!process.env.JWT_SECRET,
            databaseConfigured: !!process.env.DATABASE_URL,
            deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
            myscriptConfigured: !!(process.env.MYSCRIPT_APPLICATION_KEY && process.env.MYSCRIPT_HMAC_KEY)
        }
    };
    res.json({
        success: true,
        data: healthData
    });
}));
async function checkDatabase() {
    try {
        if (!process.env.DATABASE_URL) {
            return { status: 'not_configured' };
        }
        return { status: 'healthy' };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Database connection failed'
        };
    }
}
function checkMyScript() {
    const hasKey = !!(process.env.MYSCRIPT_APPLICATION_KEY && process.env.MYSCRIPT_HMAC_KEY);
    const hasEndpoint = !!process.env.MYSCRIPT_API_ENDPOINT;
    if (!hasKey || !hasEndpoint) {
        return { status: 'not_configured' };
    }
    return { status: 'configured' };
}
async function checkMyScriptDetailed() {
    try {
        const hasKey = !!(process.env.MYSCRIPT_APPLICATION_KEY && process.env.MYSCRIPT_HMAC_KEY);
        const hasEndpoint = !!process.env.MYSCRIPT_API_ENDPOINT;
        if (!hasKey || !hasEndpoint) {
            return {
                status: 'not_configured',
                details: {
                    hasApplicationKey: !!process.env.MYSCRIPT_APPLICATION_KEY,
                    hasHmacKey: !!process.env.MYSCRIPT_HMAC_KEY,
                    hasEndpoint: !!process.env.MYSCRIPT_API_ENDPOINT
                }
            };
        }
        return {
            status: 'configured',
            details: {
                endpoint: process.env.MYSCRIPT_API_ENDPOINT,
                wsEndpoint: process.env.MYSCRIPT_WEBSOCKET_ENDPOINT
            }
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'MyScript check failed'
        };
    }
}
function checkDeepseek() {
    if (!process.env.DEEPSEEK_API_KEY) {
        return { status: 'not_configured' };
    }
    return { status: 'configured' };
}
async function checkDeepseekDetailed() {
    try {
        if (!process.env.DEEPSEEK_API_KEY) {
            return { status: 'not_configured' };
        }
        return {
            status: 'configured',
            details: {
                apiKeyConfigured: true,
                baseURL: 'https://api.deepseek.com/v1'
            }
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Deepseek check failed'
        };
    }
}
function checkChroma() {
    const hasHost = !!process.env.CHROMA_HOST;
    if (!hasHost) {
        return { status: 'not_configured' };
    }
    return { status: 'configured' };
}
async function checkChromaDetailed() {
    try {
        const host = process.env.CHROMA_HOST || 'localhost';
        const port = process.env.CHROMA_PORT || '8000';
        return {
            status: 'configured',
            details: {
                host,
                port,
                url: `http://${host}:${port}`
            }
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Chroma check failed'
        };
    }
}
exports.default = router;
//# sourceMappingURL=health.js.map