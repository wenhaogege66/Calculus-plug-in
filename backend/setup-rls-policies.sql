-- RLS安全策略设置脚本
-- 解决 "RLS Disabled in Public" 警告

-- ============================================
-- 1. 启用所有表的行级安全（RLS）
-- ============================================

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myscript_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deepseek_results ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. 用户表（users）策略
-- ============================================

-- 用户可以查看自己的信息
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = github_id);

-- 用户可以更新自己的信息
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid()::text = github_id);

-- 允许插入新用户（注册时需要）
CREATE POLICY "Allow user registration" ON public.users
    FOR INSERT WITH CHECK (true);

-- ============================================
-- 3. 班级表（classrooms）策略
-- ============================================

-- 教师可以查看和管理自己创建的班级
CREATE POLICY "Teachers can view own classrooms" ON public.classrooms
    FOR SELECT USING (
        teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) OR
        id IN (
            SELECT classroom_id FROM public.classroom_members 
            WHERE student_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) AND is_active = true
        )
    );

-- 教师可以创建班级
CREATE POLICY "Teachers can create classrooms" ON public.classrooms
    FOR INSERT WITH CHECK (
        teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) AND
        EXISTS (SELECT 1 FROM public.users WHERE github_id = auth.uid()::text AND role = 'teacher')
    );

-- 教师可以更新自己的班级
CREATE POLICY "Teachers can update own classrooms" ON public.classrooms
    FOR UPDATE USING (teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- 教师可以删除自己的班级
CREATE POLICY "Teachers can delete own classrooms" ON public.classrooms
    FOR DELETE USING (teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- ============================================
-- 4. 班级成员表（classroom_members）策略
-- ============================================

-- 班级成员可以查看自己所在的班级成员信息
CREATE POLICY "Members can view classroom members" ON public.classroom_members
    FOR SELECT USING (
        student_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) OR
        classroom_id IN (
            SELECT id FROM public.classrooms WHERE teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        )
    );

-- 学生可以加入班级
CREATE POLICY "Students can join classrooms" ON public.classroom_members
    FOR INSERT WITH CHECK (student_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- 教师可以管理班级成员
CREATE POLICY "Teachers can manage classroom members" ON public.classroom_members
    FOR ALL USING (
        classroom_id IN (
            SELECT id FROM public.classrooms WHERE teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        )
    );

-- 学生可以退出班级
CREATE POLICY "Students can leave classrooms" ON public.classroom_members
    FOR UPDATE USING (student_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- ============================================
-- 5. 作业表（assignments）策略
-- ============================================

-- 师生可以查看相关作业
CREATE POLICY "Users can view relevant assignments" ON public.assignments
    FOR SELECT USING (
        -- 教师可以查看自己布置的作业
        teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) OR
        -- 学生可以查看所在班级的作业
        classroom_id IN (
            SELECT classroom_id FROM public.classroom_members 
            WHERE student_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) AND is_active = true
        )
    );

-- 教师可以创建作业
CREATE POLICY "Teachers can create assignments" ON public.assignments
    FOR INSERT WITH CHECK (
        teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) AND
        classroom_id IN (
            SELECT id FROM public.classrooms WHERE teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        )
    );

-- 教师可以更新自己的作业
CREATE POLICY "Teachers can update own assignments" ON public.assignments
    FOR UPDATE USING (teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- 教师可以删除自己的作业
CREATE POLICY "Teachers can delete own assignments" ON public.assignments
    FOR DELETE USING (teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- ============================================
-- 6. 文件上传表（file_uploads）策略
-- ============================================

-- 用户可以查看自己上传的文件
CREATE POLICY "Users can view own files" ON public.file_uploads
    FOR SELECT USING (
        user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) OR
        -- 学生可以查看作业题目文件
        id IN (
            SELECT file_upload_id FROM public.assignments a
            JOIN public.classroom_members cm ON a.classroom_id = cm.classroom_id
            WHERE cm.student_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) AND cm.is_active = true
            AND a.file_upload_id IS NOT NULL
        )
    );

-- 用户可以上传文件
CREATE POLICY "Users can upload files" ON public.file_uploads
    FOR INSERT WITH CHECK (user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- 用户可以更新自己的文件
CREATE POLICY "Users can update own files" ON public.file_uploads
    FOR UPDATE USING (user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- 用户可以删除自己的文件
CREATE POLICY "Users can delete own files" ON public.file_uploads
    FOR DELETE USING (user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- ============================================
-- 7. 提交表（submissions）策略
-- ============================================

-- 用户可以查看自己的提交，教师可以查看学生的提交
CREATE POLICY "Users can view relevant submissions" ON public.submissions
    FOR SELECT USING (
        user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text) OR
        -- 教师可以查看学生的作业提交
        (assignment_id IS NOT NULL AND assignment_id IN (
            SELECT id FROM public.assignments WHERE teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        ))
    );

-- 用户可以创建提交
CREATE POLICY "Users can create submissions" ON public.submissions
    FOR INSERT WITH CHECK (user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- 用户可以更新自己的提交
CREATE POLICY "Users can update own submissions" ON public.submissions
    FOR UPDATE USING (user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text));

-- ============================================
-- 8. MyScript结果表（myscript_results）策略
-- ============================================

-- 用户可以查看相关的OCR结果
CREATE POLICY "Users can view relevant myscript results" ON public.myscript_results
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM public.submissions WHERE user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        ) OR
        -- 教师可以查看学生作业的OCR结果
        submission_id IN (
            SELECT s.id FROM public.submissions s
            JOIN public.assignments a ON s.assignment_id = a.id
            WHERE a.teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        )
    );

-- 系统可以插入OCR结果（通过service key）
CREATE POLICY "Allow OCR result insertion" ON public.myscript_results
    FOR INSERT WITH CHECK (true);

-- ============================================
-- 9. Deepseek结果表（deepseek_results）策略
-- ============================================

-- 用户可以查看相关的AI批改结果
CREATE POLICY "Users can view relevant deepseek results" ON public.deepseek_results
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM public.submissions WHERE user_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        ) OR
        -- 教师可以查看学生作业的批改结果
        submission_id IN (
            SELECT s.id FROM public.submissions s
            JOIN public.assignments a ON s.assignment_id = a.id
            WHERE a.teacher_id = (SELECT id FROM public.users WHERE github_id = auth.uid()::text)
        )
    );

-- 系统可以插入AI批改结果（通过service key）
CREATE POLICY "Allow AI result insertion" ON public.deepseek_results
    FOR INSERT WITH CHECK (true);

-- ============================================
-- 10. 验证策略是否正确应用
-- ============================================

-- 查看所有表的RLS状态
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'classrooms', 'assignments', 'classroom_members', 
                      'file_uploads', 'submissions', 'myscript_results', 'deepseek_results')
ORDER BY tablename;

-- 查看所有策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    LEFT(qual, 50) as condition_preview
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 完成提示
SELECT '✅ RLS策略设置完成！所有表都已启用行级安全。' as status; 