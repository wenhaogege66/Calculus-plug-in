"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/register', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, email, password, role = 'student' } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            error: '用户名、邮箱和密码都是必填项'
        });
    }
    if (!['student', 'teacher'].includes(role)) {
        return res.status(400).json({
            success: false,
            error: '角色必须是 student 或 teacher'
        });
    }
    const userId = `user_${Date.now()}`;
    const token = (0, auth_1.generateToken)({
        userId,
        email,
        role: role
    });
    res.json({
        success: true,
        data: {
            token,
            user: {
                id: userId,
                username,
                email,
                role,
                createdAt: new Date().toISOString()
            }
        }
    });
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: '邮箱和密码都是必填项'
        });
    }
    const userId = `user_${email.replace('@', '_').replace('.', '_')}`;
    const token = (0, auth_1.generateToken)({
        userId,
        email,
        role: 'student'
    });
    res.json({
        success: true,
        data: {
            token,
            user: {
                id: userId,
                username: email.split('@')[0],
                email,
                role: 'student',
                lastLoginAt: new Date().toISOString()
            }
        }
    });
}));
router.get('/me', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: '需要认证'
        });
    }
    res.json({
        success: true,
        data: {
            id: 'temp_user_123',
            username: 'test_user',
            email: 'test@example.com',
            role: 'student',
            profile: {
                school: '测试学校',
                grade: '大学一年级',
                class: '数学1班'
            },
            createdAt: new Date().toISOString()
        }
    });
}));
router.post('/logout', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        message: '登出成功'
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map