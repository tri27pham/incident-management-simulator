import { Droppable } from 'react-beautiful-dnd';
import { Incident } from '../types';
import { IncidentCard } from './IncidentCard';
import { CircularProgress } from './CircularProgress';

interface IncidentColumnProps {
  columnId: string;
  column: {
    name: string;
    items: Incident[];
  };
  expandedCardId: string | null;
  onToggleExpand: (id: string) => void;
  onOpenModal: (incident: Incident) => void;
  onDiagnosisUpdate: (id: string, diagnosis: string) => void;
  totalIncidents: number;
}

const statusColors = {
  Triage: 'text-gray-900',
  Investigating: 'text-gray-900',
  Fixing: 'text-gray-900',
};

const statusProgressColors = {
  Triage: 'text-blue-500',
  Investigating: 'text-orange-500',
  Fixing: 'text-red-500',
};

export function IncidentColumn({ columnId, column, expandedCardId, onToggleExpand, onOpenModal, onDiagnosisUpdate, totalIncidents }: IncidentColumnProps) {
  const colorClass = statusColors[column.name as keyof typeof statusColors] || 'text-gray-600';
  const progressColor = statusProgressColors[column.name as keyof typeof statusProgressColors] || 'text-gray-600';
  const percentage = totalIncidents > 0 ? (column.items.length / totalIncidents) * 100 : 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <CircularProgress percentage={percentage} color={progressColor} size={20} />
        <h2 className={`font-medium text-base ${colorClass}`}>
          {column.name}
        </h2>
        <span className="text-base text-gray-400 font-normal">
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
                onDiagnosisUpdate={onDiagnosisUpdate}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
