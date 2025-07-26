import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { supabase, API_BASE_URL, type User, type AuthState } from './common/config/supabase';

import "./popup.css"

const storage = new Storage();

function Popup() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true
  });

  const [uploadStatus, setUploadStatus] = useState<{
    uploading: boolean;
    progress: number;
    message: string;
  }>({
    uploading: false,
    progress: 0,
    message: ''
  });

  // 检测是否在全屏模式（新标签页）
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    // 检测是否在新标签页中打开（全屏模式）
    const checkFullscreenMode = () => {
      // 如果URL包含chrome-extension://且路径是popup.html，且窗口尺寸大于popup限制，说明是全屏模式
      const isInTab = window.location.href.includes('chrome-extension://') && 
                      window.location.pathname.includes('popup.html') &&
                      (window.innerWidth > 600 || window.innerHeight > 580);
      setIsFullscreen(isInTab);
      
      // 在全屏模式下移除CSS尺寸限制
      if (isInTab) {
        const style = document.createElement('style');
        style.textContent = `
          html, body {
            width: 100% !important;
            height: 100% !important;
            min-width: 100% !important;
            min-height: 100% !important;
            max-width: none !important;
            max-height: none !important;
          }
          .popup-container {
            min-height: 100vh !important;
            max-height: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    };
    
    checkFullscreenMode();
    window.addEventListener('resize', checkFullscreenMode);
    
    return () => {
      window.removeEventListener('resize', checkFullscreenMode);
    };
  }, []);

  // 初始化认证状态
  useEffect(() => {
    initializeAuth();
    
    // 监听来自OAuth回调窗口的消息
    window.addEventListener('message', handleAuthMessage);
    
    // 监听来自background script的消息
    const handleRuntimeMessage = (message: any, sender: any, sendResponse: any) => {
      console.log('Popup收到runtime消息:', message);
      if (message.type === 'GITHUB_AUTH_SUCCESS') {
        handleAuthMessage({ data: message } as MessageEvent);
        sendResponse({ success: true });
      }
    };
    
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    
    // 监听BroadcastChannel消息（额外的通信渠道）
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('oauth-success');
      broadcastChannel.addEventListener('message', (event) => {
        console.log('收到BroadcastChannel消息:', event.data);
        if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
          handleAuthMessage({ data: event.data } as MessageEvent);
        }
      });
    } catch (error) {
      console.log('BroadcastChannel不可用:', error);
    }
    
    // 定期检查LocalStorage（备用方案）
    const checkLocalStorage = () => {
      try {
        const authData = localStorage.getItem('oauth_auth_data');
        if (authData) {
          const parsed = JSON.parse(authData);
          // 检查数据是否是最近的（5分钟内）
          if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            console.log('从LocalStorage检测到OAuth数据:', parsed);
            handleAuthMessage({ 
              data: {
                type: 'GITHUB_AUTH_SUCCESS',
                token: parsed.token,
                user: parsed.user
              }
            } as MessageEvent);
            localStorage.removeItem('oauth_auth_data'); // 清除已处理的数据
          }
        }
      } catch (error) {
        console.error('LocalStorage检查失败:', error);
      }
    };
    
    // 立即检查一次LocalStorage
    checkLocalStorage();
    
    // 每秒检查LocalStorage
    const localStorageInterval = setInterval(checkLocalStorage, 1000);
    
    // 监听storage变化，用于OAuth回调后的状态同步
    const handleStorageChange = async (changes: any) => {
      if (changes.oauth_success) {
        const authData = changes.oauth_success.newValue;
        if (authData) {
          console.log('检测到OAuth成功，处理认证信息...');
          
          // 确保数据格式正确
          let parsedData: any = authData;
          if (typeof authData === 'string') {
            try {
              parsedData = JSON.parse(authData);
            } catch (e) {
              console.error('解析OAuth数据失败:', e);
              return;
            }
          }
          
          // 验证数据结构
          if (!parsedData || !parsedData.user || !parsedData.token) {
            console.error('OAuth数据结构无效:', parsedData);
            return;
          }
          
          setAuthState({
            isAuthenticated: true,
            user: parsedData.user,
            token: parsedData.token,
            loading: false
          });

          setUploadStatus({
            uploading: false,
            progress: 100,
            message: '✅ 登录成功！'
          });

          // 清除临时标志
          await storage.remove('oauth_success');
          
          // 3秒后清除消息
          setTimeout(() => {
            setUploadStatus(prev => ({ ...prev, message: '' }));
          }, 3000);
        }
      }
    };

    // 监听storage变化
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // 定期检查OAuth状态更新（为了处理popup关闭后重新打开的情况）
    const oauthCheckInterval = setInterval(async () => {
      const oauthSuccess = await storage.get('oauth_success');
      if (oauthSuccess && !authState.isAuthenticated) {
        console.log('检测到延迟的OAuth成功状态');
        
        // 确保数据格式正确
        let parsedData: any = oauthSuccess;
        if (typeof oauthSuccess === 'string') {
          try {
            parsedData = JSON.parse(oauthSuccess);
          } catch (e) {
            console.error('解析OAuth数据失败:', e);
            return;
          }
        }
        
        // 验证数据结构
        if (!parsedData || !parsedData.user || !parsedData.token) {
          console.error('OAuth数据结构无效:', parsedData);
          return;
        }
        
        setAuthState({
          isAuthenticated: true,
          user: parsedData.user,
          token: parsedData.token,
          loading: false
        });

        setUploadStatus({
          uploading: false,
          progress: 100,
          message: '✅ 登录成功！'
        });

        // 清除临时标志
        await storage.remove('oauth_success');
        
        // 3秒后清除消息
        setTimeout(() => {
          setUploadStatus(prev => ({ ...prev, message: '' }));
        }, 3000);
      }
    }, 1000); // 每秒检查一次
    
    return () => {
      window.removeEventListener('message', handleAuthMessage);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      clearInterval(oauthCheckInterval);
      clearInterval(localStorageInterval);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [authState.isAuthenticated]);

  const initializeAuth = async () => {
    try {
      // 从storage获取保存的token
      const savedToken = await storage.get('auth_token');
      const savedUser = await storage.get('user_info');

      console.log('初始化认证状态 - Token:', savedToken ? '存在' : '不存在', 'User:', savedUser ? '存在' : '不存在');

      if (savedToken && savedUser) {
        // 首先设置认证状态，然后在后台验证token
        setAuthState({
          isAuthenticated: true,
          user: typeof savedUser === 'string' ? JSON.parse(savedUser) : savedUser,
          token: savedToken,
          loading: false
        });

        // 在后台验证token是否仍然有效
        const isValid = await verifyToken(savedToken);
        if (!isValid) {
          console.log('Token已过期，需要重新登录');
          // Token无效，清除storage并重置状态
          await storage.remove('auth_token');
          await storage.remove('user_info');
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false
          });
          setUploadStatus({
            uploading: false,
            progress: 0,
            message: '⚠️ 登录已过期，请重新登录'
          });
          setTimeout(() => {
            setUploadStatus(prev => ({ ...prev, message: '' }));
          }, 3000);
        } else {
          console.log('Token验证成功，保持登录状态');
        }
        return;
      }

      setAuthState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error('初始化认证状态失败:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

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

  const handleAuthMessage = async (event: MessageEvent) => {
    console.log('收到消息:', event.data);
    
    if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
      console.log('GitHub登录成功，处理认证信息...');
      const { token, user } = event.data;
      
      // 保存认证信息
      await storage.set('auth_token', token);
      await storage.set('user_info', user);
      
      setAuthState({
        isAuthenticated: true,
        user: user,
        token: token,
        loading: false
      });

      setUploadStatus({
        uploading: false,
        progress: 100,
        message: '✅ 登录成功！'
      });

      // 3秒后清除消息
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '' }));
      }, 3000);
    } else {
      console.log('收到其他类型消息:', event.data?.type);
    }
  };

  const handleGitHubLogin = async () => {
    try {
      setUploadStatus({
        uploading: true,
        progress: 0,
        message: '正在跳转到GitHub登录...'
      });

      // 获取GitHub OAuth URL
      const response = await fetch(`${API_BASE_URL}/auth/github`);
      const result = await response.json();

            if (result.success && result.data?.authUrl) {
        setUploadStatus({
          uploading: true,
          progress: 50,
          message: '🔗 正在打开GitHub登录页面...'
        });

        // 使用chrome.tabs API在新标签页中打开OAuth URL（如果可用）
        if (chrome?.tabs) {
          try {
            // 在Chrome扩展中，使用tabs API打开新标签页
            chrome.tabs.create({ 
              url: result.data.authUrl,
              active: true 
            });
          } catch (error) {
            console.log('chrome.tabs不可用，降级使用window.open');
            // 降级处理：使用window.open
            const authWindow = window.open(
              result.data.authUrl,
              'github-auth',
              'width=550,height=650,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes'
            );
            
            if (!authWindow) {
              throw new Error('无法打开OAuth窗口，请检查浏览器是否阻止了弹窗');
            }
          }
        } else {
          // 在普通网页环境中，使用window.open
          const authWindow = window.open(
            result.data.authUrl,
            'github-auth',
            'width=550,height=650,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes'
          );
          
          if (!authWindow) {
            throw new Error('无法打开OAuth窗口，请检查浏览器是否阻止了弹窗');
          }
        }

        setUploadStatus({
          uploading: true,
          progress: 75,
          message: '⏳ 正在处理GitHub登录...'
        });

        console.log('OAuth登录流程已启动，等待回调...');

      } else {
        throw new Error(result.error || 'GitHub OAuth初始化失败');
      }
    } catch (error) {
      console.error('GitHub登录失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `登录失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }
  };

  const handleLogout = async () => {
    try {
      // 清除本地存储
      await storage.remove('auth_token');
      await storage.remove('user_info');
      
      // 从Supabase登出
      await supabase.auth.signOut();

      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });

      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '已退出登录'
      });

      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '' }));
      }, 2000);
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 强制检查认证状态
    if (!authState.isAuthenticated || !authState.token) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '⚠️ 请先登录后再上传文件'
      });
      
      // 清空文件选择
      event.target.value = '';
      return;
    }

    try {
      setUploadStatus({
        uploading: true,
        progress: 20,
        message: '正在上传文件...'
      });

      const formData = new FormData();
      formData.append('file', file);

      setUploadStatus(prev => ({ ...prev, progress: 50 }));

      const response = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: '✅ 文件上传成功！正在创建提交记录...'
        });

        // 创建提交记录
        const submissionResponse = await fetch(`${API_BASE_URL}/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.token}`
          },
          body: JSON.stringify({
            fileUploadId: result.data.fileId
          })
        });

        const submissionResult = await submissionResponse.json();
        
        if (submissionResult.success) {
          setUploadStatus({
            uploading: false,
            progress: 100,
            message: '🎉 提交成功！点击侧边栏查看处理进度'
          });
        } else {
          setUploadStatus({
            uploading: false,
            progress: 100,
            message: '⚠️ 文件上传成功，但创建提交记录失败'
          });
        }
      } else {
        throw new Error(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `❌ 上传失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    // 清空文件输入
    event.target.value = '';

    // 5秒后清除消息
    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 5000);
  };

  const openSidePanel = async () => {
    try {
      // 使用Chrome扩展API打开侧边栏
      if (chrome?.sidePanel) {
        await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      } else {
        // 降级处理：在新标签页中打开
        await chrome.tabs.create({ 
          url: chrome.runtime.getURL('sidepanel.html'),
          active: true
        });
      }
    } catch (error) {
      console.error('打开侧边栏失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 打开侧边栏失败，请检查浏览器权限'
      });
    }
  };

  if (authState.loading) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h2>AI微积分助教</h2>
        </div>
        <div className="loading">
          <div className="spinner"></div>
          <p>正在加载...</p>
        </div>
      </div>
    );
  }

  const openFullscreen = async () => {
    try {
      // 在新标签页中打开完整的popup界面
      await chrome.tabs.create({ 
        url: chrome.runtime.getURL('popup.html'),
        active: true
      });
    } catch (error) {
      console.error('打开全屏模式失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 打开全屏模式失败，请检查浏览器权限'
      });
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>AI微积分助教</h2>
        <p>基于Supabase的智能作业批改助手</p>
        {!isFullscreen && (
          <button 
            className="fullscreen-btn"
            onClick={openFullscreen}
            title="全屏显示"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7,14H5v5h5v-2H7V14z M5,10h2V7h3V5H5V10z M17,7h-3V5h5v5h-2V7z M14,14v2h3v3h2v-5H14z"/>
            </svg>
          </button>
        )}
      </div>

      {!authState.isAuthenticated ? (
        // 未登录状态
        <div className="auth-section">
          <div className="auth-prompt">
            <h3>🔐 请先登录</h3>
            <p>使用GitHub账户登录以上传作业</p>
          </div>
          
          <button
            className="github-login-btn"
            onClick={handleGitHubLogin}
            disabled={uploadStatus.uploading}
          >
            {uploadStatus.uploading ? (
              <>
                <div className="spinner small"></div>
                连接中...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                使用GitHub登录
              </>
            )}
          </button>

          {/* 登录提示 */}
          <div className="auth-notice">
            <h4>⚠️ 登录后才能使用的功能：</h4>
            <ul>
              <li>📤 上传作业文件</li>
              <li>🔍 OCR手写识别</li>
              <li>🤖 AI智能批改</li>
              <li>📊 查看批改历史</li>
            </ul>
          </div>

          {uploadStatus.message && (
            <div className={`status-message ${uploadStatus.message.includes('失败') || uploadStatus.message.includes('❌') || uploadStatus.message.includes('超时') || uploadStatus.message.includes('⚠️') ? 'error' : 'success'}`}>
              {uploadStatus.message}
            </div>
          )}
        </div>
      ) : (
        // 已登录状态
        <div className="main-section">
          <div className="user-info">
            <div className="user-avatar">
              {authState.user?.avatarUrl ? (
                <img src={authState.user.avatarUrl} alt="头像" />
              ) : (
                <div className="avatar-placeholder">
                  {authState.user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="user-details">
              <h3>{authState.user?.username}</h3>
              <p>{authState.user?.email}</p>
              <span className="user-role">
                {authState.user?.role === 'student' ? '🎓 学生' : '👨‍🏫 教师'}
              </span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              退出
            </button>
          </div>

          <div className="upload-section">
            <h3>📤 上传作业</h3>
            <div className="upload-area">
              <input
                type="file"
                id="file-input"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileUpload}
                disabled={uploadStatus.uploading}
              />
              <label htmlFor="file-input" className="upload-label">
                {uploadStatus.uploading ? (
                  <>
                    <div className="spinner"></div>
                    上传中... {uploadStatus.progress}%
                  </>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    点击上传PDF或图片文件
                  </>
                )}
              </label>
            </div>
            
            <div className="file-info">
              <p>📋 支持格式: PDF, JPG, PNG, GIF, WebP</p>
              <p>📏 最大大小: 100MB</p>
            </div>

            {uploadStatus.message && (
              <div className={`status-message ${uploadStatus.message.includes('失败') || uploadStatus.message.includes('❌') || uploadStatus.message.includes('超时') || uploadStatus.message.includes('⚠️') ? 'error' : 'success'}`}>
                {uploadStatus.message}
              </div>
            )}
          </div>

          <div className="actions-section">
            <button 
              className="action-btn primary"
              onClick={openSidePanel}
            >
              📊 查看批改结果
            </button>
            <button 
              className="action-btn secondary"
              onClick={() => chrome.tabs.create({ url: `${API_BASE_URL.replace('/api', '')}` })}
            >
              🌐 打开后端管理
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Popup;
