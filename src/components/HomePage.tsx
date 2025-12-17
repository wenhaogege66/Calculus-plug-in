import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';

// 图标组件
const Icons = {
    Users: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    School: () => <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 8-4 8 4" /><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" /><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" /><path d="M18 5v17" /><path d="M6 5v17" /></svg>,
    Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>,
    Network: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" /><path d="M12 12V8" /></svg>,
    Sigma: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z" /><path d="M12 13v8" /><path d="M12 3v3" /></svg>,
    Function: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3" /><path d="M9 11.2h5.7" /></svg>,
    Trending: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
    Chart: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 12v5" /><path d="M12 8v9" /><path d="M17 5v12" /></svg>,
    Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    Coffee: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" x2="6" y1="2" y2="4" /><line x1="10" x2="10" y1="2" y2="4" /><line x1="14" x2="14" y1="2" y2="4" /></svg>
};

interface HomePageProps {
    authState: AuthState;
    isDarkMode: boolean;
    onPageChange?: (page: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ authState, onPageChange }) => {
    const [stats, setStats] = useState({
        joinedClasses: 0,
        pendingAssignments: 0,
        masteryLevel: '未评估'
    });

    const isTeacher = authState.user?.role === 'TEACHER';

    // 模拟数据加载 (真实场景替换为 fetch)
    useEffect(() => {
        // 简单模拟加载延迟
        const timer = setTimeout(() => {
            setStats({
                joinedClasses: 0,
                pendingAssignments: 0,
                masteryLevel: '入门'
            });
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="w-full h-full overflow-y-auto p-8 fade-in">

            {/* 欢迎 Banner (匹配 demo.html) */}
            <div className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl p-8 mb-8 flex flex-col justify-center shadow-lg shadow-indigo-200 relative overflow-hidden h-40">
                {/* 装饰背景球 */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 opacity-20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>

                <div className="relative z-10 text-white">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        {getGreeting()}，{authState.user?.username || '同学'} 👋
                    </h1>
                    <p className="text-indigo-100 text-sm flex items-center gap-2">
                        <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm">
                            {isTeacher ? '教师' : '学生'}
                        </span>
                        {isTeacher ? '管理您的教学任务' : '继续您的微积分学习之旅'}
                    </p>
                </div>
            </div>

            {/* 三栏布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px]">

                {/* 卡片 1: 班级概览 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-full group hover:border-primary-200 transition-colors">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-indigo-500"><Icons.Users /></span>
                            {isTeacher ? '管理班级' : '我的班级'}
                        </h3>
                        <button
                            onClick={() => onPageChange?.('classrooms')}
                            className="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded-md font-medium hover:bg-slate-100 transition-colors"
                        >
                            管理
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 relative">
                            <div className="absolute inset-0 bg-indigo-50 rounded-full animate-pulse opacity-50"></div>
                            <span className="text-slate-400"><Icons.School /></span>
                        </div>

                        {stats.joinedClasses === 0 ? (
                            <>
                                <h4 className="text-lg font-bold text-slate-700 mb-2">
                                    {isTeacher ? '尚未创建班级' : '尚未加入班级'}
                                </h4>
                                <p className="text-slate-400 text-sm mb-8 px-4">
                                    {isTeacher ? '创建班级开始教学' : '请联系教师获取邀请码'}
                                </p>
                                <button
                                    onClick={() => onPageChange?.('classrooms')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <Icons.Plus /> {isTeacher ? '创建班级' : '加入班级'}
                                </button>
                            </>
                        ) : (
                            // 如果有班级，显示统计 (这里仅为展示逻辑占位)
                            <div className="text-center">
                                <h4 className="text-3xl font-bold text-slate-800 mb-2">{stats.joinedClasses}</h4>
                                <p className="text-slate-500 text-sm">个活跃班级</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 卡片 2: 知识图谱 (可视化 Widget) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-full relative overflow-hidden group hover:border-primary-200 transition-colors">
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-emerald-500"><Icons.Network /></span>
                            知识图谱
                        </h3>
                        <button
                            onClick={() => onPageChange?.('knowledge')}
                            className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-medium hover:bg-emerald-100"
                        >
                            查看全图
                        </button>
                    </div>

                    {/* 模拟的知识图谱可视化 */}
                    <div className="flex-1 relative w-full h-full bg-slate-50/50 rounded-xl border border-slate-100 cursor-pointer" onClick={() => onPageChange?.('knowledge')}>
                        {/* SVG 连线 */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                            <line x1="50%" y1="50%" x2="20%" y2="30%" stroke="#E2E8F0" strokeWidth="2" />
                            <line x1="50%" y1="50%" x2="80%" y2="30%" stroke="#E2E8F0" strokeWidth="2" />
                            <line x1="50%" y1="50%" x2="50%" y2="80%" stroke="#E2E8F0" strokeWidth="2" />
                        </svg>

                        {/* 核心节点 */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 text-center">
                            <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 text-white node-pulse hover:scale-110 transition-transform">
                                <Icons.Sigma />
                            </div>
                            <span className="text-xs font-bold text-slate-700 mt-2 block">微积分</span>
                        </div>

                        {/* 子节点 1 */}
                        <div className="absolute top-[25%] left-[15%] transform -translate-x-1/2 -translate-y-1/2 z-10 text-center group/node">
                            <div className="w-10 h-10 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover/node:border-emerald-400 group-hover/node:text-emerald-500 transition-colors">
                                <Icons.Function />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block group-hover/node:text-emerald-600">极限</span>
                        </div>

                        {/* 子节点 2 */}
                        <div className="absolute top-[25%] right-[15%] transform translate-x-1/2 -translate-y-1/2 z-10 text-center group/node">
                            <div className="w-10 h-10 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover/node:border-emerald-400 group-hover/node:text-emerald-500 transition-colors">
                                <Icons.Trending />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block group-hover/node:text-emerald-600">导数</span>
                        </div>

                        {/* 子节点 3 */}
                        <div className="absolute bottom-[15%] left-1/2 transform -translate-x-1/2 translate-y-1/2 z-10 text-center group/node">
                            <div className="w-10 h-10 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover/node:border-emerald-400 group-hover/node:text-emerald-500 transition-colors">
                                <Icons.Chart />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block group-hover/node:text-emerald-600">积分</span>
                        </div>

                        <div className="absolute bottom-4 left-4 text-xs text-slate-400">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 核心
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span> 未解锁
                            </div>
                        </div>
                    </div>
                </div>

                {/* 卡片 3: 作业状态 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-full group hover:border-primary-200 transition-colors">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-rose-500"><Icons.Clock /></span>
                            {isTeacher ? '待办事项' : `剩余作业: ${stats.pendingAssignments} 份`}
                        </h3>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 rotate-3 group-hover:rotate-6 transition-transform">
                            <span className="text-rose-300"><Icons.Coffee /></span>
                        </div>

                        {stats.pendingAssignments === 0 ? (
                            <>
                                <h4 className="text-slate-600 font-medium mb-1">暂无待办</h4>
                                <p className="text-slate-400 text-xs">
                                    {isTeacher ? '所有作业已批改完毕' : '老师还没有布置新作业'}
                                </p>
                            </>
                        ) : (
                            <>
                                <h4 className="text-slate-600 font-medium mb-1">有作业待处理</h4>
                                <p className="text-slate-400 text-xs">请前往作业管理页面查看</p>
                            </>
                        )}

                        <button
                            onClick={() => onPageChange?.('assignments')}
                            className="mt-6 text-xs text-rose-500 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                            查看详情
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
}