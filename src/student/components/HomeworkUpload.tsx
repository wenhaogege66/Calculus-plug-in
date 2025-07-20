// 学生端作业上传组件

import { apiService } from '../../common/services/api';
import { Submission, FileUpload, UploadProgress } from '../../common/types';

export class HomeworkUpload {
  private container: HTMLElement;
  private onUploadProgress?: (progress: UploadProgress) => void;
  private onUploadComplete?: (submission: Submission) => void;
  private onUploadError?: (error: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  // 设置事件回调
  setCallbacks(callbacks: {
    onProgress?: (progress: UploadProgress) => void;
    onComplete?: (submission: Submission) => void;
    onError?: (error: string) => void;
  }) {
    this.onUploadProgress = callbacks.onProgress;
    this.onUploadComplete = callbacks.onComplete;
    this.onUploadError = callbacks.onError;
  }

  private init() {
    this.render();
    this.bindEvents();
  }

  private render() {
    this.container.innerHTML = `
      <div class="homework-upload">
        <div class="upload-header">
          <h2>📝 上传作业</h2>
          <p>支持PDF、TXT、JPG、PNG格式，最大10MB</p>
        </div>

        <div class="upload-area" id="uploadArea">
          <div class="upload-icon">📄</div>
          <div class="upload-text">点击选择文件或拖拽到这里</div>
          <div class="upload-hint">支持多文件同时上传</div>
        </div>

        <input type="file" id="fileInput" multiple accept=".pdf,.txt,.jpg,.jpeg,.png" style="display: none;">

        <div class="upload-actions">
          <button class="btn btn-primary" id="selectFilesBtn">选择文件</button>
          <button class="btn btn-secondary" id="pasteBtn">粘贴图片</button>
        </div>

        <div class="upload-progress" id="progressSection" style="display: none;">
          <div class="progress-header">
            <span id="progressText">准备上传...</span>
            <span id="progressPercent">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
        </div>

        <div class="upload-history" id="uploadHistory">
          <h3>📋 最近上传</h3>
          <div class="history-list" id="historyList">
            <div class="empty-state">
              <p>还没有上传记录</p>
            </div>
          </div>
        </div>
      </div>

      <style>
        .homework-upload {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .upload-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .upload-header h2 {
          font-size: 24px;
          color: #333;
          margin-bottom: 8px;
        }

        .upload-header p {
          color: #666;
          font-size: 14px;
        }

        .upload-area {
          border: 2px dashed #ddd;
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 20px;
          background: #fafbfc;
        }

        .upload-area:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .upload-area.dragover {
          border-color: #667eea;
          background: #f0f2ff;
          transform: scale(1.02);
        }

        .upload-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .upload-text {
          font-size: 16px;
          color: #333;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .upload-hint {
          font-size: 12px;
          color: #999;
        }

        .upload-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 30px;
        }

        .btn {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }

        .btn-primary:hover {
          background: #5a6fd8;
        }

        .btn-secondary {
          background: #f8f9fa;
          color: #333;
          border: 1px solid #dee2e6;
        }

        .btn-secondary:hover {
          background: #e9ecef;
        }

        .upload-progress {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progress-bar {
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          width: 0%;
          transition: width 0.3s ease;
        }

        .upload-history {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .upload-history h3 {
          font-size: 16px;
          color: #333;
          margin-bottom: 15px;
        }

        .history-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .history-item {
          display: flex;
          align-items: center;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          background: #f8f9fa;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .history-item:hover {
          background: #e9ecef;
        }

        .history-icon {
          font-size: 20px;
          margin-right: 12px;
        }

        .history-info {
          flex: 1;
        }

        .history-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .history-time {
          font-size: 12px;
          color: #666;
        }

        .history-status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-completed {
          background: #d4edda;
          color: #155724;
        }

        .status-processing {
          background: #fff3cd;
          color: #856404;
        }

        .status-failed {
          background: #f8d7da;
          color: #721c24;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }
      </style>
    `;
  }

  private bindEvents() {
    const uploadArea = this.container.querySelector('#uploadArea') as HTMLElement;
    const fileInput = this.container.querySelector('#fileInput') as HTMLInputElement;
    const selectFilesBtn = this.container.querySelector('#selectFilesBtn') as HTMLButtonElement;
    const pasteBtn = this.container.querySelector('#pasteBtn') as HTMLButtonElement;

    // 文件选择
    selectFilesBtn.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

    // 粘贴上传
    pasteBtn.addEventListener('click', () => this.handlePasteClick());
    document.addEventListener('paste', (e) => this.handlePaste(e));

    // 防止页面默认拖拽行为
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
  }

  private handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      this.processFiles(Array.from(files));
    }
  }

  private handleDragOver(event: DragEvent) {
    event.preventDefault();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.add('dragover');
  }

  private handleDragLeave(event: DragEvent) {
    event.preventDefault();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('dragover');
  }

  private handleDrop(event: DragEvent) {
    event.preventDefault();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(Array.from(files));
    }
  }

  private handlePasteClick() {
    alert('请使用 Ctrl+V 或 Cmd+V 粘贴图片');
  }

  private handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          this.processFiles([file]);
        }
        break;
      }
    }
  }

  private async processFiles(files: File[]) {
    // 验证文件
    const validFiles = this.validateFiles(files);
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      await this.processFile(file);
    }
  }

  private validateFiles(files: File[]): File[] {
    const supportedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    return files.filter(file => {
      if (supportedTypes.indexOf(file.type) === -1) {
        this.showError(`不支持的文件类型: ${file.name}`);
        return false;
      }
      if (file.size > maxSize) {
        this.showError(`文件过大: ${file.name}`);
        return false;
      }
      return true;
    });
  }

  private async processFile(file: File) {
    try {
      this.showProgress({ 
        loaded: 0, 
        total: 100, 
        percentage: 0, 
        stage: 'upload', 
        message: `正在上传 ${file.name}...` 
      });

      // 1. 上传文件
      const uploadResult = await apiService.uploadFile(file);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '上传失败');
      }

      this.showProgress({ 
        loaded: 25, 
        total: 100, 
        percentage: 25, 
        stage: 'ocr', 
        message: '正在识别数学表达式...' 
      });

      // 2. 创建提交记录
      const submissionResult = await apiService.createSubmission({
        fileUploadId: uploadResult.data!.id
      });

      if (!submissionResult.success) {
        throw new Error(submissionResult.error || '创建提交失败');
      }

      this.showProgress({ 
        loaded: 50, 
        total: 100, 
        percentage: 50, 
        stage: 'ocr', 
        message: '正在OCR识别...' 
      });

      // 3. MyScript OCR处理
      const ocrResult = await apiService.processWithMyScript(uploadResult.data!.id);
      if (!ocrResult.success) {
        throw new Error(ocrResult.error || 'OCR识别失败');
      }

      this.showProgress({ 
        loaded: 75, 
        total: 100, 
        percentage: 75, 
        stage: 'grading', 
        message: '正在AI批改...' 
      });

      // 4. Deepseek AI批改
      const gradingResult = await apiService.processWithDeepseek({
        recognizedContent: ocrResult.data.text,
        originalFileId: uploadResult.data!.id
      });

      if (!gradingResult.success) {
        throw new Error(gradingResult.error || 'AI批改失败');
      }

      this.showProgress({ 
        loaded: 100, 
        total: 100, 
        percentage: 100, 
        stage: 'saving', 
        message: '处理完成！' 
      });

      // 5. 更新提交记录
      const finalSubmission = await apiService.updateSubmission(
        submissionResult.data!.id,
        {
          myScriptResult: ocrResult.data,
          deepseekResult: gradingResult.data,
          status: 'completed',
          completedAt: new Date().toISOString()
        }
      );

      if (finalSubmission.success && this.onUploadComplete) {
        this.onUploadComplete(finalSubmission.data!);
      }

      // 添加到历史记录
      this.addToHistory(finalSubmission.data!);
      
      // 隐藏进度条
      setTimeout(() => this.hideProgress(), 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '处理失败';
      
      // 检查是否是网络连接错误（后端未部署）
      if (errorMessage.includes('网络请求失败') || errorMessage.includes('Failed to fetch')) {
        this.showError('后端服务还未部署，目前只能预览界面功能。请等待后端API开发完成。');
      } else {
        this.showError(`处理失败: ${errorMessage}`);
      }
      
      this.hideProgress();
    }
  }

  private showProgress(progress: UploadProgress) {
    const progressSection = this.container.querySelector('#progressSection') as HTMLElement;
    const progressText = this.container.querySelector('#progressText') as HTMLElement;
    const progressPercent = this.container.querySelector('#progressPercent') as HTMLElement;
    const progressFill = this.container.querySelector('#progressFill') as HTMLElement;

    progressSection.style.display = 'block';
    progressText.textContent = progress.message;
    progressPercent.textContent = `${Math.round(progress.percentage)}%`;
    progressFill.style.width = `${progress.percentage}%`;

    if (this.onUploadProgress) {
      this.onUploadProgress(progress);
    }
  }

  private hideProgress() {
    const progressSection = this.container.querySelector('#progressSection') as HTMLElement;
    progressSection.style.display = 'none';
  }

  private showError(message: string) {
    console.error(message);
    if (this.onUploadError) {
      this.onUploadError(message);
    }
  }

  private addToHistory(submission: Submission) {
    const historyList = this.container.querySelector('#historyList') as HTMLElement;
    const emptyState = historyList.querySelector('.empty-state');
    
    if (emptyState) {
      emptyState.remove();
    }

    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const statusClass = `status-${submission.status}`;
    const statusText = submission.status === 'completed' ? '已完成' : 
                     submission.status === 'processing' ? '处理中' : '失败';

    historyItem.innerHTML = `
      <div class="history-icon">📄</div>
      <div class="history-info">
        <div class="history-name">${submission.fileUpload.originalName}</div>
        <div class="history-time">${new Date(submission.submittedAt).toLocaleString()}</div>
      </div>
      <div class="history-status ${statusClass}">${statusText}</div>
    `;

    historyItem.addEventListener('click', () => {
      if (submission.status === 'completed' && this.onUploadComplete) {
        this.onUploadComplete(submission);
      }
    });

    historyList.insertBefore(historyItem, historyList.firstChild);

    // 限制历史记录数量
    const items = historyList.querySelectorAll('.history-item');
    if (items.length > 10) {
      items[items.length - 1].remove();
    }
  }

  // 加载历史记录
  async loadHistory() {
    try {
      const result = await apiService.getSubmissions({ limit: 10 });
      if (result.success && result.data && result.data.submissions.length > 0) {
        const historyList = this.container.querySelector('#historyList') as HTMLElement;
        const emptyState = historyList.querySelector('.empty-state');
        
        if (emptyState) {
          emptyState.remove();
        }

        result.data.submissions.forEach(submission => this.addToHistory(submission));
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }
} 