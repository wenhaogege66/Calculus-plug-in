# AI微积分助教 Chrome插件

基于Plasmo框架开发的智能微积分学习助手，支持作业批改和个性化学习建议。

## 🏗️ 技术架构

### 前端技术栈
- **Chrome插件**: Plasmo框架 + React 18 + TypeScript
- **UI组件**: 原生CSS + 响应式设计
- **状态管理**: React Hooks + Context
- **构建工具**: Plasmo内置构建系统

### 后端技术栈
- **API服务**: Node.js + Fastify + TypeScript
- **数据库**: Neon PostgreSQL (云数据库)
- **AI服务**: MyScript (OCR) + Deepseek (批改)

### 数据流架构
```
Chrome插件 (Plasmo) → Fastify API → Neon PostgreSQL
                  ↓
               MyScript OCR
                  ↓
               Deepseek AI
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- pnpm >= 8
- Chrome浏览器 >= 88
- Neon PostgreSQL账户

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
# - DATABASE_URL: Neon PostgreSQL连接字符串
# - DEEPSEEK_API_KEY: Deepseek AI API密钥
# - MYSCRIPT_*: MyScript OCR配置
```

### 数据库初始化
```bash
cd backend
npm run db:init
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
│   │   ├── app.ts        # Fastify应用
│   │   └── db/           # 数据库相关
│   └── package.json
├── book/                  # 微积分教材PDF
└── .cursor/              # Cursor IDE规则
```

## 🔧 Chrome扩展加载

1. 运行 `pnpm build` 构建项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `build/chrome-mv3-prod` 目录

## 📖 使用指南

1. **上传作业**: 在popup或侧边栏中上传PDF、图片等作业文件
2. **AI批改**: 系统自动进行手写识别和AI批改
3. **查看结果**: 在侧边栏查看批改结果和学习建议

## 🛠️ API接口

### 主要端点
- `GET /api/health` - 系统健康检查
- `POST /api/files` - 文件上传
- `POST /api/submissions` - 提交作业
- `POST /api/ocr/myscript` - MyScript识别
- `POST /api/ai/deepseek/grade` - AI批改

### 示例请求
```javascript
// 文件上传
const formData = new FormData();
formData.append('file', file);
const response = await fetch('http://localhost:3000/api/files', {
  method: 'POST',
  body: formData
});
```

## 🔗 相关文档

- [Plasmo框架文档](https://docs.plasmo.com/)
- [Fastify文档](https://www.fastify.io/)
- [Neon PostgreSQL](https://neon.tech/)
- [MyScript API](https://developer.myscript.com/)
- [Deepseek API](https://platform.deepseek.com/)

## 📝 开发说明

- 前端使用Plasmo框架，遵循React开发规范
- 后端使用Fastify，支持插件化架构
- 数据库使用Neon PostgreSQL，支持SSL连接
- AI服务集成MyScript和Deepseek，提供OCR和批改功能

## 🔄 版本历史

- v1.0.0: 基础功能完成，支持文件上传和AI批改
