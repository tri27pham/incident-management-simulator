import { TrendMetric } from '../types';

interface TrendCardProps {
  metric: TrendMetric;
}

export function TrendCard({ metric }: TrendCardProps) {
  const bgColor = metric.isPositive ? 'bg-red-50' : 'bg-green-50';
  const textColor = metric.isPositive ? 'text-red-600' : 'text-green-600';
  const arrow = metric.isPositive ? '↗' : '↘';

  return (
    <div className={`${bgColor} rounded-lg p-4 bg-card`} style={{ backgroundColor: `rgb(var(--card-bg))` }}>
      <p className="text-sm mb-1" style={{ color: `rgb(var(--card-text-secondary))` }}>{metric.label}</p>
      <div className="flex items-center gap-2">
        <span className={`${textColor} text-sm font-medium`}>{arrow}</span>
        <span className="text-2xl font-bold" style={{ color: `rgb(var(--card-text-primary))` }}>{metric.value}</span>
      </div>
    </div>
  );
}

