// Supabase Auth认证路由

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase, supabaseAdmin } from '../config/supabase';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 定义JWT载荷类型
interface JWTPayload {
  userId: number;
  email: string;
  username: string;
  role: string;
  authType: string;
  supabaseUserId?: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // GitHub OAuth授权URL生成 (使用Supabase Auth)
  fastify.get('/auth/github', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback?next=${encodeURIComponent('http://localhost:3000/api/auth/github/callback')}`
        }
      });
      
      if (error) {
        return reply.code(500).send({
          success: false,
          error: `GitHub OAuth初始化失败: ${error.message}`
        });
      }

      return {
        success: true,
        data: {
          authUrl: data.url
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

  // GitHub OAuth回调处理 (Supabase Auth处理)
  fastify.get('/auth/github/callback', async (request: FastifyRequest<{
    Querystring: { 
      access_token?: string; 
      refresh_token?: string; 
      expires_in?: string;
      token_type?: string;
      error?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { access_token, refresh_token, error: oauthError } = request.query;
      
      if (oauthError) {
        return reply.code(400).send({
          success: false,
          error: `OAuth错误: ${oauthError}`
        });
      }

      if (!access_token) {
        return reply.code(400).send({
          success: false,
          error: '缺少访问令牌'
        });
      }

      // 使用access_token设置Supabase session
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || ''
      });

      if (sessionError || !sessionData.user) {
        return reply.code(400).send({
          success: false,
          error: '设置用户会话失败'
        });
      }

      const supabaseUser = sessionData.user;
      
      // 查找或创建用户记录
      let user = await findOrCreateSupabaseUser({
        supabaseUserId: supabaseUser.id,
        email: supabaseUser.email!,
        username: supabaseUser.user_metadata?.user_name || supabaseUser.user_metadata?.name || 'GitHub用户',
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
        githubId: supabaseUser.user_metadata?.provider_id,
        githubUsername: supabaseUser.user_metadata?.user_name
      });

      // 生成我们自己的JWT token (包含用户详细信息)
      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        authType: user.authType,
        supabaseUserId: supabaseUser.id
      };
      
      const token = fastify.jwt.sign(tokenPayload, {
        expiresIn: '7d'
      });

      // 返回成功页面
      const successPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>登录成功</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: #4CAF50; margin-bottom: 20px; }
            .user-info { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; }
            .avatar { border-radius: 50%; margin-bottom: 10px; }
            .token-section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .token { word-break: break-all; font-family: monospace; font-size: 12px; background: #e8e8e8; padding: 10px; border-radius: 4px; }
            .btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px; }
            .btn:hover { background: #45a049; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ GitHub登录成功！</h1>
            <div class="user-info">
              <img src="${user.avatarUrl || '/default-avatar.png'}" width="80" height="80" class="avatar">
              <p><strong>用户名:</strong> ${user.username}</p>
              <p><strong>邮箱:</strong> ${user.email}</p>
              <p><strong>角色:</strong> ${user.role === 'STUDENT' ? '学生' : '教师'}</p>
              <p><strong>认证方式:</strong> GitHub (Supabase)</p>
            </div>
            <div class="token-section">
              <p><strong>认证令牌:</strong></p>
              <div class="token">${token}</div>
              <p><small>请复制上面的令牌，用于Chrome扩展程序的登录。</small></p>
            </div>
            <button class="btn" onclick="copyToken()">复制令牌</button>
            <button class="btn" onclick="window.close()">关闭窗口</button>
          </div>
          <script>
            function copyToken() {
              navigator.clipboard.writeText('${token}').then(() => {
                alert('令牌已复制到剪贴板！');
              });
            }
            
            // 尝试向Chrome扩展发送登录成功消息
            if (window.opener && window.opener.postMessage) {
              window.opener.postMessage({
                type: 'SUPABASE_AUTH_SUCCESS',
                token: '${token}',
                user: ${JSON.stringify({
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  role: user.role,
                  avatarUrl: user.avatarUrl
                })}
              }, '*');
            }
          </script>
        </body>
        </html>
      `;

      return reply.type('text/html').send(successPage);

    } catch (error) {
      fastify.log.error('Supabase Auth回调处理失败:', error);
      
      const errorPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>登录失败</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #f44336; }
            .btn { background: #f44336; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">❌ GitHub登录失败</h1>
            <p>错误信息: ${error instanceof Error ? error.message : '未知错误'}</p>
            <button class="btn" onclick="window.close()">关闭窗口</button>
          </div>
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
        tokenValid: true,
        authProvider: 'Supabase'
      }
    };
  });

  // 登出端点
  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 可选：从Supabase中登出
      await supabase.auth.signOut();
      
      return {
        success: true,
        message: '登出成功'
      };
    } catch (error) {
      return {
        success: true,
        message: '登出成功 (本地令牌已失效)'
      };
    }
  });

  // 查找或创建Supabase用户
  async function findOrCreateSupabaseUser(userData: {
    supabaseUserId: string;
    email: string;
    username: string;
    avatarUrl?: string;
    githubId?: string;
    githubUsername?: string;
  }) {
    const { supabaseUserId, email, username, avatarUrl, githubId, githubUsername } = userData;

    // 首先尝试通过github_id查找
    if (githubId) {
      let user = await prisma.user.findUnique({
        where: { githubId }
      });

      if (user) {
        // 用户存在，更新信息
        user = await prisma.user.update({
          where: { githubId },
          data: {
            githubUsername: githubUsername,
            avatarUrl: avatarUrl,
          }
        });
        return user;
      }
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
      const user = await prisma.user.update({
        where: { id: existingLocalUser.id },
        data: {
          authType: 'GITHUB',
          githubId: githubId,
          githubUsername: githubUsername,
          avatarUrl: avatarUrl,
          passwordHash: null,
        }
      });
      return user;
    }

    // 创建新的GitHub用户
    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        authType: 'GITHUB',
        githubId: githubId,
        githubUsername: githubUsername,
        avatarUrl: avatarUrl,
        role: 'STUDENT',
      }
    });

    return user;
  }
} 