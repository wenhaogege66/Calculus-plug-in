/**
 * 错误高亮工具函数
 * 用于在OCR文本中标记AI识别的错误位置
 */

export interface DetailedError {
  questionNumber?: number;
  content: string; // 从OCR文本中截取的错误片段
  errorType: string;
  correction: string;
  explanation: string;
  severity?: 'major' | 'minor' | 'medium';
  knowledgePoint?: string;
}

/**
 * 转义HTML特殊字符
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 在OCR文本中高亮错误片段
 * 使用HTML <mark>标签包裹错误内容，保持markdown语法不被破坏
 *
 * @param ocrText 原始OCR文本
 * @param detailedErrors AI返回的错误列表
 * @returns 处理后的文本，错误片段被<mark>标签包裹
 */
export function highlightErrorsInText(
  ocrText: string,
  detailedErrors: DetailedError[] = []
): string {
  if (!ocrText || !detailedErrors || detailedErrors.length === 0) {
    return ocrText;
  }

  // 创建一个映射，用于存储每个错误片段的替换信息
  interface Replacement {
    original: string;
    highlighted: string;
    errorIndex: number;
    severity: string;
    positions: number[]; // 所有匹配位置
  }

  const replacements: Replacement[] = [];

  // 遍历所有错误，找到它们在文本中的位置
  detailedErrors.forEach((error, errorIndex) => {
    if (!error.content || error.content.trim().length === 0) {
      return;
    }

    const contentToFind = error.content.trim();
    const severity = error.severity || 'medium';

    // 查找所有匹配位置
    const positions: number[] = [];
    let searchPos = 0;

    while (true) {
      const foundPos = ocrText.indexOf(contentToFind, searchPos);
      if (foundPos === -1) break;

      positions.push(foundPos);
      searchPos = foundPos + contentToFind.length;
    }

    if (positions.length > 0) {
      // 创建高亮标记
      const highlighted = `<mark class="error-highlight severity-${severity}" data-error-index="${errorIndex}" title="${escapeHtml(error.errorType)}: ${escapeHtml(error.explanation)}">${contentToFind}</mark>`;

      replacements.push({
        original: contentToFind,
        highlighted,
        errorIndex,
        severity,
        positions
      });
    }
  });

  // 如果没有找到任何错误片段，返回原文本
  if (replacements.length === 0) {
    console.warn('警告: AI返回了错误列表，但在OCR文本中找不到对应的错误片段');
    return ocrText;
  }

  // 按位置排序所有替换操作，从后往前替换以避免位置偏移
  interface ReplacementOperation {
    startPos: number;
    endPos: number;
    replacement: Replacement;
  }

  const operations: ReplacementOperation[] = [];

  replacements.forEach(replacement => {
    replacement.positions.forEach(pos => {
      operations.push({
        startPos: pos,
        endPos: pos + replacement.original.length,
        replacement
      });
    });
  });

  // 按起始位置倒序排序（从后往前替换）
  operations.sort((a, b) => b.startPos - a.startPos);

  // 执行替换
  let result = ocrText;
  operations.forEach(op => {
    const before = result.substring(0, op.startPos);
    const after = result.substring(op.endPos);
    result = before + op.replacement.highlighted + after;
  });

  return result;
}

/**
 * 从高亮文本中提取错误统计信息
 */
export function getErrorStats(detailedErrors: DetailedError[]): {
  total: number;
  major: number;
  minor: number;
  medium: number;
} {
  const stats = {
    total: detailedErrors.length,
    major: 0,
    minor: 0,
    medium: 0
  };

  detailedErrors.forEach(error => {
    const severity = error.severity || 'medium';
    stats[severity]++;
  });

  return stats;
}

/**
 * 移除文本中的错误高亮标记（用于导出纯文本）
 */
export function removeHighlights(highlightedText: string): string {
  // 移除所有<mark>标签，保留内容
  return highlightedText.replace(/<mark[^>]*>(.*?)<\/mark>/g, '$1');
}

/**
 * 自动包裹LaTeX公式
 * 检测文本是否包含LaTeX命令，如果是且未被$包裹，则自动添加
 * @param text 可能包含LaTeX代码的文本
 * @returns 处理后的文本，确保LaTeX被正确包裹
 */
export function wrapLatexContent(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // 如果已经包含$符号，认为已经是正确的markdown格式
  if (text.includes('$')) {
    return text;
  }

  // LaTeX命令的特征模式
  const latexPatterns = [
    /\\frac\{/,           // 分数
    /\\int[_^{]/,         // 积分
    /\\sum[_^{]/,         // 求和
    /\\prod[_^{]/,        // 连乘
    /\\lim[_^{]/,         // 极限
    /\\sqrt\{/,           // 根号
    /\\left[(\[{]/,       // 左括号
    /\\right[)\]}]/,      // 右括号
    /\\begin\{/,          // 环境开始
    /\\end\{/,            // 环境结束
    /[_^]\{/,             // 上下标
    /\\pi/,               // 希腊字母
    /\\omega/,
    /\\alpha/,
    /\\beta/,
    /\\gamma/,
    /\\theta/,
    /\\cos/,              // 三角函数
    /\\sin/,
    /\\tan/,
    /\\log/,
    /\\ln/,
    /\\exp/,
    /\\infty/,            // 无穷
    /\\partial/,          // 偏导
    /\\nabla/,            // 梯度
    /\\cdot/,             // 点乘
    /\\times/,            // 叉乘
    /\\pm/,               // 正负号
    /\\mp/,
    /\\geq/,              // 比较符号
    /\\leq/,
    /\\neq/,
    /\\approx/,
    /\\equiv/
  ];

  // 检查是否包含LaTeX命令
  const hasLatex = latexPatterns.some(pattern => pattern.test(text));

  if (hasLatex) {
    // 检查是否是多行公式（包含换行或较长）
    const isMultiLine = text.includes('\n') || text.length > 100;

    if (isMultiLine) {
      // 块级公式，使用 $$...$$
      return `$$${text}$$`;
    } else {
      // 行内公式，使用 $...$
      return `$${text}$`;
    }
  }

  // 不包含LaTeX命令，返回原文本
  return text;
}
