import { useState } from 'react';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (incident: NewIncidentData) => void;
}

export interface NewIncidentData {
  title: string;
  description: string;
  severity: string;
  team: string;
  affected_systems: string[];
  impact: string;
  status: string;
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [formData, setFormData] = useState<NewIncidentData>({
    title: '',
    description: '',
    severity: 'medium',
    team: 'Platform',
    affected_systems: [],
    impact: '',
    status: 'Triage',
  });
  const [systemInput, setSystemInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate(formData);
      // Reset form
      setFormData({
        title: '',
        description: '',
        severity: 'medium',
        team: 'Platform',
        affected_systems: [],
        impact: '',
        status: 'Triage',
      });
      setSystemInput('');
      onClose();
    } catch (error) {
      console.error('Failed to create incident:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSystem = () => {
    if (systemInput.trim() && !formData.affected_systems.includes(systemInput.trim())) {
      setFormData({
        ...formData,
        affected_systems: [...formData.affected_systems, systemInput.trim()],
      });
      setSystemInput('');
    }
  };

  const removeSystem = (system: string) => {
    setFormData({
      ...formData,
      affected_systems: formData.affected_systems.filter(s => s !== system),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSystem();
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div 
        className="rounded-lg shadow-xl border max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: `rgb(var(--card-bg))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: `rgb(var(--border-color))` }}>
          <h2 className="text-xl font-semibold text-primary">Create New Incident</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors p-1 rounded-lg hover:bg-theme-button-hover cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{
                    backgroundColor: `rgb(var(--bg-primary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                  placeholder="Brief description of the incident"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  style={{
                    backgroundColor: `rgb(var(--bg-primary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                  rows={6}
                  placeholder="Detailed description of what's happening"
                  required
                />
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Severity <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  style={{
                    backgroundColor: `rgb(var(--bg-tertiary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Team */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Team <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  style={{
                    backgroundColor: `rgb(var(--bg-tertiary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                >
                  <option value="Platform">Platform</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                  <option value="Data">Data</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Initial Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  style={{
                    backgroundColor: `rgb(var(--bg-tertiary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                >
                  <option value="Triage">Triage</option>
                  <option value="Investigating">Investigating</option>
                  <option value="Fixing">Fixing</option>
                </select>
              </div>

              {/* Affected Systems */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Affected Systems
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={systemInput}
                    onChange={(e) => setSystemInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500"
                    style={{
                      backgroundColor: `rgb(var(--bg-primary))`,
                      borderColor: `rgb(var(--border-color))`,
                    }}
                    placeholder="e.g., Redis, PostgreSQL, API Gateway"
                  />
                  <button
                    type="button"
                    onClick={addSystem}
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                    style={{
                      backgroundColor: `rgb(var(--card-bg))`,
                      borderColor: 'rgb(249, 115, 22)',
                      color: 'rgb(249, 115, 22)',
                      cursor: systemInput.trim() ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (systemInput.trim()) {
                        e.currentTarget.style.backgroundColor = 'rgb(249, 115, 22)';
                        e.currentTarget.style.color = 'white';
                        e.currentTarget.style.cursor = 'pointer';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = `rgb(var(--card-bg))`;
                      e.currentTarget.style.color = 'rgb(249, 115, 22)';
                      e.currentTarget.style.cursor = systemInput.trim() ? 'pointer' : 'default';
                    }}
                  >
                    Add
                  </button>
                </div>
                {formData.affected_systems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.affected_systems.map((system) => (
                      <span
                        key={system}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border"
                        style={{
                          backgroundColor: 'rgba(249, 115, 22, 0.1)',
                          color: 'rgb(249, 115, 22)',
                          borderColor: 'rgb(249, 115, 22)',
                        }}
                      >
                        {system}
                        <button
                          type="button"
                          onClick={() => removeSystem(system)}
                          className="hover:opacity-70 transition-opacity cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Impact */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Impact
                </label>
                <textarea
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-primary focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  style={{
                    backgroundColor: `rgb(var(--bg-primary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                  rows={6}
                  placeholder="What is the impact on users or systems?"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.description}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: 'rgb(249, 115, 22)',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

