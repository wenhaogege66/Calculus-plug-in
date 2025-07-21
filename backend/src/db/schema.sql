-- AI微积分助教数据库表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
    profile JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 文件上传表
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    upload_type VARCHAR(50) DEFAULT 'manual',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 作业提交表
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    file_upload_id INTEGER REFERENCES file_uploads(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- MyScript OCR结果表
CREATE TABLE IF NOT EXISTS myscript_results (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
    recognized_text TEXT,
    confidence_score DECIMAL(5,4),
    processing_time INTEGER, -- 毫秒
    raw_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deepseek AI批改结果表
CREATE TABLE IF NOT EXISTS deepseek_results (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    max_score INTEGER DEFAULT 100,
    feedback TEXT,
    errors JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',
    strengths JSONB DEFAULT '[]',
    processing_time INTEGER, -- 毫秒
    raw_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 历史记录视图（便于查询）
CREATE OR REPLACE VIEW submission_history AS
SELECT 
    s.id as submission_id,
    s.user_id,
    s.status,
    s.submitted_at,
    s.completed_at,
    f.original_name as file_name,
    f.file_size,
    f.mime_type,
    m.recognized_text,
    m.confidence_score,
    d.score,
    d.feedback,
    d.errors,
    d.suggestions,
    d.strengths
FROM submissions s
LEFT JOIN file_uploads f ON s.file_upload_id = f.id
LEFT JOIN myscript_results m ON s.id = m.submission_id
LEFT JOIN deepseek_results d ON s.id = d.submission_id
ORDER BY s.submitted_at DESC;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_myscript_results_submission_id ON myscript_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_deepseek_results_submission_id ON deepseek_results(submission_id);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 