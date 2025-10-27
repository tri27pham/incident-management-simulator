import { useState, useMemo, useEffect, useRef } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { IncidentBoardState, Incident, IncidentSeverity } from './types';
import { IncidentColumn } from './components/IncidentColumn';
import { IncidentModal } from './components/IncidentModal';
import { FilterBar } from './components/FilterBar';
import { ResolvedIncidentsPanel } from './components/ResolvedIncidentsPanel';
import * as api from './services/api';
import { mapBackendIncidentToFrontend, mapBackendStatusToFrontend, mapFrontendStatusToBackend } from './services/incidentMapper';
import { useTheme } from './contexts/ThemeContext';

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
        status: 'Triage',
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
        status: 'Triage',
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
        status: 'Investigating',
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
        status: 'Investigating',
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
        status: 'Investigating',
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
        status: 'Fixing',
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
        status: 'Fixing',
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
        status: 'Fixing',
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
  const { theme, toggleTheme } = useTheme();
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
  const [showResolvedPanel, setShowResolvedPanel] = useState(false);
  const [resolvedIncidents, setResolvedIncidents] = useState<Incident[]>([]);
  const [showFailureDropdown, setShowFailureDropdown] = useState(false);
  const [isTriggeringFailure, setIsTriggeringFailure] = useState(false);
  const [progressBar, setProgressBar] = useState<{ show: boolean; message: string; progress: number } | null>(null);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [redisMemoryPercent, setRedisMemoryPercent] = useState<number | null>(null);
  const [postgresIdleConnections, setPostgresIdleConnections] = useState<number | null>(null);
  const [systemsHealth, setSystemsHealth] = useState<{
    'redis-test': {
      health: number;
      memory_used: number;
      memory_max: number;
      memory_percent: number;
      status: string;
    };
    'postgres-test'?: {
      health: number;
      idle_connections: number;
      active_connections: number;
      total_connections: number;
      max_connections: number;
      idle_ratio: number;
      status: string;
    };
  } | null>(null);
  
  // Use a ref to avoid WebSocket reconnections when modal changes
  const modalIncidentRef = useRef<Incident | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const waitingForRedisIncident = useRef<boolean>(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    modalIncidentRef.current = modalIncident;
  }, [modalIncident]);

  // Lock body scroll when modal or resolved panel is open
  useEffect(() => {
    if (modalIncident || showResolvedPanel) {
      // Save original overflow value
      const originalOverflow = document.body.style.overflow;
      // Lock scroll
      document.body.style.overflow = 'hidden';
      
      // Cleanup: restore original overflow when modal/panel closes
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [modalIncident, showResolvedPanel]);

  // Close dropdown when clicking outside and fetch Redis status when opening
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFailureDropdown(false);
      }
    }

    if (showFailureDropdown) {
      // Fetch system status when dropdown opens
      async function fetchSystemStatus() {
        try {
          const status = await api.getHealthMonitorStatus();
          const memoryPercent = status.services['redis-test'].memory_percent;
          setRedisMemoryPercent(memoryPercent);
          console.log(`📊 Redis memory: ${memoryPercent}%`);
          
          if (status.services['postgres-test']) {
            const idleConns = status.services['postgres-test'].idle_connections;
            setPostgresIdleConnections(idleConns);
            console.log(`📊 PostgreSQL idle connections: ${idleConns}`);
          }
        } catch (error) {
          console.error('Failed to fetch system status:', error);
          setRedisMemoryPercent(null);
          setPostgresIdleConnections(null);
        }
      }
      fetchSystemStatus();
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFailureDropdown]);

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Poll systems health every 5 seconds
  useEffect(() => {
    async function fetchSystemsHealth() {
      try {
        const status = await api.getHealthMonitorStatus();
        
        // Log health status updates for debugging
        if (status.services['redis-test']) {
          const redis = status.services['redis-test'];
          console.log(`🏥 Systems health update: Redis ${redis.health}% healthy (${redis.memory_percent.toFixed(1)}% memory)`);
        }
        
        setSystemsHealth(status.services);
      } catch (error) {
        console.error('❌ Failed to fetch systems health:', error);
      }
    }

    // Fetch immediately
    console.log('🏥 Starting systems health polling...');
    fetchSystemsHealth();

    // Then poll every 5 seconds
    const interval = setInterval(fetchSystemsHealth, 5000);

    return () => {
      console.log('🏥 Stopping systems health polling');
      clearInterval(interval);
    };
  }, []);

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
    console.log('🎲 Generating new incident...');
    try {
      const incident = await api.generateRandomIncident();
      console.log(`✅ Incident generated successfully:`, {
        id: incident.id,
        message: incident.message.substring(0, 50) + '...',
        source: incident.source,
        status: incident.status
      });
      // WebSocket will handle the update automatically
      console.log('⏳ Waiting for WebSocket broadcast...');
    } catch (error) {
      console.error('❌ Failed to generate incident:', error);
      setError('Failed to generate incident');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = async () => {
    setIsFixingAll(true);
    
    // Close any open modal
    setModalIncident(null);
    
    try {
      console.log(`🔄 ========== STARTING SYSTEM RESET ==========`);
      
      // Step 1: Clear Redis to restore service health
      console.log('🧹 Step 1: Clearing Redis memory...');
      try {
        const redisResult = await api.clearRedis();
        console.log('✅ Redis cleared successfully:', redisResult);
      } catch (clearError) {
        console.error('❌ Failed to clear Redis:', clearError);
        setError('Failed to restore Redis health');
        setTimeout(() => setError(null), 3000);
        setIsFixingAll(false);
        return;
      }

      // Step 1.5: Clear PostgreSQL connections to restore service health
      console.log('🧹 Step 1.5: Clearing PostgreSQL connections...');
      try {
        const postgresResult = await api.clearPostgres();
        console.log('✅ PostgreSQL cleared successfully:', postgresResult);
        
        // Fetch updated health status for both services
        const healthStatus = await api.getHealthMonitorStatus();
        console.log('📊 Systems health after clear:', {
          redis: healthStatus.services['redis-test'].health,
          postgres: healthStatus.services['postgres-test']?.health
        });
        setSystemsHealth(healthStatus.services);
      } catch (clearError) {
        console.error('❌ Failed to clear PostgreSQL:', clearError);
        setError('Failed to restore PostgreSQL health');
        setTimeout(() => setError(null), 3000);
        setIsFixingAll(false);
        return;
      }

      // Step 2: Call backend reset endpoint to truncate all database tables
      console.log('🗑️  Step 2: Truncating all database tables...');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/reset`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          throw new Error('Failed to reset database');
        }
        
        console.log('✅ Database reset successful - all tables truncated');
      } catch (resetError) {
        console.error('❌ Failed to reset database:', resetError);
        setError('Failed to reset database');
        setTimeout(() => setError(null), 3000);
        setIsFixingAll(false);
        return;
      }

      // Step 3: Clear UI (WebSocket will also send reset message, but clear immediately for better UX)
      setBoard(emptyBoardState);
      setResolvedIncidents([]);
      console.log('✅ Step 3: UI cleared');

      console.log('✅ ========== SYSTEM RESET COMPLETE ==========');

    } catch (error) {
      console.error('❌ Unexpected error in Reset:', error);
      setError('Failed to reset system');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsFixingAll(false);
    }
  };

  const handleOverloadRedis = async () => {
    setIsTriggeringFailure(true);
    setShowFailureDropdown(false);
    
    try {
      // Clear Redis first to ensure clean test
      console.log('🧹 Clearing Redis...');
      setProgressBar({ 
        show: true, 
        message: 'Preparing Redis...', 
        progress: 0 
      });
      
      await api.clearRedis();
      console.log('✅ Redis cleared');
      
      // Small delay to let the clear propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get initial state
      const initialStatus = await api.getHealthMonitorStatus();
      const initialMemory = initialStatus.services['redis-test'].memory_percent;
      
      console.log(`🎬 Starting Redis fill - Initial memory: ${initialMemory}%`);
      
      // Show progress bar with initial state
      setProgressBar({ 
        show: true, 
        message: `Starting from ${initialMemory.toFixed(1)}% memory...`, 
        progress: initialMemory 
      });
      waitingForRedisIncident.current = true;
      
      // Start polling immediately before triggering
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
      
      progressIntervalRef.current = window.setInterval(async () => {
        try {
          const status = await api.getHealthMonitorStatus();
          const redisStatus = status.services['redis-test'];
          const memoryPercent = redisStatus.memory_percent;
          
          console.log(`📊 Redis memory: ${memoryPercent}% full (Health: ${redisStatus.health}%)`);
          
          // Update progress bar based on real memory usage
          let progress = memoryPercent;
          let message = '';
          
          if (memoryPercent < 30) {
            message = `Filling Redis memory... ${memoryPercent.toFixed(1)}%`;
          } else if (memoryPercent < 70) {
            message = `Redis memory: ${memoryPercent.toFixed(1)}% full`;
          } else if (memoryPercent < 90) {
            message = `Redis memory: ${memoryPercent.toFixed(1)}% full (approaching threshold)`;
          } else {
            message = `Waiting for incident detection... (Memory: ${memoryPercent.toFixed(1)}%)`;
            // Cap at 95% while waiting for incident
            progress = Math.min(95, 90 + (memoryPercent - 90) / 2);
          }
          
          setProgressBar({ show: true, message, progress });
          
        } catch (pollError) {
          console.error('Failed to poll health status:', pollError);
        }
      }, 300); // Poll every 300ms for faster updates during fill
      
      // Trigger the failure (this happens in parallel with polling)
      const result = await api.triggerRedisMemoryFailure();
      console.log('✅ Redis memory failure triggered:', result);
      
      // Fallback: After 12 seconds, check if incident was created
      setTimeout(async () => {
        if (waitingForRedisIncident.current) {
          console.log('⏰ Checking if incident was created...');
          try {
            // Poll backend for new redis-test incidents
            const incidents = await api.fetchIncidents();
            const redisIncidents = incidents.filter((inc: any) => inc.source === 'redis-test');
            
            if (redisIncidents.length > 0) {
              console.log('✅ Found redis-test incident - completing progress bar');
              setProgressBar({ show: true, message: 'Incident detected!', progress: 100 });
              
              // Reload board to show the new incident
              const [backendIncidents, backendResolvedIncidents] = await Promise.all([
                api.fetchIncidents(),
                api.fetchResolvedIncidents(),
              ]);
              
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

              const resolved = backendResolvedIncidents.map(mapBackendIncidentToFrontend);
              setBoard(newBoard);
              setResolvedIncidents(resolved);
              
              // Clear progress bar after 2 seconds
              setTimeout(() => {
                setProgressBar(null);
                waitingForRedisIncident.current = false;
              }, 2000);
            } else {
              console.log('❌ No redis-test incident found');
              setProgressBar({ show: true, message: 'No incident created - refresh page', progress: 95 });
              setTimeout(() => setProgressBar(null), 3000);
            }
          } catch (error) {
            console.error('Failed to check for incident:', error);
            setProgressBar(null);
          }
          
          // Stop polling
          if (progressIntervalRef.current) {
            window.clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          waitingForRedisIncident.current = false;
        }
      }, 12000);
      
    } catch (error) {
      console.error('Failed to trigger failure:', error);
      setError('Failed to trigger failure');
      setTimeout(() => setError(null), 3000);
      setProgressBar(null);
      waitingForRedisIncident.current = false;
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
    } finally {
      setIsTriggeringFailure(false);
    }
  };

  const handleTriggerPostgresConnections = async () => {
    setIsTriggeringFailure(true);
    setShowFailureDropdown(false);
    
    try {
      console.log('🔥 Triggering PostgreSQL connection exhaustion...');
      setProgressBar({ 
        show: true, 
        message: 'Creating idle PostgreSQL connections...', 
        progress: 30 
      });
      
      const result = await api.triggerPostgresConnectionFailure();
      console.log('✅ PostgreSQL connections created:', result);
      
      setProgressBar({ 
        show: true, 
        message: 'Waiting for incident detection...', 
        progress: 70 
      });
      
      // Wait for incident to be created (5 seconds per health monitor)
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      setProgressBar({ 
        show: true, 
        message: 'Incident detected!', 
        progress: 100 
      });
      
      // Reload board
      const [backendIncidents, backendResolvedIncidents] = await Promise.all([
        api.fetchIncidents(),
        api.fetchResolvedIncidents(),
      ]);
      
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

      const resolved = backendResolvedIncidents.map(mapBackendIncidentToFrontend);
      setBoard(newBoard);
      setResolvedIncidents(resolved);
      
      // Clear progress bar after 2 seconds
      setTimeout(() => setProgressBar(null), 2000);
      
    } catch (error) {
      console.error('Failed to trigger PostgreSQL failure:', error);
      setError('Failed to trigger PostgreSQL failure');
      setTimeout(() => setError(null), 3000);
      setProgressBar(null);
    } finally {
      setIsTriggeringFailure(false);
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

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      // Map frontend status to backend format
      const backendStatus = mapFrontendStatusToBackend(newStatus);
      
      // Call API to update status
      await api.updateIncidentStatus(id, backendStatus);
      
      // The WebSocket will handle the actual state update, including status history
      // But we can optimistically update the UI
      setBoard((prevBoard) => {
        const newBoard = { ...prevBoard };
        
        // Find the incident in its current column
        let incident: Incident | null = null;
        let sourceColumn: keyof IncidentBoardState | null = null;
        
        for (const columnKey in newBoard) {
          const column = newBoard[columnKey as keyof typeof newBoard];
          const itemIndex = column.items.findIndex((item) => item.id === id);
          
          if (itemIndex !== -1) {
            incident = column.items[itemIndex];
            sourceColumn = columnKey as keyof IncidentBoardState;
            
            // Remove from source column
            newBoard[sourceColumn] = {
              ...column,
              items: column.items.filter((item) => item.id !== id),
            };
            break;
          }
        }
        
        if (incident && sourceColumn) {
          // Add to destination column (or remove if Resolved)
          if (newStatus !== 'Resolved') {
            // Update incident status
            const updatedIncident: Incident = {
              ...incident,
              status: newStatus as 'Triage' | 'Investigating' | 'Fixing',
            };
            
            const destColumn = newBoard[newStatus as keyof IncidentBoardState];
            if (destColumn) {
              newBoard[newStatus as keyof IncidentBoardState] = {
                ...destColumn,
                items: [...destColumn.items, updatedIncident],
              };
            }
            
            // Update modal if it's open for this incident
            if (modalIncident?.id === id) {
              setModalIncident(updatedIncident);
            }
          } else {
            // Incident is being resolved - it will be fetched from backend on next load
            // For immediate UI update, add to resolved list
            setResolvedIncidents((prev) => [incident, ...prev]);
            
            // Close modal if incident is resolved
            if (modalIncident?.id === id) {
              setModalIncident(null);
            }
          }
        }
        
        return newBoard;
      });
    } catch (error) {
      console.error('Failed to update incident status:', error);
      // Could add error toast notification here
    }
  };

  // Fetch incidents from backend on mount
  useEffect(() => {
    async function loadIncidents() {
      try {
        setLoading(true);
        
        // Fetch active and resolved incidents in parallel
        const [backendIncidents, backendResolvedIncidents] = await Promise.all([
          api.fetchIncidents(),
          api.fetchResolvedIncidents(),
        ]);
        
        // Group active incidents by status
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

        // Map resolved incidents
        const resolved = backendResolvedIncidents.map(mapBackendIncidentToFrontend);

        setBoard(newBoard);
        setResolvedIncidents(resolved);
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

  // Set up WebSocket connection for real-time updates with auto-reconnection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseReconnectDelay = 1000; // Start with 1 second
    
    const connect = () => {
      console.log('🔌 Attempting to connect WebSocket...');
      try {
        ws = api.connectWebSocket((data) => {
          console.log('📨 WebSocket message received:', data);
          
          // Reset reconnect attempts on successful message
          reconnectAttempts = 0;
          
          // Check if this is a reset message
          if ((data as any).type === 'reset') {
            console.log('🔄 Database reset detected - clearing all incidents from UI');
            setBoard(emptyBoardState);
            setResolvedIncidents([]);
            setModalIncident(null);
            return;
          }
          
          const incident = mapBackendIncidentToFrontend(data);
          const isResolved = data.status === 'resolved';
          const status = mapBackendStatusToFrontend(data.status);
          
          console.log(`✨ Processing incident ${incident.incidentNumber} -> ${isResolved ? 'resolved' : status}`);
          
          // Check if this is a redis-test incident (complete progress bar)
          console.log('🔍 Checking incident source:', {
            source: data.source,
            waitingFlag: waitingForRedisIncident.current,
            willComplete: data.source === 'redis-test' && waitingForRedisIncident.current
          });
          
          if (data.source === 'redis-test' && waitingForRedisIncident.current) {
            console.log('🎯 Redis incident detected - completing progress bar');
            setProgressBar({ show: true, message: 'Incident created!', progress: 100 });
            waitingForRedisIncident.current = false;
            if (progressIntervalRef.current) {
              window.clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            // Hide progress bar after 1.5 seconds
            setTimeout(() => {
              setProgressBar(null);
            }, 1500);
          }
          
          // Update modal if it's open for this incident (use ref to avoid reconnection)
          if (modalIncidentRef.current?.id === incident.id) {
            setModalIncident(incident);
            console.log('🔄 Updated modal incident');
          }
          
          // If incident is resolved, move it to resolved list
          if (isResolved) {
            console.log(`🎉 Incident ${incident.incidentNumber} resolved - moving to resolved panel`);
            
            // Remove from board
            setBoard((prevBoard) => {
              const newBoard: IncidentBoardState = {
                Triage: { ...prevBoard.Triage, items: [...prevBoard.Triage.items] },
                Investigating: { ...prevBoard.Investigating, items: [...prevBoard.Investigating.items] },
                Fixing: { ...prevBoard.Fixing, items: [...prevBoard.Fixing.items] },
              };
              
              // Find and remove incident from any column
              for (const columnKey of Object.keys(newBoard) as Array<keyof IncidentBoardState>) {
                const index = newBoard[columnKey].items.findIndex(i => i.id === incident.id);
                if (index >= 0) {
                  newBoard[columnKey].items.splice(index, 1);
                  console.log(`📦 Removed incident ${incident.incidentNumber} from ${columnKey} column`);
                  break;
                }
              }
              
              return newBoard;
            });
            
            // Add to resolved incidents (at the beginning)
            setResolvedIncidents((prev) => {
              // Check if already in resolved list
              const existingIndex = prev.findIndex(i => i.id === incident.id);
              if (existingIndex >= 0) {
                // Update existing
                const updated = [...prev];
                updated[existingIndex] = incident;
                return updated;
              } else {
                // Add new at the beginning
                return [incident, ...prev];
              }
            });
            
          } else {
            // Update the board with new/updated incident
            setBoard((prevBoard) => {
              const newBoard: IncidentBoardState = {
                Triage: { ...prevBoard.Triage, items: [...prevBoard.Triage.items] },
                Investigating: { ...prevBoard.Investigating, items: [...prevBoard.Investigating.items] },
                Fixing: { ...prevBoard.Fixing, items: [...prevBoard.Fixing.items] },
              };
              
              // First, find if incident exists anywhere in the board
              let existingColumnKey: keyof IncidentBoardState | null = null;
              let existingIndex = -1;
              
              for (const columnKey of Object.keys(newBoard) as Array<keyof IncidentBoardState>) {
                const index = newBoard[columnKey].items.findIndex(i => i.id === incident.id);
                if (index >= 0) {
                  existingColumnKey = columnKey;
                  existingIndex = index;
                  break;
                }
              }
              
              if (existingColumnKey !== null) {
                // Incident exists in the board
                if (existingColumnKey === status) {
                  // Same column - update in place (preserve position)
                  newBoard[status].items[existingIndex] = incident;
                  console.log(`🔄 Updated incident ${incident.incidentNumber} at position ${existingIndex} in ${status} column`);
                } else {
                  // Different column - remove from old, add to new
                  newBoard[existingColumnKey].items.splice(existingIndex, 1);
                  newBoard[status].items.push(incident);
                  console.log(`📦 Moved incident ${incident.incidentNumber} from ${existingColumnKey} to ${status} column`);
                }
              } else {
                // New incident - add to target column
                newBoard[status].items.push(incident);
                console.log(`✅ Added new incident ${incident.incidentNumber} to ${status} column`);
              }
              
              return newBoard;
            });
          }
        });
        
        console.log('✅ WebSocket instance created, setting onclose handler...');
        
        // Handle WebSocket close event for automatic reconnection
        ws.onclose = () => {
          console.log('❌ WebSocket disconnected');
          console.log(`📊 Reconnection state: attempts=${reconnectAttempts}/${maxReconnectAttempts}`);
          
          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
            reconnectAttempts++;
            console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
            
            reconnectTimeout = window.setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('❌ Max reconnection attempts reached. Please refresh the page.');
            setError('Lost connection to server. Please refresh the page.');
          }
        };
        
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
      }
    };
    
    // Initial connection
    connect();

    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.onclose = null; // Prevent reconnection on intentional close
        ws.close();
      }
    };
  }, []); // Empty dependencies - WebSocket stays connected for the app lifetime

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
    // Prevent drag operations while fixing all incidents
    if (isFixingAll) return;
    
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
      // Moving to a different column - update status optimistically
      const updatedIncident = {
        ...removed,
        status: destination.droppableId as 'Triage' | 'Investigating' | 'Fixing',
      };
      
      destItems.splice(destination.index, 0, updatedIncident);
      setBoard({
        ...board,
        [source.droppableId]: { ...sourceCol, items: sourceItems },
        [destination.droppableId]: { ...destCol, items: destItems },
      });

      // Call backend API to update status (backend will create history entry and broadcast update)
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: `rgb(var(--bg-primary))` }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p style={{ color: `rgb(var(--text-secondary))` }}>Loading incidents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: `rgb(var(--bg-primary))` }}>
      {/* Progress Bar */}
      {progressBar?.show && (
        <div className="fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: `rgb(var(--bg-secondary))`, borderBottom: `1px solid rgb(var(--border-color))` }}>
          <div className="px-6 py-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-3 mb-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" style={{ color: 'rgb(249, 115, 22)' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                  {progressBar.message}
                </span>
                <span className="text-xs ml-auto" style={{ color: `rgb(var(--text-tertiary))` }}>
                  {Math.round(progressBar.progress)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                <div 
                  className="h-full transition-all duration-200 ease-out"
                  style={{ 
                    width: `${progressBar.progress}%`,
                    backgroundColor: progressBar.progress === 100 ? 'rgb(34, 197, 94)' : 'rgb(249, 115, 22)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="px-6 py-4" style={{ 
        backgroundColor: `rgb(var(--bg-secondary))`,
        borderBottom: `1px solid rgb(var(--border-color))`
      }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <h1 className="text-xl font-semibold" style={{ color: `rgb(var(--text-primary))` }}>Home</h1>
            {error && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                {error}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleGenerateIncident}
              disabled={isGenerating || isFixingAll}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border"
              style={{
                backgroundColor: `rgb(var(--card-bg))`,
                borderColor: `rgb(var(--border-color))`,
                color: `rgb(var(--text-primary))`,
              }}
              onMouseEnter={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`;
                  e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `rgb(var(--card-bg))`;
                e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
              }}
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

            {/* Trigger Failure Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowFailureDropdown(!showFailureDropdown)}
                disabled={isTriggeringFailure || isFixingAll}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border"
                style={{
                  backgroundColor: `rgb(var(--card-bg))`,
                  borderColor: `rgb(var(--border-color))`,
                  color: `rgb(var(--text-primary))`,
                }}
                onMouseEnter={(e) => {
                  if (!isTriggeringFailure) {
                    e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`;
                    e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `rgb(var(--card-bg))`;
                  e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
                }}
              >
                {isTriggeringFailure ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Triggering...
                  </>
                ) : (
                  <>
                    <span>💥</span>
                    Trigger Failure
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {showFailureDropdown && (
                <div 
                  className="absolute top-full mt-2 right-0 rounded-lg shadow-lg border z-50 p-3"
                  style={{
                    backgroundColor: `rgb(var(--card-bg))`,
                    borderColor: `rgb(var(--border-color))`,
                    minWidth: '240px',
                  }}
                >
                  <button
                    onClick={handleOverloadRedis}
                    disabled={redisMemoryPercent !== null && redisMemoryPercent > 90}
                    className="w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center gap-3 rounded-lg border disabled:cursor-not-allowed"
                    style={{
                      color: `rgb(var(--text-primary))`,
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      opacity: (redisMemoryPercent !== null && redisMemoryPercent > 90) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (redisMemoryPercent === null || redisMemoryPercent <= 90) {
                        e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (redisMemoryPercent === null || redisMemoryPercent <= 90) {
                        e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(239, 68, 68)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Overload Redis Memory</div>
                      <div className="text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                        {redisMemoryPercent !== null && redisMemoryPercent > 90 
                          ? `Already full (${redisMemoryPercent.toFixed(1)}%)`
                          : 'Fill memory to 90%+'
                        }
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={handleTriggerPostgresConnections}
                    disabled={postgresIdleConnections !== null && postgresIdleConnections > 10}
                    className="w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center gap-3 rounded-lg border disabled:cursor-not-allowed mt-2"
                    style={{
                      color: `rgb(var(--text-primary))`,
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      opacity: (postgresIdleConnections !== null && postgresIdleConnections > 10) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (postgresIdleConnections === null || postgresIdleConnections <= 10) {
                        e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (postgresIdleConnections === null || postgresIdleConnections <= 10) {
                        e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(147, 51, 234)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Exhaust PostgreSQL Connections</div>
                      <div className="text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                        {postgresIdleConnections !== null && postgresIdleConnections > 10 
                          ? `Already exhausted (${postgresIdleConnections} idle)`
                          : 'Create 12 idle connections'
                        }
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleToggleGenerator}
              disabled={isTogglingGenerator || isFixingAll}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border"
              style={{
                backgroundColor: generatorRunning ? 'rgb(249, 115, 22)' : `rgb(var(--card-bg))`,
                borderColor: 'rgb(249, 115, 22)',
                color: generatorRunning ? 'white' : `rgb(var(--text-primary))`,
              }}
              onMouseEnter={(e) => {
                if (!isTogglingGenerator && !generatorRunning) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`;
                }
              }}
              onMouseLeave={(e) => {
                if (!generatorRunning) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--card-bg))`;
                }
              }}
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

            {/* Reset Button */}
            <button 
              onClick={handleReset}
              disabled={isFixingAll}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border"
              style={{
                backgroundColor: `rgb(var(--card-bg))`,
                borderColor: `rgb(var(--border-color))`,
                color: `rgb(var(--text-primary))`,
              }}
              onMouseEnter={(e) => {
                if (!isFixingAll) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`;
                  e.currentTarget.style.borderColor = 'rgb(59, 130, 246)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `rgb(var(--card-bg))`;
                e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
              }}
            >
              {isFixingAll ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(59, 130, 246)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </>
              )}
            </button>
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all duration-200 flex items-center gap-2 hover:bg-theme-button-hover"
              style={{
                color: `rgb(var(--text-secondary))`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = `rgb(var(--accent-primary))`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = `rgb(var(--text-secondary))`;
              }}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="text-xs">Light</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-xs">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-16">
        {/* Systems Health Dashboard */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-primary">Systems Health</h2>
              <p className="text-sm text-secondary">Real-time status of monitored services</p>
            </div>
          </div>
          
          {/* Horizontally scrollable cards container */}
          <div 
            className="flex gap-4 overflow-x-auto pb-4"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(var(--border-color)) transparent'
            }}
          >
            {/* Redis Test Service Card */}
            {systemsHealth && systemsHealth['redis-test'] && (
              <div 
                className="rounded-lg p-5 border shrink-0"
                style={{
                  backgroundColor: `rgb(var(--card-bg))`,
                  borderColor: `rgb(var(--border-color))`,
                  width: '400px', // Fixed width for rectangular layout
                  minWidth: '400px',
                }}
              >
                {/* Header with icon, name, and health score */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Service Icon */}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: systemsHealth['redis-test'].health >= 70 
                          ? 'rgba(34, 197, 94, 0.1)' 
                          : 'rgba(239, 68, 68, 0.1)',
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: systemsHealth['redis-test'].health >= 70 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>

                    {/* Service Info */}
                    <div>
                      <h3 className="text-base font-semibold text-primary">Redis Test</h3>
                      <p className="text-xs text-secondary">In-memory cache</p>
                    </div>
                  </div>

                  {/* Health Score Badge */}
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{
                      color: systemsHealth['redis-test'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)'
                    }}>
                      {systemsHealth['redis-test'].health}%
                    </div>
                    <div className="text-xs text-secondary">Health</div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <div 
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium"
                    style={{
                      backgroundColor: systemsHealth['redis-test'].health >= 70 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)',
                      color: systemsHealth['redis-test'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)',
                      border: `1px solid ${systemsHealth['redis-test'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)'}`,
                    }}
                  >
                    <div 
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: systemsHealth['redis-test'].health >= 70 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)'
                      }}
                    />
                    {systemsHealth['redis-test'].health >= 70 ? 'Operational' : 'Degraded'}
                  </div>
                </div>

                {/* Metrics in a compact 2x2 grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-secondary mb-1">Memory Usage</div>
                    <div className="text-base font-semibold text-primary">
                      {(systemsHealth['redis-test'].memory_used / 1024 / 1024).toFixed(1)} MB
                    </div>
                    <div className="text-xs text-tertiary">
                      of {(systemsHealth['redis-test'].memory_max / 1024 / 1024).toFixed(0)} MB
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondary mb-1">Memory Utilization</div>
                    <div className="text-base font-semibold text-primary mb-1">
                      {systemsHealth['redis-test'].memory_percent.toFixed(1)}%
                    </div>
                    {/* Compact Memory Progress Bar */}
                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(systemsHealth['redis-test'].memory_percent, 100)}%`,
                          backgroundColor: systemsHealth['redis-test'].memory_percent > 90 
                            ? 'rgb(239, 68, 68)' 
                            : systemsHealth['redis-test'].memory_percent > 70 
                            ? 'rgb(249, 115, 22)' 
                            : 'rgb(34, 197, 94)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PostgreSQL Test Service Card */}
            {systemsHealth && systemsHealth['postgres-test'] && (
              <div 
                className="rounded-lg p-5 border shrink-0"
                style={{
                  backgroundColor: `rgb(var(--card-bg))`,
                  borderColor: `rgb(var(--border-color))`,
                  width: '400px',
                  minWidth: '400px',
                }}
              >
                {/* Header with icon, name, and health score */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Service Icon */}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: systemsHealth['postgres-test'].health >= 70 
                          ? 'rgba(34, 197, 94, 0.1)' 
                          : 'rgba(239, 68, 68, 0.1)',
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: systemsHealth['postgres-test'].health >= 70 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </div>

                    {/* Service Info */}
                    <div>
                      <h3 className="text-base font-semibold text-primary">PostgreSQL Test</h3>
                      <p className="text-xs text-secondary">Relational database</p>
                    </div>
                  </div>

                  {/* Health Score Badge */}
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{
                      color: systemsHealth['postgres-test'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)'
                    }}>
                      {systemsHealth['postgres-test'].health}%
                    </div>
                    <div className="text-xs text-secondary">Health</div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <div 
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium"
                    style={{
                      backgroundColor: systemsHealth['postgres-test'].health >= 70 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)',
                      color: systemsHealth['postgres-test'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)',
                      border: `1px solid ${systemsHealth['postgres-test'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)'}`,
                    }}
                  >
                    <div 
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: systemsHealth['postgres-test'].health >= 70 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)'
                      }}
                    />
                    {systemsHealth['postgres-test'].health >= 70 ? 'Operational' : 'Degraded'}
                  </div>
                </div>

                {/* Metrics in a compact 2x2 grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-secondary mb-1">Idle Connections</div>
                    <div className="text-base font-semibold text-primary">
                      {systemsHealth['postgres-test'].idle_connections}
                    </div>
                    <div className="text-xs text-tertiary">
                      {systemsHealth['postgres-test'].idle_ratio.toFixed(1)}% of total
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondary mb-1">Connection Pool</div>
                    <div className="text-base font-semibold text-primary">
                      {systemsHealth['postgres-test'].total_connections}/{systemsHealth['postgres-test'].max_connections}
                    </div>
                    <div className="text-xs text-tertiary">
                      {systemsHealth['postgres-test'].active_connections} active
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {!systemsHealth && (
              <div 
                className="rounded-lg p-6 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `rgb(var(--card-bg))`,
                  borderColor: `rgb(var(--border-color))`,
                  width: '400px',
                  minWidth: '400px',
                }}
              >
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: 'rgb(249, 115, 22)' }}></div>
                  <p className="text-sm text-secondary">Loading systems health...</p>
                </div>
              </div>
            )}
            
            {/* Future system cards will be added here horizontally */}
          </div>
        </section>

        {/* Active Incidents Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-semibold text-primary">Active incidents</h2>
              <span className="text-sm text-secondary font-medium">
                {totalIncidents}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowResolvedPanel(true)}
                disabled={isFixingAll}
                className="text-sm flex items-center gap-1 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: `rgb(var(--text-secondary))`
                }}
                onMouseEnter={(e) => {
                  if (!isFixingAll) {
                    e.currentTarget.style.color = 'rgb(249, 115, 22)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFixingAll) {
                    e.currentTarget.style.color = `rgb(var(--text-secondary))`;
                  }
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transition: 'none' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Resolved ({resolvedIncidents.length})
              </button>
              <button className="text-sm text-secondary hover:text-primary transition-colors">View all</button>
            </div>
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
        <IncidentModal 
          incident={modalIncident} 
          onClose={handleCloseModal}
          onSolutionUpdate={handleSolutionUpdate}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

      {/* Resolved Incidents Panel */}
      <ResolvedIncidentsPanel 
        isOpen={showResolvedPanel}
        onClose={() => setShowResolvedPanel(false)}
        incidents={resolvedIncidents}
      />

      {/* Full-page blocking overlay while fixing all incidents */}
      {isFixingAll && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div 
            className="flex flex-col items-center gap-4 p-8 rounded-lg"
            style={{
              backgroundColor: `rgb(var(--card-bg))`,
              border: `2px solid rgb(249, 115, 22)`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <svg 
              className="animate-spin h-12 w-12" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
              style={{ color: 'rgb(249, 115, 22)' }}
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-center">
              <p className="text-lg font-semibold mb-1" style={{ color: `rgb(var(--text-primary))` }}>
                Resetting System
              </p>
              <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                Clearing services and deleting incidents...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
