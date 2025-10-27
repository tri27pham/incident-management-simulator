package agent

import (
	"errors"
	"fmt"
	"log"

	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
)

// SafetyCheck represents the result of a safety validation
type SafetyCheck struct {
	Allowed bool     `json:"allowed"`
	Reason  string   `json:"reason"`
	Risks   []string `json:"risks,omitempty"`
}

// AgentAction represents an action that an agent wants to take
type AgentAction struct {
	IncidentID string `json:"incident_id"`
	Action     string `json:"action"`    // e.g., "restart_service", "clear_cache"
	Target     string `json:"target"`    // system name
	DryRun     bool   `json:"dry_run"`   // test without executing
	Requester  string `json:"requester"` // who/what is requesting this action
}

// CanAgentActOnIncident checks if an AI agent is allowed to take automated actions on an incident
func CanAgentActOnIncident(incident *models.Incident) SafetyCheck {
	var risks []string

	// Rule 1: Incident must be explicitly marked as actionable
	if !incident.Actionable {
		return SafetyCheck{
			Allowed: false,
			Reason:  "Incident is not marked as actionable",
			Risks:   []string{"Safety flag disabled for this incident"},
		}
	}

	// Rule 2: Incident must be of type "real_system"
	if incident.IncidentType != "real_system" {
		return SafetyCheck{
			Allowed: false,
			Reason:  fmt.Sprintf("Incident type '%s' is not actionable (must be 'real_system')", incident.IncidentType),
			Risks:   []string{"Cannot act on synthetic or training scenarios"},
		}
	}

	// Rule 3: Remediation mode must be "automated"
	if incident.RemediationMode == "manual" {
		return SafetyCheck{
			Allowed: false,
			Reason:  "Incident requires manual remediation",
			Risks:   []string{"Remediation mode is set to manual"},
		}
	}

	// Rule 4: Must have at least one actionable system
	hasActionableSystem := false
	for _, sys := range incident.AffectedSystems {
		if IsSystemActionable(sys) {
			hasActionableSystem = true
			break
		}
	}

	if !hasActionableSystem {
		return SafetyCheck{
			Allowed: false,
			Reason:  "No actionable systems found in affected_systems list",
			Risks:   []string{"All affected systems are either synthetic or not configured for agent actions"},
		}
	}

	// Rule 5: Check if incident is in a state that allows remediation
	if incident.Status == "resolved" {
		return SafetyCheck{
			Allowed: false,
			Reason:  "Incident is already resolved",
			Risks:   []string{"Cannot act on resolved incidents"},
		}
	}

	// Advisory mode: allowed but with warnings
	if incident.RemediationMode == "advisory" {
		risks = append(risks, "Remediation mode is 'advisory' - actions should be reviewed")
	}

	return SafetyCheck{
		Allowed: true,
		Reason:  "All safety checks passed",
		Risks:   risks,
	}
}

// ValidateAgentAction performs comprehensive validation before executing an agent action
func ValidateAgentAction(action AgentAction, incident *models.Incident) error {
	// Check if agent can act on this incident
	safetyCheck := CanAgentActOnIncident(incident)
	if !safetyCheck.Allowed {
		return fmt.Errorf("safety check failed: %s", safetyCheck.Reason)
	}

	// Check if target system exists and is actionable
	systemInfo, exists := GetSystemInfo(action.Target)
	if !exists {
		return fmt.Errorf("unknown target system: %s", action.Target)
	}

	if !systemInfo.Actionable {
		return fmt.Errorf("target system '%s' is not actionable by agents", action.Target)
	}

	// Check if the action is valid for this system
	validAction := false
	for _, allowedAction := range systemInfo.Actions {
		if allowedAction == action.Action {
			validAction = true
			break
		}
	}

	if !validAction {
		return fmt.Errorf("action '%s' is not allowed for system '%s'. Available actions: %v",
			action.Action, action.Target, systemInfo.Actions)
	}

	// Check if target system is in the incident's affected systems
	systemInIncident := false
	for _, sys := range incident.AffectedSystems {
		if sys == action.Target {
			systemInIncident = true
			break
		}
	}

	if !systemInIncident {
		return fmt.Errorf("target system '%s' is not listed in incident's affected_systems", action.Target)
	}

	log.Printf("🔒 Agent action validated: %s on %s (incident: %s, dry_run: %v)",
		action.Action, action.Target, action.IncidentID, action.DryRun)

	return nil
}

// GetRemediationActions returns available actions for an incident
func GetRemediationActions(incident *models.Incident) []string {
	var actions []string

	for _, sys := range incident.AffectedSystems {
		if systemInfo, exists := GetSystemInfo(sys); exists && systemInfo.Actionable {
			actions = append(actions, systemInfo.Actions...)
		}
	}

	return actions
}

// AuditLog represents an action taken by an agent
type AuditLog struct {
	IncidentID string                 `json:"incident_id"`
	Action     string                 `json:"action"`
	Target     string                 `json:"target"`
	Requester  string                 `json:"requester"`
	Success    bool                   `json:"success"`
	Error      string                 `json:"error,omitempty"`
	DryRun     bool                   `json:"dry_run"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	Timestamp  int64                  `json:"timestamp"`
}

// LogAgentAction logs an action taken by an agent (for audit trail)
func LogAgentAction(log AuditLog) {
	status := "✅ SUCCESS"
	if !log.Success {
		status = "❌ FAILED"
	}
	if log.DryRun {
		status = "🧪 DRY-RUN"
	}

	logMsg := fmt.Sprintf("🤖 AGENT ACTION [%s]: %s on %s (incident: %s, requester: %s)",
		status, log.Action, log.Target, log.IncidentID, log.Requester)

	if log.Error != "" {
		logMsg += fmt.Sprintf(" - Error: %s", log.Error)
	}

	// TODO: Store in database for audit trail
	fmt.Println(logMsg)
}

// ErrNotActionable is returned when an incident cannot be acted upon
var ErrNotActionable = errors.New("incident is not actionable by agents")

// ErrSystemNotActionable is returned when a target system cannot be acted upon
var ErrSystemNotActionable = errors.New("target system is not actionable")

// ErrInvalidAction is returned when an action is not valid for the target system
var ErrInvalidAction = errors.New("invalid action for target system")
