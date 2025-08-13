import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './MarkdownRenderer.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  maxLength?: number; // 用于截取预览
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '', 
  maxLength 
}) => {
  // 如果指定了最大长度，进行智能截取
  const processedContent = maxLength ? truncateContent(content, maxLength) : content;

  return (
    <div className={`markdown-renderer ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 自定义组件样式
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
          p: ({ children }) => <p className="md-p">{children}</p>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          code: ({ inline, children }) => 
            inline ? 
              <code className="md-code-inline">{children}</code> : 
              <code className="md-code-block">{children}</code>,
          blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
          table: ({ children }) => <table className="md-table">{children}</table>,
          th: ({ children }) => <th className="md-th">{children}</th>,
          td: ({ children }) => <td className="md-td">{children}</td>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {maxLength && content.length > maxLength && (
        <div className="md-truncated-indicator">...</div>
      )}
    </div>
  );
};

// 智能截取内容，保持markdown格式完整性
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // 尝试在句号、换行符等位置截断
  const truncated = content.substring(0, maxLength);
  const breakPoints = ['\n\n', '\n', '。', '；', '，', ' '];
  
  for (const breakPoint of breakPoints) {
    const lastIndex = truncated.lastIndexOf(breakPoint);
    if (lastIndex > maxLength * 0.8) { // 至少保留80%的内容
      return truncated.substring(0, lastIndex + breakPoint.length);
    }
  }
  
  return truncated;
}