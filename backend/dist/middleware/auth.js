"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = exports.requireRole = exports.optionalAuth = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '未提供有效的认证令牌'
            });
        }
        const token = authHeader.substring(7);
        if (!token) {
            return res.status(401).json({
                success: false,
                error: '认证令牌为空'
            });
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET未配置');
            return res.status(500).json({
                success: false,
                error: '服务器配置错误'
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch (error) {
        console.error('JWT验证失败:', error);
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                error: '认证令牌已过期'
            });
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({
                success: false,
                error: '无效的认证令牌'
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: '认证验证失败'
            });
        }
    }
};
exports.authMiddleware = authMiddleware;
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    (0, exports.authMiddleware)(req, res, next);
};
exports.optionalAuth = optionalAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
const generateToken = (payload) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET未配置');
    }
    return jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: '7d',
        issuer: 'calculus-ai-assistant',
        audience: 'calculus-ai-users'
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET未配置');
    }
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=auth.js.map