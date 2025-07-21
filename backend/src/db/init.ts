// 数据库初始化脚本

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// 数据库初始化
export async function initializeDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL环境变量未配置');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔨 开始初始化数据库...');

    // 读取schema文件
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 执行schema
    await pool.query(schema);

    console.log('✅ 数据库初始化完成');
    
    // 检查表是否创建成功
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📋 创建的表:', result.rows.map(row => row.table_name));

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  require('dotenv').config();
  
  initializeDatabase()
    .then(() => {
      console.log('数据库初始化完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('数据库初始化失败:', error);
      process.exit(1);
    });
} 