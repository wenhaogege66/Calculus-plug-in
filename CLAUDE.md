# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Every time you complete the modification of the code, you should determine whether the corresponding parts in Claude.md and Readme.md need to be modified

## Project Overview

AI微积分助教 (AI Calculus Assistant) - A Chrome extension built with Plasmo framework for intelligent calculus homework grading. The system provides OCR recognition using MathPix API and AI grading using Deepseek API, supporting both student practice mode and homework mode with teacher-student role management. Features a modern, tech-styled UI with dark mode support and responsive design.

## Architecture

### Frontend (Chrome Extension)
- **Framework**: Plasmo + React 18 + TypeScript
- **Authentication**: GitHub OAuth via Supabase
- **State Management**: React Hooks + Chrome Storage API
- **UI Design**: Modern tech-styled interface with dark mode support and responsive design
- **Markdown & LaTeX Rendering**: react-markdown + remark-math + rehype-katex for professional mathematical content display
- **Architecture**: Component-based modular design with page routing and role-based UI
- **Entry Points**: 
  - `popup.tsx` - Main popup interface (compact mode)
  - `sidepanel.tsx` - Side panel view (full-width mode)
  - `tabs/` - Full-page tab views (future implementation)
  - `background.ts` - Service worker for background tasks
- **Core Layout Components**:
  - `MainLayout.tsx` - Main application layout with navigation
  - `Navigation.tsx` - Role-based sidebar navigation (teacher/student)
  - `CompactPopup.tsx` - Compact popup interface for quick actions
- **Page Components** (Role-based routing):
  - `HomePage.tsx` - Dashboard with role-specific widgets and stats
  - `AssignmentsPage.tsx` - Assignment management (teacher) / assignment list (student)
  - `ClassroomsPage.tsx` - Classroom management and member administration
  - `PracticePage.tsx` - Self-practice mode for students
- **Authentication Components**:
  - `AuthSection.tsx` - GitHub OAuth login interface

### Backend (API Server)
- **Framework**: Fastify + TypeScript
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Authentication**: Supabase built-in OAuth with GitHub Provider
- **File Storage**: Supabase Storage (S3-like) for assignments, questions, and graded files
- **AI Services**: MathPix (mathematical OCR:https://docs.mathpix.com/#introduction)(https://mathpix.com/docs/convert/overview) + Deepseek (scoring, future: grading/annotation)

### Database Schema (Prisma)
Key models: `User`, `FileUpload`, `Submission`, `MathPixResult`, `DeepseekResult`, `Classroom`, `Assignment`
- Supports both GitHub OAuth and local authentication
- Role-based access (STUDENT/TEACHER)
- Submission tracking with status management
- Classroom and assignment management for teachers

## Development Commands

### Frontend (Plasmo Extension)
```bash
pnpm dev          # Development mode with hot reload
pnpm build        # Production build for Chrome
pnpm build:firefox # Firefox build
pnpm package      # Package extension
```

### Backend (Fastify + Prisma)
```bash
npm run dev           # Development server with auto-restart
npm run build         # TypeScript compilation
npm run start         # Production server
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run database migrations
npm run db:push       # Push schema changes
npm run db:reset      # Reset database (dev only)
npm run db:studio     # Open Prisma Studio
npm run lint          # ESLint
npm run format        # Prettier formatting
```

### Workspace Management
```bash
pnpm install      # Install all dependencies (root + backend)
cd backend && npm install  # Backend only
```

## Supabase Configuration

### Database Setup
Project uses fresh Supabase instance with empty schema. Database migrations via Prisma will create all necessary tables.

### Storage Buckets
Required Supabase Storage buckets (create manually in Supabase Dashboard):
- `assignments` - Student submissions (PDF/images)
- `questions` - Teacher uploaded question files  
- `annotated` - AI-processed files with grading annotations
- `avatars` - User profile images

### Authentication
Uses Supabase built-in GitHub OAuth provider (no custom JWT implementation needed).

## Key Configuration

### Environment Variables
Backend requires:
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (e.g., https://yourproject.supabase.co)
- `SUPABASE_ANON_KEY` - Supabase anonymous key  
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `DEEPSEEK_API_KEY` - AI scoring service
- `MATHPIX_APP_ID` - MathPix application ID
- `MATHPIX_APP_KEY` - MathPix application key

Frontend (Plasmo) requires:
- `PLASMO_PUBLIC_SUPABASE_URL` - Same as backend SUPABASE_URL
- `PLASMO_PUBLIC_SUPABASE_ANON_KEY` - Same as backend SUPABASE_ANON_KEY
- `PLASMO_PUBLIC_API_BASE_URL` - Backend API endpoint (default: http://localhost:3000/api)

Note: Storage endpoints are handled automatically by Supabase client - no additional configuration needed.

### Database Workflow
1. Modify `backend/prisma/schema.prisma`
2. Run `npm run db:migrate` to create migration
3. Run `npm run db:generate` to update Prisma client

### Chrome Extension Loading
1. Build with `pnpm build`
2. Load `build/chrome-mv3-prod` in Chrome Developer Mode

## Important Files and Locations

### Frontend Components Structure

**Entry Points:**
- `src/popup.tsx` - Main popup interface with authentication and role-based navigation
- `src/sidepanel.tsx` - Side panel view with full application features

**Layout & Navigation:**
- `src/components/MainLayout.tsx` - Main application layout with sidebar navigation and theme management
- `src/components/Navigation.tsx` - Role-based navigation menu (teacher/student specific items)
- `src/components/CompactPopup.tsx` - Compact popup interface for quick access

**Page Components:**
- `src/components/HomePage.tsx` - Role-specific dashboard with widgets, stats, and AI-powered search with markdown rendering
- `src/components/AssignmentsPage.tsx` - Full-featured assignment management with filtering, creation, and submission
- `src/components/ClassroomsPage.tsx` - Classroom management, member administration, and invite system
- `src/components/PracticePage.tsx` - Self-practice mode with file upload, AI grading, and horizontal layout for operation buttons

**Utility Components:**
- `src/components/SimpleMarkdownRenderer.tsx` - Professional LaTeX and markdown renderer using react-markdown + KaTeX

**Authentication:**
- `src/components/AuthSection.tsx` - GitHub OAuth authentication flow

**Backend Core:**
- `backend/src/app.ts` - Fastify server setup with route registration
- `backend/src/routes/` - API route handlers (auth, assignments, classrooms, submissions, files, OCR, AI)
- `backend/src/middleware/auth.ts` - JWT authentication middleware

### API Endpoints

**Authentication:**
- `POST /api/auth/github/callback` - GitHub OAuth callback processing
- `POST /api/auth/supabase/exchange` - Supabase session exchange
- `POST /api/auth/github/process-token` - Process GitHub access token
- `GET /api/auth/verify` - JWT token verification
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/logout` - User logout

**File Management:**
- `POST /api/files` - File upload (multipart) with purpose-based routing
- `GET /api/files/:id/download` - File download

**Assignment Management:**
- `POST /api/assignments` - Create assignment (teacher only)
- `GET /api/assignments/teacher` - Get teacher's assignments
- `GET /api/assignments/student` - Get student's assignments
- `GET /api/classrooms/:id/assignments` - Get classroom assignments
- `PUT /api/assignments/:id` - Update assignment
- `PATCH /api/assignments/:id/toggle` - Toggle assignment status

**Classroom Management:**
- `GET /api/classrooms/my-classroom` - Get user's primary classroom
- `POST /api/classrooms` - Create classroom (teacher only)
- `GET /api/classrooms/teacher` - Get teacher's classrooms
- `GET /api/classrooms/student` - Get student's classrooms
- `POST /api/classrooms/join` - Join classroom via invite code
- `GET /api/classrooms/:id/members` - Get classroom members

**Submission Management:**
- `GET /api/submissions` - Get user submissions
- `POST /api/submissions` - Create submission with auto-grading workflow
- `GET /api/submissions/:id/status` - Get submission processing status

**AI Processing:**
- `/api/ocr/mathpix` - OCR processing (internal)
- `/api/ai/deepseek/grade` - AI grading (internal)
- Internal workflow endpoints for automated processing

### File Storage
- Test files available at `/Users/wenhao/XLab/Calculus/homework/test.pdf`
- Course materials in `/Users/wenhao/XLab/Calculus/book/` (PDF textbooks)
- Files stored in Supabase Storage buckets:
  - `assignments` - Student homework submissions
  - `questions` - Teacher uploaded question images
  - `annotated` - AI-graded files with annotations
  - `avatars` - User profile pictures

## Development Workflow

### Adding New Features
1. Backend: Create route in `backend/src/routes/`
2. Database: Update Prisma schema if needed
3. Frontend: Add UI components and API calls
4. Ensure proper authentication middleware usage

### Testing API Endpoints
Use backend's built-in endpoints or Prisma Studio (`npm run db:studio`) for database inspection.

### AI Service Usage
**MathPix OCR:**
- Teachers: Upload and recognize mathematical content from images → Build structured question bank
- Students: Convert handwritten/printed mathematical solutions to text and LaTeX for AI processing
- Advanced: Mathematical formula recognition, equation parsing, and symbol detection

**DeepSeek AI:**
- Currently: Basic scoring of student submissions (0-100 points)
- Planned: Detailed grading, error annotation, learning suggestions, mistake analysis
- Future: RAG-enhanced grading with textbook reference and standard answers

### Future Enhancements (Roadmap)

**Question Bank & OCR Enhancement:**
- Automatic question recognition and structured storage
- Question-answer intelligent matching system
- Multi-format question parsing (handwritten, printed, LaTeX)
- Question difficulty assessment and tagging system

**RAG (Retrieval-Augmented Generation) Integration:**
- Vector database integration for textbook content and standard answers
- Semantic search for relevant reference materials during grading
- Context-aware feedback generation based on curriculum standards
- Personalized learning path recommendations
- Error pattern analysis with corrective suggestions

**Advanced AI Features:**
- Multi-modal understanding (text + mathematical expressions + diagrams)
- Step-by-step solution validation
- Partial credit assignment for incomplete solutions
- Plagiarism detection and similarity analysis
- Learning analytics and progress tracking

### Working with Submissions

The system supports role-based submission workflows:

**Student Workflows:**
- **Practice Mode** (`workMode: "practice"`) - Self-paced learning with immediate AI feedback
  - Upload complete problems with solutions
  - Automatic OCR recognition and AI grading
  - No assignment association required
- **Homework Mode** (`workMode: "homework"`) - Assignment-based submissions
  - Upload solutions for specific assignments
  - Matched against teacher-created assignments
  - Deadline and classroom validation
  - Progress tracking and status management

**Teacher Workflows:**
- **Question Upload** - Teachers upload questions for OCR recognition and question bank building
- **Assignment Creation** - Create assignments with optional question files
- **Submission Review** - Monitor student submissions and grading results

**Automated Processing Pipeline:**
1. **File Upload** → Supabase Storage
2. **OCR Recognition** → MathPix API processing
3. **AI Grading** → Deepseek API analysis (students only)
4. **Result Storage** → Database with progress tracking
5. **Status Updates** → Real-time progress monitoring

## Technical Implementation Notes

### Question Bank Implementation
```sql
-- Extend database schema for question bank
CREATE TABLE question_bank (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(id),
  teacher_id INTEGER REFERENCES users(id),
  original_image_path TEXT NOT NULL,
  recognized_text TEXT,
  structured_content JSONB,
  confidence_score DECIMAL(3,2),
  tags TEXT[],
  difficulty_level INTEGER DEFAULT 1,
  subject_chapter TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector embeddings for questions (separate table for performance)
CREATE TABLE question_embeddings (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES question_bank(id) ON DELETE CASCADE,
  embedding_vector VECTOR(1536), -- For OpenAI Ada-002 embeddings
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Textbook content and embeddings
CREATE TABLE textbook_content (
  id SERIAL PRIMARY KEY,
  book_title TEXT NOT NULL,
  chapter_title TEXT,
  section_title TEXT,
  page_number INTEGER,
  content_text TEXT NOT NULL,
  content_type TEXT DEFAULT 'text', -- 'text', 'formula', 'example', 'theorem'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE textbook_embeddings (
  id SERIAL PRIMARY KEY,
  content_id INTEGER REFERENCES textbook_content(id) ON DELETE CASCADE,
  embedding_vector VECTOR(1536),
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add vector similarity search indexes
CREATE INDEX ON question_embeddings USING ivfflat (embedding_vector vector_cosine_ops);
CREATE INDEX ON textbook_embeddings USING ivfflat (embedding_vector vector_cosine_ops);
```

### RAG Integration Architecture

**Option 1: PostgreSQL + pgvector (Recommended)**
- ✅ **Pros**: Native integration with existing Supabase database, cost-effective, ACID compliance
- ⚠️ **Cons**: May need performance tuning for large datasets (>100k vectors)
- **Use Case**: Perfect for educational content where data integrity and cost-effectiveness matter

**Option 2: Dedicated Vector Database (Pinecone/Qdrant)**
- ✅ **Pros**: Optimized for vector operations, better performance at scale, advanced filtering
- ⚠️ **Cons**: Additional infrastructure cost, data synchronization complexity
- **Use Case**: When scaling to multiple institutions or processing millions of documents

**Implementation Workflow:**
```
1. Teacher uploads question → OCR recognition → Text extraction
2. Question text → OpenAI Embedding API → Vector generation
3. Vector + metadata → PostgreSQL/pgvector → Persistent storage
4. Student submits answer → Question matching → Similar content retrieval
5. Retrieved context + student answer → Enhanced AI grading
```

**Embedding Strategy:**
- **Questions**: Focus on mathematical concepts, keywords, difficulty markers
- **Textbook Content**: Chunk by logical sections (theorems, examples, exercises)
- **Hybrid Search**: Combine semantic similarity with keyword matching for precision

### File Storage Organization
```
supabase-storage/
├── assignments/          # Student homework submissions
├── questions/           # Teacher uploaded question images  
├── annotated/          # AI-processed files with grading
├── textbooks/          # Course material PDFs for RAG
└── embeddings/         # Vector representations (if stored)
```

## Recent Updates (Version 1.1.0)

**🔧 Bug Fixes & Improvements:**
1. **Homepage Search Enhancement** - Fixed display of AI search results from raw JSON to properly formatted markdown content with LaTeX support
2. **Practice Page Layout Fix** - Changed three operation buttons (difficulty, add to error book, delete) from vertical stacking to horizontal alignment for better UX
3. **Markdown Renderer Overhaul** - Replaced fragile regex-based SimpleMarkdownRenderer with industry-standard react-markdown + remark-math + rehype-katex stack

**📦 Dependencies Added:**
- `react-markdown@^9.1.0` - Standard markdown rendering
- `remark-math@^5.1.1` - Math syntax support in markdown
- `rehype-katex@^6.0.3` - LaTeX rendering via KaTeX
- `vfile@^5.3.7` - Version override to fix build compatibility issues

**💡 Technical Highlights:**
- Full LaTeX support for complex mathematical expressions (matrices, integrals, limits, piecewise functions)
- Improved CSS compatibility with both legacy and new markdown HTML structures
- Enhanced search experience with complete AI responses instead of fragmented suggestions
- Better responsive design for practice interface with horizontal button layout

## Key Constraints

- Uses pnpm workspace configuration with overrides for build compatibility
- Supabase for authentication and file storage
- MathPix API for mathematical OCR recognition (not MyScript)
- No test files should be committed - delete after testing
- Follow existing TypeScript and React patterns
- Maintain Prisma migration history
- Consider network connectivity issues for Supabase (timeout handling, retry mechanisms)
- LaTeX rendering requires compatible markdown packages (see dependencies above)