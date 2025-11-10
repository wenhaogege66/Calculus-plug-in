// PrismaClient单例实例
// 解决多实例化导致的数据库连接池耗尽和内存泄漏问题

import { PrismaClient } from '@prisma/client';

// 扩展全局类型以支持开发环境的热重载
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// 在开发环境使用全局变量防止热重载时创建多个实例
// 生产环境直接创建新实例
export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// 导出类型以便在其他文件中使用
export type { PrismaClient } from '@prisma/client';
