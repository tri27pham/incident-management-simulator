import { Incident } from '../types';
import { SeverityBars } from './SeverityBars';

interface ResolvedIncidentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  onIncidentClick: (incident: Incident) => void;
}

export function ResolvedIncidentsPanel({ isOpen, onClose, incidents, onIncidentClick }: ResolvedIncidentsPanelProps) {
  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className={`fixed inset-0 bg-black z-40 transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backdropFilter: isOpen ? 'blur(4px)' : 'blur(0px)',
          WebkitBackdropFilter: isOpen ? 'blur(4px)' : 'blur(0px)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-2xl shadow-2xl z-50 overflow-y-auto rounded-l-lg ${
          isOpen ? '' : 'pointer-events-none'
        }`}
        style={{ 
          backgroundColor: `rgb(var(--bg-secondary))`,
          scrollBehavior: 'smooth',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out',
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ 
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderBottom: `1px solid rgb(var(--border-color))`
          }}
        >
          <div>
            <h2 className="text-xl font-semibold text-primary">Resolved Incidents</h2>
            <p className="text-sm text-secondary mt-1">{incidents.length} incident{incidents.length !== 1 ? 's' : ''} resolved</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-theme-button-hover"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {incidents.length === 0 ? (
            <div className="text-center py-12">
              <svg 
                className="w-16 h-16 mx-auto mb-4 text-tertiary" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <p className="text-secondary">No resolved incidents yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => onIncidentClick(incident)}
                  className="rounded-lg p-4 border cursor-pointer transition-all duration-200 hover:shadow-md"
                  style={{
                    backgroundColor: `rgb(var(--card-bg))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-secondary">{incident.incidentNumber}</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                        Resolved
                      </span>
                      {incident.generated_by && incident.generated_by !== 'manual' && (
                        <span 
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                            incident.generated_by === 'gemini' 
                              ? 'bg-purple-100 text-purple-700 border-purple-200 ai-badge-gemini' 
                              : incident.generated_by === 'groq'
                              ? 'bg-orange-100 text-orange-700 border-orange-200 ai-badge-groq'
                              : 'bg-gray-100 text-gray-600 border-gray-200 ai-badge-default'
                          }`}
                        >
                          {incident.generated_by === 'gemini' ? '✨' : incident.generated_by === 'groq' ? '⚡' : '📋'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-tertiary">{incident.timeElapsed}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-medium mb-2 text-primary">
                    {incident.title}
                  </h3>

                  {/* Details */}
                  <div className="flex items-center justify-between">
                    <SeverityBars severity={incident.severity} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary">{incident.team}</span>
                    </div>
                  </div>

                  {/* Resolution Info */}
                  {incident.hasSolution && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgb(var(--border-color))` }}>
                      <div className="flex items-center gap-2 text-xs text-secondary">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Solution applied</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

