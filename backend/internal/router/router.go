package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/cors"
	"github.com/tri27pham/incident-management-simulator/backend/internal/handlers"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// Allow all origins for WebSocket and API requests.
	// For production, you should restrict this to your frontend's domain.
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Origin", "Content-Type", "Accept"},
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
	})

	// Adapt the cors middleware for Gin
	r.Use(func(ctx *gin.Context) {
		c.HandlerFunc(ctx.Writer, ctx.Request)
		ctx.Next()
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
