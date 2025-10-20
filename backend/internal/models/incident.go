package models

import "time"

type Incident struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Title        string    `json:"title" binding:"required"`
	Description  string    `json:"description" binding:"required"`
	Severity     string    `json:"severity" binding:"omitempty,oneof=low medium high"`
	Status       string    `json:"status" gorm:"default:triage"`
	Diagnosis    string    `json:"diagnosis"`
	SuggestedFix string    `json:"suggested_fix"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
