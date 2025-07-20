// Chrome插件Popup界面脚本

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup界面已加载');

  // 获取DOM元素
  const uploadArea = document.getElementById('uploadArea') as HTMLElement;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const status = document.getElementById('status') as HTMLElement;
  const progress = document.getElementById('progress') as HTMLElement;
  const progressBar = document.getElementById('progressBar') as HTMLElement;
  const openSidePanelBtn = document.getElementById('openSidePanel') as HTMLButtonElement;
  const viewHistoryBtn = document.getElementById('viewHistory') as HTMLButtonElement;

  // 文件上传相关
  let isUploading = false;

  // 初始化事件监听
  function initEventListeners() {
    // 上传区域点击
    uploadArea.addEventListener('click', () => {
      if (!isUploading) {
        fileInput.click();
      }
    });

    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);

    // 拖拽事件
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // 按钮事件
    openSidePanelBtn.addEventListener('click', openSidePanel);
    viewHistoryBtn.addEventListener('click', viewHistory);

    // 防止默认拖拽行为
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
  }

  // 处理文件选择
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  }

  // 处理拖拽悬停
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
  }

  // 处理拖拽离开
  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
  }

  // 处理文件拖拽
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  }

  // 处理文件
  function handleFiles(files: File[]) {
    console.log('处理文件:', files);

    // 验证文件类型
    const supportedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png'];
    const validFiles = files.filter(file => {
      return supportedTypes.indexOf(file.type) !== -1;
    });

    if (validFiles.length === 0) {
      showStatus('请选择支持的文件格式 (PDF, TXT, JPG, PNG)', 'error');
      return;
    }

    if (validFiles.length !== files.length) {
      showStatus(`已过滤掉 ${files.length - validFiles.length} 个不支持的文件`, 'info');
    }

    // 检查文件大小
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      showStatus('文件大小不能超过10MB', 'error');
      return;
    }

    // 开始上传
    uploadFiles(validFiles);
  }

  // 上传文件
  async function uploadFiles(files: File[]) {
    if (isUploading) return;

    isUploading = true;
    showProgress(true);
    showStatus('正在上传文件...', 'info');

         try {
       const results: any[] = [];

       for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i + 1) / files.length) * 100;
        
        updateProgress(progress);
        showStatus(`正在上传 ${file.name}...`, 'info');

        // 发送到background script
        const result = await sendToBackground({
          type: 'UPLOAD_FILE',
          data: { file, type: 'popup' }
        });

        results.push(result);
      }

      // 处理上传结果
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        showStatus(`成功上传 ${successCount} 个文件`, 'success');
      } else {
        showStatus(`成功 ${successCount} 个，失败 ${failCount} 个`, 'error');
      }

      // 等待一下然后处理文件
      setTimeout(() => {
        processUploadedFiles(results);
      }, 1000);

    } catch (error) {
      console.error('上传失败:', error);
      showStatus('上传失败，请重试', 'error');
    } finally {
      isUploading = false;
      setTimeout(() => showProgress(false), 2000);
    }
  }

  // 处理上传完成的文件
  async function processUploadedFiles(results: any[]) {
    showStatus('正在处理文件...', 'info');

    for (const result of results) {
      if (result.success && result.data) {
        // 调用MyScript识别
        await processWithMyScript(result.data);
      }
    }
  }

  // MyScript识别处理
  async function processWithMyScript(fileData: any) {
    try {
      showStatus('正在识别手写内容...', 'info');

      const response = await sendToBackground({
        type: 'PROCESS_MYSCRIPT',
        data: fileData
      });

      if (response.success) {
        showStatus('识别完成，正在AI批改...', 'info');
        // 继续Deepseek批改
        await processWithDeepseek(response.data);
      } else {
        showStatus('识别失败', 'error');
      }
    } catch (error) {
      console.error('MyScript处理失败:', error);
      showStatus('识别处理失败', 'error');
    }
  }

  // Deepseek AI批改
  async function processWithDeepseek(myScriptData: any) {
    try {
      const response = await sendToBackground({
        type: 'PROCESS_DEEPSEEK',
        data: myScriptData
      });

      if (response.success) {
        showStatus('AI批改完成！', 'success');
        // 保存结果
        await saveSubmission(response.data);
      } else {
        showStatus('AI批改失败', 'error');
      }
    } catch (error) {
      console.error('Deepseek处理失败:', error);
      showStatus('AI批改失败', 'error');
    }
  }

  // 保存作业提交
  async function saveSubmission(gradingResult: any) {
    try {
      const response = await sendToBackground({
        type: 'SAVE_SUBMISSION',
        data: gradingResult
      });

      if (response.success) {
        showStatus('结果已保存，点击侧边栏查看详情', 'success');
        // 自动打开侧边栏
        setTimeout(() => {
          openSidePanel();
        }, 2000);
      }
    } catch (error) {
      console.error('保存失败:', error);
      showStatus('保存失败', 'error');
    }
  }

  // 打开侧边栏
  async function openSidePanel() {
    try {
      // 检查Chrome版本和API可用性
      if (typeof chrome === 'undefined') {
        throw new Error('Chrome扩展API不可用');
      }

      // 尝试不同的方式打开侧边栏
      if ((chrome as any).sidePanel && (chrome as any).sidePanel.open) {
        // Chrome 114+ 的新API
        const [tab] = await (chrome as any).tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          throw new Error('无法获取当前标签页');
        }
        await (chrome as any).sidePanel.open({ tabId: tab.id });
        window.close();
      } else if ((chrome as any).sidePanel && (chrome as any).sidePanel.setOptions) {
        // 备用方案：设置侧边栏选项
        await (chrome as any).sidePanel.setOptions({
          path: 'sidepanel/index.html',
          enabled: true
        });
        showStatus('侧边栏已启用，请点击浏览器侧边栏按钮打开', 'success');
      } else {
        // 降级方案：打开新标签页
        const url = chrome.runtime.getURL('sidepanel/index.html');
        await (chrome as any).tabs.create({ url });
        window.close();
      }
      
    } catch (error) {
      console.error('打开侧边栏失败:', error);
      
      // 显示用户友好的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      if (errorMessage.includes('API Unavailable') || errorMessage.includes('sidePanel')) {
        showStatus('Chrome版本不支持侧边栏，正在新标签页中打开...', 'info');
        
        // 备选方案：新标签页打开
        setTimeout(async () => {
          try {
            const url = chrome.runtime.getURL('sidepanel/index.html');
            await (chrome as any).tabs.create({ url });
            window.close();
          } catch (fallbackError) {
            showStatus('请手动打开插件进行使用', 'error');
          }
        }, 1000);
      } else {
        showStatus(`打开失败: ${errorMessage}`, 'error');
      }
    }
  }

  // 查看历史记录
  function viewHistory() {
    // 实现历史记录查看功能
    showStatus('历史记录功能开发中...', 'info');
  }

  // 发送消息到background script
  function sendToBackground(message: any): Promise<any> {
    return new Promise((resolve) => {
      (chrome as any).runtime.sendMessage(message, (response: any) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  // 显示状态信息
  function showStatus(message: string, type: 'success' | 'error' | 'info' = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    // 3秒后自动隐藏（除非是错误）
    if (type !== 'error') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }

  // 显示/隐藏进度条
  function showProgress(show: boolean) {
    progress.style.display = show ? 'block' : 'none';
    if (!show) {
      progressBar.style.width = '0%';
    }
  }

  // 更新进度条
  function updateProgress(percent: number) {
    progressBar.style.width = Math.min(100, Math.max(0, percent)) + '%';
  }

  // 初始化
  initEventListeners();
  
  // 检查用户状态
  sendToBackground({ type: 'GET_USER_STATUS' }).then(response => {
    if (response.success && response.data.isLoggedIn) {
      showStatus('已登录，可以开始使用', 'success');
    } else {
      showStatus('欢迎使用AI微积分助教', 'info');
    }
  });

  console.log('Popup界面初始化完成');
}); 