/**
 * MathPixMarkdownRenderer - 专门用于渲染MathPix OCR返回的Mathpix Markdown (MMD)格式
 *
 * 关键特性:
 * - 使用mathpix-markdown-it官方渲染器，而非正则表达式手动处理
 * - 完整支持LaTeX数学公式 ($...$, $$...$$, \[...\], equation环境等)
 * - 支持LaTeX表格(tabular环境)
 * - 支持化学图表(SMILES语法)
 * - 完全兼容MathPix API的输出格式
 *
 * 参考文档:
 * - https://mathpix.com/docs/mathpix-markdown/syntax-reference
 * - https://github.com/Mathpix/mathpix-markdown-it
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { MathpixMarkdownModel as MM } from 'mathpix-markdown-it';
import './MathPixMarkdownRenderer.css';

interface MathPixMarkdownRendererProps {
  /** MathPix OCR返回的Mathpix Markdown (MMD)格式内容 */
  content: string;
  /** 自定义CSS类名 */
  className?: string;
  /** 内容预览模式，限制显示长度 */
  maxLength?: number;
  /** 是否在加载时显示加载指示器 */
  showLoader?: boolean;
}

/**
 * MathPixMarkdownRenderer组件
 *
 * 使用官方的mathpix-markdown-it库渲染MathPix OCR输出
 * 避免使用正则表达式手动处理复杂的LaTeX和Markdown混合内容
 */
export const MathPixMarkdownRenderer: React.FC<MathPixMarkdownRendererProps> = ({
  content,
  className = '',
  maxLength,
  showLoader = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [renderError, setRenderError] = React.useState<string | null>(null);

  // 如果需要截断内容
  const processedContent = useMemo(() => {
    if (!content) return '';

    if (maxLength && content.length > maxLength) {
      return content.substring(0, maxLength) + '\n\n...(内容已截断)';
    }

    return content;
  }, [content, maxLength]);

  // 注入MathPix样式（仅执行一次）
  useEffect(() => {
    const styleId = 'Mathpix-styles';
    const existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      const style = document.createElement('style');
      style.setAttribute('id', styleId);
      style.innerHTML = MM.getMathpixFontsStyle() + MM.getMathpixStyle(true);
      document.head.appendChild(style);
    }
  }, []);

  // 渲染MathPix Markdown内容
  useEffect(() => {
    if (!containerRef.current || !processedContent) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setRenderError(null);

      // 使用MathPix官方推荐的静态方法渲染
      const html = MM.render(processedContent, {
        htmlTags: true,
        width: 1200,
        breaks: true,
        typographer: true
      });

      // 注入渲染后的HTML
      if (containerRef.current) {
        containerRef.current.innerHTML = html;
      }

      setIsLoading(false);
    } catch (error) {
      console.error('MathPix Markdown渲染失败:', error);
      setRenderError(error instanceof Error ? error.message : '渲染失败');
      setIsLoading(false);

      // 降级到显示纯文本
      if (containerRef.current) {
        containerRef.current.textContent = processedContent;
      }
    }
  }, [processedContent]);

  // 空内容处理
  if (!content || content.trim().length === 0) {
    return (
      <div className={`mathpix-markdown-renderer empty ${className}`}>
        <p className="empty-message">暂无内容</p>
      </div>
    );
  }

  return (
    <div className={`mathpix-markdown-renderer-wrapper ${className}`}>
      {/* 加载指示器 */}
      {showLoader && isLoading && (
        <div className="mathpix-loading">
          <div className="loading-spinner"></div>
          <span>正在渲染数学公式...</span>
        </div>
      )}

      {/* 渲染错误提示 */}
      {renderError && (
        <div className="mathpix-error">
          <span className="error-icon">⚠️</span>
          <span>渲染失败: {renderError}</span>
          <small>内容将以纯文本显示</small>
        </div>
      )}

      {/* 渲染容器 */}
      <div
        ref={containerRef}
        className={`mathpix-markdown-content ${isLoading ? 'loading' : ''} ${renderError ? 'error-mode' : ''}`}
        suppressHydrationWarning
      />
    </div>
  );
};

/**
 * 工具函数: 检测内容是否包含LaTeX数学公式
 */
export const containsMath = (content: string): boolean => {
  const mathPatterns = [
    /\$\$[\s\S]+?\$\$/,     // 块级: $$...$$
    /\$[^$]+?\$/,           // 行内: $...$
    /\\\[[\s\S]+?\\\]/,     // 块级: \[...\]
    /\\\([\s\S]+?\\\)/,     // 行内: \(...\)
    /\\begin\{equation\}/,  // equation环境
    /\\begin\{align\}/,     // align环境
    /\\begin\{gather\}/     // gather环境
  ];

  return mathPatterns.some(pattern => pattern.test(content));
};

/**
 * 工具函数: 检测内容是否包含LaTeX表格
 */
export const containsLatexTable = (content: string): boolean => {
  return /\\begin\{tabular\}/.test(content);
};
