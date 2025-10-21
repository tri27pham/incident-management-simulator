import { Draggable } from 'react-beautiful-dnd';
import { Incident } from '../types';

interface IncidentCardProps {
  item: Incident;
  index: number;
}

const severityConfig = {
  critical: { icon: '📊', color: 'text-red-600' },
  high: { icon: '📊', color: 'text-orange-600' },
  medium: { icon: '📊', color: 'text-yellow-600' },
  low: { icon: '📊', color: 'text-blue-600' },
  minor: { icon: '📊', color: 'text-gray-600' },
};

export function IncidentCard({ item, index }: IncidentCardProps) {
  const severity = item.severity ? severityConfig[item.severity] : null;

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 mb-3 border border-gray-200 ${
            snapshot.isDragging ? 'shadow-lg' : ''
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">{item.incidentNumber}</span>
            <span className="text-xs text-gray-400">{item.timeElapsed}</span>
          </div>
          
          <h3 className="text-sm font-medium text-gray-900 mb-3 leading-tight">
            {item.title}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {severity && (
                <span className={severity.color}>{severity.icon}</span>
              )}
              <span className="flex items-center gap-1">
                <span className="text-gray-400">⬢⬢</span>
                <span className="text-gray-700 font-medium">{item.team}</span>
              </span>
            </div>
            
            {item.avatarUrl ? (
              <img 
                src={item.avatarUrl} 
                alt="Avatar" 
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
