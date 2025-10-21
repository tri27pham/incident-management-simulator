import { IncidentSeverity } from '../types';

interface SeverityBarsProps {
  severity?: IncidentSeverity;
}

const severityConfig = {
  undiagnosed: { bars: 1, color: 'bg-gray-900' },
  minor: { bars: 1, color: 'bg-yellow-500' },
  low: { bars: 1, color: 'bg-yellow-500' },
  medium: { bars: 2, color: 'bg-orange-500' },
  high: { bars: 3, color: 'bg-red-500' },
  critical: { bars: 3, color: 'bg-red-500' },
};

export function SeverityBars({ severity }: SeverityBarsProps) {
  const config = severity ? severityConfig[severity] : severityConfig.undiagnosed;
  
  return (
    <div className="flex items-end gap-0.5 h-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={`w-1 rounded-sm transition-colors ${
            index < config.bars ? config.color : 'bg-gray-200'
          }`}
          style={{
            height: `${((index + 1) / 3) * 100}%`
          }}
        />
      ))}
    </div>
  );
}

