package models

import (
	"time"

	"github.com/google/uuid"
)

// AgentExecutionStatus represents the current phase of agent execution
type AgentExecutionStatus string

const (
	StatusThinking         AgentExecutionStatus = "thinking"
	StatusPreviewing       AgentExecutionStatus = "previewing"
	StatusAwaitingApproval AgentExecutionStatus = "awaiting_approval"
	StatusExecuting        AgentExecutionStatus = "executing"
	StatusVerifying        AgentExecutionStatus = "verifying"
	StatusCompleted        AgentExecutionStatus = "completed"
	StatusFailed           AgentExecutionStatus = "failed"
	StatusCancelled        AgentExecutionStatus = "cancelled"
)

// AgentExecution tracks the full workflow of an AI agent remediation attempt
type AgentExecution struct {
	ID         uuid.UUID            `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	IncidentID uuid.UUID            `gorm:"type:uuid" json:"incident_id"`
	Status     AgentExecutionStatus `gorm:"type:varchar(50);default:thinking" json:"status"`

	// Phase: Thinking
	Analysis          string `json:"analysis" gorm:"type:text"`          // AI's analysis
	RecommendedAction string `json:"recommended_action" gorm:"size:100"` // Action name
	Reasoning         string `json:"reasoning" gorm:"type:text"`         // Why this action

	// Phase: Command Preview
	Commands        JSONB  `json:"commands" gorm:"type:jsonb;default:'[]'"` // Commands to run
	EstimatedImpact string `json:"estimated_impact" gorm:"type:text"`       // Expected impact
	Risks           JSONB  `json:"risks" gorm:"type:jsonb;default:'[]'"`    // Identified risks

	// Phase: Execution
	ExecutionLogs JSONB      `json:"execution_logs" gorm:"type:jsonb;default:'[]'"` // Detailed logs
	StartedAt     *time.Time `json:"started_at"`
	CompletedAt   *time.Time `json:"completed_at"`

	// Phase: Verification
	VerificationChecks JSONB  `json:"verification_checks" gorm:"type:jsonb;default:'[]'"` // Verification results
	VerificationPassed *bool  `json:"verification_passed"`
	VerificationNotes  string `json:"verification_notes" gorm:"type:text"`

	// Outcome
	Success           *bool  `json:"success"`
	ErrorMessage      string `json:"error_message" gorm:"type:text"`
	RollbackPerformed bool   `json:"rollback_performed" gorm:"default:false"`

	// Metadata
	AgentModel string    `json:"agent_model" gorm:"size:50"`
	DryRun     bool      `json:"dry_run" gorm:"default:false"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Command represents a single command to execute
type Command struct {
	Name        string                 `json:"name"`        // Human-readable name
	Command     string                 `json:"command"`     // Actual command
	Args        []string               `json:"args"`        // Command arguments
	Target      string                 `json:"target"`      // Target system
	Description string                 `json:"description"` // What this does
	Metadata    map[string]interface{} `json:"metadata"`    // Additional data
}

// ExecutionLog represents a single execution log entry
type ExecutionLog struct {
	Timestamp   time.Time `json:"timestamp"`
	Command     string    `json:"command"`
	Output      string    `json:"output"`
	Status      string    `json:"status"` // "success", "failed", "skipped"
	DurationMs  int64     `json:"duration_ms"`
	ErrorDetail string    `json:"error_detail,omitempty"`
}

// VerificationCheck represents a single verification check result
type VerificationCheck struct {
	CheckName   string                 `json:"check_name"`
	Description string                 `json:"description"`
	Passed      bool                   `json:"passed"`
	Result      string                 `json:"result"`
	Expected    string                 `json:"expected"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Risk represents an identified risk
type Risk struct {
	Level       string `json:"level"` // "low", "medium", "high"
	Description string `json:"description"`
	Mitigation  string `json:"mitigation"`
}
