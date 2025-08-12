import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MainLayout } from '../components/MainLayout';
import { HomePage } from '../components/HomePage';
import { AuthSection } from '../components/AuthSection';

import '../popup.css';

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
        console.log('检测到认证状态变化，重新初始化...');
        await initializeAuth();
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // 监听来自popup的消息
    const handleMessage = async (message: any) => {
      if (message.type === 'AUTH_SUCCESS') {
        console.log('收到认证成功消息，重新初始化...');
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
      console.log('开始初始化认证状态...');
      
      // 尝试从Plasmo Storage获取
      let savedToken = await storage.get('auth_token');
      let savedUser = await storage.get('user_info');
      
      console.log('Plasmo Storage 数据:', { token: !!savedToken, user: !!savedUser });
      
      // 如果Plasmo Storage没有数据，尝试Chrome Storage
      if (!savedToken || !savedUser) {
        console.log('尝试从Chrome Storage获取数据...');
        const chromeData = await chrome.storage.local.get(['auth_token', 'user_info']);
        savedToken = savedToken || chromeData.auth_token;
        savedUser = savedUser || chromeData.user_info;
        
        // 如果Chrome Storage有数据，同步到Plasmo Storage
        if (savedToken && savedUser) {
          console.log('同步Chrome Storage数据到Plasmo Storage');
          await storage.set('auth_token', savedToken);
          await storage.set('user_info', savedUser);
        }
      }

      console.log('最终获取的数据:', { token: !!savedToken, user: !!savedUser });

      if (savedToken && savedUser) {
        console.log('验证token有效性...');
        const isValid = await verifyToken(savedToken);
        console.log('Token验证结果:', isValid);
        
        if (isValid) {
          setAuthState({
            isAuthenticated: true,
            user: savedUser,
            token: savedToken,
            loading: false
          });
          console.log('认证成功，用户已登录');
          return;
        } else {
          console.log('Token无效，清除存储数据');
          await Promise.all([
            storage.remove('auth_token'),
            storage.remove('user_info'),
            chrome.storage.local.remove(['auth_token', 'user_info'])
          ]);
        }
      }

      console.log('用户未登录');
      setAuthState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error('初始化认证状态失败:', error);
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
      console.error('Token验证失败:', error);
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
      console.error('GitHub登录失败:', error);
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
      console.error('退出登录失败:', error);
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
      <div className="fullapp-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载...</p>
        </div>
      </div>
    );
  }

  // 未认证状态 - 显示登录界面
  if (!authState.isAuthenticated) {
    return (
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
    );
  }

  // 已认证状态 - 显示主应用界面
  return (
    <div className="fullapp-container main-app">
      <MainLayout 
        authState={authState} 
        onLogout={handleLogout}
        initialPage={initialPage}
      >
        <HomePage 
          authState={authState}
          isDarkMode={false} // 这将由MainLayout管理
        />
      </MainLayout>
    </div>
  );
}

export default FullApp;