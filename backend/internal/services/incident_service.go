package services

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	Diagnosis  string  `json:"diagnosis"`
	Solution   string  `json:"solution"`
	Severity   string  `json:"severity"`
	Confidence float64 `json:"confidence"`
}

func RunAIDiagnosis(incidentID uuid.UUID) (models.IncidentAnalysis, error) {
	var incident models.Incident
	var analysis models.IncidentAnalysis

	// 1. Find the incident to be analyzed.
	if err := db.DB.First(&incident, incidentID).Error; err != nil {
		return analysis, fmt.Errorf("incident not found: %w", err)
	}

	// 2. Prepare and send the request to the AI service.
	reqBody, err := json.Marshal(map[string]string{"message": incident.Message})
	if err != nil {
		return analysis, fmt.Errorf("failed to marshal request body: %w", err)
	}

	aiURL := os.Getenv("AI_DIAGNOSIS_URL") + "/api/v1/diagnosis" // Assuming this is the full path
	resp, err := http.Post(aiURL, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return analysis, fmt.Errorf("failed to call AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return analysis, fmt.Errorf("AI service returned non-OK status: %s", resp.Status)
	}

	// 3. Decode the AI service response.
	var aiResp aiDiagnosisResponse
	if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
		return analysis, fmt.Errorf("failed to decode AI response: %w", err)
	}

	// 4. Create the new IncidentAnalysis record in the database.
	analysis = models.IncidentAnalysis{
		IncidentID: incident.ID,
		Diagnosis:  aiResp.Diagnosis,
		Solution:   aiResp.Solution,
		Severity:   aiResp.Severity,
		Confidence: aiResp.Confidence,
	}
	if err := db.DB.Create(&analysis).Error; err != nil {
		return analysis, fmt.Errorf("failed to save incident analysis: %w", err)
	}

	// 5. Update the original incident's status.
	incident.Status = "investigating"
	db.DB.Save(&incident) // We can ignore this error for now, as the main goal was the analysis.

	return analysis, nil
}
