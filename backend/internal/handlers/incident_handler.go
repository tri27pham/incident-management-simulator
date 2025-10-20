package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	"github.com/tri27pham/incident-management-simulator/backend/internal/services"
)

func CreateIncidentHandler(c *gin.Context) {
	var input models.Incident
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := services.CreateIncident(&input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create incident"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": input.ID, "created_at": input.CreatedAt})
}

func GetAllIncidentsHandler(c *gin.Context) {
	incidents, err := services.GetAllIncidents()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch incidents"})
		return
	}
	c.JSON(http.StatusOK, incidents)
}

func GetIncidentByIDHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID format"})
		return
	}

	incident, err := services.GetIncidentByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Incident not found"})
		return
	}
	c.JSON(http.StatusOK, incident)
}

func UpdateIncidentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID format"})
		return
	}

	var updateData struct {
		Status string `json:"status" binding:"required,oneof=triage investigating fixing resolved"`
	}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	incident, err := services.UpdateIncidentStatus(id, updateData.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update incident"})
		return
	}

	c.JSON(http.StatusOK, incident)
}

func RunAIDiagnosisHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID format"})
		return
	}

	analysis, err := services.RunAIDiagnosis(id)
	if err != nil {
		// Differentiate between "not found" and other server errors
		if err.Error() == "incident not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, analysis)
}
