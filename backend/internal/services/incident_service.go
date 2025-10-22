package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	wshub "github.com/tri27pham/incident-management-simulator/backend/internal/websocket"
	"gorm.io/gorm"
)

// FullIncidentDetails wraps an incident for broadcasting
// The embedded Incident already includes Analysis via the foreign key relationship
type FullIncidentDetails struct {
	models.Incident
	// Note: models.Incident already has Analysis field, no need to duplicate it
}

func CreateIncident(incident *models.Incident) error {
	// Start a transaction to ensure both incident and status history are created together
	tx := db.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create the incident
	if err := tx.Create(incident).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Create initial status history entry
	statusHistory := models.StatusHistory{
		IncidentID: incident.ID,
		FromStatus: nil, // NULL for initial status
		ToStatus:   incident.Status,
		ChangedAt:  incident.CreatedAt,
	}
	if err := tx.Create(&statusHistory).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

func GetAllIncidents() ([]models.Incident, error) {
	var incidents []models.Incident
	err := db.DB.
		Preload("Analysis").
		Preload("StatusHistory", func(db *gorm.DB) *gorm.DB {
			return db.Order("incident_status_history.changed_at ASC")
		}).
		Find(&incidents).Error
	return incidents, err
}

func GetIncidentByID(id uuid.UUID) (models.Incident, error) {
	var incident models.Incident
	err := db.DB.
		Preload("Analysis").
		Preload("StatusHistory", func(db *gorm.DB) *gorm.DB {
			return db.Order("incident_status_history.changed_at ASC")
		}).
		First(&incident, id).Error
	return incident, err
}

func UpdateIncidentStatus(id uuid.UUID, status string) (models.Incident, error) {
	var incident models.Incident
	if err := db.DB.
		Preload("Analysis").
		Preload("StatusHistory", func(db *gorm.DB) *gorm.DB {
			return db.Order("incident_status_history.changed_at ASC")
		}).
		First(&incident, id).Error; err != nil {
		return incident, err // Incident not found
	}

	// Store old status before updating
	oldStatus := incident.Status

	// Only create history entry if status actually changed
	if oldStatus != status {
		// Start a transaction
		tx := db.DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// Update incident status
		incident.Status = status
		if err := tx.Save(&incident).Error; err != nil {
			tx.Rollback()
			return incident, err
		}

		// Create status history entry
		statusHistory := models.StatusHistory{
			IncidentID: incident.ID,
			FromStatus: &oldStatus,
			ToStatus:   status,
			ChangedAt:  time.Now(),
		}
		if err := tx.Create(&statusHistory).Error; err != nil {
			tx.Rollback()
			return incident, err
		}

		// Commit transaction
		if err := tx.Commit().Error; err != nil {
			return incident, err
		}

		// Reload the incident with updated status history
		if err := db.DB.
			Preload("Analysis").
			Preload("StatusHistory", func(db *gorm.DB) *gorm.DB {
				return db.Order("incident_status_history.changed_at ASC")
			}).
			First(&incident, id).Error; err != nil {
			return incident, err
		}

		log.Printf("✅ Updated incident %s status from %s to %s", incident.ID, oldStatus, status)
	}

	// Broadcast the status update to all connected clients
	BroadcastIncidentUpdate(id)
	log.Printf("📡 Broadcasted status update for incident %s to %s", incident.ID, status)

	return incident, nil
}

// BroadcastIncidentUpdate fetches an incident with its analysis and broadcasts it via WebSocket
func BroadcastIncidentUpdate(id uuid.UUID) {
	incident, err := GetIncidentByID(id)
	if err != nil {
		log.Printf("Failed to fetch incident %s for broadcast: %v", id, err)
		return
	}

	details := FullIncidentDetails{
		Incident: incident,
	}

	// Debug: Log if analysis is present
	if incident.Analysis != nil {
		log.Printf("📡 Broadcasting incident %s with Analysis (diagnosis: %d chars, solution: %d chars)",
			id.String()[:8], len(incident.Analysis.Diagnosis), len(incident.Analysis.Solution))
	} else {
		log.Printf("📡 Broadcasting incident %s without Analysis", id.String()[:8])
	}

	wshub.WSHub.Broadcast <- details
}

// RunFullAnalysisPipeline performs the complete AI analysis and broadcasts updates.
func RunFullAnalysisPipeline(incident models.Incident) {
	// Step 1: Immediately broadcast the newly created incident
	detailsNew := FullIncidentDetails{Incident: incident}
	wshub.WSHub.Broadcast <- detailsNew
	log.Printf("📡 Broadcasted new incident %s (no analysis yet)", incident.ID.String()[:8])

	// Step 2: Trigger Diagnosis
	log.Printf("🔬 Starting analysis pipeline for incident %s", incident.ID.String()[:8])
	_, err := TriggerAIDiagnosis(incident.ID)
	if err != nil {
		log.Printf("❌ Error in AI diagnosis for incident %s: %v", incident.ID.String()[:8], err)
		return // End the pipeline if diagnosis fails
	}

	// Step 3: Broadcast Diagnosis Update
	// Refetch incident to get the latest status with Analysis preloaded
	incidentWithStatus, _ := GetIncidentByID(incident.ID)
	detailsWithDiagnosis := FullIncidentDetails{
		Incident: incidentWithStatus,
	}

	if incidentWithStatus.Analysis != nil {
		log.Printf("📡 Broadcasting incident %s WITH diagnosis (provider: %s)",
			incident.ID.String()[:8], incidentWithStatus.Analysis.DiagnosisProvider)
	}

	wshub.WSHub.Broadcast <- detailsWithDiagnosis
	log.Printf("Broadcasted diagnosis update for incident %s", incident.ID)

	// Note: Solution is now triggered manually via "Get AI Solution" button
	log.Printf("Finished diagnosis pipeline for incident %s (solution can be triggered manually)", incident.ID)
}

// aiDiagnosisResponse defines the expected JSON structure from the AI service.
type aiDiagnosisResponse struct {
	Diagnosis string `json:"diagnosis"`
	Severity  string `json:"severity"`
	Provider  string `json:"provider"`
}

// aiSuggestedFixResponse defines the expected JSON structure from the AI service.
type aiSuggestedFixResponse struct {
	SuggestedFix string  `json:"suggested_fix"`
	Confidence   float64 `json:"confidence"`
	Provider     string  `json:"provider"`
}

func TriggerAIDiagnosis(incidentID uuid.UUID) (models.IncidentAnalysis, error) {
	var incident models.Incident
	var analysis models.IncidentAnalysis

	// 1. Find the incident to be analyzed.
	if err := db.DB.First(&incident, incidentID).Error; err != nil {
		return analysis, fmt.Errorf("incident not found: %w", err)
	}

	// 2. Call the AI service to get a diagnosis.
	body, err := callAIService(incident.Message, "/api/v1/diagnosis")
	if err != nil {
		return analysis, err
	}
	var diagResp aiDiagnosisResponse
	if err := json.Unmarshal(body, &diagResp); err != nil {
		return analysis, fmt.Errorf("failed to decode diagnosis response: %w", err)
	}

	// Check if the diagnosis is an error message (don't save to DB)
	if strings.Contains(diagResp.Diagnosis, "Gemini API") {
		return analysis, fmt.Errorf("AI service error: %s", diagResp.Diagnosis)
	}

	// 3. Create or find the analysis record and update it.
	// Use FirstOrInit to find the record or initialize a new one in memory.
	db.DB.Where(models.IncidentAnalysis{IncidentID: incident.ID}).FirstOrInit(&analysis)

	analysis.Diagnosis = diagResp.Diagnosis
	analysis.Severity = diagResp.Severity
	analysis.DiagnosisProvider = diagResp.Provider
	if err := db.DB.Save(&analysis).Error; err != nil {
		return analysis, fmt.Errorf("failed to save incident analysis: %w", err)
	}

	// 4. Keep incident in current status - users will manually move it
	// Note: Status is only changed by drag-and-drop in the UI
	// incident.Status = "investigating"
	// db.DB.Save(&incident)

	return analysis, nil
}

func TriggerAISuggestedFix(incidentID uuid.UUID) (models.IncidentAnalysis, error) {
	var incident models.Incident
	var analysis models.IncidentAnalysis

	// 1. Find the incident and its existing analysis.
	if err := db.DB.First(&incident, incidentID).Error; err != nil {
		return analysis, fmt.Errorf("incident not found: %w", err)
	}
	if err := db.DB.Where("incident_id = ?", incident.ID).First(&analysis).Error; err != nil {
		return analysis, fmt.Errorf("analysis must be run before a fix can be suggested: %w", err)
	}

	// 2. Call the AI service to get a suggested fix.
	body, err := callAIService(incident.Message, "/api/v1/suggested-fix")
	if err != nil {
		return analysis, err
	}
	var fixResp aiSuggestedFixResponse
	if err := json.Unmarshal(body, &fixResp); err != nil {
		return analysis, fmt.Errorf("failed to decode suggested fix response: %w", err)
	}

	// Check if the solution is an error message (don't save to DB)
	if strings.Contains(fixResp.SuggestedFix, "Gemini API") {
		return analysis, fmt.Errorf("AI service error: %s", fixResp.SuggestedFix)
	}

	// 3. Update the analysis record with the new fix.
	analysis.Solution = fixResp.SuggestedFix
	analysis.Confidence = fixResp.Confidence
	analysis.SolutionProvider = fixResp.Provider
	if err := db.DB.Save(&analysis).Error; err != nil {
		return analysis, fmt.Errorf("failed to save incident analysis: %w", err)
	}

	return analysis, nil
}

// callAIService is a helper to communicate with the AI diagnosis service.
func callAIService(message string, path string) ([]byte, error) {
	reqBody, err := json.Marshal(map[string]string{"description": message})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	aiURL := os.Getenv("AI_DIAGNOSIS_URL") + path
	resp, err := http.Post(aiURL, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to call AI service: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read AI service response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned non-OK status: %s - %s", resp.Status, string(body))
	}

	return body, nil
}

// GenerateRandomIncident creates a random incident using AI
func GenerateRandomIncident() (models.Incident, error) {
	// Call the dedicated incident generation endpoint
	aiURL := os.Getenv("AI_DIAGNOSIS_URL") + "/api/v1/generate-incident"
	resp, err := http.Post(aiURL, "application/json", nil)
	if err != nil {
		return models.Incident{}, fmt.Errorf("failed to call AI service: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return models.Incident{}, fmt.Errorf("failed to read AI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return models.Incident{}, fmt.Errorf("AI service error: %s", string(body))
	}

	// Parse the AI response to extract the incident data and provider
	var incidentData struct {
		Message  string `json:"message"`
		Source   string `json:"source"`
		Provider string `json:"provider"`
	}

	if err := json.Unmarshal(body, &incidentData); err != nil {
		return models.Incident{}, fmt.Errorf("failed to parse incident data from AI: %w", err)
	}

	return models.Incident{
		Message:     incidentData.Message,
		Source:      incidentData.Source,
		Status:      "triage",
		GeneratedBy: incidentData.Provider, // Track which AI generated this
	}, nil
}
