import React, { useState, useEffect } from 'react';
import { Navigation } from './Navigation';
import { AssignmentsPage } from './AssignmentsPage';
import { ClassroomsPage } from './ClassroomsPage';
import { PracticePage } from './PracticePage';
import { MistakesPage } from './MistakesPage';
import { KnowledgeGraph } from './KnowledgeGraph';
import { NotificationContainer, useNotifications } from './Notification';
import { NotificationProvider } from '../contexts/NotificationContext';
import { Storage } from '@plasmohq/storage';
import type { AuthState } from '../common/config/supabase';


interface MainLayoutProps {
    children: React.ReactNode;
    authState: AuthState;
    onLogout: () => void;
    initialPage?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    authState,
    onLogout,
    initialPage = 'home'
}) => {
    // 辅助函数：确保 initialPage 有效，处理旧链接映射
    const normalizePage = (page: string) => {
        if (page === 'homework') return 'assignments';
        if (!page) return 'home';
        return page;
    };

    const [currentPage, setCurrentPage] = useState(normalizePage(initialPage));
    const [pageParams, setPageParams] = useState<any>(null);

    // 这里的 isDarkMode 仅用于控制 UI 主题类名
    const [isDarkMode, setIsDarkMode] = useState(false);

    // 监听 initialPage 变化 (例如 hash 改变)，并应用映射
    useEffect(() => {
        setCurrentPage(normalizePage(initialPage));
    }, [initialPage]);

    const {
        notifications,
        removeNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo
    } = useNotifications();

    // 页面切换处理
    const handlePageChange = (page: string, params?: any) => {
        setCurrentPage(page);
        setPageParams(params);
    };

    const renderPageContent = () => {
        switch (currentPage) {
            case 'home':
                // 只有在渲染 Dashboard (HomePage) 时才显示传入的 children
                return React.cloneElement(children as React.ReactElement, {
                    onPageChange: handlePageChange
                });
            case 'assignments':
                return <AssignmentsPage authState={authState} onPageChange={handlePageChange} params={pageParams} />;
            case 'grading':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">✏️</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-700">批改系统</h2>
                        <p className="mt-2">功能整合中，请从作业列表进入详情</p>
                        <button
                            onClick={() => handlePageChange('assignments')}
                            className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            返回作业列表
                        </button>
                    </div>
                );
            case 'practice':
                return <PracticePage authState={authState} onPageChange={handlePageChange} params={pageParams} />;
            case 'classrooms':
                return <ClassroomsPage authState={authState} onPageChange={handlePageChange} />;
            case 'mistakes':
                return <MistakesPage authState={authState} onPageChange={handlePageChange} />;
            case 'knowledge':
                return <KnowledgeGraph authState={authState} isDarkMode={isDarkMode} />;
            case 'settings':
            case 'profile':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">⚙️</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-700">设置页面</h2>
                        <p className="mt-2">系统设置与个人信息功能正在开发中...</p>
                    </div>
                );
            default:
                // 兜底显示 Home，防止路由不匹配导致空白
                return React.cloneElement(children as React.ReactElement, {
                    onPageChange: handlePageChange
                });
        }
    };

    return (
        <NotificationProvider value={{ showSuccess, showError, showWarning, showInfo }}>
            <div className={`flex h-screen bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans ${isDarkMode ? 'dark' : ''}`}>

                {/* 左侧固定侧边栏 */}
                <Navigation
                    authState={authState}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    onLogout={onLogout}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                />

                {/* 右侧主内容区域 */}
                <main className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-y-auto relative w-full h-full">
                        <div className="w-full h-full fade-in">
                            {renderPageContent()}
                        </div>
                    </div>
                </main>

                {/* 全局通知容器 */}
                <NotificationContainer
                    notifications={notifications}
                    onRemove={removeNotification}
                />
            </div>
        </NotificationProvider>
    );
};