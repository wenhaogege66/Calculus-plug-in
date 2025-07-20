// Chrome插件侧边栏界面脚本
import { HomeworkUpload } from '../student/components/HomeworkUpload';
import { apiService } from '../common/services/api';

document.addEventListener('DOMContentLoaded', function() {
  console.log('侧边栏界面已加载');

  // 获取DOM元素
  const uploadArea = document.getElementById('uploadArea') as HTMLElement;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
  const pasteBtn = document.getElementById('pasteBtn') as HTMLButtonElement;
  const status = document.getElementById('status') as HTMLElement;
  const progress = document.getElementById('progress') as HTMLElement;
  const progressBar = document.getElementById('progressBar') as HTMLElement;
  const resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
  const resultsSection = document.getElementById('resultsSection') as HTMLElement;

  // 标签页元素
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // 状态管理
  let isProcessing = false;
  let currentResults: any[] = [];
  let homeworkUpload: HomeworkUpload | null = null;

  // 初始化
  function init() {
    initEventListeners();
    initStudentComponents();
    loadRecentResults();
    checkUserStatus();
  }

  // 初始化学生端组件
  function initStudentComponents() {
    // 检查是否是学生模式（这里可以根据用户角色判断）
    const uploadTab = document.getElementById('upload-tab');
    if (uploadTab) {
      // 清空原有内容，使用新的HomeworkUpload组件
      uploadTab.innerHTML = '<div id="homework-upload-container"></div>';
      
      const container = document.getElementById('homework-upload-container');
      if (container) {
        homeworkUpload = new HomeworkUpload(container);
        
        // 设置回调
        homeworkUpload.setCallbacks({
          onProgress: (progress) => {
            console.log('上传进度:', progress);
            // 可以在这里更新侧边栏的进度显示
          },
          onComplete: (submission) => {
            console.log('上传完成:', submission);
            // 切换到结果标签页并显示结果
            switchTab('results');
            addResultToDisplay(submission);
          },
          onError: (error) => {
            console.error('上传错误:', error);
            showStatus(error, 'error');
          }
        });

        // 加载历史记录
        homeworkUpload.loadHistory();
      }
    }
  }

  // 初始化事件监听
  function initEventListeners() {
    // 标签页切换
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab') || 'upload'));
    });

    // 防止默认拖拽行为（由HomeworkUpload组件处理具体的拖拽逻辑）
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
  }

  // 文件处理逻辑已移至HomeworkUpload组件

  // 添加结果到显示区域
  function addResultToDisplay(submission: any) {
    // 隐藏空状态
    const emptyState = resultsContainer.querySelector('.empty-state') as HTMLElement;
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // 显示结果区域
    resultsSection.style.display = 'block';

    // 创建结果项
    const resultItem = createResultItem(submission);
    resultsContainer.insertBefore(resultItem, resultsContainer.firstChild);

    // 保存到当前结果数组
    currentResults.unshift(submission);

    // 限制显示数量
    if (currentResults.length > 10) {
      const lastItem = resultsContainer.lastElementChild;
      if (lastItem && !lastItem.classList.contains('empty-state')) {
        lastItem.remove();
        currentResults.pop();
      }
    }
  }

  // 创建结果项HTML
  function createResultItem(submission: any): HTMLElement {
    const item = document.createElement('div');
    item.className = 'result-item';
    
    const score = submission.deepseekResult?.score || 0;
    const scoreColor = score >= 80 ? '#4caf50' : score >= 60 ? '#ff9800' : '#f44336';

    item.innerHTML = `
      <div class="result-header">
        <div class="result-title">${submission.fileUpload?.originalName || '未知文件'}</div>
        <div class="result-score" style="color: ${scoreColor}">${score}分</div>
      </div>
      <div class="result-content">
        ${submission.myScriptResult?.text ? `
          <div class="math-expression">
            <strong>识别内容:</strong><br>
            ${submission.myScriptResult.text}
          </div>
        ` : ''}
        
        ${submission.deepseekResult?.errors && submission.deepseekResult.errors.length > 0 ? `
          <div class="error-highlight">
            <strong>发现错误:</strong><br>
            ${submission.deepseekResult.errors.map((error: any) => `• ${error.description}`).join('<br>')}
          </div>
        ` : ''}
        
        ${submission.deepseekResult?.suggestions && submission.deepseekResult.suggestions.length > 0 ? `
          <div class="suggestion">
            <strong>改进建议:</strong><br>
            ${submission.deepseekResult.suggestions.map((suggestion: any) => `• ${suggestion}`).join('<br>')}
          </div>
        ` : ''}
        
        <div style="margin-top: 10px; font-size: 12px; color: #999;">
          ${new Date(submission.submittedAt || Date.now()).toLocaleString()}
        </div>
      </div>
    `;

    return item;
  }

  // 标签页切换
  function switchTab(tabName: string) {
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      }
    });

    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      }
    });
  }

  // 加载最近结果
  async function loadRecentResults() {
    try {
      const response = await apiService.getSubmissions({ limit: 10 });

      if (response.success && response.data && response.data.submissions.length > 0) {
        response.data.submissions.forEach((submission: any) => addResultToDisplay(submission));
      }
    } catch (error) {
      console.error('加载最近结果失败:', error);
    }
  }

  // 检查用户状态
  async function checkUserStatus() {
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        showStatus(`欢迎回来，${response.data.username || '用户'}！`, 'success');
      } else {
        showStatus('欢迎使用AI微积分助教', 'info');
      }
    } catch (error) {
      console.error('检查用户状态失败:', error);
      showStatus('欢迎使用AI微积分助教', 'info');
    }
  }

  // 显示状态信息
  function showStatus(message: string, type: 'success' | 'error' | 'info' = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    // 自动隐藏（错误信息保持显示）
    if (type !== 'error') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }

  // 启动初始化
  init();
  console.log('侧边栏界面初始化完成');
}); 