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

// 自定义remark插件：过滤空的math节点
const remarkFilterEmptyMath = () => {
  return (tree: any) => {
    // 递归遍历AST树，过滤空的math节点
    const visit = (node: any): any => {
      if (node.children) {
        node.children = node.children
          .filter((child: any) => {
            // 过滤空的数学节点
            if (child.type === 'math' || child.type === 'inlineMath') {
              const value = child.value;
              // 过滤真正空的或只包含空格/符号的math节点
              if (!value || 
                  typeof value !== 'string' || 
                  value.trim() === '' || 
                  value.trim() === '$' || 
                  value.trim() === '$$' ||
                  value.trim() === ' ') {
                return false;
              }
            }
            return true;
          })
          .map((child: any) => visit(child)); // 递归处理子节点
      }
      return node;
    };
    
    return visit(tree);
  };
};

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
          remarkPlugins={[remarkMath, remarkFilterEmptyMath]}
          rehypePlugins={[
            [rehypeKatex, {
              strict: false, // 允许非严格模式
              throwOnError: false, // 遇到错误时不抛出异常，而是显示原始LaTeX
              errorColor: '#cc0000',
              output: 'html', // 使用HTML输出而不是MathML
              trust: false, // 不信任用户输入
              macros: {
                "\\f": "#1f(#2)"
              }
            }]
          ]}
          components={{
            // 自定义错误处理组件
            div: ({ className, children, ...props }) => {
              if (className?.includes('math-error')) {
                return <span className="math-error">数学公式解析错误</span>;
              }
              return <div className={className} {...props}>{children}</div>;
            }
          }}
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
    
    // 尝试不使用数学插件的简单渲染
    try {
      return (
        <div className={`markdown-renderer simple ${className} fallback`}>
          <ReactMarkdown>{processedContent}</ReactMarkdown>
        </div>
      );
    } catch (fallbackError) {
      console.error('Fallback markdown render error:', fallbackError);
      // 最终回退到纯文本显示
      return (
        <div className={`markdown-renderer simple ${className} error`}>
          <pre className="fallback-content">{processedContent}</pre>
        </div>
      );
    }
  }
};

// 内容安全性清理和验证 - 保守方式，保留原始MathPix输出格式
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
  
  // 只做安全性清理，保留原始MathPix输出格式
  let cleaned = content.trim();
  
  try {
    cleaned = cleaned
      // 只清理控制字符和零宽字符，不修改LaTeX语法
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 控制字符
      .replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, ''); // 零宽字符
  } catch (regexError) {
    console.warn('Safety cleaning error, using raw content:', regexError);
    // 如果出错，直接返回trim后的内容
    return content.trim();
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