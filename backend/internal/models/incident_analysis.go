package models

import (
	"time"

	"github.com/google/uuid"
)

type IncidentAnalysis struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	IncidentID uuid.UUID `gorm:"type:uuid" json:"incident_id"`
	Severity   string    `json:"severity"`
	Diagnosis  string    `json:"diagnosis"`
	Solution   string    `json:"solution"`
	Confidence float64   `json:"confidence"`
	CreatedAt  time.Time `json:"created_at"`
}

// TableName explicitly tells GORM the name of the table to use for the IncidentAnalysis struct.
func (IncidentAnalysis) TableName() string {
	return "incident_analysis"
}
