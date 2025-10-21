package models

import (
	"time"

	"github.com/google/uuid"
)

type Incident struct {
	ID        uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Message   string            `json:"message" binding:"required"`
	Source    string            `json:"source"`
	Status    string            `json:"status" gorm:"default:triage"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
	Analysis  *IncidentAnalysis `gorm:"foreignKey:IncidentID" json:"analysis,omitempty"`
}
