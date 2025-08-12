import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from './common/config/supabase';
import { CompactPopup } from './components/CompactPopup';
import { AuthSection } from './components/AuthSection';

import "./components/CompactPopup.css";

const storage = new Storage();

function Popup() {
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

  // 初始化认证状态
  useEffect(() => {
    initializeAuth();
    
    // 监听认证状态变化
    const authListener = chrome.storage.local.onChanged.addListener((changes, namespace) => {
      console.log('Storage 变化:', changes, namespace);
      if (namespace === 'local' && changes.oauth_success) {
        const authData = changes.oauth_success.newValue;
        console.log('检测到OAuth成功:', authData);
        if (authData) {
          setAuthState({
            isAuthenticated: true,
            user: authData.user,
            token: authData.token,
            loading: false
          });
        }
      }
    });

    return () => {
      if (authListener) {
        chrome.storage.local.onChanged.removeListener(authListener);
      }
    };
  }, []);

  // 初始化认证状态
  const initializeAuth = async () => {
    try {
      console.log('正在初始化认证状态...');
      
      // 优先检查Chrome Storage Local
      const chromeStorageAuth = await chrome.storage.local.get(['auth_token', 'user_info']);
      console.log('Chrome Storage认证数据:', chromeStorageAuth);
      
      if (chromeStorageAuth.auth_token && chromeStorageAuth.user_info) {
        const isValid = await verifyToken(chromeStorageAuth.auth_token);
        if (isValid) {
          console.log('Chrome Storage认证有效');
          setAuthState({
            isAuthenticated: true,
            user: chromeStorageAuth.user_info,
            token: chromeStorageAuth.auth_token,
            loading: false
          });
          return;
        }
      }

      // 检查Plasmo Storage
      const savedToken = await storage.get('auth_token');
      const savedUser = await storage.get('user_info');
      console.log('Plasmo Storage认证数据:', { token: !!savedToken, user: !!savedUser });

      if (savedToken && savedUser) {
        const isValid = await verifyToken(savedToken);
        if (isValid) {
          console.log('Plasmo Storage认证有效');
          setAuthState({
            isAuthenticated: true,
            user: savedUser,
            token: savedToken,
            loading: false
          });
          
          // 同步到Chrome Storage
          await chrome.storage.local.set({
            'auth_token': savedToken,
            'user_info': savedUser
          });
          return;
        } else {
          // 清除无效的认证数据
          await storage.remove('auth_token');
          await storage.remove('user_info');
          await chrome.storage.local.remove(['auth_token', 'user_info']);
        }
      }

      console.log('未找到有效认证，显示登录界面');
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
      console.log('开始GitHub登录流程');
      setUploadStatus({
        uploading: true,
        progress: 0,
        message: '正在启动GitHub认证...'
      });

      const response = await chrome.runtime.sendMessage({
        type: 'INITIATE_AUTH'
      });

      console.log('认证响应:', response);

      if (!response || !response.success) {
        throw new Error(response?.error || '认证启动失败');
      }

      setUploadStatus({
        uploading: false,
        progress: 100,
        message: '认证成功！'
      });

      // 立即重新检查认证状态
      setTimeout(() => {
        initializeAuth();
      }, 500);

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
      console.log('开始退出登录');
      // 清除所有存储
      await Promise.all([
        storage.remove('auth_token'),
        storage.remove('user_info'),
        chrome.storage.local.remove(['oauth_success', 'auth_token', 'user_info']),
        chrome.storage.sync.remove(['isLoggedIn', 'userProfile'])
      ]);

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

      console.log('退出登录完成');
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
      <div className="compact-popup">
        <div className="loading-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>正在加载...</p>
        </div>
      </div>
    );
  }

  // 未认证状态 - 显示暗背景登录界面
  if (!authState.isAuthenticated) {
    return (
      <div className="compact-popup auth-popup">
        <div className="auth-background">
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
              <span>Powered by MathPix & Deepseek</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已认证状态 - 显示紧凑型界面
  return (
    <CompactPopup 
      authState={authState} 
      onLogout={handleLogout}
    />
  );
}

export default Popup;