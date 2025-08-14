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

function preprocessMmd(raw: string) {
  if (!raw) return { text: "", hadUnbalancedDollar: false };

  let s = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, "");

  const blocks: string[] = [];
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
    const id = blocks.length;
    blocks.push(inner);
    return `@@__MATH_BLOCK_${id}__@@`;
  });
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
    const id = blocks.length;
    blocks.push(inner);
    return `@@__MATH_BLOCK_${id}__@@`;
  });

  const chars = s.split("");
  const singleDollarIdx: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== "$") continue;
    const prev = i > 0 ? chars[i - 1] : "";
    const next = i + 1 < chars.length ? chars[i + 1] : "";
    const isEscaped = prev === "\\";
    const isDouble = prev === "$" || next === "$";
    if (!isEscaped && !isDouble) {
      singleDollarIdx.push(i);
    }
  }
  let hadUnbalancedDollar = false;
  if (singleDollarIdx.length % 2 === 1) {
    const j = singleDollarIdx[singleDollarIdx.length - 1];
    chars.splice(j, 1, "\\$");
    hadUnbalancedDollar = true;
  }
  s = chars.join("");

  // 还原块级数学（空内容直接删除）
  s = s.replace(/@@__MATH_BLOCK_(\d+)__@@/g, (_, n) => {
    const inner = blocks[Number(n)]?.trim();
    if (!inner) return "";
    return `$$${inner}$$`;
  });

  // 删除空行内公式
  s = s.replace(/\$\s*\$/g, "");

  return { text: s, hadUnbalancedDollar };
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
  const { text: cleaned, hadUnbalancedDollar } = preprocessMmd(
    typeof content === "string" ? content : String(content ?? "")
  );
  const processed = safeTruncate(cleaned, maxLength);

  if (!processed.trim()) {
    return (
      <div className={`markdown-renderer simple ${className} empty`}>
        <span className="empty-placeholder">暂无内容</span>
      </div>
    );
  }

  return (
    <div
      className={[
        "markdown-renderer",
        "simple",
        className,
        looksLikeMath(cleaned) && maxLength ? "is-math" : ""
      ].join(" ")}
      title={hadUnbalancedDollar ? "内容中存在不成对的 $，已自动修复" : undefined}
    >
      <MarkdownErrorBoundary fallback={<pre className="fallback-content">{processed}</pre>}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                throwOnError: false,
                strict: false,
                output: "html"
              } as any
            ]
          ]}
        >
          {processed}
        </ReactMarkdown>
      </MarkdownErrorBoundary>

      {maxLength && content && content.length > maxLength && !looksLikeMath(cleaned) && (
        <div className="md-truncated-indicator">...</div>
      )}
    </div>
  );
};
