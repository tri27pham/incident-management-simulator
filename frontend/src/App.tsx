import { useState } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { IncidentBoardState, TrendMetric } from './types';
import { IncidentColumn } from './components/IncidentColumn';
import { TrendCard } from './components/TrendCard';

const trendMetrics: TrendMetric[] = [
  { label: 'Critical incidents', value: '+27%', change: 27, isPositive: true },
  { label: 'Time spent in incidents', value: '-31%', change: -31, isPositive: false },
  { label: 'Overnight work (11pm-8am)', value: '+14%', change: 14, isPositive: true },
];

const initialBoardState: IncidentBoardState = {
  Triage: {
    name: 'Triage',
    items: [
      {
        id: '1',
        incidentNumber: 'INC-6740',
        title: 'Summary update message failed to deliver because it was too long',
        timeElapsed: '7h 7m',
        severity: 'critical',
        team: 'Production',
      },
      {
        id: '2',
        incidentNumber: 'INC-6710',
        title: 'Full width drawer overlapping sidebar (ONC schedules)',
        timeElapsed: '12h 54m',
        severity: 'low',
        team: 'Production',
      },
    ],
  },
  Investigating: {
    name: 'Investigating',
    items: [
      {
        id: '3',
        incidentNumber: 'INC-6222',
        title: "Customer does not have slack_team_id set so announcement posts won't send",
        timeElapsed: '1h10m',
        severity: 'high',
        team: 'Data',
      },
      {
        id: '4',
        incidentNumber: 'INC-6739',
        title: 'Noisy alert regarding executor capacity on production',
        timeElapsed: '9d 3h',
        severity: 'critical',
        team: 'Production',
      },
      {
        id: '5',
        incidentNumber: 'INC-6735',
        title: 'At A Glance insights incorrect for 3 customers',
        timeElapsed: '1h10m',
        severity: 'minor',
        team: 'Production',
      },
    ],
  },
  Fixing: {
    name: 'Fixing',
    items: [
      {
        id: '6',
        incidentNumber: 'INC-6711',
        title: 'User service high error rate',
        timeElapsed: '46m',
        severity: 'high',
        team: 'Production',
      },
      {
        id: '7',
        incidentNumber: 'INC-6734',
        title: 'Customers report being unable to autoexport to Jira due to permission issue',
        timeElapsed: '10h 39m',
        severity: 'critical',
        team: 'Data',
      },
      {
        id: '8',
        incidentNumber: 'INC-6720',
        title: "Unable to display updates tab for four incidents with wonky 'merged' updates",
        timeElapsed: '2d 3h',
        severity: 'minor',
        team: 'Production',
      },
    ],
  },
};


function App() {
  const [board, setBoard] = useState(initialBoardState);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = board[source.droppableId as keyof IncidentBoardState];
    const destCol = board[destination.droppableId as keyof IncidentBoardState];
    const sourceItems = [...sourceCol.items];
    const destItems = [...destCol.items];
    const [removed] = sourceItems.splice(source.index, 1);

    if (source.droppableId === destination.droppableId) {
      // Moving within the same column
      sourceItems.splice(destination.index, 0, removed);
      setBoard({
        ...board,
        [source.droppableId]: { ...sourceCol, items: sourceItems },
      });
    } else {
      // Moving to a different column
      destItems.splice(destination.index, 0, removed);
      setBoard({
        ...board,
        [source.droppableId]: { ...sourceCol, items: sourceItems },
        [destination.droppableId]: { ...destCol, items: destItems },
      });
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <h1 className="text-xl font-semibold text-gray-900">Home</h1>
          </div>
          <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <span>🔥</span>
            Declare incident
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Trends Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trends</h2>
              <p className="text-sm text-gray-500">vs last 4 weeks</p>
            </div>
            <button className="text-sm text-gray-600 hover:text-gray-900">View all</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {trendMetrics.map((metric, index) => (
              <TrendCard key={index} metric={metric} />
            ))}
          </div>
        </section>

        {/* Active Incidents Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Active incidents</h2>
              <span className="text-sm text-gray-500 font-medium">
                {Object.values(board).reduce((sum, col) => sum + col.items.length, 0)}
              </span>
            </div>
            <button className="text-sm text-gray-600 hover:text-gray-900">View all</button>
          </div>
          
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(board).map(([columnId, column]) => (
                <IncidentColumn key={columnId} columnId={columnId} column={column} />
              ))}
            </div>
          </DragDropContext>
        </section>
      </main>
    </div>
  );
}

export default App;
