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

	// Keep the connection alive by reading messages (even if we don't process them)
	// This blocks until the connection is closed
	defer func() {
		wshub.WSHub.Unregister <- conn
	}()

	for {
		// Read messages from the client (we don't process them, but we need to read to detect disconnection)
		_, _, err := conn.ReadMessage()
		if err != nil {
			// Connection closed or error occurred
			break
		}
	}
}

func CreateIncidentHandler(c *gin.Context) {
	var incident models.Incident
	if err := c.ShouldBindJSON(&incident); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Initialize metadata if empty to prevent NULL insertion
	if incident.Metadata.Data == nil {
		incident.Metadata = models.JSONB{Data: map[string]interface{}{}}
	}

	// Ensure AffectedSystems is not nil
	if incident.AffectedSystems == nil {
		incident.AffectedSystems = []string{}
	}

	// Set defaults for classification fields if not provided
	if incident.IncidentType == "" {
		incident.IncidentType = "synthetic"
	}
	if incident.RemediationMode == "" {
		incident.RemediationMode = "advisory"
	}

	// Ensure legacy JSONB field has valid JSON (not empty string)
	if incident.MetricsSnapshot == "" {
		incident.MetricsSnapshot = "{}"
	}

	// Debug logging for incident classification
	log.Printf("📥 Creating incident: source=%s, type=%s, actionable=%v, systems=%v",
		incident.Source, incident.IncidentType, incident.Actionable, incident.AffectedSystems)

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

func GetResolvedIncidentsHandler(c *gin.Context) {
	incidents, err := services.GetResolvedIncidents()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch resolved incidents"})
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
		Status   *string `json:"status" binding:"omitempty,oneof=triage investigating fixing resolved"`
		Notes    *string `json:"notes"`
		Severity *string `json:"severity" binding:"omitempty,oneof=high medium low"`
		Team     *string `json:"team"`
	}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update status if provided
	var incident *models.Incident
	if updateData.Status != nil {
		incident, err = services.UpdateIncidentStatus(id, *updateData.Status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update incident"})
			return
		}
	}

	// Update notes if provided
	if updateData.Notes != nil {
		incident, err = services.UpdateIncidentNotes(id, *updateData.Notes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update incident notes"})
			return
		}
	}

	// Update severity if provided
	if updateData.Severity != nil {
		incident, err = services.UpdateIncidentSeverity(id, *updateData.Severity)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update incident severity"})
			return
		}
	}

	// Update team if provided
	if updateData.Team != nil {
		incident, err = services.UpdateIncidentTeam(id, *updateData.Team)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update incident team"})
			return
		}
	}

	// If no update was performed, return the current incident
	if incident == nil {
		incidentValue, err := services.GetIncidentByID(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Incident not found"})
			return
		}
		incident = &incidentValue
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

func DeleteIncidentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID format"})
		return
	}

	if err := services.DeleteIncident(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete incident"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Incident deleted successfully"})
}

// ResetDatabaseHandler truncates all database tables and broadcasts reset to connected clients
func ResetDatabaseHandler(c *gin.Context) {
	log.Println("🔄 Resetting database - truncating all tables...")

	// Truncate all tables
	if err := services.TruncateAllTables(); err != nil {
		log.Printf("❌ Failed to truncate tables: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset database"})
		return
	}

	log.Println("✅ All tables truncated successfully")

	// Broadcast reset event via WebSocket
	resetMessage := map[string]interface{}{
		"type":    "reset",
		"message": "Database has been reset",
	}

	wshub.WSHub.Broadcast <- resetMessage
	log.Println("📡 Reset broadcast sent to all connected clients")

	c.JSON(http.StatusOK, gin.H{"message": "Database reset complete"})
}
