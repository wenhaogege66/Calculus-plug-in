# 测试指南

## 🧪 系统测试流程

### 前置条件
1. 后端服务器正在运行 (`npm run dev` in backend/)
2. Supabase项目已配置完成
3. 环境变量已正确设置

### 1. 健康检查
```bash
# 测试API服务器状态
curl http://localhost:3000/api/health

# 预期响应：
{
  "success": true,
  "data": {
    "status": "healthy",
    "framework": "Fastify",
    "orm": "Prisma", 
    "database": "Supabase",
    "services": {
      "database": {"status": "healthy", "type": "PostgreSQL (Supabase)"},
      "storage": {"status": "configured", "type": "Supabase Storage"},
      "myscript": {"status": "configured"},
      "deepseek": {"status": "configured"}
    }
  }
}
```

### 2. GitHub OAuth认证测试

#### 获取授权URL
```bash
curl http://localhost:3000/api/auth/github

# 预期响应：
{
  "success": true,
  "data": {
    "authUrl": "https://your-project.supabase.co/auth/v1/authorize?..."
  }
}
```

#### 测试流程
1. 在浏览器中访问返回的`authUrl`
2. 完成GitHub授权
3. 查看回调页面是否显示登录成功
4. 复制生成的JWT token

### 3. API认证测试

#### 验证Token
```bash
# 使用上一步获得的token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/auth/verify

# 预期响应：
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "your-username",
      "email": "your-email",
      "role": "STUDENT",
      "authType": "GITHUB"
    },
    "tokenValid": true,
    "authProvider": "Supabase"
  }
}
```

### 4. 文件上传测试

```bash
# 创建测试文件
echo "测试内容" > test.txt

# 上传文件
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "file=@test.txt" \
     http://localhost:3000/api/files

# 预期响应：
{
  "success": true,
  "message": "文件上传功能正在开发中",
  "data": {
    "filename": "test.txt",
    "mimetype": "text/plain",
    "fileSize": 13,
    "user": {
      "id": 1,
      "username": "your-username"
    }
  }
}
```

### 5. 提交记录测试

```bash
# 获取提交记录
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/submissions

# 预期响应：
{
  "success": true,
  "data": {
    "submissions": []
  }
}
```

### 6. 数据库连接测试

使用Prisma Studio查看数据库：
```bash
cd backend
npm run db:studio
```

访问 http://localhost:5555 查看数据库内容。

### 7. Chrome扩展测试

#### 构建扩展
```bash
pnpm build
```

#### 加载扩展
1. 打开Chrome → 扩展程序 → 开发者模式
2. 点击"加载已解压的扩展程序"
3. 选择 `build/chrome-mv3-prod` 目录

#### 测试扩展功能
1. 点击扩展图标打开popup
2. 点击"使用GitHub登录"
3. 完成OAuth授权
4. 尝试上传测试文件
5. 查看侧边栏功能

## 🔧 故障排除

### 数据库连接问题
```bash
# 检查环境变量
echo $DATABASE_URL

# 测试数据库连接
cd backend
npx prisma db push
```

### Supabase配置问题
1. 检查Supabase Dashboard中的项目URL和keys
2. 确认GitHub OAuth配置正确
3. 验证Storage buckets已创建

### GitHub OAuth问题
1. 检查回调URL设置
2. 确认Client ID和Secret正确
3. 查看Supabase Auth logs

### API调用问题
```bash
# 检查服务器日志
cd backend
npm run dev

# 查看请求详情
curl -v http://localhost:3000/api/health
```

## 📊 性能测试

### 文件上传性能
```bash
# 创建大文件测试
dd if=/dev/zero of=test_10mb.pdf bs=1M count=10

# 测试上传时间
time curl -X POST \
          -H "Authorization: Bearer YOUR_JWT_TOKEN" \
          -F "file=@test_10mb.pdf" \
          http://localhost:3000/api/files
```

### 并发请求测试
```bash
# 使用ab工具测试并发性能
ab -n 100 -c 10 \
   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   http://localhost:3000/api/health
```

## 🔒 安全测试

### JWT Token测试
```bash
# 测试无效token
curl -H "Authorization: Bearer invalid_token" \
     http://localhost:3000/api/files

# 预期响应：401 Unauthorized

# 测试无Authorization头
curl http://localhost:3000/api/files

# 预期响应：401 Unauthorized
```

### 文件类型验证
```bash
# 尝试上传不支持的文件类型
echo "test" > test.exe
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "file=@test.exe" \
     http://localhost:3000/api/files

# 预期：应该被拒绝
```

## 🚦 集成测试

### 完整工作流程
1. GitHub登录 → 获取JWT token
2. 上传PDF文件 → 创建文件记录
3. 创建提交记录 → 关联文件
4. OCR识别 → 提取文本
5. AI批改 → 生成反馈
6. 下载批改结果 → 获取批注PDF

### 自动化测试脚本
```bash
#!/bin/bash
# test_workflow.sh

echo "🧪 开始集成测试..."

# 1. 健康检查
echo "1. 检查API健康状态..."
curl -s http://localhost:3000/api/health | jq .data.status

# 2. 认证测试
echo "2. 测试认证状态..."
# 这里需要手动获取token

# 3. 文件上传测试
echo "3. 测试文件上传..."
# 添加实际的测试逻辑

echo "✅ 集成测试完成！"
``` 