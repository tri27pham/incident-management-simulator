package router

import (
	"github.com/gin-gonic/gin"
	"github.com/tri27pham/incident-management-simulator/backend/internal/handlers"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
		api.GET("/incidents", handlers.GetAllIncidentsHandler)
		api.POST("/incidents", handlers.CreateIncidentHandler)
		api.GET("/incidents/:id", handlers.GetIncidentByIDHandler)
	}

	return r
}
