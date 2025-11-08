// AI微积分助教 - Plasmo Background Script

// 直接定义API_BASE_URL和Supabase配置，避免复杂的import路径问题  
const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL;


// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
});

// 监听来自Popup等内部组件的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  
  if (message.type === 'INITIATE_AUTH') {
    // 使用一个立即执行的异步函数来包裹，以便使用try/catch
    (async () => {
      try {
        await handleInitiateAuth();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 这里可以添加其他内部消息的处理
});

async function handleInitiateAuth() {
  
  // 1. 构造Supabase OAuth URL，使用chromiumapp.org重定向
  const extensionId = chrome.runtime.id;
  
  const redirectUri = `https://${extensionId}.chromiumapp.org/provider_cb`;
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectUri)}`;

  // 2. 使用chrome.identity.launchWebAuthFlow启动认证
  const redirectUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (responseUrl) {
        resolve(responseUrl);
      } else {
        reject(new Error('用户取消了登录。'));
      }
    });
  });
  

  // 3. 从重定向URL中提取token
  const hash = new URL(redirectUrl).hash;
  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token) {
    throw new Error('重定向URL中未找到access_token');
  }

  // 4. 将token发送到后端以换取应用JWT
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

  
  // 5. 调用handleOAuthSuccess将最终信息存入storage
  await handleOAuthSuccess(processResult.data);
}


// OAuth成功处理 - 将最终信息存入storage
async function handleOAuthSuccess(authData: { token: string; user: any }) {
  if (!authData || !authData.token || !authData.user) {
    throw new Error('无效的认证数据');
  }
  
  
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

}

// 确保作为模块导出
export {};