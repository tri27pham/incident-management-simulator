import { Draggable } from 'react-beautiful-dnd';
import { Incident } from '../types';

interface IncidentCardProps {
  item: Incident;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onOpenModal: (incident: Incident) => void;
}

const severityConfig = {
  critical: { icon: '📊', color: 'text-red-600' },
  high: { icon: '📊', color: 'text-orange-600' },
  medium: { icon: '📊', color: 'text-yellow-600' },
  low: { icon: '📊', color: 'text-blue-600' },
  minor: { icon: '📊', color: 'text-gray-600' },
};

export function IncidentCard({ item, index, isExpanded, onToggleExpand, onOpenModal }: IncidentCardProps) {
  const severity = item.severity ? severityConfig[item.severity] : null;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking the modal button or while dragging
    if ((e.target as HTMLElement).closest('.modal-trigger')) {
      return;
    }
    onToggleExpand(item.id);
  };

  const handleModalOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal(item);
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleCardClick}
          className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-4 mb-3 border border-gray-200 ${
            snapshot.isDragging ? 'shadow-lg' : ''
          } ${isExpanded ? 'ring-2 ring-blue-400' : ''}`}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">{item.incidentNumber}</span>
            <span className="text-xs text-gray-400">{item.timeElapsed}</span>
          </div>
          
          <h3 className="text-sm font-medium text-gray-900 mb-3 leading-tight">
            {item.title}
          </h3>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mb-3 pb-3 border-b border-gray-200 space-y-2">
              {item.description && (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.description}
                </p>
              )}
              {item.affectedServices && item.affectedServices.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.affectedServices.slice(0, 2).map((service, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {service}
                    </span>
                  ))}
                  {item.affectedServices.length > 2 && (
                    <span className="px-2 py-0.5 text-gray-500 text-xs">
                      +{item.affectedServices.length - 2} more
                    </span>
                  )}
                </div>
              )}
              {item.assignee && (
                <p className="text-xs text-gray-500">
                  Assigned to: <span className="font-medium text-gray-700">{item.assignee}</span>
                </p>
              )}
            </div>
          )}
          
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
            
            <div className="flex items-center gap-2">
              {isExpanded && (
                <button
                  onClick={handleModalOpen}
                  className="modal-trigger p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand to full view"
                >
                  <svg 
                    className="w-4 h-4 text-gray-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
                    />
                  </svg>
                </button>
              )}
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
        </div>
      )}
    </Draggable>
  );
}
