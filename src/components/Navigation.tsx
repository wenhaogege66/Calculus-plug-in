import React from 'react';
import type { AuthState } from '../common/config/supabase';

interface NavigationProps {
    authState: AuthState;
    currentPage: string;
    onPageChange: (page: string) => void;
    onLogout: () => void;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
}

// 简单的 SVG 图标组件，保持轻量
const Icons = {
    Logo: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z" /><path d="M12 13v8" /><path d="M12 3v3" /></svg>
    ),
    Dashboard: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
    ),
    Assignments: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="M12 10v4" /><path d="M12 14h4" /></svg>
    ),
    Mistakes: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="2" /><path d="M12 12v6" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
    ),
    Practice: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="m2 2 7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
    ),
    Settings: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
    ),
    Logout: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
    )
};

export const Navigation: React.FC<NavigationProps> = ({
    authState,
    currentPage,
    onPageChange,
    onLogout
}) => {
    const isTeacher = authState.user?.role === 'TEACHER';

    // 导航项配置
    const navItems = [
        {
            id: 'home',
            label: '班级管理',
            icon: <Icons.Dashboard />,
            activeIds: ['home', 'classrooms', 'knowledge'] // 这些ID都高亮此项
        },
        {
            id: 'assignments',
            label: '课程作业管理',
            icon: <Icons.Assignments />,
            activeIds: ['assignments', 'grading']
        },
        {
            id: 'mistakes',
            label: '错题归档',
            icon: <Icons.Mistakes />,
            activeIds: ['mistakes']
        },
        {
            id: 'practice',
            label: '习题练习',
            icon: <Icons.Practice />,
            activeIds: ['practice']
        }
    ];

    return (
        <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col z-20 flex-shrink-0 h-full">
            {/* Header Logo */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100 cursor-pointer" onClick={() => onPageChange('home')}>
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20 mr-3">
                    <span className="text-white font-bold text-lg">∑</span>
                </div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">AI 微积分助教</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                {navItems.map((item) => {
                    const isActive = item.activeIds.includes(currentPage);
                    return (
                        <button
                            key={item.id}
                            onClick={() => onPageChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className={`transition-colors ${isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* User Profile Footer */}
            <div className="p-4 border-t border-slate-100">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group relative">
                    <div className="relative">
                        {authState.user?.avatarUrl ? (
                            <img
                                src={authState.user.avatarUrl}
                                alt="User"
                                className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 group-hover:border-primary-200 transition-colors object-cover"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                                {authState.user?.username?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                            {authState.user?.username || '用户'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                            {isTeacher ? '教师账号' : '学生账号'}
                        </p>
                    </div>

                    <div className="flex gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onPageChange('settings'); }}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="设置"
                        >
                            <Icons.Settings />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onLogout(); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="退出"
                        >
                            <Icons.Logout />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};