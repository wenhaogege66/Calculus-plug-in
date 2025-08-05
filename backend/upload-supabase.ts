import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// ✅ 加载 .env 文件
dotenv.config();

// ✅ 从环境变量读取配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 缺少 Supabase 环境变量，请检查 .env 文件');
  process.exit(1);
}

// ✅ 创建 Admin 客户端
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ✅ 本地文件路径
const localFilePath = '/Users/wenhao/XLab/Calculus/homework/题目.png';

// ✅ 检查文件是否存在
if (!fs.existsSync(localFilePath)) {
  console.error(`❌ 文件不存在: ${localFilePath}`);
  process.exit(1);
}

// ✅ 读取文件
const fileBuffer = fs.readFileSync(localFilePath);
const fileExt = path.extname(localFilePath);
const uniqueName = `${Date.now()}${fileExt}`; // 避免文件名冲突
const bucketName = 'assignments';

async function uploadFile() {
  try {
    console.log(`🚀 开始上传文件: ${localFilePath}`);

    // 上传文件
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(uniqueName, fileBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      console.error('❌ 上传失败:', error.message);
      process.exit(1);
    }

    console.log('✅ 上传成功:', data);

    // 获取公共 URL（仅调试用）
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from(bucketName)
      .getPublicUrl(uniqueName);

    console.log('🌍 文件访问 URL:', publicUrlData.publicUrl);
  } catch (err) {
    console.error('❌ 执行出错:', err);
    process.exit(1);
  }
}

uploadFile();