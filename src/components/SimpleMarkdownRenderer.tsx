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

/** 解析期兜底：React Error Boundary（函数组件的 try/catch 捕不到子树渲染错误） */
class MarkdownErrorBoundary extends React.Component<
  { fallback?: React.ReactNode }, { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    // 这里能看到具体挂在哪条内容上
    // eslint-disable-next-line no-console
    console.error("Markdown render error:", err);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="markdown-renderer error">
          <span className="math-error">内容渲染失败（已降级为纯文本）</span>
        </div>
      );
    }
    return this.props.children as any;
  }
}

/** 预处理：清理控制符、保护块级数学、修复不成对的 `$` */
function preprocessMmd(raw: string) {
  if (!raw) return { text: "" , hadUnbalancedDollar: false };

  // 1) 去除控制/零宽字符，避免奇怪 token
  let s = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, "");

  // 2) 先保护块级数学：$$...$$ 和 \[...\]
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

  // 3) 修复不成对的单个 $（不处理 $$）
  //    思路：找出所有“单个 $”的位置（不被转义、且不是 $$ 的一部分），成对配对；若最终为奇数个，逃逸最后一个。
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
    // 逃逸最后一个单独的 $
    const j = singleDollarIdx[singleDollarIdx.length - 1];
    chars.splice(j, 1, "\\$");
    hadUnbalancedDollar = true;
  }
  s = chars.join("");

  // 4) 还原块级数学
  s = s.replace(/@@__MATH_BLOCK_(\d+)__@@/g, (_, n) => `$$${blocks[Number(n)]}$$`);

  return { text: s, hadUnbalancedDollar };
}

/** 是否包含数学迹象（用来避免对数学内容做硬截断） */
function looksLikeMath(s: string) {
  return /(\$\$[\s\S]*?\$\$)|(\$[^$]*\$)|\\\[|\\\]|\\\(|\\\)|\\begin\{/.test(s);
}

/** 智能截断：仅当内容不含数学时才截字数；含数学用 CSS 行数收起更安全 */
function safeTruncate(content: string, maxLength?: number) {
  if (!maxLength || content.length <= maxLength) return content;
  if (looksLikeMath(content)) return content; // 不截断数学，交给 CSS 行数收起
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
      // 你可以用 .is-math + CSS 做行数收起（line-clamp），避免硬截断
      title={hadUnbalancedDollar ? "内容中存在不成对的 $，已自动修复" : undefined}
    >
      <MarkdownErrorBoundary
        fallback={
          <pre className="fallback-content">{processed}</pre>
        }
      >
        <ReactMarkdown
          // 仅一个 math 解析器，避免多次注册 micromark 扩展产生冲突
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                throwOnError: false, // 出错时不抛异常
                strict: false,       // 宽松模式
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