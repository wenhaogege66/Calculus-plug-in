# AI微积分助教 Chrome插件

基于Plasmo框架开发的智能微积分学习助手，支持GitHub OAuth登录、作业批改和个性化学习建议。

## 🏗️ 技术架构

### 前端技术栈
- **Chrome插件**: Plasmo框架 + React 18 + TypeScript
- **UI组件**: 原生CSS + 响应式设计
- **状态管理**: React Hooks + Chrome Storage API
- **认证方式**: GitHub OAuth 2.0
- **构建工具**: Plasmo内置构建系统

### 后端技术栈
- **API服务**: Node.js + Fastify + TypeScript
- **数据库**: Neon PostgreSQL (云数据库) + Prisma ORM
- **认证**: JWT + GitHub OAuth
- **AI服务**: MyScript (OCR) + Deepseek (批改)

### 数据流架构
```
Chrome插件 (Plasmo) → GitHub OAuth → Fastify API → Prisma ORM → Neon PostgreSQL
                                      ↓
                                  MyScript OCR
                                      ↓
                                  Deepseek AI
```

## 🔐 认证功能

- **GitHub OAuth登录**: 支持GitHub账户一键登录
- **JWT Token**: 安全的无状态认证
- **用户管理**: 支持学生和教师角色
- **权限控制**: 基于角色的访问控制

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- pnpm >= 8
- Chrome浏览器 >= 88
- Neon PostgreSQL账户
- GitHub OAuth应用

### 安装依赖
```bash
# 安装前端依赖
pnpm install

# 安装后端依赖
cd backend
npm install
```

### 环境配置
```bash
# 复制环境变量文件
cp env.example backend/.env

# 编辑backend/.env，填入您的配置:
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET=your-jwt-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
DEEPSEEK_API_KEY=your-deepseek-api-key
# MyScript配置...
```

### 数据库初始化
```bash
cd backend

# 生成Prisma客户端
npm run db:generate

# 应用数据库迁移
npm run db:migrate

# 或重置数据库 (开发环境)
npm run db:reset
```

### 开发环境
```bash
# 启动前端开发服务器
pnpm dev

# 启动后端服务器
cd backend
npm run dev
```

### 构建项目
```bash
# 构建Chrome扩展
pnpm build

# 构建后端
cd backend
npm run build
```

## 📁 项目结构

```
Calculus/
├── popup.tsx              # Popup界面 (React组件)
├── sidepanel.tsx          # 侧边栏界面 (React组件) 
├── background.ts          # Service Worker
├── *.css                  # 样式文件
├── backend/               # Fastify后端服务
│   ├── src/
│   │   ├── app.ts        # Fastify应用主文件
│   │   ├── routes/       # API路由
│   │   │   └── auth.ts   # GitHub OAuth认证
│   │   └── middleware/   # 中间件
│   │       └── auth.ts   # JWT认证中间件
│   ├── prisma/           # Prisma配置
│   │   ├── schema.prisma # 数据库模型
│   │   └── migrations/   # 数据库迁移
│   └── package.json
├── book/                  # 微积分教材PDF
└── .cursor/              # Cursor IDE规则
```

## 🗄️ 数据库架构 (Prisma)

### 核心模型
- **User**: 用户信息 (支持GitHub OAuth)
- **FileUpload**: 文件上传记录
- **Submission**: 作业提交
- **MyScriptResult**: OCR识别结果
- **DeepseekResult**: AI批改结果

### 关系设计
```prisma
User (1:N) FileUpload (1:N) Submission (1:N) MyScriptResult
                                      (1:N) DeepseekResult
```

## 🔧 Chrome扩展加载

1. 运行 `pnpm build` 构建项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `build/chrome-mv3-prod` 目录

## 📖 使用指南

1. **GitHub登录**: 点击popup中的"使用GitHub登录"按钮
2. **上传作业**: 在popup或侧边栏中上传PDF、图片等作业文件
3. **AI批改**: 系统自动进行手写识别和AI批改
4. **查看结果**: 在侧边栏查看批改结果和学习建议

## 🛠️ API接口

### 认证相关
- `GET /api/auth/github` - 获取GitHub OAuth授权URL
- `GET /api/auth/github/callback` - GitHub OAuth回调
- `GET /api/auth/verify` - 验证JWT Token
- `POST /api/auth/logout` - 用户登出

### 业务接口 (需要认证)
- `GET /api/health` - 系统健康检查
- `POST /api/files` - 文件上传
- `GET /api/submissions` - 获取提交记录
- `POST /api/submissions` - 提交作业
- `POST /api/ocr/myscript` - MyScript识别
- `POST /api/ai/deepseek/grade` - AI批改

### 示例请求
```javascript
// GitHub登录
const authResponse = await fetch('http://localhost:3000/api/auth/github');
const { authUrl } = authResponse.data;
window.open(authUrl);

// 带认证的API请求
const response = await fetch('http://localhost:3000/api/files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});
```

## 🔄 开发命令

### 前端 (Plasmo)
```bash
pnpm dev      # 开发模式
pnpm build    # 生产构建
```

### 后端 (Fastify + Prisma)
```bash
npm run dev           # 开发模式
npm run build         # TypeScript编译
npm run db:generate   # 生成Prisma客户端
npm run db:migrate    # 运行数据库迁移
npm run db:push       # 推送schema变更
npm run db:reset      # 重置数据库
npm run db:studio     # 打开Prisma Studio
```

## 🔗 相关文档

- [Plasmo框架文档](https://docs.plasmo.com/)
- [Fastify文档](https://www.fastify.io/)
- [Prisma文档](https://www.prisma.io/docs)
- [Neon PostgreSQL](https://neon.tech/)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [MyScript API](https://developer.myscript.com/)
- [Deepseek API](https://platform.deepseek.com/)

## 📝 开发说明

- **前端**: 使用Plasmo框架，遵循React开发规范，支持热重载
- **后端**: 使用Fastify+Prisma，类型安全的ORM操作
- **数据库**: Neon PostgreSQL，使用Prisma进行迁移管理
- **认证**: JWT + GitHub OAuth，支持无状态认证
- **AI服务**: 集成MyScript和Deepseek，提供OCR和批改功能

## 🔄 版本历史

- **v1.0.0**: 基础功能完成，支持文件上传和AI批改
- **v1.1.0**: 添加GitHub OAuth登录和用户管理
- **v1.2.0**: 重构为Prisma ORM架构，支持类型安全的数据库操作

## 🧪 开发建议

### 数据库变更
1. 修改 `backend/prisma/schema.prisma`
2. 运行 `npm run db:migrate` 生成并应用迁移
3. 运行 `npm run db:generate` 更新Prisma客户端

### 添加新功能
1. 在 `backend/src/routes/` 中创建新路由
2. 在 `backend/src/middleware/` 中添加中间件
3. 在前端组件中调用相应API

### 调试技巧
- 使用 `npm run db:studio` 查看数据库内容
- 查看 `backend/prisma/migrations/` 了解数据库变更历史
- 使用Chrome DevTools调试扩展程序
