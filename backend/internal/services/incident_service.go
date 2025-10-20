package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
)

func CreateIncident(incident *models.Incident) error {
	return db.DB.Create(incident).Error
}

func GetAllIncidents() ([]models.Incident, error) {
	var incidents []models.Incident
	err := db.DB.Find(&incidents).Error
	return incidents, err
}

func GetIncidentByID(id uuid.UUID) (models.Incident, error) {
	var incident models.Incident
	err := db.DB.First(&incident, id).Error
	return incident, err
}

func UpdateIncidentStatus(id uuid.UUID, status string) (models.Incident, error) {
	var incident models.Incident
	if err := db.DB.First(&incident, id).Error; err != nil {
		return incident, err // Incident not found
	}

	incident.Status = status
	if err := db.DB.Save(&incident).Error; err != nil {
		return incident, err
	}

	return incident, nil
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
	db.DB.FirstOrCreate(&analysis, models.IncidentAnalysis{IncidentID: incident.ID})
	analysis.Diagnosis = diagResp.Diagnosis
	analysis.Severity = diagResp.Severity
	if err := db.DB.Save(&analysis).Error; err != nil {
		return analysis, fmt.Errorf("failed to save incident analysis: %w", err)
	}

	// 4. Update the original incident's status.
	incident.Status = "investigating"
	db.DB.Save(&incident)

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
