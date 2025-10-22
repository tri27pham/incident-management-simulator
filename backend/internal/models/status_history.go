package models

import (
	"time"

	"github.com/google/uuid"
)

type StatusHistory struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	IncidentID uuid.UUID `gorm:"type:uuid;not null" json:"incident_id"`
	FromStatus *string   `json:"from_status"` // Pointer to allow NULL for initial status
	ToStatus   string    `json:"to_status" binding:"required"`
	ChangedAt  time.Time `json:"changed_at"`
}

// TableName specifies the table name for GORM
func (StatusHistory) TableName() string {
	return "incident_status_history"
}

