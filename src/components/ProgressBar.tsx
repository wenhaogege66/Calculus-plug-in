import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = true,
  color = 'primary',
  size = 'medium'
}) => {
  const getColorClass = () => {
    switch (color) {
      case 'success': return 'progress-success';
      case 'warning': return 'progress-warning';
      case 'error': return 'progress-error';
      default: return 'progress-primary';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'progress-small';
      case 'large': return 'progress-large';
      default: return 'progress-medium';
    }
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`progress-container ${getSizeClass()}`}>
      <div className={`progress-bar ${getColorClass()}`}>
        <div 
          className="progress-fill"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showPercentage && (
        <span className="progress-text">{Math.round(clampedProgress)}%</span>
      )}
    </div>
  );
}; 