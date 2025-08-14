import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { SimpleMarkdownRenderer } from './SimpleMarkdownRenderer';
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
      // 这里后续需要实现API调用
      // 暂时使用模拟数据
      const mockData: ErrorBookItem[] = [
        {
          id: '1',
          practiceSessionId: 'session-1',
          originalName: '极限计算练习.pdf',
          category: '极限问题',
          addedAt: '2024-01-15T10:30:00Z',
          score: 65,
          ocrText: '计算 $\\lim_{x \\to 0} \\frac{\\sin x}{x}$ 的值',
          knowledgePoints: ['极限定义', '重要极限'],
          difficulty: 'MEDIUM',
          tags: ['三角函数', '基础极限'],
          notes: '需要记住重要极限公式'
        },
        {
          id: '2',
          practiceSessionId: 'session-2',
          originalName: '导数应用题.pdf',
          category: '微分基础',
          addedAt: '2024-01-16T14:20:00Z',
          score: 45,
          ocrText: '求函数 $f(x) = x^3 - 3x^2 + 2x$ 的单调区间',
          knowledgePoints: ['导数计算', '函数单调性'],
          difficulty: 'HARD',
          tags: ['导数应用', '单调性'],
          notes: '需要注意导数为0的点不一定是极值点'
        }
      ];
      setErrorBookItems(mockData);
    } catch (err) {
      console.error('加载错题本失败:', err);
      setError('加载错题本失败');
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
    if (!newCategoryName.trim()) return;

    try {
      // 这里后续需要实现API调用
      setShowCreateCategoryModal(false);
      setNewCategoryName('');
    } catch (err) {
      setError('创建分类失败');
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    try {
      // 这里后续需要实现API调用
      setShowDeleteCategoryModal('');
    } catch (err) {
      setError('删除分类失败');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      // 这里后续需要实现API调用
      setErrorBookItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
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
                      <SimpleMarkdownRenderer 
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