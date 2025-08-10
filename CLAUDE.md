# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Every time you complete the modification of the code, you should determine whether the corresponding parts in Claude.md and Readme.md need to be modified

## Project Overview

AI微积分助教 (AI Calculus Assistant) - A Chrome extension built with Plasmo framework for intelligent calculus homework grading. The system provides OCR recognition using MyScript API and AI grading using Deepseek API, supporting both student practice mode and homework mode with teacher-student role management.

## Architecture

### Frontend (Chrome Extension)
- **Framework**: Plasmo + React 18 + TypeScript
- **Authentication**: GitHub OAuth via Supabase
- **State Management**: React Hooks + Chrome Storage API
- **Entry Points**: `popup.tsx` (main interface), `sidepanel.tsx` (detailed view), `background.ts` (service worker)

### Backend (API Server)
- **Framework**: Fastify + TypeScript
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Authentication**: Supabase built-in OAuth with GitHub Provider
- **File Storage**: Supabase Storage (S3-like) for assignments, questions, and graded files
- **AI Services**: MyScript (handwriting OCR) + Deepseek (scoring, future: grading/annotation)

### Database Schema (Prisma)
Key models: `User`, `FileUpload`, `Submission`, `MyScriptResult`, `DeepseekResult`, `Classroom`, `Assignment`
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
- `MYSCRIPT_APPLICATION_KEY` - MyScript app key
- `MYSCRIPT_HMAC_KEY` - MyScript HMAC key

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

### Core Components
- `src/popup.tsx` - Main popup interface with login and mode selection
- `src/components/AuthSection.tsx` - GitHub OAuth authentication
- `src/components/TeacherSection.tsx` - Teacher-specific functionality
- `backend/src/app.ts` - Fastify server setup
- `backend/src/routes/` - API route handlers
- `backend/src/middleware/auth.ts` - JWT authentication middleware

### API Endpoints
- `/api/auth/github` - GitHub OAuth flow
- `/api/files` - File upload (multipart)
- `/api/submissions` - Submission management
- `/api/ocr/myscript` - OCR processing
- `/api/ai/deepseek/grade` - AI grading
- `/api/assignments` - Assignment management (teachers)
- `/api/classrooms` - Classroom management

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
**MyScript OCR:**
- Teachers: Upload and recognize handwritten questions from images → Build structured question bank
- Students: Convert handwritten homework solutions to text for AI processing
- Future: Question-answer matching and automated assignment detection

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
The system supports two modes:
- **Practice Mode** (`workMode: "practice"`) - Student uploads complete problems with solutions
- **Homework Mode** (`workMode: "homework"`) - Student uploads solutions, matched against assignment questions

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

## Key Constraints

- Uses pnpm workspace configuration
- Supabase for authentication and file storage
- MyScript API for handwriting OCR recognition
- No test files should be committed - delete after testing
- Follow existing TypeScript and React patterns
- Maintain Prisma migration history
- Consider network connectivity issues for Supabase (timeout handling, retry mechanisms)