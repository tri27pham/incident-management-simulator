package models

import (
	"time"

	"github.com/google/uuid"
)

type Incident struct {
	ID              uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Message         string            `json:"message" binding:"required"`
	Source          string            `json:"source"`
	Status          string            `json:"status" gorm:"default:triage"`
	GeneratedBy     string            `json:"generated_by" gorm:"default:manual"` // "gemini", "groq", "fallback", "manual"
	Notes           string            `json:"notes" gorm:"type:text"`
	AffectedSystem  string            `json:"affected_system" gorm:"size:100"`    // For agent: which system is affected
	ErrorLogs       string            `json:"error_logs" gorm:"type:text"`        // For agent: JSON array of error messages
	MetricsSnapshot string            `json:"metrics_snapshot" gorm:"type:jsonb"` // For agent: system metrics at incident time
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	Analysis        *IncidentAnalysis `gorm:"foreignKey:IncidentID" json:"analysis,omitempty"`
	StatusHistory   []StatusHistory   `gorm:"foreignKey:IncidentID;constraint:OnDelete:CASCADE;" json:"status_history,omitempty"`
}
