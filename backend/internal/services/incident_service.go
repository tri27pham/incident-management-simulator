package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	wshub "github.com/tri27pham/incident-management-simulator/backend/internal/websocket"
)

// FullIncidentDetails wraps an incident for broadcasting
// The embedded Incident already includes Analysis via the foreign key relationship
type FullIncidentDetails struct {
	models.Incident
}

func CreateIncident(incident *models.Incident) error {
	return db.DB.Create(incident).Error
}

func GetAllIncidents() ([]models.Incident, error) {
	var incidents []models.Incident
	err := db.DB.Preload("Analysis").Find(&incidents).Error
	return incidents, err
}

func GetIncidentByID(id uuid.UUID) (models.Incident, error) {
	var incident models.Incident
	err := db.DB.Preload("Analysis").First(&incident, id).Error
	return incident, err
}

func UpdateIncidentStatus(id uuid.UUID, status string) (models.Incident, error) {
	var incident models.Incident
	if err := db.DB.Preload("Analysis").First(&incident, id).Error; err != nil {
		return incident, err // Incident not found
	}

	incident.Status = status
	if err := db.DB.Save(&incident).Error; err != nil {
		return incident, err
	}

	// Broadcast the status update to all connected clients
	BroadcastIncidentUpdate(id)
	log.Printf("Broadcasted status update for incident %s to %s", incident.ID, status)

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
	wshub.WSHub.Broadcast <- details
}

// RunFullAnalysisPipeline performs the complete AI analysis and broadcasts updates.
func RunFullAnalysisPipeline(incident models.Incident) {
	// Step 1: Immediately broadcast the newly created incident
	detailsNew := FullIncidentDetails{Incident: incident}
	wshub.WSHub.Broadcast <- detailsNew
	log.Printf("Broadcasted new incident %s", incident.ID)

	// Step 2: Trigger Diagnosis
	log.Printf("Starting analysis pipeline for incident %s", incident.ID)
	_, err := TriggerAIDiagnosis(incident.ID)
	if err != nil {
		log.Printf("Error in AI diagnosis for incident %s: %v", incident.ID, err)
		return // End the pipeline if diagnosis fails
	}

	// Step 3: Broadcast Diagnosis Update
	// Refetch incident to get the latest status with Analysis preloaded
	incidentWithStatus, _ := GetIncidentByID(incident.ID)
	detailsWithDiagnosis := FullIncidentDetails{
		Incident: incidentWithStatus,
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
}

// aiSuggestedFixResponse defines the expected JSON structure from the AI service.
type aiSuggestedFixResponse struct {
	SuggestedFix string  `json:"suggested_fix"`
	Confidence   float64 `json:"confidence"`
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

	// 3. Create or find the analysis record and update it.
	// Use FirstOrInit to find the record or initialize a new one in memory.
	db.DB.Where(models.IncidentAnalysis{IncidentID: incident.ID}).FirstOrInit(&analysis)

	analysis.Diagnosis = diagResp.Diagnosis
	analysis.Severity = diagResp.Severity
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

	// 3. Update the analysis record with the new fix.
	analysis.Solution = fixResp.SuggestedFix
	analysis.Confidence = fixResp.Confidence
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
