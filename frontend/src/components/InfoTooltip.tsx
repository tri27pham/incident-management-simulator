import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useTheme();

  // Theme-aware colors
  const tooltipBg = theme === 'dark' ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)';
  const tooltipText = theme === 'dark' ? 'rgb(17, 24, 39)' : 'rgb(243, 244, 246)';

  return (
    <span 
      className="relative inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors duration-200"
      style={{ 
        backgroundColor: 'rgba(var(--text-tertiary-rgb), 0.1)',
        color: 'rgb(var(--text-tertiary))',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      
      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 mb-2 px-3 py-2 rounded-lg shadow-lg text-xs leading-normal whitespace-normal z-50 transition-all duration-200 ease-out"
        style={{
          transform: isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(4px)',
          width: '200px',
          backgroundColor: tooltipBg,
          color: tooltipText,
          pointerEvents: 'none',
          opacity: isVisible ? 1 : 0,
          visibility: isVisible ? 'visible' : 'hidden'
        }}
      >
        {text}
        {/* Arrow */}
        <div
          className="absolute top-full left-1/2 transition-opacity duration-200"
          style={{
            transform: 'translateX(-50%)',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${tooltipBg}`,
            opacity: isVisible ? 1 : 0
          }}
        />
      </div>
    </span>
  );
}

