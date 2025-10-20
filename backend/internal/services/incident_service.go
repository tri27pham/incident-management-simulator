package services

import (
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

func GetIncidentByID(id uint) (models.Incident, error) {
	var incident models.Incident
	err := db.DB.First(&incident, id).Error
	return incident, err
}
