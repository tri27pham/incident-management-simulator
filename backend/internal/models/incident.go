package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// JSONB is a custom type for PostgreSQL JSONB fields (can be object or array)
type JSONB struct {
	Data interface{}
}

// Scan implements the sql.Scanner interface for JSONB
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		j.Data = map[string]interface{}{}
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to unmarshal JSONB value: %v", value)
	}

	// Try to unmarshal into interface{} which can handle both objects and arrays
	var result interface{}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return err
	}
	j.Data = result
	return nil
}

// Value implements the driver.Valuer interface for JSONB
func (j JSONB) Value() (driver.Value, error) {
	if j.Data == nil {
		return json.Marshal(map[string]interface{}{})
	}
	return json.Marshal(j.Data)
}

// MarshalJSON implements json.Marshaler interface
func (j JSONB) MarshalJSON() ([]byte, error) {
	if j.Data == nil {
		return json.Marshal(map[string]interface{}{})
	}
	return json.Marshal(j.Data)
}

// UnmarshalJSON implements json.Unmarshaler interface
func (j *JSONB) UnmarshalJSON(data []byte) error {
	var v interface{}
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	j.Data = v
	return nil
}

type Incident struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Message     string    `json:"message" binding:"required"`
	Source      string    `json:"source"`
	Status      string    `json:"status" gorm:"default:triage"`
	GeneratedBy string    `json:"generated_by" gorm:"default:manual"` // "gemini", "groq", "fallback", "manual"
	Notes       string    `json:"notes" gorm:"type:text"`

	// Legacy fields (kept for backward compatibility)
	AffectedSystem  string `json:"affected_system,omitempty" gorm:"size:100"`    // Deprecated: use AffectedSystems
	ErrorLogs       string `json:"error_logs,omitempty" gorm:"type:text"`        // For agent: JSON array of error messages
	MetricsSnapshot string `json:"metrics_snapshot,omitempty" gorm:"type:jsonb"` // Deprecated: use Metadata

	// New classification fields for AI agent safety
	IncidentType    string         `json:"incident_type" gorm:"type:varchar(50);default:synthetic"`   // "real_system", "synthetic", "training"
	Actionable      bool           `json:"actionable" gorm:"default:false"`                           // Can AI agents take automated actions?
	AffectedSystems pq.StringArray `json:"affected_systems" gorm:"type:text[];default:'{}'"`          // Which systems are impacted
	RemediationMode string         `json:"remediation_mode" gorm:"type:varchar(50);default:advisory"` // "automated", "manual", "advisory"
	Metadata        JSONB          `json:"metadata" gorm:"type:jsonb;default:'{}'"`                   // Extensible metadata

	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	Analysis      *IncidentAnalysis `gorm:"foreignKey:IncidentID" json:"analysis,omitempty"`
	StatusHistory []StatusHistory   `gorm:"foreignKey:IncidentID;constraint:OnDelete:CASCADE;" json:"status_history,omitempty"`
}
