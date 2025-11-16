/**
 * ErrorHighlightedOCRText - 带错误高亮的OCR文本渲染组件
 *
 * 新版本特性：
 * - 不再依赖line、startChar、endChar定位
 * - 使用AI返回的content片段在原文中搜索并高亮
 * - 使用HTML <mark>标签配合CSS实现高亮效果
 * - 保持markdown和LaTeX的正常渲染
 */

import React, { useState, useRef, useEffect } from 'react';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
import { highlightErrorsInText, getErrorStats, type DetailedError } from '../utils/errorHighlighter';
import './ErrorHighlightedOCRText.css';

interface ErrorHighlightedOCRTextProps {
  ocrText: string;
  detailedErrors?: DetailedError[];
  className?: string;
  activeErrorIndex?: number | null;
  onErrorClick?: (errorIndex: number) => void;
}

export const ErrorHighlightedOCRText: React.FC<ErrorHighlightedOCRTextProps> = ({
  ocrText,
  detailedErrors = [],
  className = '',
  activeErrorIndex = null,
  onErrorClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredErrorIndex, setHoveredErrorIndex] = useState<number | null>(null);

  // 预处理OCR文本，添加错误高亮标记
  const highlightedText = React.useMemo(() => {
    return highlightErrorsInText(ocrText, detailedErrors);
  }, [ocrText, detailedErrors]);

  // 获取错误统计
  const errorStats = React.useMemo(() => {
    return getErrorStats(detailedErrors);
  }, [detailedErrors]);

  // 处理错误标记的点击事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMarkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const mark = target.closest('mark[data-error-index]') as HTMLElement;

      if (mark) {
        const errorIndex = parseInt(mark.getAttribute('data-error-index') || '-1');
        if (errorIndex >= 0 && onErrorClick) {
          onErrorClick(errorIndex);
        }
      }
    };

    container.addEventListener('click', handleMarkClick);
    return () => container.removeEventListener('click', handleMarkClick);
  }, [onErrorClick]);

  // 高亮当前激活的错误
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 移除所有active类
    container.querySelectorAll('mark.active').forEach(mark => {
      mark.classList.remove('active');
    });

    // 添加active类到当前激活的错误
    if (activeErrorIndex !== null) {
      const activeMark = container.querySelector(`mark[data-error-index="${activeErrorIndex}"]`);
      if (activeMark) {
        activeMark.classList.add('active');
        // 滚动到可见区域
        activeMark.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [activeErrorIndex]);

  // 处理鼠标悬停事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMarkHover = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const mark = target.closest('mark[data-error-index]') as HTMLElement;

      if (mark) {
        const errorIndex = parseInt(mark.getAttribute('data-error-index') || '-1');
        if (errorIndex >= 0) {
          setHoveredErrorIndex(errorIndex);
          mark.classList.add('hovered');
        }
      }
    };

    const handleMarkLeave = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const mark = target.closest('mark[data-error-index]') as HTMLElement;

      if (mark) {
        setHoveredErrorIndex(null);
        mark.classList.remove('hovered');
      }
    };

    container.addEventListener('mouseover', handleMarkHover);
    container.addEventListener('mouseout', handleMarkLeave);

    return () => {
      container.removeEventListener('mouseover', handleMarkHover);
      container.removeEventListener('mouseout', handleMarkLeave);
    };
  }, []);

  // 空内容处理
  if (!ocrText || ocrText.trim().length === 0) {
    return (
      <div className={`error-highlighted-ocr-text empty ${className}`}>
        暂无识别内容
      </div>
    );
  }

  // 无错误时直接渲染
  if (!detailedErrors || detailedErrors.length === 0) {
    return (
      <div className={`error-highlighted-ocr-text ${className}`}>
        <MathPixMarkdownRenderer content={ocrText} />
      </div>
    );
  }

  return (
    <div className={`error-highlighted-ocr-text with-highlights ${className}`} ref={containerRef}>
      {/* 错误统计徽章 */}
      <div className="error-stats-badge">
        <div className="stats-item total">
          <span className="stats-icon">📍</span>
          <span className="stats-text">{errorStats.total} 处错误</span>
        </div>
        {errorStats.major > 0 && (
          <div className="stats-item severity-major">
            <span className="stats-icon">🔴</span>
            <span className="stats-text">{errorStats.major} 严重</span>
          </div>
        )}
        {errorStats.medium > 0 && (
          <div className="stats-item severity-medium">
            <span className="stats-icon">🟡</span>
            <span className="stats-text">{errorStats.medium} 中等</span>
          </div>
        )}
        {errorStats.minor > 0 && (
          <div className="stats-item severity-minor">
            <span className="stats-icon">🟢</span>
            <span className="stats-text">{errorStats.minor} 轻微</span>
          </div>
        )}
      </div>

      {/* 渲染高亮后的文本 */}
      <div className="highlighted-content">
        <MathPixMarkdownRenderer content={highlightedText} />
      </div>

      {/* 错误提示信息 */}
      {hoveredErrorIndex !== null && detailedErrors[hoveredErrorIndex] && (
        <div className="error-tooltip-overlay">
          <div className="error-tooltip-content">
            <div className="tooltip-header">
              <span className="error-type">
                {detailedErrors[hoveredErrorIndex].errorType}
              </span>
              <span className={`error-severity severity-${detailedErrors[hoveredErrorIndex].severity || 'medium'}`}>
                {detailedErrors[hoveredErrorIndex].severity === 'major' ? '🔴 严重' :
                 detailedErrors[hoveredErrorIndex].severity === 'minor' ? '🟢 轻微' : '🟡 中等'}
              </span>
            </div>
            <div className="tooltip-body">
              <div className="tooltip-section">
                <strong>正确答案：</strong>
                <MathPixMarkdownRenderer
                  content={detailedErrors[hoveredErrorIndex].correction}
                />
              </div>
              <div className="tooltip-section">
                <strong>解释：</strong>
                <span>{detailedErrors[hoveredErrorIndex].explanation}</span>
              </div>
              {detailedErrors[hoveredErrorIndex].knowledgePoint && (
                <div className="tooltip-section">
                  <strong>知识点：</strong>
                  <span className="knowledge-tag">
                    {detailedErrors[hoveredErrorIndex].knowledgePoint}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 导出类型定义供外部使用
export type { DetailedError };
