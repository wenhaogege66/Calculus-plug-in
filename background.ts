// AI微积分助教 - Plasmo Background Script

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI微积分助教插件已安装 (Plasmo版本)');
  
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

  // 创建上下文菜单
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'uploadHomework',
      title: '上传作业到AI助教',
      contexts: ['page']
    });
  }
});

// 上下文菜单点击处理
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
    case 'GITHUB_AUTH_SUCCESS':
      // 处理OAuth成功消息
      handleOAuthSuccess(message.data)
        .then((result: any) => sendResponse({ success: true, data: result }))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'UPLOAD_FILE':
      handleFileUpload(message.data)
        .then((result: any) => sendResponse({ success: true, data: result }))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true;

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

    case 'PROCESS_MYSCRIPT':
      callMyScriptAPI(message.data)
        .then((result: any) => sendResponse({ success: true, data: result }))
        .catch((error: any) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'PROCESS_DEEPSEEK':
      callDeepseekAPI(message.data)
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

    const response = await fetch('http://localhost:3000/api/files', {
      method: 'POST',
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
    const response = await fetch('http://localhost:3000/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    const response = await fetch('http://localhost:3000/api/ocr/myscript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    const response = await fetch('http://localhost:3000/api/ai/deepseek/grade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recognizedContent: content })
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

// OAuth成功处理
async function handleOAuthSuccess(authData: { token: string; user: any }) {
  try {
    console.log('Background处理OAuth成功:', authData);
    
    // 保存认证信息到Chrome storage
    await chrome.storage.local.set({
      'oauth_success': authData,
      'auth_token': authData.token,
      'user_info': authData.user,
      'isLoggedIn': true,
      'userProfile': authData.user
    });

    console.log('OAuth数据已保存到storage');
    
    // 通知所有popup实例
    try {
      const views = chrome.extension.getViews({ type: 'popup' });
      views.forEach(view => {
        if (view.window && view.window.postMessage) {
          view.window.postMessage({
            type: 'GITHUB_AUTH_SUCCESS',
            token: authData.token,
            user: authData.user
          }, '*');
        }
      });
    } catch (error) {
      console.log('通知popup失败:', error);
    }

    return { success: true };
  } catch (error) {
    console.error('OAuth处理失败:', error);
    throw error;
  }
} 