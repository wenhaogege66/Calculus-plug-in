-- Supabase Row Level Security (RLS) 策略设置

-- 启用所有表的RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myscript_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deepseek_results ENABLE ROW LEVEL SECURITY;

-- 为Prisma migrations表启用RLS (解决警告)
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

-- Prisma migrations表策略 - 允许系统级操作
CREATE POLICY "允许系统管理Prisma迁移" ON public._prisma_migrations
    FOR ALL USING (true) WITH CHECK (true);

-- 用户表策略：用户只能查看和更新自己的记录
CREATE POLICY "用户只能查看自己的记录" ON public.users
    FOR SELECT USING (auth.uid()::text = github_id OR auth.email() = email);

CREATE POLICY "用户可以更新自己的记录" ON public.users
    FOR UPDATE USING (auth.uid()::text = github_id OR auth.email() = email);

-- 文件上传表策略：用户只能访问自己上传的文件
CREATE POLICY "用户只能查看自己的文件" ON public.file_uploads
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.users 
            WHERE auth.uid()::text = github_id OR auth.email() = email
        )
    );

CREATE POLICY "用户可以上传文件" ON public.file_uploads
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM public.users 
            WHERE auth.uid()::text = github_id OR auth.email() = email
        )
    );

CREATE POLICY "用户可以删除自己的文件" ON public.file_uploads
    FOR DELETE USING (
        user_id IN (
            SELECT id FROM public.users 
            WHERE auth.uid()::text = github_id OR auth.email() = email
        )
    );

-- 提交记录表策略：用户只能访问自己的提交
CREATE POLICY "用户只能查看自己的提交" ON public.submissions
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.users 
            WHERE auth.uid()::text = github_id OR auth.email() = email
        )
    );

CREATE POLICY "用户可以创建提交" ON public.submissions
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM public.users 
            WHERE auth.uid()::text = github_id OR auth.email() = email
        )
    );

-- OCR结果表策略：通过提交记录关联用户
CREATE POLICY "用户只能查看自己提交的OCR结果" ON public.myscript_results
    FOR SELECT USING (
        submission_id IN (
            SELECT s.id FROM public.submissions s
            JOIN public.users u ON s.user_id = u.id
            WHERE auth.uid()::text = u.github_id OR auth.email() = u.email
        )
    );

CREATE POLICY "系统可以创建OCR结果" ON public.myscript_results
    FOR INSERT WITH CHECK (true);

-- AI批改结果表策略：通过提交记录关联用户
CREATE POLICY "用户只能查看自己提交的AI批改结果" ON public.deepseek_results
    FOR SELECT USING (
        submission_id IN (
            SELECT s.id FROM public.submissions s
            JOIN public.users u ON s.user_id = u.id
            WHERE auth.uid()::text = u.github_id OR auth.email() = u.email
        )
    );

CREATE POLICY "系统可以创建AI批改结果" ON public.deepseek_results
    FOR INSERT WITH CHECK (true);

-- 教师角色策略：教师可以查看所有记录
CREATE POLICY "教师可以查看所有用户" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE (auth.uid()::text = github_id OR auth.email() = email)
            AND role = 'teacher'
        )
    );

CREATE POLICY "教师可以查看所有文件" ON public.file_uploads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE (auth.uid()::text = github_id OR auth.email() = email)
            AND role = 'teacher'
        )
    );

CREATE POLICY "教师可以查看所有提交" ON public.submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE (auth.uid()::text = github_id OR auth.email() = email)
            AND role = 'teacher'
        )
    );

-- Storage策略：用户只能访问自己文件夹中的文件
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignments', 'assignments', false),
       ('avatars', 'avatars', true),
       ('annotated', 'annotated', false)
ON CONFLICT (id) DO NOTHING;

-- 文件存储策略
CREATE POLICY "用户可以上传到自己的文件夹" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'assignments' AND
        (storage.foldername(name))[1] IN (
            SELECT u.id::text FROM public.users u
            WHERE auth.uid()::text = u.github_id OR auth.email() = u.email
        )
    );

CREATE POLICY "用户可以查看自己的文件" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'assignments' AND
        (storage.foldername(name))[1] IN (
            SELECT u.id::text FROM public.users u
            WHERE auth.uid()::text = u.github_id OR auth.email() = u.email
        )
    );

CREATE POLICY "用户可以删除自己的文件" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'assignments' AND
        (storage.foldername(name))[1] IN (
            SELECT u.id::text FROM public.users u
            WHERE auth.uid()::text = u.github_id OR auth.email() = u.email
        )
    );

-- 头像文件策略（公开读取）
CREATE POLICY "所有人可以查看头像" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "用户可以上传自己的头像" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] IN (
            SELECT u.id::text FROM public.users u
            WHERE auth.uid()::text = u.github_id OR auth.email() = u.email
        )
    ); 