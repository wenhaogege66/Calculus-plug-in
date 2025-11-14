import React, { useState, useRef, useEffect } from 'react';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
import './ErrorHighlightedOCRText.css';

interface DetailedError {
  questionNumber?: number;
  line: number;
  startChar: number;
  endChar: number;
  content: string;
  errorType: string;
  correction: string;
  explanation: string;
  severity?: 'major' | 'minor' | 'medium';
  knowledgePoint?: string;
}

interface ErrorHighlightedOCRTextProps {
  ocrText: string;
  detailedErrors?: DetailedError[];
  className?: string;
  activeErrorIndex?: number | null;
  onErrorClick?: (errorIndex: number) => void;
}

interface TextSegment {
  text: string;
  isError: boolean;
  errorIndex?: number;
  severity?: string;
}

export const ErrorHighlightedOCRText: React.FC<ErrorHighlightedOCRTextProps> = ({
  ocrText,
  detailedErrors = [],
  className = '',
  activeErrorIndex = null,
  onErrorClick
}) => {
  const [hoveredErrorIndex, setHoveredErrorIndex] = useState<number | null>(null);
  const errorRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Scroll to highlighted error when activeErrorIndex changes
  useEffect(() => {
    if (activeErrorIndex !== null && errorRefs.current[activeErrorIndex]) {
      errorRefs.current[activeErrorIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeErrorIndex]);

  if (!ocrText) {
    return <div className={`error-highlighted-ocr-text empty ${className}`}>暂无识别内容</div>;
  }

  // If no errors, render plain text
  if (!detailedErrors || detailedErrors.length === 0) {
    return (
      <div className={`error-highlighted-ocr-text ${className}`}>
        <MathPixMarkdownRenderer content={ocrText} />
      </div>
    );
  }

  // Split text into lines (1-indexed to match AI response)
  const lines = ocrText.split('\n');

  // Group errors by line
  const errorsByLine: { [lineNum: number]: Array<DetailedError & { errorIndex: number }> } = {};
  detailedErrors.forEach((error, index) => {
    const lineNum = error.line;
    if (!errorsByLine[lineNum]) {
      errorsByLine[lineNum] = [];
    }
    errorsByLine[lineNum].push({ ...error, errorIndex: index });
  });

  // Sort errors in each line by startChar
  Object.keys(errorsByLine).forEach(lineNum => {
    errorsByLine[parseInt(lineNum)].sort((a, b) => a.startChar - b.startChar);
  });

  // Render each line with error highlighting
  const renderLine = (lineText: string, lineNumber: number): React.ReactNode => {
    const lineErrors = errorsByLine[lineNumber];

    // No errors in this line - render plain
    if (!lineErrors || lineErrors.length === 0) {
      return (
        <div key={lineNumber} className="ocr-line">
          <MathPixMarkdownRenderer content={lineText} />
        </div>
      );
    }

    // Build segments for this line
    const segments: TextSegment[] = [];
    let currentPos = 0;

    lineErrors.forEach((error) => {
      // Add text before error
      if (currentPos < error.startChar) {
        segments.push({
          text: lineText.substring(currentPos, error.startChar),
          isError: false
        });
      }

      // Add error segment
      segments.push({
        text: lineText.substring(error.startChar, error.endChar),
        isError: true,
        errorIndex: error.errorIndex,
        severity: error.severity || 'medium'
      });

      currentPos = error.endChar;
    });

    // Add remaining text after last error
    if (currentPos < lineText.length) {
      segments.push({
        text: lineText.substring(currentPos),
        isError: false
      });
    }

    // Render segments
    return (
      <div key={lineNumber} className="ocr-line with-errors">
        <div className="line-number">{lineNumber}</div>
        <div className="line-content">
          {segments.map((segment, segIndex) => {
            if (!segment.isError) {
              return (
                <span key={segIndex} className="text-segment">
                  <MathPixMarkdownRenderer content={segment.text} />
                </span>
              );
            }

            const isActive = activeErrorIndex === segment.errorIndex;
            const isHovered = hoveredErrorIndex === segment.errorIndex;
            const error = detailedErrors[segment.errorIndex!];

            return (
              <div
                key={segIndex}
                ref={(el) => {
                  if (segment.errorIndex !== undefined) {
                    errorRefs.current[segment.errorIndex] = el;
                  }
                }}
                className={`error-segment severity-${segment.severity} ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                onClick={() => onErrorClick?.(segment.errorIndex!)}
                onMouseEnter={() => setHoveredErrorIndex(segment.errorIndex!)}
                onMouseLeave={() => setHoveredErrorIndex(null)}
                title={`${error.errorType}: ${error.explanation}`}
              >
                <MathPixMarkdownRenderer content={segment.text} />
                {(isActive || isHovered) && (
                  <div className="error-tooltip">
                    <div className="tooltip-header">
                      <span className="error-type">{error.errorType}</span>
                      <span className="error-severity">{
                        error.severity === 'major' ? '🔴 严重' :
                        error.severity === 'minor' ? '🟢 轻微' : '🟡 中等'
                      }</span>
                    </div>
                    <div className="tooltip-content">
                      <div className="tooltip-section">
                        <strong>正确答案：</strong>
                        <MathPixMarkdownRenderer content={error.correction} />
                      </div>
                      <div className="tooltip-section">
                        <strong>解释：</strong>
                        <span>{error.explanation}</span>
                      </div>
                      {error.knowledgePoint && (
                        <div className="tooltip-section">
                          <strong>知识点：</strong>
                          <span className="knowledge-tag">{error.knowledgePoint}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`error-highlighted-ocr-text ${className}`}>
      <div className="error-count-badge">
        {detailedErrors.length} 处错误
      </div>
      <div className="highlighted-lines">
        {lines.map((line, index) => renderLine(line, index + 1))}
      </div>
    </div>
  );
};
