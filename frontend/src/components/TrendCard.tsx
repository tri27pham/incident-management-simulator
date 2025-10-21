import { TrendMetric } from '../types';

interface TrendCardProps {
  metric: TrendMetric;
}

export function TrendCard({ metric }: TrendCardProps) {
  const bgColor = metric.isPositive ? 'bg-red-50' : 'bg-green-50';
  const textColor = metric.isPositive ? 'text-red-600' : 'text-green-600';
  const arrow = metric.isPositive ? '↗' : '↘';

  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
      <div className="flex items-center gap-2">
        <span className={`${textColor} text-sm font-medium`}>{arrow}</span>
        <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
      </div>
    </div>
  );
}

