import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';

// 图标组件
const Icons = {
    School: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 8-4 8 4" /><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" /><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" /><path d="M18 5v17" /><path d="M6 5v17" /></svg>,
    Users: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    Book: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>,
    Copy: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>,
    Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>,
    Link: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>,
    Close: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
};

interface Classroom {
    id: number;
    name: string;
    description?: string;
    inviteCode?: string;
    memberCount?: number;
    assignmentCount?: number;
    createdAt: string;
    teacher?: {
        id: number;
        username: string;
    };
}

interface ClassroomsPageProps {
    authState: AuthState;
    onPageChange?: (page: string, params?: any) => void;
}

export const ClassroomsPage: React.FC<ClassroomsPageProps> = ({ authState, onPageChange }) => {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '', inviteCode: '' });
    const [submitting, setSubmitting] = useState(false);

    const isTeacher = authState.user?.role === 'TEACHER';

    useEffect(() => {
        loadClassrooms();
    }, []);

    const loadClassrooms = async () => {
        if (!authState.token) return;
        try {
            setLoading(true);
            setError('');
            const endpoint = isTeacher ? '/classrooms/teacher' : '/classrooms/student';

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                // 确保 data.data 是数组
                setClassrooms(Array.isArray(data.data) ? data.data : []);
            } else {
                // 即使后端报错，也显示空状态而不是崩溃
                console.warn('API Error:', response.status);
                if (response.status === 500) {
                    setError('服务器暂时无法处理请求，请稍后重试');
                } else {
                    setError('无法加载班级列表');
                }
                // 使用空数组作为兜底
                setClassrooms([]);
            }
        } catch (err) {
            console.error('Network Error:', err);
            setError('网络连接出现问题');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authState.token) return;
        setSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/classrooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authState.token}`
                },
                body: JSON.stringify({ name: formData.name, description: formData.description })
            });
            if (response.ok) {
                setShowCreateModal(false);
                setFormData({ name: '', description: '', inviteCode: '' });
                loadClassrooms();
            }
        } catch (err) {
            // 简单处理
        } finally {
            setSubmitting(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authState.token) return;
        setSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/classrooms/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authState.token}`
                },
                body: JSON.stringify({ inviteCode: formData.inviteCode })
            });
            if (response.ok) {
                setShowJoinModal(false);
                setFormData({ name: '', description: '', inviteCode: '' });
                loadClassrooms();
            }
        } catch (err) {
            // 简单处理
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC]">
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

                {/* Header */}
                <header className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <span className="text-primary-600"><Icons.School /></span>
                            {isTeacher ? '班级管理' : '我的班级'}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {isTeacher ? '创建并管理您的教学班级' : '查看您加入的班级信息'}
                        </p>
                    </div>
                    <button
                        onClick={() => isTeacher ? setShowCreateModal(true) : setShowJoinModal(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        {isTeacher ? <><Icons.Plus /> 创建班级</> : <><Icons.Link /> 加入班级</>}
                    </button>
                </header>

                {/* Error Banner */}
                {error && (
                    <div className="mx-8 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <Icons.Alert />
                        <span>{error}</span>
                        <button onClick={loadClassrooms} className="ml-auto text-sm underline hover:text-red-800">重试</button>
                    </div>
                )}

                {/* Content Grid */}
                <div className="p-8">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse"></div>
                            ))}
                        </div>
                    ) : classrooms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <span className="text-slate-400"><Icons.School /></span>
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">暂无班级</h3>
                            <p className="text-slate-500 text-sm mt-1 mb-6">
                                {isTeacher ? '您还没有创建任何班级' : '您还没有加入任何班级'}
                            </p>
                            <button
                                onClick={() => isTeacher ? setShowCreateModal(true) : setShowJoinModal(true)}
                                className="text-primary-600 font-medium hover:underline"
                            >
                                {isTeacher ? '立即创建' : '立即加入'}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {classrooms.map(classroom => (
                                <div key={classroom.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-primary-200 transition-all group relative overflow-hidden">
                                    {/* Decorator */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-50 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-50"></div>

                                    <div className="relative z-10">
                                        <h3 className="text-lg font-bold text-slate-800 mb-2 truncate pr-4">{classroom.name}</h3>
                                        <p className="text-sm text-slate-500 mb-6 line-clamp-2 h-10">
                                            {classroom.description || '暂无描述'}
                                        </p>

                                        {/* Invite Code (Teacher Only) */}
                                        {isTeacher && classroom.inviteCode && (
                                            <div className="mb-6 bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">邀请码</span>
                                                    <span className="font-mono font-bold text-slate-700 tracking-wider">{classroom.inviteCode}</span>
                                                </div>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(classroom.inviteCode!)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-white rounded-md transition-colors"
                                                    title="复制"
                                                >
                                                    <Icons.Copy />
                                                </button>
                                            </div>
                                        )}

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                <Icons.Users />
                                                <span>{classroom.memberCount || 0} 学生</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                <Icons.Book />
                                                <span>{classroom.assignmentCount || 0} 作业</span>
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div className="mt-4 pt-2">
                                            <button
                                                onClick={() => onPageChange?.('assignments', { classroomId: classroom.id })}
                                                className="w-full py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-primary-600 hover:text-primary-600 transition-colors"
                                            >
                                                进入班级
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals - 使用 Tailwind 重写 */}
            {(showCreateModal || showJoinModal) && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 transform transition-all scale-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">
                                {showCreateModal ? '创建新班级' : '加入班级'}
                            </h2>
                            <button
                                onClick={() => { setShowCreateModal(false); setShowJoinModal(false); }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <Icons.Close />
                            </button>
                        </div>

                        <form onSubmit={showCreateModal ? handleCreate : handleJoin}>
                            {showCreateModal ? (
                                <>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">班级名称</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                            placeholder="例如：高等数学 2024春"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">描述（可选）</label>
                                        <textarea
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all h-24 resize-none"
                                            placeholder="关于这个班级的简介..."
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">班级邀请码</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={8}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono tracking-widest text-center text-lg uppercase"
                                        placeholder="XXXXXXXX"
                                        value={formData.inviteCode}
                                        onChange={e => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                                    />
                                    <p className="text-xs text-slate-500 mt-2 text-center">请输入老师分享的8位邀请码</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreateModal(false); setShowJoinModal(false); }}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? '处理中...' : '确认'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};