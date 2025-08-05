-- 清空数据库数据但保留Schema的脚本
-- ⚠️ 注意：此操作将删除所有数据，请谨慎使用！

-- ============================================
-- 1. 禁用外键约束检查（加速删除过程）
-- ============================================
SET session_replication_role = replica;

-- ============================================
-- 2. 按照正确的顺序删除数据（避免外键约束错误）
-- ============================================

-- 删除AI批改结果（最底层，依赖submissions）
DELETE FROM public.deepseek_results;
TRUNCATE TABLE public.deepseek_results RESTART IDENTITY CASCADE;

-- 删除OCR识别结果（依赖submissions）
DELETE FROM public.myscript_results;
TRUNCATE TABLE public.myscript_results RESTART IDENTITY CASCADE;

-- 删除提交记录（依赖users, file_uploads, assignments）
DELETE FROM public.submissions;
TRUNCATE TABLE public.submissions RESTART IDENTITY CASCADE;

-- 删除作业（依赖classrooms, users, file_uploads）
DELETE FROM public.assignments;
TRUNCATE TABLE public.assignments RESTART IDENTITY CASCADE;

-- 删除班级成员关系（依赖classrooms, users）
DELETE FROM public.classroom_members;
TRUNCATE TABLE public.classroom_members RESTART IDENTITY CASCADE;

-- 删除文件上传记录（依赖users）
DELETE FROM public.file_uploads;
TRUNCATE TABLE public.file_uploads RESTART IDENTITY CASCADE;

-- 删除班级（依赖users）
DELETE FROM public.classrooms;
TRUNCATE TABLE public.classrooms RESTART IDENTITY CASCADE;

-- 删除用户（最后删除，因为其他表都引用它）
DELETE FROM public.users;
TRUNCATE TABLE public.users RESTART IDENTITY CASCADE;

-- ============================================
-- 3. 重新启用外键约束检查
-- ============================================
SET session_replication_role = DEFAULT;

-- ============================================
-- 4. 重置所有序列（ID自增计数器）
-- ============================================
SELECT setval(pg_get_serial_sequence('public.users', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.classrooms', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.classroom_members', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.assignments', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.file_uploads', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.submissions', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.myscript_results', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.deepseek_results', 'id'), 1, false);

-- ============================================
-- 5. 验证数据清空结果
-- ============================================

-- 检查所有表的记录数量
SELECT 
    'users' as table_name, 
    COUNT(*) as record_count 
FROM public.users
UNION ALL
SELECT 
    'classrooms' as table_name, 
    COUNT(*) as record_count 
FROM public.classrooms
UNION ALL
SELECT 
    'classroom_members' as table_name, 
    COUNT(*) as record_count 
FROM public.classroom_members
UNION ALL
SELECT 
    'assignments' as table_name, 
    COUNT(*) as record_count 
FROM public.assignments
UNION ALL
SELECT 
    'file_uploads' as table_name, 
    COUNT(*) as record_count 
FROM public.file_uploads
UNION ALL
SELECT 
    'submissions' as table_name, 
    COUNT(*) as record_count 
FROM public.submissions
UNION ALL
SELECT 
    'myscript_results' as table_name, 
    COUNT(*) as record_count 
FROM public.myscript_results
UNION ALL
SELECT 
    'deepseek_results' as table_name, 
    COUNT(*) as record_count 
FROM public.deepseek_results
ORDER BY table_name;

-- ============================================
-- 6. 检查序列重置状态
-- ============================================

-- 使用 pg_sequences 系统视图查看序列状态
SELECT 
    schemaname,
    sequencename,
    start_value,
    min_value,
    max_value,
    increment_by,
    cycle,
    cache_size,
    last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- ============================================
-- 7. 验证表结构保留状态
-- ============================================

-- 简化的表结构验证查询
SELECT 
    t.table_name,
    COUNT(c.column_name) as column_count,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes i 
        WHERE i.tablename = t.table_name AND i.schemaname = 'public'
    ) THEN 'YES' ELSE 'NO' END as has_indexes,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc 
        WHERE tc.table_name = t.table_name AND tc.table_schema = 'public'
    ) THEN 'YES' ELSE 'NO' END as has_constraints
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name IN ('users', 'classrooms', 'classroom_members', 'assignments', 
                        'file_uploads', 'submissions', 'myscript_results', 'deepseek_results')
GROUP BY t.table_name
ORDER BY t.table_name;

-- 完成提示
SELECT 
    '✅ 数据清空完成！' as status,
    '所有表的数据已删除，但Schema结构保留完整' as description,
    '序列已重置，下次插入数据将从ID=1开始' as note;

-- ============================================
-- 使用说明：
-- ============================================
-- 1. 此脚本会删除所有业务数据
-- 2. 保留所有表结构、索引、约束
-- 3. 重置自增ID序列
-- 4. RLS策略已禁用（无RLS配置）
-- 5. 执行前请确保已备份重要数据！ 