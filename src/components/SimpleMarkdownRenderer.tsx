import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import './SimpleMarkdownRenderer.css';

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
  // 安全性检查和内容清理
  const safeContent = sanitizeContent(content);
  const processedContent = maxLength ? truncateContent(safeContent, maxLength) : safeContent;

  // 如果内容为空，显示占位符
  if (!processedContent?.trim()) {
    return (
      <div className={`markdown-renderer simple ${className} empty`}>
        <span className="empty-placeholder">暂无内容</span>
      </div>
    );
  }

  try {
    return (
      <div className={`markdown-renderer simple ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {processedContent}
        </ReactMarkdown>
        {maxLength && content && content.length > maxLength && (
          <div className="md-truncated-indicator">...</div>
        )}
      </div>
    );
  } catch (error) {
    // 渲染错误时的降级处理
    console.error('SimpleMarkdownRenderer error:', error);
    return (
      <div className={`markdown-renderer simple ${className} error`}>
        <pre className="fallback-content">{processedContent}</pre>
      </div>
    );
  }
};

// 内容安全性清理和验证
function sanitizeContent(content: any): string {
  // 处理各种边缘情况
  if (content === null || content === undefined) {
    return '';
  }
  
  if (typeof content !== 'string') {
    try {
      return String(content);
    } catch (error) {
      console.warn('Content conversion error:', error);
      return '';
    }
  }
  
  // 清理可能导致数学公式解析错误的内容
  let cleaned = content.trim();
  
  // 修复常见的LaTeX语法问题，使用保守的正则表达式
  try {
    cleaned = cleaned
      // 清理可能导致问题的控制字符
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // 修复多余的空白字符
      .replace(/\s+/g, ' ')
      // 修复明显破损的数学公式标记
      .replace(/\$\s*\$/g, '')
      // 确保数学公式前后有适当的空格
      .replace(/([^\s])\$([^$]+)\$/g, '$1 $$$2$$ ')
      .replace(/\$([^$]+)\$([^\s])/g, '$$$1$$ $2');
  } catch (regexError) {
    console.warn('Regex processing error, using raw content:', regexError);
    // 如果正则表达式处理失败，只做基本清理
    cleaned = cleaned
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\s+/g, ' ');
  }
  
  return cleaned;
}

// 智能截取内容
function truncateContent(content: string, maxLength: number): string {
  if (!content || content.length <= maxLength) {
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