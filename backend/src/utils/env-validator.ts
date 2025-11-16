// 环境变量验证工具

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
}

const ENV_CONFIGS: EnvConfig[] = [
  // 数据库配置
  { name: 'DATABASE_URL', required: true, description: 'Supabase PostgreSQL连接字符串' },

  // Supabase配置
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase项目URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, description: 'Supabase匿名密钥' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase服务角色密钥' },

  // AI服务配置
  { name: 'DEEPSEEK_API_KEY', required: true, description: 'Deepseek AI批改服务密钥' },
  { name: 'MATHPIX_APP_ID', required: true, description: 'MathPix OCR应用ID' },
  { name: 'MATHPIX_APP_KEY', required: true, description: 'MathPix OCR应用密钥' },

  // JWT配置
  { name: 'JWT_SECRET', required: false, description: 'JWT签名密钥（可选，默认使用fallback）' },

  // 服务器配置
  { name: 'PORT', required: false, description: '服务器端口（可选，默认3000）' },
  { name: 'NODE_ENV', required: false, description: '运行环境（可选，默认development）' },
  { name: 'MAX_FILE_SIZE', required: false, description: '最大文件大小（可选，默认100MB）' },
];

export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of ENV_CONFIGS) {
    const value = process.env[config.name];

    if (!value || value.trim() === '') {
      if (config.required) {
        errors.push(`❌ 缺少必需的环境变量: ${config.name} - ${config.description}`);
      } else {
        warnings.push(`⚠️  未设置可选环境变量: ${config.name} - ${config.description}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function printEnvValidationResult(result: { valid: boolean; errors: string[]; warnings: string[] }) {

  if (result.errors.length > 0) {
    console.error('💥 发现以下错误:');
    result.errors.forEach(error => console.error(`  ${error}`));
    console.error('\n');
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  警告信息:');
    result.warnings.forEach(warning => console.warn(`  ${warning}`));
    console.warn('\n');
  }

  if (result.valid) {
    console.log('✅ 所有必需的环境变量均已配置\n');
  } else {
    console.error('❌ 环境变量验证失败，请检查.env文件\n');
    console.error('提示: 复制 .env.example 到 .env 并填写必要的配置\n');
  }
}
