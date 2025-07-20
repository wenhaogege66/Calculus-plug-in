// Chrome插件Service Worker后台脚本

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI微积分助教插件已安装');
  
  // 初始化存储
  chrome.storage.sync.set({
    isLoggedIn: false,
    userProfile: null,
    settings: {
      autoGrading: true,
      showHints: true,
      language: 'zh-CN'
    }
  });

  // 创建上下文菜单 (如果API可用)
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'uploadHomework',
      title: '上传作业到AI助教',
      contexts: ['page']
    });
  }
});

// 上下文菜单点击处理 (如果API可用)
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info: any, tab: any) => {
    if (info.menuItemId === 'uploadHomework') {
      // 打开侧边栏
      if (tab?.id && chrome.sidePanel) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    }
  });
}

// 处理来自content script和popup的消息
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  console.log('Background收到消息:', message);

  switch (message.type) {
    case 'UPLOAD_FILE':
      handleFileUpload(message.data)
        .then((result: any) => sendResponse({ success: true, data: result }))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true; // 保持消息通道开放用于异步响应

    case 'GET_USER_STATUS':
      chrome.storage.sync.get(['isLoggedIn', 'userProfile'], (result: any) => {
        sendResponse({ success: true, data: result });
      });
      return true;

    case 'SAVE_SUBMISSION':
      handleSaveSubmission(message.data)
        .then((result: any) => sendResponse({ success: true, data: result }))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// 文件上传处理
async function handleFileUpload(fileData: { file: File; type: string }) {
  try {
    const formData = new FormData();
    formData.append('file', fileData.file);
    formData.append('type', fileData.type);

    // 获取用户token
    const storage = await chrome.storage.sync.get(['userToken']);
    
    const response = await fetch('https://ap-southeast-1.run.claw.cloud/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${storage.userToken}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('文件上传失败:', error);
    throw error;
  }
}

// 保存作业提交
async function handleSaveSubmission(submissionData: any) {
  try {
    const storage = await chrome.storage.sync.get(['userToken']);
    
    const response = await fetch('https://ap-southeast-1.run.claw.cloud/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.userToken}`
      },
      body: JSON.stringify(submissionData)
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('保存作业失败:', error);
    throw error;
  }
}

// MyScript识别处理
async function callMyScriptAPI(imageData: string) {
  try {
    const storage = await chrome.storage.sync.get(['userToken']);
    
    const response = await fetch('https://ap-southeast-1.run.claw.cloud/api/ai/myscript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.userToken}`
      },
      body: JSON.stringify({ imageData })
    });

    if (!response.ok) {
      throw new Error(`MyScript API failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('MyScript识别失败:', error);
    throw error;
  }
}

// Deepseek AI批改处理
async function callDeepseekAPI(content: string) {
  try {
    const storage = await chrome.storage.sync.get(['userToken']);
    
    const response = await fetch('https://ap-southeast-1.run.claw.cloud/api/ai/grading', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.userToken}`
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      throw new Error(`Deepseek API failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Deepseek批改失败:', error);
    throw error;
  }
}

// 导出供其他模块使用
if (typeof globalThis !== 'undefined') {
  (globalThis as any).backgroundAPI = {
    callMyScriptAPI,
    callDeepseekAPI,
    handleFileUpload,
    handleSaveSubmission
  };
} 