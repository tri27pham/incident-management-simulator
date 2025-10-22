import { useState, useRef, useEffect } from 'react';
import { IncidentSeverity } from '../types';

interface FilterBarProps {
  selectedSeverities: IncidentSeverity[];
  selectedTeams: string[];
  availableTeams: string[];
  onSeverityToggle: (severity: IncidentSeverity) => void;
  onTeamToggle: (team: string) => void;
  onClearFilters: () => void;
}

const severityOptions: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'text-red-600' },
  { value: 'medium', label: 'Medium', color: 'text-orange-600' },
  { value: 'low', label: 'Low', color: 'text-yellow-600' },
  { value: 'minor', label: 'Undiagnosed', color: 'text-gray-600' },
];

export function FilterBar({
  selectedSeverities,
  selectedTeams,
  availableTeams,
  onSeverityToggle,
  onTeamToggle,
  onClearFilters,
}: FilterBarProps) {
  const [severityOpen, setSeverityOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const severityRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = selectedSeverities.length > 0 || selectedTeams.length > 0;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (severityRef.current && !severityRef.current.contains(event.target as Node)) {
        setSeverityOpen(false);
      }
      if (teamRef.current && !teamRef.current.contains(event.target as Node)) {
        setTeamOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSeverityLabel = () => {
    if (selectedSeverities.length === 0) return 'Severity';
    if (selectedSeverities.length === 1) {
      return severityOptions.find((s) => s.value === selectedSeverities[0])?.label || 'Severity';
    }
    return `${selectedSeverities.length} severities`;
  };

  const getTeamLabel = () => {
    if (selectedTeams.length === 0) return 'Team';
    if (selectedTeams.length === 1) return selectedTeams[0];
    return `${selectedTeams.length} teams`;
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Severity Dropdown */}
      <div className="relative" ref={severityRef}>
        <button
          onClick={() => setSeverityOpen(!severityOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            selectedSeverities.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : ''
          }`}
          style={selectedSeverities.length === 0 ? {
            backgroundColor: `rgb(var(--card-bg))`,
            borderColor: `rgb(var(--border-color))`,
            color: `rgb(var(--text-primary))`
          } : {}}
        >
          {getSeverityLabel()}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {severityOpen && (
          <div className="absolute z-10 mt-2 w-56 rounded-lg shadow-lg" style={{
            backgroundColor: `rgb(var(--card-bg))`,
            border: `1px solid rgb(var(--border-color))`
          }}>
            <div className="p-2">
              {severityOptions.map((severity) => {
                const isSelected = selectedSeverities.includes(severity.value);
                return (
                  <button
                    key={severity.value}
                    onClick={() => onSeverityToggle(severity.value)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 text-sm"
                  >
                    <span className={`${severity.color} font-medium`}>{severity.label}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Team Dropdown */}
      <div className="relative" ref={teamRef}>
        <button
          onClick={() => setTeamOpen(!teamOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            selectedTeams.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : ''
          }`}
          style={selectedTeams.length === 0 ? {
            backgroundColor: `rgb(var(--card-bg))`,
            borderColor: `rgb(var(--border-color))`,
            color: `rgb(var(--text-primary))`
          } : {}}
        >
          {getTeamLabel()}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {teamOpen && (
          <div className="absolute z-10 mt-2 w-56 rounded-lg shadow-lg" style={{
            backgroundColor: `rgb(var(--card-bg))`,
            border: `1px solid rgb(var(--border-color))`
          }}>
            <div className="p-2">
              {availableTeams.map((team) => {
                const isSelected = selectedTeams.includes(team);
                return (
                  <button
                    key={team}
                    onClick={() => onTeamToggle(team)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 text-sm"
                  >
                    <span className="text-gray-700 font-medium">{team}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="text-sm ml-2 transition-colors text-secondary hover:text-primary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

