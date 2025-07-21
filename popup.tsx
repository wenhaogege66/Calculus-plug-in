import React, { useState, useRef } from "react"
import "./popup.css"

function IndexPopup() {
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: '', type: 'info' })
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="popup-container">
      <div className="header">
        <h1>📚 AI微积分助教</h1>
        <p>智能作业批改 · 错题解析</p>
      </div>

      <div className="content">
        {/* 上传区域 */}
        <div 
          className={`upload-area ${dragOver ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-icon">📄</div>
          <div className="upload-text">拖拽文件到这里或点击上传</div>
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
