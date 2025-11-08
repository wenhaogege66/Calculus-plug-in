import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MainLayout } from '../components/MainLayout';
import { HomePage } from '../components/HomePage';
import { AuthSection } from '../components/AuthSection';

import '../popup.css';
import '../components/MainLayout.css';

const storage = new Storage();

function FullApp() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true
  });

  const [uploadStatus, setUploadStatus] = useState({
    uploading: false,
    progress: 0,
    message: ''
  });

  // 添加主题状态管理
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 初始化主题
  useEffect(() => {
    const initTheme = async () => {
      try {
        const savedTheme = await storage.get('darkMode');
        if (savedTheme !== undefined) {
          setIsDarkMode(savedTheme);
        }
      } catch (error) {
      }
    };
    
    initTheme();
  }, []);

  // 获取URL hash来确定初始页面
  const [initialPage, setInitialPage] = useState('home');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setInitialPage(hash);
    }
    
    initializeAuth();
    
    // 监听认证状态变化
    const handleStorageChange = async (changes: any, area: string) => {
      if (area === 'local' && (changes.auth_token || changes.user_info)) {
        await initializeAuth();
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // 监听来自popup的消息
    const handleMessage = async (message: any) => {
      if (message.type === 'AUTH_SUCCESS') {
        await initializeAuth();
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // 初始化认证状态
  const initializeAuth = async () => {
    try {
      
      // 尝试从Plasmo Storage获取
      let savedToken = await storage.get('auth_token');
      let savedUser = await storage.get('user_info');
      
      
      // 如果Plasmo Storage没有数据，尝试Chrome Storage
      if (!savedToken || !savedUser) {
        const chromeData = await chrome.storage.local.get(['auth_token', 'user_info']);
        savedToken = savedToken || chromeData.auth_token;
        savedUser = savedUser || chromeData.user_info;
        
        // 如果Chrome Storage有数据，同步到Plasmo Storage
        if (savedToken && savedUser) {
          await storage.set('auth_token', savedToken);
          await storage.set('user_info', savedUser);
        }
      }


      if (savedToken && savedUser) {
        const isValid = await verifyToken(savedToken);
        
        if (isValid) {
          setAuthState({
            isAuthenticated: true,
            user: savedUser,
            token: savedToken,
            loading: false
          });
          return;
        } else {
          await Promise.all([
            storage.remove('auth_token'),
            storage.remove('user_info'),
            chrome.storage.local.remove(['auth_token', 'user_info'])
          ]);
        }
      }

      setAuthState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  // 验证Token有效性
  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // GitHub OAuth登录
  const handleGitHubLogin = async () => {
    try {
      setUploadStatus({
        uploading: true,
        progress: 0,
        message: '正在启动GitHub认证...'
      });

      const response = await chrome.runtime.sendMessage({
        type: 'INITIATE_AUTH'
      });

      if (!response.success) {
        throw new Error(response.error || '认证启动失败');
      }

      setUploadStatus({
        uploading: false,
        progress: 100,
        message: '认证成功！'
      });

    } catch (error) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `登录失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }
  };

  // 登出
  const handleLogout = async () => {
    try {
      // 清除本地存储
      await storage.remove('auth_token');
      await storage.remove('user_info');
      await chrome.storage.local.remove(['oauth_success', 'auth_token', 'user_info']);
      await chrome.storage.sync.remove(['isLoggedIn', 'userProfile']);

      // 更新状态
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });

      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '已成功退出登录'
      });

    } catch (error) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '退出登录失败，请刷新页面重试'
      });
    }
  };

  // 加载状态
  if (authState.loading) {
    return (
      <div className={`main-layout ${isDarkMode ? 'dark' : 'light'}`}>
        <div className="fullapp-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>正在加载...</p>
          </div>
        </div>
      </div>
    );
  }

  // 未认证状态 - 显示登录界面
  if (!authState.isAuthenticated) {
    return (
      <div className={`main-layout ${isDarkMode ? 'dark' : 'light'}`}>
        <div className="fullapp-container auth-container">
          <div className="auth-header">
            <div className="logo-section">
              <div className="logo-icon">🔬</div>
              <div className="logo-content">
                <h1 className="app-title">AI微积分助教</h1>
                <p className="app-subtitle">智能学习助手</p>
              </div>
            </div>
          </div>

          <div className="auth-content">
            <AuthSection
              authState={authState}
              uploadStatus={uploadStatus}
              onGitHubLogin={handleGitHubLogin}
              onLogout={handleLogout}
            />
          </div>

          <div className="auth-footer">
            <div className="version-info">
              <span>版本 2.0.0</span>
              <span>•</span>
              <span>Powered by MathPix</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已认证状态 - 显示主应用界面
  return (
    <MainLayout 
      authState={authState} 
      onLogout={handleLogout}
      initialPage={initialPage}
    >
      <HomePage 
        authState={authState}
        isDarkMode={isDarkMode} // 传递主题状态
      />
    </MainLayout>
  );
}

export default FullApp;