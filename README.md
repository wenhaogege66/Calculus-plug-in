# AI微积分助教Chrome插件

## 📚 项目概述

AI驱动的微积分助教Chrome插件，分为学生端和教师端，支持手写作业批改、错题解析、个性化学习建议。

### 🎯 核心功能

#### 学生端功能
- **手写作业批改**: 上传PDF/图片作业，MyScript识别数学表达式
- **AI智能批改**: Deepseek AI分析解题步骤，标注错误和改进建议
- **错题解析**: 详细的错误分析和正确解法说明
- **个性化复习手册**: 基于错题生成针对性复习内容
- **智能问答**: 基于教材内容的RAG问答系统

#### 教师端功能
- **学情概览**: 班级整体学习情况统计分析
- **错题分析**: 全班常见错误模式和知识点薄弱环节
- **教学建议**: AI生成的针对性教学建议
- **优秀作业推荐**: 自动识别和推荐优秀作业

## 🏗️ 技术架构

### 前端技术栈
- **Chrome插件**: Manifest V3 + React 18 + TypeScript
- **UI组件**: Ant Design
- **状态管理**: Redux Toolkit
- **构建工具**: Webpack 5

### 后端技术栈
- **API服务**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL (用户数据、作业记录)
- **向量数据库**: Chroma (教材内容、RAG搜索)
- **AI服务**: 
  - Deepseek (智能批改和问答)
  - MyScript Interactive Ink (手写识别)
- **部署**: ClawCloud容器化部署

### 数据流架构
```
Chrome插件 -> Express API -> {
  PostgreSQL (结构化数据)
  Chroma (向量搜索)
  MyScript API (手写识别)
  Deepseek API (AI分析)
}
```

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+ (用于Chroma)
- Chrome浏览器
- PostgreSQL 数据库

### 安装依赖
```bash
# 安装Node.js依赖
npm install

# 安装Python依赖 (Chroma)
pip install chromadb

# 启动Chroma服务
chroma run --host localhost --port 8000
```

### 开发环境启动
```bash
# 启动后端API服务
npm run dev:server

# 构建Chrome插件
npm run dev:extension

# 处理教材内容 (有教材后执行)
npm run process-textbook
```

### Chrome插件安装
1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist/` 目录

## 📁 项目结构

```
/
├── README.md                  # 项目说明
├── .cursor/rules/             # 开发规范
├── src/                       # Chrome插件前端
│   ├── background/           # Service Worker
│   ├── content/              # Content Scripts
│   ├── popup/                # 弹窗界面
│   ├── sidepanel/            # 侧边栏界面
│   └── shared/               # 共享组件
├── server/                   # 后端API服务
│   ├── src/
│   │   ├── routes/           # API路由
│   │   ├── services/         # 业务逻辑
│   │   └── db/               # 数据库操作
│   ├── chroma/               # Chroma向量数据
│   └── textbook/             # 教材内容处理
├── docker/                   # 容器化配置
├── scripts/                  # 工具脚本
└── dist/                     # 构建输出
```

## 🎮 功能演示

### 学生使用流程
1. **上传作业**: 在任意网页点击插件，上传PDF/图片作业
2. **自动识别**: MyScript识别手写数学表达式
3. **AI批改**: Deepseek分析解题过程，标注错误
4. **查看结果**: 侧边栏显示详细批改结果和建议
5. **智能问答**: 遇到问题可基于教材内容提问

### 教师使用流程
1. **查看统计**: 插件显示班级学习情况概览
2. **错题分析**: 查看全班常见错误和知识点掌握情况
3. **教学调整**: 根据AI建议调整教学重点
4. **优秀推荐**: 自动推荐优秀作业供学习参考

## 🔧 配置说明

### 环境变量配置
复制 `.env.example` 为 `.env` 并配置以下变量：

```bash
# 数据库配置
DATABASE_URL=postgresql://user:pass@host:port/db

# AI服务配置
DEEPSEEK_API_KEY=your-deepseek-api-key
MYSCRIPT_APPLICATION_KEY=your-myscript-app-key
MYSCRIPT_HMAC_KEY=your-myscript-hmac-key

# Chroma配置
CHROMA_HOST=localhost
CHROMA_PORT=8000

# 其他配置
JWT_SECRET=your-jwt-secret
MAX_FILE_SIZE=10485760
```

### MyScript配置
1. 访问 [MyScript Developer Portal](https://developer.myscript.com/)
2. 创建应用获取 Application Key 和 HMAC Key
3. 配置为数学表达式识别模式

### Deepseek配置
1. 访问 [Deepseek平台](https://platform.deepseek.com/)
2. 获取API密钥
3. 配置到环境变量中

## 🐳 容器化部署

### Docker部署
```bash
# 构建镜像
docker build -t calculus-ai-extension .

# 运行容器
docker run -p 3000:3000 -p 8000:8000 \
  -e DATABASE_URL="your-db-url" \
  -e DEEPSEEK_API_KEY="your-key" \
  calculus-ai-extension
```

### ClawCloud部署
1. 推送代码到Git仓库
2. 在ClawCloud创建新应用
3. 配置环境变量
4. 部署并启动服务

## 📊 API文档

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册

### 作业接口
- `POST /api/submissions` - 提交作业
- `GET /api/submissions/:id` - 获取作业详情
- `GET /api/submissions/my` - 我的作业列表

### AI服务接口
- `POST /api/ai/myscript` - MyScript手写识别
- `POST /api/ai/grading` - AI作业批改
- `POST /api/ai/analysis` - 错题分析

### RAG接口 (开发中)
- `POST /api/rag/query` - 智能问答
- `GET /api/rag/similar` - 查找相似题目

## 🤝 贡献指南

### 开发流程
1. Fork项目到个人仓库
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -m 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 创建Pull Request

### 代码规范
- 遵循TypeScript严格模式
- 使用ESLint和Prettier格式化代码
- 编写单元测试覆盖核心功能
- 提交信息使用约定式提交格式

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📧 联系我们

- 项目地址: [GitHub Repository](https://github.com/username/calculus-ai-extension)
- 问题反馈: [Issues](https://github.com/username/calculus-ai-extension/issues)
- 邮箱: your-email@example.com

## 🔄 更新日志

### v1.0.0 (开发中)
- ✅ Chrome插件基础框架
- ✅ MyScript手写识别集成
- ✅ Deepseek AI批改功能
- ✅ 基础的作业上传和处理
- 🚧 RAG智能问答系统 (等待教材)
- 🚧 教师端功能
- 🚧 数据分析和可视化

---

⭐ 如果这个项目对您有帮助，请给我们一个Star！ 