// 认证路由

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { generateToken } from '../middleware/auth';

const router = Router();

// 用户注册
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, role = 'student' } = req.body;

  // 基础验证
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

  // 临时实现：直接返回成功（后续需要连接数据库）
  const userId = `user_${Date.now()}`;
  
  const token = generateToken({
    userId,
    email,
    role: role as 'student' | 'teacher'
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

// 用户登录
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: '邮箱和密码都是必填项'
    });
  }

  // 临时实现：模拟登录成功（后续需要验证数据库）
  const userId = `user_${email.replace('@', '_').replace('.', '_')}`;
  
  const token = generateToken({
    userId,
    email,
    role: 'student' // 临时固定为学生角色
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

// 获取当前用户信息
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  // 这个路由需要认证，但暂时不强制要求
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '需要认证'
    });
  }

  // 临时实现：返回模拟用户信息
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

// 登出
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  // JWT是无状态的，实际上不需要服务器端处理登出
  // 客户端删除token即可
  res.json({
    success: true,
    message: '登出成功'
  });
}));

export default router; 