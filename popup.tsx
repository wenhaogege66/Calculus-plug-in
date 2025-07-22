import React, { useState, useRef, useEffect } from "react"
import "./popup.css"

// 用户信息接口
interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  role: string;
  auth_type: string;
}

function IndexPopup() {
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: '', type: 'info' })
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 组件初始化时检查登录状态
  useEffect(() => {
    checkLoginStatus()
  }, [])

  // 检查登录状态
  const checkLoginStatus = async () => {
    setIsLoading(true)
    try {
      const token = await getStoredToken()
      if (token) {
        const userInfo = await verifyToken(token)
        if (userInfo.success) {
          setUser(userInfo.data.user)
          setIsLoggedIn(true)
          showStatus(`欢迎回来，${userInfo.data.user.username}！`, 'success')
        } else {
          // Token无效，清除存储
          await chrome.storage.sync.remove(['authToken'])
          setIsLoggedIn(false)
        }
      } else {
        setIsLoggedIn(false)
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      setIsLoggedIn(false)
    } finally {
      setIsLoading(false)
    }
  }

  // 获取存储的token
  const getStoredToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['authToken'], (result) => {
        resolve(result.authToken || null)
      })
    })
  }

  // 存储token
  const storeToken = (token: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ authToken: token }, () => {
        resolve()
      })
    })
  }

  // 验证token
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      return await response.json()
    } catch (error) {
      console.error('Token验证失败:', error)
      return { success: false, error: '网络错误' }
    }
  }

  // GitHub登录
  const handleGitHubLogin = async () => {
    try {
      showStatus('正在重定向到GitHub登录...', 'info')
      
      // 获取GitHub OAuth授权URL
      const response = await fetch('http://localhost:3000/api/auth/github')
      const data = await response.json()
      
      if (data.success) {
        // 打开GitHub OAuth页面
        const authWindow = window.open(data.data.authUrl, 'github-auth', 'width=600,height=700')
        
        // 监听OAuth回调消息
        const messageListener = (event: MessageEvent) => {
          if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
            const { token, user: userData } = event.data
            
            // 存储token并更新状态
            storeToken(token).then(() => {
              setUser(userData)
              setIsLoggedIn(true)
              showStatus(`GitHub登录成功！欢迎 ${userData.username}`, 'success')
              
              // 关闭认证窗口
              if (authWindow) {
                authWindow.close()
              }
            })
            
            // 移除事件监听器
            window.removeEventListener('message', messageListener)
          }
        }
        
        window.addEventListener('message', messageListener)
        
        // 检查窗口是否被关闭
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageListener)
            showStatus('登录已取消', 'info')
          }
        }, 1000)
        
      } else {
        showStatus('获取登录链接失败', 'error')
      }
    } catch (error) {
      console.error('GitHub登录失败:', error)
      showStatus('登录失败，请重试', 'error')
    }
  }

  // 登出
  const handleLogout = async () => {
    try {
      await chrome.storage.sync.remove(['authToken'])
      setUser(null)
      setIsLoggedIn(false)
      showStatus('已成功登出', 'info')
    } catch (error) {
      console.error('登出失败:', error)
      showStatus('登出失败', 'error')
    }
  }

  // 显示状态信息
  const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatus({ message, type })
    
    if (type !== 'error') {
      setTimeout(() => {
        setStatus({ message: '', type: 'info' })
      }, 3000)
    }
  }

  // 发送消息到background脚本
  const sendMessageToBackground = (message: any): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message, (response: any) => {
          resolve(response || { success: false, error: 'No response' })
        })
      } else {
        resolve({ success: false, error: 'Chrome runtime not available' })
      }
    })
  }

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      handleFiles(Array.from(files))
    }
  }

  // 处理拖拽事件
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      handleFiles(Array.from(files))
    }
  }

  // 处理文件
  const handleFiles = (files: File[]) => {
    if (!isLoggedIn) {
      showStatus('请先登录后再上传文件', 'error')
      return
    }

    const supportedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png']
    const validFiles = files.filter(file => supportedTypes.includes(file.type))

    if (validFiles.length === 0) {
      showStatus('请选择支持的文件格式 (PDF, TXT, JPG, PNG)', 'error')
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSize)
    
    if (oversizedFiles.length > 0) {
      showStatus('文件大小不能超过10MB', 'error')
      return
    }

    uploadFiles(validFiles)
  }

  // 上传文件
  const uploadFiles = async (files: File[]) => {
    setIsUploading(true)
    showStatus('正在上传文件...', 'info')
    
    try {
      const results = []
      for (const file of files) {
        const result = await sendMessageToBackground({
          type: 'UPLOAD_FILE',
          data: { file, type: 'popup' }
        })
        results.push(result)
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      if (failCount === 0) {
        showStatus(`成功上传 ${successCount} 个文件`, 'success')
        // 自动打开全屏界面
        setTimeout(() => {
          openFullScreen()
        }, 2000)
      } else {
        showStatus(`成功 ${successCount} 个，失败 ${failCount} 个`, 'error')
      }
    } catch (error) {
      showStatus('上传失败，请重试', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // 打开全屏界面
  const openFullScreen = async () => {
    try {
      showStatus('正在打开全屏界面...', 'info')
      const url = chrome.runtime.getURL('sidepanel.html')
      await chrome.tabs.create({ url })
      window.close()
    } catch (error) {
      showStatus('打开失败，请重试', 'error')
    }
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="loading-icon">⏳</div>
          <div>正在检查登录状态...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="header">
        <h1>📚 AI微积分助教</h1>
        <p>智能作业批改 · 错题解析</p>
      </div>

      {/* 用户状态区域 */}
      <div className="user-section">
        {isLoggedIn && user ? (
          <div className="user-info">
            <img 
              src={user.avatar_url || '/icon48.png'} 
              alt="用户头像" 
              className="user-avatar"
            />
            <div className="user-details">
              <div className="user-name">{user.username}</div>
              <div className="user-role">{user.role === 'student' ? '学生' : '教师'}</div>
            </div>
            <button className="btn btn-secondary btn-small" onClick={handleLogout}>
              登出
            </button>
          </div>
        ) : (
          <div className="login-section">
            <div className="login-prompt">
              <span className="login-icon">🔐</span>
              <span>请先登录以使用完整功能</span>
            </div>
            <button className="btn btn-github" onClick={handleGitHubLogin}>
              <span className="github-icon">🐱</span>
              使用 GitHub 登录
            </button>
          </div>
        )}
      </div>

      <div className="content">
        {/* 上传区域 */}
        <div 
          className={`upload-area ${dragOver ? 'dragover' : ''} ${!isLoggedIn ? 'disabled' : ''}`}
          onClick={() => isLoggedIn && fileInputRef.current?.click()}
          onDragOver={isLoggedIn ? handleDragOver : undefined}
          onDragLeave={isLoggedIn ? handleDragLeave : undefined}
          onDrop={isLoggedIn ? handleDrop : undefined}
        >
          <div className="upload-icon">📄</div>
          <div className="upload-text">
            {isLoggedIn ? '拖拽文件到这里或点击上传' : '请先登录后上传文件'}
          </div>
          <div className="upload-hint">支持 PDF、TXT、JPG、PNG 格式</div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef}
          className="file-input" 
          accept=".pdf,.txt,.jpg,.jpeg,.png" 
          multiple
          onChange={handleFileSelect}
        />

        {/* 状态显示 */}
        {status.message && (
          <div className={`status status-${status.type}`}>
            {status.message}
          </div>
        )}

        {/* 功能按钮 */}
        <button 
          className="btn btn-primary" 
          onClick={openFullScreen}
          disabled={isUploading}
        >
          打开全屏界面
        </button>

        {/* 功能介绍 */}
        <div className="features">
          <div className="feature-item">
            <span className="feature-icon">✏️</span>
            <span>手写识别与AI批改</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <span>错题分析与解法指导</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💡</span>
            <span>个性化学习建议</span>
          </div>
        </div>
      </div>

      <div className="footer">
        Version 1.0.0 · AI驱动的智能学习助手
      </div>
    </div>
  )
}

export default IndexPopup
