package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tri27pham/incident-management-simulator/backend/internal/agent"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
)

// StartAgentRemediationHandler triggers AI agent remediation for an incident
func StartAgentRemediationHandler(c *gin.Context) {
	incidentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID"})
		return
	}

	// Get incident
	var incident models.Incident
	if err := db.DB.First(&incident, "id = ?", incidentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Incident not found"})
		return
	}

	log.Printf("🤖 Starting agent remediation for incident %s", incidentID.String()[:8])

	// Create agent service
	agentService := agent.NewAgentService()

	// Start remediation workflow
	execution, err := agentService.StartRemediation(&incident)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, execution)
}

// GetAgentExecutionHandler retrieves an agent execution by ID
func GetAgentExecutionHandler(c *gin.Context) {
	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	var execution models.AgentExecution
	if err := db.DB.First(&execution, "id = ?", executionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}

	c.JSON(http.StatusOK, execution)
}

// GetIncidentAgentExecutionsHandler retrieves all executions for an incident
func GetIncidentAgentExecutionsHandler(c *gin.Context) {
	incidentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid incident ID"})
		return
	}

	var executions []models.AgentExecution
	if err := db.DB.Where("incident_id = ?", incidentID).Order("created_at desc").Find(&executions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch executions"})
		return
	}

	c.JSON(http.StatusOK, executions)
}

// ApproveAgentExecutionHandler approves an agent execution to proceed
func ApproveAgentExecutionHandler(c *gin.Context) {
	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	var execution models.AgentExecution
	if err := db.DB.First(&execution, "id = ?", executionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}

	// Check if execution is awaiting approval
	if execution.Status != models.StatusAwaitingApproval {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution is not awaiting approval"})
		return
	}

	log.Printf("✅ [Agent] User approved execution %s", executionID.String()[:8])

	// Signal approval by updating status
	agentService := agent.NewAgentService()
	if err := agentService.ApproveExecution(&execution); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, execution)
}

// RejectAgentExecutionHandler rejects an agent execution
func RejectAgentExecutionHandler(c *gin.Context) {
	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	var execution models.AgentExecution
	if err := db.DB.First(&execution, "id = ?", executionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}

	// Check if execution is awaiting approval
	if execution.Status != models.StatusAwaitingApproval {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution is not awaiting approval"})
		return
	}

	log.Printf("❌ [Agent] User rejected execution %s", executionID.String()[:8])

	// Cancel execution
	execution.Status = models.StatusCancelled
	execution.ErrorMessage = "Rejected by user"
	if err := db.DB.Save(&execution).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel execution"})
		return
	}

	c.JSON(http.StatusOK, execution)
}
