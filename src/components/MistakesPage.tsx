import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
import './MistakesPage.css';

interface ErrorBookItem {
  id: string;
  practiceSessionId: string;
  originalName: string;
  category: string;
  addedAt: string;
  score?: number;
  ocrText?: string;
  knowledgePoints?: string[];
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  tags?: string[];
  notes?: string;
}

interface ErrorBookCategory {
  name: string;
  items: ErrorBookItem[];
  count: number;
}

interface MistakesPageProps {
  authState: AuthState;
}

export const MistakesPage: React.FC<MistakesPageProps> = ({ authState }) => {
  const [errorBookItems, setErrorBookItems] = useState<ErrorBookItem[]>([]);
  const [categories, setCategories] = useState<ErrorBookCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadErrorBookItems();
  }, [authState.token]);

  useEffect(() => {
    organizeCategories();
  }, [errorBookItems]);

  const loadErrorBookItems = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setError('');
      
      // 加载错题列表
      const response = await fetch(`${API_BASE_URL}/mistakes/items`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 转换API数据格式到组件期望的格式
          const items: ErrorBookItem[] = result.data.items.map((item: any) => ({
            id: item.id.toString(),
            practiceSessionId: item.submission.id.toString(),
            originalName: item.title || item.submission.fileUpload?.originalName || '未命名',
            category: item.category?.name || '未分类',
            addedAt: item.createdAt,
            score: item.submission.deepseekResults?.[0]?.score,
            ocrText: item.submission.mathpixResults?.[0]?.recognizedText,
            knowledgePoints: [], // 暂时为空，后续可从AI结果中提取
            difficulty: item.priority === 'high' ? 'HARD' : (item.priority === 'medium' ? 'MEDIUM' : 'EASY'),
            tags: item.tags,
            notes: item.notes
          }));
          
          setErrorBookItems(items);
        } else {
          setError(result.error || '加载错题本失败');
        }
      } else {
        const errorResult = await response.json();
        setError(errorResult.error || '加载错题本失败');
      }
    } catch (err) {
      console.error('加载错题本失败:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const organizeCategories = () => {
    const categoryMap = new Map<string, ErrorBookItem[]>();
    
    errorBookItems.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, []);
      }
      categoryMap.get(item.category)!.push(item);
    });

    const organizedCategories: ErrorBookCategory[] = Array.from(categoryMap.entries()).map(([name, items]) => ({
      name,
      items,
      count: items.length
    }));

    setCategories(organizedCategories);
  };

  const filteredItems = () => {
    let filtered = errorBookItems;

    // 分类筛选
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.originalName.toLowerCase().includes(query) ||
        item.ocrText?.toLowerCase().includes(query) ||
        item.knowledgePoints?.some(point => point.toLowerCase().includes(query)) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY': return '#10b981';
      case 'MEDIUM': return '#f59e0b';
      case 'HARD': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getDifficultyLabel = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY': return '简单';
      case 'MEDIUM': return '中等';
      case 'HARD': return '困难';
      default: return '未评估';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !authState.token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/mistakes/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: '用户创建的错题分类'
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setShowCreateCategoryModal(false);
        setNewCategoryName('');
        // 重新加载错题数据以更新分类
        loadErrorBookItems();
      } else {
        setError(result.error || '创建分类失败');
      }
    } catch (err) {
      console.error('创建分类失败:', err);
      setError('创建分类失败');
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    if (!authState.token) return;
    
    try {
      // 首先需要获取分类ID（简化实现，实际应该在加载时存储ID映射）
      // 这里暂时不实现删除分类，因为需要先获取分类列表来获得ID
      setError('删除分类功能正在开发中');
      setShowDeleteCategoryModal('');
    } catch (err) {
      console.error('删除分类失败:', err);
      setError('删除分类失败');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!authState.token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/mistakes/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // 从本地状态中移除已删除的错题
        setErrorBookItems(prev => prev.filter(item => item.id !== itemId));
      } else {
        setError(result.error || '删除错题失败');
      }
    } catch (err) {
      console.error('删除错题失败:', err);
      setError('删除错题失败');
    }
  };

  if (loading) {
    return (
      <div className="mistakes-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载错题本中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mistakes-page">
      <div className="page-header">
        <div className="header-content">
          <h1>📚 错题本</h1>
          <p>整理和复习你的错题，提升学习效率</p>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowCreateCategoryModal(true)}
          >
            <span className="btn-icon">📁</span>
            新建分类
          </button>
          <div className="view-mode-toggle">
            <button
              className={`mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <span>⊞</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <span>☰</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="mistakes-content">
        <div className="sidebar">
          <div className="search-section">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索错题..."
              className="search-input"
            />
          </div>

          <div className="categories-section">
            <h3>分类</h3>
            <div className="category-list">
              <button
                className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                <span className="category-icon">📝</span>
                <span className="category-name">全部错题</span>
                <span className="category-count">{errorBookItems.length}</span>
              </button>
              {categories.map(category => (
                <div key={category.name} className="category-item-wrapper">
                  <button
                    className={`category-item ${selectedCategory === category.name ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    <span className="category-icon">📁</span>
                    <span className="category-name">{category.name}</span>
                    <span className="category-count">{category.count}</span>
                  </button>
                  <button
                    className="delete-category-btn"
                    onClick={() => setShowDeleteCategoryModal(category.name)}
                    title="删除分类"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="main-content">
          {filteredItems().length > 0 ? (
            <div className={`mistakes-grid ${viewMode}`}>
              {filteredItems().map(item => (
                <div key={item.id} className="mistake-card">
                  <div className="card-header">
                    <div className="mistake-title">
                      <h3>{item.originalName}</h3>
                      <div className="mistake-meta">
                        <span className="category-tag">{item.category}</span>
                        {item.difficulty && (
                          <span 
                            className="difficulty-badge"
                            style={{ color: getDifficultyColor(item.difficulty) }}
                          >
                            {getDifficultyLabel(item.difficulty)}
                          </span>
                        )}
                        {item.score !== undefined && (
                          <span 
                            className="score-badge"
                            style={{ color: getScoreColor(item.score) }}
                          >
                            {item.score}分
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="delete-item-btn"
                      onClick={() => handleDeleteItem(item.id)}
                      title="删除错题"
                    >
                      🗑️
                    </button>
                  </div>

                  {item.ocrText && (
                    <div className="ocr-content">
                      <MathPixMarkdownRenderer
                        content={item.ocrText}
                        className="preview compact"
                        maxLength={200}
                      />
                    </div>
                  )}

                  {item.knowledgePoints && item.knowledgePoints.length > 0 && (
                    <div className="knowledge-points">
                      <h5>知识点</h5>
                      <div className="knowledge-tags">
                        {item.knowledgePoints.map((point, index) => (
                          <span key={index} className="knowledge-tag">
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="item-tags">
                      {item.tags.map((tag, index) => (
                        <span key={index} className="item-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <div className="item-notes">
                      <h5>笔记</h5>
                      <p>{item.notes}</p>
                    </div>
                  )}

                  <div className="card-footer">
                    <span className="added-time">
                      {new Date(item.addedAt).toLocaleDateString('zh-CN')}
                    </span>
                    <button className="review-btn">
                      复习
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <h3>
                {selectedCategory === 'all' && !searchQuery ? 
                  '错题本是空的' : 
                  '没有找到相关错题'
                }
              </h3>
              <p>
                {selectedCategory === 'all' && !searchQuery ? 
                  '完成练习后，将错题添加到错题本进行复习' :
                  '尝试调整筛选条件或搜索关键词'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 创建分类模态框 */}
      {showCreateCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>新建分类</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateCategoryModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label>分类名称：</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称"
                className="category-name-input"
              />
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowCreateCategoryModal(false)}
              >
                取消
              </button>
              <button 
                className="confirm-btn"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除分类确认模态框 */}
      {showDeleteCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>删除分类</h3>
            </div>
            <div className="modal-body">
              <p>确定要删除分类"{showDeleteCategoryModal}"吗？</p>
              <p className="warning-text">此操作将删除该分类下的所有错题，且不可撤销。</p>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowDeleteCategoryModal('')}
              >
                取消
              </button>
              <button 
                className="delete-btn"
                onClick={() => handleDeleteCategory(showDeleteCategoryModal)}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};