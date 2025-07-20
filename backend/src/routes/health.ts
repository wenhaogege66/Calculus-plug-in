// 健康检查路由

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 基础健康检查
router.get('/', asyncHandler(async (req: Request, res: Response) => {
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

// 详细健康检查
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
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

// 数据库连接检查
async function checkDatabase(): Promise<{status: string, message?: string}> {
  try {
    if (!process.env.DATABASE_URL) {
      return { status: 'not_configured' };
    }
    
    // 这里应该实际测试数据库连接
    // const { Pool } = require('pg');
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // await pool.query('SELECT 1');
    
    return { status: 'healthy' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Database connection failed' 
    };
  }
}

// MyScript服务检查 (简单)
function checkMyScript(): {status: string, message?: string} {
  const hasKey = !!(process.env.MYSCRIPT_APPLICATION_KEY && process.env.MYSCRIPT_HMAC_KEY);
  const hasEndpoint = !!process.env.MYSCRIPT_API_ENDPOINT;
  
  if (!hasKey || !hasEndpoint) {
    return { status: 'not_configured' };
  }
  
  return { status: 'configured' };
}

// MyScript服务检查 (详细)
async function checkMyScriptDetailed(): Promise<{status: string, message?: string, details?: any}> {
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
    
    // 这里可以添加实际的API连接测试
    return { 
      status: 'configured',
      details: {
        endpoint: process.env.MYSCRIPT_API_ENDPOINT,
        wsEndpoint: process.env.MYSCRIPT_WEBSOCKET_ENDPOINT
      }
    };
  } catch (error) {
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'MyScript check failed' 
    };
  }
}

// Deepseek服务检查 (简单)
function checkDeepseek(): {status: string, message?: string} {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { status: 'not_configured' };
  }
  
  return { status: 'configured' };
}

// Deepseek服务检查 (详细)
async function checkDeepseekDetailed(): Promise<{status: string, message?: string, details?: any}> {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return { status: 'not_configured' };
    }
    
    // 这里可以添加实际的API连接测试
    return { 
      status: 'configured',
      details: {
        apiKeyConfigured: true,
        baseURL: 'https://api.deepseek.com/v1'
      }
    };
  } catch (error) {
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Deepseek check failed' 
    };
  }
}

// Chroma服务检查 (简单)
function checkChroma(): {status: string, message?: string} {
  const hasHost = !!process.env.CHROMA_HOST;
  
  if (!hasHost) {
    return { status: 'not_configured' };
  }
  
  return { status: 'configured' };
}

// Chroma服务检查 (详细)
async function checkChromaDetailed(): Promise<{status: string, message?: string, details?: any}> {
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
  } catch (error) {
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Chroma check failed' 
    };
  }
}

export default router; 