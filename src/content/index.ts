// Chrome插件Content Script - 页面注入脚本

console.log('AI微积分助教Content Script已加载');

// 在页面中注入浮动按钮
function injectFloatingButton() {
  // 检查是否已存在按钮
  if (document.getElementById('calculus-ai-floating-btn')) {
    return;
  }

  const floatingBtn = document.createElement('div');
  floatingBtn.id = 'calculus-ai-floating-btn';
  floatingBtn.innerHTML = `
    <div class="calculus-ai-btn">
      <span>📚</span>
      <span>AI助教</span>
    </div>
  `;

  // 添加样式
  floatingBtn.style.cssText = `
    position: fixed;
    top: 50%;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 25px;
    padding: 12px 16px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    user-select: none;
  `;

  // 悬停效果
  floatingBtn.addEventListener('mouseenter', () => {
    floatingBtn.style.transform = 'scale(1.05)';
    floatingBtn.style.boxShadow = '0 6px 25px rgba(0,0,0,0.4)';
  });

  floatingBtn.addEventListener('mouseleave', () => {
    floatingBtn.style.transform = 'scale(1)';
    floatingBtn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  });

  // 点击事件
  floatingBtn.addEventListener('click', () => {
    openSidePanel();
  });

  document.body.appendChild(floatingBtn);
}

// 打开侧边栏
function openSidePanel() {
  chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (response: any) => {
    if (response && response.success) {
      console.log('侧边栏已打开');
    }
  });
}

// 检测数学内容
function detectMathContent() {
  const mathSelectors = [
    '.math', '.equation', '.formula',
    '[class*="math"]', '[class*="equation"]', '[class*="formula"]',
    'script[type="math/tex"]', '.MathJax', '.katex'
  ];

  const mathElements = document.querySelectorAll(mathSelectors.join(','));
  
  if (mathElements.length > 0) {
    console.log(`检测到 ${mathElements.length} 个数学元素`);
    // 可以在这里添加数学内容高亮等功能
    highlightMathElements(mathElements);
  }
}

// 高亮数学元素
function highlightMathElements(elements: NodeListOf<Element>) {
  elements.forEach((element, index) => {
    // 添加hover效果
    (element as HTMLElement).addEventListener('mouseenter', () => {
      (element as HTMLElement).style.outline = '2px solid #667eea';
      (element as HTMLElement).style.outlineOffset = '2px';
      showMathTooltip(element as HTMLElement, `数学表达式 ${index + 1}`);
    });

    (element as HTMLElement).addEventListener('mouseleave', () => {
      (element as HTMLElement).style.outline = '';
      (element as HTMLElement).style.outlineOffset = '';
      hideMathTooltip();
    });
  });
}

// 显示数学提示框
function showMathTooltip(element: HTMLElement, text: string) {
  // 移除已存在的提示框
  hideMathTooltip();

  const tooltip = document.createElement('div');
  tooltip.id = 'calculus-ai-tooltip';
  tooltip.textContent = text;
  
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: Arial, sans-serif;
    z-index: 10001;
    pointer-events: none;
    white-space: nowrap;
  `;

  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = (rect.top - 35) + 'px';

  document.body.appendChild(tooltip);
}

// 隐藏数学提示框
function hideMathTooltip() {
  const tooltip = document.getElementById('calculus-ai-tooltip');
  if (tooltip) {
    tooltip.remove();
  }
}

// 处理文件拖拽
function setupFileDrop() {
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer!.files);
    const supportedFiles = files.filter(file => {
      const types = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png'];
      return types.indexOf(file.type) !== -1;
    });

    if (supportedFiles.length > 0) {
      showDropFeedback(`检测到 ${supportedFiles.length} 个支持的文件`);
      // 发送文件到background script处理
      handleDroppedFiles(supportedFiles);
    } else {
      showDropFeedback('不支持的文件类型', 'error');
    }
  });
}

// 处理拖拽的文件
function handleDroppedFiles(files: File[]) {
  files.forEach(file => {
    chrome.runtime.sendMessage({
      type: 'UPLOAD_FILE',
      data: { file, type: 'drop' }
    }, (response: any) => {
      if (response && response.success) {
        showDropFeedback(`${file.name} 上传成功`, 'success');
      } else {
        showDropFeedback(`${file.name} 上传失败`, 'error');
      }
    });
  });
}

// 显示拖拽反馈
function showDropFeedback(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10002;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
    ${type === 'success' ? 'background: #4caf50; color: white;' : ''}
    ${type === 'error' ? 'background: #f44336; color: white;' : ''}
    ${type === 'info' ? 'background: #2196f3; color: white;' : ''}
  `;
  
  feedback.textContent = message;
  document.body.appendChild(feedback);

  // 3秒后自动消失
  setTimeout(() => {
    feedback.style.opacity = '0';
    feedback.style.transform = 'translateX(100%)';
    setTimeout(() => feedback.remove(), 300);
  }, 3000);
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  console.log('Content Script收到消息:', message);

  switch (message.type) {
    case 'DETECT_MATH':
      detectMathContent();
      sendResponse({ success: true });
      break;

    case 'HIGHLIGHT_ELEMENT':
      // 高亮指定元素
      const element = document.querySelector(message.selector);
      if (element) {
        (element as HTMLElement).style.outline = '3px solid #ff9800';
        (element as HTMLElement).style.outlineOffset = '2px';
        setTimeout(() => {
          (element as HTMLElement).style.outline = '';
          (element as HTMLElement).style.outlineOffset = '';
        }, 3000);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Element not found' });
      }
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

// 初始化
function init() {
  // 等待页面完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 1000);
    });
    return;
  }

  console.log('初始化AI微积分助教Content Script');
  
  // 注入浮动按钮
  injectFloatingButton();
  
  // 检测数学内容
  detectMathContent();
  
  // 设置文件拖拽
  setupFileDrop();

  // 监听页面变化 (SPA应用)
  const observer = new MutationObserver(() => {
    detectMathContent();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('AI微积分助教Content Script初始化完成');
}

// 启动
init(); 