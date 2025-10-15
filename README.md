# AI微积分助教 Chrome插件

基于Plasmo框架开发的智能微积分学习助手，支持GitHub OAuth登录、多模式学习、角色切换和AI智能批改。采用现代化科技风UI设计，支持夜间模式和响应式布局。

## 🏗️ 技术架构

### 前端技术栈
- **Chrome插件**: Plasmo框架 + React 18 + TypeScript
- **UI组件**: 科技风设计 + 夜间模式 + 响应式布局
- **Markdown渲染**: react-markdown + remark-math + rehype-katex (支持复杂LaTeX公式)
- **状态管理**: React Hooks + Chrome Storage API
- **认证方式**: GitHub OAuth 2.0
- **构建工具**: Plasmo内置构建系统

### 后端技术栈
- **API服务**: Node.js + Fastify + TypeScript
- **数据库**: Supabase PostgreSQL (云数据库) + Prisma ORM
- **认证**: JWT + GitHub OAuth
- **AI服务**: MathPix (数学OCR识别) + Deepseek (智能批改评分)

### 数据流架构
```
Chrome插件 (Plasmo) → GitHub OAuth → Fastify API → Prisma ORM → Supabase PostgreSQL
                                      ↓
                                  MathPix OCR
                                      ↓
                                  Deepseek AI
```

## 🔐 认证功能

- **GitHub OAuth登录**: 支持GitHub账户一键登录，状态持久化
- **JWT Token**: 安全的无状态认证
- **用户管理**: 支持学生和教师角色动态切换
- **权限控制**: 基于角色的访问控制
- **状态保持**: popup打开时自动恢复登录状态

## 📚 学习模式

### 学生模式
- **刷题模式**: 上传包含完整题目和解答的文件，系统进行全面批改
- **作业模式**: 上传仅包含解题过程的文件，系统匹配题目库进行针对性批改
- **智能识别**: 自动OCR手写内容识别
- **个性化建议**: 基于解题过程提供学习建议

### 教师模式  
- **班级管理**: 创建和管理班级，生成邀请码
- **题目库管理**: 上传和维护题目库
- **批改统计**: 查看学生作业批改数据和统计
- **教学工具**: 提供多种教学辅助功能

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- pnpm >= 8
- Chrome浏览器 >= 88
- Supabase账户
- GitHub OAuth应用（在Supabase中配置）

### 安装依赖
```bash
# 安装前端依赖
pnpm install

# 安装后端依赖
cd backend
npm install
```

### Supabase配置

#### 1. 创建Supabase项目
1. 访问 [supabase.com](https://supabase.com) 创建新项目
2. 记录项目URL和anon public key

#### 2. 配置GitHub OAuth
1. 在Supabase Dashboard → Authentication → Settings → Auth Providers
2. 启用GitHub provider
3. 创建GitHub OAuth App：
   - 访问 GitHub Settings → Developer settings → OAuth Apps
   - Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. 将GitHub Client ID和Secret配置到Supabase

#### 3. 创建Storage Buckets
在Supabase Dashboard → Storage中创建以下buckets：
- `assignments` (作业文件)
- `avatars` (用户头像) 
- `annotated` (批改后的文件)

#### 4. 配置环境变量
```bash
# 复制环境变量文件
cp .env.example .env

# 编辑.env，填入您的配置:
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
JWT_SECRET=your-jwt-secret
DEEPSEEK_API_KEY=your-deepseek-api-key

# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MathPix配置 (替代MyScript进行OCR识别)
MATHPIX_APP_ID=your-mathpix-app-id
MATHPIX_APP_KEY=your-mathpix-app-key

# 文件上传配置  
MAX_FILE_SIZE=104857600  # 100MB
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
├── src/                      # 前端源码目录
│   ├── popup.tsx            # 主Popup界面 (登录+角色导航)
│   ├── sidepanel.tsx        # 侧边栏界面 (全功能视图)
│   ├── popup.css            # Popup样式
│   ├── sidepanel.css        # 侧边栏样式
│   ├── background.ts        # Service Worker
│   ├── common/              # 公共配置
│   │   └── config/
│   │       └── supabase.ts  # Supabase客户端配置
│   ├── contexts/            # React Context
│   │   └── NotificationContext.tsx # 全局通知系统
│   └── components/          # React组件
│       ├── AuthSection.tsx         # GitHub OAuth登录组件
│       ├── MainLayout.tsx          # 主布局组件 (导航+内容区域)
│       ├── Navigation.tsx          # 侧边栏导航 (角色自适应)
│       ├── CompactPopup.tsx        # 紧凑型popup界面
│       ├── HomePage.tsx            # 首页仪表板 (角色自适应+AI搜索)
│       ├── AssignmentsPage.tsx     # 作业页面 (创建/管理/提交)
│       ├── ClassroomsPage.tsx      # 班级页面 (创建/管理/加入)
│       ├── PracticePage.tsx        # 练习页面 (学生自主练习+水平布局)
│       ├── PracticeDetailPage.tsx  # 练习详情页 (查看练习结果和AI反馈)
│       ├── MistakesPage.tsx        # 错题本页面 (分类管理、搜索、复习)
│       ├── KnowledgeGraph.tsx      # 知识图谱可视化 (D3.js力导向图)
│       ├── KnowledgePointDetail.tsx # 知识点详情模态框
│       ├── SimpleMarkdownRenderer.tsx # LaTeX数学公式渲染器
│       ├── Notification.tsx        # 通知组件
│       └── *.css                   # 对应组件样式文件
├── backend/                  # Fastify后端服务
│   ├── src/
│   │   ├── app.ts           # Fastify应用主文件
│   │   ├── config/
│   │   │   └── supabase.ts  # Supabase配置
│   │   ├── middleware/
│   │   │   └── auth.ts      # JWT认证中间件
│   │   ├── services/
│   │   │   └── processing.ts # AI处理服务 (OCR + 批改工作流)
│   │   └── routes/          # API路由模块
│   │       ├── auth.ts      # 认证路由 (GitHub OAuth)
│   │       ├── assignment.ts # 作业管理路由
│   │       ├── classroom.ts # 班级管理路由
│   │       ├── submissions.ts # 提交管理路由
│   │       ├── upload.ts    # 文件上传路由
│   │       ├── ocr.ts       # OCR识别路由 (MathPix)
│   │       ├── ai.ts        # AI批改路由 (Deepseek)
│   │       ├── practice.ts  # 练习模式路由
│   │       ├── mistakes.ts  # 错题本路由
│   │       ├── knowledge.ts # 知识图谱路由
│   │       └── dashboard.ts # 仪表板统计路由
│   ├── prisma/              # Prisma数据库配置
│   │   ├── schema.prisma    # 数据库模型定义
│   │   └── migrations/      # 数据库迁移文件
│   └── package.json
├── tabs/                     # 全页面标签页 (未来功能)
├── assets/                   # 静态资源
├── book/                     # 微积分教材PDF
├── homework/                 # 测试作业文件
├── plasmo.config.ts         # Plasmo配置
├── package.json
├── pnpm-workspace.yaml      # pnpm工作区配置
└── .cursor/                 # Cursor IDE规则
```

### 核心文件说明

**前端入口文件:**
- `src/popup.tsx` - Chrome插件的主要入口，处理登录状态和基本导航
- `src/sidepanel.tsx` - 侧边栏模式的完整应用界面

**核心布局组件:**
- `MainLayout.tsx` - 应用主布局，包含导航栏、内容区域、主题切换
- `Navigation.tsx` - 角色自适应的侧边栏导航(教师/学生不同菜单)
- `CompactPopup.tsx` - 紧凑模式的快捷操作界面

**功能页面组件:**
- `HomePage.tsx` - 角色自适应的仪表板 (展示统计信息、快捷操作、AI智能搜索)
- `AssignmentsPage.tsx` - 作业管理页面 (教师创建作业，学生查看提交，支持文件重新提交)
- `ClassroomsPage.tsx` - 班级管理页面 (教师管理班级，学生加入班级)
- `PracticePage.tsx` - 学生练习页面 (自主练习模式，即时AI反馈，水平操作按钮)
- `PracticeDetailPage.tsx` - 练习详情页 (查看OCR结果、AI评分、学习建议)
- `MistakesPage.tsx` - 错题本页面 (分类管理、搜索筛选、复习跟踪)
- `KnowledgeGraph.tsx` - 知识图谱 (D3.js可视化，交互式探索知识点关系)

**后端API模块:**
- `routes/auth.ts` - GitHub OAuth认证流程处理
- `routes/assignment.ts` - 作业CRUD操作、权限验证、OCR题目识别
- `routes/classroom.ts` - 班级管理、成员管理、邀请码系统
- `routes/submissions.ts` - 作业提交、自动批改工作流、重新提交功能
- `routes/upload.ts` - 文件上传、Supabase Storage集成
- `routes/ocr.ts` - MathPix OCR识别服务 (替代MyScript)
- `routes/ai.ts` - Deepseek AI批改服务 (评分、反馈、建议)
- `routes/practice.ts` - 练习模式管理、历史记录、详情查询
- `routes/mistakes.ts` - 错题本CRUD、分类管理、自动添加
- `routes/knowledge.ts` - 知识图谱数据、节点关系、初始化
- `routes/dashboard.ts` - 仪表板统计数据、学习分析
- `services/processing.ts` - AI处理服务 (统一OCR和批改工作流)

## 🗄️ 数据库架构 (Prisma)

### 核心模型
- **User**: 用户信息 (支持GitHub OAuth + 本地认证，角色管理)
- **Classroom**: 班级信息 (教师创建，学生加入，邀请码系统)
- **ClassroomMember**: 班级成员关系 (多对多关联)
- **Assignment**: 作业信息 (教师发布，关联班级，支持OCR题目识别)
- **FileUpload**: 文件上传记录 (支持多种用途，Supabase Storage集成)
- **Submission**: 作业提交 (关联作业和文件，支持练习和作业模式)
- **MathPixResult**: MathPix OCR识别结果 (数学公式识别)
- **DeepseekResult**: Deepseek AI批改结果 (评分、反馈、建议)

### 知识图谱与学习分析模型
- **KnowledgePoint**: 知识点表 (支持层级结构，章节分类，掌握度跟踪)
- **ErrorAnalysis**: 错题分析表 (错误类型分类，严重程度评估，AI建议)
- **SimilarQuestion**: 类似题生成记录 (基于错题自动生成，用户评分)
- **SimilarQuestionKnowledgePoint**: 类似题与知识点多对多关联
- **LearningRecommendation**: AI学习建议表 (个性化学习路径，优先级管理)

### 错题本功能模型
- **MistakeCategory**: 错题分类表 (支持多级分类，自定义图标颜色)
- **MistakeItem**: 错题条目表 (标签系统，笔记管理，间隔复习，掌握度跟踪)

### 关系设计
```prisma
# 用户和认证
User (1:N) Classroom (教师创建班级)
User (1:N) ClassroomMember (学生加入班级)
Classroom (1:N) ClassroomMember

# 作业系统
User (1:N) Assignment (教师创建作业)
Classroom (1:N) Assignment (班级的作业)
Assignment (1:N) Submission (学生提交)

# 文件和处理
User (1:N) FileUpload (用户上传文件)
FileUpload (1:N) Submission (文件用于提交)
FileUpload (1:1) Assignment (作业题目文件)
Submission (1:N) MathPixResult (OCR识别)
Submission (1:N) DeepseekResult (AI批改)

# 知识图谱和学习分析
KnowledgePoint (1:N) KnowledgePoint (层级关系: 父-子)
Submission (1:N) ErrorAnalysis (错题分析)
ErrorAnalysis (N:1) KnowledgePoint (关联知识点)
Submission (1:N) SimilarQuestion (生成类似题)
SimilarQuestion (N:M) KnowledgePoint (多对多)
User (1:N) LearningRecommendation (学习建议)

# 错题本系统
User (1:N) MistakeCategory (用户的分类)
MistakeCategory (1:N) MistakeCategory (层级分类)
User (1:N) MistakeItem (用户的错题)
MistakeItem (N:1) Submission (关联原始提交)
MistakeItem (N:1) MistakeCategory (所属分类)
```

## 🔧 Chrome扩展加载

1. 运行 `pnpm build` 构建项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `build/chrome-mv3-prod` 目录

## 📖 使用指南

### 首次使用
1. **GitHub登录**: 点击popup中的"使用GitHub登录"按钮
2. **角色选择**: 在用户信息区域选择"学生"或"教师"角色
3. **模式选择**: 学生可选择"刷题模式"或"作业模式"

### 学生使用流程

#### 刷题模式
1. 选择"刷题模式"
2. 上传包含题目和解答的PDF或图片文件
3. 系统进行OCR识别和AI全面批改
4. 在侧边栏查看批改结果和学习建议

#### 作业模式
1. 选择"作业模式"
2. 上传仅包含解题过程的文件
3. 系统自动匹配题目库中的对应题目
4. 针对性批改和评分
5. 查看详细的批改报告

### 教师使用流程
1. 切换到"教师"模式
2. 创建班级并生成邀请码
3. 上传题目库文件
4. 查看学生提交和批改统计
5. 管理班级和学生信息

## 🛠️ API接口

### 认证相关
- `POST /api/auth/github/callback` - GitHub OAuth回调处理
- `POST /api/auth/supabase/exchange` - Supabase会话交换
- `POST /api/auth/github/process-token` - GitHub访问令牌处理
- `GET /api/auth/verify` - JWT Token验证
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/logout` - 用户登出

### 作业管理 (教师权限)
- `POST /api/assignments` - 创建作业
- `GET /api/assignments/teacher` - 获取教师的作业列表
- `PUT /api/assignments/:id` - 更新作业信息
- `PATCH /api/assignments/:id/toggle` - 切换作业状态

### 作业查看 (学生权限)
- `GET /api/assignments/student` - 获取学生的作业列表
- `GET /api/classrooms/:id/assignments` - 获取班级作业

### 班级管理
- `GET /api/classrooms/my-classroom` - 获取用户的主要班级
- `POST /api/classrooms` - 创建班级 (教师权限)
- `GET /api/classrooms/teacher` - 获取教师的班级列表
- `GET /api/classrooms/student` - 获取学生的班级列表
- `POST /api/classrooms/join` - 通过邀请码加入班级 (学生权限)
- `GET /api/classrooms/:id/members` - 获取班级成员 (教师权限)

### 提交管理
- `GET /api/submissions` - 获取用户的提交记录
- `POST /api/submissions` - 创建提交 (自动启动批改流程)
- `GET /api/submissions/:id/status` - 获取提交的批改进度

### 文件管理
- `POST /api/files` - 文件上传 (支持多种用途标识)
- `GET /api/files/:id/download` - 文件下载

### 练习模式 (学生功能)
- `GET /api/practice/sessions` - 获取练习历史记录
- `GET /api/practice/sessions/:id` - 获取练习详情
- `DELETE /api/practice/sessions/:id` - 删除练习记录
- `PATCH /api/practice/sessions/:id/difficulty` - 标记题目难度

### 错题本管理
- `GET /api/mistakes/categories` - 获取错题分类列表
- `POST /api/mistakes/categories` - 创建错题分类
- `GET /api/mistakes/items` - 获取错题列表 (支持分类筛选)
- `POST /api/mistakes/items` - 手动添加错题
- `DELETE /api/mistakes/items/:id` - 删除错题
- `PATCH /api/mistakes/items/:id` - 更新错题信息

### 知识图谱与学习分析
- `GET /api/knowledge/graph` - 获取知识图谱数据 (节点、链接、统计)
- `POST /api/knowledge/initialize` - 初始化微积分知识点结构 (教师权限)
- `GET /api/knowledge/:id` - 获取知识点详情
- `GET /api/knowledge/:id/children` - 获取子知识点
- `GET /api/knowledge/:id/related-questions` - 获取相关练习题

### 仪表板统计
- `GET /api/dashboard/stats` - 获取用户学习统计数据

### AI处理 (内部调用)
- `POST /api/ocr/mathpix` - MathPix OCR识别 (内部)
- `POST /api/ai/deepseek/grade` - Deepseek AI批改 (内部)
- `POST /api/ai/deepseek/score` - Deepseek AI评分 (内部)

### 示例请求
```javascript
// GitHub OAuth登录 (通过Supabase)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
});

// 文件上传
const formData = new FormData();
formData.append('file', file);
formData.append('purpose', 'assignment_submission'); // 或 'question_upload'
formData.append('workMode', 'homework'); // 或 'practice'

const uploadResponse = await fetch('http://localhost:3000/api/files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});

// 创建作业提交
const submissionResponse = await fetch('http://localhost:3000/api/submissions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    assignmentId: 123,
    fileUploadIds: [456, 789],
    note: '解题思路说明...'
  })
});

// 查询批改进度
const statusResponse = await fetch(`http://localhost:3000/api/submissions/${submissionId}/status`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
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
- [Supabase文档](https://supabase.com/docs)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [MathPix API](https://docs.mathpix.com/)
- [Deepseek API](https://platform.deepseek.com/)
- [D3.js文档](https://d3js.org/)
- [KaTeX文档](https://katex.org/)

## 📝 开发说明

- **前端**: 使用Plasmo框架，遵循React开发规范，支持热重载
- **后端**: 使用Fastify+Prisma，类型安全的ORM操作
- **数据库**: Supabase PostgreSQL，使用Prisma进行迁移管理
- **认证**: JWT + GitHub OAuth，支持无状态认证
- **AI服务**: 集成MathPix (OCR) 和Deepseek (批改)，提供智能识别和批改功能
- **可视化**: 使用D3.js实现交互式知识图谱，支持力导向布局和节点交互

## 🔄 版本历史

- **v1.0.0**: 基础功能完成，支持文件上传和AI批改
- **v1.1.0**: 添加GitHub OAuth登录和用户管理  
- **v1.2.0**: 重构为Prisma ORM架构，支持类型安全的数据库操作
- **v1.3.0**: 新增多模式学习系统，支持刷题模式和作业模式
- **v1.4.0**: 实现角色动态切换，添加教师功能模块
- **v1.5.0**: 优化登录状态持久化，提升用户体验
- **v1.6.0**: Markdown渲染增强
  - 🔧 **首页搜索增强**: 修复AI搜索结果显示，支持完整markdown格式化内容
  - 🎨 **练习页面优化**: 操作按钮从垂直排列改为水平排列，提升界面美观度
  - ⚡ **Markdown渲染器重构**: 使用react-markdown替代正则表达式，支持复杂LaTeX数学公式
  - 📦 **依赖管理**: 添加react-markdown生态支持，修复构建兼容性问题
- **v1.7.0**: 错题本与知识图谱系统 (当前版本)
  - 📚 **错题本功能**: 支持多级分类、标签管理、间隔复习、掌握度跟踪
  - 🌐 **知识图谱**: D3.js力导向图可视化，交互式探索知识点关系和掌握情况
  - 🔍 **知识点详情**: 详细的知识点信息、子节点导航、相关练习题推荐
  - 📊 **学习分析**: 错题分析、学习建议、类似题生成
  - 🔄 **作业重新提交**: 支持学生在截止日期前重新提交作业
  - 🎯 **练习详情页**: 查看完整的OCR结果、AI评分和学习建议
  - 🔔 **全局通知系统**: 统一的消息提示机制
  - 🏠 **仪表板统计**: 个性化学习数据统计和可视化展示

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
