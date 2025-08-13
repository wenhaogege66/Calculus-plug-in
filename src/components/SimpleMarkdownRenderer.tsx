import React from 'react';
import './MarkdownRenderer.css';

interface SimpleMarkdownRendererProps {
  content: string;
  className?: string;
  maxLength?: number;
}

export const SimpleMarkdownRenderer: React.FC<SimpleMarkdownRendererProps> = ({ 
  content, 
  className = '', 
  maxLength 
}) => {
  // 简单的Markdown渲染，专注于数学公式显示
  const processedContent = maxLength ? truncateContent(content, maxLength) : content;
  
  // 增强的Markdown和LaTeX处理
  const renderContent = (text: string) => {
    // 预处理：保护数学公式块
    const protectedMath: string[] = [];
    
    // 使用通用占位符系统避免索引混乱
    const createPlaceholder = (content: string): string => {
      const index = protectedMath.length;
      protectedMath.push(content);
      return `__PROTECTED_MATH_${index}__`;
    };
    
    // 保护$$...$$块级公式
    let processed = text.replace(/\$\$([^$]+?)\$\$/g, (match, content) => {
      return createPlaceholder(`<div class="math-block latex-display">$$${content}$$</div>`);
    });
    
    // 保护$...$行内公式
    processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      return createPlaceholder(`<span class="math-inline latex-inline">$${content}$</span>`);
    });
    
    // 识别并保护复杂LaTeX结构（即使没有$包围）
    const latexPatterns = [
      // 分段函数
      /\\left\\?\{[^}]*\\begin\{array\}[^}]*\\end\{array\}[^}]*\\right\\?\}/g,
      // 数组/矩阵
      /\\begin\{(array|matrix|bmatrix|pmatrix)\}[^}]*\\end\{\1\}/g,
      // 积分上下限
      /\\int_\{[^}]*\}\^\{[^}]*\}/g,
      // 分数
      /\\frac\{[^}]*\}\{[^}]*\}/g,
      // 上下标组合
      /[a-zA-Z_]_\{[^}]*\}\^\{[^}]*\}/g,
      // 根号
      /\\sqrt(\[[^\]]*\])?\{[^}]*\}/g,
      // 求和/乘积
      /\\(sum|prod)_\{[^}]*\}(\^\{[^}]*\})?/g,
      // left/right括号对
      /\\left\\?[({[]([^}]*?)\\right\\?[)}\]]/g
    ];
    
    latexPatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match) => {
        return createPlaceholder(`<span class="math-complex latex-complex">${match}</span>`);
      });
    });
    
    // 处理标题
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    
    processed = processed
      // 处理换行 - 保持数学内容的换行
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      // 处理标题
      .replace(headingRegex, (match, hashes, title) => {
        const level = hashes.length;
        return `<h${level} class="md-h${level}">${title}</h${level}>`;
      })
      // 处理粗体
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // 处理斜体
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // 处理代码
      .replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>')
      // 处理简单的LaTeX符号
      .replace(/\\pi\b/g, '<span class="latex-symbol">π</span>')
      .replace(/\\infty\b/g, '<span class="latex-symbol">∞</span>')
      .replace(/\\leq\b/g, '<span class="latex-symbol">≤</span>')
      .replace(/\\geq\b/g, '<span class="latex-symbol">≥</span>')
      .replace(/\\neq\b/g, '<span class="latex-symbol">≠</span>')
      .replace(/\\pm\b/g, '<span class="latex-symbol">±</span>')
      .replace(/\\cdot\b/g, '<span class="latex-symbol">⋅</span>')
      .replace(/\\times\b/g, '<span class="latex-symbol">×</span>')
      .replace(/\\div\b/g, '<span class="latex-symbol">÷</span>');
    
    // 恢复保护的数学公式
    protectedMath.forEach((mathContent, index) => {
      processed = processed.replace(`__PROTECTED_MATH_${index}__`, mathContent);
    });
    
    return `<p>${processed}</p>`;
  };

  return (
    <div className={`markdown-renderer simple ${className}`}>
      <div 
        dangerouslySetInnerHTML={{ 
          __html: renderContent(processedContent)
        }} 
      />
      {maxLength && content.length > maxLength && (
        <div className="md-truncated-indicator">...</div>
      )}
    </div>
  );
};

// 智能截取内容
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  const breakPoints = ['\n\n', '\n', '。', '；', '，', ' '];
  
  for (const breakPoint of breakPoints) {
    const lastIndex = truncated.lastIndexOf(breakPoint);
    if (lastIndex > maxLength * 0.8) {
      return truncated.substring(0, lastIndex + breakPoint.length);
    }
  }
  
  return truncated;
}