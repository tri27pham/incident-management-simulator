import { useState, useMemo, useEffect, useRef } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { IncidentBoardState, Incident, IncidentSeverity, IncidentStatus } from './types';
import { IncidentColumn } from './components/IncidentColumn';
import { IncidentModal } from './components/IncidentModal';
import { FilterBar } from './components/FilterBar';
import { ResolvedIncidentsPanel } from './components/ResolvedIncidentsPanel';
import { LoginScreen } from './components/LoginScreen';
import { CreateIncidentModal, NewIncidentData } from './components/CreateIncidentModal';
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if already authenticated in this session
    return sessionStorage.getItem('authenticated') === 'true';
  });
  const [board, setBoard] = useState(emptyBoardState);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [modalIncident, setModalIncident] = useState<Incident | null>(null);
  const [selectedSeverities, setSelectedSeverities] = useState<IncidentSeverity[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResolvedPanel, setShowResolvedPanel] = useState(false);
  const [resolvedIncidents, setResolvedIncidents] = useState<Incident[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showFailureDropdown, setShowFailureDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const [isTriggeringFailure, setIsTriggeringFailure] = useState(false);
  const [progressBar, setProgressBar] = useState<{ show: boolean; message: string; progress: number } | null>(null);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const blockWebSocketUpdatesRef = useRef(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isToastFadingOut, setIsToastFadingOut] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isErrorToastFadingOut, setIsErrorToastFadingOut] = useState(false);
  const [redisMemoryPercent, setRedisMemoryPercent] = useState<number | null>(null);

  // Helper function to show success toast with fade-out animation
  const showSuccessToast = (message: string) => {
    setSuccessToast(message);
    setIsToastFadingOut(false);
    
    // Start fade-out after 2.5 seconds
    setTimeout(() => {
      setIsToastFadingOut(true);
    }, 2500);
    
    // Clear toast after fade-out completes
    setTimeout(() => {
      setSuccessToast(null);
      setIsToastFadingOut(false);
    }, 2900);
  };

  // Helper function to show error toast with fade-out animation
  const showErrorToast = (message: string) => {
    setErrorToast(message);
    setIsErrorToastFadingOut(false);
    
    // Start fade-out after 3 seconds
    setTimeout(() => {
      setIsErrorToastFadingOut(true);
    }, 3000);
    
    // Clear toast after fade-out completes
    setTimeout(() => {
      setErrorToast(null);
      setIsErrorToastFadingOut(false);
    }, 3400);
  };
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
    'postgres-bloat'?: {
      health: number;
      dead_tuples: number;
      live_tuples: number;
      dead_ratio: number;
      status: string;
      will_trigger_incident: boolean;
    };
    'disk-space'?: {
      health: number;
      used_percent: number;
      used_mb: number;
      free_mb: number;
      total_mb: number;
      status: string;
      will_trigger_incident: boolean;
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
    if (modalIncident || showResolvedPanel || showGuideModal) {
      // Lock scroll
      document.body.style.overflow = 'hidden';
      
      // Cleanup: always restore scroll when modal/panel closes
      return () => {
        document.body.style.overflow = '';
      };
    } else {
      // Ensure scroll is unlocked when nothing is open
      document.body.style.overflow = '';
    }
  }, [modalIncident, showResolvedPanel, showGuideModal]);

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

  // Helper function to check if a system has any active incidents
  const hasActiveIncident = (systemName: string): boolean => {
    const allIncidents = [
      ...board.Triage.items,
      ...board.Investigating.items,
      ...board.Fixing.items,
    ];
    return allIncidents.some(incident => 
      incident.affectedServices?.some(service => 
        service.toLowerCase().includes(systemName.toLowerCase())
      )
    );
  };

  const handleSeverityToggle = (severity: IncidentSeverity) => {
    // Close expanded card when filter changes
    if (expandedCardId) {
      setExpandedCardId(null);
    }
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  };

  const handleTeamToggle = (team: string) => {
    // Close expanded card when filter changes
    if (expandedCardId) {
      setExpandedCardId(null);
    }
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  const handleClearFilters = () => {
    // Close expanded card when clearing filters
    if (expandedCardId) {
      setExpandedCardId(null);
    }
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

  const handleCreateIncident = async (data: NewIncidentData) => {
    console.log('📝 Creating new incident...');
    try {
      const incident = await api.createIncident(data);
      console.log(`✅ Incident created successfully:`, {
        id: incident.id,
        message: incident.message,
        source: incident.source,
        status: incident.status
      });
      // WebSocket will handle the update automatically
      console.log('⏳ Waiting for WebSocket broadcast...');
    } catch (error) {
      console.error('❌ Failed to create incident:', error);
      setError('Failed to create incident');
      setTimeout(() => setError(null), 3000);
      throw error; // Re-throw to let the modal handle it
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
        console.log('✅ PostgreSQL connections cleared successfully:', postgresResult);
      } catch (clearError) {
        console.error('❌ Failed to clear PostgreSQL connections:', clearError);
      }

      // Step 1.6: Clear PostgreSQL bloat to restore service health
      console.log('🧹 Step 1.6: Clearing PostgreSQL bloat...');
      try {
        const postgresBloatResult = await api.clearPostgresBloat();
        console.log('✅ PostgreSQL bloat cleared successfully:', postgresBloatResult);
      } catch (clearError) {
        console.error('❌ Failed to clear PostgreSQL bloat:', clearError);
      }

      // Step 1.7: Clear disk space to restore service health
      console.log('🧹 Step 1.7: Clearing disk space...');
      try {
        const diskResult = await api.clearDisk();
        console.log('✅ Disk space cleared successfully:', diskResult);
        
        // Fetch updated health status for all services
        const healthStatus = await api.getHealthMonitorStatus();
        console.log('📊 Systems health after clear:', {
          redis: healthStatus.services['redis-test'].health,
          postgres: healthStatus.services['postgres-test']?.health,
          postgresBloat: healthStatus.services['postgres-bloat']?.health,
          disk: healthStatus.services['disk-space']?.health
        });
        setSystemsHealth(healthStatus.services);
      } catch (clearError) {
        console.error('❌ Failed to clear disk space:', clearError);
        setError('Failed to restore system health');
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
                // Only add to board if status is a valid board column (not Resolved)
                if (status !== 'Resolved' && newBoard[status as IncidentStatus]) {
                  newBoard[status as IncidentStatus].items.push(incident);
                }
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
      showErrorToast('Failed to trigger Redis failure');
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
    blockWebSocketUpdatesRef.current = true; // Block WebSocket updates
    
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
      
      // Poll for incident creation (health monitor checks every 5 seconds)
      const startTime = Date.now();
      const maxWaitTime = 15000; // 15 seconds max
      let incidentCreated = false;
      const initialIncidentCount = board.Triage.items.length + board.Investigating.items.length + board.Fixing.items.length;
      
      while (!incidentCreated && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
        
        const backendIncidents = await api.fetchIncidents();
        const newIncidentCount = backendIncidents.length;
        
        // Check if a new incident was created
        if (newIncidentCount > initialIncidentCount) {
          incidentCreated = true;
          break;
        }
      }
      
      if (!incidentCreated) {
        throw new Error('Incident was not created - health monitor may not have detected the failure');
      }
      
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
        // Only add to board if status is a valid board column (not Resolved)
        if (status !== 'Resolved' && newBoard[status as IncidentStatus]) {
          newBoard[status as IncidentStatus].items.push(incident);
        }
      });

      const resolved = backendResolvedIncidents.map(mapBackendIncidentToFrontend);
      setBoard(newBoard);
      setResolvedIncidents(resolved);
      blockWebSocketUpdatesRef.current = false; // Unblock WebSocket updates
      
      // Clear progress bar after 2 seconds
      setTimeout(() => setProgressBar(null), 2000);
      
    } catch (error) {
      console.error('Failed to trigger PostgreSQL failure:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to trigger PostgreSQL failure');
      setProgressBar(null);
      blockWebSocketUpdatesRef.current = false; // Unblock on error
    } finally {
      setIsTriggeringFailure(false);
    }
  };

  const handleTriggerPostgresBloat = async () => {
    setIsTriggeringFailure(true);
    setShowFailureDropdown(false);
    blockWebSocketUpdatesRef.current = true; // Block WebSocket updates
    
    try {
      console.log('🔥 Triggering PostgreSQL table bloat...');
      setProgressBar({ 
        show: true, 
        message: 'Creating table bloat (inserting and deleting rows)...', 
        progress: 30 
      });
      
      const result = await api.triggerPostgresBloat();
      console.log('✅ PostgreSQL bloat created:', result);
      
      setProgressBar({ 
        show: true, 
        message: 'Waiting for incident detection...', 
        progress: 70 
      });
      
      // Poll for incident creation (health monitor checks every 5 seconds)
      const startTime = Date.now();
      const maxWaitTime = 15000; // 15 seconds max
      let incidentCreated = false;
      const initialIncidentCount = board.Triage.items.length + board.Investigating.items.length + board.Fixing.items.length;
      
      while (!incidentCreated && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
        
        const backendIncidents = await api.fetchIncidents();
        const newIncidentCount = backendIncidents.length;
        
        // Check if a new incident was created
        if (newIncidentCount > initialIncidentCount) {
          incidentCreated = true;
          break;
        }
      }
      
      if (!incidentCreated) {
        throw new Error('Incident was not created - health monitor may not have detected the failure');
      }
      
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
        // Only add to board if status is a valid board column (not Resolved)
        if (status !== 'Resolved' && newBoard[status as IncidentStatus]) {
          newBoard[status as IncidentStatus].items.push(incident);
        }
      });

      const resolved = backendResolvedIncidents.map(mapBackendIncidentToFrontend);
      setBoard(newBoard);
      setResolvedIncidents(resolved);
      blockWebSocketUpdatesRef.current = false; // Unblock WebSocket updates
      
      // Clear progress bar after 2 seconds
      setTimeout(() => setProgressBar(null), 2000);
      
    } catch (error) {
      console.error('Failed to trigger PostgreSQL bloat:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to trigger PostgreSQL bloat');
      setProgressBar(null);
      blockWebSocketUpdatesRef.current = false; // Unblock on error
    } finally {
      setIsTriggeringFailure(false);
    }
  };

  const handleTriggerDiskFull = async () => {
    setIsTriggeringFailure(true);
    setShowFailureDropdown(false);
    blockWebSocketUpdatesRef.current = true; // Block WebSocket updates
    
    try{
      console.log('🔥 Triggering disk space exhaustion...');
      setProgressBar({ 
        show: true, 
        message: 'Filling disk with log files...', 
        progress: 30 
      });
      
      const result = await api.triggerDiskFull();
      console.log('✅ Disk space filled:', result);
      
      setProgressBar({ 
        show: true, 
        message: 'Waiting for incident detection...', 
        progress: 70 
      });
      
      // Poll for incident creation (health monitor checks every 5 seconds)
      const startTime = Date.now();
      const maxWaitTime = 15000; // 15 seconds max
      let incidentCreated = false;
      const initialIncidentCount = board.Triage.items.length + board.Investigating.items.length + board.Fixing.items.length;
      
      while (!incidentCreated && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
        
        const backendIncidents = await api.fetchIncidents();
        const newIncidentCount = backendIncidents.length;
        
        // Check if a new incident was created
        if (newIncidentCount > initialIncidentCount) {
          incidentCreated = true;
          break;
        }
      }
      
      if (!incidentCreated) {
        throw new Error('Incident was not created - health monitor may not have detected the failure');
      }
      
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
        // Only add to board if status is a valid board column (not Resolved)
        if (status !== 'Resolved' && newBoard[status as IncidentStatus]) {
          newBoard[status as IncidentStatus].items.push(incident);
        }
      });

      const resolved = backendResolvedIncidents.map(mapBackendIncidentToFrontend);
      setBoard(newBoard);
      setResolvedIncidents(resolved);
      blockWebSocketUpdatesRef.current = false; // Unblock WebSocket updates
      
      // Clear progress bar after 2 seconds
      setTimeout(() => setProgressBar(null), 2000);
      
    } catch (error) {
      console.error('Failed to trigger disk full:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to trigger disk space failure');
      setProgressBar(null);
      blockWebSocketUpdatesRef.current = false; // Unblock on error
    } finally {
      setIsTriggeringFailure(false);
    }
  };


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

  const handleSolutionUpdate = (id: string, solution: string, confidence?: number, solutionProvider?: 'gemini' | 'groq' | 'error' | 'unknown') => {
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
            ...(confidence !== undefined && { confidence }),
            ...(solutionProvider && { solutionProvider }),
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
              ...(confidence !== undefined && { confidence }),
              ...(solutionProvider && { solutionProvider }),
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
            
            // Show success toast but DON'T close modal (let user review the resolution)
            if (modalIncident?.id === id) {
              showSuccessToast('Incident resolved');
              console.log('✅ Incident manually resolved - modal remains open for user review');
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
          // Only add to board if status is a valid board column (not Resolved)
          if (status !== 'Resolved' && newBoard[status as IncidentStatus]) {
            newBoard[status as IncidentStatus].items.push(incident);
          }
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
          
          // Block WebSocket updates during failure trigger progress bar
          if (blockWebSocketUpdatesRef.current) {
            console.log('🚫 Blocking WebSocket update during failure trigger');
            return;
          }
          
          const incident = mapBackendIncidentToFrontend(data);
          const isResolved = data.status === 'resolved';
          const status = mapBackendStatusToFrontend(data.status);
          
          console.log(`✨ Processing incident ${incident.incidentNumber} -> ${isResolved ? 'resolved' : status}`);
          console.log('📊 Backend data status_history:', data.status_history);
          console.log('📊 Mapped incident statusHistory:', incident.statusHistory);
          
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
          
          // If incident is resolved, move it to resolved list
          if (isResolved) {
            // Update modal if it's open for this incident AND show success toast
            if (modalIncidentRef.current?.id === incident.id) {
              setModalIncident(incident);
              showSuccessToast('Incident resolved');
              console.log('✅ Incident resolved - modal updated and remains open for user review');
            }
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
            // Update modal if it's open for this incident (only for non-resolved incidents)
            if (modalIncidentRef.current?.id === incident.id) {
              setModalIncident(incident);
              console.log('🔄 Updated modal incident');
            }
            
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
              
              // Only process if status is a valid board column
              if (status !== 'Resolved' && newBoard[status as IncidentStatus]) {
                if (existingColumnKey !== null) {
                  // Incident exists in the board
                  if (existingColumnKey === status) {
                    // Same column - update in place (preserve position)
                    newBoard[status as IncidentStatus].items[existingIndex] = incident;
                    console.log(`🔄 Updated incident ${incident.incidentNumber} at position ${existingIndex} in ${status} column`);
                  } else {
                    // Different column - remove from old, add to new
                    newBoard[existingColumnKey].items.splice(existingIndex, 1);
                    newBoard[status as IncidentStatus].items.push(incident);
                    console.log(`📦 Moved incident ${incident.incidentNumber} from ${existingColumnKey} to ${status} column`);
                  }
                } else {
                  // New incident - add to target column
                  newBoard[status as IncidentStatus].items.push(incident);
                  console.log(`✅ Added new incident ${incident.incidentNumber} to ${status} column`);
                }
              } else if (status === 'Resolved') {
                // Incident was resolved - remove from board if it exists
                if (existingColumnKey !== null) {
                  newBoard[existingColumnKey].items.splice(existingIndex, 1);
                  console.log(`✅ Removed resolved incident ${incident.incidentNumber} from ${existingColumnKey} column`);
                }
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
          (!item.severity && selectedSeverities.includes('low'));
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

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: `rgb(var(--bg-primary))`,
      }}
    >
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: `rgb(var(--text-primary))` }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <h1 className="text-xl font-semibold" style={{ color: `rgb(var(--text-primary))` }}>Home</h1>
            {error && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                {error}
              </span>
            )}
            <button
              onClick={() => setShowGuideModal(true)}
              className="ml-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-2 font-medium text-sm"
              style={{
                backgroundColor: 'rgb(249, 115, 22)',
                color: 'white',
                boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.3), 0 2px 4px -1px rgba(249, 115, 22, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(234, 88, 12)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(249, 115, 22)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Guide & Info"
            >
              <svg className="w-5 h-5" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Guide</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleGenerateIncident}
              disabled={isGenerating || isFixingAll}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border group"
              style={{
                backgroundColor: `rgb(var(--card-bg))`,
                borderColor: 'rgb(249, 115, 22)',
                color: `rgb(var(--text-primary))`,
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
                  <svg className="w-4 h-4 transition-colors duration-200 group-hover:stroke-[rgb(249,115,22)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="transition-colors duration-200 group-hover:text-[rgb(249,115,22)]">Generate Incident</span>
                </>
              )}
            </button>

            {/* Trigger Failure Dropdown */}
            <div className="relative" ref={dropdownRef} style={{ zIndex: 40 }}>
              <button 
                onClick={() => {
                  // ALWAYS close expanded card when clicking this button (opening or closing dropdown)
                  if (expandedCardId) {
                    setExpandedCardId(null);
                  }
                  
                  // Toggle dropdown
                  if (!showFailureDropdown && dropdownRef.current) {
                    const rect = dropdownRef.current.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + 8,
                      right: window.innerWidth - rect.right
                    });
                  }
                  setShowFailureDropdown(!showFailureDropdown);
                }}
                disabled={isTriggeringFailure || isFixingAll}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border group"
                style={{
                  backgroundColor: `rgb(var(--card-bg))`,
                  borderColor: 'rgb(249, 115, 22)',
                  color: `rgb(var(--text-primary))`,
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
                    <svg className="w-4 h-4 transition-colors duration-200 group-hover:stroke-[rgb(249,115,22)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="transition-colors duration-200 group-hover:text-[rgb(249,115,22)]">Trigger Failure</span>
                    <svg className="w-4 h-4 transition-colors duration-200 group-hover:stroke-[rgb(249,115,22)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {showFailureDropdown && (
                <div 
                  className="fixed rounded-lg shadow-lg border p-3"
                  style={{
                    backgroundColor: `rgb(var(--card-bg))`,
                    borderColor: `rgb(var(--border-color))`,
                    minWidth: '240px',
                    zIndex: 40, // Below modal (z-50) but above cards
                    top: dropdownPosition ? `${dropdownPosition.top}px` : '60px',
                    right: dropdownPosition ? `${dropdownPosition.right}px` : '20px',
                  }}
                >
                  <button
                    onClick={() => {
                      handleOverloadRedis();
                      // Close expanded card when triggering
                      if (expandedCardId) setExpandedCardId(null);
                    }}
                    disabled={isTriggeringFailure || hasActiveIncident('redis')}
                    className="w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center gap-3 rounded-lg border disabled:cursor-not-allowed"
                    style={{
                      color: `rgb(var(--text-primary))`,
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      opacity: (isTriggeringFailure || hasActiveIncident('redis')) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('redis')) {
                        e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('redis')) {
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
                        {hasActiveIncident('redis')
                          ? 'Redis incident active'
                          : (redisMemoryPercent !== null && redisMemoryPercent > 90 
                            ? `Already full (${redisMemoryPercent.toFixed(1)}%)`
                            : 'Fill memory to 90%+')
                        }
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleTriggerPostgresConnections();
                      // Close expanded card when triggering
                      if (expandedCardId) setExpandedCardId(null);
                    }}
                    disabled={isTriggeringFailure || hasActiveIncident('postgres')}
                    className="w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center gap-3 rounded-lg border disabled:cursor-not-allowed mt-2"
                    style={{
                      color: `rgb(var(--text-primary))`,
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      opacity: (isTriggeringFailure || hasActiveIncident('postgres')) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('postgres')) {
                        e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('postgres')) {
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
                        {hasActiveIncident('postgres')
                          ? 'PostgreSQL incident active'
                          : (postgresIdleConnections !== null && postgresIdleConnections > 10 
                            ? `Already exhausted (${postgresIdleConnections} idle)`
                            : 'Create 12 idle connections')
                        }
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleTriggerPostgresBloat();
                      // Close expanded card when triggering
                      if (expandedCardId) setExpandedCardId(null);
                    }}
                    disabled={isTriggeringFailure || hasActiveIncident('postgres')}
                    className="w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center gap-3 rounded-lg border disabled:cursor-not-allowed mt-2"
                    style={{
                      color: `rgb(var(--text-primary))`,
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      opacity: (isTriggeringFailure || hasActiveIncident('postgres')) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('postgres')) {
                        e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('postgres')) {
                        e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(234, 88, 12)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Create PostgreSQL Bloat</div>
                      <div className="text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                        {hasActiveIncident('postgres')
                          ? 'PostgreSQL incident active'
                          : (systemsHealth && systemsHealth['postgres-bloat']?.will_trigger_incident
                            ? `Already bloated (${systemsHealth['postgres-bloat'].dead_ratio}% dead tuples)`
                            : 'Generate dead tuples (needs VACUUM)')
                        }
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleTriggerDiskFull();
                      // Close expanded card when triggering
                      if (expandedCardId) setExpandedCardId(null);
                    }}
                    disabled={isTriggeringFailure || hasActiveIncident('disk-space')}
                    className="w-full px-4 py-3 text-left text-sm transition-all duration-200 flex items-center gap-3 rounded-lg border disabled:cursor-not-allowed mt-2"
                    style={{
                      color: `rgb(var(--text-primary))`,
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                      opacity: (isTriggeringFailure || hasActiveIncident('disk-space')) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('disk-space')) {
                        e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isTriggeringFailure && !hasActiveIncident('disk-space')) {
                        e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(202, 138, 4)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Fill Disk Space</div>
                      <div className="text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                        {hasActiveIncident('disk-space')
                          ? 'Disk space incident active'
                          : (systemsHealth && systemsHealth['disk-space']?.will_trigger_incident
                            ? `Already full (${systemsHealth['disk-space'].used_percent.toFixed(1)}% used)`
                            : 'Create large log files (needs cleanup)')
                        }
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            {/* Reset Button */}
            <button 
              onClick={handleReset}
              disabled={isFixingAll}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border group"
              style={{
                backgroundColor: `rgb(var(--card-bg))`,
                borderColor: 'rgb(59, 130, 246)',
                color: `rgb(var(--text-primary))`,
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ stroke: 'rgb(59, 130, 246)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="transition-colors duration-200 group-hover:text-[rgb(59,130,246)]">Reset</span>
                </>
              )}
            </button>
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="group p-2 rounded-lg flex items-center gap-2 text-[rgb(var(--text-secondary))]"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <>
                  <svg className="w-5 h-5 transition-colors duration-75 group-hover:stroke-[rgb(249,115,22)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="text-xs transition-colors duration-75 group-hover:text-[rgb(249,115,22)]">Light</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 transition-colors duration-75 group-hover:stroke-[rgb(249,115,22)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-xs transition-colors duration-75 group-hover:text-[rgb(249,115,22)]">Dark</span>
                </>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={() => {
                sessionStorage.removeItem('authenticated');
                setIsAuthenticated(false);
              }}
              className="group p-2 rounded-lg flex items-center gap-2 text-[rgb(var(--text-secondary))]"
              title="Logout"
            >
              <svg className="w-5 h-5 transition-colors duration-75 group-hover:stroke-[rgb(239,68,68)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs transition-colors duration-75 group-hover:text-[rgb(239,68,68)]">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-16">
        {/* Systems Health Dashboard */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-medium text-primary">Systems Health</h2>
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

            {/* Disk Space Service Card */}
            {systemsHealth && systemsHealth['disk-space'] && (
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
                        backgroundColor: systemsHealth['disk-space'].health >= 70 
                          ? 'rgba(34, 197, 94, 0.1)' 
                          : 'rgba(239, 68, 68, 0.1)',
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: systemsHealth['disk-space'].health >= 70 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </div>

                    {/* Service Info */}
                    <div>
                      <h3 className="text-base font-semibold text-primary">Disk Space</h3>
                      <p className="text-xs text-secondary">Storage monitoring</p>
                    </div>
                  </div>

                  {/* Health Score Badge */}
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{
                      color: systemsHealth['disk-space'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)'
                    }}>
                      {systemsHealth['disk-space'].health}%
                    </div>
                    <div className="text-xs text-secondary">Health</div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <div 
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium"
                    style={{
                      backgroundColor: systemsHealth['disk-space'].health >= 70 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)',
                      color: systemsHealth['disk-space'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)',
                      border: `1px solid ${systemsHealth['disk-space'].health >= 70 
                        ? 'rgb(34, 197, 94)' 
                        : 'rgb(239, 68, 68)'}`,
                    }}
                  >
                    <div 
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: systemsHealth['disk-space'].health >= 70 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)'
                      }}
                    />
                    {systemsHealth['disk-space'].health >= 70 ? 'Operational' : 'Degraded'}
                  </div>
                </div>

                {/* Metrics in a compact 2x2 grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-secondary mb-1">Disk Usage</div>
                    <div className="text-base font-semibold text-primary">
                      {systemsHealth['disk-space'].used_percent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-tertiary">
                      {systemsHealth['disk-space'].used_mb.toFixed(0)} MB used
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondary mb-1">Free Space</div>
                    <div className="text-base font-semibold text-primary">
                      {systemsHealth['disk-space'].free_mb.toFixed(0)} MB
                    </div>
                    <div className="text-xs text-tertiary">
                      of {systemsHealth['disk-space'].total_mb.toFixed(0)} MB
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
              <h2 className="text-xl font-medium text-primary">Active incidents</h2>
              <span className="text-sm font-medium text-primary">
                {totalIncidents}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowCreateModal(true)}
                disabled={isFixingAll}
                className="text-sm flex items-center gap-2 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg border transition-all duration-200 ease-in-out font-medium"
                style={{
                  backgroundColor: 'rgb(249, 115, 22)',
                  borderColor: 'rgb(249, 115, 22)',
                  color: 'white',
                  paddingLeft: '16px',
                  paddingRight: '20px'
                }}
                onMouseEnter={(e) => {
                  if (!isFixingAll) {
                    e.currentTarget.style.backgroundColor = 'rgb(234, 88, 12)';
                    e.currentTarget.style.borderColor = 'rgb(234, 88, 12)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(249, 115, 22)';
                  e.currentTarget.style.borderColor = 'rgb(249, 115, 22)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Incident
              </button>
              <button 
                onClick={() => setShowResolvedPanel(true)}
                disabled={isFixingAll}
                className="text-sm flex items-center gap-2 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg border transition-all duration-500 ease-in-out font-medium"
                style={{
                  borderColor: `rgb(var(--border-color))`,
                  color: `rgb(var(--text-primary))`
                }}
                onMouseEnter={(e) => {
                  if (!isFixingAll) {
                    e.currentTarget.style.borderColor = 'rgb(255, 140, 0)';
                    const svgElement = e.currentTarget.querySelector('svg');
                    if (svgElement) {
                      (svgElement as SVGElement).style.stroke = 'rgb(255, 140, 0)';
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `rgb(var(--border-color))`;
                  const svgElement = e.currentTarget.querySelector('svg');
                  if (svgElement) {
                    (svgElement as SVGElement).style.stroke = '';
                  }
                }}
              >
                <svg className="w-4 h-4 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="transition-colors duration-200 group-hover:text-[rgb(255,140,0)]">
                  View Resolved ({resolvedIncidents.length})
                </span>
              </button>
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
            expandedCardId={expandedCardId}
            onCloseExpandedCard={() => setExpandedCardId(null)}
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
          onShowSuccessToast={showSuccessToast}
        />
      )}

      {/* Resolved Incidents Panel */}
      <ResolvedIncidentsPanel 
        isOpen={showResolvedPanel}
        onClose={() => setShowResolvedPanel(false)}
        incidents={resolvedIncidents}
      />

      {/* Create Incident Modal */}
      <CreateIncidentModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateIncident}
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

      {/* Success Toast Notification */}
      {successToast && (
        <div 
          className={`fixed left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
            isToastFadingOut ? 'animate-fade-out' : 'animate-fade-in'
          }`}
          style={{
            backgroundColor: 'rgb(34, 197, 94)',
            color: 'white',
            zIndex: 100000,
            top: '24px',
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            overscrollBehavior: 'contain'
          }}
          onClick={() => setShowGuideModal(false)}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            className="rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            style={{ 
              backgroundColor: `rgb(var(--card-bg))`,
              overscrollBehavior: 'contain'
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: `rgb(var(--border-color))` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h2 className="text-2xl font-bold text-primary">Incident Management Simulator - Guide</h2>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="p-2 rounded-lg hover:bg-opacity-10 transition-colors duration-200"
                  style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Overview */}
              <section>
                <h3 className="text-xl font-semibold mb-3 text-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What is this?
                </h3>
                <p className="text-secondary leading-relaxed">
                  This is an <span className="font-semibold text-primary">Incident Management Simulator</span> designed to demonstrate incident response workflows. 
                  It simulates real-world system failures and provides an AI-powered SRE agent that can automatically diagnose and remediate issues.
                </p>
              </section>

              {/* Key Features */}
              <section>
                <h3 className="text-xl font-semibold mb-3 text-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Key Features
                </h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>Mock Systems:</strong> Redis, PostgreSQL, and Disk Space monitoring with realistic failure scenarios</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>AI-Powered Diagnosis:</strong> Get instant AI analysis of incidents with severity, diagnosis, and suggested solutions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>Automated Remediation:</strong> SRE agents can automatically fix issues with your approval</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>Kanban-Style Board:</strong> Track incidents through Triage → Investigating → Fixing → Resolved</span>
                  </li>
                </ul>
              </section>

              {/* How to Use */}
              <section>
                <h3 className="text-xl font-semibold mb-3 text-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  How to Use
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-primary mb-2">1. Generate or Create Incidents</h4>
                    <ul className="ml-4 space-y-1 text-secondary">
                      <li>• <strong>Generate Incident:</strong> Creates a random synthetic incident for practice</li>
                      <li>• <strong>Create Incident:</strong> Manually create an incident with custom details</li>
                      <li>• <strong>Trigger Failure:</strong> Inject real failures into mock systems (Redis, PostgreSQL, Disk Space)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-primary mb-2">2. Manage Incidents</h4>
                    <ul className="ml-4 space-y-1 text-secondary">
                      <li>• Click on any incident card to view details</li>
                      <li>• Use <strong>Get AI Diagnosis</strong> for instant analysis</li>
                      <li>• Use <strong>Get AI Solution</strong> for recommended fixes</li>
                      <li>• Change incident status by clicking the status dropdown</li>
                      <li>• Add notes to track your investigation progress</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-primary mb-2">3. Automated Remediation (Agent Ready Incidents)</h4>
                    <ul className="ml-4 space-y-1 text-secondary">
                      <li>• Look for incidents with the <span className="text-orange-500">Agent Ready</span> badge</li>
                      <li>• Click <strong>Start SRE Agent Remediation</strong> to let the AI fix it</li>
                      <li>• The agent will analyse, propose commands, and wait for your approval</li>
                      <li>• Review the proposed fix and click <strong>Approve & Execute</strong> or <strong>Reject</strong></li>
                      <li>• Watch as the agent executes commands and verifies the fix</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-primary mb-2">4. Monitor System Health</h4>
                    <ul className="ml-4 space-y-1 text-secondary">
                      <li>• Check the <strong>Systems Health</strong> section for real-time status</li>
                      <li>• Green = Healthy, Red = Critical issue detected</li>
                      <li>• Use <strong>Reset All</strong> to restore systems to normal and clear resolved incidents</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Incident Types */}
              <section>
                <h3 className="text-xl font-semibold mb-3 text-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Incident Types
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="font-semibold text-primary">Synthetic</span>
                    </div>
                    <p className="text-sm text-secondary">Practice incidents generated for training purposes</p>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <span className="font-semibold text-primary">Agent Ready</span>
                    </div>
                    <p className="text-sm text-secondary">Real system failures that can be automatically remediated</p>
                  </div>
                </div>
              </section>

              {/* Tips */}
              <section>
                <h3 className="text-xl font-semibold mb-3 text-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Pro Tips
                </h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">→</span>
                    <span>Use filters to focus on specific severity levels or teams</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">→</span>
                    <span>Try triggering failures on mock systems to experience agent-based remediation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">→</span>
                    <span>Add notes during investigation to simulate documenting your incident response</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500">→</span>
                    <span>Check the resolved panel to review past incidents and agent actions</span>
                  </li>
                </ul>
              </section>

              {/* Architecture & Tech Stack */}
              <section>
                <h3 className="text-xl font-semibold mb-3 text-primary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="rgb(249, 115, 22)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  How It Works (Behind the Scenes)
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-primary mb-2">Architecture</h4>
                    <p className="text-secondary text-sm mb-3">
                      The simulator uses a microservices architecture with real-time communication between components:
                    </p>
                    <ul className="ml-4 space-y-2 text-secondary text-sm">
                      <li>• <strong>Frontend:</strong> React + TypeScript with Vite, real-time WebSocket updates</li>
                      <li>• <strong>Backend:</strong> Go with PostgreSQL for incident storage and state management</li>
                      <li>• <strong>AI Services:</strong> Groq (LLaMA) for fast inference, Gemini for complex reasoning</li>
                      <li>• <strong>Health Monitor:</strong> Python service monitoring mock systems and triggering incidents</li>
                      <li>• <strong>Mock Systems:</strong> Containerized Redis, PostgreSQL, and disk space services</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-primary mb-2">SRE Agent Workflow</h4>
                    <p className="text-secondary text-sm mb-3">
                      The AI agent uses a constrained action space for safe automated remediation:
                    </p>
                    <div className="ml-4 space-y-2 text-secondary text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">1.</span>
                        <span><strong>Thinking Phase:</strong> AI analyses incident data and system state using LLaMA 70B</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">2.</span>
                        <span><strong>Action Selection:</strong> Chooses from pre-defined safe commands (FLUSHALL, VACUUM, cleanup scripts)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">3.</span>
                        <span><strong>Human-in-the-Loop:</strong> Presents plan to user for approval before execution</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">4.</span>
                        <span><strong>Execution:</strong> Runs approved commands via Docker exec against mock containers</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">5.</span>
                        <span><strong>Verification:</strong> Polls health metrics to confirm the system is restored</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-primary mb-2">Mock System Failures</h4>
                    <p className="text-secondary text-sm mb-2">
                      Each mock system simulates real production issues:
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-primary text-sm">Redis</span>
                        </div>
                        <p className="text-xs text-secondary">Memory exhaustion via `DEBUG POPULATE` → Fixed with `FLUSHALL`</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-primary text-sm">PostgreSQL</span>
                        </div>
                        <p className="text-xs text-secondary">Table bloat from dead tuples → Fixed with `VACUUM FULL`</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-primary text-sm">Disk Space</span>
                        </div>
                        <p className="text-xs text-secondary">tmpfs volume filled with test files → Cleared by cleanup script</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-primary mb-2">Safety & Constraints</h4>
                    <p className="text-secondary text-sm">
                      The system is designed with safety in mind: incidents are marked as "synthetic" or "agent_ready", 
                      the agent only acts on mock systems in isolated Docker containers, all commands are pre-approved and constrained, 
                      and human approval is required before any execution.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {errorToast && (
        <div 
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-medium text-sm z-[100000]"
          style={{
            backgroundColor: 'rgb(239, 68, 68)',
            opacity: isErrorToastFadingOut ? 0 : 1,
            transition: 'opacity 0.4s ease-in-out',
          }}
        >
          {errorToast}
        </div>
      )}
    </div>
  );
}

export default App;
