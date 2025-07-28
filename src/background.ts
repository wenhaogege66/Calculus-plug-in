// AI微积分助教 - Plasmo Background Script

// 直接定义API_BASE_URL和Supabase配置，避免复杂的import路径问题  
const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL;

console.log("✅ Background Service Worker 已启动");

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI微积分助教插件已安装 (Plasmo版本)');
});

// 监听来自Popup等内部组件的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background脚本收到内部消息:', message);
  
  if (message.type === 'INITIATE_AUTH') {
    console.log('收到启动认证的请求...');
    // 使用一个立即执行的异步函数来包裹，以便使用try/catch
    (async () => {
      try {
        await handleInitiateAuth();
        console.log('认证流程成功启动。');
        sendResponse({ success: true });
      } catch (error) {
        console.error('认证流程启动失败:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 这里可以添加其他内部消息的处理
});

async function handleInitiateAuth() {
  console.log('开始处理认证流程 (handleInitiateAuth)...');
  
  // 1. 构造Supabase OAuth URL，使用chromiumapp.org重定向
  console.log('步骤1: 构造Supabase OAuth URL...');
  const extensionId = chrome.runtime.id;
  console.log('当前扩展ID:', extensionId);
  
  const redirectUri = `https://${extensionId}.chromiumapp.org/provider_cb`;
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectUri)}`;
  console.log('构造的认证URL:', authUrl);
  console.log('重定向URI:', redirectUri);

  // 2. 使用chrome.identity.launchWebAuthFlow启动认证
  console.log('步骤2: 调用 chrome.identity.launchWebAuthFlow...');
  const redirectUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        console.error('launchWebAuthFlow 错误:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else if (responseUrl) {
        console.log('launchWebAuthFlow 成功，返回URL:', responseUrl);
        resolve(responseUrl);
      } else {
        console.warn('认证流程被取消或失败，未返回URL。');
        reject(new Error('用户取消了登录。'));
      }
    });
  });
  
  console.log('OAuth 成功，重定向URL:', redirectUrl);

  // 3. 从重定向URL中提取token
  console.log('步骤3: 从重定向URL中提取token...');
  const hash = new URL(redirectUrl).hash;
  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token) {
    throw new Error('重定向URL中未找到access_token');
  }

  // 4. 将token发送到后端以换取应用JWT
  console.log('步骤4: 将token发送到后端以处理...');
  const processResponse = await fetch(`${API_BASE_URL}/auth/github/process-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_token, refresh_token })
  });

  const processResult = await processResponse.json();

  if (!processResult.success) {
    throw new Error(processResult.error || '后端处理token失败');
  }

  console.log('后端处理成功，获取到应用token和用户信息:', processResult.data);
  
  // 5. 调用handleOAuthSuccess将最终信息存入storage
  console.log('步骤5: 将最终认证信息存入storage...');
  await handleOAuthSuccess(processResult.data);
}


// OAuth成功处理 - 将最终信息存入storage
async function handleOAuthSuccess(authData: { token: string; user: any }) {
  if (!authData || !authData.token || !authData.user) {
    throw new Error('无效的认证数据');
  }
  
  console.log('Background正在保存最终的认证信息:', authData);
  
  // 这会触发popup中的onChanged监听器
  await chrome.storage.local.set({
    'oauth_success': authData,
    'auth_token': authData.token,
    'user_info': authData.user,
  });
  
  await chrome.storage.sync.set({
    'isLoggedIn': true,
    'userProfile': authData.user
  });

  console.log('认证数据已成功保存到storage');
}

// 确保作为模块导出
export {};