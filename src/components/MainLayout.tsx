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

import './Navigation.css';
import './MainLayout.css';
import './AssignmentsPage.css';
import './ClassroomsPage.css';
import './PracticePage.css';
import './MistakesPage.css';
import './Notification.css';

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
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageParams, setPageParams] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const storage = new Storage();
  const {
    notifications,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo
  } = useNotifications();

  // 初始化主题
  useEffect(() => {
    const initTheme = async () => {
      try {
        const savedTheme = await storage.get('darkMode');
        if (savedTheme !== undefined) {
          setIsDarkMode(savedTheme);
        }
      } catch (error) {
        console.error('读取主题设置失败:', error);
      }
    };
    
    initTheme();
  }, []);

  // 主题切换
  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      await storage.set('darkMode', newMode);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  };

  // 页面切换处理
  const handlePageChange = (page: string, params?: any) => {
    setCurrentPage(page);
    setPageParams(params);
    // 这里可以添加页面切换的逻辑，比如路由跳转或状态更新
  };

  // 根据当前页面渲染内容
  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
        return React.cloneElement(children as React.ReactElement, { 
          onPageChange: handlePageChange 
        }); // HomePage component
      case 'assignments':
        return <AssignmentsPage authState={authState} onPageChange={handlePageChange} params={pageParams} />;
      case 'grading':
        return (
          <div className="placeholder-page">
            <div className="placeholder-content">
              <div className="placeholder-icon">✏️</div>
              <h2>批改系统</h2>
              <p>查看和管理学生作业批改</p>
            </div>
          </div>
        );
      case 'practice':
        return <PracticePage authState={authState} />;
      case 'classrooms':
        return <ClassroomsPage authState={authState} onPageChange={handlePageChange} />;
      case 'mistakes':
        return <MistakesPage authState={authState} />;
      case 'knowledge':
      case 'knowledge-graph':
        return <KnowledgeGraph authState={authState} isDarkMode={isDarkMode} />;
      case 'profile':
        return (
          <div className="placeholder-page">
            <div className="placeholder-content">
              <div className="placeholder-icon">👤</div>
              <h2>个人信息</h2>
              <p>个人信息管理功能正在开发中...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="placeholder-page">
            <div className="placeholder-content">
              <div className="placeholder-icon">⚙️</div>
              <h2>系统设置</h2>
              <p>系统设置功能正在开发中...</p>
            </div>
          </div>
        );
      default:
        return children;
    }
  };

  return (
    <NotificationProvider value={{ showSuccess, showError, showWarning, showInfo }}>
      <div className={`main-layout ${isDarkMode ? 'dark' : 'light'}`}>
        <Navigation
          authState={authState}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onLogout={onLogout}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
        
        <main className="main-content">
          <div className="content-body">
            {renderPageContent()}
          </div>
        </main>
        
        {/* 通知容器 */}
        <NotificationContainer
          notifications={notifications}
          onRemove={removeNotification}
        />
      </div>
    </NotificationProvider>
  );
};

// 获取页面标题
function getPageTitle(page: string): string {
  const titles: Record<string, string> = {
    home: '欢迎来到AI微积分助教',
    assignments: '作业管理系统',
    grading: '作业批改系统',
    practice: '自主练习系统',
    classrooms: '班级管理系统',
    mistakes: '错题本管理',
    knowledge: '知识图谱',
    profile: '个人信息',
    settings: '系统设置'
  };
  
  return titles[page] || '首页';
}