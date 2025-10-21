import { Incident } from '../types';

interface IncidentModalProps {
  incident: Incident;
  onClose: () => void;
}

const severityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800' },
  minor: { label: 'Minor', color: 'bg-gray-100 text-gray-800' },
};

export function IncidentModal({ incident, onClose }: IncidentModalProps) {
  const severity = incident.severity ? severityConfig[incident.severity] : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-500 font-medium">{incident.incidentNumber}</span>
              {severity && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${severity.color}`}>
                  {severity.label}
                </span>
              )}
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-600">{incident.timeElapsed}</span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">{incident.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-sm text-gray-600">
                  {incident.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Impact</h3>
                <p className="text-sm text-gray-600">
                  {incident.impact || 'Impact assessment pending.'}
                </p>
              </div>

              {incident.affectedServices && incident.affectedServices.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Affected Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {incident.affectedServices.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Team</span>
                  <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    <span className="text-gray-400">⬢⬢</span>
                    {incident.team}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Assignee</span>
                  <span className="text-sm font-medium text-gray-900">
                    {incident.assignee || 'Unassigned'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Created</span>
                  <span className="text-sm font-medium text-gray-900">
                    {incident.createdAt || 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Update</span>
                  <span className="text-sm font-medium text-gray-900">
                    {incident.lastUpdate || 'No updates'}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Timeline</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Incident created</p>
                      <p className="text-xs text-gray-500">{incident.createdAt || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Status: Investigating</p>
                      <p className="text-xs text-gray-500">In progress</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis Section */}
          {(incident.hasDiagnosis || incident.hasSolution) && (
            <div className="border-t border-gray-200 pt-6 mt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis</h3>
              
              {incident.hasDiagnosis && incident.diagnosis && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-green-900 mb-2">Diagnosis</h4>
                      <p className="text-sm text-green-800 leading-relaxed">{incident.diagnosis}</p>
                    </div>
                  </div>
                </div>
              )}

              {incident.hasSolution && incident.solution && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Suggested Solution</h4>
                      <p className="text-sm text-blue-800 leading-relaxed">{incident.solution}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-gray-200 pt-4 mt-6">
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                Update Status
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Add Update
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Assign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

