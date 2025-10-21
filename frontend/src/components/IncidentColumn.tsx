import { Droppable } from 'react-beautiful-dnd';
import { Incident } from '../types';
import { IncidentCard } from './IncidentCard';

interface IncidentColumnProps {
  columnId: string;
  column: {
    name: string;
    items: Incident[];
  };
  expandedCardId: string | null;
  onToggleExpand: (id: string) => void;
  onOpenModal: (incident: Incident) => void;
}

const statusColors = {
  Triage: 'text-blue-600',
  Investigating: 'text-orange-600',
  Fixing: 'text-red-600',
};

const statusIcons = {
  Triage: '🔵',
  Investigating: '🔄',
  Fixing: '🔴',
};

export function IncidentColumn({ columnId, column, expandedCardId, onToggleExpand, onOpenModal }: IncidentColumnProps) {
  const colorClass = statusColors[column.name as keyof typeof statusColors] || 'text-gray-600';
  const icon = statusIcons[column.name as keyof typeof statusIcons] || '•';

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span>{icon}</span>
        <h2 className={`font-semibold text-base ${colorClass}`}>
          {column.name}
        </h2>
        <span className="text-sm text-gray-500 font-medium ml-auto">
          {column.items.length}
        </span>
      </div>
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`min-h-[400px] transition-colors duration-200 rounded-lg ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
          >
            {column.items.map((item, index) => (
              <IncidentCard 
                key={item.id} 
                item={item} 
                index={index}
                isExpanded={expandedCardId === item.id}
                onToggleExpand={onToggleExpand}
                onOpenModal={onOpenModal}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
