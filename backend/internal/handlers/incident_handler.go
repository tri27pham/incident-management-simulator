package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	"github.com/tri27pham/incident-management-simulator/backend/internal/services"
	wshub "github.com/tri27pham/incident-management-simulator/backend/internal/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all connections by default.
		// For production, you'd want to check the origin.
		return true
	},
}

// WebSocketHandler handles upgrading the HTTP connection to a WebSocket connection.
func WebSocketHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}

	// Register the new client
	wshub.WSHub.Register <- conn

	// Note: We are not handling reading messages from the client in this implementation,
	// as the primary flow is server-to-client updates.
}

// FullIncidentDetails is a temporary struct to combine incident and its analysis for broadcasting
type FullIncidentDetails struct {
	models.Incident
	Analysis *models.IncidentAnalysis `json:"analysis,omitempty"`
}

func CreateIncidentHandler(c *gin.Context) {
	var incident models.Incident
	if err := c.ShouldBindJSON(&incident); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := services.CreateIncident(&incident); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create incident"})
		return
	}

	// Start the AI analysis pipeline in the background.
	// This pipeline is now responsible for all WebSocket broadcasts.
	go services.RunFullAnalysisPipeline(incident)

	c.JSON(http.StatusCreated, incident)
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

func TriggerAIDiagnosisHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID format"})
		return
	}

	analysis, err := services.TriggerAIDiagnosis(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Broadcast the updated incident with diagnosis to all connected clients
	services.BroadcastIncidentUpdate(id)

	c.JSON(http.StatusOK, analysis)
}

func TriggerAISuggestedFixHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID format"})
		return
	}

	analysis, err := services.TriggerAISuggestedFix(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Broadcast the updated incident with solution to all connected clients
	services.BroadcastIncidentUpdate(id)

	c.JSON(http.StatusOK, analysis)
}

func GenerateRandomIncidentHandler(c *gin.Context) {
	incident, err := services.GenerateRandomIncident()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate incident: %v", err)})
		return
	}

	if err := services.CreateIncident(&incident); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create incident"})
		return
	}

	// Start the AI analysis pipeline in the background
	go services.RunFullAnalysisPipeline(incident)

	c.JSON(http.StatusCreated, incident)
}
