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
  
  // 简单的Markdown处理
  const renderContent = (text: string) => {
    // 处理数学公式 $...$
    const mathInlineRegex = /\$([^$]+)\$/g;
    const mathBlockRegex = /\$\$([^$]+)\$\$/g;
    
    // 处理标题
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    
    // 处理列表
    const listRegex = /^[\s]*([*\-+]|\d+\.)\s+(.+)$/gm;
    
    let processed = text
      // 处理换行
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      // 处理标题
      .replace(headingRegex, (match, hashes, title) => {
        const level = hashes.length;
        return `<h${level} class="md-h${level}">${title}</h${level}>`;
      })
      // 处理行内数学公式
      .replace(mathInlineRegex, '<span class="math-inline">$1</span>')
      // 处理块级数学公式
      .replace(mathBlockRegex, '<div class="math-block">$1</div>')
      // 处理粗体
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // 处理斜体
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // 处理代码
      .replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>');
    
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