// OAuth回调处理脚本
async function handleAuth() {
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('result');
  
  try {
    console.log('开始处理OAuth回调...');
    console.log('当前URL:', window.location.href);
    console.log('URL Hash:', window.location.hash);
    console.log('URL Search:', window.location.search);
    
    // Supabase OAuth 回调处理
    // Supabase可能在URL的search参数或hash中包含认证信息
    let access_token = null;
    let refresh_token = null;
    
    // 方法1: 检查URL hash中的token (直接OAuth)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    access_token = hashParams.get('access_token');
    refresh_token = hashParams.get('refresh_token');
    
    // 方法2: 检查URL search参数中的token (Supabase回调)
    if (!access_token) {
      const searchParams = new URLSearchParams(window.location.search);
      access_token = searchParams.get('access_token');
      refresh_token = searchParams.get('refresh_token');
      
      // Supabase有时使用不同的参数名
      if (!access_token) {
        access_token = searchParams.get('token');
      }
    }
    
    // 方法3: 检查是否是Supabase session回调
    if (!access_token) {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      
      if (code) {
        console.log('检测到Supabase authorization code:', code);
        
        // 使用authorization code换取session
        try {
          const supabaseResponse = await fetch('/api/auth/github/exchange-code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, state })
          });
          
          const supabaseResult = await supabaseResponse.json();
          
          if (supabaseResult.success) {
            access_token = supabaseResult.data.access_token;
            refresh_token = supabaseResult.data.refresh_token;
            console.log('成功从authorization code获取token');
          } else {
            throw new Error(supabaseResult.error || 'Code exchange失败');
          }
        } catch (error) {
          console.error('Code exchange失败:', error);
          throw error;
        }
      }
    }
    
    console.log('提取的tokens:', { access_token: access_token ? 'exists' : 'missing', refresh_token: refresh_token ? 'exists' : 'missing' });
    
    if (!access_token) {
      throw new Error('未找到访问令牌。URL参数: ' + window.location.search + ', Hash: ' + window.location.hash);
    }
    
    // 使用token处理认证
    console.log('发送token到后端处理...');
    const response = await fetch('/api/auth/github/process-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: access_token,
        refresh_token: refresh_token
      })
    });

    const result = await response.json();
    console.log('后端处理结果:', result);
    
    if (result.success) {
      statusDiv.style.display = 'none';
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = 
        '<div class="success">' +
          '<h2>✅ 登录成功！</h2>' +
          '<p>欢迎，' + result.data.user.username + '！</p>' +
          '<p>窗口将自动关闭...</p>' +
        '</div>';
      
      console.log('OAuth处理成功，准备通知扩展...', result.data);
      
      // 多重通信策略，确保至少一种方式能成功
      let communicationSuccess = false;
      
      // 方法1：Chrome Runtime消息（最可靠）
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          console.log('尝试使用chrome.runtime.sendMessage...');
          await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              type: 'GITHUB_AUTH_SUCCESS',
              data: {
                token: result.data.token,
                user: result.data.user
              }
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Runtime sendMessage错误:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else {
                console.log('Runtime消息发送成功:', response);
                communicationSuccess = true;
                resolve(response);
              }
            });
          });
        } catch (error) {
          console.error('chrome.runtime.sendMessage失败:', error);
        }
      }
      
      // 方法2：直接操作Chrome Storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          console.log('尝试直接设置Chrome Storage...');
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({
              'oauth_success': {
                token: result.data.token,
                user: result.data.user
              },
              'auth_token': result.data.token,
              'user_info': result.data.user
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Storage设置错误:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else {
                console.log('Storage设置成功');
                communicationSuccess = true;
                resolve();
              }
            });
          });
        } catch (error) {
          console.error('Chrome storage设置失败:', error);
        }
      }
      
      // 方法3：LocalStorage (备用方案)
      try {
        console.log('设置LocalStorage备用方案...');
        localStorage.setItem('oauth_auth_data', JSON.stringify({
          token: result.data.token,
          user: result.data.user,
          timestamp: Date.now()
        }));
        console.log('LocalStorage设置成功');
      } catch (error) {
        console.error('LocalStorage设置失败:', error);
      }
      
      // 方法4：Window.opener postMessage (备用方案)
      if (window.opener && window.opener.postMessage) {
        try {
          console.log('尝试window.opener.postMessage...');
          window.opener.postMessage({
            type: 'GITHUB_AUTH_SUCCESS',
            token: result.data.token,
            user: result.data.user
          }, '*');
          console.log('PostMessage发送成功');
          communicationSuccess = true;
        } catch (error) {
          console.error('PostMessage失败:', error);
        }
      }
      
      // 方法5：广播事件（最后的备用方案）
      try {
        const broadcastChannel = new BroadcastChannel('oauth-success');
        broadcastChannel.postMessage({
          type: 'GITHUB_AUTH_SUCCESS',
          token: result.data.token,
          user: result.data.user
        });
        broadcastChannel.close();
        console.log('BroadcastChannel消息发送成功');
      } catch (error) {
        console.error('BroadcastChannel失败:', error);
      }
      
      console.log('通信尝试完成，成功状态:', communicationSuccess);
      
      // 延迟关闭窗口，给通信更多时间
      setTimeout(function() {
        console.log('准备关闭OAuth窗口...');
        try {
          window.close();
        } catch (error) {
          console.error('关闭窗口失败:', error);
        }
      }, 2000); // 改为2秒，给通信更多时间
      
    } else {
      throw new Error(result.error || '登录处理失败');
    }
    
  } catch (error) {
    console.error('登录处理失败:', error);
    statusDiv.style.display = 'none';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = 
      '<div class="error">' +
        '<h2>❌ 登录失败</h2>' +
        '<p>' + error.message + '</p>' +
        '<button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭窗口</button>' +
      '</div>';
  }
}

// 页面加载时执行
window.addEventListener('load', handleAuth);