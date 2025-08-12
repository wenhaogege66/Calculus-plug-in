import React, { useState } from 'react';
import type { AuthState } from '../common/config/supabase';

interface NavigationProps {
  authState: AuthState;
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  authState,
  currentPage,
  onPageChange,
  onLogout,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [notifications, setNotifications] = useState(1);

  // 根据用户角色显示不同的导航项
  const getNavItems = (): NavItem[] => {
    const isTeacher = authState.user?.role === 'TEACHER';
    
    if (isTeacher) {
      // 教师端导航项
      return [
        { id: 'home', label: '首页', icon: '🏠' },
        { id: 'assignments', label: '作业', icon: '📝' },
        { id: 'grading', label: '批改', icon: '✏️' },
        { id: 'classrooms', label: '班级管理', icon: '🏫' },
        { id: 'knowledge', label: '知识图谱', icon: '🧠' },
        { id: 'profile', label: '个人信息', icon: '👤' },
        { id: 'settings', label: '设置', icon: '⚙️' },
        { id: 'logout', label: '退出登录', icon: '🚪' }
      ];
    } else {
      // 学生端导航项
      return [
        { id: 'home', label: '首页', icon: '🏠' },
        { id: 'assignments', label: '作业', icon: '📝' },
        { id: 'classrooms', label: '班级', icon: '🏫' },
        { id: 'practice', label: '自主练习', icon: '💪' },
        { id: 'mistakes', label: '错题本', icon: '📚' },
        { id: 'knowledge', label: '知识图谱', icon: '🧠' },
        { id: 'profile', label: '个人信息', icon: '👤' },
        { id: 'settings', label: '设置', icon: '⚙️' },
        { id: 'logout', label: '退出登录', icon: '🚪' }
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className={`navigation ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Logo区域 */}
      <div className="nav-header">
        <div className="logo-container" onClick={() => onPageChange('home')}>
          <div className="logo-icon animated-logo">🔬</div>
          <div className="logo-text">
            <div className="logo-title">AI微积分助教</div>
            <div className="logo-subtitle">智能学习助手</div>
          </div>
        </div>
        
        {/* 夜间模式切换 */}
        <button 
          className="theme-toggle"
          onClick={onToggleDarkMode}
          title={isDarkMode ? '切换到日间模式' : '切换到夜间模式'}
        >
          <span className="theme-icon">{isDarkMode ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {/* 导航菜单 */}
      <nav className="nav-menu">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''} ${item.id === 'logout' ? 'logout' : ''}`}
            onClick={() => item.id === 'logout' ? onLogout() : onPageChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* 状态指示器 */}
      <div className="nav-status">
        <div className="status-indicator online">
          <span className="status-dot"></span>
          <span className="status-text">在线</span>
        </div>
      </div>
    </div>
  );
};