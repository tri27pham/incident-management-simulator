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
  onSolutionUpdate: (id: string, solution: string) => void;
  totalIncidents: number;
}

const statusProgressColors = {
  Triage: 'text-blue-500',
  Investigating: 'text-orange-500',
  Fixing: 'text-red-500',
};

export function IncidentColumn({ columnId, column, expandedCardId, onToggleExpand, onOpenModal, onDiagnosisUpdate, onSolutionUpdate, totalIncidents }: IncidentColumnProps) {
  const progressColor = statusProgressColors[column.name as keyof typeof statusProgressColors] || 'text-gray-600';
  const percentage = totalIncidents > 0 ? (column.items.length / totalIncidents) * 100 : 0;

  return (
    <div className="bg-tertiary rounded-lg p-4" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
      <div className="flex items-center gap-2 mb-4">
        <CircularProgress percentage={percentage} color={progressColor} size={20} />
        <h2 className="font-medium text-base text-primary">
          {column.name}
        </h2>
        <span className="text-base font-normal text-tertiary">
          {column.items.length}
        </span>
      </div>
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="min-h-[400px] transition-colors duration-200 rounded-lg"
            style={{
              backgroundColor: snapshot.isDraggingOver ? 'rgba(107, 114, 128, 0.15)' : 'transparent'
            }}
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
                onSolutionUpdate={onSolutionUpdate}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
