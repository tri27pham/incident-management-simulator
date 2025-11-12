package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tri27pham/incident-management-simulator/backend/internal/handlers"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// CORS middleware - explicit headers before every request
	r.Use(func(c *gin.Context) {
		// Set CORS headers for every request
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Max-Age", "86400")

		// Handle preflight OPTIONS request
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	})

	// API v1 routes
	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// WebSocket endpoint
		api.GET("/ws", handlers.WebSocketHandler)

		// Incident routes
		api.GET("/incidents", handlers.GetAllIncidentsHandler)
		api.GET("/incidents/resolved", handlers.GetResolvedIncidentsHandler)
		api.POST("/incidents", handlers.CreateIncidentHandler)
		api.POST("/incidents/generate", handlers.GenerateRandomIncidentHandler)
		api.GET("/incidents/:id", handlers.GetIncidentByIDHandler)
		api.PATCH("/incidents/:id", handlers.UpdateIncidentHandler)
		api.DELETE("/incidents/:id", handlers.DeleteIncidentHandler)
		api.POST("/incidents/:id/diagnose", handlers.TriggerAIDiagnosisHandler)
		api.POST("/incidents/:id/suggest-fix", handlers.TriggerAISuggestedFixHandler)

		// AI Agent routes
		api.POST("/incidents/:id/agent/remediate", handlers.StartAgentRemediationHandler)
		api.GET("/incidents/:id/agent/executions", handlers.GetIncidentAgentExecutionsHandler)
		api.GET("/agent/executions/:executionId", handlers.GetAgentExecutionHandler)
		api.POST("/agent/executions/:executionId/approve", handlers.ApproveAgentExecutionHandler)
		api.POST("/agent/executions/:executionId/reject", handlers.RejectAgentExecutionHandler)

		// Database reset broadcast
		api.POST("/reset", handlers.ResetDatabaseHandler)
	}

	return r
}
