import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./SimpleMarkdownRenderer.css";

interface SimpleMarkdownRendererProps {
  content: string;
  className?: string;
  maxLength?: number;
}

class MarkdownErrorBoundary extends React.Component<
  { fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.error("Markdown render error:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="markdown-renderer error">
            <span className="math-error">内容渲染失败（已降级为纯文本）</span>
          </div>
        )
      );
    }
    return this.props.children as any;
  }
}

/**
 * 最小化预处理Markdown内容 - 只修复MathPix OCR的特殊格式问题
 *
 * 工业界标准：直接使用 remark-math + rehype-katex，无需复杂处理
 * 这里只做MathPix OCR特有格式的标准化转换
 */
function preprocessMmd(raw: string) {
  if (!raw) return raw;

  // 只做必要的清理：移除控制字符和零宽字符
  let text = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, "");

  // MathPix OCR特殊处理：将单$包裹的大型LaTeX环境转为块级公式
  // 这是MathPix OCR的已知问题，它会用单$包裹本应为块级的array等环境
  text = text.replace(
    /\$\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|cases|align|aligned|equation|gather|split)\}([\s\S]*?)\\end\{\1\}\$/g,
    (match, env, content) => {
      // 转为标准的块级数学公式格式
      return `\n$$\n\\begin{${env}}${content}\\end{${env}}\n$$\n`;
    }
  );

  return text;
}

function looksLikeMath(s: string) {
  return /(\$\$[\s\S]*?\$\$)|(\$[^$]*\$)|\\\[|\\\]|\\\(|\\\)|\\begin\{/.test(s);
}

function safeTruncate(content: string, maxLength?: number) {
  if (!maxLength || content.length <= maxLength) return content;
  if (looksLikeMath(content)) return content;
  const trunc = content.slice(0, maxLength);
  const breakPoints = ["\n\n", "\n", "。", "；", "，", " "];
  for (const bp of breakPoints) {
    const k = trunc.lastIndexOf(bp);
    if (k > maxLength * 0.8) return trunc.slice(0, k + bp.length);
  }
  return trunc;
}

export const SimpleMarkdownRenderer: React.FC<SimpleMarkdownRendererProps> = ({
  content,
  className = "",
  maxLength
}) => {
  // 预处理：只做MathPix OCR格式标准化
  const preprocessed = preprocessMmd(
    typeof content === "string" ? content : String(content ?? "")
  );

  // 可选的截断处理（但数学内容不截断）
  const finalContent = safeTruncate(preprocessed, maxLength);

  if (!finalContent.trim()) {
    return (
      <div className={`markdown-renderer simple ${className} empty`}>
        <span className="empty-placeholder">暂无内容</span>
      </div>
    );
  }

  return (
    <div className={`markdown-renderer simple ${className}`}>
      <MarkdownErrorBoundary fallback={<pre className="fallback-content">{finalContent}</pre>}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                throwOnError: false,   // 容错：遇到错误时显示错误而非崩溃
                strict: false,          // 宽松模式：支持更多LaTeX语法
                output: "html",         // HTML输出（更好的浏览器兼容性）
                fleqn: false,           // 块级公式居中显示
                macros: {               // 可选：自定义LaTeX宏
                  "\\RR": "\\mathbb{R}",
                  "\\NN": "\\mathbb{N}",
                  "\\ZZ": "\\mathbb{Z}",
                  "\\QQ": "\\mathbb{Q}",
                  "\\CC": "\\mathbb{C}"
                }
              }
            ]
          ]}
        >
          {finalContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>

      {maxLength && content && content.length > maxLength && !looksLikeMath(preprocessed) && (
        <div className="md-truncated-indicator">...</div>
      )}
    </div>
  );
};
