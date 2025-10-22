import { useState, useMemo, useEffect } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { IncidentBoardState, TrendMetric, Incident, IncidentSeverity } from './types';
import { IncidentColumn } from './components/IncidentColumn';
import { TrendCard } from './components/TrendCard';
import { IncidentModal } from './components/IncidentModal';
import { FilterBar } from './components/FilterBar';
import * as api from './services/api';
import { mapBackendIncidentToFrontend, mapBackendStatusToFrontend, mapFrontendStatusToBackend } from './services/incidentMapper';

const trendMetrics: TrendMetric[] = [
  { label: 'Critical incidents', value: '+27%', change: 27, isPositive: true },
  { label: 'Time spent in incidents', value: '-31%', change: -31, isPositive: false },
  { label: 'Overnight work (11pm-8am)', value: '+14%', change: 14, isPositive: true },
];

const emptyBoardState: IncidentBoardState = {
  Triage: {
    name: 'Triage',
    items: [],
  },
  Investigating: {
    name: 'Investigating',
    items: [],
  },
  Fixing: {
    name: 'Fixing',
    items: [],
  },
};

// Keep mock data as fallback
const mockBoardState: IncidentBoardState = {
  Triage: {
    name: 'Triage',
    items: [
      {
        id: '1',
        incidentNumber: 'INC-6740',
        title: 'Summary update message failed to deliver because it was too long',
        timeElapsed: '7h 7m',
        severity: 'high',
        team: 'Production',
        description: 'Summary notifications are failing to send when message length exceeds the maximum character limit. This affects automated incident summaries.',
        impact: 'Users are not receiving timely incident updates. Approximately 15% of summary messages affected.',
        affectedServices: ['Notification Service', 'Slack Integration', 'Email Service'],
        assignee: 'Sarah Chen',
        createdAt: 'Oct 21, 2025 10:30 AM',
        lastUpdate: '2 hours ago',
      },
      {
        id: '2',
        incidentNumber: 'INC-6710',
        title: 'Full width drawer overlapping sidebar (ONC schedules)',
        timeElapsed: '12h 54m',
        severity: 'low',
        team: 'Production',
        description: 'The schedule drawer is rendering at full width causing it to overlap with the main navigation sidebar on certain screen resolutions.',
        impact: 'Minor UI issue affecting user experience on specific screen sizes (1024px-1280px width).',
        affectedServices: ['Frontend UI', 'Schedule Manager'],
        assignee: 'Mike Rodriguez',
        createdAt: 'Oct 20, 2025 9:15 PM',
        lastUpdate: '3 hours ago',
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
        severity: 'medium',
        team: 'Data',
        description: 'A customer configuration is missing the required slack_team_id field, preventing announcement posts from being delivered to their Slack workspace.',
        impact: 'One major customer unable to receive incident announcements via Slack. Affecting their incident response workflow.',
        affectedServices: ['Slack Integration', 'Customer Config Service', 'Announcement API'],
        assignee: 'Alex Kim',
        createdAt: 'Oct 21, 2025 4:20 PM',
        lastUpdate: '15 minutes ago',
      },
      {
        id: '4',
        incidentNumber: 'INC-6739',
        title: 'Noisy alert regarding executor capacity on production',
        timeElapsed: '9d 3h',
        severity: 'high',
        team: 'Production',
        description: 'Production environment is generating excessive alerts about executor capacity limits. Alert threshold may need adjustment or underlying capacity issue needs investigation.',
        impact: 'Alert fatigue causing important notifications to be missed. Potential performance degradation if capacity is actually constrained.',
        affectedServices: ['Job Executor', 'Monitoring System', 'Alert Manager'],
        assignee: 'Jordan Taylor',
        createdAt: 'Oct 12, 2025 1:45 PM',
        lastUpdate: '1 day ago',
      },
      {
        id: '5',
        incidentNumber: 'INC-6735',
        title: 'At A Glance insights incorrect for 3 customers',
        timeElapsed: '1h10m',
        team: 'Production',
        description: 'Dashboard insights showing incorrect metrics for three specific customer accounts. Data aggregation query may have a bug.',
        impact: 'Three customers seeing inaccurate analytics data. Does not affect core functionality.',
        affectedServices: ['Analytics Service', 'Dashboard API'],
        assignee: 'Emma Watson',
        createdAt: 'Oct 21, 2025 4:20 PM',
        lastUpdate: '30 minutes ago',
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
        severity: 'medium',
        team: 'Production',
        description: 'User authentication service experiencing elevated error rates (15% of requests). Appears to be related to database connection pooling issues.',
        impact: 'Users experiencing intermittent login failures and session timeouts. Estimated 500+ users affected.',
        affectedServices: ['Auth Service', 'Database Pool', 'Session Manager'],
        assignee: 'Chris Anderson',
        createdAt: 'Oct 21, 2025 4:44 PM',
        lastUpdate: '10 minutes ago',
      },
      {
        id: '7',
        incidentNumber: 'INC-6734',
        title: 'Customers report being unable to autoexport to Jira due to permission issue',
        timeElapsed: '10h 39m',
        severity: 'high',
        team: 'Data',
        description: 'Jira integration failing for multiple customers due to OAuth permission scope changes. Autoexport feature completely non-functional.',
        impact: 'Critical workflow blocker for customers using Jira integration. 28 customers affected.',
        affectedServices: ['Jira Integration', 'OAuth Service', 'Export API'],
        assignee: 'Taylor Morgan',
        createdAt: 'Oct 21, 2025 6:51 AM',
        lastUpdate: '1 hour ago',
      },
      {
        id: '8',
        incidentNumber: 'INC-6720',
        title: "Unable to display updates tab for four incidents with wonky 'merged' updates",
        timeElapsed: '2d 3h',
        team: 'Production',
        description: 'Four specific incidents have malformed merged update records causing the updates tab to fail rendering. Data migration script may have introduced corrupt data.',
        impact: 'Four incidents cannot display their update history. Does not affect incident management functionality.',
        affectedServices: ['Updates Service', 'Frontend UI'],
        assignee: 'Sam Patel',
        createdAt: 'Oct 19, 2025 1:30 PM',
        lastUpdate: '8 hours ago',
      },
    ],
  },
};


function App() {
  const [board, setBoard] = useState(emptyBoardState);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [modalIncident, setModalIncident] = useState<Incident | null>(null);
  const [selectedSeverities, setSelectedSeverities] = useState<IncidentSeverity[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorRunning, setGeneratorRunning] = useState(false);
  const [isTogglingGenerator, setIsTogglingGenerator] = useState(false);

  const handleToggleExpand = (id: string) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  const handleOpenModal = (incident: Incident) => {
    setModalIncident(incident);
  };

  const handleCloseModal = () => {
    setModalIncident(null);
  };

  const handleSeverityToggle = (severity: IncidentSeverity) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  };

  const handleTeamToggle = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  const handleClearFilters = () => {
    setSelectedSeverities([]);
    setSelectedTeams([]);
  };

  const handleGenerateIncident = async () => {
    setIsGenerating(true);
    try {
      await api.generateRandomIncident();
      // WebSocket will handle the update automatically
      console.log('✅ Incident generated successfully');
    } catch (error) {
      console.error('Failed to generate incident:', error);
      setError('Failed to generate incident');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleGenerator = async () => {
    setIsTogglingGenerator(true);
    try {
      if (generatorRunning) {
        await api.stopGenerator();
        setGeneratorRunning(false);
        console.log('✅ Generator stopped');
      } else {
        await api.startGenerator();
        setGeneratorRunning(true);
        console.log('✅ Generator started');
      }
    } catch (error) {
      console.error('Failed to toggle generator:', error);
      setError(`Failed to ${generatorRunning ? 'stop' : 'start'} generator`);
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsTogglingGenerator(false);
    }
  };

  // Check generator status on mount
  useEffect(() => {
    async function checkGeneratorStatus() {
      try {
        const status = await api.getGeneratorStatus();
        setGeneratorRunning(status.is_running);
      } catch (error) {
        console.error('Failed to check generator status:', error);
      }
    }
    checkGeneratorStatus();
  }, []);

  const handleDiagnosisUpdate = (id: string, diagnosis: string) => {
    setBoard((prevBoard) => {
      // Find and update the incident across all columns
      const newBoard = { ...prevBoard };
      
      for (const columnKey in newBoard) {
        const column = newBoard[columnKey as keyof typeof newBoard];
        const itemIndex = column.items.findIndex((item) => item.id === id);
        
        if (itemIndex !== -1) {
          // Create new items array with updated incident
          const updatedItems = [...column.items];
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            diagnosis,
            hasDiagnosis: true,
          };
          
          newBoard[columnKey as keyof typeof newBoard] = {
            ...column,
            items: updatedItems,
          };
          
          // Update modal if it's open for this incident
          if (modalIncident?.id === id) {
            setModalIncident({
              ...modalIncident,
              diagnosis,
              hasDiagnosis: true,
            });
          }
          
          break;
        }
      }
      
      return newBoard;
    });
  };

  const handleSolutionUpdate = (id: string, solution: string) => {
    setBoard((prevBoard) => {
      // Find and update the incident across all columns
      const newBoard = { ...prevBoard };
      
      for (const columnKey in newBoard) {
        const column = newBoard[columnKey as keyof typeof newBoard];
        const itemIndex = column.items.findIndex((item) => item.id === id);
        
        if (itemIndex !== -1) {
          // Create new items array with updated incident
          const updatedItems = [...column.items];
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            solution,
            hasSolution: true,
          };
          
          newBoard[columnKey as keyof typeof newBoard] = {
            ...column,
            items: updatedItems,
          };
          
          // Update modal if it's open for this incident
          if (modalIncident?.id === id) {
            setModalIncident({
              ...modalIncident,
              solution,
              hasSolution: true,
            });
          }
          
          break;
        }
      }
      
      return newBoard;
    });
  };

  // Fetch incidents from backend on mount
  useEffect(() => {
    async function loadIncidents() {
      try {
        setLoading(true);
        const backendIncidents = await api.fetchIncidents();
        
        // Group incidents by status
        const newBoard: IncidentBoardState = {
          Triage: { name: 'Triage', items: [] },
          Investigating: { name: 'Investigating', items: [] },
          Fixing: { name: 'Fixing', items: [] },
        };

        backendIncidents.forEach((backendIncident) => {
          const incident = mapBackendIncidentToFrontend(backendIncident);
          const status = mapBackendStatusToFrontend(backendIncident.status);
          newBoard[status].items.push(incident);
        });

        setBoard(newBoard);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch incidents:', err);
        setError('Failed to load incidents. Using mock data.');
        // Fallback to mock data
        setBoard(mockBoardState);
      } finally {
        setLoading(false);
      }
    }

    loadIncidents();
  }, []);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const ws = api.connectWebSocket((data) => {
      console.log('WebSocket message received:', data);
      
      // Update the board with new/updated incident
      setBoard((prevBoard) => {
        const incident = mapBackendIncidentToFrontend(data);
        const status = mapBackendStatusToFrontend(data.status);
        
        // Update modal if it's open for this incident
        if (modalIncident?.id === incident.id) {
          setModalIncident(incident);
        }
        
        // Remove incident from all columns first
        const newBoard: IncidentBoardState = {
          Triage: { ...prevBoard.Triage, items: prevBoard.Triage.items.filter(i => i.id !== incident.id) },
          Investigating: { ...prevBoard.Investigating, items: prevBoard.Investigating.items.filter(i => i.id !== incident.id) },
          Fixing: { ...prevBoard.Fixing, items: prevBoard.Fixing.items.filter(i => i.id !== incident.id) },
        };
        
        // Add to correct column
        newBoard[status].items.push(incident);
        
        return newBoard;
      });
    });

    return () => {
      ws.close();
    };
  }, [modalIncident]);

  // Get all unique teams
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    Object.values(board).forEach((column) => {
      column.items.forEach((item) => teams.add(item.team));
    });
    return Array.from(teams).sort();
  }, [board]);

  // Filter incidents based on selected filters
  const filteredBoard = useMemo(() => {
    const hasFilters = selectedSeverities.length > 0 || selectedTeams.length > 0;
    if (!hasFilters) return board;

    const filtered: IncidentBoardState = {
      Triage: { ...board.Triage, items: [] },
      Investigating: { ...board.Investigating, items: [] },
      Fixing: { ...board.Fixing, items: [] },
    };

    Object.entries(board).forEach(([columnId, column]) => {
      const filteredItems = column.items.filter((item) => {
        const severityMatch =
          selectedSeverities.length === 0 ||
          (item.severity && selectedSeverities.includes(item.severity)) ||
          (!item.severity && selectedSeverities.includes('minor'));
        const teamMatch = selectedTeams.length === 0 || selectedTeams.includes(item.team);
        return severityMatch && teamMatch;
      });
      filtered[columnId as keyof IncidentBoardState].items = filteredItems;
    });

    return filtered;
  }, [board, selectedSeverities, selectedTeams]);

  const totalIncidents = Object.values(filteredBoard).reduce((sum, col) => sum + col.items.length, 0);

  const onDragEnd = async (result: DropResult) => {
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
      // Moving to a different column - update UI optimistically
      destItems.splice(destination.index, 0, removed);
      setBoard({
        ...board,
        [source.droppableId]: { ...sourceCol, items: sourceItems },
        [destination.droppableId]: { ...destCol, items: destItems },
      });

      // Call backend API to update status
      try {
        const newStatus = mapFrontendStatusToBackend(destination.droppableId);
        await api.updateIncidentStatus(removed.id, newStatus);
        console.log(`✅ Updated incident ${removed.id} to status ${newStatus}`);
      } catch (error) {
        console.error('Failed to update incident status:', error);
        // Revert the change on error
        const revertedSourceItems = [...sourceItems];
        revertedSourceItems.splice(source.index, 0, removed);
        const revertedDestItems = destItems.filter(item => item.id !== removed.id);
        setBoard({
          ...board,
          [source.droppableId]: { ...sourceCol, items: revertedSourceItems },
          [destination.droppableId]: { ...destCol, items: revertedDestItems },
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading incidents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <h1 className="text-xl font-semibold text-gray-900">Home</h1>
            {error && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                {error}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleGenerateIncident}
              disabled={isGenerating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Generate Incident
                </>
              )}
            </button>
            
            <button 
              onClick={handleToggleGenerator}
              disabled={isTogglingGenerator}
              className={`${
                generatorRunning 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isTogglingGenerator ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {generatorRunning ? 'Stopping...' : 'Starting...'}
                </>
              ) : generatorRunning ? (
                <>
                  <span>⏸</span>
                  Stop Generator
                </>
              ) : (
                <>
                  <span>▶</span>
                  Start Generator
                </>
              )}
            </button>
          </div>
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
                {totalIncidents}
              </span>
            </div>
            <button className="text-sm text-gray-600 hover:text-gray-900">View all</button>
          </div>

          {/* Filters */}
          <FilterBar
            selectedSeverities={selectedSeverities}
            selectedTeams={selectedTeams}
            availableTeams={availableTeams}
            onSeverityToggle={handleSeverityToggle}
            onTeamToggle={handleTeamToggle}
            onClearFilters={handleClearFilters}
          />
          
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(filteredBoard).map(([columnId, column]) => (
                <IncidentColumn 
                  key={columnId} 
                  columnId={columnId} 
                  column={column}
                  expandedCardId={expandedCardId}
                  onToggleExpand={handleToggleExpand}
                  onOpenModal={handleOpenModal}
                  onDiagnosisUpdate={handleDiagnosisUpdate}
                  onSolutionUpdate={handleSolutionUpdate}
                  totalIncidents={totalIncidents}
                />
              ))}
            </div>
          </DragDropContext>
        </section>
      </main>

      {/* Modal */}
      {modalIncident && (
        <IncidentModal incident={modalIncident} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;
