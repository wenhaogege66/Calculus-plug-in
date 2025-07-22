// GitHub OAuth认证路由

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 定义JWT载荷类型
interface JWTPayload {
  userId: number;
  email: string;
  username: string;
  role: string;
  authType: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string;
  avatar_url: string;
  name: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // GitHub OAuth授权URL生成
  fastify.get('/auth/github', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const redirectUri = process.env.GITHUB_CALLBACK_URL;
      
      if (!clientId || !redirectUri) {
        return reply.code(500).send({
          success: false,
          error: 'GitHub OAuth配置缺失'
        });
      }

      const scope = 'user:email';
      const state = generateRandomString(32); // 防CSRF攻击
      
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
      
      return {
        success: true,
        data: {
          authUrl,
          state
        }
      };
    } catch (error) {
      fastify.log.error('GitHub OAuth URL生成失败:', error);
      return reply.code(500).send({
        success: false,
        error: 'OAuth URL生成失败'
      });
    }
  });

  // GitHub OAuth回调处理
  fastify.get('/auth/github/callback', async (request: FastifyRequest<{
    Querystring: { code: string; state?: string; error?: string }
  }>, reply: FastifyReply) => {
    try {
      const { code, error: oauthError, state } = request.query;
      
      if (oauthError) {
        return reply.code(400).send({
          success: false,
          error: `OAuth错误: ${oauthError}`
        });
      }

      if (!code) {
        return reply.code(400).send({
          success: false,
          error: '缺少授权码'
        });
      }

      // 1. 使用code换取access_token
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      }, {
        headers: {
          'Accept': 'application/json'
        }
      });

      const { access_token } = tokenResponse.data;
      
      if (!access_token) {
        return reply.code(400).send({
          success: false,
          error: '获取访问令牌失败'
        });
      }

      // 2. 使用access_token获取用户信息
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const githubUser: GitHubUser = userResponse.data;

      // 3. 获取用户邮箱(如果public email为空)
      let userEmail = githubUser.email;
      if (!userEmail) {
        const emailResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        const emails = emailResponse.data;
        const primaryEmail = emails.find((email: any) => email.primary);
        userEmail = primaryEmail?.email || `${githubUser.login}@github.local`;
      }

      // 4. 查找或创建用户
      let user = await findOrCreateGitHubUser({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: userEmail,
        avatarUrl: githubUser.avatar_url,
        displayName: githubUser.name || githubUser.login
      });

      // 5. 生成JWT token
      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        authType: user.authType
      };
      
      const token = fastify.jwt.sign(tokenPayload, {
        expiresIn: '7d'
      });

      // 6. 返回成功页面或重定向
      const successPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>登录成功</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: green; }
            .user-info { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ GitHub登录成功！</h1>
          <div class="user-info">
            <img src="${user.avatarUrl}" width="60" height="60" style="border-radius: 50%;">
            <p><strong>用户名:</strong> ${user.username}</p>
            <p><strong>邮箱:</strong> ${user.email}</p>
            <p><strong>角色:</strong> ${user.role}</p>
          </div>
          <p>认证令牌: <code style="word-break: break-all;">${token}</code></p>
          <p>请复制上面的令牌，用于Chrome扩展程序的登录。</p>
          <button onclick="window.close()">关闭窗口</button>
          <script>
            // 尝试向Chrome扩展发送登录成功消息
            if (window.opener && window.opener.postMessage) {
              window.opener.postMessage({
                type: 'GITHUB_AUTH_SUCCESS',
                token: '${token}',
                user: ${JSON.stringify(user)}
              }, '*');
            }
          </script>
        </body>
        </html>
      `;

      return reply.type('text/html').send(successPage);

    } catch (error) {
      fastify.log.error('GitHub OAuth回调处理失败:', error);
      
      const errorPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>登录失败</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ GitHub登录失败</h1>
          <p>错误信息: ${error instanceof Error ? error.message : '未知错误'}</p>
          <button onclick="window.close()">关闭窗口</button>
        </body>
        </html>
      `;
      
      return reply.code(500).type('text/html').send(errorPage);
    }
  });

  // 验证token端点
  fastify.get('/auth/verify', {
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const decoded = await request.jwtVerify() as JWTPayload;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            authType: true,
            githubId: true,
            githubUsername: true,
            avatarUrl: true,
          }
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            error: '用户不存在'
          });
        }

        // 转换类型以匹配接口定义
        request.currentUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role as string,
          authType: user.authType as string,
          githubId: user.githubId || undefined,
          githubUsername: user.githubUsername || undefined,
          avatarUrl: user.avatarUrl || undefined,
        };
      } catch (err) {
        reply.code(401).send({
          success: false,
          error: '无效的认证令牌'
        });
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      success: true,
      data: {
        user: request.currentUser,
        tokenValid: true
      }
    };
  });

  // 登出端点
  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    // JWT是无状态的，客户端删除token即可
    return {
      success: true,
      message: '登出成功'
    };
  });

  // 查找或创建GitHub用户
  async function findOrCreateGitHubUser(githubUserData: {
    githubId: string;
    username: string;
    email: string;
    avatarUrl: string;
    displayName: string;
  }) {
    const { githubId, username, email, avatarUrl, displayName } = githubUserData;

    // 首先尝试通过github_id查找
    let user = await prisma.user.findUnique({
      where: { githubId }
    });

    if (user) {
      // 用户存在，更新信息
      user = await prisma.user.update({
        where: { githubId },
        data: {
          githubUsername: username,
          avatarUrl: avatarUrl,
        }
      });
      return user;
    }

    // 检查是否有相同邮箱的本地用户
    const existingLocalUser = await prisma.user.findFirst({
      where: {
        email: email,
        authType: 'LOCAL'
      }
    });

    if (existingLocalUser) {
      // 存在本地用户，将其转换为GitHub用户
      user = await prisma.user.update({
        where: { id: existingLocalUser.id },
        data: {
          authType: 'GITHUB',
          githubId: githubId,
          githubUsername: username,
          avatarUrl: avatarUrl,
          passwordHash: null,
        }
      });
      return user;
    }

    // 创建新的GitHub用户
    user = await prisma.user.create({
      data: {
        username: displayName || username,
        email: email,
        authType: 'GITHUB',
        githubId: githubId,
        githubUsername: username,
        avatarUrl: avatarUrl,
        role: 'STUDENT',
      }
    });

    return user;
  }
}

// 生成随机字符串(用于state参数)
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
} 